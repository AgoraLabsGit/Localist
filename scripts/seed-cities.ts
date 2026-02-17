/**
 * Seed cities, neighborhoods, categories from config.
 * Run after migrations 008 and 009: npx tsx scripts/seed-cities.ts
 *
 * Seeds Buenos Aires (and New Orleans). Also backfills city_id and city_category_id
 * on existing venues and highlights.
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { buenosAires, newOrleans, UNIVERSAL_CATEGORIES } from "./config/cities";
import { getCategoryGroup } from "../src/lib/universal-categories";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function seedCity(config: typeof buenosAires) {
  console.log(`\n📍 Seeding ${config.name} (${config.id})...`);

  // Upsert city
  const { data: city, error: cityErr } = await supabase
    .from("cities")
    .upsert(
      {
        slug: config.id,
        name: config.name,
        center_lat: config.center.lat,
        center_lng: config.center.lng,
        radius_meters: config.radiusMeters,
        geocode_language: config.geocodeLanguage ?? "en",
        target_venues: config.targetVenues ?? 150,
        status: "active",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug" }
    )
    .select("id")
    .single();

  if (cityErr || !city) {
    console.error(`  City upsert failed:`, cityErr?.message);
    return;
  }
  const cityId = city.id;
  console.log(`  City id: ${cityId}`);

  // Upsert neighborhoods
  for (const name of config.neighborhoods) {
    await supabase
      .from("city_neighborhoods")
      .upsert(
        { city_id: cityId, name },
        { onConflict: "city_id,name" }
      );
  }
  console.log(`  Neighborhoods: ${config.neighborhoods.length}`);

  const universalBySlug = Object.fromEntries(UNIVERSAL_CATEGORIES.map((u) => [u.category, u]));

  // Upsert categories
  const categoryIdBySlug: Record<string, string> = {};
  for (const cat of config.categories) {
    const universal = universalBySlug[cat.category];
    const group = getCategoryGroup(cat.category);
    const displayName = universal?.displayName ?? cat.category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    const { data: catRow, error: catErr } = await supabase
      .from("city_categories")
      .upsert(
        {
          city_id: cityId,
          slug: cat.category,
          display_name: displayName,
          search_query: cat.query,
          min_rating: cat.minRating ?? 4.5,
          category_group: group,
          is_city_specific: cat.isCitySpecific ?? false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "city_id,slug" }
      )
      .select("id")
      .single();

    if (catErr || !catRow) {
      console.error(`  Category ${cat.category} failed:`, catErr?.message);
      continue;
    }
    categoryIdBySlug[cat.category] = catRow.id;
  }
  console.log(`  Categories: ${Object.keys(categoryIdBySlug).length}`);

  // Upsert neighborhood queries
  for (const nq of config.neighborhoodQueries) {
    const catId = categoryIdBySlug[nq.category];
    if (!catId) continue;
    await supabase.from("city_neighborhood_queries").upsert(
      {
        city_id: cityId,
        city_category_id: catId,
        neighborhood_name: nq.neighborhood,
        search_query: nq.query,
        min_rating: 4.3,
      },
      { onConflict: "city_id,city_category_id,neighborhood_name" }
    );
  }
  console.log(`  Neighborhood queries: ${config.neighborhoodQueries.length}`);

  return { cityId, categoryIdBySlug };
}

async function backfillVenuesAndHighlights(cityName: string, cityId: string, categoryIdBySlug: Record<string, string>) {
  console.log(`\n  Backfilling venue/highlight city_id and city_category_id...`);

  const { data: venues } = await supabase
    .from("venues")
    .select("id")
    .eq("city", cityName)
    .is("city_id", null);

  if (venues && venues.length > 0) {
    const { error: vErr } = await supabase
      .from("venues")
      .update({ city_id: cityId, updated_at: new Date().toISOString() })
      .eq("city", cityName)
      .is("city_id", null);
    console.log(`  Venues updated: ${venues.length}`, vErr ? `(${vErr.message})` : "");
  }

  for (const [slug, catId] of Object.entries(categoryIdBySlug)) {
    const { data: highlights } = await supabase
      .from("highlights")
      .select("id")
      .eq("city", cityName)
      .eq("category", slug)
      .is("city_category_id", null);

    if (highlights && highlights.length > 0) {
      await supabase
        .from("highlights")
        .update({
          city_id: cityId,
          city_category_id: catId,
          updated_at: new Date().toISOString(),
        })
        .eq("city", cityName)
        .eq("category", slug)
        .is("city_category_id", null);
    }
  }
  const { count } = await supabase
    .from("highlights")
    .select("id", { count: "exact", head: true })
    .eq("city", cityName)
    .not("city_category_id", "is", null);
  console.log(`  Highlights with city_category_id: ${count ?? 0}`);
}

async function main() {
  const ba = await seedCity(buenosAires);
  if (ba) await backfillVenuesAndHighlights(buenosAires.name, ba.cityId, ba.categoryIdBySlug);

  const nola = await seedCity(newOrleans);
  if (nola) await backfillVenuesAndHighlights(newOrleans.name, nola.cityId, nola.categoryIdBySlug);

  console.log("\n✅ Seed complete.\n");
}

main().catch(console.error);
