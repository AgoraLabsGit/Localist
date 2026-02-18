import { createClient } from "@/lib/supabase/server";
import { getDefaultCityNameFromDb, validateCityFromDb } from "@/lib/cities-db";
import { migrateLocalityVibes, stripLocalityVibes } from "@/lib/vibe-migration";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const defaultCity = await getDefaultCityNameFromDb();
  const [prefsRes, userRes] = await Promise.all([
    supabase
      .from("user_preferences")
      .select("preferred_neighborhoods, interests, home_neighborhood, primary_neighborhood_freeform, user_cities, persona_type, weekday_preferences, weekend_preferences, vibe_tags_preferred, budget_band, weekly_outing_target, preferred_time_blocks, typical_group_type, primary_categories, secondary_categories, touristy_vs_local_preference, dietary_flags, alcohol_preference, radius_preference, exploration_style")
      .eq("user_id", user.id)
      .single(),
    supabase.from("users").select("home_city").eq("id", user.id).single(),
  ]);

  if (prefsRes.error && prefsRes.error.code !== "PGRST116") {
    return NextResponse.json({ error: prefsRes.error.message }, { status: 500 });
  }

  const homeCity = (userRes.data?.home_city as string) ?? defaultCity;
  const userCities = (prefsRes.data?.user_cities as Array<{ city: string; primary_neighborhood: string | null; primary_neighborhood_freeform: string | null; is_home: boolean }>) ?? [];

  return NextResponse.json({
    preferred_neighborhoods: (prefsRes.data?.preferred_neighborhoods as string[]) ?? [],
    interests: (prefsRes.data?.interests as string[]) ?? [],
    home_city: homeCity,
    home_neighborhood: (prefsRes.data?.home_neighborhood as string) ?? null,
    primary_neighborhood_freeform: (prefsRes.data?.primary_neighborhood_freeform as string) ?? null,
    user_cities: userCities.length > 0 ? userCities : [{ city: homeCity, primary_neighborhood: null, primary_neighborhood_freeform: null, is_home: true }],
    persona_type: (prefsRes.data?.persona_type as string) ?? null,
    weekday_preferences: (prefsRes.data?.weekday_preferences as string[]) ?? [],
    weekend_preferences: (prefsRes.data?.weekend_preferences as string[]) ?? [],
    vibe_tags_preferred: stripLocalityVibes((prefsRes.data?.vibe_tags_preferred as string[]) ?? []),
    budget_band: (prefsRes.data?.budget_band as string) ?? null,
    weekly_outing_target: (prefsRes.data?.weekly_outing_target as number) ?? null,
    preferred_time_blocks: (prefsRes.data?.preferred_time_blocks as string[]) ?? [],
    typical_group_type: (prefsRes.data?.typical_group_type as string) ?? null,
    primary_categories: (prefsRes.data?.primary_categories as string[]) ?? [],
    secondary_categories: (prefsRes.data?.secondary_categories as string[]) ?? [],
    touristy_vs_local_preference: (prefsRes.data?.touristy_vs_local_preference as string) ?? null,
    dietary_flags: (prefsRes.data?.dietary_flags as string[]) ?? [],
    alcohol_preference: (prefsRes.data?.alcohol_preference as string) ?? null,
    radius_preference: (prefsRes.data?.radius_preference as string) ?? null,
    exploration_style: (prefsRes.data?.exploration_style as string) ?? null,
  });
}

