import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const SMTP_HOSTNAME = Deno.env.get("SMTP_HOSTNAME") || "smtp.gmail.com";
const SMTP_PORT = parseInt(Deno.env.get("SMTP_PORT") || "465");
const SMTP_USERNAME = Deno.env.get("SMTP_USERNAME") || "assembly.bildirim@gmail.com";
const SMTP_PASSWORD = Deno.env.get("SMTP_PASSWORD") || "ocho auac jnzv vakf";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type InvitationRequest = {
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

function generateICS(event: {
  uid: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location: string;
  organizerEmail: string;
  organizerName: string;
  attendeeEmail: string;
}): string {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  };

  const now = formatDate(new Date().toISOString());
  const start = formatDate(event.startTime);
  const end = formatDate(event.endTime);

  // Simple escape - only escape newlines and backslashes
  const escapeText = (text: string) =>
    text.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

  // RFC 5545 compliant ICS
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
    `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN=${event.attendeeEmail}:mailto:${event.attendeeEmail}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "TRANSP:OPAQUE",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Reminder",
    "TRIGGER:-PT15M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n");
}

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

function generateEmailHTML(params: InvitationRequest): string {
  const { reservation, organizer } = params;

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Toplanti Daveti</h1>
  </div>

  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="margin-top: 0;">Merhaba,</p>

    <p><strong>${organizer.name}</strong> sizi bir toplantiya davet etti.</p>

    <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 20px 0;">
      <h2 style="margin-top: 0; color: #4f46e5; font-size: 18px;">${reservation.title}</h2>

      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #6b7280; width: 100px;">Oda:</td>
          <td style="padding: 8px 0; font-weight: 500;">${reservation.roomName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Baslangic:</td>
          <td style="padding: 8px 0; font-weight: 500;">${formatDateTurkish(reservation.startTime)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6b7280;">Bitis:</td>
          <td style="padding: 8px 0; font-weight: 500;">${formatDateTurkish(reservation.endTime)}</td>
        </tr>
        ${reservation.description ? `
        <tr>
          <td style="padding: 8px 0; color: #6b7280; vertical-align: top;">Aciklama:</td>
          <td style="padding: 8px 0;">${reservation.description}</td>
        </tr>
        ` : ""}
      </table>
    </div>

    <p style="background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
      <strong>Not:</strong> Takvim uygulamanizda etkinligi eklemek icin ekteki davet.ics dosyasini acin.
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">

    <p style="color: #6b7280; font-size: 14px; margin-bottom: 0;">
      Bu email Ferko Space Manager tarafindan otomatik olarak gonderilmistir.
    </p>
  </div>
</body>
</html>`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const params: InvitationRequest = await req.json();
    const { to, reservation, organizer } = params;

    // Validate required fields
    if (!to || !reservation?.id || !reservation?.title || !organizer?.email) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check SMTP configuration
    if (!SMTP_USERNAME || !SMTP_PASSWORD) {
      console.error("SMTP credentials not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate ICS content
    const icsContent = generateICS({
      uid: `${reservation.id}@ferko-space-manager.com`,
      title: reservation.title,
      description: reservation.description,
      startTime: reservation.startTime,
      endTime: reservation.endTime,
      location: `Ferko - ${reservation.roomName}`,
      organizerEmail: organizer.email,
      organizerName: organizer.name,
      attendeeEmail: to,
    });

    // Generate email HTML
    const emailHTML = generateEmailHTML(params);

    // Create SMTP client
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

    // Send email with proper calendar attachment
    await client.send({
      from: SMTP_USERNAME,
      to: to,
      subject: `Toplanti Daveti: ${reservation.title}`,
      content: "Takvim davetiniz HTML destekli bir email istemcisi gerektirmektedir.",
      html: emailHTML,
      attachments: [
        {
          filename: "davet.ics",
          content: new TextEncoder().encode(icsContent),
          contentType: "text/calendar; charset=utf-8; method=REQUEST",
        },
      ],
    });

    await client.close();

    console.log(`[INVITATION] Email sent successfully to ${to}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending invitation email:", error);

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
