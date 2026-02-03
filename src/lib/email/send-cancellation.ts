"use server";

import { createClient } from "@/lib/supabase/server";

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

export async function sendCancellationEmail(
  params: SendCancellationParams
): Promise<SendCancellationResult> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.functions.invoke("send-cancellation", {
      body: params,
    });

    if (error) {
      console.error("Error invoking send-cancellation function:", error);
      return { success: false, error: error.message };
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
  organizer: SendCancellationParams["organizer"]
): Promise<{ sent: string[]; failed: string[] }> {
  const sent: string[] = [];
  const failed: string[] = [];

  for (const email of attendees) {
    const result = await sendCancellationEmail({
      to: email,
      reservation,
      organizer,
    });

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
