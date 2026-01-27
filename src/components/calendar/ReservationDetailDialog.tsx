"use client";

import { format } from "date-fns";
import { tr } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Clock, MapPin, FileText, Coffee, Repeat } from "lucide-react";

type ReservationDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: {
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
    };
  } | null;
};

function StatusBadge({ status }: { status: string }) {
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800 border border-amber-300">
        ⏳ Onay Bekliyor
      </span>
    );
  }

  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 border border-green-300">
        ✅ Onaylandı
      </span>
    );
  }

  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 border border-red-300">
        ❌ Reddedildi
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 border border-gray-300">
      {status}
    </span>
  );
}

export function ReservationDetailDialog({
  open,
  onOpenChange,
  event,
}: ReservationDetailDialogProps) {
  if (!event) return null;

  const formatDateTime = (date: Date) => {
    return format(date, "d MMMM yyyy, HH:mm", { locale: tr });
  };

  // Extract title without room name suffix for cleaner display
  const displayTitle = event.title.replace(` (${event.resource.roomName})`, "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <DialogTitle className="text-xl pr-4">{displayTitle}</DialogTitle>
          </div>
          <div className="pt-2">
            <StatusBadge status={event.resource.status} />
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Room */}
          <div className="flex items-center gap-3 text-muted-foreground">
            <MapPin className="h-5 w-5 flex-shrink-0" />
            <span className="font-medium text-foreground">{event.resource.roomName}</span>
          </div>

          {/* Time */}
          <div className="flex items-start gap-3 text-muted-foreground">
            <Clock className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-foreground">
                {formatDateTime(event.start)}
              </div>
              <div className="text-sm">
                — {formatDateTime(event.end)}
              </div>
            </div>
          </div>

          {/* Description */}
          {event.resource.description && (
            <div className="flex items-start gap-3 text-muted-foreground">
              <FileText className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <p className="text-foreground">{event.resource.description}</p>
            </div>
          )}

          {/* Catering */}
          {event.resource.cateringRequested && (
            <div className="flex items-center gap-3 text-muted-foreground">
              <Coffee className="h-5 w-5 flex-shrink-0" />
              <span className="text-foreground">İkram talep edildi</span>
            </div>
          )}

          {/* Recurring */}
          {event.resource.isRecurring && (
            <div className="flex items-center gap-3 text-muted-foreground">
              <Repeat className="h-5 w-5 flex-shrink-0" />
              <span className="text-foreground">Tekrarlayan etkinlik (Her Hafta)</span>
            </div>
          )}

          {/* Tags */}
          {event.resource.tags && event.resource.tags.length > 0 && (
            <div className="pt-2 border-t">
              <div className="flex flex-wrap gap-2">
                {event.resource.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 text-xs rounded-md bg-muted text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
