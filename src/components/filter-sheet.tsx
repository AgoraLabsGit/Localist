"use client";

import { useTranslations } from "next-intl";

/**
 * Filter panel — Option B: side panel (drawer from right).
 * Type uses hierarchical groups: coarse group → subtypes.
 */
import { useState, useEffect } from "react";
import { Filter, X, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { toTitleCase } from "@/lib/neighborhoods";

export const NEIGHBORHOODS = [
  "all", "Palermo", "Recoleta", "San Telmo", "La Boca", "Belgrano",
  "Villa Crespo", "Villa Urquiza", "Puerto Madero", "Microcentro", "Colegiales", "Nuñez",
  "Caballito", "Almagro", "Retiro", "Monserrat", "San Nicolás", "Balvanera",
  "Boedo", "Barracas", "Constitución", "Flores",
] as const;
export const VIBES = ["all", "solo_friendly", "group_friendly", "date_night", "cozy", "lively"] as const;

export const TYPE_GROUPS: { id: string; label: string; types: string[] }[] = [
  { id: "restaurants", label: "Restaurants", types: ["parrilla", "heladeria", "pizzeria", "empanadas", "panaderia", "brunch", "cajun", "po_boy", "restaurant"] },
  { id: "bars", label: "Bars", types: ["cocktail_bar", "rooftop", "tango_bar", "wine_bar", "cerveceria", "dive_bar", "jazz_bar", "music_venue", "night_club"] },
  { id: "cafes", label: "Cafés", types: ["cafe"] },
  { id: "museums", label: "Museums", types: ["museum"] },
  { id: "outdoors", label: "Outdoors", types: ["park", "waterfront"] },
  { id: "culture", label: "Culture", types: ["theater", "historical_place", "bookstore", "art_gallery"] },
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
  /** Multi-select: empty or ["all"] = show all. ["Palermo","Villa Crespo"] = those areas. */
  neighborhoods: string[];
  vibe: string;
  /** User tags to filter by (multi-select) */
  tags?: string[];
  /** Min rating (1-5) for Your Places Visited/Favorites */
  ratingMin?: number;
}

interface FilterSheetProps {
  open: boolean;
  onClose: () => void;
  filters: FilterState;
  onFiltersChange: (f: FilterState) => void;
  onApply: () => void;
  /** Number of results for current sheet filters (computed by parent) */
  resultsCount: number;
  /** User's preferred neighborhoods — adds "Favorite neighborhoods" option */
  preferredNeighborhoods?: string[];
  /** Neighborhoods for Area filter. From DB + highlights. When omitted, uses hardcoded NEIGHBORHOODS. */
  neighborhoods?: string[];
  /** Show Your Places filters (tags, rating) - only when on Your Places tab */
  showYourPlacesFilters?: boolean;
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
              "text-sm font-medium px-3 py-1.5 rounded-[10px] transition-colors touch-manipulation",
              value === opt
                ? "bg-tab-selected text-tab-selected-fg"
                : "bg-surface-alt text-muted-foreground hover:bg-surface hover:text-foreground"
            )}
          >
            {formatLabel(opt)}
          </button>
        ))}
      </div>
    </div>
  );
}

export const FAVORITE_NEIGHBORHOODS = "__favorites__";
export const NEAR_ME = "__near_me__";

const RATING_OPTIONS = [
  { labelKey: "ratingAny" as const, value: undefined },
  { labelKey: "rating4Plus" as const, value: 4 },
  { labelKey: "rating5" as const, value: 5 },
] as const;

