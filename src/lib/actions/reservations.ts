"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkAvailability } from "./availability";
import { ROOM_CAPACITIES, COMBINED_ROOMS } from "@/constants/rooms";
import { sendTeamsReservationAlert } from "@/lib/notifications/teams";

// Big Event tags that trigger global room lockout
const BIG_EVENT_TAGS = [
  "ÖM-Success Meetings",
  "Exco Toplantısı",
  "ÖM- HR Small Talks",
] as const;

// Label for blocked placeholder reservations
const BIG_EVENT_BLOCK_LABEL = "Ofis Kapalı - Büyük Etkinlik";

function isBigEventRequest(tags: string[]): boolean {
  return tags.some((tag) => BIG_EVENT_TAGS.includes(tag as (typeof BIG_EVENT_TAGS)[number]));
}

export type Room = {
  id: string;
  name: string;
  capacity: number;
  features: string[];
  is_active: boolean;
  img: string | null;
};

export type Reservation = {
  id: string;
  room_id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  tags: string[];
  attendees?: string[];
  catering_requested: boolean;
  is_recurring: boolean;
  recurrence_pattern: "none" | "daily" | "weekly" | "biweekly" | "monthly";
  recurrence_end_type?: "never" | "count" | "date";
  recurrence_count?: number;
  recurrence_end_date?: string;
  parent_reservation_id: string | null;
  rooms: {
    id: string;
    name: string;
  };
  profiles: {
    full_name: string | null;
    email: string;
  } | null;
};

export type GetReservationsParams = {
  startDate?: string;
  endDate?: string;
  roomId?: string;
};

export async function getReservations(params?: GetReservationsParams): Promise<{
  success: boolean;
  data?: Reservation[];
  error?: string;
}> {
  const supabase = await createClient();

  // For recurring events, we need to fetch them separately and expand them
  // First, fetch all non-recurring events and parent recurring events
  let query = supabase
    .from("reservations")
    .select(
      `
      id,
      room_id,
      user_id,
      title,
      description,
      start_time,
      end_time,
      status,
      tags,
      attendees,
      catering_requested,
      is_recurring,
      recurrence_pattern,
      recurrence_end_type,
      recurrence_count,
      recurrence_end_date,
      parent_reservation_id,
      rooms (
        id,
        name
      ),
      profiles (
        full_name,
        email
      )
    `
    )
    .in("status", ["pending", "approved"])
    .is("parent_reservation_id", null); // Only fetch parent/standalone reservations

  // Note: We don't filter by date here for recurring events
  // because we need to expand them to cover the requested date range

  if (params?.roomId) {
    query = query.eq("room_id", params.roomId);
  }

  query = query.order("start_time", { ascending: true });

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching reservations:", error);
    return {
      success: false,
      error: "Rezervasyonlar yüklenemedi.",
    };
  }

  // Transform the data to match our Reservation type
  const baseReservations = (data ?? []).map((item) => ({
    ...item,
    rooms: item.rooms as unknown as { id: string; name: string },
    profiles: item.profiles as unknown as { full_name: string | null; email: string } | null,
  })) as Reservation[];

  // Expand recurring events to cover the view range
  const expandedReservations: Reservation[] = [];

  // Determine the view range
  // Default: 3 months back and 1 year ahead from today (for calendar views)
  const now = new Date();
  const defaultViewStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // 3 months ago
  const defaultViewEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year ahead

  const viewStart = params?.startDate ? new Date(params.startDate) : defaultViewStart;
  const viewEnd = params?.endDate ? new Date(params.endDate) : defaultViewEnd;

  for (const reservation of baseReservations) {
    const pattern = reservation.recurrence_pattern;

    // Check if this is a recurring event
    if (reservation.is_recurring && pattern !== "none") {
      const originalStart = new Date(reservation.start_time);
      const originalEnd = new Date(reservation.end_time);
      const duration = originalEnd.getTime() - originalStart.getTime();

      // Determine the recurrence end condition
      const endType = reservation.recurrence_end_type || "never";
      const maxCount = reservation.recurrence_count || 52;
      const endDate = reservation.recurrence_end_date ? new Date(reservation.recurrence_end_date) : null;

      // Add the original event if it falls within the range
      if (originalStart <= viewEnd && originalEnd >= viewStart) {
        expandedReservations.push(reservation);
      }

      // Helper function to get next occurrence date
      const getNextOccurrence = (baseDate: Date, occurrence: number): Date => {
        const nextDate = new Date(baseDate);
        switch (pattern) {
          case "daily":
            nextDate.setDate(nextDate.getDate() + occurrence);
            break;
          case "weekly":
            nextDate.setDate(nextDate.getDate() + (occurrence * 7));
            break;
          case "biweekly":
            nextDate.setDate(nextDate.getDate() + (occurrence * 14));
            break;
          case "monthly":
            nextDate.setMonth(nextDate.getMonth() + occurrence);
            break;
        }
        return nextDate;
      };

      // Maximum iterations to prevent infinite loops
      const maxIterations = pattern === "daily" ? 365 : pattern === "monthly" ? 24 : 52;
      let occurrence = 1;
      let generatedCount = 1; // Original event counts as 1

      while (occurrence <= maxIterations) {
        const instanceStart = getNextOccurrence(originalStart, occurrence);

        // Check end conditions
        if (endType === "count" && generatedCount >= maxCount) break;
        if (endType === "date" && endDate && instanceStart > endDate) break;
        if (instanceStart > viewEnd) break;

        const instanceEnd = new Date(instanceStart.getTime() + duration);

        // Include if instance overlaps with view range
        if (instanceEnd >= viewStart) {
          expandedReservations.push({
            ...reservation,
            id: `${reservation.id}_${pattern}${occurrence}`,
            start_time: instanceStart.toISOString(),
            end_time: instanceEnd.toISOString(),
            parent_reservation_id: reservation.id,
          });
          generatedCount++;
        }

        occurrence++;
      }
    } else {
      // Non-recurring event - include all
      expandedReservations.push(reservation);
    }
  }

  // Sort by start time
  expandedReservations.sort((a, b) =>
    new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  return {
    success: true,
    data: expandedReservations,
  };
}

