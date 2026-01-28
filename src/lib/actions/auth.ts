"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = {
  error?: string | null;
  success?: boolean;
} | undefined;

const ALLOWED_DOMAINS = ['kariyer.net', 'techcareer.net', 'coens.io'];

// Test hesapları - magic link olmadan direkt giriş
const TEST_ACCOUNTS: Record<string, { password: string; isAdmin: boolean }> = {
  'eusluer.eu@kariyer.net': { password: 'test-user-password-2024', isAdmin: false },
  'eusluer.eu@coens.io': { password: 'test-admin-password-2024', isAdmin: true },
};

function isTestAccount(email: string): boolean {
  return email.toLowerCase() in TEST_ACCOUNTS;
}

function validateEmailDomain(email: string): { valid: boolean; error?: string } {
  const domain = email.split('@')[1]?.toLowerCase();

  if (!domain || !ALLOWED_DOMAINS.includes(domain)) {
    return {
      valid: false,
      error: "Sadece onaylı kurumsal mailler giriş yapabilir."
    };
  }

  return { valid: true };
}

export async function loginWithMagicLink(prevState: AuthState, formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const emailLower = email.toLowerCase();

  const validation = validateEmailDomain(email);
  if (!validation.valid) {
    return { error: validation.error };
  }

  // Test hesabı kontrolü - magic link olmadan direkt giriş
  if (isTestAccount(emailLower)) {
    const testAccount = TEST_ACCOUNTS[emailLower];

    const { error } = await supabase.auth.signInWithPassword({
      email: emailLower,
      password: testAccount.password,
    });

    if (error) {
      // Kullanıcı yoksa oluştur
      if (error.message.includes('Invalid login credentials')) {
        const { error: signUpError } = await supabase.auth.signUp({
          email: emailLower,
          password: testAccount.password,
          options: {
            data: {
              is_test_account: true,
            },
          },
        });

        if (signUpError) {
          return { error: signUpError.message };
        }

        // Tekrar giriş yap
        const { error: retryError } = await supabase.auth.signInWithPassword({
          email: emailLower,
          password: testAccount.password,
        });

        if (retryError) {
          return { error: retryError.message };
        }
      } else {
        return { error: error.message };
      }
    }

    // Admin ise profili güncelle
    if (testAccount.isAdmin) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            email: emailLower,
            is_admin: true,
            role: 'admin',
          }, { onConflict: 'id' });
      }
    }

    revalidatePath("/", "layout");
    redirect("/");
  }

  const origin = 'https://assembly-ferko-space-manager-production.up.railway.app';

  try {
    const { data: isAllowed, error: rateLimitError } = await supabase.rpc('check_and_update_rate_limit', {
      p_email: email
    });

    if (rateLimitError) {
      console.error("Rate limit check failed:", rateLimitError);
      // If the function doesn't exist (migration not run), we probably shouldn't block login,
      // but for this task we assume migration is part of the deliverable.
    } else if (isAllowed === false) {
      return { error: "Lütfen yeni bir kod istemeden önce 2 dakika bekleyin." };
    }
  } catch (err) {
    console.error("Unexpected error during rate limit check:", err);
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      shouldCreateUser: true,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true, error: null };
}

export async function signOut() {
  const supabase = await createClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/login");
}

export async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, role")
    .eq("id", user.id)
    .single();

  return profile?.is_admin === true || profile?.role === "admin";
}

export async function getCurrentUserWithAdminStatus() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, isAdmin: false };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, role")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.is_admin === true || profile?.role === "admin";

  return { user, isAdmin };
}
