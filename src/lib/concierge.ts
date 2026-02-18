/**
 * Concierge: time-aware scoring and section logic
 */
import type { Highlight } from "@/types/database";

/** Internal: derived from current date */
export type TimeContext = "weekday" | "weekend" | "sunday";

/** User-facing filter: Today, Tonight, This week, This weekend (CONCIERGE §6) */
export type TimeFilter = "today" | "tonight" | "this_week" | "this_weekend";

export function getTimeContext(now: Date): TimeContext {
  const d = now.getDay(); // 0=Sun..6=Sat
  if (d === 0) return "sunday";
  if (d === 5 || d === 6) return "weekend";
  return "weekday";
}

/** Resolve user filter to internal context. "today" uses current day; others are explicit. */
export function resolveTimeContext(filter: TimeFilter, now: Date): TimeContext {
  if (filter === "today") return getTimeContext(now);
  if (filter === "tonight") return getTimeContext(now); // tonight reuses day but sections focus evening
  if (filter === "this_week") return getTimeContext(now);
  if (filter === "this_weekend") {
    const d = now.getDay();
    return d === 0 ? "sunday" : "weekend";
  }
  return getTimeContext(now);
}

export interface ConciergeFilters {
  timeContextOverride?: TimeContext;
  timeFilter?: TimeFilter;
  radius?: "near" | "city";
  typeGroup?: "food_drink" | "culture" | "outdoors";
  favoriteNeighborhoodsOnly?: boolean;
}

export interface UserPrefs {
  home_neighborhood: string | null;
  preferred_neighborhoods?: string[];
  weekday_preferences: string[];
  weekend_preferences: string[];
  vibe_tags_preferred: string[];
  interests: string[];
  persona_type?: "local" | "nomad" | "tourist" | null;
  budget_band?: "cheap" | "mid" | "splurge" | null;
}

/** Map onboarding pref IDs to category slugs for scoring */
const WEEKDAY_PREF_TO_CATEGORIES: Record<string, string[]> = {
  cafes_work: ["cafe"],
  parks_walks: [],
  after_work_drinks: ["cocktail_bar", "wine_bar", "rooftop"],
  quiet_dinners: ["parrilla"],
  quick_lunch: ["parrilla", "heladeria"],
  culture: ["museum"],
  gym_fitness: [],
  shopping: [],
};
const WEEKEND_PREF_TO_CATEGORIES: Record<string, string[]> = {
  bars_nightlife: ["cocktail_bar", "tango_bar", "jazz_bar"],
  live_music: ["jazz_bar", "tango_bar"],
  food_spots: ["parrilla", "brunch", "heladeria"],
  brunch: ["brunch", "cafe"],
  day_trips: [],
  chill_cafes_parks: ["cafe"],
  markets: [],
  sports: [],
};

/** Map category -> category_group for time-context scoring */
const CATEGORY_GROUP: Record<string, string> = {
  parrilla: "food_drink",
  heladeria: "food_drink",
  brunch: "food_brunch",
  cafe: "cafe",
  cocktail_bar: "nightlife",
  rooftop: "nightlife",
  tango_bar: "nightlife",
  wine_bar: "nightlife",
  jazz_bar: "nightlife",
  museum: "culture",
  bookstore: "culture",
  park: "parks_outdoors",
};

function getCategoryGroup(category: string): string {
  return CATEGORY_GROUP[category] ?? "other";
}

