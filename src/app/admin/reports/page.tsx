import { getReportStats } from "@/lib/actions/reports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, Clock, Users, Ban, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const stats = await getReportStats(30); // Last 30 days default

  // Convert objects to arrays for sorting/display
  const roomStats = Object.values(stats.byRoom).sort((a, b) => b.hours - a.hours);
  const userStats = Object.values(stats.byUser).sort((a, b) => b.count - a.count).slice(0, 10); // Top 10 users

  return (
    <div className="flex-1 space-y-8 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Raporlar</h2>
        <div className="text-sm text-muted-foreground">
          Son 30 Günlük Veriler
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        
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
                    <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Rezervasyon Sayısı</th>
                    <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Toplam Süre (Saat)</th>
                    <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Doluluk Payı</th>
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
              {userStats.map((user) => (
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
              ))}
               {userStats.length === 0 && (
                 <div className="text-center text-muted-foreground">Veri bulunamadı</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Log (Condensed) */}
       <Card>
          <CardHeader>
            <CardTitle>Son Aktiviteler</CardTitle>
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
                    <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Tarih</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentActivity.map((activity) => (
                    <tr key={activity.id} className="border-b transition-colors hover:bg-muted/50">
                      <td className="p-4 align-middle">{activity.user?.full_name || activity.user?.email}</td>
                      <td className="p-4 align-middle">{activity.room?.name}</td>
                      <td className="p-4 align-middle truncate max-w-[200px]">{activity.title}</td>
                      <td className="p-4 align-middle">
                         <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                            activity.status === 'approved' ? 'bg-green-100 text-green-800' :
                            activity.status === 'cancelled' || activity.status === 'rejected' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                         }`}>
                           {activity.status === 'approved' ? 'Onaylandı' : 
                            activity.status === 'pending' ? 'Bekliyor' :
                            activity.status === 'rejected' ? 'Reddedildi' : 'İptal'}
                         </span>
                      </td>
                      <td className="p-4 align-middle text-right text-muted-foreground">
                        {new Date(activity.created_at).toLocaleDateString('tr-TR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
    </div>
  );
}
