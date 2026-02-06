import { createClient } from "@/lib/supabase/server";
import { CalendarDays, Repeat } from "lucide-react";

import { CancelReservationButton } from "@/components/reservations/CancelReservationButton";
import { CancelRecurringButton } from "@/components/reservations/CancelRecurringButton";
import { EditReservationButton } from "@/components/reservations/EditReservationButton";
import { getRooms } from "@/lib/actions/reservations";

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
          <h2 className="mt-4 text-lg font-semibold">Giriş Gerekli</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Rezervasyonlarınızı görüntülemek için lütfen giriş yapın.
          </p>
        </div>
      </div>
    );
  }

  // Fetch reservations and rooms in parallel
  const [reservationsResult, roomsResult] = await Promise.all([
    supabase
      .from("reservations")
      .select(`
        *,
        rooms (id, name)
      `)
      .eq("user_id", user.id)
      .in("status", ["pending", "approved"])
      .is("parent_reservation_id", null)
      .not("tags", "cs", '{"big_event_block"}')
      .order("start_time", { ascending: true }),
    getRooms(),
  ]);

  const reservations = reservationsResult.data ?? [];
  const rooms = roomsResult.success ? roomsResult.data ?? [] : [];

  // Filter: for non-recurring, only show future. For recurring, always show (they repeat)
  const filteredReservations = reservations.filter((r) => {
    if (r.is_recurring) return true;
    return new Date(r.end_time) >= new Date();
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Rezervasyonlarım</h1>
        <p className="text-sm text-muted-foreground">
          Alan rezervasyonlarınızı görüntüleyin ve yönetin
        </p>
      </div>

      {filteredReservations.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">Rezervasyon Yok</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Henüz hiç rezervasyon yapmadınız.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredReservations.map((reservation) => {
            const isFuture = new Date(reservation.start_time) > new Date();
            const isCancellableStatus = ["pending", "approved"].includes(reservation.status);
            const canCancel = isCancellableStatus;
            const isRecurring = reservation.is_recurring && reservation.recurrence_pattern === "weekly";

            return (
              <div
                key={reservation.id}
                className="rounded-lg border bg-card p-4 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{reservation.title}</h3>
                      {isRecurring && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                          <Repeat className="h-3 w-3" />
                          Haftalık
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {reservation.rooms?.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Edit Button - only for future reservations */}
                    {isFuture && (
                      <EditReservationButton
                        reservation={{
                          id: reservation.id,
                          title: reservation.title,
                          description: reservation.description,
                          start_time: reservation.start_time,
                          end_time: reservation.end_time,
                          room_id: reservation.rooms?.id || reservation.room_id,
                          attendees: reservation.attendees,
                          catering_requested: reservation.catering_requested,
                        }}
                        rooms={rooms}
                      />
                    )}
                    {canCancel && (
                      isRecurring ? (
                        <CancelRecurringButton
                          reservationId={reservation.id}
                          startTime={reservation.start_time}
                          endTime={reservation.end_time}
                        />
                      ) : (
                        isFuture && <CancelReservationButton reservationId={reservation.id} />
                      )
                    )}
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${reservation.status === "approved"
                        ? "bg-green-100 text-green-800"
                        : reservation.status === "pending"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                        }`}
                    >
                      {reservation.status === "approved"
                        ? "Onaylandı"
                        : reservation.status === "pending"
                          ? "Onay Bekliyor"
                          : reservation.status === "cancelled"
                            ? "İptal Edildi"
                            : "Reddedildi"}
                    </span>
                  </div>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {isRecurring ? (
                    <>
                      Her {new Date(reservation.start_time).toLocaleDateString("tr-TR", { weekday: "long" })},{" "}
                      {new Date(reservation.start_time).toLocaleTimeString("tr-TR", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}{" "}
                      -{" "}
                      {new Date(reservation.end_time).toLocaleTimeString("tr-TR", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </>
                  ) : (
                    <>
                      {new Date(reservation.start_time).toLocaleDateString("tr-TR", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}{" "}
                      -{" "}
                      {new Date(reservation.end_time).toLocaleTimeString("tr-TR", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
