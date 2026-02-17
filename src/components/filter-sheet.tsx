"use client";

/**
 * Filter panel — Option B: side panel (drawer from right).
 * Type uses hierarchical groups: coarse group → subtypes.
 */
import { useState, useEffect } from "react";
import { Filter, X, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const NEIGHBORHOODS = [
  "all", "Palermo", "Recoleta", "San Telmo", "La Boca", "Belgrano",
  "Villa Crespo", "Puerto Madero", "Microcentro", "Colegiales", "Nuñez",
  "Caballito", "Almagro", "Retiro", "Monserrat", "San Nicolás", "Balvanera",
  "Boedo", "Barracas", "Constitución", "Flores",
] as const;
export const VIBES = ["all", "solo_friendly", "group_friendly", "date_night", "lively", "touristy", "local", "hidden_gem", "local_favorite"] as const;

export const TYPE_GROUPS: { id: string; label: string; types: string[] }[] = [
  { id: "restaurants", label: "Restaurants", types: ["parrilla", "heladeria", "brunch", "cajun", "po_boy", "restaurant"] },
  { id: "bars", label: "Bars", types: ["cocktail_bar", "rooftop", "tango_bar", "wine_bar", "jazz_bar", "music_venue", "night_club"] },
  { id: "cafes", label: "Cafés", types: ["cafe"] },
  { id: "museums", label: "Museums", types: ["museum"] },
  { id: "outdoors", label: "Outdoors", types: ["park", "waterfront"] },
  { id: "culture", label: "Culture", types: ["theater", "historical_place", "bookstore"] },
  { id: "other", label: "Other", types: ["kids_activities", "tours"] },
];

export const CATEGORIES = [
  "all",
  ...TYPE_GROUPS.flatMap((g) => g.types),
] as string[];

export function formatFilterLabel(s: string) {
  return s === "all" ? "All" : s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface FilterState {
  category: string;
  neighborhood: string;
  vibe: string;
}

interface FilterSheetProps {
  open: boolean;
  onClose: () => void;
  filters: FilterState;
  onFiltersChange: (f: FilterState) => void;
  onApply: () => void;
  /** Number of results for current sheet filters (computed by parent) */
  resultsCount: number;
  /** User's preferred neighborhoods — adds "Your neighborhood" option */
  preferredNeighborhoods?: string[];
  /** Neighborhoods for Area filter. From DB + highlights. When omitted, uses hardcoded NEIGHBORHOODS. */
  neighborhoods?: string[];
}

function ChipRow({
  options,
  value,
  onChange,
  label,
  formatLabel = formatFilterLabel,
}: {
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
  label: string;
  formatLabel?: (opt: string) => string;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={cn(
              "text-sm font-medium px-3 py-1.5 rounded-full transition-colors",
              value === opt
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {formatLabel(opt)}
          </button>
        ))}
      </div>
    </div>
  );
}

function getGroupForCategory(category: string): string | null {
  if (category === "all") return null;
  for (const g of TYPE_GROUPS) {
    if (g.types.includes(category)) return g.id;
  }
  return null;
}

export const YOUR_NEIGHBORHOOD = "__yours__";

export function FilterSheet({
  open,
  onClose,
  filters,
  onFiltersChange,
  onApply,
  resultsCount,
  preferredNeighborhoods = [],
  neighborhoods,
}: FilterSheetProps) {
  const baseNeighborhoods = neighborhoods ?? [...NEIGHBORHOODS].filter((n) => n !== "all");
  const neighborhoodOptions: string[] = preferredNeighborhoods.length > 0
    ? [YOUR_NEIGHBORHOOD, "all", ...baseNeighborhoods]
    : ["all", ...baseNeighborhoods];
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  useEffect(() => {
    if (open && filters.category !== "all") {
      setExpandedGroup(getGroupForCategory(filters.category));
    } else if (!open) {
      setExpandedGroup(null);
    }
  }, [open, filters.category]);

  const handleClear = () => {
    onFiltersChange({
      category: "all",
      neighborhood: "all",
      vibe: "all",
    });
    setExpandedGroup(null);
  };

  const handleApply = () => {
    onApply();
    onClose();
  };

  const handleGroupClick = (groupId: string) => {
    const wasExpanded = expandedGroup === groupId;
    setExpandedGroup((prev) => (prev === groupId ? null : groupId));
    if (!wasExpanded) {
      onFiltersChange({ ...filters, category: "all" });
    }
  };

  const handleSubtypeClick = (type: string) => {
    onFiltersChange({ ...filters, category: type });
  };

  return (
    <>
      {/* Backdrop — lighter so content remains visible behind */}
      <button
        type="button"
        aria-label="Close filters"
        className={cn(
          "fixed inset-0 z-40 bg-black/20 transition-opacity duration-200",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />
      {/* Side panel — slides in from right */}
      <div
        className={cn(
          "fixed right-0 top-0 bottom-0 z-50 w-72 sm:w-80 bg-background border-l shadow-xl flex flex-col transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="text-lg font-semibold">Filters</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -m-2 text-muted-foreground hover:text-foreground rounded-full"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
          {/* Type — hierarchical: groups with expandable subtypes */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Type</p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setExpandedGroup(null);
                  onFiltersChange({ ...filters, category: "all" });
                }}
                className={cn(
                  "flex w-full items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg transition-colors text-left",
                  filters.category === "all"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                All
              </button>
              {TYPE_GROUPS.map((group) => {
                const isExpanded = expandedGroup === group.id;
                const hasSelection =
                  filters.category !== "all" && group.types.includes(filters.category);
                return (
                  <div key={group.id}>
                    <button
                      type="button"
                      onClick={() => handleGroupClick(group.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 text-sm font-medium px-3 py-2 rounded-lg transition-colors text-left",
                        hasSelection
                          ? "bg-primary/10 text-primary"
                          : "bg-muted/50 text-muted-foreground hover:bg-muted"
                      )}
                    >
                      <span>{group.label}</span>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 shrink-0" />
                      )}
                    </button>
                    {isExpanded && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5 ml-3 pl-3 border-l-2 border-muted">
                        {group.types.map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => handleSubtypeClick(type)}
                            className={cn(
                              "text-sm font-medium px-3 py-1.5 rounded-full transition-colors",
                              filters.category === type
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground hover:bg-muted/80"
                            )}
                          >
                            {formatFilterLabel(type)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <ChipRow
            options={neighborhoodOptions as readonly string[]}
            value={filters.neighborhood}
            onChange={(n) => onFiltersChange({ ...filters, neighborhood: n })}
            label="Area"
            formatLabel={(opt) => opt === YOUR_NEIGHBORHOOD ? "Your neighborhood" : formatFilterLabel(opt)}
          />
          <ChipRow
            options={VIBES}
            value={filters.vibe}
            onChange={(v) => onFiltersChange({ ...filters, vibe: v })}
            label="Vibe"
          />
        </div>
        <div className="shrink-0 flex gap-2 px-4 py-3 border-t bg-background">
          <button
            type="button"
            onClick={handleClear}
            className="flex-1 py-2.5 rounded-lg border border-input text-sm font-medium hover:bg-muted/50"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            Show {resultsCount > 0 ? `${resultsCount} results` : "results"}
          </button>
        </div>
      </div>
    </>
  );
}

export function FilterPill({
  onClick,
  appliedCount,
}: {
  onClick: () => void;
  appliedCount: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border border-input bg-background hover:bg-muted/50 transition-colors"
    >
      <Filter className="w-4 h-4 text-muted-foreground" />
      <span>Filters</span>
      {appliedCount > 0 && (
        <span className="min-w-[1.25rem] h-5 flex items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-semibold">
          {appliedCount}
        </span>
      )}
    </button>
  );
}
