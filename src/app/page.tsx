import { getReservations, getRooms } from "@/lib/actions/reservations";
import { CalendarPage } from "./CalendarPage";

export default async function Home() {
  const [reservationsResult, roomsResult] = await Promise.all([
    getReservations(),
    getRooms(),
  ]);

  const reservations = reservationsResult.success ? reservationsResult.data ?? [] : [];
  const rooms = roomsResult.success ? roomsResult.data ?? [] : [];

  return (
    <div className="min-h-screen bg-background p-6 font-[family-name:var(--font-geist-sans)]">
      <CalendarPage initialReservations={reservations} rooms={rooms} />
    </div>
  );
}
