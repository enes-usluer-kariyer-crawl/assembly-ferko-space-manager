"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkAvailability } from "./availability";

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
