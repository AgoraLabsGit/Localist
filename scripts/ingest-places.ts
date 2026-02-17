/**
 * Google Places (discovery) + Foursquare (address, hours, rating) → Supabase
 *
 * Compliance: We store only place_id + our metadata. Address, hours, rating come from Foursquare.
 *
 * Usage:
 *   npx tsx scripts/ingest-places.ts           # Fresh (default): full API calls for every place
 *   npx tsx scripts/ingest-places.ts --fresh   # Same as default
 *   npx tsx scripts/ingest-places.ts --incremental  # Skip Foursquare/Geocoding for venues that already have data
 *
 * Modes:
 *   --fresh: New city or full refresh. All API calls (Google, Geocoding, Foursquare).
 *   --incremental: Updates. Skips Foursquare + Geocoding for venues with foursquare_id. Use after initial ingest.
 *
 * Requires: GOOGLE_PLACES_API_KEY, FOURSQUARE_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local
 * Foursquare: places-api.foursquare.com. Add credits at https://foursquare.com/developers/orgs if 429.
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY!;
const FOURSQUARE_API_KEY = process.env.FOURSQUARE_API_KEY!;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CATEGORIES = [
  { query: "best parrilla Buenos Aires", type: "restaurant", category: "parrilla" },
  { query: "best milonga tango Buenos Aires", type: "night_club", category: "tango_bar" },
  { query: "best cocktail bar Buenos Aires", type: "bar", category: "cocktail_bar" },
  { query: "best cafe Buenos Aires", type: "cafe", category: "cafe" },
  { query: "best museum Buenos Aires", type: "museum", category: "museum" },
  { query: "best rooftop bar Buenos Aires", type: "bar", category: "rooftop" },
  { query: "best bookstore Buenos Aires", type: "book_store", category: "bookstore" },
  { query: "best ice cream Buenos Aires", type: "restaurant", category: "heladeria" },
];

const BA_LAT = -34.6037;
const BA_LNG = -58.3816;
const RADIUS = 15000;

const INCREMENTAL = process.argv.includes("--incremental");

const KNOWN_NEIGHBORHOODS = [
  "Palermo", "Recoleta", "San Telmo", "La Boca", "Belgrano",
  "Colegiales", "Nuñez", "Caballito", "Almagro", "Villa Crespo",
  "Retiro", "Puerto Madero", "Monserrat", "San Nicolás", "Balvanera",
  "Boedo", "Barracas", "Constitución", "Flores", "Microcentro",
];

interface GooglePlace {
  place_id: string;
  name: string;
  formatted_address?: string;
  geometry: { location: { lat: number; lng: number } };
  rating?: number; // Used only for filter, not stored
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
}

/** Google Text Search — discovery only. Minimal fields. Rating used transiently for 4.5+ filter. */
async function searchGooglePlaces(query: string): Promise<GooglePlace[]> {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_API_KEY,
      "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.formattedAddress,places.rating",
    },
    body: JSON.stringify({
      textQuery: query,
      locationBias: {
        circle: {
          center: { latitude: BA_LAT, longitude: BA_LNG },
          radius: RADIUS,
        },
      },
      maxResultCount: 20,
    }),
  });

  const data = await res.json();
  if (data.error) {
    console.error(`Search failed for "${query}":`, data.error.message);
    return [];
  }

  return (data.places ?? [])
    .filter((p: { rating?: number }) => (p.rating ?? 0) >= 4.5)
    .map((p: { id: string; displayName?: { text?: string }; location?: { latitude?: number; longitude?: number }; formattedAddress?: string; rating?: number }) => ({
      place_id: p.id,
      name: p.displayName?.text ?? "",
      formatted_address: p.formattedAddress,
      geometry: {
        location: {
          lat: p.location?.latitude ?? 0,
          lng: p.location?.longitude ?? 0,
        },
      },
      rating: p.rating,
    }));
}

const FSQ_BASE = "https://places-api.foursquare.com";
const FSQ_HEADERS = {
  Authorization: `Bearer ${FOURSQUARE_API_KEY}`,
  Accept: "application/json",
  "X-Places-Api-Version": "2025-06-17",
};