export async function getRooms(): Promise<{
  success: boolean;
  data: Room[];
  error?: string;
}> {
  try {
    console.log("Fetching rooms...");
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("rooms")
      .select("id, name, capacity, features, is_active, img")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching rooms:", error.message, error.details, error.hint);
      return {
        success: false,
        data: [],
        error: `Odalar yüklenemedi: ${error.message}`,
      };
    }

    console.log(`Successfully fetched ${data?.length ?? 0} rooms`);
    return {
      success: true,
      data: (data ?? []) as Room[],
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("Unexpected error fetching rooms:", errorMessage);
    return {
      success: false,
      data: [],
      error: `Beklenmeyen hata: ${errorMessage}`,
    };
  }
}

export type RecurrencePattern = "none" | "daily" | "weekly" | "biweekly" | "monthly";
export type RecurrenceEndType = "never" | "count" | "date";

export type CreateReservationInput = {
  roomId: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  tags?: string[];
  cateringRequested?: boolean;
  recurrencePattern?: RecurrencePattern;
  recurrenceEndType?: RecurrenceEndType;
  recurrenceCount?: number; // Number of occurrences (used when endType is "count")
  recurrenceEndDate?: string; // End date (used when endType is "date")
  attendees?: string[];
};

export type ConflictingReservation = {
  id: string;
  title: string;
  roomName: string;
  startTime: string;
  endTime: string;
  ownerName?: string;
};

export type CreateReservationResult = {
  success: boolean;
  error?: string;
  reservationId?: string;
  // For Big Events: warnings about existing meetings that clash
  conflictWarning?: {
    message: string;
    conflicts: ConflictingReservation[];
  };
  // For Admin Blocking Events: conflicts that must be resolved before proceeding
  conflictType?: "BLOCKING";
  conflictingEvents?: ConflictingReservation[];
};