/** Nearby neighborhoods for BA (static map) */
const NEARBY_NEIGHBORHOODS: Record<string, string[]> = {
  Palermo: ["Villa Crespo", "Colegiales", "Belgrano", "Recoleta"],
  Recoleta: ["Palermo", "Retiro", "Microcentro"],
  "San Telmo": ["La Boca", "Monserrat", "Puerto Madero", "Microcentro"],
  "La Boca": ["San Telmo", "Barracas"],
  Belgrano: ["Colegiales", "Nuñez", "Palermo"],
  "Villa Crespo": ["Palermo", "Caballito", "Almagro"],
  "Puerto Madero": ["San Telmo", "Retiro", "Microcentro"],
  Microcentro: ["Retiro", "San Nicolás", "Monserrat", "San Telmo"],
  Colegiales: ["Palermo", "Belgrano", "Villa Crespo"],
  Caballito: ["Almagro", "Villa Crespo", "Boedo"],
  Almagro: ["Caballito", "Villa Crespo", "Boedo"],
  Retiro: ["Recoleta", "Microcentro", "Puerto Madero"],
  Monserrat: ["San Telmo", "Microcentro", "San Nicolás"],
  "San Nicolás": ["Microcentro", "Retiro", "Monserrat"],
  Balvanera: ["Almagro", "Monserrat"],
  Boedo: ["Almagro", "Caballito"],
  Barracas: ["La Boca", "Constitución"],
  Constitución: ["Barracas", "San Telmo"],
  Nuñez: ["Belgrano"],
  Flores: ["Caballito", "Almagro"],
};

export function isNearbyNeighborhood(
  placeNeighborhood: string | null,
  userNeighborhood: string | null
): boolean {
  if (!placeNeighborhood || !userNeighborhood) return false;
  const nearby = NEARBY_NEIGHBORHOODS[userNeighborhood];
  return nearby?.some((n) => n.toLowerCase() === placeNeighborhood.toLowerCase()) ?? false;
}

/** Home + adjacent neighborhoods for Area filter "Near my neighborhood". */
export function getHomeAndAdjacentNeighborhoods(home: string | null): string[] {
  if (!home?.trim()) return [];
  const adj = NEARBY_NEIGHBORHOODS[home] ?? [];
  return [home, ...adj];
}

export interface PlaceForScoring {
  primary: Highlight;
  categories: string[];
  highlightIds: string[];
  saved?: boolean;
}

/** Affinity profile from saved + high-rated places for f_behavioral_affinity */
export interface AffinityProfile {
  categories: Set<string>;
  neighborhoods: Set<string>;
  vibeTags: Set<string>;
}

function getVenueQualityScore(primary: { venue?: { quality_score?: number | null } | { quality_score?: number | null }[] | null }): number {
  const v = primary.venue;
  const venue = Array.isArray(v) ? v[0] : v;
  const q = venue?.quality_score;
  return q != null && q >= 0 ? q : 0;
}

/** Budget band → approximate price range (USD) for f_budget_match */
const BUDGET_BAND_PRICE: Record<string, { min: number; max: number; ideal: number }> = {
  cheap: { min: 0, max: 15, ideal: 10 },
  mid: { min: 10, max: 40, ideal: 25 },
  splurge: { min: 30, max: 200, ideal: 80 },
};

function fBudgetMatch(budgetBand: string | null | undefined, venuePrice: number | null): number {
  if (!budgetBand) return 0;
  const band = BUDGET_BAND_PRICE[budgetBand];
  if (!band || venuePrice == null) return 0;
  if (venuePrice >= band.min && venuePrice <= band.max) return 15;
  const dist = Math.min(Math.abs(venuePrice - band.ideal), 50);
  return Math.max(0, 15 - dist / 5);
}

function buildAffinityProfile(
  places: PlaceForScoring[],
  savedIds: Set<string>,
  ratingsByHighlightId: Map<string, number>
): AffinityProfile {
  const categories = new Set<string>();
  const neighborhoods = new Set<string>();
  const vibeTags = new Set<string>();
  for (const p of places) {
    const isSaved = p.highlightIds.some((id) => savedIds.has(id));
    const ratedId = p.highlightIds.find((id) => ratingsByHighlightId.has(id));
    const rating = ratedId != null ? ratingsByHighlightId.get(ratedId) : undefined;
    if (isSaved || (rating != null && rating >= 4)) {
      p.categories.forEach((c) => categories.add(c));
      if (p.primary.neighborhood) neighborhoods.add(p.primary.neighborhood.toLowerCase());
      for (const t of Array.isArray(p.primary.vibe_tags) ? (p.primary.vibe_tags as string[]) : []) {
        vibeTags.add(String(t).toLowerCase());
      }
    }
  }
  return { categories, neighborhoods, vibeTags };
}

