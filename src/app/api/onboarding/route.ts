import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { validateSupportedCity } from "@/lib/cities";
import type { OnboardingData } from "@/components/onboarding-flow";

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data: OnboardingData = await req.json().catch(() => ({} as OnboardingData));
  const interests = Array.isArray(data.interests) && data.interests.length > 0
    ? data.interests
    : ["cafe", "parrilla", "cocktail_bar"];
  const preferred_neighborhoods = Array.isArray(data.preferred_neighborhoods)
    ? data.preferred_neighborhoods
    : data.primary_neighborhood
      ? [data.primary_neighborhood]
      : [];

  const rawCity = (data.home_city ?? "Buenos Aires").trim() || "Buenos Aires";
  const homeCity = validateSupportedCity(rawCity) ?? "Buenos Aires";
  const userCities = [{
    city: homeCity,
    primary_neighborhood: data.primary_neighborhood ?? null,
    primary_neighborhood_freeform: data.primary_neighborhood_freeform ?? null,
    is_home: true,
  }];

  await supabase.from("users").update({ home_city: homeCity }).eq("id", user.id);
  const { error } = await supabase.from("user_preferences").upsert(
    {
      user_id: user.id,
      primary_neighborhood: data.primary_neighborhood ?? null,
      primary_neighborhood_freeform: data.primary_neighborhood_freeform ?? null,
      user_cities: userCities,
      preferred_neighborhoods,
      persona_type: data.persona_type ?? null,
      weekday_preferences: data.weekday_preferences ?? [],
      weekend_preferences: data.weekend_preferences ?? [],
      interests,
      vibe_tags_preferred: data.vibe_tags_preferred ?? [],
      budget_band: data.budget_band ?? null,
      acquisition_source: data.acquisition_source ?? null,
      onboarding_completed_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
