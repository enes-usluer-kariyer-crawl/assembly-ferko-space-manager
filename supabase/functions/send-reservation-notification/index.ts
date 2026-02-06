import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const SMTP_HOSTNAME = Deno.env.get("SMTP_HOSTNAME") || "smtp.gmail.com";
const SMTP_PORT = parseInt(Deno.env.get("SMTP_PORT") || "465");
const SMTP_USERNAME = Deno.env.get("SMTP_USERNAME") || "assembly.bildirim@gmail.com";
const SMTP_PASSWORD = Deno.env.get("SMTP_PASSWORD") || "ocho auac jnzv vakf";

// Bildirim alacak kişiler
const NOTIFICATION_RECIPIENTS = [
    "dogus.yon@kariyer.net",
    "oylum.bicer@kariyer.net",
    "vildan.sonmez@kariyer.net",
    "merve.varici@kariyer.net",
];

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type NotificationType = "pending" | "approved" | "cancelled";

type ReservationNotificationRequest = {
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

function formatDateTurkish(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleString("tr-TR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Istanbul",
    });
}

function generateEmailHTML(params: ReservationNotificationRequest): string {
    const { notificationType, reservation, requester, cancellationReason } = params;
    const startDate = formatDateTurkish(reservation.startTime);
    const endDate = formatDateTurkish(reservation.endTime);

    const isPending = notificationType === "pending";
    const isCancelled = notificationType === "cancelled";

    let headerColor = "#10b981"; // Green (Approved)
    let headerTitle = "Rezervasyon Onaylandi";
    let statusText = "onaylandi";
    let statusColor = "#10b981";

    if (isPending) {
        headerColor = "#f59e0b"; // Orange (Pending)
        headerTitle = "Yeni Rezervasyon Talebi";
        statusText = "onay bekliyor";
        statusColor = "#f59e0b";
    } else if (isCancelled) {
        headerColor = "#ef4444"; // Red (Cancelled)
        headerTitle = "Rezervasyon Iptal Edildi";
        statusText = "iptal edildi";
        statusColor = "#ef4444";
    }

    const cateringRow = reservation.cateringRequested
        ? `<tr><td style="padding:8px 0;color:#6b7280;">Ikram:</td><td style="padding:8px 0;font-weight:500;color:#f59e0b;">Talep Edildi</td></tr>`
        : "";

    const recurringRow = reservation.isRecurring
        ? `<tr><td style="padding:8px 0;color:#6b7280;">Tekrar:</td><td style="padding:8px 0;font-weight:500;">${reservation.recurrencePattern === "daily" ? "Her Gun" : reservation.recurrencePattern === "weekly" ? "Her Hafta" : reservation.recurrencePattern === "biweekly" ? "Iki Haftada Bir" : reservation.recurrencePattern === "monthly" ? "Her Ay" : "Evet"}</td></tr>`
        : "";

    const descriptionRow = reservation.description
        ? `<tr><td style="padding:8px 0;color:#6b7280;vertical-align:top;">Aciklama:</td><td style="padding:8px 0;white-space:pre-wrap;">${reservation.description}</td></tr>`
        : "";

    const cancellationRow = isCancelled && cancellationReason
        ? `<tr><td style="padding:8px 0;color:#ef4444;vertical-align:top;font-weight:bold;">Iptal Nedeni:</td><td style="padding:8px 0;color:#ef4444;">${cancellationReason}</td></tr>`
        : "";

    let infoBox = `<div style="background:#d1fae5;padding:15px;border-radius:8px;border-left:4px solid #10b981;margin:20px 0;"><strong>Bilgi:</strong> Bu rezervasyon onaylandi ve takvime eklendi.</div>`;

    if (isPending) {
        infoBox = `<div style="background:#fef3c7;padding:15px;border-radius:8px;border-left:4px solid #f59e0b;margin:20px 0;"><strong>Bilgi:</strong> Bu rezervasyon admin onayi beklemektedir.</div>`;
    } else if (isCancelled) {
        infoBox = `<div style="background:#fee2e2;padding:15px;border-radius:8px;border-left:4px solid #ef4444;margin:20px 0;"><strong>Bilgi:</strong> Bu rezervasyon iptal edilmistir ve takvimden silinmistir (veya durumu guncellenmistir).</div>`;
    }

    return `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;"><div style="background:linear-gradient(135deg,${headerColor} 0%,${headerColor}dd 100%);padding:30px;border-radius:10px 10px 0 0;"><h1 style="color:white;margin:0;font-size:24px;">${headerTitle}</h1></div><div style="background:#f9fafb;padding:30px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;"><p style="margin-top:0;">Merhaba,</p><p><strong>${requester.name}</strong> tarafindan olusturulan bir rezervasyon <strong style="color:${statusColor};">${statusText}</strong>.</p><div style="background:white;padding:20px;border-radius:8px;border:1px solid #e5e7eb;margin:20px 0;"><h2 style="margin-top:0;color:${headerColor};font-size:18px;">${reservation.title}</h2><table style="width:100%;border-collapse:collapse;"><tr><td style="padding:8px 0;color:#6b7280;width:120px;">Oda:</td><td style="padding:8px 0;font-weight:500;">${reservation.roomName}</td></tr><tr><td style="padding:8px 0;color:#6b7280;">Baslangic:</td><td style="padding:8px 0;font-weight:500;">${startDate}</td></tr><tr><td style="padding:8px 0;color:#6b7280;">Bitis:</td><td style="padding:8px 0;font-weight:500;">${endDate}</td></tr><tr><td style="padding:8px 0;color:#6b7280;">Talep Eden:</td><td style="padding:8px 0;font-weight:500;">${requester.name} (${requester.email})</td></tr>${cancellationRow}${cateringRow}${recurringRow}${descriptionRow}</table></div>${infoBox}<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"><p style="color:#6b7280;font-size:14px;margin-bottom:0;">Bu email Ferko Space Manager tarafindan otomatik olarak gonderilmistir.</p></div></body></html>`;
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const params: ReservationNotificationRequest = await req.json();
        const { notificationType, reservation, requester } = params;

        if (!reservation?.id || !reservation?.title || !requester?.email || !notificationType) {
            return new Response(
                JSON.stringify({ success: false, error: "Missing required fields" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (!SMTP_USERNAME || !SMTP_PASSWORD) {
            console.error("SMTP credentials not configured");
            return new Response(
                JSON.stringify({ success: false, error: "Email service not configured" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const emailHTML = generateEmailHTML(params);

        let subject = `Rezervasyon Onaylandi: ${reservation.title}`;
        if (notificationType === "pending") {
            subject = `Yeni Rezervasyon Talebi: ${reservation.title}`;
        } else if (notificationType === "cancelled") {
            subject = `Rezervasyon Iptal Edildi: ${reservation.title}`;
        }

        const client = new SMTPClient({
            connection: {
                hostname: SMTP_HOSTNAME,
                port: SMTP_PORT,
                tls: true,
                auth: {
                    username: SMTP_USERNAME,
                    password: SMTP_PASSWORD,
                },
            },
        });

        // Send email to all recipients
        const results = { sent: [] as string[], failed: [] as string[] };

        for (const recipient of NOTIFICATION_RECIPIENTS) {
            try {
                await client.send({
                    from: SMTP_USERNAME,
                    to: recipient,
                    subject: subject,
                    content: "Bu email HTML destekli bir email istemcisi gerektirmektedir.",
                    html: emailHTML,
                });
                results.sent.push(recipient);
                console.log(`[NOTIFICATION] Email sent to ${recipient}`);
            } catch (err) {
                results.failed.push(recipient);
                console.error(`[NOTIFICATION] Failed to send email to ${recipient}:`, err);
            }
        }

        await client.close();

        console.log(`[NOTIFICATION] Sent: ${results.sent.length}, Failed: ${results.failed.length}`);

        return new Response(
            JSON.stringify({ success: true, sent: results.sent, failed: results.failed }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Error sending reservation notification:", error);

        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
