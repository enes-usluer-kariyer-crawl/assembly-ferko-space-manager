"use client";

import { useState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
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

import type { Room, ConflictingReservation } from "@/lib/actions/reservations";
import { createReservation } from "@/lib/actions/reservations";
import { ROOM_CAPACITIES } from "@/constants/rooms";
import { AlertTriangle } from "lucide-react";

type NewReservationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rooms: Room[];
  initialStartTime?: Date;
  initialEndTime?: Date;
  initialRoomId?: string;
  onSuccess: () => void;
};

const BIG_EVENT_TAGS = [
  "ÖM-Success Meetings",
  "Exco Toplantısı",
  "ÖM- HR Small Talks",
];

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending || disabled}>
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
  initialRoomId,
  onSuccess,
}: NewReservationDialogProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [blockingConflicts, setBlockingConflicts] = useState<ConflictingReservation[] | null>(null);

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

  // Get tomorrow's date in YYYY-MM-DD format for min date validation
  const calculateMinDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return format(d, "yyyy-MM-dd");
  };
  const minDateStr = calculateMinDate();

  // Reset form when dialog opens/closes or initial times change
  useEffect(() => {
    if (open) {
      setError(null);
      setBlockingConflicts(null);
      setTitle("");
      setDescription("");
      setRoomId(initialRoomId || "");
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
    setBlockingConflicts(null);

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

    // Construct Date objects from local inputs to handle timezone correctly
    const startLocal = new Date(`${formStartDate}T${formStartTime}:00`);
    const endLocal = new Date(`${formEndDate}T${formEndTime}:00`);

    // Validate: cannot book in the past
    if (startLocal < new Date()) {
      setError("Geçmişe rezervasyon yapılamaz.");
      return;
    }

    // Validate times
    if (endLocal <= startLocal) {
      setError("Bitiş zamanı başlangıç zamanından sonra olmalıdır.");
      return;
    }

    // Convert to ISO string (UTC) so server receives the correct absolute time
    const startDateTime = startLocal.toISOString();
    const endDateTime = endLocal.toISOString();

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
        // Handle BLOCKING conflict type specifically
        if (result.conflictType === "BLOCKING" && result.conflictingEvents) {
          setBlockingConflicts(result.conflictingEvents);
          // Don't show generic error, the blocking dialog will be shown
          return;
        }

        const errorMessage = result.error || "Rezervasyon oluşturulamadı.";
        setError(errorMessage);
        // Show toast for conflict errors (red alert)
        toast.error(errorMessage);
        // Do NOT close the modal - user can pick a new time
        return;
      }

      // Trigger server data re-fetch to update calendar without page reload
      router.refresh();
      onSuccess();
    } catch (err) {
      console.error("Error creating reservation:", err);
      const errorMessage = "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.";
      setError(errorMessage);
      toast.error(errorMessage);
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

        <form action={handleFormAction}>
          <div className="max-h-[70vh] overflow-y-auto p-1 space-y-3">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                {error}
              </div>
            )}

            {/* Blocking Conflicts Alert */}
            {blockingConflicts && blockingConflicts.length > 0 && (
              <div className="p-4 border border-orange-300 bg-orange-50 rounded-md space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-orange-800">
                      Bu saat aralığında {blockingConflicts.length} adet toplantı var.
                    </p>
                    <p className="text-sm text-orange-700">
                      Blokaj koymak için önce bu toplantıların iptal edilmesi gerekmektedir.
                    </p>
                  </div>
                </div>
                <div className="space-y-2 mt-3">
                  <p className="text-xs font-medium text-orange-800 uppercase tracking-wide">
                    Çakışan Toplantılar:
                  </p>
                  <ul className="space-y-2">
                    {blockingConflicts.map((conflict) => (
                      <li
                        key={conflict.id}
                        className="text-sm text-orange-900 bg-orange-100 rounded px-3 py-2"
                      >
                        <span className="font-medium">{conflict.roomName}</span>
                        {" - "}
                        {conflict.title}
                        {conflict.ownerName && (
                          <span className="text-orange-700"> ({conflict.ownerName})</span>
                        )}
                        <div className="text-xs text-orange-600 mt-1">
                          {new Date(conflict.startTime).toLocaleString("tr-TR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                          {" - "}
                          {new Date(conflict.endTime).toLocaleString("tr-TR", {
                            timeStyle: "short",
                          })}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
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
                      {room.name} (Kapasite: {ROOM_CAPACITIES[room.name] ?? room.capacity})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date and Time Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Başlangıç Tarihi *</Label>
                <Input
                  id="startDate"
                  name="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  min={minDateStr}
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

              <div className="space-y-2">
                <Label htmlFor="endDate">Bitiş Tarihi *</Label>
                <Input
                  id="endDate"
                  name="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate || minDateStr}
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
            <p className="text-xs text-muted-foreground">
              Hazırlık süreçleri nedeniyle en erken yarına rezervasyon oluşturabilirsiniz.
            </p>

            {/* Tags multi-select (for big events) */}
            <div className="space-y-2">
              <Label>Etiketler (Büyük Etkinlikler)</Label>
              <div className="flex flex-row space-x-4 rounded-md border p-3">
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
                rows={2}
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
          </div>

          <DialogFooter className="mt-4">
            <CancelButton onCancel={() => onOpenChange(false)} />
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
