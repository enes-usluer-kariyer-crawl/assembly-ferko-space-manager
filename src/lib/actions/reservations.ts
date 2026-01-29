"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkAvailability } from "./availability";
import { ROOM_CAPACITIES, COMBINED_ROOMS } from "@/constants/rooms";

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
  catering_requested: boolean;
  is_recurring: boolean;
  recurrence_pattern: "none" | "weekly";
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
      catering_requested,
      is_recurring,
      recurrence_pattern,
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
    if (reservation.is_recurring && reservation.recurrence_pattern === "weekly") {
      // Generate recurring instances within the view range
      const originalStart = new Date(reservation.start_time);
      const originalEnd = new Date(reservation.end_time);
      const duration = originalEnd.getTime() - originalStart.getTime();

      // Add the original event if it falls within the range
      if (originalStart <= viewEnd && originalEnd >= viewStart) {
        expandedReservations.push(reservation);
      }

      // Generate future instances (up to 52 weeks = 1 year from original date)
      let week = 1;
      while (week <= 52) {
        const instanceStart = new Date(originalStart);
        instanceStart.setDate(instanceStart.getDate() + (week * 7));

        // Stop if we're past the view range
        if (instanceStart > viewEnd) break;

        const instanceEnd = new Date(instanceStart.getTime() + duration);

        // Include if instance overlaps with view range
        if (instanceEnd >= viewStart) {
          expandedReservations.push({
            ...reservation,
            id: `${reservation.id}_week${week}`, // Virtual ID for recurring instance
            start_time: instanceStart.toISOString(),
            end_time: instanceEnd.toISOString(),
            parent_reservation_id: reservation.id, // Link back to parent
          });
        }

        week++;
      }
    } else {
      // Non-recurring event - include all (no date filtering for base query)
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
      .select("id, name, capacity, features, is_active")
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

export type CreateReservationInput = {
  roomId: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  tags?: string[];
  cateringRequested?: boolean;
  recurrencePattern?: "none" | "weekly";
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
  const { roomId, title, description, startTime, endTime, tags, cateringRequested, recurrencePattern } =
    input;

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

  const isRecurring = recurrencePattern === "weekly";

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
      catering_requested: cateringRequested ?? false,
      is_recurring: isRecurring,
      recurrence_pattern: recurrencePattern ?? "none",
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

  // Mock notification system: Log email notifications
  if (status === "pending" || cateringRequested) {
    const reasons = [];
    if (status === "pending") reasons.push("requires approval");
    if (cateringRequested) reasons.push("requests catering");

    console.log(`[NOTIFICATION] Email sent to Oylum Çevik: New Request from ${userName} (${reasons.join(", ")})`);
    console.log(`  - Title: ${title}`);
    console.log(`  - Room: ${roomId}`);
    console.log(`  - Time: ${startTime} - ${endTime}`);
    if (cateringRequested) console.log(`  - Catering: Requested`);
    if (isRecurring) console.log(`  - Recurring: Weekly (repeats indefinitely)`);
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
        is_recurring: false,
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

  // Fetch the reservation to check if it's in the past
  const { data: reservation, error: reservationError } = await supabase
    .from("reservations")
    .select("end_time, is_recurring")
    .eq("id", id)
    .single();

  if (reservationError || !reservation) {
    return {
      success: false,
      error: "Rezervasyon bulunamadı.",
    };
  }

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
    .select("id, user_id, status, start_time, end_time, room_id, tags, rooms(name)")
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
