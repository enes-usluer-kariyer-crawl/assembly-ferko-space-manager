"use server";

import { createClient } from "@/lib/supabase/server";

const BIG_EVENT_TAGS = [
  "ÖM-Success Meetings",
  "Exco Toplantısı",
  "ÖM- HR Small Talks",
] as const;

// Tag used for blocked placeholder reservations created during Big Events
const BIG_EVENT_BLOCK_TAG = "big_event_block";

export type AvailabilityResult = {
  available: boolean;
  reason?: string;
  conflictingRoomId?: string;
  conflictingReservationId?: string;
};

export type CheckAvailabilityParams = {
  startTime: string;
  endTime: string;
  roomId: string;
  newTags: string[];
  excludeReservationId?: string;
};

function isBigEventRequest(tags: string[]): boolean {
  return tags.some((tag) => BIG_EVENT_TAGS.includes(tag as typeof BIG_EVENT_TAGS[number]));
}

export async function checkAvailability({
  startTime,
  endTime,
  roomId,
  newTags,
  excludeReservationId,
}: CheckAvailabilityParams): Promise<AvailabilityResult> {
  const supabase = await createClient();

  const isBigEvent = isBigEventRequest(newTags);

  // Logic 2 (The Kill Switch): If this is a Big Event request, ALL 5 rooms must be empty
  if (isBigEvent) {
    const { data: allRoomsAvailable, error: bigEventError } = await supabase.rpc(
      "check_big_event_availability",
      {
        p_start_time: startTime,
        p_end_time: endTime,
        p_exclude_reservation_id: excludeReservationId ?? null,
      }
    );

    if (bigEventError) {
      console.error("Error checking big event availability:", bigEventError);
      return {
        available: false,
        reason: "Failed to check availability. Please try again.",
      };
    }

    if (!allRoomsAvailable) {
      // Find which room has the conflict for better error message
      const { data: conflictingReservation } = await supabase
        .from("reservations")
        .select("id, room_id, rooms(name)")
        .in("status", ["pending", "approved"])
        .lt("start_time", endTime)
        .gt("end_time", startTime)
        .neq("id", excludeReservationId ?? "00000000-0000-0000-0000-000000000000")
        .limit(1)
        .single();

      return {
        available: false,
        reason:
          "Big Event reservations require all rooms to be available. Another booking exists during this time slot.",
        conflictingRoomId: conflictingReservation?.room_id,
        conflictingReservationId: conflictingReservation?.id,
      };
    }
  }

  // Logic 3: Check if ANY other room has a Big Event blocking this time slot
  const { data: blockedByBigEvent, error: blockingError } = await supabase.rpc(
    "has_big_event_blocking",
    {
      p_start_time: startTime,
      p_end_time: endTime,
      p_exclude_reservation_id: excludeReservationId ?? null,
    }
  );

  if (blockingError) {
    console.error("Error checking big event blocking:", blockingError);
    return {
      available: false,
      reason: "Failed to check availability. Please try again.",
    };
  }

  if (blockedByBigEvent) {
    // Find the blocking reservation for better error message
    const { data: blockingReservation } = await supabase
      .from("reservations")
      .select("id, room_id, title, tags")
      .in("status", ["pending", "approved"])
      .lt("start_time", endTime)
      .gt("end_time", startTime)
      .neq("id", excludeReservationId ?? "00000000-0000-0000-0000-000000000000")
      .overlaps("tags", BIG_EVENT_TAGS as unknown as string[])
      .limit(1)
      .single();

    return {
      available: false,
      reason: `This time slot is blocked by a Big Event: "${blockingReservation?.title ?? "Unknown"}". All rooms are reserved.`,
      conflictingRoomId: blockingReservation?.room_id,
      conflictingReservationId: blockingReservation?.id,
    };
  }

  // Check if this room is blocked by a Big Event placeholder
  // (These are created when a Big Event locks out all other rooms)
  const { data: blockedByPlaceholder } = await supabase
    .from("reservations")
    .select("id, room_id, title, tags")
    .eq("room_id", roomId)
    .in("status", ["pending", "approved"])
    .lt("start_time", endTime)
    .gt("end_time", startTime)
    .neq("id", excludeReservationId ?? "00000000-0000-0000-0000-000000000000")
    .contains("tags", [BIG_EVENT_BLOCK_TAG])
    .limit(1)
    .single();

  if (blockedByPlaceholder) {
    return {
      available: false,
      reason: `This time slot is blocked: "${blockedByPlaceholder.title}". A Big Event is in progress.`,
      conflictingRoomId: roomId,
      conflictingReservationId: blockedByPlaceholder.id,
    };
  }

  // Logic 1: Check if the specific room is booked
  const { data: roomConflict, error: roomError } = await supabase.rpc(
    "check_reservation_conflict",
    {
      p_room_id: roomId,
      p_start_time: startTime,
      p_end_time: endTime,
      p_exclude_reservation_id: excludeReservationId ?? null,
    }
  );

  if (roomError) {
    console.error("Error checking room conflict:", roomError);
    return {
      available: false,
      reason: "Failed to check availability. Please try again.",
    };
  }

  if (roomConflict) {
    // Find the conflicting reservation for better error message
    const { data: conflictingReservation } = await supabase
      .from("reservations")
      .select("id, title")
      .eq("room_id", roomId)
      .in("status", ["pending", "approved"])
      .lt("start_time", endTime)
      .gt("end_time", startTime)
      .neq("id", excludeReservationId ?? "00000000-0000-0000-0000-000000000000")
      .limit(1)
      .single();

    return {
      available: false,
      reason: "Seçilen saat aralığında bu oda dolu.",
      conflictingRoomId: roomId,
      conflictingReservationId: conflictingReservation?.id,
    };
  }

  return { available: true };
}