export async function createReservation(
  input: CreateReservationInput
): Promise<CreateReservationResult> {
  const {
    roomId, title, description, startTime, endTime, tags, cateringRequested,
    recurrencePattern, recurrenceEndType, recurrenceCount, recurrenceEndDate, attendees
  } = input;

  // Validate required fields
  if (!roomId || !title || !startTime || !endTime) {
    return {
      success: false,
      error: "Gerekli alanlar eksik: Oda, başlık, başlangıç ve bitiş zamanı gereklidir.",
    };
  }

  // Validate dates
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return {
      success: false,
      error: "Başlangıç veya bitiş zamanı için geçersiz tarih formatı.",
    };
  }

  if (end <= start) {
    return {
      success: false,
      error: "Bitiş zamanı başlangıç zamanından sonra olmalıdır.",
    };
  }

  // Prevent booking in the past or same day (must be at least tomorrow)
  // Use Europe/Istanbul timezone to determine "Today" and "Tomorrow"
  const now = new Date();

  // Format dates as YYYY-MM-DD in Istanbul time
  const dateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const todayIstanbul = dateFormatter.format(now);
  const bookingDateIstanbul = dateFormatter.format(start);

  // Booking date must be strictly after today (future date)
  if (bookingDateIstanbul <= todayIstanbul) {
    return {
      success: false,
      error: "Rezervasyonlar en az 1 gün önceden yapılmalıdır.",
    };
  }

  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      error: "Rezervasyon oluşturmak için giriş yapmanız gerekiyor.",
    };
  }

  // Validate room exists and get capacity
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, name, capacity, is_active")
    .eq("id", roomId)
    .single();

  if (roomError || !room) {
    return {
      success: false,
      error: "Geçersiz oda seçildi.",
    };
  }

  if (!room.is_active) {
    return {
      success: false,
      error: "Seçilen oda rezervasyona açık değil.",
    };
  }

  // Check availability using the existing availability check
  const availabilityResult = await checkAvailability({
    startTime,
    endTime,
    roomId,
    newTags: tags ?? [],
  });

  if (!availabilityResult.available) {
    return {
      success: false,
      error: availabilityResult.reason ?? "Seçilen saat aralığında oda müsait değil.",
    };
  }

  // Get user's role to determine status
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return {
      success: false,
      error: "Kullanıcı profili alınamadı.",
    };
  }

  // Determine status based on user role
  const status = profile.role === "admin" ? "approved" : "pending";

  const isBigEvent = isBigEventRequest(tags ?? []);
  let conflictWarning: CreateReservationResult["conflictWarning"] = undefined;

  // For Big Events: Check for existing bookings that conflict and BLOCK creation
  // Admin must manually cancel these reservations first
  if (isBigEvent) {
    // Calculate buffered times (30 mins before and after)
    const start = new Date(startTime);
    const end = new Date(endTime);

    const bufferStart = new Date(start);
    bufferStart.setMinutes(bufferStart.getMinutes() - 30);

    const bufferEnd = new Date(end);
    bufferEnd.setMinutes(bufferEnd.getMinutes() + 30);

    const bufferStartTime = bufferStart.toISOString();
    const bufferEndTime = bufferEnd.toISOString();

    // Query to find ALL existing active reservations in the time range (any room)
    // We check the BUFFERED range to ensure the entire block period is clear
    const { data: existingBookings } = await supabase
      .from("reservations")
      .select("id, title, room_id, start_time, end_time, rooms(name), profiles(full_name, email)")
      .in("status", ["pending", "approved"])
      .not("tags", "cs", '{"big_event_block"}') // Exclude placeholder blocks
      .lt("start_time", bufferEndTime)
      .gt("end_time", bufferStartTime);

    if (existingBookings && existingBookings.length > 0) {
      const conflicts: ConflictingReservation[] = existingBookings.map((booking) => ({
        id: booking.id,
        title: booking.title,
        roomName: (booking.rooms as unknown as { name: string })?.name ?? "Unknown",
        startTime: booking.start_time,
        endTime: booking.end_time,
        ownerName: (booking.profiles as unknown as { email: string; full_name: string | null })?.email ?? (booking.profiles as unknown as { full_name: string | null })?.full_name ?? undefined,
      }));

      // BLOCKING: Do NOT create the reservation, return conflict data
      return {
        success: false,
        conflictType: "BLOCKING",
        conflictingEvents: conflicts,
        error: `Bu saat aralığında (hazırlık süresi dahil) ${conflicts.length} adet toplantı var. Blokaj koymak için önce bu toplantıların iptal edilmesi gerekmektedir.`,
      };
    }
  }

  const isRecurring = recurrencePattern !== undefined && recurrencePattern !== "none";

  // Ensure requester is in attendees list to receive calendar invite
  const requesterEmail = user.email;
  const finalAttendees = [...(attendees ?? [])];

  if (requesterEmail && !finalAttendees.includes(requesterEmail)) {
    finalAttendees.push(requesterEmail);
  }

  // Insert main reservation
  // For recurring events, we no longer create child instances upfront.
  // Instead, the calendar will dynamically generate recurring instances.
  const { data: reservation, error: insertError } = await supabase
    .from("reservations")
    .insert({
      room_id: roomId,
      user_id: user.id,
      title,
      description: description ?? null,
      start_time: startTime,
      end_time: endTime,
      status,
      tags: tags ?? [],
      attendees: finalAttendees,
      catering_requested: cateringRequested ?? false,
      is_recurring: isRecurring,
      recurrence_pattern: recurrencePattern ?? "none",
      recurrence_end_type: isRecurring ? (recurrenceEndType ?? "never") : null,
      recurrence_count: isRecurring && recurrenceEndType === "count" ? recurrenceCount : null,
      recurrence_end_date: isRecurring && recurrenceEndType === "date" ? recurrenceEndDate : null,
      parent_reservation_id: null,
    })
    .select("id")
    .single();

  if (insertError || !reservation) {
    console.error("Error creating reservation:", insertError);
    return {
      success: false,
      error: "Rezervasyon oluşturulamadı. Lütfen tekrar deneyin.",
    };
  }

  // Note: We no longer create child reservation instances for recurring events.
  // Recurring events repeat indefinitely and are generated dynamically in the calendar view.

  // Get user's name for notification
  const { data: userProfile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  const userName = userProfile?.full_name || userProfile?.email || "Unknown User";

  if (status === "pending") {
    await sendTeamsReservationAlert({
      reservationId: reservation.id,
      title,
      roomName: room.name,
      startTime,
      endTime,
      requesterName: userName,
      requesterEmail: userProfile?.email,
      attendees: finalAttendees ?? [],
      tags: tags ?? [],
      cateringRequested: cateringRequested ?? false,
      isRecurring,
      status: "pending",
    });
  }

  // Send catering notification email to Oylum when catering is requested
  if (cateringRequested) {
    const { sendCateringNotification } = await import("@/lib/email/send-catering-notification");

    const cateringResult = await sendCateringNotification({
      reservation: {
        id: reservation.id,
        title,
        description: description ?? undefined,
        startTime,
        endTime,
        roomName: room.name,
      },
      requester: {
        name: userName,
        email: userProfile?.email || "",
      },
    });

    if (cateringResult.success) {
      console.log(`[CATERING] Notification email sent to Oylum for reservation ${reservation.id}`);
    } else {
      console.warn(`[CATERING] Failed to send notification email: ${cateringResult.error}`);
    }
  }

  // Log notification for pending reservations
  if (status === "pending") {
    console.log(`[NOTIFICATION] Reservation pending approval: ${title} by ${userName}`);
    console.log(`  - Room: ${room.name}`);
    console.log(`  - Time: ${startTime} - ${endTime}`);
    if (cateringRequested) console.log(`  - Catering: Requested`);
    if (isRecurring) console.log(`  - Recurring: ${recurrencePattern}`);

    // Send email notification to admin team
    const { sendReservationNotification } = await import("@/lib/email/send-reservation-notification");

    const notificationResult = await sendReservationNotification({
      notificationType: "pending",
      reservation: {
        id: reservation.id,
        title,
        description: description ?? undefined,
        startTime,
        endTime,
        roomName: room.name,
        cateringRequested: cateringRequested ?? false,
        isRecurring,
        recurrencePattern: recurrencePattern ?? "none",
      },
      requester: {
        name: userName,
        email: userProfile?.email || "",
      },
    });

    if (notificationResult.success) {
      console.log(`[NOTIFICATION] Email sent to admin team for pending reservation ${reservation.id}`);
    } else {
      console.warn(`[NOTIFICATION] Failed to send email notification: ${notificationResult.error}`);
    }
  }

  // Send invitation emails to attendees only when the reservation is approved
  if (status === "approved" && finalAttendees && finalAttendees.length > 0) {
    const { sendInvitationEmails } = await import("@/lib/email/send-invitation");

    const { sent, failed } = await sendInvitationEmails(
      finalAttendees,
      {
        id: reservation.id,
        title,
        description: description ?? undefined,
        startTime,
        endTime,
        roomName: room.name,
      },
      {
        name: userName,
        email: userProfile?.email || "",
      }
    );

    if (sent.length > 0) {
      console.log(`[INVITATION] Successfully sent ${sent.length} invitation(s)`);
    }
    if (failed.length > 0) {
      console.warn(`[INVITATION] Failed to send ${failed.length} invitation(s)`);
    }
  }

  // For Big Events: Create blocked placeholder reservations for ALL OTHER ROOMS
  if (isBigEvent) {
    // Get all other active rooms
    const { data: otherRooms } = await supabase
      .from("rooms")
      .select("id")
      .eq("is_active", true)
      .neq("id", roomId);

    if (otherRooms && otherRooms.length > 0) {
      // Create blocked reservations for each other room
      // Use buffered times calculated earlier
      const start = new Date(startTime);
      const end = new Date(endTime);

      const bufferStart = new Date(start);
      bufferStart.setMinutes(bufferStart.getMinutes() - 30);

      const bufferEnd = new Date(end);
      bufferEnd.setMinutes(bufferEnd.getMinutes() + 30);

      const blockStartTime = bufferStart.toISOString();
      const blockEndTime = bufferEnd.toISOString();

      // If the main event is recurring, blocks should also be recurring with same pattern
      const blockedReservations = otherRooms.map((otherRoom) => ({
        room_id: otherRoom.id,
        user_id: user.id,
        title: BIG_EVENT_BLOCK_LABEL,
        description: `Blocked due to Big Event: ${title}`,
        start_time: blockStartTime,
        end_time: blockEndTime,
        status: "approved" as const,
        tags: ["big_event_block"],
        catering_requested: false,
        is_recurring: isRecurring,
        recurrence_pattern: isRecurring ? (recurrencePattern ?? "none") : "none",
        recurrence_end_type: isRecurring ? (recurrenceEndType ?? "never") : null,
        recurrence_count: isRecurring && recurrenceEndType === "count" ? recurrenceCount : null,
        recurrence_end_date: isRecurring && recurrenceEndType === "date" ? recurrenceEndDate : null,
        parent_reservation_id: null,
      }));

      const { error: blockInsertError } = await supabase
        .from("reservations")
        .insert(blockedReservations);

      if (blockInsertError) {
        console.error("Error creating blocked reservations:", blockInsertError);
        // Note: The main reservation was created successfully, so we don't fail the entire operation
        // but log the error for debugging
      }
    }
  }

  // Revalidate paths to refresh data
  revalidatePath("/");
  revalidatePath("/reservations");
  revalidatePath("/calendar");

  return {
    success: true,
    reservationId: reservation.id,
    conflictWarning,
  };
}

