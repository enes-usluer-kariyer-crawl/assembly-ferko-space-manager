"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Calendar, dateFnsLocalizer, Views, SlotInfo } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { tr } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";

import type { Reservation, Room } from "@/lib/actions/reservations";
import { NewReservationDialog } from "./NewReservationDialog";
import { ReservationDetailDialog } from "./ReservationDetailDialog";
import { CalendarToolbar } from "./CalendarToolbar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, Coffee, Repeat, Ban } from "lucide-react";

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
    tags?: string[];
    cateringRequested?: boolean;
    isRecurring?: boolean;
    userName?: string;
    // For big_event_block: the name of the main event that caused the block
    blockedByEventName?: string;
  };
};

// Custom event component with tooltips for all events
function EventComponent({ event }: { event: CalendarEvent }) {
  const tags = event.resource.tags || [];
  const isBigEventBlock = tags.includes("big_event_block");
  const isBigEvent = tags.includes("big_event");

  // Big Event Block: Minimal container with just an icon, tooltip shows details
  if (isBigEventBlock) {
    // Extract the main event name from the description (format: "Blocked due to Big Event: [name]")
    const mainEventName = event.resource.blockedByEventName ||
      (event.resource.description?.replace("Blocked due to Big Event: ", "") ?? "Büyük Etkinlik");

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center justify-center h-full w-full cursor-default">
            <Ban className="h-4 w-4 text-gray-400" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="font-semibold text-destructive">Ofis Kapalı</div>
          <div className="text-sm text-muted-foreground">{mainEventName}</div>
        </TooltipContent>
      </Tooltip>
    );
  }

  const displayTitle = event.title.replace(` (${event.resource.roomName})`, "");
  const userName = event.resource.userName;

  // Standard event content
  const eventContent = (
    <div className="flex flex-col gap-1 overflow-hidden h-full p-1">
      {/* Title (bold) */}
      <div className="flex items-center gap-1">
        <span className="font-bold truncate text-sm">{displayTitle}</span>
        {event.resource.cateringRequested && (
          <Coffee className="h-3 w-3 flex-shrink-0" />
        )}
        {event.resource.isRecurring && (
          <Repeat className="h-3 w-3 flex-shrink-0" />
        )}
      </div>
      {/* User name (small) - only show if not a big event */}
      {userName && !isBigEvent && (
        <span className="text-xs opacity-75 truncate">{userName}</span>
      )}
    </div>
  );

  // Tooltip with full details
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="h-full w-full">{eventContent}</div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-sm">
        <div className="space-y-1">
          <div className="font-semibold">{displayTitle}</div>
          <div className="text-sm">
            <span className="text-muted-foreground">Oda:</span> {event.resource.roomName}
          </div>
          {userName && (
            <div className="text-sm">
              <span className="text-muted-foreground">Kişi:</span> {userName}
            </div>
          )}
          {event.resource.description && (
            <div className="text-sm">
              <span className="text-muted-foreground">Açıklama:</span> {event.resource.description}
            </div>
          )}
          {event.resource.cateringRequested && (
            <div className="text-sm flex items-center gap-1">
              <Coffee className="h-3 w-3" />
              <span>İkram talep edildi</span>
            </div>
          )}
          {event.resource.isRecurring && (
            <div className="text-sm flex items-center gap-1">
              <Repeat className="h-3 w-3" />
              <span>Tekrarlayan etkinlik</span>
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

type BookingCalendarProps = {
  initialReservations: Reservation[];
  rooms: Room[];
  onRefresh: () => Promise<void>;
  isAuthenticated: boolean;
};

export function BookingCalendar({ initialReservations, rooms, onRefresh, isAuthenticated }: BookingCalendarProps) {
  const router = useRouter();
  const [reservations, setReservations] = useState<Reservation[]>(initialReservations);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Convert reservations to calendar events
  const events: CalendarEvent[] = useMemo(() => {
    return reservations.map((reservation) => {
      // Get user display name from profile
      const userName = reservation.profiles?.full_name || reservation.profiles?.email || undefined;

      return {
        id: reservation.id,
        title: `${reservation.title} (${reservation.rooms.name})`,
        start: new Date(reservation.start_time),
        end: new Date(reservation.end_time),
        resource: {
          roomName: reservation.rooms.name,
          roomId: reservation.room_id,
          status: reservation.status,
          description: reservation.description,
          tags: reservation.tags,
          cateringRequested: reservation.catering_requested,
          isRecurring: reservation.is_recurring,
          userName,
        },
      };
    });
  }, [reservations]);

  // Event style getter for color-coding by room and status
  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    const colors = ROOM_COLORS[event.resource.roomName] || DEFAULT_COLOR;
    const isPending = event.resource.status === "pending";
    const tags = event.resource.tags || [];
    const isBigEventBlock = tags.includes("big_event_block");
    const isBigEvent = tags.includes("big_event");

    // Big Event Block: Grey striped pattern, lower z-index than main event
    if (isBigEventBlock) {
      return {
        style: {
          background: "repeating-linear-gradient(45deg, #f3f4f6, #f3f4f6 10px, #e5e7eb 10px, #e5e7eb 20px)",
          border: "1px solid #d1d5db",
          opacity: 0.9,
          color: "#6b7280",
          borderRadius: "4px",
          fontSize: "0.75rem",
          fontWeight: 500,
          cursor: "default",
          zIndex: 1, // Lower z-index so main Big Event appears on top
        },
      };
    }

    // Main Big Event: Prominent styling
    if (isBigEvent) {
      return {
        style: {
          backgroundColor: "#7c2d12",
          border: "3px solid #450a0a",
          opacity: 1,
          color: "#ffffff",
          borderRadius: "6px",
          fontSize: "0.875rem",
          fontWeight: 700,
          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.2)",
          zIndex: 10,
        },
      };
    }

    if (isPending) {
      // Pending: Light orange/amber background with dashed border
      return {
        style: {
          backgroundColor: "#fff7ed", // Light amber background
          border: "2px dashed #f59e0b", // Dashed amber border
          opacity: 0.85,
          color: "#b45309", // Dark amber text
          borderRadius: "6px",
          fontSize: "0.875rem",
          fontWeight: 500,
          boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        },
      };
    }

    // Approved: Solid colors based on room
    return {
      style: {
        backgroundColor: `${colors.bg}15`, // Light background with 15% opacity
        borderLeft: `4px solid ${colors.border}`, // Left border highlight
        borderTop: "none",
        borderRight: "none",
        borderBottom: "none",
        opacity: 1,
        color: colors.border, // Text color matches border
        borderRadius: "6px",
        fontSize: "0.875rem",
        fontWeight: 500,
        boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
      },
    };
  }, []);

  // Handle slot selection (clicking on empty space)
  const handleSelectSlot = useCallback((slotInfo: SlotInfo) => {
    if (!isAuthenticated) {
      router.push("/login?next=/");
      return;
    }
    setSelectedSlot({
      start: slotInfo.start,
      end: slotInfo.end,
    });
    setDialogOpen(true);
  }, [isAuthenticated, router]);

  // Handle event selection (clicking on existing event)
  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
    setDetailDialogOpen(true);
  }, []);

  // Handle opening dialog with no pre-selected time
  const handleNewReservation = useCallback(() => {
    if (!isAuthenticated) {
      router.push("/login?next=/");
      return;
    }
    setSelectedSlot(null);
    setDialogOpen(true);
  }, [isAuthenticated, router]);

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
    <TooltipProvider delayDuration={200}>
    <div className="h-full flex flex-col">
      {/* Header with New Reservation button */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Rezervasyon Takvimi</h1>
          <p className="text-sm text-muted-foreground">
            Takvimde boş bir alana tıklayarak veya butona basarak yeni rezervasyon oluşturabilirsiniz
          </p>
        </div>
        <Button
          onClick={handleNewReservation}
          size="lg"
          className="gap-2 px-6 py-3 text-base font-semibold shadow-md hover:shadow-lg transition-shadow"
        >
          <Plus className="h-5 w-5" />
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
        <div className="ml-4 border-l pl-4 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded"
              style={{ border: "2px dashed #f59e0b", backgroundColor: "#fff7ed" }}
            />
            <span className="text-sm text-muted-foreground">Onay Bekliyor</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded"
              style={{ borderLeft: "4px solid #3b82f6", backgroundColor: "#3b82f615" }}
            />
            <span className="text-sm text-muted-foreground">Onaylandı</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded"
              style={{
                background: "repeating-linear-gradient(45deg, #f3f4f6, #f3f4f6 4px, #e5e7eb 4px, #e5e7eb 8px)",
                border: "1px solid #d1d5db"
              }}
            />
            <span className="text-sm text-muted-foreground">Ofis Kapalı</span>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="flex-1 bg-background rounded-lg border" style={{ height: 'calc(100vh - 150px)' }}>
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
          onSelectEvent={handleSelectEvent}
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
          components={{
            toolbar: CalendarToolbar,
            event: EventComponent,
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

      {/* Reservation Detail Dialog */}
      <ReservationDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        event={selectedEvent}
      />
    </div>
    </TooltipProvider>
  );
}
