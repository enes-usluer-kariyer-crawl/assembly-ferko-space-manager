"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { updateReservationStatus } from "@/lib/actions/reservations";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type ApprovalActionsProps = {
  reservationId: string;
};

export function ApprovalActions({ reservationId }: ApprovalActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleApprove = () => {
    startTransition(async () => {
      const result = await updateReservationStatus(reservationId, "approved");
      if (result.success) {
        toast.success("Rezervasyon onaylandı");
        router.refresh();
      } else {
        toast.error(result.error || "Onaylama başarısız");
      }
    });
  };

  const handleReject = () => {
    startTransition(async () => {
      const result = await updateReservationStatus(reservationId, "rejected");
      if (result.success) {
        toast.success("Rezervasyon reddedildi");
        router.refresh();
      } else {
        toast.error(result.error || "Reddetme başarısız");
      }
    });
  };

  return (
    <div className="flex gap-2">
      <Button
        onClick={handleApprove}
        disabled={isPending}
        size="sm"
        className="bg-green-600 hover:bg-green-700"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Onayla"}
      </Button>
      <Button
        onClick={handleReject}
        disabled={isPending}
        size="sm"
        variant="destructive"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reddet"}
      </Button>
    </div>
  );
}
