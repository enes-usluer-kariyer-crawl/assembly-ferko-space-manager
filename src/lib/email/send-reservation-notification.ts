"use server";

import { invokeSupabaseFunction } from "@/lib/email/invoke-supabase-function";

type NotificationType = "pending" | "approved" | "cancelled";

type ReservationNotificationParams = {
    notificationType: NotificationType;
    reservation: {
        id: string;
        title: string;
        description?: string;
        startTime: string;
        endTime: string;
        roomName: string;
        cateringRequested?: boolean;
        isRecurring?: boolean;
        recurrencePattern?: string;
    };
    requester: {
        name: string;
        email: string;
    };
    cancellationReason?: string;
};

type ReservationNotificationResult = {
    success: boolean;
    sent?: string[];
    failed?: string[];
    error?: string;
};

type SendReservationNotificationOptions = {
    accessToken?: string;
};

export async function sendReservationNotification(
    params: ReservationNotificationParams,
    options?: SendReservationNotificationOptions
): Promise<ReservationNotificationResult> {
    try {
        const { data, error } = await invokeSupabaseFunction<{
            success?: boolean;
            sent?: string[];
            failed?: string[];
            error?: string;
        }>("send-reservation-notification", params, options);

        if (error) {
            console.error("Failed to send reservation notification:", error);
            return {
                success: false,
                error,
            };
        }

        if (!data?.success) {
            return {
                success: false,
                error: data?.error || "Failed to send notification",
            };
        }

        const failedRecipients = data.failed ?? [];

        console.log(`[RESERVATION NOTIFICATION] Sent to: ${data.sent?.join(", ") || "none"}`);
        if (failedRecipients.length > 0) {
            console.warn(`[RESERVATION NOTIFICATION] Failed for: ${failedRecipients.join(", ")}`);
        }

        return {
            success: true,
            sent: data.sent,
            failed: failedRecipients,
        };
    } catch (error) {
        console.error("Error calling reservation notification function:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}
