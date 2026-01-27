"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = {
  error?: string | null;
  success?: boolean;
} | undefined;

const ALLOWED_DOMAINS = ['kariyer.net', 'techcareer.net', 'coens.io'];
const ADMIN_WHITELIST = ['eusluer.eu@gmail.com'];

function validateEmailDomain(email: string): { valid: boolean; error?: string } {
  const domain = email.split('@')[1]?.toLowerCase();

  if (ADMIN_WHITELIST.includes(email.toLowerCase())) {
    return { valid: true };
  }

  if (!domain || !ALLOWED_DOMAINS.includes(domain)) {
    return {
      valid: false,
      error: "Sadece onaylı kurumsal mailler veya yönetici hesabı giriş yapabilir."
    };
  }

  return { valid: true };
}

export async function login(prevState: AuthState, formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const next = (formData.get("next") as string) || "/";

  const validation = validateEmailDomain(email);
  if (!validation.valid) {
    return { error: validation.error };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect(next);
}

export async function signup(prevState: AuthState, formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const full_name = formData.get("full_name") as string;

  const validation = validateEmailDomain(email);
  if (!validation.valid) {
    return { error: validation.error };
  }

  console.log(`Signup started for email: ${email}`);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name,
      },
    },
  });

  console.log("Supabase signUp result:", { data, error });

  if (error) {
    console.error("SUPABASE ERROR:", error);
    return { error: error.message || "Database error saving new user" };
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
