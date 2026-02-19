"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { HighlightCard } from "./highlight-card";
import { PlaceDetail } from "./place-detail";
import { TabNav, type Tab } from "./tab-nav";
import { Search, ChevronLeft } from "lucide-react";
import { FilterSheet, FilterPill, formatFilterLabel, TYPE_GROUPS, FAVORITE_NEIGHBORHOODS, NEAR_ME, type FilterState } from "./filter-sheet";
import { EXPLORE_CATEGORIES } from "@/lib/explore-categories";
import {
  FilterChipRow,
  CategoryHeader,
  getInitialHighlightsFilters,
  highlightsFiltersToFilterState,
  vibeFilterToDb,
  type HighlightsFilterState,
} from "./highlights-filters";
import { ConciergeFilterSheet, type ConciergeFilterState } from "./concierge-filter-sheet";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { toTitleCase } from "@/lib/neighborhoods";
import type { Highlight } from "@/types/database";
import type { User } from "@supabase/supabase-js";

interface ConciergeSection {
  id: string;
  title: string;
  items: { primary: Highlight; categories: string[]; highlightIds: string[] }[];
}

const PERSONA_LABELS: Record<string, string> = {
  local: "lives here",
  nomad: "here for a while",
  tourist: "visiting",
};

interface Preferences {
  preferred_neighborhoods: string[];
  interests: string[];
  persona_type?: string | null;
  home_neighborhood?: string | null;
  home_city?: string;
}

export interface UserPlaceState {
  isSaved: boolean;
  isVisited: boolean;
  rating?: number;
}

interface HighlightsFeedProps {
  highlights: Highlight[];
  initialUserStateByPlaceId: Record<string, UserPlaceState>;
  initialTagsByPlaceId?: Record<string, string[]>;
  user: User | null;
  preferences?: Preferences;
  /** Neighborhoods for Area filter. From city_neighborhoods + distinct from highlights. */
  neighborhoods?: string[];
  /** Pre-applied from URL (e.g. /?category=cafes&vibe=solo_friendly) */
  initialCategory?: string;
  initialVibe?: string;
  /** Initial tab from URL (e.g. /?tab=explore) */
  initialTab?: string;
}

const YOUR_PLACES_SUBTABS = ["Saved", "Favorites", "Visited"] as const;
type YourPlacesSubTab = (typeof YOUR_PLACES_SUBTABS)[number];

function parseTab(tab?: string): Tab | null {
  if (!tab) return null;
  const normalized = tab.toLowerCase().replace(/\s+/g, "-");
  if (normalized === "explore") return "Explore";
  if (normalized === "concierge") return "Concierge";
  if (normalized === "my-places") return "My Places";
  return null;
}

