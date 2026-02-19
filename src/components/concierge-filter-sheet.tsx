"use client";

import { useTranslations } from "next-intl";
import { Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TimeFilter } from "@/lib/concierge";

export interface ConciergeFilterState {
  timeContext: TimeFilter;
  radius: "near" | "all";
  typeGroup: "food_drink" | "culture" | "outdoors" | "all";
  favoriteNeighborhoodsOnly: boolean;
}

/** CONCIERGE §6: Day/Time filters — labels from translations */
const TIME_OPTIONS: { value: TimeFilter; labelKey: string }[] = [
  { value: "today", labelKey: "today" },
  { value: "tonight", labelKey: "tonight" },
  { value: "this_week", labelKey: "thisWeek" },
  { value: "this_weekend", labelKey: "thisWeekend" },
];

const RADIUS_OPTIONS: { value: ConciergeFilterState["radius"]; labelKey: string }[] = [
  { value: "all", labelKey: "all" },
  { value: "near", labelKey: "nearMe" },
];

const TYPE_OPTIONS: { value: ConciergeFilterState["typeGroup"]; labelKey: string }[] = [
  { value: "all", labelKey: "all" },
  { value: "food_drink", labelKey: "foodDrink" },
  { value: "culture", labelKey: "culture" },
  { value: "outdoors", labelKey: "outdoors" },
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
  const t = useTranslations("conciergeFilters");

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
      <div className="fixed right-0 top-0 bottom-0 z-50 w-[min(320px,100%)] bg-surface border-l border-border-app shadow-card-soft flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border-app">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-muted-foreground" />
            <h2 className="font-semibold">{t("title")}</h2>
          </div>
          <button type="button" onClick={onClose} className="p-2 -m-2 text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">{t("dayTime")}</p>
            <div className="flex flex-wrap gap-2">
              {TIME_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => onFiltersChange({ ...filters, timeContext: o.value })}
                  className={cn(
                    "text-sm font-medium px-3 py-1.5 rounded-[10px] transition-colors touch-manipulation",
                    filters.timeContext === o.value ? "bg-tab-selected text-tab-selected-fg" : "bg-surface-alt text-muted-foreground hover:bg-surface hover:text-foreground"
                  )}
                >
                  {t(o.labelKey)}
                </button>
              ))}
            </div>
          </div>
          {hasFavoriteNeighborhoods && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">{t("area")}</p>
              <button
                type="button"
                onClick={() => onFiltersChange({ ...filters, favoriteNeighborhoodsOnly: !filters.favoriteNeighborhoodsOnly })}
                className={cn(
                  "text-sm font-medium px-3 py-1.5 rounded-[10px] transition-colors touch-manipulation",
                  filters.favoriteNeighborhoodsOnly ? "bg-tab-selected text-tab-selected-fg" : "bg-surface-alt text-muted-foreground hover:bg-surface hover:text-foreground"
                )}
              >
                {t("favoriteNeighborhoodsOnly")}
              </button>
            </div>
          )}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">{t("radius")}</p>
            <div className="flex flex-wrap gap-2">
              {RADIUS_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => onFiltersChange({ ...filters, radius: o.value })}
                  className={cn(
                    "text-sm font-medium px-3 py-1.5 rounded-[10px] transition-colors touch-manipulation",
                    filters.radius === o.value ? "bg-tab-selected text-tab-selected-fg" : "bg-surface-alt text-muted-foreground hover:bg-surface hover:text-foreground"
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">{t("type")}</p>
            <div className="flex flex-wrap gap-2">
              {TYPE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => onFiltersChange({ ...filters, typeGroup: o.value })}
                  className={cn(
                    "text-sm font-medium px-3 py-1.5 rounded-[10px] transition-colors touch-manipulation",
                    filters.typeGroup === o.value ? "bg-tab-selected text-tab-selected-fg" : "bg-surface-alt text-muted-foreground hover:bg-surface hover:text-foreground"
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-border-app">
          <button
            type="button"
            onClick={() => { onApply(); onClose(); }}
            className="w-full rounded-[14px] bg-accent-cyan py-3 text-sm font-medium text-white hover:bg-accent-cyan/90 transition-colors touch-manipulation"
          >
            {t("apply")} {appliedCount > 0 ? `(${appliedCount})` : ""}
          </button>
        </div>
      </div>
    </>
  );
}