export function scorePlace(
  place: PlaceForScoring,
  user: UserPrefs,
  timeContext: TimeContext,
  filterOverrides: ConciergeFilters = {},
  ratingsByHighlightId?: Map<string, number>,
  affinityProfile?: AffinityProfile
): number {
  let score = 0;
  const { primary, categories, highlightIds } = place;
  const category = primary.category;
  const categoryGroup = getCategoryGroup(category);
  const neighborhood = primary.neighborhood ?? "";
  const vibeTags = Array.isArray(primary.vibe_tags) ? (primary.vibe_tags as string[]) : [];
  const venuePrice = primary.avg_expected_price ?? null;

  // User rated this place low → downweight; high → re-surface favorites
  if (ratingsByHighlightId?.size && highlightIds?.length) {
    const ratedId = highlightIds.find((id) => ratingsByHighlightId.has(id));
    const userRating = ratedId != null ? ratingsByHighlightId.get(ratedId) : undefined;
    if (userRating != null && userRating <= 2) score -= 30;
    if (userRating != null && userRating >= 4) score += 10;
  }

  // Quality score (0-100) adds up to 20 points
  const qualityScore = getVenueQualityScore(primary);
  score += (qualityScore / 100) * 20;

  // Budget match
  score += fBudgetMatch(user.budget_band, venuePrice);

  const prefs =
    timeContext === "weekday"
      ? user.weekday_preferences ?? []
      : user.weekend_preferences ?? [];
  const prefToCat =
    timeContext === "weekday" ? WEEKDAY_PREF_TO_CATEGORIES : WEEKEND_PREF_TO_CATEGORIES;
  const prefCategories = new Set(prefs.flatMap((p) => prefToCat[p] ?? []));
  if (prefCategories.size > 0 && categories.some((c) => prefCategories.has(c))) score += 30;
  if (user.interests?.length && user.interests.some((i) => categories.includes(i))) score += 20;

  const favs = user.preferred_neighborhoods ?? (user.home_neighborhood ? [user.home_neighborhood] : []);
  if (neighborhood && favs.length > 0) {
    const nLower = neighborhood.toLowerCase();
    const exactMatch = favs.some((f) => f.toLowerCase() === nLower);
    const nearbyMatch = user.home_neighborhood && isNearbyNeighborhood(neighborhood, user.home_neighborhood);
    let locationBonus = 0;
    if (exactMatch) locationBonus = 25;
    else if (nearbyMatch) locationBonus = 10;
    // Persona-aware: local prefers near, tourist explores city-wide
    const persona = user.persona_type ?? "nomad";
    if (persona === "local" && (exactMatch || nearbyMatch)) locationBonus = Math.round(locationBonus * 1.2);
    if (persona === "tourist" && !exactMatch && !nearbyMatch) locationBonus = 5; // less penalty for far
    score += locationBonus;
  }

  const vibeOverlap = (user.vibe_tags_preferred ?? []).filter((v) =>
    vibeTags.some((t) => String(t).toLowerCase() === String(v).toLowerCase())
  ).length;
  score += vibeOverlap * 5;

  // Behavioral affinity: boost venues similar to saved/high-rated
  if (affinityProfile) {
    const catOverlap = categories.some((c) => affinityProfile.categories.has(c));
    const hoodMatch = neighborhood && affinityProfile.neighborhoods.has(neighborhood.toLowerCase());
    const vibeMatch = vibeTags.some((t) => affinityProfile.vibeTags.has(String(t).toLowerCase()));
    if (catOverlap) score += 12;
    if (hoodMatch) score += 8;
    if (vibeMatch) score += 5;
  }

  if (timeContext === "sunday") {
    if (categoryGroup === "food_brunch" || category === "brunch") score += 15;
    if (categoryGroup === "parks_outdoors" || categoryGroup === "culture") score += 10;
  }
  if (timeContext === "weekend") {
    if (categoryGroup === "nightlife") score += 15;
  }

  if (filterOverrides.radius === "near" && user.home_neighborhood) {
    if (neighborhood.toLowerCase() === user.home_neighborhood.toLowerCase()) score += 15;
    else if (isNearbyNeighborhood(neighborhood, user.home_neighborhood)) score += 8;
  }
  if (filterOverrides.radius === "city") {
    // Tourist persona: less penalty for city-wide
    const persona = user.persona_type ?? "nomad";
    score -= persona === "tourist" ? 2 : 5;
  }
  if (filterOverrides.typeGroup) {
    const g = filterOverrides.typeGroup;
    if (g === "food_drink" && (categoryGroup === "food_drink" || categoryGroup === "food_brunch" || categoryGroup === "cafe")) score += 12;
    if (g === "culture" && categoryGroup === "culture") score += 12;
    if (g === "outdoors" && categoryGroup === "parks_outdoors") score += 12;
  }
  return score;
}

