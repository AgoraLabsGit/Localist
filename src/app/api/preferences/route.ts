import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { validateSupportedCity } from "@/lib/cities";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [prefsRes, userRes] = await Promise.all([
    supabase
      .from("user_preferences")
      .select("preferred_neighborhoods, interests, primary_neighborhood, primary_neighborhood_freeform, user_cities")
      .eq("user_id", user.id)
      .single(),
    supabase.from("users").select("home_city").eq("id", user.id).single(),
  ]);

  if (prefsRes.error && prefsRes.error.code !== "PGRST116") {
    return NextResponse.json({ error: prefsRes.error.message }, { status: 500 });
  }

  const homeCity = (userRes.data?.home_city as string) ?? "Buenos Aires";
  const userCities = (prefsRes.data?.user_cities as Array<{ city: string; primary_neighborhood: string | null; primary_neighborhood_freeform: string | null; is_home: boolean }>) ?? [];

  return NextResponse.json({
    preferred_neighborhoods: (prefsRes.data?.preferred_neighborhoods as string[]) ?? [],
    interests: (prefsRes.data?.interests as string[]) ?? [],
    home_city: homeCity,
    primary_neighborhood: (prefsRes.data?.primary_neighborhood as string) ?? null,
    primary_neighborhood_freeform: (prefsRes.data?.primary_neighborhood_freeform as string) ?? null,
    user_cities: userCities.length > 0 ? userCities : [{ city: homeCity, primary_neighborhood: null, primary_neighborhood_freeform: null, is_home: true }],
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
  const primary_neighborhood = body.primary_neighborhood;
  const primary_neighborhood_freeform = body.primary_neighborhood_freeform;

  const prefUpdates: Record<string, unknown> = {};
  if (Array.isArray(preferred_neighborhoods)) prefUpdates.preferred_neighborhoods = preferred_neighborhoods;
  if (Array.isArray(interests)) prefUpdates.interests = interests;
  if (primary_neighborhood !== undefined) prefUpdates.primary_neighborhood = primary_neighborhood ?? null;
  if (primary_neighborhood_freeform !== undefined) prefUpdates.primary_neighborhood_freeform = primary_neighborhood_freeform ?? null;

  const rawCity = typeof home_city === "string" ? home_city.trim() : "";
  const validatedCity = rawCity ? validateSupportedCity(rawCity) : null;
  if (validatedCity === null && rawCity) {
    return NextResponse.json({ error: "Unsupported city" }, { status: 400 });
  }
  const newHomeCity = validatedCity ?? (rawCity ? rawCity : null);

  const locationChanged =
    primary_neighborhood !== undefined ||
    primary_neighborhood_freeform !== undefined ||
    newHomeCity !== null;

  if (locationChanged) {
    const [{ data: userRow }, { data: prefRow }] = await Promise.all([
      supabase.from("users").select("home_city").eq("id", user.id).single(),
      supabase.from("user_preferences").select("primary_neighborhood, primary_neighborhood_freeform").eq("user_id", user.id).single(),
    ]);
    const city = newHomeCity ?? (userRow?.home_city as string) ?? "Buenos Aires";
    const pn = primary_neighborhood !== undefined ? primary_neighborhood ?? null : (prefRow?.primary_neighborhood as string) ?? null;
    const pnf = primary_neighborhood_freeform !== undefined ? primary_neighborhood_freeform ?? null : (prefRow?.primary_neighborhood_freeform as string) ?? null;
    prefUpdates.user_cities = [{ city, primary_neighborhood: pn, primary_neighborhood_freeform: pnf, is_home: true }];
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
