import { createClient } from "@/lib/supabase/server";
import { CalendarDays } from "lucide-react";

export default async function ReservationsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="p-6">
        <div className="rounded-lg border bg-card p-8 text-center">
          <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">Sign in Required</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Please sign in to view your reservations.
          </p>
        </div>
      </div>
    );
  }

  const { data: reservations } = await supabase
    .from("reservations")
    .select(`
      *,
      rooms (name)
    `)
    .eq("user_id", user.id)
    .order("start_time", { ascending: false });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">My Reservations</h1>
        <p className="text-sm text-muted-foreground">
          View and manage your space reservations
        </p>
      </div>

      {!reservations || reservations.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">No Reservations</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You haven&apos;t made any reservations yet.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {reservations.map((reservation) => (
            <div
              key={reservation.id}
              className="rounded-lg border bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium">{reservation.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {reservation.rooms?.name}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    reservation.status === "approved"
                      ? "bg-green-100 text-green-800"
                      : reservation.status === "pending"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {reservation.status}
                </span>
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                {new Date(reservation.start_time).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}{" "}
                -{" "}
                {new Date(reservation.end_time).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
