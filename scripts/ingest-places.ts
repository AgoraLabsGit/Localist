/**
 * Google Places (discovery) + Foursquare (address, hours, rating) → Supabase
 *
 * Compliance: We store only place_id + our metadata. Address, hours, rating come from Foursquare.
 *
 * Usage:
 *   npx tsx scripts/ingest-places.ts [city-slug]     # Ingest city (default: buenos-aires)
 *   npx tsx scripts/ingest-places.ts --incremental  # Skip Foursquare/Geocoding for venues that already have data
 *   npx tsx scripts/ingest-places.ts --list         # List available city slugs
 *
 * Examples:
 *   npx tsx scripts/ingest-places.ts buenos-aires
 *   npx tsx scripts/ingest-places.ts new-orleans --incremental
 *
 * Requires: GOOGLE_PLACES_API_KEY, FOURSQUARE_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * First run: npx tsx scripts/seed-cities.ts (populates cities from config)
 * After ingest: npx tsx scripts/fetch-venue-photos.ts (photos; avoids Premium calls during ingest)
 * See docs/COSTS.md for credit usage
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { getCityConfig, listCitySlugs, type CityConfig } from "./config/cities";
import { loadCityFromDb, listCitySlugsFromDb, type CityConfigFromDb } from "./lib/load-city-from-db";
import { loadPipelineSettings, resolveMaxFoursquareCalls } from "../src/lib/admin-settings";

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY!;
const FOURSQUARE_API_KEY = process.env.FOURSQUARE_API_KEY!;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CITY_WIDE_MIN_RATING = 4.5;
const NEIGHBORHOOD_MIN_RATING = 4.3;
const DEFAULT_MAX_PAGES_PER_QUERY = 2;

interface AddressComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}

interface GooglePlace {
  place_id: string;
  name: string;
  formatted_address?: string;
  address_components?: AddressComponent[];
  geometry: { location: { lat: number; lng: number } };
  rating?: number; // Used only for filter, not stored
  user_ratings_total?: number; // Used only for filter, not stored
  vicinity?: string;
}

interface FoursquareData {
  foursquare_id: string;
  address: string | null;
  opening_hours: string[] | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  rating_count: number | null;
  price: number | null; // 1–4 (cheap → very expensive)
  neighborhood: string | null; // from location.neighborhood
  photo_urls: string[];
  description: string | null; // owner/curator description
}

function mapPlaceToGooglePlace(p: {
  id: string;
  displayName?: { text?: string };
  location?: { latitude?: number; longitude?: number };
  formattedAddress?: string;
  addressComponents?: AddressComponent[];
  rating?: number;
  userRatingCount?: number;
}): GooglePlace {
  return {
    place_id: p.id,
    name: p.displayName?.text ?? "",
    formatted_address: p.formattedAddress,
    address_components: p.addressComponents,
    geometry: {
      location: {
        lat: p.location?.latitude ?? 0,
        lng: p.location?.longitude ?? 0,
      },
    },
    rating: p.rating,
    user_ratings_total: p.userRatingCount,
  };
}

/** Two-lane review thresholds (defaults when not in config) */
const DEFAULT_MIN_REVIEWS_MAIN = 30;
const DEFAULT_MIN_REVIEWS_GEM = 5;
const GEM_MIN_RATING = 4.6;

