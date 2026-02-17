"use client";

import { Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TimeContext } from "@/lib/concierge";

export interface ConciergeFilterState {
  timeContext: TimeContext | "today";
  radius: "near" | "city" | "all";
  typeGroup: "food_drink" | "culture" | "outdoors" | "all";
}

const TIME_OPTIONS: { value: ConciergeFilterState["timeContext"]; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "weekday", label: "Weekdays" },
  { value: "weekend", label: "Weekend (Fri–Sat)" },
  { value: "sunday", label: "Sunday only" },
];

const RADIUS_OPTIONS: { value: ConciergeFilterState["radius"]; label: string }[] = [
  { value: "all", label: "Any" },
  { value: "near", label: "Near me" },
  { value: "city", label: "Whole city" },
];

const TYPE_OPTIONS: { value: ConciergeFilterState["typeGroup"]; label: string }[] = [
  { value: "all", label: "All" },
  { value: "food_drink", label: "Food & drink" },
  { value: "culture", label: "Culture" },
  { value: "outdoors", label: "Outdoors" },
];

interface ConciergeFilterSheetProps {
  open: boolean;
  onClose: () => void;
  filters: ConciergeFilterState;
  onFiltersChange: (f: ConciergeFilterState) => void;
  onApply: () => void;
}

export function ConciergeFilterSheet({
  open,
  onClose,
  filters,
  onFiltersChange,
  onApply,
}: ConciergeFilterSheetProps) {
  if (!open) return null;

  const appliedCount = [
    filters.timeContext !== "today",
    filters.radius !== "all",
    filters.typeGroup !== "all",
  ].filter(Boolean).length;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-[min(320px,100%)] bg-background border-l shadow-xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-muted-foreground" />
            <h2 className="font-semibold">Concierge filters</h2>
          </div>
          <button type="button" onClick={onClose} className="p-2 -m-2 text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Day / Time</p>
            <div className="flex flex-wrap gap-2">
              {TIME_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => onFiltersChange({ ...filters, timeContext: o.value })}
                  className={cn(
                    "text-sm font-medium px-3 py-1.5 rounded-full transition-colors",
                    filters.timeContext === o.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Radius</p>
            <div className="flex flex-wrap gap-2">
              {RADIUS_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => onFiltersChange({ ...filters, radius: o.value })}
                  className={cn(
                    "text-sm font-medium px-3 py-1.5 rounded-full transition-colors",
                    filters.radius === o.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Type</p>
            <div className="flex flex-wrap gap-2">
              {TYPE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => onFiltersChange({ ...filters, typeGroup: o.value })}
                  className={cn(
                    "text-sm font-medium px-3 py-1.5 rounded-full transition-colors",
                    filters.typeGroup === o.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="p-4 border-t">
          <button
            type="button"
            onClick={() => { onApply(); onClose(); }}
            className="w-full rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Apply {appliedCount > 0 ? `(${appliedCount})` : ""}
          </button>
        </div>
      </div>
    </>
  );
}
