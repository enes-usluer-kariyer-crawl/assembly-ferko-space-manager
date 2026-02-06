"use server";

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

export async function sendReservationNotification(
    params: ReservationNotificationParams
): Promise<ReservationNotificationResult> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!supabaseUrl) {
        console.error("Supabase URL not configured");
        return { success: false, error: "Supabase URL not configured" };
    }

    const functionUrl = `${supabaseUrl}/functions/v1/send-reservation-notification`;

    try {
        const response = await fetch(functionUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(params),
        });

        const result = await response.json();

        if (!response.ok) {
            console.error("Failed to send reservation notification:", result);
            return {
                success: false,
                error: result.error || "Failed to send notification"
            };
        }

        console.log(`[RESERVATION NOTIFICATION] Sent to: ${result.sent?.join(", ") || "none"}`);
        if (result.failed?.length > 0) {
            console.warn(`[RESERVATION NOTIFICATION] Failed for: ${result.failed.join(", ")}`);
        }

        return {
            success: true,
            sent: result.sent,
            failed: result.failed,
        };
    } catch (error) {
        console.error("Error calling reservation notification function:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}
