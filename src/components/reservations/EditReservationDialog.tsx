"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Pencil } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import { updateReservation } from "@/lib/actions/reservations";

type Room = {
    id: string;
    name: string;
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
    const [cateringRequested, setCateringRequested] = useState(
        reservation.catering_requested || false
    );
    const [attendees, setAttendees] = useState<string[]>(reservation.attendees || []);
    const [attendeeInput, setAttendeeInput] = useState("");

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
            setError(null);
        }
    }, [open, reservation]);

    const handleSubmit = async () => {
        if (!title.trim()) {
            setError("Başlık gereklidir.");
            return;
        }

        if (!startDate || !startTime || !endDate || !endTime) {
            setError("Tarih ve saat bilgileri gereklidir.");
            return;
        }

        const startDateTime = new Date(`${startDate}T${startTime}`);
        const endDateTime = new Date(`${endDate}T${endTime}`);

        if (endDateTime <= startDateTime) {
            setError("Bitiş zamanı başlangıç zamanından sonra olmalıdır.");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const result = await updateReservation({
                id: reservation.id,
                title: title.trim(),
                description: description.trim() || undefined,
                startTime: startDateTime.toISOString(),
                endTime: endDateTime.toISOString(),
                roomId,
                attendees: attendees.length > 0 ? attendees : undefined,
                cateringRequested,
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

    const addAttendee = () => {
        const email = attendeeInput.trim().toLowerCase();
        if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !attendees.includes(email)) {
            setAttendees([...attendees, email]);
            setAttendeeInput("");
        }
    };

    const removeAttendee = (email: string) => {
        setAttendees(attendees.filter((a) => a !== email));
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
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Rezervasyonu Düzenle</DialogTitle>
                    <DialogDescription>
                        Rezervasyon bilgilerini güncelleyin.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {error && (
                        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-200">
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
                            placeholder="Toplantı başlığı"
                        />
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
                                        {room.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Date/Time Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-start-date">Başlangıç Tarihi</Label>
                            <Input
                                id="edit-start-date"
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-start-time">Başlangıç Saati</Label>
                            <Input
                                id="edit-start-time"
                                type="time"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-end-date">Bitiş Tarihi</Label>
                            <Input
                                id="edit-end-date"
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                min={startDate}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-end-time">Bitiş Saati</Label>
                            <Input
                                id="edit-end-time"
                                type="time"
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="edit-description">Açıklama</Label>
                        <Textarea
                            id="edit-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Toplantı açıklaması (isteğe bağlı)"
                            rows={3}
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

                    {/* Attendees */}
                    <div className="space-y-2">
                        <Label>Katılımcılar</Label>
                        <div className="flex gap-2">
                            <Input
                                type="email"
                                placeholder="ornek@email.com"
                                value={attendeeInput}
                                onChange={(e) => setAttendeeInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        addAttendee();
                                    }
                                }}
                            />
                            <Button type="button" variant="secondary" onClick={addAttendee}>
                                Ekle
                            </Button>
                        </div>
                        {attendees.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {attendees.map((email) => (
                                    <span
                                        key={email}
                                        className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-muted rounded-full"
                                    >
                                        {email}
                                        <button
                                            type="button"
                                            onClick={() => removeAttendee(email)}
                                            className="hover:text-destructive"
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter>
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
