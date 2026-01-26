"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { Room } from "@/lib/actions/reservations";
import { createReservation } from "@/lib/actions/reservations";

type NewReservationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rooms: Room[];
  initialStartTime?: Date;
  initialEndTime?: Date;
  onSuccess: () => void;
};

const BIG_EVENT_TAGS = [
  "ÖM-Success Meetings",
  "Exco Toplantısı",
  "ÖM- HR Small Talks",
];

export function NewReservationDialog({
  open,
  onOpenChange,
  rooms,
  initialStartTime,
  initialEndTime,
  onSuccess,
}: NewReservationDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [roomId, setRoomId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [cateringRequested, setCateringRequested] = useState(false);

  // Reset form when dialog opens/closes or initial times change
  useEffect(() => {
    if (open) {
      setError(null);
      setTitle("");
      setDescription("");
      setRoomId("");
      setSelectedTag("");
      setCateringRequested(false);

      if (initialStartTime) {
        setStartDate(format(initialStartTime, "yyyy-MM-dd"));
        setStartTime(format(initialStartTime, "HH:mm"));
      } else {
        setStartDate("");
        setStartTime("");
      }

      if (initialEndTime) {
        setEndDate(format(initialEndTime, "yyyy-MM-dd"));
        setEndTime(format(initialEndTime, "HH:mm"));
      } else {
        setEndDate("");
        setEndTime("");
      }
    }
  }, [open, initialStartTime, initialEndTime]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Validate form
      if (!title.trim()) {
        setError("Lütfen bir başlık girin.");
        setIsSubmitting(false);
        return;
      }

      if (!roomId) {
        setError("Lütfen bir oda seçin.");
        setIsSubmitting(false);
        return;
      }

      if (!startDate || !startTime || !endDate || !endTime) {
        setError("Lütfen başlangıç ve bitiş tarih/saatini girin.");
        setIsSubmitting(false);
        return;
      }

      // Construct ISO datetime strings
      const startDateTime = `${startDate}T${startTime}:00`;
      const endDateTime = `${endDate}T${endTime}:00`;

      // Validate times
      if (new Date(endDateTime) <= new Date(startDateTime)) {
        setError("Bitiş zamanı başlangıç zamanından sonra olmalıdır.");
        setIsSubmitting(false);
        return;
      }

      const tags = selectedTag ? [selectedTag] : [];

      const result = await createReservation({
        roomId,
        title: title.trim(),
        description: description.trim() || undefined,
        startTime: startDateTime,
        endTime: endDateTime,
        tags,
        cateringRequested,
      });

      if (!result.success) {
        setError(result.error || "Rezervasyon oluşturulamadı.");
        setIsSubmitting(false);
        return;
      }

      onSuccess();
    } catch (err) {
      console.error("Error creating reservation:", err);
      setError("Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Yeni Rezervasyon</DialogTitle>
          <DialogDescription>
            Toplantı odası rezervasyonu oluşturmak için aşağıdaki formu doldurun.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              {error}
            </div>
          )}

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Başlık *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Toplantı başlığını girin"
              disabled={isSubmitting}
            />
          </div>

          {/* Room selection */}
          <div className="space-y-2">
            <Label htmlFor="room">Oda *</Label>
            <Select value={roomId} onValueChange={setRoomId} disabled={isSubmitting}>
              <SelectTrigger>
                <SelectValue placeholder="Oda seçin" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((room) => (
                  <SelectItem key={room.id} value={room.id}>
                    {room.name} (Kapasite: {room.capacity})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Start datetime */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Başlangıç Tarihi *</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startTime">Başlangıç Saati *</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* End datetime */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="endDate">Bitiş Tarihi *</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">Bitiş Saati *</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Tag selection (for big events) */}
          <div className="space-y-2">
            <Label htmlFor="tag">Etkinlik Türü</Label>
            <Select value={selectedTag} onValueChange={setSelectedTag} disabled={isSubmitting}>
              <SelectTrigger>
                <SelectValue placeholder="Etkinlik türü seçin (opsiyonel)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Standart Toplantı</SelectItem>
                {BIG_EVENT_TAGS.map((tag) => (
                  <SelectItem key={tag} value={tag}>
                    {tag}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Büyük etkinlikler tüm odaları bloke eder.
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Açıklama</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Toplantı hakkında ek bilgi (opsiyonel)"
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          {/* Catering checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="catering"
              checked={cateringRequested}
              onChange={(e) => setCateringRequested(e.target.checked)}
              disabled={isSubmitting}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="catering" className="font-normal">
              İkram talep ediyorum
            </Label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              İptal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Oluşturuluyor..." : "Rezervasyon Oluştur"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
