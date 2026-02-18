import { createClient } from "@/lib/supabase/server";
import { getDefaultCityNameFromDb } from "@/lib/cities-db";
import { NextResponse } from "next/server";
import {
  resolveTimeContext,
  buildConciergeSections,
  type ConciergeFilters,
  type TimeFilter,
} from "@/lib/concierge";
import type { PlaceForScoring } from "@/lib/concierge";
import type { Highlight } from "@/types/database";

function getVenue(highlight: Highlight): { id: string } | null {
  const v = highlight.venue;
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export async function GET(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const timeFilter = (searchParams.get("timeContext") as TimeFilter) ?? "today";
  const radius = searchParams.get("radius") as "near" | "city" | null;
  const typeGroup = searchParams.get("typeGroup") as "food_drink" | "culture" | "outdoors" | null;
  const favoriteNeighborhoodsOnly = searchParams.get("favoriteNeighborhoodsOnly") === "1";

  const now = new Date();
  const filterOverrides: ConciergeFilters = {
    timeFilter: ["today", "tonight", "this_week", "this_weekend"].includes(timeFilter) ? timeFilter : "today",
    radius: radius ?? undefined,
    typeGroup: typeGroup ?? undefined,
    favoriteNeighborhoodsOnly,
  };
  const timeContext = resolveTimeContext(filterOverrides.timeFilter!, now);
  const defaultCity = await getDefaultCityNameFromDb();

  const [{ data: userRow }, { data: prefs }, highlightsRes, { data: savedData }, { data: placeStateData }] = await Promise.all([
    supabase.from("users").select("home_city").eq("id", user.id).single(),
    supabase
      .from("user_preferences")
      .select(
        "home_neighborhood, preferred_neighborhoods, weekday_preferences, weekend_preferences, vibe_tags_preferred, interests, persona_type, budget_band"
      )
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("users")
      .select("home_city")
      .eq("id", user.id)
      .single()
      .then((r) =>
        supabase
          .from("highlights")
          .select("id, title, short_description, vibe_tags, concierge_rationale, category, neighborhood, avg_expected_price, venue_id, city, status, url, venue:venues(*)")
          .eq("status", "active")
          .eq("city", (r.data?.home_city as string) ?? defaultCity)
          .order("title")
      ),
    supabase
      .from("user_place_state")
      .select("place_id")
      .eq("user_id", user.id)
      .eq("is_saved", true),
    supabase
      .from("user_place_state")
      .select("place_id, rating")
      .eq("user_id", user.id),
  ]);

  const homeCity = (userRow?.home_city as string) ?? defaultCity;
  const rawHighlights = highlightsRes && !highlightsRes.error ? (highlightsRes.data ?? []) : [];
  const ratingsByHighlightId = new Map<string, number>();
  for (const row of placeStateData ?? []) {
    const r = row as { place_id: string; rating: number | null };
    if (r.rating != null) ratingsByHighlightId.set(r.place_id, r.rating);
  }
  const highlights = [...rawHighlights].sort((a, b) => {
    const va = Array.isArray(a.venue) ? a.venue[0] : a.venue;
    const vb = Array.isArray(b.venue) ? b.venue[0] : b.venue;
    const sa = (va as { quality_score?: number | null })?.quality_score ?? -1;
    const sb = (vb as { quality_score?: number | null })?.quality_score ?? -1;
    if (sa !== sb) return sb - sa;
    return (a.title ?? "").localeCompare(b.title ?? "");
  });
  const savedIds = new Set((savedData ?? []).map((s: { place_id: string }) => s.place_id));

  const byVenue = new Map<
    string,
    { primary: Highlight; categories: string[]; highlightIds: string[] }
  >();
  for (const h of highlights) {
    const vid = (h.venue_id ?? h.id) as string;
    const v = getVenue(h as Highlight);
    const key = v?.id ?? vid;
    const existing = byVenue.get(key);
    const cat = h.category as string;
    if (existing) {
      if (!existing.categories.includes(cat)) existing.categories.push(cat);
      existing.highlightIds.push(h.id);
    } else {
      byVenue.set(key, {
        primary: h as Highlight,
        categories: [cat],
        highlightIds: [h.id],
      });
    }
  }

  const places: PlaceForScoring[] = Array.from(byVenue.values()).map((v) => ({
    ...v,
    saved: v.highlightIds.some((id) => savedIds.has(id)),
  }));

  const preferredNeighborhoods = (prefs?.preferred_neighborhoods as string[]) ?? [];
  const userPrefs = {
    home_neighborhood: (prefs?.home_neighborhood as string) ?? preferredNeighborhoods[0] ?? null,
    preferred_neighborhoods: preferredNeighborhoods,
    weekday_preferences: (prefs?.weekday_preferences as string[]) ?? [],
    weekend_preferences: (prefs?.weekend_preferences as string[]) ?? [],
    vibe_tags_preferred: (prefs?.vibe_tags_preferred as string[]) ?? [],
    interests: (prefs?.interests as string[]) ?? [],
    persona_type: (prefs?.persona_type as "local" | "nomad" | "tourist") ?? null,
    budget_band: (prefs?.budget_band as "cheap" | "mid" | "splurge") ?? null,
  };

  const filteredPlaces = filterOverrides.favoriteNeighborhoodsOnly && preferredNeighborhoods.length > 0
    ? places.filter((p) => {
        const n = (p.primary.neighborhood ?? "").toLowerCase().trim();
        return preferredNeighborhoods.some((pn) => pn.toLowerCase().trim() === n);
      })
    : places;

  const result = buildConciergeSections(
    filteredPlaces,
    userPrefs,
    timeContext,
    savedIds,
    ratingsByHighlightId,
    filterOverrides
  );

  return NextResponse.json(result);
}
