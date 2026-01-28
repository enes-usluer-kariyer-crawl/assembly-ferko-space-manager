"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cancelReservation } from "@/lib/actions/reservations";
import { Loader2 } from "lucide-react";

interface CancelReservationButtonProps {
  reservationId: string;
}

export function CancelReservationButton({ reservationId }: CancelReservationButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleCancel = async () => {
    if (!confirm("Bu rezervasyonu iptal etmek istediğinize emin misiniz?")) {
      return;
    }

    setIsLoading(true);
    try {
      const result = await cancelReservation(reservationId);
      if (!result.success) {
        alert(result.message || "Rezervasyon iptal edilirken bir hata oluştu.");
      }
    } catch (error) {
      console.error("Cancel reservation error:", error);
      alert("Bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCancel}
      disabled={isLoading}
      className="text-red-600 hover:text-red-800 hover:bg-red-50 h-7 text-xs px-2"
    >
      {isLoading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
      İptal Et
    </Button>
  );
}
