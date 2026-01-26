import { getReservations, getRooms } from "@/lib/actions/reservations";
import { createClient } from "@/lib/supabase/server";
import { CalendarPage } from "./CalendarPage";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const supabase = await createClient();

  // Get current user and check if admin
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    isAdmin = profile?.role === "admin";
  }

  const [reservationsResult, roomsResult] = await Promise.all([
    getReservations(),
    getRooms(),
  ]);

  const reservations = reservationsResult.success ? reservationsResult.data ?? [] : [];
  const rooms = roomsResult.success ? roomsResult.data ?? [] : [];

  return (
    <div className="min-h-screen bg-background p-6 font-[family-name:var(--font-geist-sans)]">
      {isAdmin && (
        <div className="max-w-[1800px] mx-auto mb-4 flex justify-end">
          <Link href="/admin/approvals">
            <Button variant="outline">Admin Panel</Button>
          </Link>
        </div>
      )}
      <CalendarPage initialReservations={reservations} rooms={rooms} />
    </div>
  );
}
