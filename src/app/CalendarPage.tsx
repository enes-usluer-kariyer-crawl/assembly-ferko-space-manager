"use client";

import { useCallback, useState } from "react";
import { BookingCalendar } from "@/components/calendar";
import { getReservations, type Reservation, type Room } from "@/lib/actions/reservations";

type CalendarPageProps = {
  initialReservations: Reservation[];
  rooms: Room[];
};

export function CalendarPage({ initialReservations, rooms }: CalendarPageProps) {
  const [reservations, setReservations] = useState<Reservation[]>(initialReservations);

  const handleRefresh = useCallback(async () => {
    const result = await getReservations();
    if (result.success && result.data) {
      setReservations(result.data);
    }
  }, []);

  return (
    <BookingCalendar
      initialReservations={reservations}
      rooms={rooms}
      onRefresh={handleRefresh}
    />
  );
}