export type UpdateReservationStatusResult = {
  success: boolean;
  error?: string;
};

export async function updateReservationStatus(
  id: string,
  status: "approved" | "rejected"
): Promise<UpdateReservationStatusResult> {
  if (!id) {
    return {
      success: false,
      error: "Rezervasyon ID gereklidir.",
    };
  }

  if (status !== "approved" && status !== "rejected") {
    return {
      success: false,
      error: "Durum 'onaylandı' veya 'reddedildi' olmalıdır.",
    };
  }

  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      error: "Rezervasyonu güncellemek için giriş yapmanız gerekiyor.",
    };
  }

  // Check if user is admin
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return {
      success: false,
      error: "Kullanıcı profili alınamadı.",
    };
  }

  if (profile.role !== "admin") {
    return {
      success: false,
      error: "Sadece yöneticiler rezervasyon durumunu güncelleyebilir.",
    };
  }

  // Fetch the reservation to check if it's in the past and for notifications
  const { data: reservation, error: reservationError } = await supabase
    .from("reservations")
    .select(
      `
      id,
      title,
      description,
      start_time,
      end_time,
      status,
      tags,
      attendees,
      catering_requested,
      attendees,
      is_recurring,
      recurrence_pattern,
      rooms (
        name
      ),
      profiles (
        full_name,
        email
      )
    `
    )
    .eq("id", id)
    .single();

  if (reservationError || !reservation) {
    return {
      success: false,
      error: "Rezervasyon bulunamadı.",
    };
  }

  const previousStatus = reservation.status as Reservation["status"];

  // Prevent modifying past events
  if (new Date(reservation.end_time) < new Date()) {
    return {
      success: false,
      error: "Geçmiş etkinlikler düzenlenemez.",
    };
  }

  // Update the reservation status
  const { error: updateError } = await supabase
    .from("reservations")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (updateError) {
    console.error("Error updating reservation status:", updateError);
    return {
      success: false,
      error: "Rezervasyon durumu güncellenemedi.",
    };
  }

  if (status === "approved" && previousStatus !== "approved") {
    const roomName = (reservation.rooms as unknown as { name: string })?.name ?? "Bilinmiyor";
    const requesterProfile = reservation.profiles as unknown as { full_name: string | null; email: string } | null;
    const requesterName = requesterProfile?.full_name || requesterProfile?.email || "Bilinmiyor";

    await sendTeamsReservationAlert({
      reservationId: reservation.id,
      title: reservation.title,
      roomName,
      startTime: reservation.start_time,
      endTime: reservation.end_time,
      requesterName,
      requesterEmail: requesterProfile?.email,
      attendees: reservation.attendees ?? [],
      tags: reservation.tags ?? [],
      cateringRequested: reservation.catering_requested ?? false,
      isRecurring: reservation.is_recurring,
      status: "approved",
    });

    const attendees = Array.isArray(reservation.attendees) ? reservation.attendees : [];
    if (attendees.length > 0) {
      const { sendInvitationEmails } = await import("@/lib/email/send-invitation");
      const { sent, failed } = await sendInvitationEmails(
        attendees,
        {
          id: reservation.id,
          title: reservation.title,
          description: reservation.description ?? undefined,
          startTime: reservation.start_time,
          endTime: reservation.end_time,
          roomName,
        },
        {
          name: requesterName,
          email: requesterProfile?.email || "",
        }
      );

      if (sent.length > 0) {
        console.log(`[INVITATION] Successfully sent ${sent.length} invitation(s)`);
      }
      if (failed.length > 0) {
        console.warn(`[INVITATION] Failed to send ${failed.length} invitation(s)`);
      }
    }

    // Send email notification to admin team about approval
    const { sendReservationNotification } = await import("@/lib/email/send-reservation-notification");

    const notificationResult = await sendReservationNotification({
      notificationType: "approved",
      reservation: {
        id: reservation.id,
        title: reservation.title,
        description: reservation.description ?? undefined,
        startTime: reservation.start_time,
        endTime: reservation.end_time,
        roomName,
        cateringRequested: reservation.catering_requested ?? false,
        isRecurring: reservation.is_recurring,
        recurrencePattern: (reservation as { recurrence_pattern?: string }).recurrence_pattern ?? "none",
      },
      requester: {
        name: requesterName,
        email: requesterProfile?.email || "",
      },
    });

    if (notificationResult.success) {
      console.log(`[NOTIFICATION] Approval email sent to admin team for reservation ${reservation.id}`);
    } else {
      console.warn(`[NOTIFICATION] Failed to send approval email notification: ${notificationResult.error}`);
    }
  }

  // If this is a recurring parent reservation, update all child instances too
  if (reservation.is_recurring) {
    const { error: childUpdateError } = await supabase
      .from("reservations")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("parent_reservation_id", id);

    if (childUpdateError) {
      console.error("Error updating child reservation statuses:", childUpdateError);
      // Don't fail the main operation, but log the error
    }
  }

  // Revalidate paths to refresh data
  revalidatePath("/");
  revalidatePath("/admin/approvals");
  revalidatePath("/reservations");
  revalidatePath("/calendar");

  return {
    success: true,
  };
}

