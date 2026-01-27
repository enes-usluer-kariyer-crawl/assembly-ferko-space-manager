"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = {
  error?: string | null;
  success?: boolean;
} | undefined;

const ALLOWED_DOMAINS = ['kariyer.net', 'techcareer.net', 'coens.io'];

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

  const validation = validateEmailDomain(email);
  if (!validation.valid) {
    return { error: validation.error };
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

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
