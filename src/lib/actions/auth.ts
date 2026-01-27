"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = {
  error?: string | null;
  success?: boolean;
} | undefined;

const ALLOWED_DOMAINS = ['kariyer.net', 'techcareer.net', 'coens.io', 'eusluer.eu'];

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
