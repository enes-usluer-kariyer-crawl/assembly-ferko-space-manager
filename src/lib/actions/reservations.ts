"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkAvailability } from "./availability";

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
    .in("status", ["pending", "approved"]);

  if (params?.startDate) {
    query = query.gte("start_time", params.startDate);
  }

  if (params?.endDate) {
    query = query.lte("end_time", params.endDate);
  }

  if (params?.roomId) {
    query = query.eq("room_id", params.roomId);
  }

  query = query.order("start_time", { ascending: true });

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching reservations:", error);
    return {
      success: false,
      error: "Failed to fetch reservations.",
    };
  }

  // Transform the data to match our Reservation type
  // Supabase returns rooms as an object (not array) for single foreign key relations
  const reservations = (data ?? []).map((item) => ({
    ...item,
    rooms: item.rooms as unknown as { id: string; name: string },
    profiles: item.profiles as unknown as { full_name: string | null; email: string } | null,
  })) as Reservation[];

  return {
    success: true,
    data: reservations,
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
        error: `Failed to fetch rooms: ${error.message}`,
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
      error: `Unexpected error: ${errorMessage}`,
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
      error: "Missing required fields: roomId, title, startTime, and endTime are required.",
    };
  }

  // Validate dates
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return {
      success: false,
      error: "Invalid date format for startTime or endTime.",
    };
  }

  if (end <= start) {
    return {
      success: false,
      error: "End time must be after start time.",
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
      error: "You must be logged in to create a reservation.",
    };
  }

  // Validate room exists
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, is_active")
    .eq("id", roomId)
    .single();

  if (roomError || !room) {
    return {
      success: false,
      error: "Invalid room selected.",
    };
  }

  if (!room.is_active) {
    return {
      success: false,
      error: "The selected room is not available for booking.",
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
      error: availabilityResult.reason ?? "The room is not available for the selected time slot.",
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
      error: "Failed to retrieve user profile.",
    };
  }

  // Determine status based on user role
  const status = profile.role === "admin" ? "approved" : "pending";

  const isBigEvent = isBigEventRequest(tags ?? []);
  let conflictWarning: CreateReservationResult["conflictWarning"] = undefined;

  // For Big Events: Check for existing bookings in other rooms and warn admin
  if (isBigEvent) {
    const { data: existingBookings } = await supabase
      .from("reservations")
      .select("id, title, room_id, start_time, end_time, rooms(name)")
      .in("status", ["pending", "approved"])
      .neq("room_id", roomId)
      .lt("start_time", endTime)
      .gt("end_time", startTime);

    if (existingBookings && existingBookings.length > 0) {
      const conflicts: ConflictingReservation[] = existingBookings.map((booking) => ({
        id: booking.id,
        title: booking.title,
        roomName: (booking.rooms as unknown as { name: string })?.name ?? "Unknown",
        startTime: booking.start_time,
        endTime: booking.end_time,
      }));

      conflictWarning = {
        message: `Warning: ${conflicts.length} existing meeting(s) clash with this Big Event time slot. These rooms will be blocked.`,
        conflicts,
      };
    }
  }

  const isRecurring = recurrencePattern === "weekly";

  // Insert main reservation
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
      error: "Failed to create reservation. Please try again.",
    };
  }

  // Create recurring instances if weekly recurrence
  if (isRecurring) {
    const recurringInstances = [];
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);

    // Create 3 additional weeks (4 weeks total including the original)
    for (let week = 1; week <= 3; week++) {
      const recurringStart = new Date(startDate);
      recurringStart.setDate(recurringStart.getDate() + (week * 7));

      const recurringEnd = new Date(endDate);
      recurringEnd.setDate(recurringEnd.getDate() + (week * 7));

      recurringInstances.push({
        room_id: roomId,
        user_id: user.id,
        title,
        description: description ?? null,
        start_time: recurringStart.toISOString(),
        end_time: recurringEnd.toISOString(),
        status,
        tags: tags ?? [],
        catering_requested: cateringRequested ?? false,
        is_recurring: true,
        recurrence_pattern: "weekly",
        parent_reservation_id: reservation.id,
      });
    }

    if (recurringInstances.length > 0) {
      const { error: recurringError } = await supabase
        .from("reservations")
        .insert(recurringInstances);

      if (recurringError) {
        console.error("Error creating recurring instances:", recurringError);
        // Don't fail the main reservation, just log the error
      }
    }
  }

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
    if (isRecurring) console.log(`  - Recurring: Weekly (4 weeks)`);
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
      const blockedReservations = otherRooms.map((otherRoom) => ({
        room_id: otherRoom.id,
        user_id: user.id,
        title: BIG_EVENT_BLOCK_LABEL,
        description: `Blocked due to Big Event: ${title}`,
        start_time: startTime,
        end_time: endTime,
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
      error: "Reservation ID is required.",
    };
  }

  if (status !== "approved" && status !== "rejected") {
    return {
      success: false,
      error: "Status must be 'approved' or 'rejected'.",
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
      error: "You must be logged in to update a reservation.",
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
      error: "Failed to retrieve user profile.",
    };
  }

  if (profile.role !== "admin") {
    return {
      success: false,
      error: "Only administrators can update reservation status.",
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
      error: "Failed to update reservation status.",
    };
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
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching pending reservations:", error);
    return {
      success: false,
      error: "Failed to fetch pending reservations.",
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

  // Fetch the reservation to get the owner
  const { data: reservation, error: reservationError } = await supabase
    .from("reservations")
    .select("id, user_id, status")
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
