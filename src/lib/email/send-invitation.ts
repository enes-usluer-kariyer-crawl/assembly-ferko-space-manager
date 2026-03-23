"use server";

import { invokeSupabaseFunction } from "@/lib/email/invoke-supabase-function";

export type SendInvitationParams = {
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

export type SendInvitationResult = {
  success: boolean;
  error?: string;
};

type SendInvitationOptions = {
  accessToken?: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function sendInvitationEmail(
  params: SendInvitationParams,
  options?: SendInvitationOptions
): Promise<SendInvitationResult> {
  try {
    const { data, error } = await invokeSupabaseFunction<{ success?: boolean; error?: string }>(
      "send-invitation",
      params,
      options
    );

    if (error) {
      console.error("Error invoking send-invitation function:", error);
      return { success: false, error };
    }

    if (data && !data.success) {
      return { success: false, error: data.error || "Email gönderilemedi" };
    }

    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu";
    console.error("Error sending invitation email:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

export async function sendInvitationEmails(
  attendees: string[],
  reservation: SendInvitationParams["reservation"],
  organizer: SendInvitationParams["organizer"],
  options?: SendInvitationOptions
): Promise<{ sent: string[]; failed: string[] }> {
  const sent: string[] = [];
  const failed: string[] = [];
  const uniqueAttendees = Array.from(new Set(attendees.map(normalizeEmail)));

  for (const email of uniqueAttendees) {
    if (!isValidEmail(email)) {
      failed.push(email);
      console.error(`[INVITATION] Invalid email skipped: ${email}`);
      continue;
    }

    const result = await sendInvitationEmail({
      to: email,
      reservation,
      organizer,
    }, options);

    if (result.success) {
      sent.push(email);
      console.log(`[INVITATION] Email sent to ${email}`);
    } else {
      failed.push(email);
      console.error(`[INVITATION] Failed to send email to ${email}: ${result.error}`);
    }
  }

  return { sent, failed };
}