export interface ConciergeSection {
  id: string;
  title: string;
  items: PlaceForScoring[];
}

function buildSections(
  places: PlaceForScoring[],
  user: UserPrefs,
  timeContext: TimeContext,
  savedIds: Set<string>,
  ratingsByHighlightId: Map<string, number>,
  affinityProfile: AffinityProfile,
  filterOverrides: ConciergeFilters
): ConciergeSection[] {
  const scored = places.map((p) => ({
    place: p,
    score: scorePlace(p, user, timeContext, filterOverrides, ratingsByHighlightId, affinityProfile),
  }));
  scored.sort((a, b) => b.score - a.score);

  const CANDIDATES_PER_SLOT = 8; // Support "Not this one" cycling
  const homeNeighborhood = user.home_neighborhood ?? "";
  const isNear = (n: string | null) =>
    n && homeNeighborhood && (n.toLowerCase() === homeNeighborhood.toLowerCase() || isNearbyNeighborhood(n, homeNeighborhood));

  const isTonight = filterOverrides.timeFilter === "tonight";

  if (timeContext === "weekday") {
    const nearHome = scored
      .filter(({ place }) => homeNeighborhood && place.primary.neighborhood?.toLowerCase() === homeNeighborhood.toLowerCase())
      .slice(0, CANDIDATES_PER_SLOT)
      .map((s) => s.place);
    const nightlife = scored
      .filter(({ place }) => getCategoryGroup(place.primary.category) === "nightlife")
      .filter(({ place }) => !homeNeighborhood || isNear(place.primary.neighborhood))
      .slice(0, CANDIDATES_PER_SLOT)
      .map((s) => s.place);
    const dinner = scored
      .filter(({ place }) => getCategoryGroup(place.primary.category) === "food_drink" || getCategoryGroup(place.primary.category) === "food_brunch")
      .filter(({ place }) => !homeNeighborhood || isNear(place.primary.neighborhood))
      .slice(0, CANDIDATES_PER_SLOT)
      .map((s) => s.place);
    const cafe = scored
      .filter(({ place }) => place.primary.category === "cafe" || getCategoryGroup(place.primary.category) === "cafe")
      .filter(({ place }) => !place.highlightIds.some((id) => savedIds.has(id)))
      .slice(0, CANDIDATES_PER_SLOT)
      .map((s) => s.place);
    // Tonight: dinner + drinks focus; Today: near home + drinks + cafe
    if (isTonight) {
      return [
        { id: "tonight_dinner", title: "Dinner tonight", items: dinner },
        { id: "tonight_drinks", title: "After dinner", items: nightlife },
      ].filter((s) => s.items.length > 0);
    }
    return [
      { id: "near_home_today", title: "Near you today", items: nearHome },
      { id: "after_work_drinks", title: "After-work drinks", items: nightlife },
      { id: "try_a_new_cafe", title: "Try a new café", items: cafe },
    ].filter((s) => s.items.length > 0);
  }

  if (timeContext === "weekend") {
    const nightlife = scored
      .filter(({ place }) => getCategoryGroup(place.primary.category) === "nightlife")
      .slice(0, CANDIDATES_PER_SLOT)
      .map((s) => s.place);
    const dinner = scored
      .filter(({ place }) => getCategoryGroup(place.primary.category) === "food_drink" || getCategoryGroup(place.primary.category) === "food_brunch")
      .slice(0, CANDIDATES_PER_SLOT)
      .map((s) => s.place);
    if (isTonight) {
      return [
        { id: "weekend_tonight_dinner", title: "Dinner tonight", items: dinner },
        { id: "weekend_tonight_nightlife", title: "Bars & nightlife", items: nightlife },
      ].filter((s) => s.items.length > 0);
    }
    const shortlist = scored.slice(0, CANDIDATES_PER_SLOT).map((s) => s.place);
    const otherBarrios: PlaceForScoring[] = [];
    const seenHoods = new Map<string, number>();
    for (const { place } of scored) {
      if (place.primary.neighborhood?.toLowerCase() === homeNeighborhood.toLowerCase()) continue;
      const hood = place.primary.neighborhood ?? "";
      if (!hood || otherBarrios.length >= 4) break;
      const count = seenHoods.get(hood) ?? 0;
      if (count < 2) {
        otherBarrios.push(place);
        seenHoods.set(hood, count + 1);
      }
    }
    return [
      { id: "weekend_shortlist", title: "Weekend shortlist", items: shortlist },
      { id: "explore_another_barrio", title: "Explore another barrio", items: otherBarrios },
    ].filter((s) => s.items.length > 0);
  }

  if (timeContext === "sunday") {
    const brunch = scored
      .filter(
        (s) => s.place.primary.category === "brunch" || s.place.primary.category === "cafe" || getCategoryGroup(s.place.primary.category) === "food_brunch"
      )
      .slice(0, CANDIDATES_PER_SLOT)
      .map((s) => s.place);
    const parks = scored
      .filter((s) => getCategoryGroup(s.place.primary.category) === "parks_outdoors" || s.place.primary.category === "cafe")
      .slice(0, CANDIDATES_PER_SLOT)
      .map((s) => s.place);
    const culture = scored
      .filter((s) => getCategoryGroup(s.place.primary.category) === "culture")
      .slice(0, CANDIDATES_PER_SLOT)
      .map((s) => s.place);
    if (isTonight) {
      const dinner = scored
        .filter((s) => getCategoryGroup(s.place.primary.category) === "food_drink" || getCategoryGroup(s.place.primary.category) === "food_brunch")
        .slice(0, CANDIDATES_PER_SLOT)
        .map((s) => s.place);
      return [
        { id: "sunday_tonight_dinner", title: "Low-key dinner", items: dinner },
      ].filter((s) => s.items.length > 0);
    }
    return [
      { id: "sunday_brunch_and_cafes", title: "Sunday brunch & cafés", items: brunch },
      { id: "sunday_parks_and_walks", title: "Parks & walks", items: parks },
      { id: "slow_culture", title: "Slow culture picks", items: culture },
    ].filter((s) => s.items.length > 0);
  }

  return [];
}

export function buildConciergeSections(
  places: PlaceForScoring[],
  user: UserPrefs,
  timeContext: TimeContext,
  savedIds: Set<string>,
  ratingsByHighlightId: Map<string, number> = new Map(),
  filterOverrides: ConciergeFilters = {}
): { time_context: TimeContext; time_filter: TimeFilter; sections: ConciergeSection[] } {
  const affinityProfile = buildAffinityProfile(places, savedIds, ratingsByHighlightId);
  const sections = buildSections(places, user, timeContext, savedIds, ratingsByHighlightId, affinityProfile, filterOverrides);
  return {
    time_context: timeContext,
    time_filter: filterOverrides.timeFilter ?? "today",
    sections,
  };
}
