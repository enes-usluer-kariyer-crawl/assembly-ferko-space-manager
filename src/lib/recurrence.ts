import type { createClient } from "@/lib/supabase/server";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type RecurrenceSource = {
  start_time: string;
  end_time: string;
  recurrence_pattern: string;
  recurrence_end_type?: string | null;
  recurrence_count?: number | null;
  recurrence_end_date?: string | null;
};

export type Occurrence = {
  index: number; // 0 = the original (parent) event
  start: Date;
  end: Date;
};

// Safety net against runaway loops (e.g. a "never" ending daily series queried far ahead)
const MAX_OCCURRENCES = 5000;

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Istanbul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// Calendar day (Istanbul) of an occurrence, used to match cancelled exception rows to their instance
export function getOccurrenceDayKey(date: Date | string): string {
  return dayKeyFormatter.format(new Date(date));
}

// Identifies one occurrence of a series: "parentId|YYYY-MM-DD"
export function getInstanceKey(parentId: string, date: Date | string): string {
  return `${parentId}|${getOccurrenceDayKey(date)}`;
}

// Single instances cancelled from a recurring series are stored as cancelled child rows.
// Returns their instance keys so the matching expanded occurrence can be skipped.
export async function getCancelledInstanceKeys(
  supabase: ServerSupabaseClient,
  parentIds: string[]
): Promise<Set<string>> {
  if (parentIds.length === 0) return new Set();

  const { data, error } = await supabase
    .from("reservations")
    .select("parent_reservation_id, start_time")
    .in("parent_reservation_id", parentIds)
    .in("status", ["cancelled", "rejected"]);

  if (error) {
    console.error("Error fetching cancelled recurring instances:", error);
    return new Set();
  }

  return new Set((data ?? []).map((row) => getInstanceKey(row.parent_reservation_id, row.start_time)));
}

function getOccurrenceStart(originalStart: Date, pattern: string, index: number): Date | null {
  const next = new Date(originalStart);
  switch (pattern) {
    case "daily":
      next.setDate(next.getDate() + index);
      return next;
    case "weekly":
      next.setDate(next.getDate() + index * 7);
      return next;
    case "biweekly":
      next.setDate(next.getDate() + index * 14);
      return next;
    case "monthly":
      next.setMonth(next.getMonth() + index);
      return next;
    default:
      return null;
  }
}

// Returns every occurrence of a recurring series that overlaps [rangeStart, rangeEnd].
// Occurrences are counted from the start of the series, so "count" ending series stop
// at the right instance no matter which range is requested.
export function getOccurrencesInRange(
  series: RecurrenceSource,
  rangeStart: Date,
  rangeEnd: Date
): Occurrence[] {
  const originalStart = new Date(series.start_time);
  const duration = new Date(series.end_time).getTime() - originalStart.getTime();

  const endType = series.recurrence_end_type || "never";
  const maxCount = series.recurrence_count || 52;
  // The end date is inclusive: occurrences on that (Istanbul) calendar day still count
  const endDayKey = series.recurrence_end_date ? getOccurrenceDayKey(series.recurrence_end_date) : null;

  const occurrences: Occurrence[] = [];

  for (let index = 0; index < MAX_OCCURRENCES; index++) {
    if (endType === "count" && index >= maxCount) break;

    const start = getOccurrenceStart(originalStart, series.recurrence_pattern, index);
    if (!start) break;
    // The original event always counts, even if the end date was set before it
    if (index > 0 && endType === "date" && endDayKey && getOccurrenceDayKey(start) > endDayKey) break;
    if (start > rangeEnd) break;

    const end = new Date(start.getTime() + duration);
    if (end >= rangeStart) {
      occurrences.push({ index, start, end });
    }
  }

  return occurrences;
}