export function FilterSheet({
  open,
  onClose,
  filters,
  onFiltersChange,
  onApply,
  resultsCount,
  preferredNeighborhoods = [],
  neighborhoods,
  showYourPlacesFilters = false,
}: FilterSheetProps) {
  const tFilters = useTranslations("filters");
  const tCommon = useTranslations("common");
  const tFilterChips = useTranslations("filterChips");
  const tPlaceTypes = useTranslations("placeTypes");
  const baseNeighborhoods = neighborhoods ?? [...NEIGHBORHOODS].filter((n) => n !== "all");
  const [areaExpanded, setAreaExpanded] = useState(true);
  const [distinctUserTags, setDistinctUserTags] = useState<string[]>([]);

  useEffect(() => {
    if (!showYourPlacesFilters || !open) return;
    fetch("/api/user-tags/distinct")
      .then((r) => (r.ok ? r.json() : { tags: [] }))
      .then((d) => setDistinctUserTags(d.tags ?? []))
      .catch(() => setDistinctUserTags([]));
  }, [showYourPlacesFilters, open]);

  const handleClearAll = () => {
    onFiltersChange({
      category: "all",
      neighborhoods: [],
      vibe: "all",
      tags: [],
      ratingMin: undefined,
    });
  };

  const tags = filters.tags ?? [];
  const toggleTagFilter = (tag: string) => {
    const set = new Set(tags);
    if (set.has(tag)) set.delete(tag);
    else set.add(tag);
    onFiltersChange({ ...filters, tags: Array.from(set) });
  };

  const isAllAreas = filters.neighborhoods.length === 0;
  const toggleNeighborhood = (n: string) => {
    if (n === "all") {
      onFiltersChange({ ...filters, neighborhoods: [] });
      return;
    }
    const set = new Set(filters.neighborhoods);
    if (set.has(n)) {
      set.delete(n);
    } else {
      set.add(n);
    }
    onFiltersChange({ ...filters, neighborhoods: Array.from(set) });
  };

  const handleApply = () => {
    onApply();
    onClose();
  };

  return (
    <>
      {/* Backdrop — lighter so content remains visible behind */}
      <button
        type="button"
        aria-label={tCommon("close")}
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity duration-200",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />
      {/* Side panel — slides in from right */}
      <div
        className={cn(
          "fixed right-0 top-0 bottom-0 z-50 w-72 sm:w-80 bg-surface border-l border-border-app shadow-card-soft flex flex-col transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-label={tFilters("title")}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-app">
          <h2 className="text-lg font-semibold">{tFilters("title")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -m-2 text-muted-foreground hover:text-foreground rounded-full transition-colors touch-manipulation"
            aria-label={tCommon("close")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
          {/* Type — parent groups + child subtypes when a group is selected */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">{tFilters("type")}</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => onFiltersChange({ ...filters, category: "all" })}
                className={cn(
                  "text-sm font-medium px-3 py-1.5 rounded-[10px] transition-colors touch-manipulation",
                  filters.category === "all" ? "bg-tab-selected text-tab-selected-fg" : "bg-surface-alt text-muted-foreground hover:bg-surface hover:text-foreground"
                )}
              >
                {tCommon("all")}
              </button>
              {TYPE_GROUPS.map((group) => {
                const isGroupSelected = filters.category === group.id;
                const isTypeInGroup = group.types.includes(filters.category);
                const isActive = isGroupSelected || isTypeInGroup;
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => onFiltersChange({ ...filters, category: filters.category === group.id ? "all" : group.id })}
                    className={cn(
                      "text-sm font-medium px-3 py-1.5 rounded-[10px] transition-colors touch-manipulation",
                      isActive ? "bg-tab-selected text-tab-selected-fg" : "bg-surface-alt text-muted-foreground hover:bg-surface hover:text-foreground"
                    )}
                  >
                    {tFilters(`typeGroups.${group.id}` as any) || group.label}
                  </button>
                );
              })}
            </div>
            {(() => {
              const activeGroup = TYPE_GROUPS.find(
                (g) => g.id === filters.category || g.types.includes(filters.category)
              );
              if (!activeGroup) return null;
              return (
                <div className="mt-2 pl-2 border-l-2 border-border-app">
                  <p className="text-xs text-muted-foreground mb-1.5">{tFilters("narrowTo")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => onFiltersChange({ ...filters, category: activeGroup.id })}
                      className={cn(
                        "text-sm font-medium px-3 py-1.5 rounded-[10px] transition-colors touch-manipulation",
                        filters.category === activeGroup.id ? "bg-tab-selected text-tab-selected-fg" : "bg-surface-alt text-muted-foreground hover:bg-surface hover:text-foreground"
                      )}
                    >
                      {tFilters("allGroup", { group: tFilters(`typeGroups.${activeGroup.id}` as any) || activeGroup.label })}
                    </button>
                    {activeGroup.types.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => onFiltersChange({ ...filters, category: filters.category === type ? activeGroup.id : type })}
                        className={cn(
                          "text-sm font-medium px-3 py-1.5 rounded-[10px] transition-colors touch-manipulation",
                          filters.category === type ? "bg-tab-selected text-tab-selected-fg" : "bg-surface-alt text-muted-foreground hover:bg-surface hover:text-foreground"
                        )}
                      >
                        {tPlaceTypes(type as any) || formatFilterLabel(type)}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
          <div>
            <button
              type="button"
              onClick={() => setAreaExpanded((e) => !e)}
              className="flex w-full items-center justify-between gap-2 text-xs font-medium text-muted-foreground mb-1.5 hover:text-foreground"
              aria-expanded={areaExpanded}
            >
              {tFilters("area")} {filters.neighborhoods.length > 0 && `(${filters.neighborhoods.length})`}
              {areaExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {areaExpanded && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => onFiltersChange({ ...filters, neighborhoods: [] })}
                    className={cn(
                      "text-sm font-medium px-3 py-1.5 rounded-[10px] transition-colors touch-manipulation",
                      isAllAreas ? "bg-tab-selected text-tab-selected-fg" : "bg-surface-alt text-muted-foreground hover:bg-surface hover:text-foreground"
                    )}
                  >
                    {tCommon("allAreas")}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleNeighborhood(NEAR_ME)}
                    className={cn(
                      "text-sm font-medium px-3 py-1.5 rounded-[10px] transition-colors touch-manipulation",
                      filters.neighborhoods.includes(NEAR_ME) ? "bg-tab-selected text-tab-selected-fg" : "bg-surface-alt text-muted-foreground hover:bg-surface hover:text-foreground"
                    )}
                  >
                    {tCommon("nearMe")}
                  </button>
                  {preferredNeighborhoods.length > 0 && (
                  <button
                    type="button"
                    onClick={() => toggleNeighborhood(FAVORITE_NEIGHBORHOODS)}
                    className={cn(
                      "text-sm font-medium px-3 py-1.5 rounded-[10px] transition-colors touch-manipulation",
                      filters.neighborhoods.includes(FAVORITE_NEIGHBORHOODS)
                        ? "bg-tab-selected text-tab-selected-fg"
                        : "bg-surface-alt text-muted-foreground hover:bg-surface hover:text-foreground"
                    )}
                  >
                    {tFilters("favoriteNeighborhoods")}
                  </button>
                  )}
                  {baseNeighborhoods.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => toggleNeighborhood(n)}
                      className={cn(
                        "text-sm font-medium px-3 py-1.5 rounded-[10px] transition-colors touch-manipulation",
                      filters.neighborhoods.includes(n) ? "bg-tab-selected text-tab-selected-fg" : "bg-surface-alt text-muted-foreground hover:bg-surface hover:text-foreground"
                    )}
                  >
                    {toTitleCase(n)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <ChipRow
            options={VIBES}
            value={filters.vibe}
            onChange={(v) => onFiltersChange({ ...filters, vibe: v })}
            label={tFilters("vibe")}
            formatLabel={(opt) => opt === "all" ? tCommon("all") : (tFilterChips(opt as any) || formatFilterLabel(opt))}
          />

          {showYourPlacesFilters && (
            <>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">{tFilters("yourTags")}</p>
                {distinctUserTags.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    {tFilters("yourTagsEmpty")}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {distinctUserTags.map((tag) => {
                      const selected = tags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTagFilter(tag)}
                          className={cn(
                            "text-sm font-medium px-3 py-1.5 rounded-[10px] transition-colors touch-manipulation",
                            selected ? "bg-tab-selected text-tab-selected-fg" : "border border-chip-user text-muted-foreground hover:text-foreground hover:border-slate-400"
                          )}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">{tFilters("rating")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {RATING_OPTIONS.map(({ labelKey, value }) => {
                    const selected = (filters.ratingMin ?? undefined) === value;
                    return (
                      <button
                        key={labelKey}
                        type="button"
                        onClick={() =>
                          onFiltersChange({
                            ...filters,
                            ratingMin: value,
                          })
                        }
                        className={cn(
                          "text-sm font-medium px-3 py-1.5 rounded-[10px] transition-colors touch-manipulation",
                          selected ? "bg-tab-selected text-tab-selected-fg" : "bg-surface-alt text-muted-foreground hover:bg-surface hover:text-foreground"
                        )}
                      >
                        {tFilters(labelKey)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
        <div className="shrink-0 flex gap-2 px-4 py-3 border-t border-border-app bg-surface">
          <button
            type="button"
            onClick={handleClearAll}
            className="flex-1 py-2.5 rounded-[14px] border border-border-app text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-surface-alt transition-colors touch-manipulation"
          >
            {tCommon("clearAll")}
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 py-2.5 rounded-[14px] bg-accent-cyan text-white text-sm font-medium hover:bg-accent-cyan/90 transition-colors touch-manipulation"
          >
            {resultsCount > 0 ? tFilters("showResults", { count: resultsCount }) : tFilters("results")}
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
  const tFilters = useTranslations("filters");
  const hasFilters = appliedCount > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-[14px] text-[13px] font-medium font-display border transition-colors touch-manipulation min-h-[42px]",
        hasFilters
          ? "bg-accent-cyan text-white border-accent-cyan"
          : "border-border-medium bg-surface-alt hover:bg-surface text-muted-foreground hover:text-foreground"
      )}
    >
      <Filter className="w-3.5 h-3.5" />
      <span>{tFilters("title")}</span>
      {hasFilters && (
        <span className="min-w-[1.25rem] h-5 flex items-center justify-center rounded-full bg-white/20 text-inherit text-xs font-semibold">
          {appliedCount}
        </span>
      )}
    </button>
  );
}
