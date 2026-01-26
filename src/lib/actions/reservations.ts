"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkAvailability } from "./availability";

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
  rooms: {
    id: string;
    name: string;
  };
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
      rooms (
        id,
        name
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
  isRecurring?: boolean;
};

export type CreateReservationResult = {
  success: boolean;
  error?: string;
  reservationId?: string;
};

export async function createReservation(
  input: CreateReservationInput
): Promise<CreateReservationResult> {
  const { roomId, title, description, startTime, endTime, tags, cateringRequested, isRecurring } =
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

  // Insert reservation
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
      is_recurring: isRecurring ?? false,
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

  // Revalidate paths to refresh data
  revalidatePath("/");
  revalidatePath("/reservations");
  revalidatePath("/calendar");

  return {
    success: true,
    reservationId: reservation.id,
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
