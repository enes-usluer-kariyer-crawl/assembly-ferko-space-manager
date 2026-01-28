"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cancelReservation } from "@/lib/actions/reservations";
import { Loader2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";

interface CancelReservationButtonProps {
  reservationId: string;
}

export function CancelReservationButton({ reservationId }: CancelReservationButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleConfirmCancel = async () => {
    setShowConfirmDialog(false);
    setIsLoading(true);
    try {
      const result = await cancelReservation(reservationId);
      if (!result.success) {
        toast.error(result.message || "Rezervasyon iptal edilirken bir hata oluştu.");
      } else {
        toast.success(result.message || "Rezervasyon başarıyla iptal edildi.");
      }
    } catch (error) {
      console.error("Cancel reservation error:", error);
      toast.error("Bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowConfirmDialog(true)}
        disabled={isLoading}
        className="text-red-600 hover:text-red-800 hover:bg-red-50 h-7 text-xs px-2"
      >
        {isLoading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
        İptal Et
      </Button>

      <ConfirmDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        title="Rezervasyonu İptal Et"
        description="Bu rezervasyonu iptal etmek istediğinize emin misiniz? Bu işlem geri alınamaz."
        confirmText="Evet, İptal Et"
        cancelText="Vazgeç"
        variant="destructive"
        onConfirm={handleConfirmCancel}
      />
    </>
  );
}