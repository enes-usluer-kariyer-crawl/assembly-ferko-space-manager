import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPendingReservations, updateReservationStatus } from "@/lib/actions/reservations";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Repeat } from "lucide-react";
import { revalidatePath } from "next/cache";

async function ApprovalActions({ reservationId }: { reservationId: string }) {
  async function approveAction() {
    "use server";
    const result = await updateReservationStatus(reservationId, "approved");
    if (!result.success) {
      console.error("Onaylama hatası:", result.error);
    }
    revalidatePath("/admin/approvals");
    redirect("/admin/approvals");
  }

  async function rejectAction() {
    "use server";
    const result = await updateReservationStatus(reservationId, "rejected");
    if (!result.success) {
      console.error("Reddetme hatası:", result.error);
    }
    revalidatePath("/admin/approvals");
    redirect("/admin/approvals");
  }

  return (
    <div className="flex gap-2">
      <form action={approveAction}>
        <Button type="submit" size="sm" className="bg-green-600 hover:bg-green-700">
          Onayla
        </Button>
      </form>
      <form action={rejectAction}>
        <Button type="submit" size="sm" variant="destructive">
          Reddet
        </Button>
      </form>
    </div>
  );
}

export default async function AdminApprovalsPage() {
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

  // Fetch pending reservations
  const result = await getPendingReservations();
  const pendingReservations = result.success ? result.data ?? [] : [];

  return (
    <div className="min-h-screen bg-background p-6 font-[family-name:var(--font-geist-sans)]">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Onay Bekleyen Rezervasyonlar</h1>
          <Link href="/">
            <Button variant="outline">Takvime Dön</Button>
          </Link>
        </div>

        {pendingReservations.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Onay bekleyen rezervasyon bulunmuyor.
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
                {pendingReservations.map((reservation) => (
                  <tr key={reservation.id} className="hover:bg-muted/30">
                    <td className="p-4">
                      <div className="font-medium">
                        {reservation.profiles.email || reservation.profiles.full_name || "İsimsiz"}
                      </div>
                    </td>
                    <td className="p-4">{reservation.rooms.name}</td>
                    <td className="p-4">
                      <div>
                        {reservation.is_recurring && (
                          <span className="text-xs text-muted-foreground">İlk: </span>
                        )}
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
                          Her Hafta
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
                      <ApprovalActions reservationId={reservation.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
