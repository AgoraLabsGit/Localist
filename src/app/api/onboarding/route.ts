import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { validateCityFromDb } from "@/lib/cities-db";
import { migrateLocalityVibes } from "@/lib/vibe-migration";
import type { OnboardingData } from "@/components/onboarding-flow";

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data: OnboardingData = await req.json().catch(() => ({} as OnboardingData));
  const interests = Array.isArray(data.interests) && data.interests.length > 0
    ? data.interests
    : ["cafe", "parrilla", "cocktail_bar"];
  const preferred_neighborhoods =
    Array.isArray(data.preferred_neighborhoods) && data.preferred_neighborhoods.length > 0
      ? data.preferred_neighborhoods
      : data.home_neighborhood
        ? [data.home_neighborhood]
        : [];
  // primary ⊂ interests; secondary = interests − primary
  const rawPrimary = Array.isArray(data.primary_categories) ? data.primary_categories : [];
  const primary_categories = rawPrimary.filter((x) => interests.includes(x)).slice(0, 2);
  const secondary_categories = interests.filter((x) => !primary_categories.includes(x));

  const { getDefaultCityNameFromDb } = await import("@/lib/cities-db");
  const defaultCity = await getDefaultCityNameFromDb();
  const rawCity = (data.home_city ?? defaultCity).trim() || defaultCity;
  const homeCity = (await validateCityFromDb(rawCity)) ?? defaultCity;
  const home_neighborhood = data.home_neighborhood ?? null;
  const userCities = [{
    city: homeCity,
    primary_neighborhood: home_neighborhood ?? preferred_neighborhoods[0] ?? null,
    primary_neighborhood_freeform: null,
    is_home: true,
  }];

  // Migrate locality vibes → touristy_vs_local_preference, strip from vibe_tags_preferred
  const rawVibes = data.vibe_tags_preferred ?? [];
  const migrated = migrateLocalityVibes(rawVibes);
  const vibe_tags_preferred = migrated.vibe_tags_preferred;
  const touristy_vs_local_preference =
    migrated.touristy_vs_local_preference ?? data.touristy_vs_local_preference ?? "balanced";

  const store = await cookies();
  const locale = store.get("locale")?.value;
  const lang = locale && ["en", "es"].includes(locale) ? locale : "en";

  await supabase
    .from("users")
    .update({ home_city: homeCity, language: lang })
    .eq("id", user.id);
  const { error } = await supabase.from("user_preferences").upsert(
    {
      user_id: user.id,
      home_neighborhood,
      user_cities: userCities,
      preferred_neighborhoods,
      persona_type: data.persona_type ?? null,
      weekly_outing_target: data.weekly_outing_target ?? null,
      preferred_time_blocks: Array.isArray(data.preferred_time_blocks) && data.preferred_time_blocks.length > 0 ? data.preferred_time_blocks : ["weekday_evenings", "weekend_afternoons"],
      typical_group_type: data.typical_group_type ?? null,
      interests,
      primary_categories,
      secondary_categories,
      vibe_tags_preferred,
      budget_band: data.budget_band ?? null,
      touristy_vs_local_preference,
      dietary_flags: data.dietary_flags ?? [],
      alcohol_preference: data.alcohol_preference ?? null,
      radius_preference: data.radius_preference ?? "few_barrios",
      exploration_style: data.exploration_style ?? null,
      acquisition_source: data.acquisition_source ?? null,
      onboarding_completed_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
