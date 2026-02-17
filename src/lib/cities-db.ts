/**
 * Server-side: Load cities from DB. Replaces hardcoded SUPPORTED_CITIES where possible.
 */
import { createClient } from "@/lib/supabase/server";

export interface CityFromDb {
  id: string;
  name: string;
  center?: { lat: number; lng: number };
  is_default: boolean;
}

let cachedCities: CityFromDb[] | null = null;
let cachedDefault: string | null = null;

export async function getCitiesFromDb(): Promise<CityFromDb[]> {
  if (cachedCities) return cachedCities;
  const supabase = createClient();
  const { data } = await supabase
    .from("cities")
    .select("id, slug, name, center_lat, center_lng, is_default")
    .eq("status", "active")
    .order("name");
  cachedCities = (data ?? []).map((c) => ({
    id: c.slug,
    name: c.name,
    center:
      c.center_lat != null && c.center_lng != null
        ? { lat: c.center_lat, lng: c.center_lng }
        : undefined,
    is_default: c.is_default ?? false,
  }));
  return cachedCities;
}

export async function getDefaultCityNameFromDb(): Promise<string> {
  if (cachedDefault) return cachedDefault;
  const cities = await getCitiesFromDb();
  const defaultCity = cities.find((c) => c.is_default) ?? cities[0];
  cachedDefault = defaultCity?.name ?? "Buenos Aires";
  return cachedDefault;
}

/** Validate city name against DB. Returns canonical name if found, else null. */
export async function validateCityFromDb(name: string): Promise<string | null> {
  const n = name.trim();
  if (!n) return null;
  const cities = await getCitiesFromDb();
  const match = cities.find(
    (c) => c.name.toLowerCase() === n.toLowerCase()
  );
  return match?.name ?? null;
}
