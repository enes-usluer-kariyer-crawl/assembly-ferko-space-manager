"use server";

import { createClient } from "@/lib/supabase/server";

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

/**
 * İkram talebi olduğunda Oylum'a bildirim e-postası gönderir.
 * E-posta içinde toplantı bilgileri ve takvim daveti (ICS) dosyası bulunur.
 */
export async function sendCateringNotification(
    params: SendCateringNotificationParams
): Promise<SendCateringNotificationResult> {
    try {
        const supabase = await createClient();

        const { data, error } = await supabase.functions.invoke("send-catering-notification", {
            body: params,
        });

        if (error) {
            console.error("Error invoking send-catering-notification function:", error);
            return { success: false, error: error.message };
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
