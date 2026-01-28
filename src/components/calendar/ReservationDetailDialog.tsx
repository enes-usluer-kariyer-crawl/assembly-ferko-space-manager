"use client";

import { useState } from "react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, FileText, Coffee, Repeat, X, User } from "lucide-react";
import { cancelReservation } from "@/lib/actions/reservations";
import { toast } from "sonner";

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
      userId?: string;
      userName?: string;
      userFullName?: string | null;
      userEmail?: string;
    };
  } | null;
  currentUserId?: string;
  isAdmin?: boolean;
  onCancelled?: () => void;
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

function PastEventBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-slate-100 text-slate-600 border border-slate-300">
      Geçmiş Etkinlik
    </span>
  );
}

export function ReservationDetailDialog({
  open,
  onOpenChange,
  event,
  currentUserId,
  isAdmin = false,
  onCancelled,
}: ReservationDetailDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (!event) return null;

  const formatDateTime = (date: Date) => {
    return format(date, "d MMMM yyyy, HH:mm", { locale: tr });
  };

  // Extract title without room name suffix for cleaner display
  const displayTitle = event.title.replace(` (${event.resource.roomName})`, "");

  // Check if event is in the past
  const isPastEvent = event.end < new Date();

  // Check if user can cancel this reservation (not past, not already cancelled/rejected)
  const isOwner = currentUserId && event.resource.userId === currentUserId;
  const canCancel = (isOwner || isAdmin) && event.resource.status !== "cancelled" && event.resource.status !== "rejected" && !isPastEvent;

  // Dynamic button label based on status
  const cancelButtonLabel = event.resource.status === "pending" ? "Talebi Geri Çek" : "İptal Et";

  const handleCancel = async () => {
    if (!window.confirm("Emin misiniz?")) {
      return;
    }

    setIsLoading(true);
    try {
      const result = await cancelReservation(event.id);
      if (result.success) {
        toast.success(result.message || "Rezervasyon iptal edildi.");
        onOpenChange(false);
        onCancelled?.();
      } else {
        toast.error(result.message || "Bir hata oluştu.");
      }
    } catch {
      toast.error("Bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <DialogTitle className="text-xl pr-4">{displayTitle}</DialogTitle>
          </div>
          <div className="pt-2 flex flex-wrap gap-2">
            <StatusBadge status={event.resource.status} />
            {isPastEvent && <PastEventBadge />}
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

          {/* Creator */}
              {(event.resource.userFullName || event.resource.userEmail) && (
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div className="space-y-1">
                    <span className="text-sm font-medium leading-none block">
                      Oluşturan
                    </span>
                    {event.resource.userFullName && (
                      <span className="text-sm text-foreground block">
                        {event.resource.userFullName}
                      </span>
                    )}
                    {event.resource.userEmail && (
                      <span className="text-sm text-muted-foreground block">
                        {event.resource.userEmail}
                      </span>
                    )}
                  </div>
                </div>
              )}

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

        {/* Footer with Cancel Button */}
        {canCancel && (
          <DialogFooter className="pt-4 border-t">
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={isLoading}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              {isLoading ? "İptal ediliyor..." : cancelButtonLabel}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
