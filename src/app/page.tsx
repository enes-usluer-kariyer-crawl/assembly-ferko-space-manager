import { redirect } from "next/navigation";
import { getReservations, getRooms } from "@/lib/actions/reservations";
import { createClient } from "@/lib/supabase/server";
import { CalendarPage } from "./CalendarPage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DoorOpen, CalendarDays, Zap } from "lucide-react";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // SECURITY: Redirect unauthenticated users to login
  if (!user) {
    redirect("/login");
  }

  const [reservationsResult, roomsResult] = await Promise.all([
    getReservations(),
    getRooms(),
  ]);

  const reservations = reservationsResult.success ? reservationsResult.data ?? [] : [];
  const rooms = roomsResult.success ? roomsResult.data ?? [] : [];

  // Calculate stats
  const availableRooms = rooms.length;
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  const upcomingEventsToday = reservations.filter((r) => {
    const startTime = new Date(r.start_time);
    return startTime >= todayStart && startTime < todayEnd;
  }).length;

  return (
    <div className="p-6 space-y-6">
      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Available Rooms */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Mevcut Odalar
            </CardTitle>
            <DoorOpen className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{availableRooms}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Rezervasyona uygun oda
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Upcoming Events Today */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Bugünkü Etkinlikler
            </CardTitle>
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{upcomingEventsToday}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Bugün için planlanmış
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Quick Action */}
        <Card className="shadow-sm bg-primary/5 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Hızlı İşlem
            </CardTitle>
            <Zap className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Aşağıdaki takvimde boş bir alana tıklayarak veya{" "}
              <span className="font-semibold text-primary">Yeni Rezervasyon</span>{" "}
              butonuna basarak hızlıca rezervasyon oluşturun.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Calendar Section wrapped in Card */}
      <Card className="shadow-sm rounded-xl">
        <CardContent className="p-6">
          <CalendarPage initialReservations={reservations} rooms={rooms} isAuthenticated={!!user} />
        </CardContent>
      </Card>
    </div>
  );
}
