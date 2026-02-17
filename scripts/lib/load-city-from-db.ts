/**
 * Load city config from database.
 * Returns shape compatible with ingest (CityConfig-like).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface CityConfigFromDb {
  id: string;
  dbId: string; // UUID for cities table
  name: string;
  center: { lat: number; lng: number };
  radiusMeters: number;
  neighborhoods: string[];
  categories: {
    query: string;
    category: string;
    minRating: number;
    dbId: string;
    targetCount?: number;
    maxCount?: number;
    minReviewsMain?: number;
    minReviewsGem?: number;
  }[];
  neighborhoodQueries: { query: string; category: string; neighborhood: string }[];
  geocodeLanguage: string;
  cityFallbackName?: string;
  /** Map category slug -> city_category uuid (for upsert) */
  categoryIdBySlug: Record<string, string>;
  /** Target venues (drives ingest pagination). Large ~250, medium ~150, small ~100. */
  targetVenues: number;
  /** Hard cap on venues per city; stop discovery when reached. */
  maxTotalPerCity?: number;
}

export async function loadCityFromDb(
  supabase: SupabaseClient,
  slug: string
): Promise<CityConfigFromDb | null> {
  const { data: city, error: cityErr } = await supabase
    .from("cities")
    .select("id, slug, name, center_lat, center_lng, radius_meters, geocode_language, target_venues, max_total_per_city")
    .eq("slug", slug)
    .eq("status", "active")
    .single();

  if (cityErr || !city) return null;

  const [neighRes, catRes, nqRes] = await Promise.all([
    supabase.from("city_neighborhoods").select("name").eq("city_id", city.id).order("name"),
    supabase
      .from("city_categories")
      .select("id, slug, search_query, min_rating, target_count, max_count, min_reviews_main, min_reviews_gem")
      .eq("city_id", city.id)
      .order("slug"),
    supabase
      .from("city_neighborhood_queries")
      .select("search_query, neighborhood_name, city_categories!inner(slug)")
      .eq("city_id", city.id),
  ]);

  const neighborhoods = (neighRes.data ?? []).map((n) => n.name);
  const categoryIdBySlug: Record<string, string> = {};
  const categories = (catRes.data ?? []).map((c: {
    id: string;
    slug: string;
    search_query: string;
    min_rating?: number;
    target_count?: number;
    max_count?: number;
    min_reviews_main?: number;
    min_reviews_gem?: number;
  }) => {
    categoryIdBySlug[c.slug] = c.id;
    return {
      query: c.search_query,
      category: c.slug,
      minRating: Number(c.min_rating) || 4.5,
      dbId: c.id,
      targetCount: c.target_count ?? undefined,
      maxCount: c.max_count ?? undefined,
      minReviewsMain: c.min_reviews_main ?? undefined,
      minReviewsGem: c.min_reviews_gem ?? undefined,
    };
  });

  const neighborhoodQueries = (nqRes.data ?? []).map((nq: { search_query: string; neighborhood_name?: string; city_categories?: { slug: string } | { slug: string }[] | null }) => {
    const cat = Array.isArray(nq.city_categories) ? nq.city_categories[0] : nq.city_categories;
    return {
      query: nq.search_query,
      category: cat?.slug ?? "",
      neighborhood: nq.neighborhood_name ?? "",
    };
  });

  return {
    id: city.slug,
    dbId: city.id,
    name: city.name,
    center: { lat: city.center_lat, lng: city.center_lng },
    radiusMeters: city.radius_meters,
    neighborhoods,
    categories,
    neighborhoodQueries,
    geocodeLanguage: city.geocode_language ?? "en",
    categoryIdBySlug,
    targetVenues: city.target_venues ?? 150,
    maxTotalPerCity: city.max_total_per_city ?? undefined,
  };
}

export async function listCitySlugsFromDb(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase
    .from("cities")
    .select("slug")
    .eq("status", "active")
    .order("slug");
  return (data ?? []).map((r) => r.slug);
}