/** Google Text Search — discovery only. Requests userRatingCount for two-lane filter. */
async function searchGooglePlaces(
  query: string,
  city: CityConfig,
  minRating: number = CITY_WIDE_MIN_RATING,
  pageToken?: string,
  minReviewsMain?: number,
  minReviewsGem?: number
): Promise<{ places: GooglePlace[]; nextPageToken?: string }> {
  const body: Record<string, unknown> = {
    textQuery: query,
    locationBias: {
      circle: {
        center: { latitude: city.center.lat, longitude: city.center.lng },
        radius: city.radiusMeters,
      },
    },
    maxResultCount: 20,
  };
  if (pageToken) body.pageToken = pageToken;

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_API_KEY,
      "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.formattedAddress,places.addressComponents,places.rating,places.userRatingCount,nextPageToken",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (data.error) {
    console.error(`Search failed for "${query}":`, data.error.message);
    return { places: [] };
  }

  const main = minReviewsMain ?? DEFAULT_MIN_REVIEWS_MAIN;
  const gem = minReviewsGem ?? DEFAULT_MIN_REVIEWS_GEM;

  const raw = (data.places ?? []).map((p: {
    id: string;
    displayName?: { text?: string };
    location?: { latitude?: number; longitude?: number };
    formattedAddress?: string;
    addressComponents?: AddressComponent[];
    rating?: number;
    userRatingCount?: number;
  }) => mapPlaceToGooglePlace(p));

  // Two-lane filter: mainstream (reviews >= main) OR hidden-gem (reviews >= gem && rating >= 4.6)
  const places = raw.filter((p: GooglePlace) => {
    const r = p.rating ?? 0;
    const n = p.user_ratings_total ?? 0;
    if (r < minRating) return false;
    if (n >= main) return true;
    if (n >= gem && r >= GEM_MIN_RATING) return true;
    return false;
  });

  return {
    places,
    nextPageToken: data.nextPageToken ?? undefined,
  };
}

/** Compute max pages from target_venues (more target = more pages per category). */
function getMaxPagesPerQuery(city: { targetVenues?: number; categories: { length: number } }): number {
  const target = city.targetVenues ?? 150;
  const numCats = city.categories?.length ?? 8;
  const perCategory = Math.ceil(target / numCats / 15); // ~15 usable per page after rating filter
  return Math.min(5, Math.max(1, perCategory));
}

/** Fetch multiple pages for a query (up to maxPages). Stops early when maxCount reached. */
async function searchGooglePlacesPaginated(
  query: string,
  city: CityConfig,
  minRating: number = CITY_WIDE_MIN_RATING,
  maxPages?: number,
  maxCount?: number,
  minReviewsMain?: number,
  minReviewsGem?: number
): Promise<GooglePlace[]> {
  const limit = maxPages ?? DEFAULT_MAX_PAGES_PER_QUERY;
  const all: GooglePlace[] = [];
  let token: string | undefined;
  let page = 0;

  while (page < limit) {
    const { places, nextPageToken } = await searchGooglePlaces(
      query,
      city,
      minRating,
      token,
      minReviewsMain,
      minReviewsGem
    );
    all.push(...places);
    if (maxCount != null && all.length >= maxCount) break;
    if (!nextPageToken || places.length === 0) break;
    token = nextPageToken;
    page++;
    await new Promise((r) => setTimeout(r, 200)); // Small delay between pages
  }

  return maxCount != null ? all.slice(0, maxCount) : all;
}

const FSQ_BASE = "https://places-api.foursquare.com";
const FSQ_HEADERS = {
  Authorization: `Bearer ${FOURSQUARE_API_KEY}`,
  Accept: "application/json",
  "X-Places-Api-Version": "2025-06-17",
};

let fsqRateLimited = false;
/** Cap from admin_settings (DB) or MAX_FOURSQUARE_CALLS (env). Set in main() before ingest. */
let MAX_FSQ_CALLS: number | undefined;
let fsqCallsMade = 0;

function checkFsqLimit(): boolean {
  if (fsqRateLimited) return true;
  if (MAX_FSQ_CALLS != null && fsqCallsMade >= MAX_FSQ_CALLS) {
    fsqRateLimited = true;
    console.warn(`   ⚠️ Foursquare: reached limit (${MAX_FSQ_CALLS}). Skipping Foursquare enrichment for remainder of run.`);
    return true;
  }
  return false;
}

