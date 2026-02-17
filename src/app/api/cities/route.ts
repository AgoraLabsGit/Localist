/**
 * GET /api/cities
 *
 * Returns active cities from DB. Used for onboarding, settings, and default city.
 */
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = createClient();

  const { data: cities, error } = await supabase
    .from("cities")
    .select("id, slug, name, center_lat, center_lng, is_default")
    .eq("status", "active")
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const defaultCity =
    cities?.find((c) => c.is_default) ?? cities?.[0];
  const defaultCityName = defaultCity?.name ?? null;

  return NextResponse.json({
    cities: (cities ?? []).map((c) => ({
      id: c.slug,
      name: c.name,
      center: c.center_lat != null && c.center_lng != null
        ? { lat: c.center_lat, lng: c.center_lng }
        : undefined,
      is_default: c.is_default ?? false,
    })),
    defaultCityName,
  });
}
