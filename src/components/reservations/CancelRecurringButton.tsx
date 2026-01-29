"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  cancelReservation,
  cancelRecurringInstance,
} from "@/lib/actions/reservations";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface CancelRecurringButtonProps {
  reservationId: string;
  startTime: string;
  endTime: string;
}

export function CancelRecurringButton({
  reservationId,
  startTime,
  endTime,
}: CancelRecurringButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");

  // Generate next 8 weeks of dates for this recurring event
  const generateUpcomingDates = () => {
    const dates: { value: string; label: string }[] = [];
    const originalStart = new Date(startTime);
    const now = new Date();

    for (let week = 0; week < 8; week++) {
      const instanceDate = new Date(originalStart);
      instanceDate.setDate(instanceDate.getDate() + week * 7);

      // Only include future dates
      if (instanceDate > now) {
        dates.push({
          value: instanceDate.toISOString(),
          label: instanceDate.toLocaleDateString("tr-TR", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
        });
      }
    }

    return dates;
  };

  const upcomingDates = generateUpcomingDates();

  const handleCancelAll = async () => {
    setIsLoading(true);
    try {
      const result = await cancelReservation(reservationId);
      if (!result.success) {
        toast.error(result.message || "Rezervasyon iptal edilirken bir hata oluştu.");
      } else {
        toast.success("Tüm haftalık rezervasyonlar başarıyla iptal edildi.");
        setShowDialog(false);
      }
    } catch (error) {
      console.error("Cancel all recurring error:", error);
      toast.error("Bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelSingle = async () => {
    if (!selectedDate) {
      toast.error("Lütfen iptal edilecek tarihi seçin.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await cancelRecurringInstance(reservationId, selectedDate);
      if (!result.success) {
        toast.error(result.message || "Rezervasyon iptal edilirken bir hata oluştu.");
      } else {
        toast.success("Seçilen tarih için rezervasyon başarıyla iptal edildi.");
        setShowDialog(false);
        setSelectedDate("");
      }
    } catch (error) {
      console.error("Cancel single recurring error:", error);
      toast.error("Bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowDialog(true)}
        disabled={isLoading}
        className="text-red-600 hover:text-red-800 hover:bg-red-50 h-7 text-xs px-2"
      >
        {isLoading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
        İptal Et
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Haftalık Rezervasyonu İptal Et</DialogTitle>
            <DialogDescription>
              Bu haftalık tekrarlayan rezervasyonu nasıl iptal etmek istiyorsunuz?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Sadece belirli bir tarihi iptal et:
              </label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                disabled={isLoading}
              >
                <option value="">Tarih seçin...</option>
                {upcomingDates.map((date) => (
                  <option key={date.value} value={date.value}>
                    {date.label}
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleCancelSingle}
                disabled={isLoading || !selectedDate}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Bu Tarihi İptal Et
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  veya
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-red-600">
                Tüm haftalık rezervasyonları iptal et:
              </label>
              <Button
                variant="destructive"
                className="w-full"
                onClick={handleCancelAll}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Tümünü İptal Et
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowDialog(false)}
              disabled={isLoading}
            >
              Vazgeç
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