export async function PATCH(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const preferred_neighborhoods = body.preferred_neighborhoods;
  const interests = body.interests;
  const home_city = body.home_city;
  const home_neighborhood = body.home_neighborhood;
  const primary_neighborhood_freeform = body.primary_neighborhood_freeform;
  const persona_type = body.persona_type;
  const weekday_preferences = body.weekday_preferences;
  const weekend_preferences = body.weekend_preferences;
  const vibe_tags_preferred = body.vibe_tags_preferred;
  const budget_band = body.budget_band;
  const weekly_outing_target = body.weekly_outing_target;
  const preferred_time_blocks = body.preferred_time_blocks;
  const typical_group_type = body.typical_group_type;
  const primary_categories = body.primary_categories;
  const secondary_categories = body.secondary_categories;
  const touristy_vs_local_preference = body.touristy_vs_local_preference;
  const dietary_flags = body.dietary_flags;
  const alcohol_preference = body.alcohol_preference;
  const radius_preference = body.radius_preference;
  const exploration_style = body.exploration_style;

  const prefUpdates: Record<string, unknown> = {};

  // Migrate locality vibes (touristy, local, hidden_gem, local_favorite) → touristy_vs_local_preference
  let cleanedVibes: string[] | undefined;
  if (Array.isArray(vibe_tags_preferred)) {
    const migrated = migrateLocalityVibes(vibe_tags_preferred);
    cleanedVibes = migrated.vibe_tags_preferred;
    if (migrated.touristy_vs_local_preference !== undefined) {
      prefUpdates.touristy_vs_local_preference = migrated.touristy_vs_local_preference;
    }
  }

  if (Array.isArray(preferred_neighborhoods)) prefUpdates.preferred_neighborhoods = preferred_neighborhoods;
  if (Array.isArray(interests)) prefUpdates.interests = interests;
  if (home_neighborhood !== undefined) prefUpdates.home_neighborhood = home_neighborhood ?? null;
  if (primary_neighborhood_freeform !== undefined) prefUpdates.primary_neighborhood_freeform = primary_neighborhood_freeform ?? null;
  if (persona_type !== undefined) prefUpdates.persona_type = persona_type === "local" || persona_type === "nomad" || persona_type === "tourist" ? persona_type : null;
  if (Array.isArray(weekday_preferences)) prefUpdates.weekday_preferences = weekday_preferences;
  if (Array.isArray(weekend_preferences)) prefUpdates.weekend_preferences = weekend_preferences;
  if (cleanedVibes !== undefined) prefUpdates.vibe_tags_preferred = cleanedVibes;
  if (budget_band !== undefined) prefUpdates.budget_band = budget_band === "cheap" || budget_band === "mid" || budget_band === "splurge" ? budget_band : null;
  if (weekly_outing_target !== undefined) prefUpdates.weekly_outing_target = weekly_outing_target == null || (Number.isInteger(weekly_outing_target) && weekly_outing_target >= 1 && weekly_outing_target <= 7) ? weekly_outing_target : null;
  if (Array.isArray(preferred_time_blocks)) prefUpdates.preferred_time_blocks = preferred_time_blocks;
  if (typical_group_type !== undefined) prefUpdates.typical_group_type = ["solo", "couple", "friends", "mixed", "depends"].includes(typical_group_type) ? typical_group_type : null;
  if (Array.isArray(primary_categories)) prefUpdates.primary_categories = primary_categories;
  if (Array.isArray(secondary_categories)) prefUpdates.secondary_categories = secondary_categories;
  if (touristy_vs_local_preference !== undefined) prefUpdates.touristy_vs_local_preference = ["touristy_ok", "balanced", "local_only"].includes(touristy_vs_local_preference) ? touristy_vs_local_preference : null;
  if (Array.isArray(dietary_flags)) prefUpdates.dietary_flags = dietary_flags;
  if (alcohol_preference !== undefined) prefUpdates.alcohol_preference = ["okay", "lowkey", "avoid"].includes(alcohol_preference) ? alcohol_preference : null;
  if (radius_preference !== undefined) prefUpdates.radius_preference = ["near_home", "few_barrios", "whole_city"].includes(radius_preference) ? radius_preference : null;
  if (exploration_style !== undefined) prefUpdates.exploration_style = ["favorites", "balanced", "adventurous"].includes(exploration_style) ? exploration_style : null;

  const rawCity = typeof home_city === "string" ? home_city.trim() : "";
  const validatedCity = rawCity ? await validateCityFromDb(rawCity) : null;
  if (validatedCity === null && rawCity) {
    return NextResponse.json({ error: "Unsupported city" }, { status: 400 });
  }
  const newHomeCity = validatedCity ?? (rawCity ? rawCity : null);

  const locationChanged =
    home_neighborhood !== undefined ||
    primary_neighborhood_freeform !== undefined ||
    newHomeCity !== null;

  if (locationChanged) {
    const [{ data: userRow }, { data: prefRow }] = await Promise.all([
      supabase.from("users").select("home_city").eq("id", user.id).single(),
      supabase.from("user_preferences").select("home_neighborhood, primary_neighborhood_freeform").eq("user_id", user.id).single(),
    ]);
    const defaultCity = await getDefaultCityNameFromDb();
    const city = newHomeCity ?? (userRow?.home_city as string) ?? defaultCity;
    const hn = home_neighborhood !== undefined ? home_neighborhood ?? null : (prefRow?.home_neighborhood as string) ?? null;
    const pnf = primary_neighborhood_freeform !== undefined ? primary_neighborhood_freeform ?? null : (prefRow?.primary_neighborhood_freeform as string) ?? null;
    prefUpdates.user_cities = [{ city, primary_neighborhood: hn, primary_neighborhood_freeform: pnf, is_home: true }];
  }

  if (newHomeCity) {
    await supabase.from("users").update({ home_city: newHomeCity }).eq("id", user.id);
  }

  if (Object.keys(prefUpdates).length === 0 && !newHomeCity) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  if (Object.keys(prefUpdates).length > 0) {
    const { error } = await supabase
      .from("user_preferences")
      .upsert(
        { user_id: user.id, ...prefUpdates },
        { onConflict: "user_id" }
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
