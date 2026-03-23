"use server";

import { invokeSupabaseFunction } from "@/lib/email/invoke-supabase-function";

export type SendCateringNotificationParams = {
    reservation: {
        id: string;
        title: string;
        description?: string;
        startTime: string;
        endTime: string;
        roomName: string;
    };
    requester: {
        name: string;
        email: string;
    };
};

export type SendCateringNotificationResult = {
    success: boolean;
    error?: string;
};

type SendCateringNotificationOptions = {
    accessToken?: string;
};

/**
 * İkram talebi olduğunda Oylum'a bildirim e-postası gönderir.
 * E-posta içinde toplantı bilgileri ve takvim daveti (ICS) dosyası bulunur.
 */
export async function sendCateringNotification(
    params: SendCateringNotificationParams,
    options?: SendCateringNotificationOptions
): Promise<SendCateringNotificationResult> {
    try {
        const { data, error } = await invokeSupabaseFunction<{ success?: boolean; error?: string }>(
            "send-catering-notification",
            params,
            options
        );

        if (error) {
            console.error("Error invoking send-catering-notification function:", error);
            return { success: false, error };
        }

        if (data && !data.success) {
            return { success: false, error: data.error || "İkram bildirimi gönderilemedi" };
        }

        console.log(`[CATERING] Notification sent successfully for reservation ${params.reservation.id}`);
        return { success: true };
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu";
        console.error("Error sending catering notification:", errorMessage);
        return { success: false, error: errorMessage };
    }
}
