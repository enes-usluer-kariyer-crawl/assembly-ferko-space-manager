"use client";

import { ToolbarProps, Navigate, View } from "react-big-calendar";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function CalendarToolbar({ date, onNavigate, onView, view }: ToolbarProps<any, object>) {
  const goToBack = () => {
    onNavigate(Navigate.PREVIOUS);
  };

  const goToNext = () => {
    onNavigate(Navigate.NEXT);
  };

  const goToToday = () => {
    onNavigate(Navigate.TODAY);
  };

  // Format the date based on the current view
  const getLabel = () => {
    if (view === "month") {
      return format(date, "MMMM yyyy", { locale: tr });
    }
    if (view === "week") {
      return format(date, "MMMM yyyy", { locale: tr });
    }
    if (view === "day") {
      return format(date, "d MMMM yyyy, EEEE", { locale: tr });
    }
    return format(date, "MMMM yyyy", { locale: tr });
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 px-2">
      {/* Left side: Navigation */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={goToBack}
          className="h-9 w-9"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          onClick={goToToday}
          className="px-4"
        >
          Bugün
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={goToNext}
          className="h-9 w-9"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Center: Current date display */}
      <h2 className="text-2xl font-bold text-foreground capitalize order-first sm:order-none">
        {getLabel()}
      </h2>

      {/* Right side: View switcher */}
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
        <Button
          variant={view === "month" ? "default" : "ghost"}
          size="sm"
          onClick={() => onView("month" as View)}
          className="px-3"
        >
          Ay
        </Button>
        <Button
          variant={view === "week" ? "default" : "ghost"}
          size="sm"
          onClick={() => onView("week" as View)}
          className="px-3"
        >
          Hafta
        </Button>
        <Button
          variant={view === "day" ? "default" : "ghost"}
          size="sm"
          onClick={() => onView("day" as View)}
          className="px-3"
        >
          Gün
        </Button>
      </div>
    </div>
  );
}
