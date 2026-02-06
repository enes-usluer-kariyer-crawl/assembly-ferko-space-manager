"use server";

import { createClient } from "@/lib/supabase/server";

export type ReportStats = {
  totalReservations: number;
  totalHours: number;
  cancelledCount: number;
  approvedCount: number;
  byRoom: Record<string, { name: string; count: number; hours: number }>;
  byUser: Record<string, { email: string; name: string; count: number; hours: number }>;
  recentActivity: any[];
};

export async function getReportStats(days: number = 30): Promise<ReportStats> {
  const supabase = await createClient();

  // Calculate start date
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Fetch reservations with related data
  const { data: reservations, error } = await supabase
    .from("reservations")
    .select(`
      *,
      room:rooms(id, name),
      user:profiles(id, email, full_name)
    `)
    .gte("start_time", startDate.toISOString())
    .not("tags", "cs", '{"big_event_block"}') // Exclude system blocks
    .order("created_at", { ascending: false });

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
    recentActivity: reservations.slice(0, 10), // Last 10 actions
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

    // Only count hours for non-cancelled/rejected events (optional logic, but usually we want consumed capacity)
    // Assuming we want 'usage' stats for approved/completed events:
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
    }
  });

  return stats;
}