/** Foursquare Place Search — find venue by name + coordinates. Uses new Places API. */
async function searchFoursquarePlace(name: string, lat: number, lng: number): Promise<string | null> {
  if (checkFsqLimit()) return null;

  const url = new URL(`${FSQ_BASE}/places/search`);
  url.searchParams.set("ll", `${lat},${lng}`);
  url.searchParams.set("query", name);
  url.searchParams.set("limit", "5");
  url.searchParams.set("radius", String(15000)); // Fixed radius for Foursquare search; city config used for Google

  fsqCallsMade++;
  const res = await fetch(url.toString(), { headers: FSQ_HEADERS });

  if (!res.ok) {
    if (res.status === 429) {
      fsqRateLimited = true;
      console.warn("   ⚠️ Foursquare: no API credits (429). Skipping Foursquare enrichment for remainder of run.");
    } else if (res.status === 401) {
      fsqRateLimited = true;
      console.warn("   ⚠️ Foursquare: invalid API key (401). Skipping Foursquare enrichment for remainder of run.");
    }
    return null;
  }
  const data = await res.json();
  const results = data.results ?? [];
  if (results.length === 0) return null;

  // Pick closest match by name similarity. New API uses fsq_place_id (not fsq_id).
  const nameLower = name.toLowerCase();
  const match = results.find(
    (r: { name?: string }) =>
      r.name &&
      (r.name.toLowerCase().includes(nameLower) || nameLower.includes(r.name.toLowerCase()))
  );
  const best = match ?? results[0];
  return best.fsq_place_id ?? best.fsq_id ?? null;
}

/** Foursquare Place Details — address, hours, rating, phone, website, stats, price, description. */
async function getFoursquareDetails(fsqId: string, city: CityConfig): Promise<FoursquareData | null> {
  if (checkFsqLimit()) return null;
  fsqCallsMade++;
  const url = new URL(`${FSQ_BASE}/places/${fsqId}`);
  url.searchParams.set("fields", "location,hours,tel,website,rating,stats,price,description");

  const res = await fetch(url.toString(), { headers: FSQ_HEADERS });

  if (!res.ok) return null;
  const p = await res.json();

  const loc = p.location ?? {};
  const address =
    loc.formatted_address ??
    ([loc.address, loc.locality, loc.region].filter(Boolean).join(", ") || null);

  // Foursquare location.neighborhood can be string or string[]
  const locNeighborhood = loc.neighborhood;
  const fsqNeighborhood =
    Array.isArray(locNeighborhood) && locNeighborhood.length > 0
      ? locNeighborhood[0]
      : typeof locNeighborhood === "string"
        ? locNeighborhood
        : null;

  let opening_hours: string[] | null = null;
  const hours = p.hours ?? {};
  if (hours.display) {
    opening_hours = typeof hours.display === "string" ? [hours.display] : hours.display;
  } else if (Array.isArray(hours.regular)) {
    // FSQ day: 1=Mon, 2=Tue, ..., 6=Sat, 7=Sun
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    opening_hours = hours.regular.map(
      (r: { day?: number; open?: string; close?: string }) => {
        const d = r.day ?? 1;
        const dayLabel = d === 7 ? days[0] : days[d >= 1 && d <= 6 ? d : 1];
        return `${dayLabel}: ${r.open ?? "?"}-${r.close ?? "?"}`;
      }
    );
  }

  const stats = p.stats ?? {};
  const rating_count = typeof stats.total_ratings === "number" ? stats.total_ratings : null;
  const price = typeof p.price === "number" && p.price >= 1 && p.price <= 4 ? p.price : null;

  const description = typeof p.description === "string" && p.description.trim() ? p.description.trim() : null;

  return {
    foursquare_id: fsqId,
    address,
    opening_hours,
    phone: p.tel ?? null,
    website: p.website ?? null,
    rating: p.rating ?? null,
    rating_count,
    price,
    neighborhood: fsqNeighborhood ? guessNeighborhoodFromName(fsqNeighborhood, city) : null,
    photo_urls: [], // run fetch-venue-photos.ts after ingest
    description,
  };
}

function guessNeighborhoodFromName(name: string, city: CityConfig): string | null {
  const n = name.trim();
  const cityName = city.cityFallbackName ?? city.name;
  if (!n || n === cityName || n === "CABA") return null;
  const match = city.neighborhoods.find(
    (known) => n.toLowerCase() === known.toLowerCase() || n.toLowerCase().startsWith(known.toLowerCase() + " ")
  );
  return match ?? n;
}

function guessNeighborhood(address: string, city: CityConfig): string {
  const cityName = city.cityFallbackName ?? city.name;
  for (const n of city.neighborhoods) {
    if (address.toLowerCase().includes(n.toLowerCase())) return n;
  }
  return cityName;
}

