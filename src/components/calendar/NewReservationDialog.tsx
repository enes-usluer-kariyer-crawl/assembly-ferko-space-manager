"use client";

import { useState, useEffect } from "react";
import { useFormStatus } from "react-dom";
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
import { Checkbox } from "@/components/ui/checkbox";

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

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Oluşturuluyor..." : "Rezervasyon Oluştur"}
    </Button>
  );
}

function CancelButton({
  onCancel,
}: {
  onCancel: () => void;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="button"
      variant="outline"
      onClick={onCancel}
      disabled={pending}
    >
      İptal
    </Button>
  );
}

export function NewReservationDialog({
  open,
  onOpenChange,
  rooms,
  initialStartTime,
  initialEndTime,
  onSuccess,
}: NewReservationDialogProps) {
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [roomId, setRoomId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [cateringRequested, setCateringRequested] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState<"none" | "weekly">("none");

  // Reset form when dialog opens/closes or initial times change
  useEffect(() => {
    if (open) {
      setError(null);
      setTitle("");
      setDescription("");
      setRoomId("");
      setSelectedTags([]);
      setCateringRequested(false);
      setRecurrencePattern("none");

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

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : [...prev, tag]
    );
  };

  const handleFormAction = async (formData: FormData) => {
    setError(null);

    // Validate form
    const formTitle = formData.get("title") as string;
    const formRoomId = formData.get("roomId") as string;
    const formStartDate = formData.get("startDate") as string;
    const formStartTime = formData.get("startTime") as string;
    const formEndDate = formData.get("endDate") as string;
    const formEndTime = formData.get("endTime") as string;
    const formDescription = formData.get("description") as string;

    if (!formTitle?.trim()) {
      setError("Lütfen bir başlık girin.");
      return;
    }

    if (!formRoomId) {
      setError("Lütfen bir oda seçin.");
      return;
    }

    if (!formStartDate || !formStartTime || !formEndDate || !formEndTime) {
      setError("Lütfen başlangıç ve bitiş tarih/saatini girin.");
      return;
    }

    // Construct ISO datetime strings
    const startDateTime = `${formStartDate}T${formStartTime}:00`;
    const endDateTime = `${formEndDate}T${formEndTime}:00`;

    // Validate times
    if (new Date(endDateTime) <= new Date(startDateTime)) {
      setError("Bitiş zamanı başlangıç zamanından sonra olmalıdır.");
      return;
    }

    try {
      const result = await createReservation({
        roomId: formRoomId,
        title: formTitle.trim(),
        description: formDescription?.trim() || undefined,
        startTime: startDateTime,
        endTime: endDateTime,
        tags: selectedTags,
        cateringRequested,
        recurrencePattern,
      });

      if (!result.success) {
        setError(result.error || "Rezervasyon oluşturulamadı.");
        return;
      }

      onSuccess();
    } catch (err) {
      console.error("Error creating reservation:", err);
      setError("Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.");
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

        <form action={handleFormAction} className="space-y-4">
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
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Toplantı başlığını girin"
            />
          </div>

          {/* Room selection */}
          <div className="space-y-2">
            <Label htmlFor="room">Oda *</Label>
            <input type="hidden" name="roomId" value={roomId} />
            <Select value={roomId} onValueChange={setRoomId}>
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
                name="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startTime">Başlangıç Saati *</Label>
              <Input
                id="startTime"
                name="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
          </div>

          {/* End datetime */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="endDate">Bitiş Tarihi *</Label>
              <Input
                id="endDate"
                name="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">Bitiş Saati *</Label>
              <Input
                id="endTime"
                name="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          {/* Tags multi-select (for big events) */}
          <div className="space-y-2">
            <Label>Etiketler (Büyük Etkinlikler)</Label>
            <div className="space-y-2 rounded-md border p-3">
              {BIG_EVENT_TAGS.map((tag) => (
                <div key={tag} className="flex items-center gap-2">
                  <Checkbox
                    id={`tag-${tag}`}
                    checked={selectedTags.includes(tag)}
                    onCheckedChange={() => handleTagToggle(tag)}
                  />
                  <Label
                    htmlFor={`tag-${tag}`}
                    className="font-normal cursor-pointer"
                  >
                    {tag}
                  </Label>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Büyük etkinlikler tüm odaları bloke eder.
            </p>
          </div>

          {/* Recurrence */}
          <div className="space-y-2">
            <Label htmlFor="recurrence">Tekrarla</Label>
            <Select value={recurrencePattern} onValueChange={(value: "none" | "weekly") => setRecurrencePattern(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Tekrar seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Tekrarlanmıyor</SelectItem>
                <SelectItem value="weekly">Her Hafta</SelectItem>
              </SelectContent>
            </Select>
            {recurrencePattern === "weekly" && (
              <p className="text-xs text-muted-foreground">
                Bu rezervasyon 4 hafta boyunca her hafta aynı gün ve saatte tekrarlanacak.
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Açıklama</Label>
            <Textarea
              id="description"
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Toplantı hakkında ek bilgi (opsiyonel)"
              rows={3}
            />
          </div>

          {/* Catering checkbox */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="catering"
              checked={cateringRequested}
              onCheckedChange={(checked) => setCateringRequested(checked === true)}
            />
            <Label htmlFor="catering" className="font-normal cursor-pointer">
              İkram talep ediyorum
            </Label>
          </div>

          <DialogFooter>
            <CancelButton onCancel={() => onOpenChange(false)} />
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
