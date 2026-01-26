import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPendingReservations, updateReservationStatus } from "@/lib/actions/reservations";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import Link from "next/link";

async function ApprovalActions({ reservationId }: { reservationId: string }) {
  async function approveAction() {
    "use server";
    await updateReservationStatus(reservationId, "approved");
  }

  async function rejectAction() {
    "use server";
    await updateReservationStatus(reservationId, "rejected");
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
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "admin") {
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
                  <th className="text-left p-4 font-medium">Catering</th>
                  <th className="text-left p-4 font-medium">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pendingReservations.map((reservation) => (
                  <tr key={reservation.id} className="hover:bg-muted/30">
                    <td className="p-4">
                      <div className="font-medium">
                        {reservation.profiles.full_name || "İsimsiz"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {reservation.profiles.email}
                      </div>
                    </td>
                    <td className="p-4">{reservation.rooms.name}</td>
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
