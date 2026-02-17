/**
 * Concierge: time-aware scoring and section logic
 */
import type { Highlight } from "@/types/database";

export type TimeContext = "weekday" | "weekend" | "sunday";

export function getTimeContext(now: Date): TimeContext {
  const d = now.getDay(); // 0=Sun..6=Sat
  if (d === 0) return "sunday";
  if (d === 5 || d === 6) return "weekend";
  return "weekday";
}

export interface ConciergeFilters {
  timeContextOverride?: TimeContext;
  radius?: "near" | "city";
  typeGroup?: "food_drink" | "culture" | "outdoors";
}

export interface UserPrefs {
  primary_neighborhood: string | null;
  weekday_preferences: string[];
  weekend_preferences: string[];
  vibe_tags_preferred: string[];
  interests: string[];
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

export interface PlaceForScoring {
  primary: Highlight;
  categories: string[];
  highlightIds: string[];
  saved?: boolean;
}

function getVenueQualityScore(primary: { venue?: { quality_score?: number | null } | { quality_score?: number | null }[] | null }): number {
  const v = primary.venue;
  const venue = Array.isArray(v) ? v[0] : v;
  const q = venue?.quality_score;
  return q != null && q >= 0 ? q : 0;
}

export function scorePlace(
  place: PlaceForScoring,
  user: UserPrefs,
  timeContext: TimeContext,
  filterOverrides: ConciergeFilters = {}
): number {
  let score = 0;
  const { primary, categories } = place;
  const category = primary.category;
  const categoryGroup = getCategoryGroup(category);
  const neighborhood = primary.neighborhood ?? "";
  const vibeTags = Array.isArray(primary.vibe_tags) ? (primary.vibe_tags as string[]) : [];

  // Quality score (0-100) adds up to 20 points
  const qualityScore = getVenueQualityScore(primary);
  score += (qualityScore / 100) * 20;

  const prefs =
    timeContext === "weekday"
      ? user.weekday_preferences ?? []
      : user.weekend_preferences ?? [];
  const prefToCat =
    timeContext === "weekday" ? WEEKDAY_PREF_TO_CATEGORIES : WEEKEND_PREF_TO_CATEGORIES;
  const prefCategories = new Set(prefs.flatMap((p) => prefToCat[p] ?? []));
  if (prefCategories.size > 0 && categories.some((c) => prefCategories.has(c))) score += 30;
  if (user.interests?.length && user.interests.some((i) => categories.includes(i))) score += 20;

  if (neighborhood && user.primary_neighborhood) {
    if (neighborhood.toLowerCase() === user.primary_neighborhood.toLowerCase()) score += 25;
    else if (isNearbyNeighborhood(neighborhood, user.primary_neighborhood)) score += 10;
  }

  const vibeOverlap = (user.vibe_tags_preferred ?? []).filter((v) =>
    vibeTags.some((t) => String(t).toLowerCase() === String(v).toLowerCase())
  ).length;
  score += vibeOverlap * 5;

  if (timeContext === "sunday") {
    if (categoryGroup === "food_brunch" || category === "brunch") score += 15;
    if (categoryGroup === "parks_outdoors" || categoryGroup === "culture") score += 10;
  }
  if (timeContext === "weekend") {
    if (categoryGroup === "nightlife") score += 15;
  }

  if (filterOverrides.radius === "near" && user.primary_neighborhood) {
    if (neighborhood.toLowerCase() === user.primary_neighborhood.toLowerCase()) score += 15;
    else if (isNearbyNeighborhood(neighborhood, user.primary_neighborhood)) score += 8;
  }
  if (filterOverrides.radius === "city") {
    score -= 5;
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
  filterOverrides: ConciergeFilters
): ConciergeSection[] {
  const scored = places.map((p) => ({
    place: p,
    score: scorePlace(p, user, timeContext, filterOverrides),
  }));
  scored.sort((a, b) => b.score - a.score);

  const primaryNeighborhood = user.primary_neighborhood ?? "";
  const isNear = (n: string | null) =>
    n && primaryNeighborhood && (n.toLowerCase() === primaryNeighborhood.toLowerCase() || isNearbyNeighborhood(n, primaryNeighborhood));

  if (timeContext === "weekday") {
    const nearHome = scored
      .filter(({ place }) => primaryNeighborhood && place.primary.neighborhood?.toLowerCase() === primaryNeighborhood.toLowerCase())
      .slice(0, 5)
      .map((s) => s.place);
    const nightlife = scored
      .filter(({ place }) => getCategoryGroup(place.primary.category) === "nightlife")
      .filter(({ place }) => !primaryNeighborhood || isNear(place.primary.neighborhood))
      .slice(0, 5)
      .map((s) => s.place);
    const cafe = scored
      .filter(({ place }) => place.primary.category === "cafe" || getCategoryGroup(place.primary.category) === "cafe")
      .filter(({ place }) => !place.highlightIds.some((id) => savedIds.has(id)))
      .slice(0, 5)
      .map((s) => s.place);
    return [
      { id: "near_home_today", title: "Near you today", items: nearHome },
      { id: "after_work_drinks", title: "After-work drinks", items: nightlife },
      { id: "try_a_new_cafe", title: "Try a new café", items: cafe },
    ].filter((s) => s.items.length > 0);
  }

  if (timeContext === "weekend") {
    const shortlist = scored.slice(0, 8).map((s) => s.place);
    const otherBarrios: PlaceForScoring[] = [];
    const seenHoods = new Map<string, number>();
    for (const { place } of scored) {
      if (place.primary.neighborhood?.toLowerCase() === primaryNeighborhood.toLowerCase()) continue;
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
      .slice(0, 5)
      .map((s) => s.place);
    const parks = scored
      .filter((s) => getCategoryGroup(s.place.primary.category) === "parks_outdoors" || s.place.primary.category === "cafe")
      .slice(0, 5)
      .map((s) => s.place);
    const culture = scored
      .filter((s) => getCategoryGroup(s.place.primary.category) === "culture")
      .slice(0, 5)
      .map((s) => s.place);
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
  filterOverrides: ConciergeFilters = {}
): { time_context: TimeContext; sections: ConciergeSection[] } {
  const sections = buildSections(places, user, timeContext, savedIds, filterOverrides);
  return { time_context: timeContext, sections };
}
