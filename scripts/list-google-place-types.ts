/**
 * Fetch/embed Google Place types and write to data/google_place_types.json
 *
 * Pipeline role: Reference for city_categories.google_included_type.
 * Discovery uses includedType per category; run this to validate types when seeding.
 * See docs/DATA-PIPELINE.md.
 *
 * Sources:
 * - Official docs: https://developers.google.com/maps/documentation/places/web-service/legacy/supported_types
 * - Maintained list: https://github.com/brycekbargar/google-place-types (Table 1 types)
 *
 * Usage: npx tsx scripts/list-google-place-types.ts
 *
 * Output: data/google_place_types.json (array of type strings)
 */

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

// Table 1 types: searchable place types from official docs (legacy supported_types).
// brycekbargar/google-place-types covers these. Includes grocery_or_supermarket
// which the docs page shows as "supermarket". We use the npm package's list
// as canonical; add ice_cream_shop and tourist_attraction from Table 1 that
// may be in newer APIs.
const GOOGLE_PLACE_TYPES: string[] = [
  "accounting",
  "airport",
  "amusement_park",
  "aquarium",
  "art_gallery",
  "atm",
  "bakery",
  "bank",
  "bar",
  "beauty_salon",
  "bicycle_store",
  "book_store",
  "bowling_alley",
  "bus_station",
  "cafe",
  "campground",
  "car_dealer",
  "car_rental",
  "car_repair",
  "car_wash",
  "casino",
  "cemetery",
  "church",
  "city_hall",
  "clothing_store",
  "convenience_store",
  "courthouse",
  "dentist",
  "department_store",
  "doctor",
  "electrician",
  "electronics_store",
  "embassy",
  "fire_station",
  "florist",
  "funeral_home",
  "furniture_store",
  "gas_station",
  "grocery_or_supermarket",
  "gym",
  "hair_care",
  "hardware_store",
  "hindu_temple",
  "home_goods_store",
  "hospital",
  "ice_cream_shop", // Table 1, not in brycekbargar list
  "insurance_agency",
  "jewelry_store",
  "laundry",
  "lawyer",
  "library",
  "liquor_store",
  "local_government_office",
  "locksmith",
  "lodging",
  "meal_delivery",
  "meal_takeaway",
  "mosque",
  "movie_rental",
  "movie_theater",
  "moving_company",
  "museum",
  "night_club",
  "painter",
  "park",
  "parking",
  "pet_store",
  "pharmacy",
  "physiotherapist",
  "plumber",
  "police",
  "post_office",
  "primary_school",
  "real_estate_agency",
  "restaurant",
  "roofing_contractor",
  "rv_park",
  "school",
  "secondary_school",
  "shoe_store",
  "shopping_mall",
  "spa",
  "stadium",
  "storage",
  "store",
  "subway_station",
  "supermarket", // alias for grocery_or_supermarket in some contexts
  "synagogue",
  "taxi_stand",
  "tourist_attraction", // Table 1, important for discovery
  "train_station",
  "transit_station",
  "travel_agency",
  "university",
  "veterinary_care",
  "zoo",
];

// Dedupe and sort for clean output
const types = [...new Set(GOOGLE_PLACE_TYPES)].sort();

const outDir = join(process.cwd(), "data");
const outPath = join(outDir, "google_place_types.json");
mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, JSON.stringify(types, null, 2), "utf-8");
console.log(`Wrote ${types.length} Google Place types to ${outPath}`);
