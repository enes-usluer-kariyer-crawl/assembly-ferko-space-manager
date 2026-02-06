"use client";

import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { getReportStats, type ReportStats } from "@/lib/actions/reports";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
    CalendarDays,
    Clock,
    Users,
    Ban,
    GraduationCap,
    Building2,
    FileSpreadsheet,
    Filter,
    Loader2,
    RotateCcw
} from "lucide-react";
import { cn } from "@/lib/utils";

type ReportsClientProps = {
    rooms: { id: string; name: string }[];
    initialStats: ReportStats;
};

export function ReportsClient({ rooms, initialStats }: ReportsClientProps) {
    // Initialize dates relative to today
    // Default: Last 30 days
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7); // Show upcoming week by default
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const [dateRange, setDateRange] = useState({
        start: format(thirtyDaysAgo, "yyyy-MM-dd"), // Native date input value format
        end: format(nextWeek, "yyyy-MM-dd"),
    });

    const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
    const [stats, setStats] = useState<ReportStats>(initialStats);
    const [loading, setLoading] = useState(false);
    const [showFilters, setShowFilters] = useState(false);

    // Fetch updated stats when filters change
    // We skip the first run because initialStats is already populated
    // Ideally, valid dependencies are dateRange and selectedRooms
    // But to avoid double fetch on mount, we can use a ref or just rely on manual refresh/debounce
    // Simple useEffect is fine if we check against initial values
    // BUT: user expects instant interaction.

    // Let's create a "Uygula" (Apply) button or auto-fetch with debounce.
    // Auto-fetch is nicer.

    useEffect(() => {
        const fetchData = async () => {
            // Don't fetch if dates are invalid
            if (!dateRange.start || !dateRange.end) return;

            setLoading(true);
            try {
                const start = new Date(dateRange.start);
                const end = new Date(dateRange.end);
                // End date should include the full day
                end.setHours(23, 59, 59, 999);

                const data = await getReportStats({
                    startDate: start,
                    endDate: end,
                    roomIds: selectedRooms.length > 0 ? selectedRooms : undefined,
                });
                setStats(data);
            } catch (error) {
                console.error("Failed to fetch stats:", error);
            } finally {
                setLoading(false);
            }
        };

        // Debounce slightly to avoid rapid updates while typing date/checking boxes
        const timer = setTimeout(() => {
            // Avoid fetching if it matches the initial state (30 days, no rooms) to prevent duplicate first load?
            // Actually initial load is fine, duplicate fetch won't hurt much, but let's compare simple values
            // if needed. For now, just fetch.
            fetchData();
        }, 500);

        return () => clearTimeout(timer);
    }, [dateRange, selectedRooms]);

    const handleRoomToggle = (roomId: string) => {
        setSelectedRooms((prev) =>
            prev.includes(roomId)
                ? prev.filter((id) => id !== roomId)
                : [...prev, roomId]
        );
    };

    const handleResetFilters = () => {
        setDateRange({
            start: format(thirtyDaysAgo, "yyyy-MM-dd"),
            end: format(today, "yyyy-MM-dd"),
        });
        setSelectedRooms([]);
    };

    const handleDownloadExcel = () => {
        if (!stats) return;

        // 1. Summary Sheet
        const summaryData = [
            ["Rapor Dönemi", `${dateRange.start} - ${dateRange.end}`],
            ["Oluşturulma Tarihi", new Date().toLocaleString("tr-TR")],
            [],
            ["Özet Metrikler", "Değer"],
            ["Toplam Rezervasyon", stats.totalReservations],
            ["Onaylanan", stats.approvedCount],
            ["İptal/Ret", stats.cancelledCount],
            ["İptal Oranı", stats.totalReservations > 0 ? `%${((stats.cancelledCount / stats.totalReservations) * 100).toFixed(1)}` : "%0"],
            ["Toplam Kullanım (Saat)", stats.totalHours.toFixed(1)],
            ["Aktif Kullanıcı Sayısı", Object.keys(stats.byUser).length],
            ["Şirket Etkinlikleri", stats.companyEventCount],
            ["Üniversite Etkinlikleri", stats.universityEventCount],
            ["Exco Toplantıları", stats.excoEventCount],
        ];

        const wb = XLSX.utils.book_new();
        const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, wsSummary, "Genel Özet");

        // 2. Room Usage Sheet
        const roomData = [
            ["Oda Adı", "Rezervasyon Sayısı", "Toplam Süre (Saat)", "Doluluk Payı"],
            ...Object.values(stats.byRoom).map((r) => [
                r.name,
                r.count,
                r.hours.toFixed(1),
                stats.totalHours > 0 ? `%${((r.hours / stats.totalHours) * 100).toFixed(1)}` : "%0",
            ]),
        ];
        const wsRooms = XLSX.utils.aoa_to_sheet(roomData);
        XLSX.utils.book_append_sheet(wb, wsRooms, "Oda Kullanımı");

        // 3. User Sheet
        const userData = [
            ["Kullanıcı Adı", "E-posta", "Rezervasyon Sayısı", "Toplam Süre (Saat)"],
            ...Object.values(stats.byUser).map((u) => [
                u.name,
                u.email,
                u.count,
                u.hours.toFixed(1),
            ]),
        ];
        const wsUsers = XLSX.utils.aoa_to_sheet(userData);
        XLSX.utils.book_append_sheet(wb, wsUsers, "Kullanıcı İstatistikleri");

        // 4. Detailed Reservations
        const detailsData = [
            ["ID", "Başlık", "Oda", "Başlangıç Tarihi", "Bitiş Tarihi", "Talep Eden", "Email", "Durum", "Etkinlik Tipi", "Tekrar", "İkram"],
            ...(stats.allReservations?.map((r: any) => [
                r.id,
                r.title,
                r.room?.name || "Silinmiş Oda",
                new Date(r.start_time).toLocaleString("tr-TR"),
                new Date(r.end_time).toLocaleString("tr-TR"),
                r.user?.full_name || "Bilinmiyor",
                r.user?.email || "",
                r.status,
                r.tags?.includes("Üniversite Etkinliği") ? "Üniversite" :
                    r.tags?.includes("Exco Toplantısı") ? "Exco" :
                        (r.tags && r.tags.length > 0) ? "Şirket/Diğer" : "Standart",
                r.is_recurring ? "Evet" : "Hayır",
                r.catering_requested ? "Evet" : "Hayır"
            ]) || [])
        ];
        const wsDetails = XLSX.utils.aoa_to_sheet(detailsData);
        XLSX.utils.book_append_sheet(wb, wsDetails, "Tüm Rezervasyonlar");

        XLSX.writeFile(wb, `Rapor_${dateRange.start}_${dateRange.end}.xlsx`);
    };

    // Prepare view data
    const roomStats = Object.values(stats.byRoom).sort((a, b) => b.hours - a.hours);
    const userStats = Object.values(stats.byUser).sort((a, b) => b.count - a.count).slice(0, 10);

    return (
        <div className="flex-1 space-y-8 p-8 pt-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Raporlar ve İstatistikler</h2>
                    <div className="text-sm text-muted-foreground mt-1">
                        Sistemin kullanım verilerini analiz edin ve excel olarak indirin.
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={() => setShowFilters(!showFilters)}
                        className="gap-2"
                    >
                        <Filter className="h-4 w-4" />
                        {showFilters ? "Filtreleri Gizle" : "Filtrele"}
                    </Button>
                    <Button
                        onClick={handleDownloadExcel}
                        className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                    >
                        <FileSpreadsheet className="h-4 w-4" />
                        Excel İndir
                    </Button>
                </div>
            </div>

            {/* Filters Panel */}
            {showFilters && (
                <div className="bg-card border rounded-lg p-4 grid gap-6 md:grid-cols-2 lg:grid-cols-3 shadow-sm animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-3">
                        <Label>Tarih Aralığı</Label>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <span className="text-xs text-muted-foreground">Başlangıç</span>
                                <Input
                                    type="date"
                                    value={dateRange.start}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs text-muted-foreground">Bitiş</span>
                                <Input
                                    type="date"
                                    value={dateRange.end}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 lg:col-span-2">
                        <div className="flex items-center justify-between">
                            <Label>Odalar</Label>
                            <button
                                onClick={() => setSelectedRooms([])}
                                className="text-xs text-muted-foreground hover:text-primary underline"
                            >
                                Temizle
                            </button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[120px] overflow-y-auto p-1 border rounded-md">
                            {rooms.map(room => (
                                <div key={room.id} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={`room-${room.id}`}
                                        checked={selectedRooms.includes(room.id)}
                                        onCheckedChange={() => handleRoomToggle(room.id)}
                                    />
                                    <label
                                        htmlFor={`room-${room.id}`}
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                    >
                                        {room.name}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-end md:col-span-2 lg:col-span-3 justify-end">
                        {loading && <span className="text-sm text-muted-foreground mr-2 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Güncelleniyor...</span>}
                        <Button variant="ghost" size="sm" onClick={handleResetFilters}>
                            <RotateCcw className="h-3 w-3 mr-1" /> Sıfırla
                        </Button>
                    </div>
                </div>
            )}

            {/* KPI Cards */}
            <div className={cn("grid gap-4 md:grid-cols-2 lg:grid-cols-5", loading && "opacity-60 pointer-events-none transition-opacity")}>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Toplam Rezervasyon</CardTitle>
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalReservations}</div>
                        <p className="text-xs text-muted-foreground">
                            {stats.approvedCount} Onaylı, {stats.cancelledCount} İptal/Ret
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Toplam Kullanım</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalHours.toFixed(1)} Saat</div>
                        <p className="text-xs text-muted-foreground">
                            Oda doluluk süresi
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Aktif Kullanıcılar</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{Object.keys(stats.byUser).length}</div>
                        <p className="text-xs text-muted-foreground">
                            Rezervasyon yapan kişi sayısı
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">İptal Oranı</CardTitle>
                        <Ban className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {stats.totalReservations > 0
                                ? ((stats.cancelledCount / stats.totalReservations) * 100).toFixed(1)
                                : 0}%
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Tüm talepler içinde
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Etkinlik Dağılımı</CardTitle>
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.companyEventCount + stats.universityEventCount + stats.excoEventCount}</div>
                        <div className="text-xs text-muted-foreground space-y-1 mt-1">
                            <div className="flex justify-between items-center">
                                <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> Şirket:</span>
                                <span className="font-medium">{stats.companyEventCount}</span>
                            </div>
                            {/* Exco is excluded from Company count but shown here if exists */}
                            {stats.excoEventCount > 0 && (
                                <div className="flex justify-between items-center text-amber-600">
                                    <span className="flex items-center gap-1">Exco:</span>
                                    <span className="font-medium">{stats.excoEventCount}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center">
                                <span className="flex items-center gap-1"><GraduationCap className="h-3 w-3" /> Üniversite:</span>
                                <span className="font-medium">{stats.universityEventCount}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className={cn("grid gap-4 md:grid-cols-2 lg:grid-cols-7", loading && "opacity-60 pointer-events-none")}>
                {/* Room Stats */}
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Oda Kullanım İstatistikleri</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="relative w-full overflow-auto">
                            <table className="w-full caption-bottom text-sm">
                                <thead className="[&_tr]:border-b">
                                    <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                        <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Oda Adı</th>
                                        <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Sayı</th>
                                        <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Süre (Saat)</th>
                                        <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Doluluk</th>
                                    </tr>
                                </thead>
                                <tbody className="[&_tr:last-child]:border-0">
                                    {roomStats.map((room) => (
                                        <tr key={room.name} className="border-b transition-colors hover:bg-muted/50">
                                            <td className="p-4 align-middle font-medium">{room.name}</td>
                                            <td className="p-4 align-middle text-right">{room.count}</td>
                                            <td className="p-4 align-middle text-right">{room.hours.toFixed(1)}</td>
                                            <td className="p-4 align-middle text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <span className="text-xs text-muted-foreground">
                                                        {stats.totalHours > 0 ? ((room.hours / stats.totalHours) * 100).toFixed(1) : 0}%
                                                    </span>
                                                    <div className="h-2 w-16 overflow-hidden rounded-full bg-secondary">
                                                        <div
                                                            className="h-full bg-primary"
                                                            style={{ width: `${stats.totalHours > 0 ? (room.hours / stats.totalHours) * 100 : 0}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {roomStats.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="p-4 text-center text-muted-foreground">Veri bulunamadı</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {/* User Stats */}
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>En Aktif Kullanıcılar</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-8">
                            {userStats.length > 0 ? userStats.map((user) => (
                                <div key={user.email} className="flex items-center">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                                        <span className="text-xs font-medium">
                                            {user.name.charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="ml-4 space-y-1">
                                        <p className="text-sm font-medium leading-none">{user.name}</p>
                                        <p className="text-xs text-muted-foreground">{user.email}</p>
                                    </div>
                                    <div className="ml-auto font-medium">
                                        {user.count} Rez.
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-4 text-muted-foreground">Kullanıcı verisi bulunamadı</div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Activity Log */}
            <Card className={cn(loading && "opacity-60")}>
                <CardHeader>
                    <CardTitle>Aktivite Logu (Son İşlemler)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="relative w-full overflow-auto">
                        <table className="w-full caption-bottom text-sm">
                            <thead className="[&_tr]:border-b">
                                <tr className="border-b transition-colors hover:bg-muted/50">
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Kullanıcı</th>
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Oda</th>
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Başlık</th>
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Durum</th>
                                    <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Son İşlem Tarihi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.recentActivity && stats.recentActivity.length > 0 ? stats.recentActivity.map((activity: any) => (
                                    <tr key={activity.id} className="border-b transition-colors hover:bg-muted/50">
                                        <td className="p-4 align-middle">{activity.user?.full_name || activity.user?.email || "Bilinmeyen"}</td>
                                        <td className="p-4 align-middle">{activity.room?.name || "-"}</td>
                                        <td className="p-4 align-middle truncate max-w-[200px]">{activity.title}</td>
                                        <td className="p-4 align-middle">
                                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${activity.status === 'approved' ? 'bg-green-100 text-green-800' :
                                                activity.status === 'cancelled' || activity.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                                    'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                {activity.status === 'approved' ? 'Onaylandı' :
                                                    activity.status === 'pending' ? 'Bekliyor' :
                                                        activity.status === 'rejected' ? 'Reddedildi' : 'İptal'}
                                            </span>
                                        </td>
                                        <td className="p-4 align-middle text-right text-muted-foreground">
                                            {new Date(activity.updated_at || activity.created_at).toLocaleDateString('tr-TR')}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={5} className="p-4 text-center text-muted-foreground">Kayıt bulunamadı</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
