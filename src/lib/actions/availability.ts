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
        reason: "Müsaitlik kontrol edilemedi. Lütfen tekrar deneyin.",
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
          "Büyük Etkinlik rezervasyonları için tüm odaların müsait olması gerekir. Bu saat aralığında başka bir rezervasyon var.",
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
      reason: `Bu saat aralığı Büyük Etkinlik tarafından bloklanmış: "${blockingReservation?.title ?? "Bilinmiyor"}". Tüm odalar rezerve edilmiş.`,
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
      reason: `Bu saat aralığı bloklanmış: "${blockedByPlaceholder.title}". Büyük Etkinlik devam ediyor.`,
      conflictingRoomId: roomId,
      conflictingReservationId: blockedByPlaceholder.id,
    };
  }

  // Logic 1: Check if the specific room is booked (non-recurring events)
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

  // Logic 4: Check recurring events for conflicts
  // Logic 4: Check recurring events for conflicts
  // Fetch all approved recurring events for this room
  const { data: recurringEvents, error: recurringError } = await supabase
    .from("reservations")
    .select(`
      id, title, start_time, end_time, recurrence_pattern, 
      recurrence_end_type, recurrence_count, recurrence_end_date
    `)
    .eq("room_id", roomId)
    .eq("is_recurring", true)
    .in("status", ["pending", "approved"])
    .is("parent_reservation_id", null) // Only parent recurring events
    .neq("id", excludeReservationId ?? "00000000-0000-0000-0000-000000000000");

  if (recurringError) {
    console.error("Error checking recurring events:", recurringError);
  } else if (recurringEvents && recurringEvents.length > 0) {
    const requestedStart = new Date(startTime);
    const requestedEnd = new Date(endTime);

    for (const event of recurringEvents) {
      const eventStart = new Date(event.start_time);
      const eventEnd = new Date(event.end_time);
      const eventDuration = eventEnd.getTime() - eventStart.getTime();
      const pattern = event.recurrence_pattern;

      const endType = event.recurrence_end_type;
      const maxCount = event.recurrence_count || 1;
      const recurrenceEndDate = event.recurrence_end_date ? new Date(event.recurrence_end_date) : null;

      // If end type is date, normalize end date to end of day
      if (recurrenceEndDate) {
        recurrenceEndDate.setHours(23, 59, 59, 999);
      }

      // Determine iteration limit based on pattern and end type
      // For infinite ("never"), set reasonable limits based on pattern
      const maxIterations =
        endType === "count" ? maxCount :
          pattern === "daily" ? 365 :
            pattern === "monthly" ? 24 :
              52; // weekly/biweekly default

      // Helper for next occurrence
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

      // Check instances
      for (let i = 0; i <= maxIterations; i++) {
        // i=0 is the original event (already checked by Logic 1 if overlapping view range, 
        // but we check again here relative to recurrences logic)

        const instanceStart = i === 0 ? eventStart : getNextOccurrence(eventStart, i);

        // Stop if passed end date check
        if (endType === "date" && recurrenceEndDate && instanceStart > recurrenceEndDate) {
          break;
        }

        // Optimization: Stop if instance is way past requested time
        // Give some buffer (e.g. 1 day)
        if (instanceStart.getTime() > requestedEnd.getTime() + 24 * 60 * 60 * 1000) {
          break;
        }

        // Skip if this instance ends before requested start
        if (instanceStart.getTime() + eventDuration <= requestedStart.getTime()) {
          continue;
        }

        const instanceEnd = new Date(instanceStart.getTime() + eventDuration);

        // Check for overlap
        if (requestedStart < instanceEnd && requestedEnd > instanceStart) {
          return {
            available: false,
            reason: `Bu saat aralığında tekrar eden bir etkinlik var: "${event.title}".`,
            conflictingRoomId: roomId,
            conflictingReservationId: event.id,
          };
        }
      }
    }
  }

  return { available: true };
}
