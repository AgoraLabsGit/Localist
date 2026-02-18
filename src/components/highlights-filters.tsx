"use client";

/**
 * Universal 1-row filter chips for Highlights/Explore.
 * Horizontal scroll, tap to select/deselect. No "All" chips; reset (×) clears all.
 */
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExploreCategory, ExploreTimeFilter, ExploreAreaFilter } from "@/lib/explore-categories";
import { FAVORITE_NEIGHBORHOODS, NEAR_ME } from "./filter-sheet";

/** Time chips: Today/Tonight/Weekend are mood filters (not yet filtering by actual hours). Open now omitted—opening_hours is sparse. */
const TIME_LABELS: Record<Exclude<ExploreTimeFilter, "anytime">, string> = {
  open_now: "Open now",
  today: "Today",
  tonight: "Tonight",
  weekend: "Weekend",
};

const AREA_LABELS: Record<Exclude<ExploreAreaFilter, "all">, string> = {
  near_me: "Near me",
  my_barrios: "My Neighborhoods",
};

export type PriceFilter = "$" | "$$" | "$$$";
export type VibeFilter = "cozy" | "lively" | "date_night" | "solo" | "group";

export interface HighlightsFilterState {
  time: ExploreTimeFilter | null;
  area: ExploreAreaFilter | null;
  price: PriceFilter | null;
  vibe: VibeFilter | null;
}

const VIBE_LABELS: Record<VibeFilter, string> = {
  cozy: "Cozy",
  lively: "Lively",
  date_night: "Date night",
  solo: "Solo",
  group: "Group",
};

/** Map UI vibe to DB vibe_tags value */
const VIBE_TO_DB: Record<VibeFilter, string> = {
  cozy: "cozy",
  lively: "lively",
  date_night: "date_night",
  solo: "solo_friendly",
  group: "group_friendly",
};

const CHIP_BASE =
  "shrink-0 text-[12px] px-2.5 py-1 rounded-[10px] font-medium transition-colors touch-manipulation";
const CHIP_INACTIVE = "bg-chip text-[#E5E7EB] border border-transparent hover:bg-chip-user";
const CHIP_ACTIVE = "bg-accent-cyan/25 text-accent-cyan border border-accent-cyan/50";
const DIVIDER = "shrink-0 w-px h-4 bg-[rgba(148,163,184,0.3)]";

interface FilterChipRowProps {
  filters: HighlightsFilterState;
  onFiltersChange: (f: HighlightsFilterState) => void;
  preferredNeighborhoods: string[];
}

export function FilterChipRow({ filters, onFiltersChange, preferredNeighborhoods }: FilterChipRowProps) {
  const timeOptions: (Exclude<ExploreTimeFilter, "anytime">)[] = ["today", "tonight", "weekend"];
  const areaOptions: (Exclude<ExploreAreaFilter, "all">)[] = preferredNeighborhoods.length > 0
    ? ["near_me", "my_barrios"]
    : ["near_me"];
  const priceOptions: PriceFilter[] = ["$", "$$", "$$$"];
  const vibeOptions: VibeFilter[] = ["cozy", "lively", "date_night", "solo", "group"];

  const toggleTime = (v: Exclude<ExploreTimeFilter, "anytime">) =>
    onFiltersChange({ ...filters, time: filters.time === v ? null : v });
  const toggleArea = (v: Exclude<ExploreAreaFilter, "all">) =>
    onFiltersChange({ ...filters, area: filters.area === v ? null : v });
  const togglePrice = (v: PriceFilter) =>
    onFiltersChange({ ...filters, price: filters.price === v ? null : v });
  const toggleVibe = (v: VibeFilter) =>
    onFiltersChange({ ...filters, vibe: filters.vibe === v ? null : v });

  const reset = () => onFiltersChange({ time: null, area: null, price: null, vibe: null });

  const hasAnyFilter = filters.time !== null || filters.area !== null || filters.price !== null || filters.vibe !== null;

  return (
    <div className="flex items-center gap-0 -mx-4 px-4">
      <div className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden scrollbar-hide py-2">
        <div className="flex items-center gap-2 min-w-max">
        {timeOptions.map((v) => (
          <button
            key={`time-${v}`}
            type="button"
            onClick={() => toggleTime(v)}
            className={cn(CHIP_BASE, filters.time === v ? CHIP_ACTIVE : CHIP_INACTIVE)}
          >
            {TIME_LABELS[v]}
          </button>
        ))}
        <div className={DIVIDER} aria-hidden />
        {areaOptions.map((v) => (
          <button
            key={`area-${v}`}
            type="button"
            onClick={() => toggleArea(v)}
            className={cn(CHIP_BASE, filters.area === v ? CHIP_ACTIVE : CHIP_INACTIVE)}
          >
            {AREA_LABELS[v]}
          </button>
        ))}
        <div className={DIVIDER} aria-hidden />
        {priceOptions.map((v) => (
          <button
            key={`price-${v}`}
            type="button"
            onClick={() => togglePrice(v)}
            className={cn(CHIP_BASE, filters.price === v ? CHIP_ACTIVE : CHIP_INACTIVE)}
          >
            {v}
          </button>
        ))}
        <div className={DIVIDER} aria-hidden />
        {vibeOptions.map((v) => (
          <button
            key={`vibe-${v}`}
            type="button"
            onClick={() => toggleVibe(v)}
            className={cn(CHIP_BASE, filters.vibe === v ? CHIP_ACTIVE : CHIP_INACTIVE)}
          >
            {VIBE_LABELS[v]}
          </button>
        ))}
        </div>
      </div>
      <div className={DIVIDER} aria-hidden />
      <button
        type="button"
        onClick={reset}
        className={cn(
          CHIP_BASE,
          "shrink-0 opacity-70 hover:opacity-100",
          hasAnyFilter ? "text-muted-foreground hover:text-foreground" : "text-muted-foreground/50"
        )}
        aria-label="Reset filters"
      >
        <X className="w-3.5 h-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}

interface CategoryHeaderProps {
  category: ExploreCategory | null;
  cityName: string;
}

export function CategoryHeader({ category, cityName }: CategoryHeaderProps) {
  if (!category) return null;
  return (
    <div>
      <h1 className="text-lg font-display font-semibold text-foreground">
        {category.title} in {cityName}
      </h1>
      <p className="text-[13px] text-muted-foreground mt-0.5">{category.subtitle}</p>
    </div>
  );
}

/** Map HighlightsFilterState.area to neighborhoods array */
export function highlightsFiltersToFilterState(
  hf: HighlightsFilterState,
  _currentNeighborhoods: string[]
): { neighborhoods: string[] } {
  if (!hf.area || hf.area === "all") return { neighborhoods: [] };
  if (hf.area === "near_me") return { neighborhoods: [NEAR_ME] };
  if (hf.area === "my_barrios") return { neighborhoods: [FAVORITE_NEIGHBORHOODS] };
  return { neighborhoods: [] };
}

export function getInitialHighlightsFilters(category: ExploreCategory | null): HighlightsFilterState {
  if (!category) return { time: null, area: null, price: null, vibe: null };
  return {
    time: category.defaultTime === "anytime" ? null : category.defaultTime,
    area: category.defaultArea === "all" ? null : category.defaultArea,
    price: null,
    vibe: null,
  };
}

export function vibeFilterToDb(vibe: VibeFilter | null): string | null {
  if (!vibe) return null;
  return VIBE_TO_DB[vibe] ?? null;
}