export type PendingReservation = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  catering_requested: boolean;
  created_at: string;
  is_recurring: boolean;
  recurrence_pattern: "none" | "weekly";
  rooms: {
    name: string;
  };
  profiles: {
    full_name: string | null;
    email: string;
  };
};

export async function getPendingReservations(): Promise<{
  success: boolean;
  data?: PendingReservation[];
  error?: string;
}> {
  const supabase = await createClient();

  // Only fetch parent reservations (not children with parent_reservation_id)
  // This way recurring events appear as a single entry
  const { data, error } = await supabase
    .from("reservations")
    .select(
      `
      id,
      title,
      start_time,
      end_time,
      catering_requested,
      created_at,
      is_recurring,
      recurrence_pattern,
      rooms (
        name
      ),
      profiles (
        full_name,
        email
      )
    `
    )
    .eq("status", "pending")
    .is("parent_reservation_id", null) // Only parent reservations (not recurring children)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching pending reservations:", error);
    return {
      success: false,
      error: "Bekleyen rezervasyonlar yüklenemedi.",
    };
  }

  const reservations = (data ?? []).map((item) => ({
    ...item,
    rooms: item.rooms as unknown as { name: string },
    profiles: item.profiles as unknown as { full_name: string | null; email: string },
  })) as PendingReservation[];

  return {
    success: true,
    data: reservations,
  };
}

export type CancelReservationResult = {
  success: boolean;
  message?: string;
};

export type CancelRecurringInstanceResult = {
  success: boolean;
  message?: string;
};

export async function cancelReservation(
  reservationId: string
): Promise<CancelReservationResult> {
  if (!reservationId) {
    return {
      success: false,
      message: "Rezervasyon ID gereklidir.",
    };
  }

  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      message: "Bu işlem için giriş yapmanız gerekiyor.",
    };
  }

  // Fetch the reservation to get the owner and end_time
  const { data: reservation, error: reservationError } = await supabase
    .from("reservations")
    .select("id, user_id, title, description, status, start_time, end_time, room_id, tags, attendees, rooms(name), profiles(full_name, email)")
    .eq("id", reservationId)
    .single();

  if (reservationError || !reservation) {
    return {
      success: false,
      message: "Rezervasyon bulunamadı.",
    };
  }

  // Check if already cancelled
  if (reservation.status === "cancelled") {
    return {
      success: false,
      message: "Bu rezervasyon zaten iptal edilmiş.",
    };
  }

  // Prevent modifying past events
  if (new Date(reservation.end_time) < new Date()) {
    return {
      success: false,
      message: "Geçmiş etkinlikler düzenlenemez.",
    };
  }

  // Get user's role to check admin status
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return {
      success: false,
      message: "Kullanıcı profili alınamadı.",
    };
  }

  // Authorization check
  const isOwner = reservation.user_id === user.id;
  const isAdmin = profile.role === "admin";

  if (!isOwner && !isAdmin) {
    return {
      success: false,
      message: "Bunu yapmaya yetkiniz yok.",
    };
  }

  // Update the reservation status to cancelled
  const { error: updateError } = await supabase
    .from("reservations")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", reservationId);

  if (updateError) {
    console.error("Error cancelling reservation:", updateError);
    return {
      success: false,
      message: "Rezervasyon iptal edilirken bir hata oluştu.",
    };
  }

  const attendees = Array.isArray(reservation.attendees) ? reservation.attendees : [];
  const rawProfiles = reservation.profiles as unknown;
  const organizerProfile = (Array.isArray(rawProfiles) ? rawProfiles[0] : rawProfiles) as
    | { full_name: string | null; email: string }
    | null
    | undefined;
  const organizerName = organizerProfile?.full_name || organizerProfile?.email || "Unknown User";
  const organizerEmail = organizerProfile?.email || "";
  const rawRooms = reservation.rooms as unknown;
  const roomRecord = (Array.isArray(rawRooms) ? rawRooms[0] : rawRooms) as
    | { name: string }
    | null
    | undefined;
  const roomName = roomRecord?.name || "Bilinmeyen Oda";

  if (attendees.length > 0 && organizerEmail) {
    const { sendCancellationEmails } = await import("@/lib/email/send-cancellation");

    const { sent, failed } = await sendCancellationEmails(
      attendees,
      {
        id: reservation.id,
        title: reservation.title,
        description: reservation.description ?? undefined,
        startTime: reservation.start_time,
        endTime: reservation.end_time,
        roomName,
      },
      {
        name: organizerName,
        email: organizerEmail,
      }
    );

    if (sent.length > 0) {
      console.log(`[CANCELLATION] Successfully sent ${sent.length} cancellation(s)`);
    }
    if (failed.length > 0) {
      console.warn(`[CANCELLATION] Failed to send ${failed.length} cancellation(s)`);
    }
  }

  // --- BIG EVENT CASCADE CANCELLATION LOG ---
  // If this was a Big Event (which blocked all other rooms), cancel those blocks
  const isBigEvent = isBigEventRequest(reservation.tags ?? []);

  if (isBigEvent) {
    console.log("Cancelling Big Event blocks...");
    // Find all placeholder blocks created by this event
    // They are identified by:
    // 1. Tag 'big_event_block'
    // 2. BUFFERED time slot (30 mins before/after)
    // 3. Created by the same user (usually)
    // 4. Active status

    const start = new Date(reservation.start_time);
    const end = new Date(reservation.end_time);

    const bufferStart = new Date(start);
    bufferStart.setMinutes(bufferStart.getMinutes() - 30);

    const bufferEnd = new Date(end);
    bufferEnd.setMinutes(bufferEnd.getMinutes() + 30);

    const bufferStartTime = bufferStart.toISOString();
    const bufferEndTime = bufferEnd.toISOString();

    const { data: blockedReservations } = await supabase
      .from("reservations")
      .select("id")
      .contains("tags", ["big_event_block"])
      .eq("start_time", bufferStartTime)
      .eq("end_time", bufferEndTime)
      .neq("status", "cancelled");

    if (blockedReservations && blockedReservations.length > 0) {
      const blockIds = blockedReservations.map(r => r.id);

      const { error: blockCancelError } = await supabase
        .from("reservations")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .in("id", blockIds);

      if (blockCancelError) {
        console.error("Error cancelling Big Event blocks:", blockCancelError);
      } else {
        console.log(`Successfully cancelled ${blockIds.length} Big Event placeholder blocks.`);
      }
    }
  }

  // --- COMBINED ROOM CASCADE CANCELLATION LOG ---
  // If this is a Combined Room (Parent), cancel overlapping sub-room reservations
  try {
    const roomName = (reservation.rooms as unknown as { name: string })?.name;
    const subRoomNames = COMBINED_ROOMS[roomName];

    if (subRoomNames && subRoomNames.length > 0) {
      console.log(`Checking cascade cancellation for parent room: ${roomName}`);

      // 1. Get IDs of the sub-rooms
      const { data: subRooms } = await supabase
        .from("rooms")
        .select("id")
        .in("name", subRoomNames);

      if (subRooms && subRooms.length > 0) {
        const subRoomIds = subRooms.map((r) => r.id);

        // 2. Find overlapping reservations in sub-rooms
        // We look for reservations with EXACT matching times
        const { data: childReservations } = await supabase
          .from("reservations")
          .select("id")
          .in("room_id", subRoomIds)
          .eq("start_time", reservation.start_time)
          .eq("end_time", reservation.end_time)
          .neq("status", "cancelled"); // Only cancel active ones

        if (childReservations && childReservations.length > 0) {
          const childReservationIds = childReservations.map((r) => r.id);

          // 3. Cancel them
          const { error: cascadeError } = await supabase
            .from("reservations")
            .update({ status: "cancelled", updated_at: new Date().toISOString() })
            .in("id", childReservationIds);

          if (cascadeError) {
            console.error("Error in cascade cancellation:", cascadeError);
          } else {
            console.log(`Cascade cancelled ${childReservationIds.length} sub-room reservations.`);
          }
        }
      }
    }
  } catch (err) {
    console.error("Unexpected error in cascade cancellation logic:", err);
    // Don't fail the main operation, as the main reservation was already cancelled
  }

  // Revalidate paths to refresh data
  revalidatePath("/");
  revalidatePath("/admin/approvals");
  revalidatePath("/reservations");
  revalidatePath("/calendar");

  return {
    success: true,
    message: "Rezervasyon başarıyla iptal edildi.",
  };
}

