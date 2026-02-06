"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Pencil, Plus, X, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { RichTextEditor } from "@/components/ui/rich-text-editor";

import { updateReservation } from "@/lib/actions/reservations";
import { ROOM_CAPACITIES } from "@/constants/rooms";

const BIG_EVENT_TAGS = [
    "ÖM-Success Meetings",
    "Exco Toplantısı",
    "ÖM- HR Small Talks",
];

type Room = {
    id: string;
    name: string;
    capacity: number;
};

type EditReservationDialogProps = {
    reservation: {
        id: string;
        title: string;
        description?: string | null;
        start_time: string;
        end_time: string;
        room_id: string;
        attendees?: string[];
        catering_requested?: boolean;
        tags?: string[];
        is_recurring?: boolean;
        recurrence_pattern?: string;
        recurrence_end_type?: string;
        recurrence_count?: number;
        recurrence_end_date?: string;
    };
    rooms: Room[];
    trigger?: React.ReactNode;
    onSuccess?: () => void;
};

export function EditReservationDialog({
    reservation,
    rooms,
    trigger,
    onSuccess,
}: EditReservationDialogProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [title, setTitle] = useState(reservation.title);
    const [description, setDescription] = useState(reservation.description || "");
    const [roomId, setRoomId] = useState(reservation.room_id);
    const [startDate, setStartDate] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endDate, setEndDate] = useState("");
    const [endTime, setEndTime] = useState("");
    const [selectedTags, setSelectedTags] = useState<string[]>(reservation.tags || []);
    const [cateringRequested, setCateringRequested] = useState(
        reservation.catering_requested || false
    );
    const [attendees, setAttendees] = useState<string[]>(reservation.attendees || []);
    const [attendeeInput, setAttendeeInput] = useState("");
    const [attendeeError, setAttendeeError] = useState<string | null>(null);
    const [allDay, setAllDay] = useState(false);

    // Recurrence state
    const [recurrencePattern, setRecurrencePattern] = useState<"none" | "daily" | "weekly" | "biweekly" | "monthly">((reservation.recurrence_pattern as any) || "none");
    const [recurrenceEndType, setRecurrenceEndType] = useState<"never" | "count" | "date">((reservation.recurrence_end_type as any) || "never");
    const [recurrenceCount, setRecurrenceCount] = useState(reservation.recurrence_count || 4);
    const [recurrenceEndDate, setRecurrenceEndDate] = useState(reservation.recurrence_end_date ? format(new Date(reservation.recurrence_end_date), "yyyy-MM-dd") : "");

    // Initialize dates when dialog opens
    useEffect(() => {
        if (open) {
            const start = new Date(reservation.start_time);
            const end = new Date(reservation.end_time);

            setTitle(reservation.title);
            setDescription(reservation.description || "");
            setRoomId(reservation.room_id);
            setStartDate(format(start, "yyyy-MM-dd"));
            setStartTime(format(start, "HH:mm"));
            setEndDate(format(end, "yyyy-MM-dd"));
            setEndTime(format(end, "HH:mm"));
            setCateringRequested(reservation.catering_requested || false);
            setAttendees(reservation.attendees || []);
            setSelectedTags(reservation.tags || []);

            // Recurrence defaults
            setRecurrencePattern((reservation.recurrence_pattern as any) || "none");
            setRecurrenceEndType((reservation.recurrence_end_type as any) || "never");
            setRecurrenceCount(reservation.recurrence_count || 4);
            setRecurrenceEndDate(reservation.recurrence_end_date ? format(new Date(reservation.recurrence_end_date), "yyyy-MM-dd") : "");

            setError(null);
            setAttendeeError(null);
        }
    }, [open, reservation]);

    // Handle date/time logic similar to NewReservationDialog
    const handleAllDayToggle = (checked: boolean) => {
        setAllDay(checked);
        if (checked) {
            setEndTime("23:59");
            if (startDate) {
                setEndDate(startDate);
            }
        }
    };

    const handleStartTimeChange = (value: string) => {
        setStartTime(value);
        if (allDay) return;
        if (startDate && endDate && startDate === endDate && endTime && value > endTime) {
            setEndTime(value);
        }
    };

    const handleEndTimeChange = (value: string) => {
        if (startDate && endDate && startDate === endDate && startTime && value < startTime) {
            return;
        }
        setEndTime(value);
    };

    const handleStartDateChange = (value: string) => {
        setStartDate(value);
        if (allDay) {
            setEndDate(value);
        }
        if (endDate && value > endDate) {
            setEndDate(value);
        }
        if (endDate === value && startTime && endTime && startTime > endTime) {
            setEndTime(startTime);
        }
    };

    const handleEndDateChange = (value: string) => {
        setEndDate(value);
        if (value === startDate && startTime && endTime && endTime < startTime) {
            setEndTime(startTime);
        }
    };

    const handleTagToggle = (tag: string) => {
        setSelectedTags((prev) =>
            prev.includes(tag)
                ? []
                : [tag]
        );
    };

    const isValidEmail = (email: string) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    const addAttendee = () => {
        const email = attendeeInput.trim().toLowerCase();
        setAttendeeError(null);

        if (!email) return;

        if (!isValidEmail(email)) {
            setAttendeeError("Geçerli bir email adresi girin");
            return;
        }

        if (attendees.includes(email)) {
            setAttendeeError("Bu email zaten eklenmiş");
            return;
        }

        setAttendees([...attendees, email]);
        setAttendeeInput("");
    };

    const removeAttendee = (email: string) => {
        setAttendees(attendees.filter((e) => e !== email));
    };

    const handleSubmit = async () => {
        if (!title.trim()) {
            setError("Başlık gereklidir.");
            return;
        }

        if (!roomId) {
            setError("Lütfen bir oda seçin.");
            return;
        }

        if (!startDate || !startTime || !endDate || !endTime) {
            setError("Tarih ve saat bilgileri gereklidir.");
            return;
        }

        const startLocal = new Date(`${startDate}T${startTime}:00`);
        const endLocal = new Date(`${endDate}T${endTime}:00`);

        if (endLocal <= startLocal) {
            setError("Bitiş zamanı başlangıç zamanından sonra olmalıdır.");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const result = await updateReservation({
                id: reservation.id,
                title: title.trim(),
                description: description?.trim() || undefined,
                startTime: startLocal.toISOString(),
                endTime: endLocal.toISOString(),
                roomId,
                attendees: attendees.length > 0 ? attendees : [],
                cateringRequested,
                tags: selectedTags,
                recurrencePattern,
                recurrenceEndType,
                recurrenceCount: recurrenceEndType === "count" ? recurrenceCount : undefined,
                recurrenceEndDate: recurrenceEndType === "date" ? recurrenceEndDate : undefined,
            });

            if (!result.success) {
                setError(result.error || "Rezervasyon güncellenemedi.");
                toast.error(result.error || "Rezervasyon güncellenemedi.");
                return;
            }

            toast.success("Rezervasyon başarıyla güncellendi!");
            setOpen(false);
            router.refresh();
            onSuccess?.();
        } catch {
            setError("Beklenmeyen bir hata oluştu.");
            toast.error("Beklenmeyen bir hata oluştu.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm">
                        <Pencil className="h-4 w-4 mr-1" />
                        Düzenle
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Rezervasyonu Düzenle</DialogTitle>
                    <DialogDescription>
                        Rezervasyon bilgilerini güncelleyin.
                    </DialogDescription>
                </DialogHeader>

                <div className="max-h-[70vh] overflow-y-auto p-1 space-y-3">
                    {error && (
                        <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                            {error}
                        </div>
                    )}

                    {/* Title */}
                    <div className="space-y-2">
                        <Label htmlFor="edit-title">Başlık *</Label>
                        <Input
                            id="edit-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Toplantı başlığını girin"
                        />
                    </div>

                    {/* Tags */}
                    <div className="space-y-2">
                        <Label>Etiketler (Büyük Etkinlikler)</Label>
                        <div className="flex flex-col space-y-2 rounded-md border p-3">
                            {BIG_EVENT_TAGS.map((tag) => (
                                <div key={tag} className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        id={`edit-tag-${tag}`}
                                        name="edit-big-event-tag"
                                        checked={selectedTags.includes(tag)}
                                        onChange={() => handleTagToggle(tag)}
                                        className="h-4 w-4 text-primary border-gray-300 focus:ring-primary"
                                    />
                                    <Label htmlFor={`edit-tag-${tag}`} className="font-normal cursor-pointer">
                                        {tag}
                                    </Label>
                                </div>
                            ))}
                            {selectedTags.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setSelectedTags([])}
                                    className="text-xs text-muted-foreground hover:text-destructive underline self-start mt-1"
                                >
                                    Seçimi Kaldır
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Room */}
                    <div className="space-y-2">
                        <Label htmlFor="edit-room">Oda *</Label>
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

                    {/* Date/Time Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-startDate">Başlangıç Tarihi *</Label>
                            <Input
                                id="edit-startDate"
                                type="date"
                                value={startDate}
                                onChange={(e) => handleStartDateChange(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-startTime">Başlangıç Saati *</Label>
                            <Input
                                id="edit-startTime"
                                type="time"
                                value={startTime}
                                onChange={(e) => handleStartTimeChange(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-endDate">Bitiş Tarihi *</Label>
                            <Input
                                id="edit-endDate"
                                type="date"
                                value={endDate}
                                onChange={(e) => handleEndDateChange(e.target.value)}
                                min={startDate}
                                disabled={allDay}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-endTime">Bitiş Saati *</Label>
                            <Input
                                id="edit-endTime"
                                type="time"
                                value={endTime}
                                onChange={(e) => handleEndTimeChange(e.target.value)}
                                min={startDate === endDate ? startTime : undefined}
                                disabled={allDay}
                            />
                        </div>
                    </div>

                    {/* All Day */}
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="edit-allDay"
                            checked={allDay}
                            onCheckedChange={(checked) => handleAllDayToggle(checked === true)}
                        />
                        <Label htmlFor="edit-allDay" className="font-normal cursor-pointer">
                            Tüm gün (başlangıç saatinden gün sonuna kadar)
                        </Label>
                    </div>

                    {/* Recurrence - Outlook Style */}
                    <div className="space-y-3">
                        <Label htmlFor="edit-recurrence">Tekrarla</Label>
                        <Select
                            value={recurrencePattern}
                            onValueChange={(value: any) => {
                                setRecurrencePattern(value);
                                if (value === "none") setRecurrenceEndType("never");
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Tekrar seçin" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Tekrarlanmıyor</SelectItem>
                                <SelectItem value="daily">Her Gün</SelectItem>
                                <SelectItem value="weekly">Her Hafta</SelectItem>
                                <SelectItem value="biweekly">İki Haftada Bir</SelectItem>
                                <SelectItem value="monthly">Her Ay</SelectItem>
                            </SelectContent>
                        </Select>

                        {recurrencePattern !== "none" && (
                            <div className="space-y-3 p-3 border rounded-md bg-muted/30">
                                <Label className="text-sm font-medium">Bitiş Koşulu</Label>
                                <div className="flex flex-col space-y-2">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="radio"
                                            id="edit-endType-never"
                                            name="edit-recurrence-end"
                                            checked={recurrenceEndType === "never"}
                                            onChange={() => setRecurrenceEndType("never")}
                                            className="h-4 w-4"
                                        />
                                        <Label htmlFor="edit-endType-never" className="font-normal cursor-pointer">
                                            Bitiş tarihi yok (süresiz)
                                        </Label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="radio"
                                            id="edit-endType-count"
                                            name="edit-recurrence-end"
                                            checked={recurrenceEndType === "count"}
                                            onChange={() => setRecurrenceEndType("count")}
                                            className="h-4 w-4"
                                        />
                                        <Label htmlFor="edit-endType-count" className="font-normal cursor-pointer">
                                            Tekrar sayısı:
                                        </Label>
                                        <Input
                                            type="number"
                                            min={2}
                                            max={52}
                                            value={recurrenceCount}
                                            onChange={(e) => setRecurrenceCount(Math.min(52, Math.max(2, parseInt(e.target.value) || 4)))}
                                            disabled={recurrenceEndType !== "count"}
                                            className="w-20 h-8"
                                        />
                                        <span className="text-sm text-muted-foreground">kez</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="radio"
                                            id="edit-endType-date"
                                            name="edit-recurrence-end"
                                            checked={recurrenceEndType === "date"}
                                            onChange={() => setRecurrenceEndType("date")}
                                            className="h-4 w-4"
                                        />
                                        <Label htmlFor="edit-endType-date" className="font-normal cursor-pointer">
                                            Bitiş tarihi:
                                        </Label>
                                        <Input
                                            type="date"
                                            value={recurrenceEndDate}
                                            onChange={(e) => setRecurrenceEndDate(e.target.value)}
                                            min={startDate}
                                            disabled={recurrenceEndType !== "date"}
                                            className="w-40 h-8"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Attorneys */}
                    <div className="space-y-2">
                        <Label>Katılımcılar</Label>
                        <div className="flex gap-2">
                            <Input
                                type="email"
                                placeholder="ornek@email.com"
                                value={attendeeInput}
                                onChange={(e) => {
                                    setAttendeeInput(e.target.value);
                                    setAttendeeError(null);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        addAttendee();
                                    }
                                }}
                                className={attendeeError ? "border-destructive" : ""}
                            />
                            <Button type="button" variant="outline" size="icon" onClick={addAttendee}>
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                        {attendeeError && (
                            <p className="text-xs text-destructive">{attendeeError}</p>
                        )}
                        {attendees.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {attendees.map((email) => (
                                    <div
                                        key={email}
                                        className="flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-sm"
                                    >
                                        <Mail className="h-3 w-3" />
                                        <span className="max-w-[180px] truncate">{email}</span>
                                        <button
                                            type="button"
                                            onClick={() => removeAttendee(email)}
                                            className="ml-1 hover:text-destructive"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Description (Rich Text) */}
                    <div className="space-y-2">
                        <Label>Açıklama</Label>
                        <RichTextEditor
                            value={description}
                            onChange={setDescription}
                            placeholder="Program detayları, katılımcı listesi, görseller ekleyebilirsiniz (opsiyonel)"
                        />
                    </div>

                    {/* Catering */}
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="edit-catering"
                            checked={cateringRequested}
                            onCheckedChange={(checked) => setCateringRequested(checked === true)}
                        />
                        <Label htmlFor="edit-catering" className="font-normal cursor-pointer">
                            İkram talep ediyorum
                        </Label>
                    </div>
                </div>

                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
                        İptal
                    </Button>
                    <Button onClick={handleSubmit} disabled={isLoading}>
                        {isLoading ? "Kaydediliyor..." : "Kaydet"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
