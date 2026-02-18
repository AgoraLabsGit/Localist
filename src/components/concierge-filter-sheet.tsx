"use client";

import { Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TimeFilter } from "@/lib/concierge";

export interface ConciergeFilterState {
  timeContext: TimeFilter;
  radius: "near" | "all";
  typeGroup: "food_drink" | "culture" | "outdoors" | "all";
  favoriteNeighborhoodsOnly: boolean;
}

/** CONCIERGE §6: Day/Time filters */
const TIME_OPTIONS: { value: TimeFilter; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "tonight", label: "Tonight" },
  { value: "this_week", label: "This week" },
  { value: "this_weekend", label: "This weekend" },
];

const RADIUS_OPTIONS: { value: ConciergeFilterState["radius"]; label: string }[] = [
  { value: "all", label: "All" },
  { value: "near", label: "Near me" },
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
  hasFavoriteNeighborhoods?: boolean;
}

export function ConciergeFilterSheet({
  open,
  onClose,
  filters,
  onFiltersChange,
  onApply,
  hasFavoriteNeighborhoods = false,
}: ConciergeFilterSheetProps) {
  if (!open) return null;

  const appliedCount = [
    filters.timeContext !== "today",
    filters.radius !== "all",
    filters.typeGroup !== "all",
    filters.favoriteNeighborhoodsOnly,
  ].filter(Boolean).length;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-[min(320px,100%)] bg-surface border-l border-[rgba(148,163,184,0.25)] shadow-card-soft flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[rgba(148,163,184,0.25)]">
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
                    "text-sm font-medium px-3 py-1.5 rounded-[10px] transition-colors touch-manipulation",
                    filters.timeContext === o.value ? "bg-tab-selected text-[#E5E7EB]" : "bg-surface-alt text-muted-foreground hover:bg-surface hover:text-foreground"
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          {hasFavoriteNeighborhoods && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Area</p>
              <button
                type="button"
                onClick={() => onFiltersChange({ ...filters, favoriteNeighborhoodsOnly: !filters.favoriteNeighborhoodsOnly })}
                className={cn(
                  "text-sm font-medium px-3 py-1.5 rounded-[10px] transition-colors touch-manipulation",
                  filters.favoriteNeighborhoodsOnly ? "bg-tab-selected text-[#E5E7EB]" : "bg-surface-alt text-muted-foreground hover:bg-surface hover:text-foreground"
                )}
              >
                Favorite neighborhoods only
              </button>
            </div>
          )}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Radius</p>
            <div className="flex flex-wrap gap-2">
              {RADIUS_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => onFiltersChange({ ...filters, radius: o.value })}
                  className={cn(
                    "text-sm font-medium px-3 py-1.5 rounded-[10px] transition-colors touch-manipulation",
                    filters.radius === o.value ? "bg-tab-selected text-[#E5E7EB]" : "bg-surface-alt text-muted-foreground hover:bg-surface hover:text-foreground"
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
                    "text-sm font-medium px-3 py-1.5 rounded-[10px] transition-colors touch-manipulation",
                    filters.typeGroup === o.value ? "bg-tab-selected text-[#E5E7EB]" : "bg-surface-alt text-muted-foreground hover:bg-surface hover:text-foreground"
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-[rgba(148,163,184,0.25)]">
          <button
            type="button"
            onClick={() => { onApply(); onClose(); }}
            className="w-full rounded-[14px] bg-accent-cyan py-3 text-sm font-medium text-white hover:bg-accent-cyan/90 transition-colors touch-manipulation"
          >
            Apply {appliedCount > 0 ? `(${appliedCount})` : ""}
          </button>
        </div>
      </div>
    </>
  );
}
