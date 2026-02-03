"use server";

import { createClient } from "@/lib/supabase/server";

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

export async function sendInvitationEmail(
  params: SendInvitationParams
): Promise<SendInvitationResult> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.functions.invoke("send-invitation", {
      body: params,
    });

    if (error) {
      console.error("Error invoking send-invitation function:", error);
      return { success: false, error: error.message };
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
  organizer: SendInvitationParams["organizer"]
): Promise<{ sent: string[]; failed: string[] }> {
  const sent: string[] = [];
  const failed: string[] = [];

  for (const email of attendees) {
    const result = await sendInvitationEmail({
      to: email,
      reservation,
      organizer,
    });

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
