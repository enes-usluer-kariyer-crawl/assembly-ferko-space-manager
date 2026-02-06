"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Calendar, dateFnsLocalizer, Views, SlotInfo, View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, differenceInMinutes, areIntervalsOverlapping, startOfToday, isSameDay } from "date-fns";
import { toast } from "sonner";
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
import { Plus, Coffee, Repeat } from "lucide-react";

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

type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  room: string;
  resource: {
    roomName: string;
    roomId: string;
    status: string;
    description: string | null;
    tags?: string[];
    cateringRequested?: boolean;
    isRecurring?: boolean;
    userName?: string;
    userId?: string;
    userFullName?: string | null;
    userEmail?: string;
    blockedByEventName?: string;
  };
};

// Custom event component with tooltips for all events
function EventComponent({ event }: { event: CalendarEvent }) {
  const duration = differenceInMinutes(event.end, event.start);
  const isShort = duration <= 45;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="h-full flex flex-col justify-center overflow-hidden">
          {/* Title: Always show, but adjust size */}
          <div className={`font-bold truncate ${isShort ? 'text-[10px] leading-3' : 'text-xs'}`}>
            {event.title}
          </div>
          {/* Owner: Hidden on card, visible in tooltip */}
          
          {/* Icons row - show for all events, smaller for short ones */}
          {(event.resource.isRecurring || event.resource.cateringRequested) && (
            <div className={`${isShort ? '' : 'mt-auto'} flex items-center gap-0.5 justify-end opacity-80`}>
              {event.resource.isRecurring && (
                <Repeat className={isShort ? "h-2.5 w-2.5" : "h-3 w-3"} />
              )}
              {event.resource.cateringRequested && (
                <Coffee className={isShort ? "h-2.5 w-2.5" : "h-3 w-3"} />
              )}
            </div>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-sm">
        <div className="space-y-1">
          <div className="font-semibold">{event.title}</div>
          <div className="text-sm">
            <span className="text-muted-foreground">Oda:</span> {event.resource.roomName}
          </div>
          {(event.resource.userEmail || event.resource.userFullName) && (
            <div className="text-sm">
              <span className="text-muted-foreground">Oluşturan:</span> {event.resource.userEmail || event.resource.userFullName}
            </div>
          )}
          {event.resource.description && (
            <div className="text-sm">
              <span className="text-muted-foreground">Açıklama:</span>{" "}
              {event.resource.description.replace(/<[^>]*>/g, "").slice(0, 100)}
              {event.resource.description.replace(/<[^>]*>/g, "").length > 100 ? "..." : ""}
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

const ROOM_COLORS: Record<string, { dot: string; activeBg: string; activeRing: string }> = {
  'Büyük Oda':    { dot: 'bg-blue-600',    activeBg: 'bg-blue-100 dark:bg-blue-900/30',      activeRing: 'ring-2 ring-blue-600' },
  'Demo Odası':   { dot: 'bg-amber-500',   activeBg: 'bg-orange-100 dark:bg-orange-900/30',   activeRing: 'ring-2 ring-orange-500' },
  'Eğitim Odası': { dot: 'bg-emerald-600', activeBg: 'bg-emerald-100 dark:bg-emerald-900/30', activeRing: 'ring-2 ring-emerald-600' },
  'Koltuklu Oda': { dot: 'bg-purple-600',  activeBg: 'bg-purple-100 dark:bg-purple-900/30',   activeRing: 'ring-2 ring-purple-600' },
  'Masalı Oda':   { dot: 'bg-rose-600',    activeBg: 'bg-rose-100 dark:bg-rose-900/30',       activeRing: 'ring-2 ring-rose-600' },
};

const DEFAULT_ROOM_COLOR = { dot: 'bg-gray-500', activeBg: 'bg-gray-100 dark:bg-gray-900/30', activeRing: 'ring-2 ring-gray-500' };

const FEATURE_LABELS: Record<string, string> = {
  'projector': 'Projektör',
  'whiteboard': 'Beyaz Tahta',
  'video_conference': 'Video Konferans',
  'sound_system': 'Ses Sistemi',
  'tv_screen': 'TV Ekranı',
  'comfortable_seating': 'Konforlu Oturma',
  'desk': 'Masa',
};

type BookingCalendarProps = {
  initialReservations: Reservation[];
  rooms: Room[];
  onRefresh: () => Promise<void>;
  isAuthenticated: boolean;
  currentUserId?: string;
  isAdmin?: boolean;
};

export function BookingCalendar({ initialReservations, rooms, onRefresh, isAuthenticated, currentUserId, isAdmin = false }: BookingCalendarProps) {
  const router = useRouter();
  const [reservations, setReservations] = useState<Reservation[]>(initialReservations);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Sync local state when parent passes updated reservations
  useEffect(() => {
    setReservations(initialReservations);
  }, [initialReservations]);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string | null>(null);
  const [view, setView] = useState<View>(Views.WEEK);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Convert reservations to calendar events
  const allEvents: CalendarEvent[] = useMemo(() => {
    return reservations.map((reservation) => {
      // Get user display name from profile
      // Request: Show email instead of full name on cards
      const userName = reservation.profiles?.email || reservation.profiles?.full_name || undefined;

      return {
        id: reservation.id,
        title: reservation.title, // Clean title
        start: new Date(reservation.start_time),
        end: new Date(reservation.end_time),
        room: reservation.rooms.name, // Link to resource
        resource: {
          roomName: reservation.rooms.name,
          roomId: reservation.room_id,
          status: reservation.status,
          description: reservation.description,
          tags: reservation.tags,
          cateringRequested: reservation.catering_requested,
          isRecurring: reservation.is_recurring,
          userName,
          userId: reservation.user_id,
          userFullName: reservation.profiles?.full_name,
          userEmail: reservation.profiles?.email,
          blockedByEventName: undefined // Would need to parse or fetch if needed
        },
      };
    });
  }, [reservations]);

  // Filter out "Blocked" events (big_event_block) - don't render as cards
  // Also filter by selected room if a room filter is active
  const visibleEvents = useMemo(() => {
    let filtered = allEvents.filter(e => !(e.resource.tags || []).includes("big_event_block"));
    if (selectedRoomFilter) {
      filtered = filtered.filter(e => e.room === selectedRoomFilter);
    }
    return filtered;
  }, [allEvents, selectedRoomFilter]);

  // Get big event time ranges for hatched background (from blocked placeholder events)
  const bigEventRanges = useMemo(() => {
    return allEvents
      .filter(e => (e.resource.tags || []).includes("big_event_block"))
      .map(e => ({ start: e.start, end: e.end }));
  }, [allEvents]);

  // Slot style getter for hatched background on blocked time slots and past times
  const slotPropGetter = useCallback((date: Date) => {
    const now = new Date();

    // Check if this slot falls within any big event range
    const isBlocked = bigEventRanges.some(range =>
      date >= range.start && date < range.end
    );

    if (isBlocked) {
      return {
        style: {
          background: 'repeating-linear-gradient(45deg, #f3f4f6, #f3f4f6 10px, #e5e7eb 10px, #e5e7eb 20px)',
          pointerEvents: 'none' as const
        }
      };
    }

    // Check if the slot is in the past
    if (date < now) {
      return {
        className: 'rbc-past-time-slot',
        style: {
          pointerEvents: 'none' as const
        }
      };
    }

    // For future slots, add a specific class for hover effects
    return {
      className: 'rbc-future-time-slot'
    };
  }, [bigEventRanges]);

  // Event style getter for color-coding by room
  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    let backgroundColor = '#3b82f6'; // Default Blue (Büyük Oda)

    switch (event.room) {
      case 'Demo Odası':
        backgroundColor = '#f97316'; // Orange
        break;
      case 'Eğitim Odası':
        backgroundColor = '#10b981'; // Emerald/Green
        break;
      case 'Koltuklu Oda':
        backgroundColor = '#9333ea'; // Purple
        break;
      case 'Masalı Oda':
        backgroundColor = '#e11d48'; // Rose/Red
        break;
    }

    // Handle "Pending" status visual (e.g., striped or lighter opacity)
    if (event.resource.status === 'pending') {
      return {
        style: {
          backgroundColor: backgroundColor,
          opacity: 0.7,
          border: '2px dashed #fff',
          color: 'white',
          borderRadius: '6px',
          zIndex: 10,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }
      };
    }

    // Main events: high zIndex and shadow to float above striped background
    return {
      style: {
        backgroundColor,
        color: 'white',
        borderRadius: '6px',
        border: 'none',
        zIndex: 10,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
      }
    };
  }, []);

  // Handle slot selection (clicking on empty space)
  const handleSelectSlot = useCallback((slotInfo: SlotInfo) => {
    if (!isAuthenticated) {
      router.push("/login?next=/");
      return;
    }

    const now = new Date();
    const today = startOfToday();

    // Prevent booking in the past (before today)
    if (slotInfo.start < today) {
      toast.error("Geçmiş bir zamana rezervasyon yapamazsınız.");
      return;
    }

    // Prevent booking on the same day
    if (isSameDay(slotInfo.start, now)) {
      toast.error("Aynı gün içerisinde rezervasyon yapılamaz.");
      return;
    }

    // Check if selected slot overlaps with any Big Event blocked time range
    const selectedInterval = { start: slotInfo.start, end: slotInfo.end };
    const isOverlappingBigEvent = bigEventRanges.some(range =>
      areIntervalsOverlapping(selectedInterval, range)
    );

    if (isOverlappingBigEvent) {
      toast.error("Bu saat aralığında ofis tamamen kapalıdır.");
      return;
    }

    // Note: In resource view, slotInfo might contain resourceId if we wanted to pre-select the room
    setSelectedSlot({
      start: slotInfo.start,
      end: slotInfo.end,
    });
    setDialogOpen(true);
  }, [isAuthenticated, router, bigEventRanges]);

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

  const handleViewChange = useCallback((newView: View) => {
    setView(newView);
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

        {/* Legend - clickable for filtering */}
        <div className="flex flex-wrap gap-4 mb-4 px-1 items-center">
          {selectedRoomFilter && (
            <button
              onClick={() => setSelectedRoomFilter(null)}
              className="flex items-center gap-2 px-2 py-1 rounded-md bg-primary/10 hover:bg-primary/20 transition-colors text-sm font-medium text-primary"
            >
              Tüm Odaları Göster
            </button>
          )}
          {rooms.map((room) => {
            const colors = ROOM_COLORS[room.name] || DEFAULT_ROOM_COLOR;
            const isSelected = selectedRoomFilter === room.name;
            return (
              <Tooltip key={room.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setSelectedRoomFilter(isSelected ? null : room.name)}
                    className={`flex items-center gap-2 px-2 py-1 rounded-md transition-colors ${
                      isSelected ? `${colors.activeBg} ${colors.activeRing}` : 'hover:bg-muted'
                    }`}
                  >
                    <div className={`w-3 h-3 rounded ${colors.dot}`}></div>
                    <span className={`text-sm ${isSelected ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                      {room.name}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="p-0 overflow-hidden rounded-lg max-w-xs">
                  <div className="flex flex-col">
                    {room.img && (
                      <img
                        src={room.img}
                        alt={room.name}
                        className="w-64 h-40 object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    )}
                    <div className="p-3 space-y-1">
                      <div className="font-semibold text-sm">{room.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Kapasite: {room.capacity} kişi
                      </div>
                      {room.features.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {room.features.map(f => FEATURE_LABELS[f] || f.replace(/_/g, ' ')).join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Calendar */}
        <div className="flex-1 bg-background rounded-lg border" style={{ height: 'calc(100vh - 180px)' }}>
          {isMounted ? (
            <Calendar
              localizer={localizer}
              events={visibleEvents}
              startAccessor="start"
              endAccessor="end"
              date={currentDate}
              onNavigate={handleNavigate}
              view={view}
              onView={handleViewChange}
              views={[Views.MONTH, Views.WEEK, Views.DAY]}
              selectable
              scrollToTime={new Date()}
              onSelectSlot={handleSelectSlot}
              onSelectEvent={handleSelectEvent}
              eventPropGetter={eventStyleGetter}
              slotPropGetter={slotPropGetter}
              min={new Date(0, 0, 0, 0, 0, 0)}
              max={new Date(0, 0, 0, 23, 59, 59)}
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
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}
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
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onCancelled={onRefresh}
        />
      </div>
    </TooltipProvider>
  );
}