let fsqRateLimited = false;

/** Foursquare Place Search — find venue by name + coordinates. Uses new Places API. */
async function searchFoursquarePlace(name: string, lat: number, lng: number): Promise<string | null> {
  if (fsqRateLimited) return null;

  const url = new URL(`${FSQ_BASE}/places/search`);
  url.searchParams.set("ll", `${lat},${lng}`);
  url.searchParams.set("query", name);
  url.searchParams.set("limit", "5");
  url.searchParams.set("radius", String(RADIUS));

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

/** Foursquare Place Photos — up to 3 photo URLs. Extra API call. */
async function getFoursquarePhotos(fsqId: string): Promise<string[]> {
  if (fsqRateLimited) return [];
  const url = new URL(`${FSQ_BASE}/places/${fsqId}/photos`);
  url.searchParams.set("limit", "3");
  url.searchParams.set("sort", "POPULAR");

  const res = await fetch(url.toString(), { headers: FSQ_HEADERS });
  if (!res.ok) return [];
  const data = await res.json();
  const items = Array.isArray(data) ? data : data.results ?? [];
  const urls: string[] = [];
  for (const p of items.slice(0, 3)) {
    const prefix = p.prefix ?? "";
    const suffix = p.suffix ?? "";
    if (prefix && suffix) urls.push(`${prefix}600x450${suffix}`);
  }
  return urls;
}

/** Foursquare Place Details — address, hours, rating, phone, website, stats, price. Uses new Places API. */
async function getFoursquareDetails(fsqId: string): Promise<FoursquareData | null> {
  const url = new URL(`${FSQ_BASE}/places/${fsqId}`);
  url.searchParams.set("fields", "location,hours,tel,website,rating,stats,price");

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

  return {
    foursquare_id: fsqId,
    address,
    opening_hours,
    phone: p.tel ?? null,
    website: p.website ?? null,
    rating: p.rating ?? null,
    rating_count,
    price,
    neighborhood: fsqNeighborhood ? guessNeighborhoodFromName(fsqNeighborhood) : null,
    photo_urls: [], // filled by getFoursquarePhotos (separate call)
  };
}

function guessNeighborhoodFromName(name: string): string | null {
  const n = name.trim();
  if (!n || n === "Buenos Aires" || n === "CABA") return null;
  const match = KNOWN_NEIGHBORHOODS.find(
    (known) => n.toLowerCase() === known.toLowerCase() || n.toLowerCase().startsWith(known.toLowerCase() + " ")
  );
  return match ?? n;
}

function guessNeighborhood(address: string): string {
  for (const n of KNOWN_NEIGHBORHOODS) {
    if (address.toLowerCase().includes(n.toLowerCase())) return n;
  }
  return "Buenos Aires";
}

async function resolveNeighborhoodFromCoords(
  lat: number,
  lng: number,
  fallbackAddress: string
): Promise<string> {
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    return guessNeighborhood(fallbackAddress);
  }
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${lat},${lng}`);
  url.searchParams.set("key", GOOGLE_API_KEY);
  url.searchParams.set("language", "es");

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.status !== "OK" || !Array.isArray(data.results)) {
    return guessNeighborhood(fallbackAddress);
  }

  const neighborhoodTypes = ["neighborhood", "sublocality", "sublocality_level_1", "administrative_area_level_2"];
  for (const result of data.results) {
    const components = result.address_components ?? [];
    for (const comp of components) {
      const types = comp.types ?? [];
      const hasNeighborhood = types.some((t: string) => neighborhoodTypes.includes(t));
      if (hasNeighborhood && comp.long_name) {
        const name = comp.long_name.trim();
        const match = KNOWN_NEIGHBORHOODS.find(
          (n) => name.toLowerCase() === n.toLowerCase() || name.toLowerCase().startsWith(n.toLowerCase() + " ")
        );
        if (match) return match;
        if (name && name !== "Buenos Aires" && name !== "CABA") return name;
      }
    }
  }

  return guessNeighborhood(fallbackAddress);
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

async function upsertVenue(
  place: GooglePlace,
  neighborhood: string,
  fsq: FoursquareData | null
) {
  const payload: Record<string, unknown> = {
    google_place_id: place.place_id,
    name: place.name,
    city: "Buenos Aires",
    neighborhood,
    latitude: place.geometry.location.lat,
    longitude: place.geometry.location.lng,
    updated_at: new Date().toISOString(),
  };

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
  preserveExisting?: boolean
) {
  const description = `${place.name} — a top-rated ${category.replace(/_/g, " ")} in ${neighborhood}, Buenos Aires.`;

  const payload: Record<string, unknown> = {
    title: place.name,
    short_description: description,
    category,
    venue_id: venueId,
    city: "Buenos Aires",
    neighborhood,
    status: "active",
    updated_at: new Date().toISOString(),
  };
  if (!preserveExisting) {
    payload.url = website;
    if (price != null) payload.avg_expected_price = price;
  }

  const { error } = await supabase.from("highlights").upsert(payload, {
    onConflict: "venue_id,category",
  });

  if (error) {
    console.error(`  Highlight upsert failed for ${place.name}:`, error.message);
  }
}

async function main() {
  if (!FOURSQUARE_API_KEY) {
    console.error("❌ FOURSQUARE_API_KEY is required. Add it to .env.local");
    process.exit(1);
  }

  console.log(
    INCREMENTAL
      ? "🔍 Starting ingestion (incremental — skipping Foursquare/Geocoding for existing venues)...\n"
      : "🔍 Starting ingestion (fresh — full API calls for every place)...\n"
  );

  let totalFetched = 0;
  let totalSaved = 0;
  let totalSkipped = 0;

  for (const { query, category } of CATEGORIES) {
    console.log(`📂 ${category}: "${query}"`);
    const places = await searchGooglePlaces(query);
    console.log(`   Found ${places.length} places (4.5+ stars)`);
    totalFetched += places.length;

    for (const place of places) {
      const existing = INCREMENTAL ? await getExistingVenue(place.place_id) : null;
      const skipEnrichment = INCREMENTAL && existing?.foursquare_id;

      let resolvedNeighborhood: string;
      let fsq: FoursquareData | null = null;
      let venueId: string | null;

      if (skipEnrichment && existing) {
        resolvedNeighborhood = existing.neighborhood ?? "Buenos Aires";
        venueId = existing.id;
        totalSkipped++;
      } else {
        const neighborhood = await resolveNeighborhoodFromCoords(
          place.geometry.location.lat,
          place.geometry.location.lng,
          place.formatted_address ?? place.vicinity ?? ""
        );

        const fsqId = await searchFoursquarePlace(
          place.name,
          place.geometry.location.lat,
          place.geometry.location.lng
        );
        if (fsqId) {
          fsq = await getFoursquareDetails(fsqId);
          if (fsq) {
            fsq.photo_urls = await getFoursquarePhotos(fsqId);
            await new Promise((r) => setTimeout(r, 100));
          }
          await new Promise((r) => setTimeout(r, 200));
        }

        resolvedNeighborhood = neighborhood;
        if (neighborhood === "Buenos Aires") {
          if (fsq?.neighborhood) resolvedNeighborhood = fsq.neighborhood;
          else if (fsq?.address) {
            const fromAddress = guessNeighborhood(fsq.address);
            if (fromAddress !== "Buenos Aires") resolvedNeighborhood = fromAddress;
          }
        }

        venueId = await upsertVenue(place, resolvedNeighborhood, fsq);
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
          !!skipEnrichment
        );
        totalSaved++;
        const ratingStr = fsq?.rating != null ? `, ${fsq.rating}⭐ (FSQ)` : "";
        const skipStr = skipEnrichment ? " [skipped]" : "";
        console.log(`   ✅ ${place.name} (${resolvedNeighborhood}${ratingStr})${skipStr}`);
      }

      await new Promise((r) => setTimeout(r, 150));
    }

    console.log();
  }

  await supabase.from("ingestion_jobs").insert({
    source: "google_places+foursquare",
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
