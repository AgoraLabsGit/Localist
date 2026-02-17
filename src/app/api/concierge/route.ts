import { createClient } from "@/lib/supabase/server";
import { getDefaultCityNameFromDb } from "@/lib/cities-db";
import { NextResponse } from "next/server";
import {
  getTimeContext,
  buildConciergeSections,
  type ConciergeFilters,
  type TimeContext,
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
  const timeOverride = searchParams.get("timeContext") as TimeContext | null;
  const radius = searchParams.get("radius") as "near" | "city" | null;
  const typeGroup = searchParams.get("typeGroup") as "food_drink" | "culture" | "outdoors" | null;

  const filterOverrides: ConciergeFilters = {};
  if (timeOverride && ["weekday", "weekend", "sunday"].includes(timeOverride)) {
    filterOverrides.timeContextOverride = timeOverride;
  }
  if (radius) filterOverrides.radius = radius;
  if (typeGroup) filterOverrides.typeGroup = typeGroup;

  const timeContext = filterOverrides.timeContextOverride ?? getTimeContext(new Date());
  const defaultCity = await getDefaultCityNameFromDb();

  const [{ data: userRow }, { data: prefs }, highlightsRes, { data: savedData }] = await Promise.all([
    supabase.from("users").select("home_city").eq("id", user.id).single(),
    supabase
      .from("user_preferences")
      .select(
        "primary_neighborhood, weekday_preferences, weekend_preferences, vibe_tags_preferred, interests"
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
          .select("*, venue:venues(*)")
          .eq("status", "active")
          .eq("city", (r.data?.home_city as string) ?? defaultCity)
          .order("title")
      ),
    supabase
      .from("saved_items")
      .select("target_id")
      .eq("user_id", user.id)
      .eq("target_type", "highlight"),
  ]);

  const homeCity = (userRow?.home_city as string) ?? defaultCity;
  const rawHighlights = highlightsRes && !highlightsRes.error ? (highlightsRes.data ?? []) : [];
  const highlights = [...rawHighlights].sort((a, b) => {
    const va = Array.isArray(a.venue) ? a.venue[0] : a.venue;
    const vb = Array.isArray(b.venue) ? b.venue[0] : b.venue;
    const sa = (va as { quality_score?: number | null })?.quality_score ?? -1;
    const sb = (vb as { quality_score?: number | null })?.quality_score ?? -1;
    if (sa !== sb) return sb - sa;
    return (a.title ?? "").localeCompare(b.title ?? "");
  });
  const savedIds = new Set((savedData ?? []).map((s: { target_id: string }) => s.target_id));

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

  const userPrefs = {
    primary_neighborhood: (prefs?.primary_neighborhood as string) ?? null,
    weekday_preferences: (prefs?.weekday_preferences as string[]) ?? [],
    weekend_preferences: (prefs?.weekend_preferences as string[]) ?? [],
    vibe_tags_preferred: (prefs?.vibe_tags_preferred as string[]) ?? [],
    interests: (prefs?.interests as string[]) ?? [],
  };

  const result = buildConciergeSections(
    places,
    userPrefs,
    timeContext,
    savedIds,
    filterOverrides
  );

  return NextResponse.json(result);
}