/**
 * Cancel a single instance of a recurring reservation by creating an exception record.
 * This creates a cancelled child reservation for that specific date.
 */
export async function cancelRecurringInstance(
  parentReservationId: string,
  instanceDate: string
): Promise<CancelRecurringInstanceResult> {
  if (!parentReservationId || !instanceDate) {
    return {
      success: false,
      message: "Rezervasyon ID ve tarih gereklidir.",
    };
  }

  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      message: "Bu işlem için giriş yapmanız gerekiyor.",
    };
  }

  // Fetch the parent reservation
  const { data: parentReservation, error: parentError } = await supabase
    .from("reservations")
    .select("*")
    .eq("id", parentReservationId)
    .single();

  if (parentError || !parentReservation) {
    return {
      success: false,
      message: "Ana rezervasyon bulunamadı.",
    };
  }

  // Verify this is a recurring reservation
  if (!parentReservation.is_recurring || parentReservation.recurrence_pattern !== "weekly") {
    return {
      success: false,
      message: "Bu rezervasyon haftalık tekrarlayan bir rezervasyon değil.",
    };
  }

  // Get user's role to check admin status
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return {
      success: false,
      message: "Kullanıcı profili alınamadı.",
    };
  }

  // Authorization check
  const isOwner = parentReservation.user_id === user.id;
  const isAdmin = profile.role === "admin";

  if (!isOwner && !isAdmin) {
    return {
      success: false,
      message: "Bunu yapmaya yetkiniz yok.",
    };
  }

  // Calculate the instance times based on the selected date
  const originalStart = new Date(parentReservation.start_time);
  const originalEnd = new Date(parentReservation.end_time);
  const duration = originalEnd.getTime() - originalStart.getTime();

  const instanceStart = new Date(instanceDate);
  // Preserve the original time (hour, minute)
  instanceStart.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0);
  const instanceEnd = new Date(instanceStart.getTime() + duration);

  // Check if this instance is in the past
  if (instanceEnd < new Date()) {
    return {
      success: false,
      message: "Geçmiş tarihlerdeki etkinlikler iptal edilemez.",
    };
  }

  // Check if an exception already exists for this date
  const { data: existingException } = await supabase
    .from("reservations")
    .select("id")
    .eq("parent_reservation_id", parentReservationId)
    .eq("start_time", instanceStart.toISOString())
    .single();

  if (existingException) {
    // Update the existing exception to cancelled
    const { error: updateError } = await supabase
      .from("reservations")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", existingException.id);

    if (updateError) {
      console.error("Error updating exception:", updateError);
      return {
        success: false,
        message: "Rezervasyon iptal edilirken bir hata oluştu.",
      };
    }
  } else {
    // Create a new exception record (a cancelled child reservation)
    const { error: insertError } = await supabase
      .from("reservations")
      .insert({
        room_id: parentReservation.room_id,
        user_id: parentReservation.user_id,
        title: parentReservation.title,
        description: parentReservation.description,
        start_time: instanceStart.toISOString(),
        end_time: instanceEnd.toISOString(),
        status: "cancelled",
        tags: parentReservation.tags ?? [],
        catering_requested: parentReservation.catering_requested,
        is_recurring: false,
        recurrence_pattern: "none",
        parent_reservation_id: parentReservationId,
      });

    if (insertError) {
      console.error("Error creating exception:", insertError);
      return {
        success: false,
        message: "Rezervasyon iptal edilirken bir hata oluştu.",
      };
    }
  }

  // Revalidate paths to refresh data
  revalidatePath("/");
  revalidatePath("/reservations");
  revalidatePath("/calendar");

  return {
    success: true,
    message: "Seçilen tarih için rezervasyon başarıyla iptal edildi.",
  };
}

