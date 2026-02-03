"use server";

type TeamsReservationAlertParams = {
  reservationId: string;
  title: string;
  roomName: string;
  startTime: string;
  endTime: string;
  requesterName: string;
  requesterEmail?: string | null;
  tags?: string[];
  cateringRequested?: boolean;
  isRecurring?: boolean;
  status: "pending" | "approved" | "rejected";
};

type TeamsReservationAlertResult = {
  success: boolean;
  skipped?: boolean;
  error?: string;
};

const ISTANBUL_TIMEZONE = "Europe/Istanbul";

function formatReservationDate(start: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: ISTANBUL_TIMEZONE,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(start);
}

function formatReservationTimeRange(start: Date, end: Date): string {
  const timeFormatter = new Intl.DateTimeFormat("tr-TR", {
    timeZone: ISTANBUL_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${timeFormatter.format(start)} - ${timeFormatter.format(end)}`;
}

export async function sendTeamsReservationAlert(
  params: TeamsReservationAlertParams
): Promise<TeamsReservationAlertResult> {
  const webhookUrl = process.env.TEAMS_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn("[TEAMS] TEAMS_WEBHOOK_URL is missing. Skipping notification.");
    return { success: false, skipped: true, error: "Missing TEAMS_WEBHOOK_URL" };
  }

  const start = new Date(params.startTime);
  const end = new Date(params.endTime);

  const dateText = formatReservationDate(start);
  const timeText = formatReservationTimeRange(start, end);

  const requesterLabel = params.requesterEmail
    ? `${params.requesterName} (${params.requesterEmail})`
    : params.requesterName;

  const tagsText = params.tags && params.tags.length > 0 ? params.tags.join(", ") : "-";

  const statusLabelMap: Record<TeamsReservationAlertParams["status"], string> = {
    pending: "Onay bekliyor",
    approved: "Onaylandı",
    rejected: "Reddedildi",
  };

  const activityTitleMap: Record<TeamsReservationAlertParams["status"], string> = {
    pending: "Yeni rezervasyon isteği",
    approved: "Rezervasyon onaylandı",
    rejected: "Rezervasyon reddedildi",
  };

  const payload = {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    summary: activityTitleMap[params.status],
    themeColor: params.status === "approved" ? "27AE60" : params.status === "rejected" ? "EB5757" : "F2C94C",
    sections: [
      {
        activityTitle: activityTitleMap[params.status],
        activitySubtitle: requesterLabel,
        facts: [
          { name: "Başlık", value: params.title },
          { name: "Oda", value: params.roomName },
          { name: "Tarih", value: dateText },
          { name: "Saat", value: timeText },
          { name: "Durum", value: statusLabelMap[params.status] },
          { name: "Tekrarlı", value: params.isRecurring ? "Haftalık" : "Hayır" },
          { name: "İkram", value: params.cateringRequested ? "Evet" : "Hayır" },
          { name: "Etiketler", value: tagsText },
          { name: "Rezervasyon ID", value: params.reservationId },
        ],
        markdown: true,
      },
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[TEAMS] Notification failed (${response.status} ${response.statusText}): ${errorText}`
      );
      return { success: false, error: errorText || response.statusText };
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[TEAMS] Notification error:", message);
    return { success: false, error: message };
  }
}
