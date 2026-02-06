import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveReservations, getRooms } from "@/lib/actions/reservations";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Repeat, Pencil } from "lucide-react";
import { EditReservationDialog } from "@/components/reservations/EditReservationDialog";
import { CancelReservationButton } from "@/components/reservations/CancelReservationButton";
import { ApprovalActions } from "@/app/admin/approvals/ApprovalActions";

export default async function AdminReservationsPage() {
    const supabase = await createClient();

    // Get current user
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
        redirect("/");
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("is_admin, role")
        .eq("id", user.id)
        .single();

    const isAdmin = profile?.is_admin === true || profile?.role === "admin";

    if (profileError || !profile || !isAdmin) {
        redirect("/");
    }

    // Fetch active reservations and rooms
    const [reservationsResult, roomsResult] = await Promise.all([
        getActiveReservations(),
        getRooms(),
    ]);

    const reservations = reservationsResult.success ? reservationsResult.data ?? [] : [];
    const rooms = roomsResult.success ? roomsResult.data ?? [] : [];

    // Separate pending and approved
    const pendingReservations = reservations.filter((r) => r.status === "pending");
    const approvedReservations = reservations.filter((r) => r.status === "approved");

    return (
        <div className="min-h-screen bg-background p-6 font-[family-name:var(--font-geist-sans)]">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold">Rezervasyon Yönetimi</h1>
                        <p className="text-muted-foreground">
                            Tüm aktif rezervasyonları görüntüleyin ve düzenleyin
                        </p>
                    </div>
                    <Link href="/">
                        <Button variant="outline">Takvime Dön</Button>
                    </Link>
                </div>

                {/* Approved Reservations Table */}
                <div className="mb-8">
                    <h2 className="text-lg font-semibold mb-4">
                        Onaylı Rezervasyonlar ({approvedReservations.length})
                    </h2>

                    {approvedReservations.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground border rounded-lg">
                            Onaylı aktif rezervasyon bulunmuyor.
                        </div>
                    ) : (
                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-muted/50">
                                    <tr>
                                        <th className="text-left p-4 font-medium">Kullanıcı</th>
                                        <th className="text-left p-4 font-medium">Oda</th>
                                        <th className="text-left p-4 font-medium">Tarih / Saat</th>
                                        <th className="text-left p-4 font-medium">Başlık</th>
                                        <th className="text-left p-4 font-medium">Tekrar</th>
                                        <th className="text-left p-4 font-medium">Catering</th>
                                        <th className="text-left p-4 font-medium">İşlemler</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {approvedReservations.map((reservation) => (
                                        <tr key={reservation.id} className="hover:bg-muted/30">
                                            <td className="p-4">
                                                <div className="font-medium text-sm">
                                                    {reservation.profiles?.full_name || reservation.profiles?.email || "İsimsiz"}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {reservation.profiles?.email}
                                                </div>
                                            </td>
                                            <td className="p-4">{reservation.rooms?.name}</td>
                                            <td className="p-4">
                                                <div>
                                                    {format(new Date(reservation.start_time), "d MMMM yyyy", {
                                                        locale: tr,
                                                    })}
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    {format(new Date(reservation.start_time), "HH:mm")} -{" "}
                                                    {format(new Date(reservation.end_time), "HH:mm")}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="max-w-48 truncate" title={reservation.title}>
                                                    {reservation.title}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                {reservation.is_recurring ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                        <Repeat className="w-3 h-3" />
                                                        {reservation.recurrence_pattern === "daily"
                                                            ? "Günlük"
                                                            : reservation.recurrence_pattern === "weekly"
                                                                ? "Haftalık"
                                                                : reservation.recurrence_pattern === "biweekly"
                                                                    ? "2 Haftalık"
                                                                    : reservation.recurrence_pattern === "monthly"
                                                                        ? "Aylık"
                                                                        : "Evet"}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground">-</span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                {reservation.catering_requested ? (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                                        Evet
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground">Hayır</span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <EditReservationDialog
                                                        reservation={{
                                                            id: reservation.id,
                                                            title: reservation.title,
                                                            description: reservation.description,
                                                            start_time: reservation.start_time,
                                                            end_time: reservation.end_time,
                                                            room_id: rooms.find((r) => r.name === reservation.rooms?.name)?.id || "",
                                                            attendees: [],
                                                            catering_requested: reservation.catering_requested,
                                                        }}
                                                        rooms={rooms}
                                                        trigger={
                                                            <Button variant="outline" size="sm">
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                        }
                                                    />
                                                    <CancelReservationButton reservationId={reservation.id} />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Pending Reservations Table */}
                <div>
                    <h2 className="text-lg font-semibold mb-4">
                        Onay Bekleyenler ({pendingReservations.length})
                    </h2>

                    {pendingReservations.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground border rounded-lg">
                            Onay bekleyen rezervasyon bulunmuyor.
                        </div>
                    ) : (
                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-yellow-50">
                                    <tr>
                                        <th className="text-left p-4 font-medium">Kullanıcı</th>
                                        <th className="text-left p-4 font-medium">Oda</th>
                                        <th className="text-left p-4 font-medium">Tarih / Saat</th>
                                        <th className="text-left p-4 font-medium">Başlık</th>
                                        <th className="text-left p-4 font-medium">Tekrar</th>
                                        <th className="text-left p-4 font-medium">Catering</th>
                                        <th className="text-left p-4 font-medium">İşlemler</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {pendingReservations.map((reservation) => (
                                        <tr key={reservation.id} className="hover:bg-yellow-50/50">
                                            <td className="p-4">
                                                <div className="font-medium text-sm">
                                                    {reservation.profiles?.full_name || reservation.profiles?.email || "İsimsiz"}
                                                </div>
                                            </td>
                                            <td className="p-4">{reservation.rooms?.name}</td>
                                            <td className="p-4">
                                                <div>
                                                    {format(new Date(reservation.start_time), "d MMMM yyyy", {
                                                        locale: tr,
                                                    })}
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    {format(new Date(reservation.start_time), "HH:mm")} -{" "}
                                                    {format(new Date(reservation.end_time), "HH:mm")}
                                                </div>
                                            </td>
                                            <td className="p-4">{reservation.title}</td>
                                            <td className="p-4">
                                                {reservation.is_recurring ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                        <Repeat className="w-3 h-3" />
                                                        Evet
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground">-</span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                {reservation.catering_requested ? (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                                        Evet
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground">Hayır</span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <EditReservationDialog
                                                        reservation={{
                                                            id: reservation.id,
                                                            title: reservation.title,
                                                            description: reservation.description,
                                                            start_time: reservation.start_time,
                                                            end_time: reservation.end_time,
                                                            room_id: rooms.find((r) => r.name === reservation.rooms?.name)?.id || "",
                                                            attendees: [],
                                                            catering_requested: reservation.catering_requested,
                                                        }}
                                                        rooms={rooms}
                                                        trigger={
                                                            <Button variant="outline" size="sm">
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                        }
                                                    />
                                                    <ApprovalActions reservationId={reservation.id} />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
