"use client";

import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditReservationDialog } from "./EditReservationDialog";
import { Room } from "@/lib/actions/reservations";

type EditButtonProps = {
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
};

export function EditReservationButton({ reservation, rooms }: EditButtonProps) {
    return (
        <EditReservationDialog
            reservation={reservation}
            rooms={rooms}
            trigger={
                <Button variant="outline" size="sm">
                    <Pencil className="h-4 w-4 mr-1" />
                    Düzenle
                </Button>
            }
        />
    );
}
