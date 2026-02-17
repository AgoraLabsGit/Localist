/**
 * GET /api/neighborhoods?city=Buenos%20Aires
 *
 * Returns neighborhoods for the Area filter. Uses city_neighborhoods as the
 * canonical list, merged with distinct neighborhoods from highlights.
 * Dedupes by normalized name and applies title case to avoid duplicates like
 * Liniers/LINIERS and all-CAPS display.
 */
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { dedupeAndNormalize } from "@/lib/neighborhoods";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cityName = searchParams.get("city")?.trim();
  if (!cityName) {
    return NextResponse.json({ neighborhoods: [] });
  }

  const supabase = createClient();

  const slug = cityName.toLowerCase().replace(/\s+/g, "-");
  const [cityRes, highlightsRes] = await Promise.all([
    supabase
      .from("cities")
      .select("id")
      .or(`name.eq.${cityName},slug.eq.${slug}`)
      .eq("status", "active")
      .limit(1),
    supabase
      .from("highlights")
      .select("neighborhood")
      .eq("city", cityName)
      .eq("status", "active")
      .not("neighborhood", "is", null),
  ]);

  const city = cityRes.data?.[0];
  const fromDb = city
    ? await supabase
        .from("city_neighborhoods")
        .select("name")
        .eq("city_id", city.id)
        .order("name")
        .then((r) => (r.data ?? []).map((n) => n.name))
    : [];

  const fromHighlights = (highlightsRes.data ?? [])
    .map((h) => (h as { neighborhood: string | null }).neighborhood)
    .filter((n): n is string => Boolean(n?.trim()));

  const neighborhoods = dedupeAndNormalize([...fromDb, ...fromHighlights]);

  return NextResponse.json({ neighborhoods });
}
