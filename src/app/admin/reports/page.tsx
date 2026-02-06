import { getReportStats } from "@/lib/actions/reports";
import { getRooms } from "@/lib/actions/reservations";
import { ReportsClient } from "./ReportsClient";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  // Perform queries in parallel for efficiency
  const [initialStats, roomsResult] = await Promise.all([
    getReportStats(), // Defaults to last 30 days
    getRooms(),
  ]);

  const rooms = roomsResult.success ? roomsResult.data || [] : [];

  return (
    <ReportsClient
      rooms={rooms}
      initialStats={initialStats}
    />
  );
}