export function HighlightsFeed({ highlights, initialUserStateByPlaceId, initialTagsByPlaceId = {}, user, preferences = { preferred_neighborhoods: [], interests: [], persona_type: null, home_neighborhood: null, home_city: "Buenos Aires" }, neighborhoods = [], initialCategory, initialVibe, initialTab }: HighlightsFeedProps) {
  const [filters, setFilters] = useState<FilterState>({
    category: initialCategory ?? "all",
    neighborhoods: [],
    vibe: initialVibe ?? "all",
    tags: [],
    ratingMin: undefined,
  });
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [conciergeFilterOpen, setConciergeFilterOpen] = useState(false);
  const [conciergeFilters, setConciergeFilters] = useState<ConciergeFilterState>({
    timeContext: "today",
    radius: "all",
    typeGroup: "all",
    favoriteNeighborhoodsOnly: false,
  });
  const [conciergeData, setConciergeData] = useState<{
    time_context: string;
    time_filter?: string;
    sections: ConciergeSection[];
  } | null>(null);
  const [conciergeLoading, setConciergeLoading] = useState(false);
  /** Per-section index for "Not this one" cycling (one card at a time per slot) */
  const [conciergeSlotIndex, setConciergeSlotIndex] = useState<Record<string, number>>({});
  const [selectedHighlightId, setSelectedHighlightId] = useState<string | null>(null);
  /** When opening from Concierge: which section, for reject → next candidate */
  const [selectedConciergeSectionId, setSelectedConciergeSectionId] = useState<string | null>(null);
  const [selectedPlaceSaved, setSelectedPlaceSaved] = useState(false);
  const [selectedPlaceVisited, setSelectedPlaceVisited] = useState(false);
  const [selectedPlaceRating, setSelectedPlaceRating] = useState<number | undefined>(undefined);
  const [selectedUserTags, setSelectedUserTags] = useState<string[]>([]);
  const [selectedToggleSaveId, setSelectedToggleSaveId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const fromUrl = parseTab(initialTab);
    if (fromUrl) return fromUrl;
    if (initialCategory || initialVibe) return "Explore";
    return user ? "Concierge" : "Explore";
  });
  const [yourPlacesSubTab, setYourPlacesSubTab] = useState<YourPlacesSubTab>("Saved");
  const [userStateByPlaceId, setUserStateByPlaceId] = useState<Record<string, UserPlaceState>>(initialUserStateByPlaceId);
  const [tagsByPlaceId, setTagsByPlaceId] = useState<Record<string, string[]>>(() => ({ ...initialTagsByPlaceId }));
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [exploreView, setExploreView] = useState<"cards" | "list">("cards");
  const [highlightsFilterState, setHighlightsFilterState] = useState<HighlightsFilterState>({
    time: null,
    area: null,
    price: null,
    vibe: null,
  });

  const handleTabChange = useCallback((tab: Tab) => {
    setActiveTab(tab);
    if (tab === "Explore") {
      setExploreView("cards");
      setFilters((prev) => ({ ...prev, category: "all", vibe: "all", neighborhoods: [] }));
      setSearchQuery("");
      setHighlightsFilterState({ time: null, area: null, price: null, vibe: null });
    } else {
      setExploreView("cards");
    }
  }, []);

  const toggleSave = useCallback(
    async (highlightId: string, currentlySaved: boolean) => {
      if (!user) {
        window.location.href = "/auth/login?next=/";
        return;
      }
      const next = !currentlySaved;
      setUserStateByPlaceId((prev) => ({
        ...prev,
        [highlightId]: { ...prev[highlightId], isSaved: next },
      }));
      const res = await fetch("/api/user-place-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId: highlightId, isSaved: next }),
      });
      if (!res.ok) {
        setUserStateByPlaceId((prev) => ({ ...prev, [highlightId]: { ...prev[highlightId], isSaved: currentlySaved } }));
      }
    },
    [user]
  );

  const toggleVisited = useCallback(
    async (highlightId: string, currentlyVisited: boolean) => {
      if (!user) {
        window.location.href = "/auth/login?next=/";
        return;
      }
      const next = !currentlyVisited;
      setUserStateByPlaceId((prev) => ({
        ...prev,
        [highlightId]: { ...prev[highlightId], isVisited: next },
      }));
      const res = await fetch("/api/user-place-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId: highlightId, isVisited: next }),
      });
      if (!res.ok) {
        setUserStateByPlaceId((prev) => ({ ...prev, [highlightId]: { ...prev[highlightId], isVisited: currentlyVisited } }));
      }
    },
    [user]
  );

  /** Merge highlights by venue_id: one card per venue with all categories. */
  const mergedByVenue = useMemo(() => {
    const byVenue = new Map<
      string | null,
      { primary: Highlight; categories: string[]; highlightIds: string[] }
    >();
    for (const h of highlights) {
      const vid = h.venue_id ?? h.id;
      const existing = byVenue.get(vid);
      const cat = h.category;
      if (existing) {
        if (!existing.categories.includes(cat)) existing.categories.push(cat);
        existing.highlightIds.push(h.id);
      } else {
        byVenue.set(vid, { primary: h, categories: [cat], highlightIds: [h.id] });
      }
    }
    return Array.from(byVenue.values());
  }, [highlights]);

  useEffect(() => {
    if (!filters.neighborhoods.includes(NEAR_ME) || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setUserLocation(null),
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }, [filters.neighborhoods]);

  const NEAR_ME_RADIUS_KM = 8;
  function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /** Parse search bar into filters: e.g. "palermo cocktail" -> neighborhoods [Palermo], category cocktail_bar, text "" */
  const parsedSearch = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return { neighborhoods: [] as string[], category: "all" as string, text: "" };
    const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
    const parsedNeighborhoods: string[] = [];
    let parsedCategory = "all";
    const remaining: string[] = [];
    const nKey = (s: string) => s.toLowerCase().replace(/ñ/g, "n").replace(/í/g, "i").replace(/[^\w]/g, "");
    const keywordToCategory: Record<string, string> = {
      bar: "bars", bars: "bars", cocktail: "cocktail_bar", wine: "wine_bar", cafe: "cafe", coffee: "cafe",
      restaurant: "restaurants", restaurants: "restaurants", parrilla: "parrilla", brunch: "brunch",
      museum: "museums", museums: "museums", park: "park", outdoors: "outdoors",
    };
    for (const token of tokens) {
      let matched = false;
      for (const n of neighborhoods) {
        const nNorm = nKey(n);
        const tokNorm = nKey(token);
        if (nNorm === tokNorm || nNorm.startsWith(tokNorm) || tokNorm.startsWith(nNorm) || nNorm.includes(tokNorm)) {
          if (!parsedNeighborhoods.includes(n)) parsedNeighborhoods.push(n);
          matched = true;
        }
      }
      if (matched) continue;
      const kw = keywordToCategory[token];
      if (kw) {
        parsedCategory = kw;
        matched = true;
        continue;
      }
      for (const g of TYPE_GROUPS) {
        const gNorm = nKey(g.id);
        const labelNorm = nKey(g.label);
        const tokNorm = nKey(token);
        if (g.id === token || gNorm === tokNorm || labelNorm.includes(tokNorm) || tokNorm.includes(gNorm)) {
          parsedCategory = g.id;
          matched = true;
          break;
        }
        for (const t of g.types) {
          const tNorm = nKey(t);
          if (t === token || tNorm === tokNorm || tNorm.includes(tokNorm) || tokNorm.includes(tNorm)) {
            parsedCategory = t;
            matched = true;
            break;
          }
        }
        if (matched) break;
      }
      if (!matched) remaining.push(token);
    }
    return { neighborhoods: parsedNeighborhoods, category: parsedCategory, text: remaining.join(" ") };
  }, [searchQuery, neighborhoods]);

  const filtered = useMemo(() => {
    const { neighborhoods: parsedNeighborhoods, category: parsedCategory, text: parsedText } = parsedSearch;
    const effectiveCategory = parsedCategory !== "all" ? parsedCategory : filters.category;
    let effectiveNeighborhoods = parsedNeighborhoods.length > 0 ? parsedNeighborhoods : filters.neighborhoods;
    const isExploreListView = activeTab === "Explore" && exploreView === "list";
    if (isExploreListView) {
      const areaMap = highlightsFiltersToFilterState(highlightsFilterState, effectiveNeighborhoods);
      // Chip area (near_me, my_barrios) overrides only when FilterSheet has no explicit neighborhoods
      const hasExplicitNeighborhoods = effectiveNeighborhoods.some(
        (n) => n !== NEAR_ME && n !== FAVORITE_NEIGHBORHOODS
      );
      if (areaMap.neighborhoods.length > 0 && !hasExplicitNeighborhoods) {
        effectiveNeighborhoods = areaMap.neighborhoods;
      }
    }
    const textQuery = parsedText;
    const vibeDb = isExploreListView ? vibeFilterToDb(highlightsFilterState.vibe) : null;
    const effectiveVibe = vibeDb ?? (filters.vibe !== "all" ? filters.vibe : null);
    const priceFilter = isExploreListView ? highlightsFilterState.price : null;

    return mergedByVenue.filter(({ primary, categories }) => {
      if (textQuery) {
        const ven = Array.isArray(primary.venue) ? primary.venue[0] : primary.venue;
        const venueName = ven?.name ?? "";
        const text = [
          primary.title,
          primary.short_description,
          venueName,
          primary.neighborhood,
          ...categories,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!text.includes(textQuery.toLowerCase())) return false;
      }
      if (effectiveCategory !== "all") {
        const group = TYPE_GROUPS.find((g) => g.id === effectiveCategory);
        const match = group
          ? categories.some((c) => group.types.includes(c))
          : categories.includes(effectiveCategory);
        if (!match) return false;
      }
      if (effectiveNeighborhoods.length > 0) {
        const nKey = (s: string | null) => (s ?? "").toLowerCase().trim();
        const primaryN = nKey(primary.neighborhood);
        let matches = false;
        if (effectiveNeighborhoods.includes(NEAR_ME) && userLocation) {
          const ven = Array.isArray(primary.venue) ? primary.venue[0] : primary.venue;
          const lat = ven?.latitude ?? null;
          const lng = ven?.longitude ?? null;
          if (lat != null && lng != null && distanceKm(userLocation.lat, userLocation.lng, lat, lng) <= NEAR_ME_RADIUS_KM) matches = true;
        }
        if (!matches && effectiveNeighborhoods.includes(FAVORITE_NEIGHBORHOODS) && preferences.preferred_neighborhoods?.some((n) => nKey(n) === primaryN)) matches = true;
        if (!matches && effectiveNeighborhoods.filter((n) => n !== FAVORITE_NEIGHBORHOODS && n !== NEAR_ME).some((n) => nKey(n) === primaryN)) matches = true;
        if (!matches) return false;
      }
      const vibeToCheck = effectiveVibe ?? filters.vibe;
      if (vibeToCheck && vibeToCheck !== "all") {
        const tags = Array.isArray(primary.vibe_tags) ? primary.vibe_tags : [];
        if (!tags.some((t: string) => String(t).toLowerCase() === vibeToCheck.toLowerCase())) return false;
      }
      if (priceFilter) {
        const price = primary.avg_expected_price ?? null;
        if (price == null) return false;
        if (priceFilter === "$" && price >= 15) return false;
        if (priceFilter === "$$" && (price < 15 || price >= 40)) return false;
        if (priceFilter === "$$$" && price < 40) return false;
      }
      return true;
    });
  }, [mergedByVenue, filters, parsedSearch, preferences.preferred_neighborhoods, userLocation, activeTab, exploreView, highlightsFilterState]);

  const effectiveCategory = parsedSearch.category !== "all" ? parsedSearch.category : filters.category;
  const effectiveNeighborhoods = parsedSearch.neighborhoods.length > 0 ? parsedSearch.neighborhoods : filters.neighborhoods;

  const showExploreCategoryCards =
    activeTab === "Explore" &&
    exploreView === "cards" &&
    effectiveCategory === "all" &&
    filters.vibe === "all" &&
    effectiveNeighborhoods.length === 0 &&
    !parsedSearch.text;

  const appliedFilterCount =
    (searchQuery.trim() ? 1 : 0) +
    (effectiveCategory !== "all" ? 1 : 0) +
    (effectiveNeighborhoods.length > 0 ? 1 : 0) +
    (filters.vibe !== "all" ? 1 : 0) +
    ((filters.tags?.length ?? 0) > 0 ? 1 : 0) +
    (filters.ratingMin != null ? 1 : 0);

  /** Your Places: filter by sub-tab. Venue matches if any highlight matches. */
  const yourPlacesMerged = useMemo(() => {
    return mergedByVenue.filter(({ highlightIds }) =>
      highlightIds.some((id) => {
        const s = userStateByPlaceId[id];
        if (!s) return false;
        if (yourPlacesSubTab === "Saved") return s.isSaved;
        if (yourPlacesSubTab === "Visited") return s.isVisited;
        if (yourPlacesSubTab === "Favorites") return s.isVisited && (s.rating ?? 0) >= 4;
        return false;
      })
    );
  }, [mergedByVenue, userStateByPlaceId, yourPlacesSubTab]);

  const savedMerged = useMemo(
    () => mergedByVenue.filter(({ highlightIds }) => highlightIds.some((id) => userStateByPlaceId[id]?.isSaved)),
    [mergedByVenue, userStateByPlaceId]
  );

  /** Your Places tab: apply same category/neighborhood/vibe/search filters + tags + rating. */
  const yourPlacesFiltered = useMemo(() => {
    const { neighborhoods: pNeighborhoods, category: pCategory, text: pText } = parsedSearch;
    const effCat = pCategory !== "all" ? pCategory : filters.category;
    const effNeigh = pNeighborhoods.length > 0 ? pNeighborhoods : filters.neighborhoods;
    const filterTags = filters.tags ?? [];
    const ratingMin = filters.ratingMin;
    return yourPlacesMerged.filter(({ primary, categories, highlightIds }) => {
      if (pText) {
        const ven = Array.isArray(primary.venue) ? primary.venue[0] : primary.venue;
        const text = [primary.title, primary.short_description, ven?.name ?? "", primary.neighborhood, ...categories]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!text.includes(pText.toLowerCase())) return false;
      }
      if (effCat !== "all") {
        const group = TYPE_GROUPS.find((g) => g.id === effCat);
        const match = group ? categories.some((c) => group.types.includes(c)) : categories.includes(effCat);
        if (!match) return false;
      }
      if (effNeigh.length > 0) {
        const nKey = (s: string | null) => (s ?? "").toLowerCase().trim();
        const primaryN = nKey(primary.neighborhood);
        let matches = false;
        if (effNeigh.includes(NEAR_ME) && userLocation) {
          const ven = Array.isArray(primary.venue) ? primary.venue[0] : primary.venue;
          const lat = ven?.latitude ?? null;
          const lng = ven?.longitude ?? null;
          if (lat != null && lng != null && distanceKm(userLocation.lat, userLocation.lng, lat, lng) <= NEAR_ME_RADIUS_KM) matches = true;
        }
        if (!matches && effNeigh.includes(FAVORITE_NEIGHBORHOODS) && preferences.preferred_neighborhoods?.some((n) => nKey(n) === primaryN)) matches = true;
        if (!matches && effNeigh.filter((n) => n !== FAVORITE_NEIGHBORHOODS && n !== NEAR_ME).some((n) => nKey(n) === primaryN)) matches = true;
        if (!matches) return false;
      }
      if (filters.vibe !== "all") {
        const tags = Array.isArray(primary.vibe_tags) ? primary.vibe_tags : [];
        if (!tags.some((t: string) => String(t).toLowerCase() === filters.vibe.toLowerCase())) return false;
      }
      if (filterTags.length > 0) {
        const placeTags = highlightIds.flatMap((id) => tagsByPlaceId[id] ?? []);
        if (!filterTags.some((t) => placeTags.includes(t))) return false;
      }
      if (ratingMin != null) {
        const placeRating = highlightIds.map((id) => userStateByPlaceId[id]?.rating).find((r) => r != null);
        if (placeRating == null || placeRating < ratingMin) return false;
      }
      return true;
    });
  }, [yourPlacesMerged, filters, parsedSearch, preferences.preferred_neighborhoods, userLocation, tagsByPlaceId, userStateByPlaceId]);

  const getSavedHighlightId = useCallback(
    (highlightIds: string[]) => highlightIds.find((id) => userStateByPlaceId[id]?.isSaved) ?? highlightIds[0],
    [userStateByPlaceId]
  );

  const getUserStateForVenue = useCallback(
    (primaryId: string, highlightIds: string[]) => {
      const savedId = getSavedHighlightId(highlightIds);
      const savedState = userStateByPlaceId[savedId];
      // Rating/visited can be stored on any highlight of the venue; aggregate across all
      const rating = highlightIds.map((id) => userStateByPlaceId[id]?.rating).find((r) => r != null);
      const isVisited = highlightIds.some((id) => userStateByPlaceId[id]?.isVisited);
      return {
        isSaved: savedState?.isSaved ?? false,
        isVisited,
        rating: rating ?? undefined,
      };
    },
    [userStateByPlaceId, getSavedHighlightId]
  );

  const conciergeFilterCount = [
    conciergeFilters.timeContext !== "today",
    conciergeFilters.radius !== "all",
    conciergeFilters.typeGroup !== "all",
    conciergeFilters.favoriteNeighborhoodsOnly,
  ].filter(Boolean).length;

  useEffect(() => {
    if (activeTab !== "Concierge" || !user) return;
    setConciergeLoading(true);
    const params = new URLSearchParams();
    if (conciergeFilters.timeContext !== "today") {
      params.set("timeContext", conciergeFilters.timeContext);
    }
    if (conciergeFilters.radius !== "all") {
      params.set("radius", conciergeFilters.radius);
    }
    if (conciergeFilters.typeGroup !== "all") {
      params.set("typeGroup", conciergeFilters.typeGroup);
    }
    if (conciergeFilters.favoriteNeighborhoodsOnly) {
      params.set("favoriteNeighborhoodsOnly", "1");
    }
    fetch(`/api/concierge?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setConciergeData(d);
        setConciergeSlotIndex({});
      })
      .catch(() => setConciergeData(null))
      .finally(() => setConciergeLoading(false));
  }, [activeTab, user, conciergeFilters]);

  const advanceConciergeSlot = useCallback((sectionId: string) => {
    setConciergeSlotIndex((prev) => ({
      ...prev,
      [sectionId]: (prev[sectionId] ?? 0) + 1,
    }));
  }, []);

  if (highlights.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        No highlights yet. Run <code className="bg-muted px-1 rounded">npm run ingest:places</code> to populate.
      </p>
    );
  }

  const displayList = activeTab === "My Places" ? yourPlacesFiltered : filtered;
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const tExplore = useTranslations("explore");
  const tFilters = useTranslations("filters");
  const tConcierge = useTranslations("concierge");
  const tMyPlaces = useTranslations("myPlaces");
  const tPlaceTypes = useTranslations("placeTypes");
  const tFilterChips = useTranslations("filterChips");

  const handpickedTimeKey =
    conciergeData?.time_filter === "tonight"
      ? "tonight"
      : conciergeData?.time_filter === "this_weekend"
        ? "theWeekend"
        : conciergeData?.time_filter === "this_week"
          ? "thisWeek"
          : conciergeData?.time_context === "sunday"
            ? "sunday"
            : conciergeData?.time_context === "weekend"
              ? "theWeekend"
              : "today";

  return (
    <div className="space-y-4">
      <div className="sticky top-14 z-40 -mx-4 px-4 pt-2 pb-2 bg-page border-b border-border-app">
        <TabNav active={activeTab} onTabChange={handleTabChange} />
        {activeTab === "My Places" && user && (
          <div className="flex gap-1 p-1 mt-4 rounded-[14px] bg-transparent border border-border-medium" role="tablist">
            {YOUR_PLACES_SUBTABS.map((tab) => (
              <button
                key={tab}
                role="tab"
                type="button"
                onClick={() => setYourPlacesSubTab(tab)}
                className={cn(
                  "flex-1 py-2 text-[13px] font-medium font-display rounded-[12px] transition-colors touch-manipulation",
                  yourPlacesSubTab === tab
                    ? "bg-tab-selected text-tab-selected-fg border border-border-medium"
                    : "bg-transparent text-muted-foreground border border-transparent hover:text-foreground"
                )}
              >
                {tNav(tab.toLowerCase())}
              </button>
            ))}
          </div>
        )}
        {(activeTab === "Explore" || activeTab === "My Places") && (
          <>
            {/* Search bar + Filters on same row */}
            <div className="flex items-center gap-2 mt-4">
              {activeTab === "Explore" && !showExploreCategoryCards && (
                <button
                  type="button"
                  onClick={() => {
                    setExploreView("cards");
                    setFilters((prev) => ({ ...prev, category: "all", vibe: "all", neighborhoods: [] }));
                    setSearchQuery("");
                    setHighlightsFilterState({ time: null, area: null, price: null, vibe: null });
                  }}
                  className="shrink-0 p-2.5 -ml-1 rounded-[14px] bg-surface border border-border-medium shadow-[0_2px_8px_rgba(0,0,0,0.25)] text-muted-foreground hover:text-foreground hover:bg-surface-alt hover:border-border-strong transition-colors touch-manipulation"
                  aria-label={tCommon("backToCategories")}
                >
                  <ChevronLeft className="w-5 h-5" strokeWidth={2} />
                </button>
              )}
              <div className="flex-1 min-w-0 flex items-center gap-2 rounded-[14px] bg-surface border border-border-medium pl-3 pr-3 py-2.5 focus-within:border-tab-indicator focus-within:ring-1 focus-within:ring-tab-indicator/30">
                <Search className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden />
                <input
                  type="search"
                  placeholder={tCommon("searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 min-w-0 bg-transparent text-sm font-body text-foreground placeholder:text-muted-foreground placeholder:font-body focus:outline-none"
                  aria-label={tCommon("searchPlaces")}
                />
              </div>
              <FilterPill onClick={() => setFilterSheetOpen(true)} appliedCount={appliedFilterCount} />
            </div>
            {/* Universal filter chips — horizontal scroll, tap to select/deselect */}
            {activeTab === "Explore" && !showExploreCategoryCards && (
              <FilterChipRow
                filters={highlightsFilterState}
                onFiltersChange={setHighlightsFilterState}
                preferredNeighborhoods={preferences.preferred_neighborhoods ?? []}
              />
            )}
            {/* My Places: filter chips when filters applied */}
            {activeTab === "My Places" && appliedFilterCount > 0 && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="inline-block text-[12px] px-2.5 py-1 rounded-[10px] text-chip-foreground bg-chip">
                  {[
                    parsedSearch.text && `"${parsedSearch.text.slice(0, 12)}${parsedSearch.text.length > 12 ? "…" : ""}"`,
                    effectiveCategory !== "all" && (tPlaceTypes.has(effectiveCategory) ? tPlaceTypes(effectiveCategory as any) : tFilters.has(`typeGroups.${effectiveCategory}`) ? (tFilters as any)(`typeGroups.${effectiveCategory}`) : formatFilterLabel(effectiveCategory)),
                    effectiveNeighborhoods.length > 0 &&
                      effectiveNeighborhoods
                        .map((n) => (n === NEAR_ME ? tCommon("nearMe") : n === FAVORITE_NEIGHBORHOODS ? tFilters("favoriteNeighborhoods") : toTitleCase(n)))
                        .join(", "),
                    filters.vibe !== "all" && (tFilterChips.has(filters.vibe) ? tFilterChips(filters.vibe as any) : formatFilterLabel(filters.vibe)),
                    (filters.tags?.length ?? 0) > 0 && `${tExplore("tagsLabel")}: ${filters.tags!.join(", ")}`,
                    filters.ratingMin != null && tExplore("ratingLabel", { min: filters.ratingMin }),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setFilters({ category: "all", neighborhoods: [], vibe: "all", tags: [], ratingMin: undefined });
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors touch-manipulation"
                >
                  {tCommon("clearAll")}
                </button>
              </div>
            )}
          </>
        )}
        {activeTab === "Concierge" && user && (
          <div className="flex items-center justify-between gap-2 mt-4">
            <p className="text-[12px] font-display text-muted-foreground">
              {tConcierge("handpickedFor", {
                time: tConcierge(handpickedTimeKey),
                city: preferences.home_city ?? "Buenos Aires",
              })}
              <a href="/settings" className="text-accent-cyan font-medium hover:underline ml-1">{tConcierge("adjust")}</a>
            </p>
            <FilterPill onClick={() => setConciergeFilterOpen(true)} appliedCount={conciergeFilterCount} />
          </div>
        )}
      </div>
      {activeTab === "Concierge" && !user && (
        <p className="text-center text-muted-foreground py-8">
          <a href="/auth/login?next=/" className="text-primary hover:underline">
            {tCommon("signIn")}
          </a>{" "}
          {tConcierge("signInPrompt")}
        </p>
      )}
      {activeTab === "My Places" && !user && (
        <p className="text-center text-muted-foreground py-8">
          <a href="/auth/login?next=/" className="text-primary hover:underline">
            {tCommon("signIn")}
          </a>{" "}
          {tMyPlaces("signInPrompt")}
        </p>
      )}
      {activeTab === "My Places" && user && yourPlacesMerged.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          {yourPlacesSubTab === "Saved" && tMyPlaces("noSaved")}
          {yourPlacesSubTab === "Visited" && tMyPlaces("noVisited")}
          {yourPlacesSubTab === "Favorites" && tMyPlaces("noFavorites")}
        </p>
      )}
      {activeTab === "My Places" && user && yourPlacesMerged.length > 0 && yourPlacesFiltered.length === 0 && (
        <p className="text-center text-muted-foreground py-8">{tMyPlaces("noMatches")}</p>
      )}
      {activeTab === "Concierge" && user && (
        <>
          {conciergeLoading && (
            <p className="text-center text-muted-foreground py-8">{tConcierge("loadingPicks")}</p>
          )}
          {!conciergeLoading && conciergeData?.sections?.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              {tConcierge("noConciergeResults")}
            </p>
          )}
          {!conciergeLoading && conciergeData?.sections && conciergeData.sections.length > 0 && (
            <div className="space-y-6">
              {conciergeData.sections.map((section) => {
                const idx = Math.min(conciergeSlotIndex[section.id] ?? 0, Math.max(0, section.items.length - 1));
                const item = section.items[idx];
                const hasMore = idx + 1 < section.items.length;
                if (!item) return null;
                const { primary, categories, highlightIds } = item;
                const savedId = getSavedHighlightId(highlightIds);
                const userState = getUserStateForVenue(primary.id, highlightIds);
                return (
                  <div key={section.id}>
                    <h3 className="text-sm font-display font-medium text-muted-foreground mb-2">
                      {tConcierge(`sections.${section.id}` as any) || section.title}
                    </h3>
                    <div className="space-y-2">
                      <HighlightCard
                        highlight={primary}
                        categories={categories}
                        onClick={() => {
                          setSelectedHighlightId(primary.id);
                          setSelectedConciergeSectionId(section.id);
                          setSelectedPlaceSaved(userState.isSaved);
                          setSelectedPlaceVisited(userState.isVisited);
                          setSelectedPlaceRating(userState.rating);
                          setSelectedUserTags(tagsByPlaceId[primary.id] ?? []);
                          setSelectedToggleSaveId(userState.isSaved ? savedId : primary.id);
                        }}
                        saved={userState.isSaved}
                        isVisited={userState.isVisited}
                        rating={userState.rating}
                        onToggleSave={(e) => {
                          e?.stopPropagation();
                          toggleSave(userState.isSaved ? savedId : primary.id, userState.isSaved);
                        }}
                        onToggleVisited={(e) => {
                          e?.stopPropagation();
                          toggleVisited(primary.id, userState.isVisited);
                        }}
                        onHide={hasMore ? (e) => { e?.stopPropagation(); advanceConciergeSlot(section.id); } : undefined}
                        isAuthenticated={!!user}
                      />
                      {hasMore && (
                        <button
                          type="button"
                          onClick={() => advanceConciergeSlot(section.id)}
                          className="w-full py-2 text-sm text-muted-foreground hover:text-foreground border border-dashed rounded-lg transition-colors"
                        >
                          {tConcierge("notThisOne")}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      {showExploreCategoryCards && (
        <div className="space-y-4">
          <h2 className="text-lg font-display font-semibold text-foreground">
            {tExplore("whatMood")}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {EXPLORE_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setFilters((prev) => ({
                      ...prev,
                      category: cat.category,
                      vibe: "all",
                    }));
                    setHighlightsFilterState(getInitialHighlightsFilters(cat));
                    setExploreView("list");
                  }}
                  className={cn(
                    "group flex flex-col p-4 sm:p-5 rounded-2xl text-left",
                    "bg-surface border border-border-app",
                    "hover:bg-surface-alt hover:border-border-medium",
                    "active:scale-[0.98] transition-all duration-150 touch-manipulation"
                  )}
                >
                  <div className="w-10 h-10 rounded-xl bg-accent-cyan/15 flex items-center justify-center mb-3 group-hover:bg-accent-cyan/25 transition-colors">
                    <Icon className="w-5 h-5 text-accent-cyan" strokeWidth={1.5} />
                  </div>
                  <span className="text-[15px] font-display font-semibold text-foreground">
                    {tExplore(`categories.${cat.id}`)}
                  </span>
                  <span className="text-[13px] text-muted-foreground mt-0.5">
                    {tExplore(`${cat.id}Blurb`)}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              setFilters({ category: "all", neighborhoods: [], vibe: "all", tags: [], ratingMin: undefined });
              setSearchQuery("");
              setHighlightsFilterState({ time: null, area: null, price: null, vibe: null });
              setExploreView("list");
            }}
            className={cn(
              "w-full flex flex-col p-4 sm:p-5 rounded-2xl text-left",
              "bg-surface border border-border-app",
              "hover:bg-surface-alt hover:border-border-medium",
              "active:scale-[0.98] transition-all duration-150 touch-manipulation"
            )}
          >
            <span className="text-[15px] font-display font-semibold text-foreground">
              {tExplore("seeAllPlaces")}
            </span>
            <span className="text-[13px] text-muted-foreground mt-0.5">
              {tExplore("browseAll")}
            </span>
          </button>
        </div>
      )}
      {((activeTab === "Explore" && !showExploreCategoryCards) || (activeTab === "My Places" && yourPlacesFiltered.length > 0)) && (
        <div className="space-y-4">
          {activeTab === "Explore" && !showExploreCategoryCards && (
            <CategoryHeader
              category={EXPLORE_CATEGORIES.find((c) => c.category === effectiveCategory) ?? null}
              cityName={preferences.home_city ?? "Buenos Aires"}
            />
          )}
          <div className="space-y-3">
          {displayList.map(({ primary, categories, highlightIds }) => {
            const savedId = getSavedHighlightId(highlightIds);
            const userState = getUserStateForVenue(primary.id, highlightIds);
            return (
              <HighlightCard
                key={primary.venue_id ?? primary.id}
                highlight={primary}
                categories={categories}
                onClick={() => {
                  setSelectedHighlightId(primary.id);
                  setSelectedConciergeSectionId(null);
                  setSelectedPlaceSaved(userState.isSaved);
                  setSelectedPlaceVisited(userState.isVisited);
                  setSelectedPlaceRating(userState.rating);
                  setSelectedUserTags(tagsByPlaceId[primary.id] ?? []);
                  setSelectedToggleSaveId(userState.isSaved ? savedId : primary.id);
                }}
                saved={userState.isSaved}
                isVisited={userState.isVisited}
                rating={userState.rating}
                onToggleSave={(e) => {
                  e?.stopPropagation();
                  toggleSave(userState.isSaved ? savedId : primary.id, userState.isSaved);
                }}
                onToggleVisited={(e) => {
                  e?.stopPropagation();
                  toggleVisited(primary.id, userState.isVisited);
                }}
                isAuthenticated={!!user}
              />
            );
          })}
          </div>
        </div>
      )}
      <FilterSheet
        open={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        filters={filters}
        onFiltersChange={setFilters}
        onApply={() => setFilterSheetOpen(false)}
        resultsCount={activeTab === "My Places" ? yourPlacesFiltered.length : filtered.length}
        preferredNeighborhoods={preferences.preferred_neighborhoods}
        neighborhoods={neighborhoods.length > 0 ? neighborhoods : undefined}
        showYourPlacesFilters={activeTab === "My Places" && !!user}
      />
      <ConciergeFilterSheet
        open={conciergeFilterOpen}
        onClose={() => setConciergeFilterOpen(false)}
        filters={conciergeFilters}
        onFiltersChange={setConciergeFilters}
        onApply={() => setConciergeFilterOpen(false)}
        hasFavoriteNeighborhoods={(preferences.preferred_neighborhoods?.length ?? 0) > 0}
      />
      <PlaceDetail
        highlightId={selectedHighlightId}
        onClose={() => {
          setSelectedHighlightId(null);
          setSelectedConciergeSectionId(null);
        }}
        saved={selectedPlaceSaved}
        isVisited={selectedPlaceVisited}
        rating={selectedPlaceRating}
        userTags={selectedUserTags}
        onToggleSave={
          selectedHighlightId && selectedToggleSaveId
            ? () => {
                toggleSave(selectedToggleSaveId, selectedPlaceSaved);
                setSelectedPlaceSaved(!selectedPlaceSaved);
              }
            : undefined
        }
        onVisitedChange={
          selectedHighlightId
            ? (visited) => {
                toggleVisited(selectedHighlightId, selectedPlaceVisited);
                setSelectedPlaceVisited(visited);
              }
            : undefined
        }
        onRatingChange={
          selectedHighlightId
            ? (rating) => {
                setUserStateByPlaceId((prev) => ({
                  ...prev,
                  [selectedHighlightId]: { ...prev[selectedHighlightId], isVisited: true, rating },
                }));
                setSelectedPlaceRating(rating);
              }
            : undefined
        }
        onTagsChange={
          selectedHighlightId
            ? (tags) => {
                setSelectedUserTags(tags);
                setTagsByPlaceId((prev) => ({ ...prev, [selectedHighlightId]: tags }));
              }
            : undefined
        }
        onReject={(() => {
          if (activeTab !== "Concierge" || !selectedConciergeSectionId || !conciergeData?.sections) return undefined;
          const section = conciergeData.sections.find((s) => s.id === selectedConciergeSectionId);
          const idx = conciergeSlotIndex[selectedConciergeSectionId] ?? 0;
          if (!section || idx + 1 >= section.items.length) return undefined;
          return () => {
            advanceConciergeSlot(selectedConciergeSectionId!);
            setSelectedHighlightId(null);
            setSelectedConciergeSectionId(null);
          };
        })()}
        isAuthenticated={!!user}
      />
      {activeTab === "Explore" && !showExploreCategoryCards && filtered.length === 0 && (
        <p className="text-center text-muted-foreground py-4 text-sm">{tExplore("noPlacesMatch")}</p>
      )}
    </div>
  );
}
