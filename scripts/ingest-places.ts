/**
 * Google Places API → Supabase ingestion script
 *
 * Searches for top-rated establishments in Buenos Aires by category,
 * creates venue + highlight records.
 *
 * Usage: npx tsx scripts/ingest-places.ts
 * Requires: GOOGLE_PLACES_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY!;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Categories to scrape with their Google Places type and our internal category
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

// Buenos Aires center coordinates
const BA_LAT = -34.6037;
const BA_LNG = -58.3816;
const RADIUS = 15000; // 15km

interface PlaceResult {
  place_id: string;
  name: string;
  formatted_address?: string;
  geometry: { location: { lat: number; lng: number } };
  rating?: number;
  user_ratings_total?: number;
  opening_hours?: { weekday_text?: string[] };
  website?: string;
  formatted_phone_number?: string;
  editorial_summary?: { overview?: string };
  vicinity?: string;
}

async function searchPlaces(query: string, type: string): Promise<PlaceResult[]> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  url.searchParams.set("query", query);
  url.searchParams.set("location", `${BA_LAT},${BA_LNG}`);
  url.searchParams.set("radius", String(RADIUS));
  url.searchParams.set("type", type);
  url.searchParams.set("key", GOOGLE_API_KEY);

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.status !== "OK") {
    console.error(`Search failed for "${query}":`, data.status, data.error_message);
    return [];
  }

  // Filter to 4.0+ stars only
  return (data.results as PlaceResult[]).filter((p) => (p.rating ?? 0) >= 4.0);
}

async function getPlaceDetails(placeId: string): Promise<PlaceResult | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "place_id,name,formatted_address,geometry,rating,user_ratings_total,opening_hours,website,formatted_phone_number,editorial_summary,vicinity");
  url.searchParams.set("key", GOOGLE_API_KEY);

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.status !== "OK") return null;
  return data.result;
}

function guessNeighborhood(address: string): string {
  const neighborhoods = [
    "Palermo", "Recoleta", "San Telmo", "La Boca", "Belgrano",
    "Colegiales", "Nuñez", "Caballito", "Almagro", "Villa Crespo",
    "Retiro", "Puerto Madero", "Monserrat", "San Nicolás", "Balvanera",
    "Boedo", "Barracas", "Constitución", "Flores", "Microcentro",
  ];
  for (const n of neighborhoods) {
    if (address.toLowerCase().includes(n.toLowerCase())) return n;
  }
  return "Buenos Aires";
}

async function upsertVenue(place: PlaceResult) {
  const neighborhood = guessNeighborhood(place.formatted_address ?? place.vicinity ?? "");

  const { data, error } = await supabase
    .from("venues")
    .upsert(
      {
        google_place_id: place.place_id,
        name: place.name,
        address: place.formatted_address ?? place.vicinity,
        city: "Buenos Aires",
        neighborhood,
        latitude: place.geometry.location.lat,
        longitude: place.geometry.location.lng,
        phone: place.formatted_phone_number ?? null,
        website_url: place.website ?? null,
        google_rating: place.rating ?? null,
        google_rating_count: place.user_ratings_total ?? null,
        opening_hours: place.opening_hours?.weekday_text ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "google_place_id" }
    )
    .select("id")
    .single();

  if (error) {
    console.error(`  Venue upsert failed for ${place.name}:`, error.message);
    return null;
  }
  return data.id;
}

async function upsertHighlight(
  venueId: string,
  place: PlaceResult,
  category: string
) {
  const neighborhood = guessNeighborhood(place.formatted_address ?? place.vicinity ?? "");
  const description =
    place.editorial_summary?.overview ??
    `${place.name} — a top-rated ${category.replace(/_/g, " ")} in ${neighborhood}, Buenos Aires.`;

  const { error } = await supabase.from("highlights").upsert(
    {
      title: place.name,
      short_description: description,
      category,
      venue_id: venueId,
      city: "Buenos Aires",
      neighborhood,
      url: place.website ?? null,
      status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "venue_id,category", ignoreDuplicates: true }
  );

  if (error) {
    console.error(`  Highlight upsert failed for ${place.name}:`, error.message);
  }
}

async function main() {
  console.log("🔍 Starting Google Places ingestion for Buenos Aires...\n");

  let totalFetched = 0;
  let totalSaved = 0;

  for (const { query, type, category } of CATEGORIES) {
    console.log(`📂 ${category}: "${query}"`);
    const places = await searchPlaces(query, type);
    console.log(`   Found ${places.length} places (4.0+ stars)`);
    totalFetched += places.length;

    for (const place of places) {
      // Get details for richer data
      const details = await getPlaceDetails(place.place_id);
      const p = details ?? place;

      const venueId = await upsertVenue(p);
      if (venueId) {
        await upsertHighlight(venueId, p, category);
        totalSaved++;
        console.log(`   ✅ ${p.name} (${p.rating}⭐, ${p.user_ratings_total} reviews)`);
      }

      // Respect rate limits
      await new Promise((r) => setTimeout(r, 200));
    }

    console.log();
  }

  // Log ingestion job
  await supabase.from("ingestion_jobs").insert({
    source: "google_places",
    status: "success",
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    items_fetched: totalFetched,
    items_successful: totalSaved,
  });

  console.log(`\n✨ Done! Fetched ${totalFetched}, saved ${totalSaved} highlights.`);
}

main().catch(console.error);
