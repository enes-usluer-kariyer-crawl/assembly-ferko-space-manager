import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const SMTP_HOSTNAME = Deno.env.get("SMTP_HOSTNAME") || "smtp.gmail.com";
const SMTP_PORT = parseInt(Deno.env.get("SMTP_PORT") || "465");
const SMTP_USERNAME = Deno.env.get("SMTP_USERNAME") || "assembly.bildirim@gmail.com";
const SMTP_PASSWORD = Deno.env.get("SMTP_PASSWORD") || "ocho auac jnzv vakf";

// Oylum'un e-posta adresi - ikram talepleri bu adrese gönderilecek
const CATERING_NOTIFICATION_EMAIL = "oylum.bicer@kariyer.net";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type CateringNotificationRequest = {
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

function generateICS(event: {
    uid: string;
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    location: string;
    organizerEmail: string;
    organizerName: string;
}): string {
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    };

    const now = formatDate(new Date().toISOString());
    const start = formatDate(event.startTime);
    const end = formatDate(event.endTime);

    const escapeText = (text: string) =>
        text.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

    const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Ferko Space Manager//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:REQUEST",
        "BEGIN:VEVENT",
        `UID:${event.uid}`,
        `DTSTAMP:${now}`,
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:${escapeText(event.title)}`,
        `DESCRIPTION:${escapeText(event.description || "")}`,
        `LOCATION:${escapeText(event.location)}`,
        `ORGANIZER;CN=${escapeText(event.organizerName)}:mailto:${event.organizerEmail}`,
        "STATUS:CONFIRMED",
        "SEQUENCE:0",
        "TRANSP:OPAQUE",
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        "DESCRIPTION:Ikram Hatirlatmasi",
        "TRIGGER:-PT30M",
        "END:VALARM",
        "END:VEVENT",
        "END:VCALENDAR",
    ];

    return lines.join("\r\n");
}

function generateEmailHTML(params: CateringNotificationRequest): string {
    const { reservation, requester } = params;
    const startDate = formatDateTurkish(reservation.startTime);
    const endDate = formatDateTurkish(reservation.endTime);
    const descriptionRow = reservation.description
        ? `<tr><td style="padding:8px 0;color:#6b7280;vertical-align:top;">Aciklama:</td><td style="padding:8px 0;">${reservation.description}</td></tr>`
        : "";

    return `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;"><div style="background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);padding:30px;border-radius:10px 10px 0 0;"><h1 style="color:white;margin:0;font-size:24px;">Rezervasyon Ikram Talebi</h1></div><div style="background:#f9fafb;padding:30px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;"><p style="margin-top:0;">Merhaba,</p><p><strong>${requester.name}</strong> tarafindan olusturulan bir toplanti icin <strong style="color:#d97706;">ikram talep edilmistir</strong>.</p><div style="background:white;padding:20px;border-radius:8px;border:1px solid #e5e7eb;margin:20px 0;"><h2 style="margin-top:0;color:#d97706;font-size:18px;">${reservation.title}</h2><table style="width:100%;border-collapse:collapse;"><tr><td style="padding:8px 0;color:#6b7280;width:120px;">Oda:</td><td style="padding:8px 0;font-weight:500;">${reservation.roomName}</td></tr><tr><td style="padding:8px 0;color:#6b7280;">Baslangic:</td><td style="padding:8px 0;font-weight:500;">${startDate}</td></tr><tr><td style="padding:8px 0;color:#6b7280;">Bitis:</td><td style="padding:8px 0;font-weight:500;">${endDate}</td></tr><tr><td style="padding:8px 0;color:#6b7280;">Talep Eden:</td><td style="padding:8px 0;font-weight:500;">${requester.name} (${requester.email})</td></tr>${descriptionRow}</table></div><div style="background:#fef3c7;padding:15px;border-radius:8px;border-left:4px solid #f59e0b;margin:20px 0;"><strong>Dikkat:</strong> Bu toplanti icin ikram hazirligi yapilmasi gerekmektedir.</div><p style="background:#e0f2fe;padding:15px;border-radius:8px;border-left:4px solid #0284c7;margin:20px 0;"><strong>Ipucu:</strong> Takvim uygulamanizda etkinligi eklemek icin ekteki davet.ics dosyasini acin.</p><hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"><p style="color:#6b7280;font-size:14px;margin-bottom:0;">Bu email Ferko Space Manager tarafindan otomatik olarak gonderilmistir.</p></div></body></html>`;
}

// Base64 encode helper
function base64Encode(str: string): string {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    let binary = "";
    for (let i = 0; i < data.length; i++) {
        binary += String.fromCharCode(data[i]);
    }
    return btoa(binary);
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const params: CateringNotificationRequest = await req.json();
        const { reservation, requester } = params;

        if (!reservation?.id || !reservation?.title || !requester?.email) {
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

        const icsContent = generateICS({
            uid: `catering-${reservation.id}@ferko-space-manager.com`,
            title: `[IKRAM] ${reservation.title}`,
            description: `Ikram Talebi - Toplanti: ${reservation.title} - Talep Eden: ${requester.name} (${requester.email})`,
            startTime: reservation.startTime,
            endTime: reservation.endTime,
            location: `Ferko - ${reservation.roomName}`,
            organizerEmail: requester.email,
            organizerName: requester.name,
        });

        const emailHTML = generateEmailHTML(params);

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

        await client.send({
            from: SMTP_USERNAME,
            to: CATERING_NOTIFICATION_EMAIL,
            subject: `Rezervasyon Ikram Talebi: ${reservation.title}`,
            content: "Bu email HTML destekli bir email istemcisi gerektirmektedir.",
            html: emailHTML,
            attachments: [
                {
                    filename: "davet.ics",
                    content: base64Encode(icsContent),
                    encoding: "base64",
                    contentType: "text/calendar; charset=utf-8; method=REQUEST",
                },
            ],
        });

        await client.close();

        console.log(`[CATERING] Notification email sent successfully to ${CATERING_NOTIFICATION_EMAIL}`);

        return new Response(
            JSON.stringify({ success: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Error sending catering notification email:", error);

        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