// ===== UPDATE RESERVATION =====

export type UpdateReservationInput = {
  id: string;
  title?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  roomId?: string;
  attendees?: string[];
  cateringRequested?: boolean;
  tags?: string[];
  recurrencePattern?: RecurrencePattern;
  recurrenceEndType?: RecurrenceEndType;
  recurrenceCount?: number;
  recurrenceEndDate?: string;
};

export type UpdateReservationResult = {
  success: boolean;
  error?: string;
};

export async function updateReservation(
  input: UpdateReservationInput
): Promise<UpdateReservationResult> {
  const { id, title, description, startTime, endTime, roomId, attendees, cateringRequested, tags, recurrencePattern, recurrenceEndType, recurrenceCount, recurrenceEndDate } = input;

  if (!id) {
    return { success: false, error: "Rezervasyon ID gereklidir." };
  }

  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { success: false, error: "Bu işlem için giriş yapmanız gerekiyor." };
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";

  // Fetch the OLD reservation before update
  const { data: oldReservation, error: reservationError } = await supabase
    .from("reservations")
    .select("*, rooms(name), profiles(full_name, email)")
    .eq("id", id)
    .single();

  if (reservationError || !oldReservation) {
    return { success: false, error: "Rezervasyon bulunamadı." };
  }

  // Check authorization: user must be owner or admin
  if (oldReservation.user_id !== user.id && !isAdmin) {
    return { success: false, error: "Bu rezervasyonu düzenleme yetkiniz yok." };
  }

  // Prevent editing past reservations
  if (new Date(oldReservation.end_time) < new Date()) {
    return { success: false, error: "Geçmiş rezervasyonlar düzenlenemez." };
  }

  // Only allow editing pending or approved reservations
  if (!["pending", "approved"].includes(oldReservation.status)) {
    return { success: false, error: "Bu durumda rezervasyon düzenlenemez." };
  }

  // Determine new values or fallback to old ones
  const newStartTime = startTime || oldReservation.start_time;
  const newEndTime = endTime || oldReservation.end_time;
  const newRoomId = roomId || oldReservation.room_id;
  const newTags = tags || oldReservation.tags || [];

  // Check date validity if changed
  if (startTime || endTime) {
    const start = new Date(newStartTime);
    const end = new Date(newEndTime);

    if (end <= start) {
      return { success: false, error: "Bitiş zamanı başlangıç zamanından sonra olmalıdır." };
    }
  }

  // --- CONFLICT CHECKS ---

  // 1. Big Event Conflict Check (If updating to Big Event tags)
  const isNowBigEvent = isBigEventRequest(newTags);

  if (isNowBigEvent) {
    // Check conflicts similar to createReservation
    const start = new Date(newStartTime);
    const end = new Date(newEndTime);

    const bufferStart = new Date(start);
    bufferStart.setMinutes(bufferStart.getMinutes() - 30);
    const bufferEnd = new Date(end);
    bufferEnd.setMinutes(bufferEnd.getMinutes() + 30);

    const { data: bigEventConflicts } = await supabase
      .from("reservations")
      .select("id, title")
      .neq("id", id) // Exclude self
      .in("status", ["pending", "approved"])
      .not("tags", "cs", '{"big_event_block"}')
      .lt("start_time", bufferEnd.toISOString())
      .gt("end_time", bufferStart.toISOString());

    if (bigEventConflicts && bigEventConflicts.length > 0) {
      return {
        success: false,
        error: `Bu saat aralığında (hazırlık süresi dahil) ${bigEventConflicts.length} adet toplantı var. Önce bunları iptal etmelisiniz.`
      };
    }
  }

  // 2. Regular Conflict Check (if room or time changed)
  if (roomId || startTime || endTime) {
    const { data: conflicts } = await supabase
      .from("reservations")
      .select("id, title")
      .eq("room_id", newRoomId)
      .neq("id", id)
      .in("status", ["pending", "approved"])
      .lt("start_time", newEndTime)
      .gt("end_time", newStartTime);

    if (conflicts && conflicts.length > 0) {
      return {
        success: false,
        error: `Bu zaman aralığında başka bir rezervasyon mevcut: ${conflicts[0].title}`,
      };
    }
  }

  // --- UPDATE DATABASE ---

  const requesterEmail = (oldReservation.profiles as any)?.email;
  let updatedAttendees = attendees !== undefined ? attendees : (oldReservation.attendees || []);

  // Ensure requester is in attendees list
  if (requesterEmail && !updatedAttendees.includes(requesterEmail)) {
    updatedAttendees = [...updatedAttendees, requesterEmail];
  }

  const isRecurring = (recurrencePattern !== undefined && recurrencePattern !== "none") ||
    (recurrencePattern === undefined && oldReservation.is_recurring);

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    title: title !== undefined ? title : oldReservation.title,
    description: description !== undefined ? description : oldReservation.description,
    start_time: newStartTime,
    end_time: newEndTime,
    room_id: newRoomId,
    attendees: updatedAttendees,
    catering_requested: cateringRequested !== undefined ? cateringRequested : oldReservation.catering_requested,
    tags: newTags,
    is_recurring: isRecurring,
  };

  // Only update recurrence fields if explicitly provided (even if "none")
  if (recurrencePattern !== undefined) {
    updateData.recurrence_pattern = recurrencePattern;
    updateData.recurrence_end_type = recurrenceEndType ?? null;
    updateData.recurrence_count = recurrenceEndType === "count" ? recurrenceCount : null;
    updateData.recurrence_end_date = recurrenceEndType === "date" ? recurrenceEndDate : null;
  }

  const { error: updateError } = await supabase
    .from("reservations")
    .update(updateData)
    .eq("id", id);

  if (updateError) {
    console.error("Error updating reservation:", updateError);
    return { success: false, error: "Rezervasyon güncellenirken bir hata oluştu." };
  }

  // --- NOTIFICATIONS ---

  // 1. Send Cancellation Email for the OLD version
  // We send this to Admin team (and requester if needed, handled by notification system logic)
  try {
    const { sendReservationNotification } = await import("@/lib/email/send-reservation-notification");

    // Get user details (requester)
    const { data: currentUserProfile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .single();

    const userName = currentUserProfile?.full_name || currentUserProfile?.email || "Unknown User";
    const userEmail = currentUserProfile?.email || "";

    // Send Cancellation (Update Notification - Old Version Cancelled)
    await sendReservationNotification({
      notificationType: "cancelled",
      reservation: {
        id: oldReservation.id,
        title: oldReservation.title,
        description: `BİLGİ: Bu rezervasyon, kullanıcısı tarafından güncellendiği için iptal edilmiş ve yerine yenisi oluşturulmuştur.\n\nEski Açıklama: ${oldReservation.description || '-'}`,
        startTime: oldReservation.start_time,
        endTime: oldReservation.end_time,
        roomName: (oldReservation.rooms as any)?.name || "Unknown Room",
        cateringRequested: oldReservation.catering_requested,
        isRecurring: oldReservation.is_recurring,
        recurrencePattern: oldReservation.recurrence_pattern,
      },
      requester: {
        name: (oldReservation.profiles as any)?.full_name || "Unknown",
        email: requesterEmail || "unknown@email.com",
      },
      cancellationReason: "Rezervasyon güncellendi ve yeniden oluşturuldu.", // Custom reason
    });

    // Send ICS Cancellation to attendees to remove the OLD event from their calendars
    const oldAttendees = oldReservation.attendees || [];
    // Ensure requester is included to remove from their calendar too
    let attendeesToCancel = [...oldAttendees];
    if (requesterEmail && !attendeesToCancel.includes(requesterEmail)) {
      attendeesToCancel.push(requesterEmail);
    }

    if (oldReservation.status === "approved" && attendeesToCancel.length > 0) {
      const { sendCancellationEmails } = await import("@/lib/email/send-cancellation");
      await sendCancellationEmails(
        attendeesToCancel,
        {
          id: oldReservation.id,
          title: oldReservation.title,
          description: oldReservation.description ?? undefined,
          startTime: oldReservation.start_time,
          endTime: oldReservation.end_time,
          roomName: (oldReservation.rooms as any)?.name || "Unknown Room",
        },
        {
          name: (oldReservation.profiles as any)?.full_name || "Unknown Owner",
          email: requesterEmail || "unknown@email.com",
        }
      );
      console.log(`[UPDATE] Sent ICS cancellation for old event version to ${attendeesToCancel.length} recipients.`);
    }

    // 2. Send New Reservation Notification (Pending/Approved)
    await sendReservationNotification({
      notificationType: "pending", // Use 'pending' template as a general "New Request/Update" notification for admins
      reservation: {
        id: id,
        title: updateData.title as string,
        description: `GÜNCELLENEN REZERVASYON\n\n${updateData.description || ''}`,
        startTime: newStartTime,
        endTime: newEndTime,
        roomName: newRoomId === oldReservation.room_id
          ? (oldReservation.rooms as any)?.name
          : (await supabase.from("rooms").select("name").eq("id", newRoomId).single()).data?.name || "Unknown",
        cateringRequested: updateData.catering_requested as boolean,
        isRecurring: updateData.is_recurring as boolean,
        recurrencePattern: (updateData.recurrence_pattern as string) || "none",
      },
      requester: {
        name: userName,
        email: userEmail,
      },
    });

    // 3. Send Invitation Emails (Calendar Invite) for the NEW details
    if (oldReservation.status === "approved" && updatedAttendees && updatedAttendees.length > 0) {
      const { sendInvitationEmails } = await import("@/lib/email/send-invitation");
      const roomName = newRoomId === oldReservation.room_id
        ? (oldReservation.rooms as any)?.name
        : (await supabase.from("rooms").select("name").eq("id", newRoomId).single()).data?.name || "Unknown";

      await sendInvitationEmails(
        updatedAttendees,
        {
          id: id,
          title: updateData.title as string,
          description: updateData.description as string | undefined,
          startTime: newStartTime,
          endTime: newEndTime,
          roomName: roomName,
        },
        {
          name: userName,
          email: userEmail,
        }
      );
    }

  } catch (err) {
    console.error("Error sending update notifications:", err);
    // Don't fail the update just because email failed
  }

  // Revalidate paths
  revalidatePath("/");
  revalidatePath("/reservations");
  revalidatePath("/calendar");
  revalidatePath("/admin/approvals");
  revalidatePath("/admin/reservations");

  return { success: true };
}

