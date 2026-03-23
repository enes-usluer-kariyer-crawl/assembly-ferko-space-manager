"use server";

import { invokeSupabaseFunction } from "@/lib/email/invoke-supabase-function";

export type SendCancellationParams = {
  to: string;
  reservation: {
    id: string;
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    roomName: string;
  };
  organizer: {
    name: string;
    email: string;
  };
};

export type SendCancellationResult = {
  success: boolean;
  error?: string;
};

type SendCancellationOptions = {
  accessToken?: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function sendCancellationEmail(
  params: SendCancellationParams,
  options?: SendCancellationOptions
): Promise<SendCancellationResult> {
  try {
    const { data, error } = await invokeSupabaseFunction<{ success?: boolean; error?: string }>(
      "send-cancellation",
      params,
      options
    );

    if (error) {
      console.error("Error invoking send-cancellation function:", error);
      return { success: false, error };
    }

    if (data && !data.success) {
      return { success: false, error: data.error || "Email gonderilemedi" };
    }

    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Beklenmeyen bir hata olustu";
    console.error("Error sending cancellation email:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

export async function sendCancellationEmails(
  attendees: string[],
  reservation: SendCancellationParams["reservation"],
  organizer: SendCancellationParams["organizer"],
  options?: SendCancellationOptions
): Promise<{ sent: string[]; failed: string[] }> {
  const sent: string[] = [];
  const failed: string[] = [];
  const uniqueAttendees = Array.from(new Set(attendees.map(normalizeEmail)));

  for (const email of uniqueAttendees) {
    if (!isValidEmail(email)) {
      failed.push(email);
      console.error(`[CANCELLATION] Invalid email skipped: ${email}`);
      continue;
    }

    const result = await sendCancellationEmail({
      to: email,
      reservation,
      organizer,
    }, options);

    if (result.success) {
      sent.push(email);
      console.log(`[CANCELLATION] Email sent to ${email}`);
    } else {
      failed.push(email);
      console.error(`[CANCELLATION] Failed to send email to ${email}: ${result.error}`);
    }
  }

  return { sent, failed };
}
