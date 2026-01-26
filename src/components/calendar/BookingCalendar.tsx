"use client";

import { useState, useCallback, useMemo } from "react";
import { Calendar, dateFnsLocalizer, Views, SlotInfo } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { tr } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";

import type { Reservation, Room } from "@/lib/actions/reservations";
import { NewReservationDialog } from "./NewReservationDialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const locales = {
  "tr": tr,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

// Room colors for visual distinction
const ROOM_COLORS: Record<string, { bg: string; border: string }> = {
  "Büyük Oda": { bg: "#3b82f6", border: "#2563eb" },         // Blue
  "Eğitim Odası": { bg: "#10b981", border: "#059669" },      // Green
  "Demo Odası": { bg: "#f59e0b", border: "#d97706" },        // Amber
  "Koltuklu Oda": { bg: "#8b5cf6", border: "#7c3aed" },      // Purple
  "Masalı Oda": { bg: "#ef4444", border: "#dc2626" },        // Red
};

const DEFAULT_COLOR = { bg: "#6b7280", border: "#4b5563" };

type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: {
    roomName: string;
    roomId: string;
    status: string;
    description: string | null;
  };
};

type BookingCalendarProps = {
  initialReservations: Reservation[];
  rooms: Room[];
  onRefresh: () => Promise<void>;
};

export function BookingCalendar({ initialReservations, rooms, onRefresh }: BookingCalendarProps) {
  const [reservations, setReservations] = useState<Reservation[]>(initialReservations);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Convert reservations to calendar events
  const events: CalendarEvent[] = useMemo(() => {
    return reservations.map((reservation) => ({
      id: reservation.id,
      title: `${reservation.title} (${reservation.rooms.name})`,
      start: new Date(reservation.start_time),
      end: new Date(reservation.end_time),
      resource: {
        roomName: reservation.rooms.name,
        roomId: reservation.room_id,
        status: reservation.status,
        description: reservation.description,
      },
    }));
  }, [reservations]);

  // Event style getter for color-coding by room
  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    const colors = ROOM_COLORS[event.resource.roomName] || DEFAULT_COLOR;
    const isPending = event.resource.status === "pending";

    return {
      style: {
        backgroundColor: colors.bg,
        borderColor: colors.border,
        borderWidth: "2px",
        borderStyle: isPending ? "dashed" : "solid",
        opacity: isPending ? 0.8 : 1,
        color: "white",
        borderRadius: "4px",
        fontSize: "0.875rem",
      },
    };
  }, []);

  // Handle slot selection (clicking on empty space)
  const handleSelectSlot = useCallback((slotInfo: SlotInfo) => {
    setSelectedSlot({
      start: slotInfo.start,
      end: slotInfo.end,
    });
    setDialogOpen(true);
  }, []);

  // Handle opening dialog with no pre-selected time
  const handleNewReservation = useCallback(() => {
    setSelectedSlot(null);
    setDialogOpen(true);
  }, []);

  // Handle reservation creation success
  const handleReservationCreated = useCallback(async () => {
    setDialogOpen(false);
    setSelectedSlot(null);
    await onRefresh();
  }, [onRefresh]);

  // Navigation handlers
  const handleNavigate = useCallback((date: Date) => {
    setCurrentDate(date);
  }, []);

  // Update reservations when parent refreshes
  const updateReservations = useCallback((newReservations: Reservation[]) => {
    setReservations(newReservations);
  }, []);

  // Expose updateReservations for parent components
  (BookingCalendar as typeof BookingCalendar & { updateReservations?: typeof updateReservations }).updateReservations = updateReservations;

  return (
    <div className="h-full flex flex-col">
      {/* Header with New Reservation button */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Rezervasyon Takvimi</h1>
          <p className="text-sm text-muted-foreground">
            Takvimde boş bir alana tıklayarak veya butona basarak yeni rezervasyon oluşturabilirsiniz
          </p>
        </div>
        <Button onClick={handleNewReservation} className="gap-2">
          <Plus className="h-4 w-4" />
          Yeni Rezervasyon
        </Button>
      </div>

      {/* Room legend */}
      <div className="flex flex-wrap gap-3 mb-4 p-3 bg-muted/50 rounded-lg">
        <span className="text-sm font-medium text-muted-foreground">Odalar:</span>
        {rooms.map((room) => {
          const colors = ROOM_COLORS[room.name] || DEFAULT_COLOR;
          return (
            <div key={room.id} className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: colors.bg }}
              />
              <span className="text-sm">{room.name}</span>
            </div>
          );
        })}
      </div>

      {/* Calendar */}
      <div className="flex-1 min-h-[600px] bg-background rounded-lg border">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          date={currentDate}
          onNavigate={handleNavigate}
          defaultView={Views.WEEK}
          views={[Views.MONTH, Views.WEEK, Views.DAY]}
          selectable
          onSelectSlot={handleSelectSlot}
          eventPropGetter={eventStyleGetter}
          min={new Date(0, 0, 0, 8, 0, 0)}
          max={new Date(0, 0, 0, 22, 0, 0)}
          step={30}
          timeslots={2}
          culture="tr"
          messages={{
            today: "Bugün",
            previous: "Geri",
            next: "İleri",
            month: "Ay",
            week: "Hafta",
            day: "Gün",
            agenda: "Ajanda",
            noEventsInRange: "Bu aralıkta rezervasyon bulunmuyor.",
            showMore: (count) => `+${count} daha`,
          }}
          style={{ height: "100%" }}
        />
      </div>

      {/* New Reservation Dialog */}
      <NewReservationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        rooms={rooms}
        initialStartTime={selectedSlot?.start}
        initialEndTime={selectedSlot?.end}
        onSuccess={handleReservationCreated}
      />
    </div>
  );
}