// ===== GET ALL ACTIVE RESERVATIONS (for admin) =====

export type ActiveReservation = {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  status: string;
  catering_requested: boolean;
  is_recurring: boolean;
  recurrence_pattern: string;
  user_id: string;
  rooms: { name: string };
  profiles: { full_name: string | null; email: string };
};

export async function getActiveReservations(): Promise<{
  success: boolean;
  data?: ActiveReservation[];
  error?: string;
}> {
  const supabase = await createClient();

  // Get current user and check admin
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Giriş yapmanız gerekiyor." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { success: false, error: "Bu sayfaya erişim yetkiniz yok." };
  }

  // Get all active (pending, approved) reservations that are in the future
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("reservations")
    .select(`
      id,
      title,
      description,
      start_time,
      end_time,
      status,
      catering_requested,
      is_recurring,
      recurrence_pattern,
      user_id,
      rooms (name),
      profiles (full_name, email)
    `)
    .in("status", ["pending", "approved"])
    .is("parent_reservation_id", null)
    .not("tags", "cs", '{"big_event_block"}')
    .gte("end_time", now)
    .order("start_time", { ascending: true });

  if (error) {
    console.error("Error fetching active reservations:", error);
    return { success: false, error: "Rezervasyonlar yüklenemedi." };
  }

  return {
    success: true,
    data: (data ?? []).map((r) => ({
      ...r,
      rooms: r.rooms as unknown as { name: string },
      profiles: r.profiles as unknown as { full_name: string | null; email: string },
    })) as ActiveReservation[],
  };
}