/** Extract neighborhood from Google Places addressComponents (same logic as Geocoding). Returns null if none found. */
function extractNeighborhoodFromAddressComponents(
  components: AddressComponent[] | undefined,
  city: CityConfig
): string | null {
  if (!Array.isArray(components) || components.length === 0) return null;
  const cityName = city.cityFallbackName ?? city.name;

  const neighborhoodTypes = ["neighborhood", "sublocality", "sublocality_level_1", "administrative_area_level_2"];

  for (const comp of components) {
    const types = comp.types ?? [];
    const hasNeighborhood = types.some((t: string) => neighborhoodTypes.includes(t));
    const name = (comp.longText ?? comp.shortText ?? "").trim();

    if (hasNeighborhood && name) {
      const match = city.neighborhoods.find(
        (n) =>
          name.toLowerCase() === n.toLowerCase() ||
          name.toLowerCase().startsWith(n.toLowerCase() + " ")
      );
      if (match) return match;
      if (name !== cityName && name !== "CABA") return name;
    }
  }
  return null;
}

async function resolveNeighborhoodFromCoords(
  lat: number,
  lng: number,
  fallbackAddress: string,
  city: CityConfig
): Promise<string> {
  const cityName = city.cityFallbackName ?? city.name;

  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    return guessNeighborhood(fallbackAddress, city);
  }
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${lat},${lng}`);
  url.searchParams.set("key", GOOGLE_API_KEY);
  url.searchParams.set("language", city.geocodeLanguage ?? "en");

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.status !== "OK" || !Array.isArray(data.results)) {
    return guessNeighborhood(fallbackAddress, city);
  }

  const neighborhoodTypes = ["neighborhood", "sublocality", "sublocality_level_1", "administrative_area_level_2"];
  for (const result of data.results) {
    const components = result.address_components ?? [];
    for (const comp of components) {
      const types = comp.types ?? [];
      const hasNeighborhood = types.some((t: string) => neighborhoodTypes.includes(t));
      if (hasNeighborhood && comp.long_name) {
        const name = comp.long_name.trim();
        const match = city.neighborhoods.find(
          (n) => name.toLowerCase() === n.toLowerCase() || name.toLowerCase().startsWith(n.toLowerCase() + " ")
        );
        if (match) return match;
        if (name && name !== cityName && name !== "CABA") return name;
      }
    }
  }

  return guessNeighborhood(fallbackAddress, city);
}

/** For incremental mode: fetch existing venue to skip redundant API calls. */
async function getExistingVenue(
  googlePlaceId: string
): Promise<{ id: string; neighborhood: string | null; foursquare_id: string | null; website_url: string | null } | null> {
  const { data } = await supabase
    .from("venues")
    .select("id, neighborhood, foursquare_id, website_url")
    .eq("google_place_id", googlePlaceId)
    .single();
  return data;
}

function isHiddenGem(
  place: GooglePlace,
  minReviewsMain: number = DEFAULT_MIN_REVIEWS_MAIN,
  minReviewsGem: number = DEFAULT_MIN_REVIEWS_GEM
): boolean {
  const n = place.user_ratings_total ?? 0;
  const r = place.rating ?? 0;
  return n >= minReviewsGem && n < minReviewsMain && r >= GEM_MIN_RATING;
}

async function upsertVenue(
  place: GooglePlace,
  neighborhood: string,
  fsq: FoursquareData | null,
  city: CityConfig | CityConfigFromDb,
  isHiddenGemPlace?: boolean
) {
  const payload: Record<string, unknown> = {
    google_place_id: place.place_id,
    name: place.name,
    city: city.name,
    neighborhood,
    latitude: place.geometry.location.lat,
    longitude: place.geometry.location.lng,
    has_fsq_data: fsq != null,
    is_hidden_gem: isHiddenGemPlace ?? false,
    updated_at: new Date().toISOString(),
  };
  if ("dbId" in city && city.dbId) payload.city_id = city.dbId;

  if (fsq) {
    payload.foursquare_id = fsq.foursquare_id;
    payload.address = fsq.address;
    payload.opening_hours = fsq.opening_hours;
    payload.phone = fsq.phone;
    payload.website_url = fsq.website;
    payload.rating = fsq.rating;
    payload.rating_count = fsq.rating_count;
    if (fsq.photo_urls.length > 0) payload.photo_urls = fsq.photo_urls;
  } else {
    payload.foursquare_id = null;
    payload.address = null;
    payload.opening_hours = null;
    payload.phone = null;
    payload.website_url = null;
    payload.rating = null;
    payload.rating_count = null;
    payload.photo_urls = [];
  }

  const { data, error } = await supabase
    .from("venues")
    .upsert(payload, { onConflict: "google_place_id" })
    .select("id")
    .single();

  if (error) {
    console.error(`  Venue upsert failed for ${place.name}:`, error.message);
    return null;
  }
  return data.id;
}

/** Map Foursquare price 1–4 to approximate USD for display ($/$$/$$$) */
function fsqPriceToUsd(price: number | null): number | null {
  if (price == null || price < 1 || price > 4) return null;
  const map: Record<number, number> = { 1: 10, 2: 25, 3: 50, 4: 100 };
  return map[price] ?? null;
}

async function upsertHighlight(
  venueId: string,
  place: GooglePlace,
  category: string,
  neighborhood: string,
  website: string | null,
  price: number | null,
  city: CityConfig | CityConfigFromDb,
  preserveExisting?: boolean,
  fsqDescription?: string | null
) {
  // Only use Foursquare description; no generic template (add value or leave empty)
  const description = fsqDescription && fsqDescription.trim() ? fsqDescription.trim() : null;

  const payload: Record<string, unknown> = {
    title: place.name,
    short_description: description,
    category,
    venue_id: venueId,
    city: city.name,
    neighborhood,
    status: "active",
    updated_at: new Date().toISOString(),
  };
  if (!preserveExisting) {
    payload.url = website;
    if (price != null) payload.avg_expected_price = price;
  }
  if ("dbId" in city && city.dbId) payload.city_id = city.dbId;
  if ("categoryIdBySlug" in city && city.categoryIdBySlug?.[category]) payload.city_category_id = city.categoryIdBySlug[category];

  const { error } = await supabase.from("highlights").upsert(payload, {
    onConflict: "venue_id,category",
  });

  if (error) {
    console.error(`  Highlight upsert failed for ${place.name}:`, error.message);
  }
}

async function main() {
  const args = process.argv.filter((a) => !a.startsWith("--"));
  const citySlug = args[2] ?? "buenos-aires";
  const INCREMENTAL = process.argv.includes("--incremental");
  const LIST_CITIES = process.argv.includes("--list");

  if (LIST_CITIES) {
    console.log("\n📋 Available cities:\n");
    const slugs = await listCitySlugsFromDb(supabase);
    if (slugs.length > 0) {
      for (const slug of slugs) {
        const cityRow = await loadCityFromDb(supabase, slug);
        console.log(`   ${slug} — ${cityRow?.name ?? slug}`);
      }
    } else {
      for (const slug of listCitySlugs()) {
        const c = getCityConfig(slug);
        if (c) console.log(`   ${slug} — ${c.name} (config)`);
      }
    }
    console.log("\nUsage: npx tsx scripts/ingest-places.ts <city-slug> [--incremental]\n");
    return;
  }

  let city: CityConfig | CityConfigFromDb | null = await loadCityFromDb(supabase, citySlug);
  if (!city) {
    city = getCityConfig(citySlug);
  }
  if (!city) {
    console.error(`❌ Unknown city: "${citySlug}". Use --list to see available cities. Run seed: npx tsx scripts/seed-cities.ts`);
    process.exit(1);
  }

  if (!FOURSQUARE_API_KEY) {
    console.error("❌ FOURSQUARE_API_KEY is required. Add it to .env.local");
    process.exit(1);
  }

  // Load pipeline caps from admin_settings (DB) or env fallback
  try {
    const settings = await loadPipelineSettings(supabase);
    const envMax = process.env.MAX_FOURSQUARE_CALLS
      ? parseInt(process.env.MAX_FOURSQUARE_CALLS, 10)
      : undefined;
    MAX_FSQ_CALLS = resolveMaxFoursquareCalls(settings, envMax);
  } catch (e) {
    const envMax = process.env.MAX_FOURSQUARE_CALLS
      ? parseInt(process.env.MAX_FOURSQUARE_CALLS, 10)
      : undefined;
    MAX_FSQ_CALLS = envMax;
  }

  const cityName = city.cityFallbackName ?? city.name;
  console.log(`\n🌆 Ingesting: ${city.name} (${city.id})\n`);
  console.log(
    INCREMENTAL
      ? "🔍 Mode: incremental — skipping Foursquare/Geocoding for existing venues.\n"
      : "🔍 Mode: fresh — full API calls for every place.\n"
  );
  if (MAX_FSQ_CALLS != null) {
    console.log(`   📊 Foursquare cap: ${MAX_FSQ_CALLS} calls (from Admin Settings)\n`);
  }

  let totalFetched = 0;
  let totalSaved = 0;
  let totalSkipped = 0;

  /** Gems added per category (shared across city-wide and neighborhood queries) for cap enforcement. */
  const gemsAddedPerCategory = new Map<string, number>();
  /** Places saved per category (shared across city-wide and neighborhood) for maxCount enforcement. */
  const placesAddedPerCategory = new Map<string, number>();

  const maxPages = getMaxPagesPerQuery(city);
  const target = (city as { targetVenues?: number }).targetVenues ?? 150;
  const maxTotalPerCity = (city as { maxTotalPerCity?: number }).maxTotalPerCity;
  console.log(`   Target: ${target} venues, ${maxPages} pages/category${maxTotalPerCity != null ? `, max ${maxTotalPerCity} total` : ""}`);

  for (const cat of city.categories) {
    // Check global cap before category
    if (maxTotalPerCity != null) {
      const { count } = await supabase
        .from("venues")
        .select("id", { count: "exact", head: true })
        .eq("city", city.name);
      if ((count ?? 0) >= maxTotalPerCity) {
        console.log(`   ⏹️ Reached max_total_per_city (${maxTotalPerCity}); stopping.`);
        break;
      }
    }

    const { query, category } = cat;
    const minRating = "minRating" in cat ? cat.minRating : CITY_WIDE_MIN_RATING;
    const minReviewsMain = (cat as { minReviewsMain?: number }).minReviewsMain ?? DEFAULT_MIN_REVIEWS_MAIN;
    const minReviewsGem = (cat as { minReviewsGem?: number }).minReviewsGem ?? DEFAULT_MIN_REVIEWS_GEM;
    const maxCount = (cat as { maxCount?: number }).maxCount;

    const gemCap = maxCount != null ? Math.max(1, Math.floor(maxCount * 0.3)) : undefined;
    console.log(`📂 ${category}: "${query}"${gemCap != null ? ` (gem cap: ${gemCap})` : ""}`);
    const places = await searchGooglePlacesPaginated(
      query,
      city,
      minRating,
      maxPages,
      maxCount,
      minReviewsMain,
      minReviewsGem
    );
    console.log(`   Found ${places.length} places (${minRating}+ stars, reviews: main≥${minReviewsMain} or gem≥${minReviewsGem})`);
    totalFetched += places.length;

    for (const place of places) {
      const gemPlace = isHiddenGem(place, minReviewsMain, minReviewsGem);
      const gemsSoFar = gemsAddedPerCategory.get(category) ?? 0;
      if (gemPlace && gemCap != null && gemsSoFar >= gemCap) {
        continue; // Skip: hidden-gem cap reached for this category
      }
      const existing = INCREMENTAL ? await getExistingVenue(place.place_id) : null;
      const skipEnrichment = INCREMENTAL && existing?.foursquare_id;

      let resolvedNeighborhood: string;
      let fsq: FoursquareData | null = null;
      let venueId: string | null;

      if (skipEnrichment && existing) {
        resolvedNeighborhood = existing.neighborhood ?? cityName;
        venueId = existing.id;
        totalSkipped++;
      } else {
        // 1. Try Google Places addressComponents first (no extra API call)
        let neighborhood =
          extractNeighborhoodFromAddressComponents(place.address_components, city) ??
          // 2. Fall back to Geocoding reverse lookup
          (await resolveNeighborhoodFromCoords(
            place.geometry.location.lat,
            place.geometry.location.lng,
            place.formatted_address ?? place.vicinity ?? "",
            city
          ));

        const fsqId = await searchFoursquarePlace(
          place.name,
          place.geometry.location.lat,
          place.geometry.location.lng
        );
        if (fsqId) {
          fsq = await getFoursquareDetails(fsqId, city);
          // Photos: run fetch-venue-photos.ts after ingest (saves Premium calls)
          if (fsq) fsq.photo_urls = [];
          await new Promise((r) => setTimeout(r, 200));
        }

        resolvedNeighborhood = neighborhood;
        if (neighborhood === cityName) {
          if (fsq?.neighborhood) {
            resolvedNeighborhood = fsq.neighborhood;
          } else {
            // Parse neighborhood from address string (Google or Foursquare)
            const fromGoogle = guessNeighborhood(place.formatted_address ?? "", city);
            if (fromGoogle !== cityName) {
              resolvedNeighborhood = fromGoogle;
            } else if (fsq?.address) {
              const fromFsq = guessNeighborhood(fsq.address, city);
              if (fromFsq !== cityName) resolvedNeighborhood = fromFsq;
            }
          }
        }

        venueId = await upsertVenue(place, resolvedNeighborhood, fsq, city, gemPlace);
      }

      if (venueId) {
        const priceUsd = fsqPriceToUsd(fsq?.price ?? null);
        const website = skipEnrichment && existing ? existing.website_url ?? null : fsq?.website ?? null;
        await upsertHighlight(
          venueId,
          place,
          category,
          resolvedNeighborhood,
          website,
          priceUsd,
          city,
          !!skipEnrichment,
          fsq?.description
        );
        totalSaved++;
        if (gemPlace) gemsAddedPerCategory.set(category, (gemsAddedPerCategory.get(category) ?? 0) + 1);
        placesAddedPerCategory.set(category, (placesAddedPerCategory.get(category) ?? 0) + 1);
        const ratingStr = fsq?.rating != null ? `, ${fsq.rating}⭐ (FSQ)` : "";
        const skipStr = skipEnrichment ? " [skipped]" : "";
        const gemStr = gemPlace ? " [gem]" : "";
        console.log(`   ✅ ${place.name} (${resolvedNeighborhood}${ratingStr})${skipStr}${gemStr}`);
      }

      await new Promise((r) => setTimeout(r, 150));
    }

    console.log();
  }

  // Build category params map for neighborhood queries (includes maxCount for gem cap)
  const categoryParams = new Map<string, { minReviewsMain: number; minReviewsGem: number; maxCount?: number }>();
  for (const cat of city.categories) {
    const c = cat as { category?: string; minReviewsMain?: number; minReviewsGem?: number; maxCount?: number };
    if (c.category) {
      categoryParams.set(c.category, {
        minReviewsMain: c.minReviewsMain ?? DEFAULT_MIN_REVIEWS_MAIN,
        minReviewsGem: c.minReviewsGem ?? DEFAULT_MIN_REVIEWS_GEM,
        maxCount: c.maxCount,
      });
    }
  }

  // Neighborhood-specific queries — 4.3+ (best-in-area)
  console.log("📍 Neighborhood-specific queries (best-in-area):\n");
  for (const { query, category } of city.neighborhoodQueries) {
    if (maxTotalPerCity != null) {
      const { count } = await supabase
        .from("venues")
        .select("id", { count: "exact", head: true })
        .eq("city", city.name);
      if ((count ?? 0) >= maxTotalPerCity) {
        console.log(`   ⏹️ Reached max_total_per_city (${maxTotalPerCity}); stopping.`);
        break;
      }
    }
    const params = categoryParams.get(category) ?? { minReviewsMain: DEFAULT_MIN_REVIEWS_MAIN, minReviewsGem: DEFAULT_MIN_REVIEWS_GEM };
    const gemCap = params.maxCount != null ? Math.max(1, Math.floor(params.maxCount * 0.3)) : undefined;
    console.log(`📂 ${category}: "${query}"${gemCap != null ? ` (gem cap: ${gemCap})` : ""}`);
    const { places } = await searchGooglePlaces(
      query,
      city,
      NEIGHBORHOOD_MIN_RATING,
      undefined,
      params.minReviewsMain,
      params.minReviewsGem
    );
    console.log(`   Found ${places.length} places (${NEIGHBORHOOD_MIN_RATING}+ stars)`);
    totalFetched += places.length;

    for (const place of places) {
      const placesSoFar = placesAddedPerCategory.get(category) ?? 0;
      if (params.maxCount != null && placesSoFar >= params.maxCount) {
        continue; // Skip: maxCount reached for this category (city-wide + neighborhood combined)
      }
      const gemPlace = isHiddenGem(place, params.minReviewsMain, params.minReviewsGem);
      const gemsSoFar = gemsAddedPerCategory.get(category) ?? 0;
      if (gemPlace && gemCap != null && gemsSoFar >= gemCap) {
        continue; // Skip: hidden-gem cap reached for this category
      }

      const existing = INCREMENTAL ? await getExistingVenue(place.place_id) : null;
      const skipEnrichment = INCREMENTAL && existing?.foursquare_id;

      let resolvedNeighborhood: string;
      let fsq: FoursquareData | null = null;
      let venueId: string | null;

      if (skipEnrichment && existing) {
        resolvedNeighborhood = existing.neighborhood ?? cityName;
        venueId = existing.id;
        totalSkipped++;
      } else {
        let neighborhood =
          extractNeighborhoodFromAddressComponents(place.address_components, city) ??
          (await resolveNeighborhoodFromCoords(
            place.geometry.location.lat,
            place.geometry.location.lng,
            place.formatted_address ?? place.vicinity ?? "",
            city
          ));

        const fsqId = await searchFoursquarePlace(
          place.name,
          place.geometry.location.lat,
          place.geometry.location.lng
        );
        if (fsqId) {
          fsq = await getFoursquareDetails(fsqId, city);
          // Photos: run fetch-venue-photos.ts after ingest (saves Premium calls)
          if (fsq) fsq.photo_urls = [];
          await new Promise((r) => setTimeout(r, 200));
        }

        resolvedNeighborhood = neighborhood;
        if (neighborhood === cityName) {
          if (fsq?.neighborhood) {
            resolvedNeighborhood = fsq.neighborhood;
          } else {
            const fromGoogle = guessNeighborhood(place.formatted_address ?? "", city);
            if (fromGoogle !== cityName) {
              resolvedNeighborhood = fromGoogle;
            } else if (fsq?.address) {
              const fromFsq = guessNeighborhood(fsq.address, city);
              if (fromFsq !== cityName) resolvedNeighborhood = fromFsq;
            }
          }
        }

        venueId = await upsertVenue(place, resolvedNeighborhood, fsq, city, gemPlace);
      }

      if (venueId) {
        const priceUsd = fsqPriceToUsd(fsq?.price ?? null);
        const website = skipEnrichment && existing ? existing.website_url ?? null : fsq?.website ?? null;
        await upsertHighlight(
          venueId,
          place,
          category,
          resolvedNeighborhood,
          website,
          priceUsd,
          city,
          !!skipEnrichment,
          fsq?.description
        );
        totalSaved++;
        if (gemPlace) gemsAddedPerCategory.set(category, (gemsAddedPerCategory.get(category) ?? 0) + 1);
        placesAddedPerCategory.set(category, (placesAddedPerCategory.get(category) ?? 0) + 1);
        const ratingStr = fsq?.rating != null ? `, ${fsq.rating}⭐ (FSQ)` : "";
        const skipStr = skipEnrichment ? " [skipped]" : "";
        const gemStr = gemPlace ? " [gem]" : "";
        console.log(`   ✅ ${place.name} (${resolvedNeighborhood}${ratingStr})${skipStr}${gemStr}`);
      }

      await new Promise((r) => setTimeout(r, 150));
    }

    console.log();
  }

  if (fsqRateLimited) {
    console.log(`\n⚠️ Foursquare was rate-limited (429/401); some venues may lack FSQ data.`);
  }

  await supabase.from("ingestion_jobs").insert({
    source: `google_places+foursquare:${city.id}`,
    status: "success",
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    items_fetched: totalFetched,
    items_successful: totalSaved,
  });

  if (INCREMENTAL && totalSkipped > 0) {
    console.log(`\n✨ Done! Fetched ${totalFetched}, saved ${totalSaved} highlights, skipped ${totalSkipped} (already enriched).`);
  } else {
    console.log(`\n✨ Done! Fetched ${totalFetched}, saved ${totalSaved} highlights.`);
  }
}

main().catch(console.error);
