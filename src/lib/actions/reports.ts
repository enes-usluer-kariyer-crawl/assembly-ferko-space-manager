"use server";

import { createClient } from "@/lib/supabase/server";
import { BIG_EVENT_TAGS } from "@/constants/events";

export type ReportStats = {
  totalReservations: number;
  totalHours: number;
  cancelledCount: number;
  approvedCount: number;
  byRoom: Record<string, { name: string; count: number; hours: number }>;
  byUser: Record<string, { email: string; name: string; count: number; hours: number }>;
  universityEventCount: number;
  companyEventCount: number;
  excoEventCount: number;
  recentActivity: any[];
  allReservations: any[]; // For Excel export
};

export type ReportFilters = {
  startDate?: Date;
  endDate?: Date;
  roomIds?: string[];
};

export async function getReportStats(filters: ReportFilters = {}): Promise<ReportStats> {
  const supabase = await createClient();

  // Default to last 30 days if dates not provided
  let end = filters.endDate;
  if (!end) {
    end = new Date();
    end.setHours(23, 59, 59, 999);
  }

  const start = filters.startDate || new Date(new Date().setDate(end.getDate() - 30));

  let query = supabase
    .from("reservations")
    .select(`
      *,
      room:rooms(id, name),
      user:profiles(id, email, full_name)
    `)
    .gte("start_time", start.toISOString())
    .lte("start_time", end.toISOString())
    .not("tags", "cs", '{"big_event_block"}') // Exclude system blocks
    .order("created_at", { ascending: false });
  if (filters.roomIds && filters.roomIds.length > 0) {
    query = query.in("room_id", filters.roomIds);
  }

  // Parallel fetch: Filtered stats AND Global recent activity
  const [statsResult, recentResult] = await Promise.all([
    query,
    supabase
      .from("reservations")
      .select(`
        *,
        room:rooms(id, name),
        user:profiles(id, email, full_name)
      `)
      .not("tags", "cs", '{"big_event_block"}')
      .order("updated_at", { ascending: false })
      .limit(10)
  ]);

  const reservations = statsResult.data || [];
  const recentLogs = recentResult.data || [];
  const error = statsResult.error || recentResult.error;

  if (error) {
    console.error("Error fetching report stats:", error);
    throw new Error("Rapor verileri alınamadı");
  }

  // Initialize stats
  const stats: ReportStats = {
    totalReservations: 0,
    totalHours: 0,
    cancelledCount: 0,
    approvedCount: 0,
    byRoom: {},
    byUser: {},
    universityEventCount: 0,
    companyEventCount: 0,
    excoEventCount: 0,
    recentActivity: recentLogs, // Use global recent logs
    allReservations: reservations, // Return all filtered for export
  };

  reservations.forEach((res) => {
    // 1. General Counts
    stats.totalReservations++;
    if (res.status === "cancelled" || res.status === "rejected") {
      stats.cancelledCount++;
    } else if (res.status === "approved") {
      stats.approvedCount++;
    }

    // Calculate Duration (in hours)
    const start = new Date(res.start_time);
    const end = new Date(res.end_time);
    const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

    // Only count hours for non-cancelled/rejected events
    if (res.status === "approved" || res.status === "pending") {
      stats.totalHours += durationHours;

      // 2. Room Stats
      const roomName = res.room?.name || "Bilinmeyen Oda";
      const roomId = res.room_id;

      if (!stats.byRoom[roomId]) {
        stats.byRoom[roomId] = { name: roomName, count: 0, hours: 0 };
      }
      stats.byRoom[roomId].count++;
      stats.byRoom[roomId].hours += durationHours;

      // 3. User Stats
      const userId = res.user_id;
      const userEmail = res.user?.email || "Bilinmeyen";
      const userName = res.user?.full_name || userEmail;

      if (!stats.byUser[userId]) {
        stats.byUser[userId] = { email: userEmail, name: userName, count: 0, hours: 0 };
      }
      stats.byUser[userId].count++;
      stats.byUser[userId].hours += durationHours;

      // 4. Event Type Stats
      const tags = res.tags || [];
      if (tags.includes("Üniversite Etkinliği")) {
        stats.universityEventCount++;
      } else if (tags.includes("Exco Toplantısı")) {
        stats.excoEventCount++;
      } else if (tags.some((tag: string) => BIG_EVENT_TAGS.includes(tag as any))) {
        stats.companyEventCount++;
      }
    }
  });

  return stats;
}
