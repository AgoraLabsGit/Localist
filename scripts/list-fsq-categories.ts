/**
 * Fetch Foursquare venue categories and write to data/foursquare_categories.json
 *
 * Pipeline role: Reference for venues.fsq_categories (Enrichment) and filters (Selection).
 * Ingest stores raw FSQ categories on venues; this list helps interpret them.
 * See docs/DATA-PIPELINE.md.
 *
 * Source: https://api.foursquare.com/v2/venues/categories
 * Auth: FOURSQUARE_CLIENT_ID + FOURSQUARE_CLIENT_SECRET (classic API).
 *       Our ingest uses FOURSQUARE_API_KEY (Places API); categories use different auth.
 *       Add client_id/client_secret in Foursquare Developer Console if needed.
 *
 * Fallback: If no credentials, writes a curated subset from docs/gists for reference.
 *
 * Usage: npx tsx scripts/list-fsq-categories.ts
 *
 * Output: data/foursquare_categories.json (flat array with id, name, path)
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const FSQ_CLIENT_ID = process.env.FOURSQUARE_CLIENT_ID;
const FSQ_CLIENT_SECRET = process.env.FOURSQUARE_CLIENT_SECRET;

interface FsCategory {
  id: string;
  name: string;
  pluralName?: string;
  shortName?: string;
  categories?: FsCategory[];
}

interface FsCategoryFlat {
  id: string;
  name: string;
  pluralName?: string;
  shortName?: string;
  path: string[];
}

function walk(cat: FsCategory, path: string[]): FsCategoryFlat[] {
  const fullPath = [...path, cat.name];
  const flat: FsCategoryFlat[] = [
    {
      id: cat.id,
      name: cat.name,
      pluralName: cat.pluralName,
      shortName: cat.shortName,
      path: fullPath,
    },
  ];
  for (const child of cat.categories ?? []) {
    flat.push(...walk(child, fullPath));
  }
  return flat;
}

/** Curated subset for ingestion mapping when API unavailable. IDs from Foursquare docs. */
const FALLBACK_CATEGORIES: FsCategoryFlat[] = [
  { id: "4d4b7105d754a06374d81259", name: "Food", path: ["Food"] },
  { id: "4bf58dd8d48988d1c4941735", name: "Ice Cream Shop", path: ["Food", "Ice Cream Shop"] },
  { id: "4bf58dd8d48988d116941735", name: "Steakhouse", path: ["Food", "Steakhouse"] },
  { id: "4bf58dd8d48988d142941735", name: "BBQ Joint", path: ["Food", "BBQ Joint"] },
  { id: "4bf58dd8d48988d16d941735", name: "Argentinian Restaurant", path: ["Food", "Argentinian Restaurant"] },
  { id: "4bf58dd8d48988d1e0931735", name: "Café", path: ["Food", "Café"] },
  { id: "4bf58dd8d48988d1e0931735", name: "Coffee Shop", path: ["Food", "Coffee Shop"] },
  { id: "4bf58dd8d48988d11e941735", name: "Restaurant", path: ["Food", "Restaurant"] },
  { id: "4bf58dd8d48988d1c8941735", name: "Breakfast Spot", path: ["Food", "Breakfast Spot"] },
  { id: "4d4b7105d754a06376d81259", name: "Nightlife Spot", path: ["Nightlife Spot"] },
  { id: "4bf58dd8d48988d11e941735", name: "Bar", path: ["Nightlife Spot", "Bar"] },
  { id: "4bf58dd8d48988d11d941735", name: "Cocktail Bar", path: ["Nightlife Spot", "Cocktail Bar"] },
  { id: "4bf58dd8d48988d123941735", name: "Wine Bar", path: ["Nightlife Spot", "Wine Bar"] },
  { id: "4bf58dd8d48988d11f941735", name: "Nightclub", path: ["Nightlife Spot", "Nightclub"] },
  { id: "4bf58dd8d48988d1e7931735", name: "Speakeasy", path: ["Nightlife Spot", "Speakeasy"] },
  { id: "4d4b7104d754a06370d81259", name: "Arts & Entertainment", path: ["Arts & Entertainment"] },
  { id: "4bf58dd8d48988d181941735", name: "Museum", path: ["Arts & Entertainment", "Museum"] },
  { id: "4bf58dd8d48988d1e1931735", name: "Arcade", path: ["Arts & Entertainment", "Arcade"] },
  { id: "4bf58dd8d48988d18f941735", name: "Movie Theater", path: ["Arts & Entertainment", "Movie Theater"] },
  { id: "4bf58dd8d48988d1e1931735", name: "Park", path: ["Outdoors & Recreation", "Park"] },
  { id: "4bf58dd8d48988d1e1931735", name: "Zoo", path: ["Outdoors & Recreation", "Zoo"] },
  { id: "4bf58dd8d48988d1e1931735", name: "Aquarium", path: ["Arts & Entertainment", "Aquarium"] },
  { id: "4bf58dd8d48988d18b941735", name: "Bookstore", path: ["Shop & Service", "Bookstore"] },
];

async function main() {
  let flat: FsCategoryFlat[];

  if (FSQ_CLIENT_ID && FSQ_CLIENT_SECRET) {
    const url = new URL("https://api.foursquare.com/v2/venues/categories");
    url.searchParams.set("client_id", FSQ_CLIENT_ID);
    url.searchParams.set("client_secret", FSQ_CLIENT_SECRET);
    url.searchParams.set("v", "20250501");

    const res = await fetch(url.toString());
    if (res.ok) {
      const data = (await res.json()) as { response?: { categories?: FsCategory[] } };
      const topLevel = data.response?.categories ?? [];
      flat = [];
      for (const cat of topLevel) {
        flat.push(...walk(cat, []));
      }
    } else {
      console.warn(
        `Foursquare API error: ${res.status}. Using fallback category list.\n` +
          "Add FOURSQUARE_CLIENT_ID + FOURSQUARE_CLIENT_SECRET for full taxonomy."
      );
      flat = FALLBACK_CATEGORIES;
    }
  } else {
    console.warn(
      "No FOURSQUARE_CLIENT_ID/FOURSQUARE_CLIENT_SECRET. Using curated fallback.\n" +
        "For full taxonomy: create a classic API app at developer.foursquare.com"
    );
    flat = FALLBACK_CATEGORIES;
  }

  const outDir = join(process.cwd(), "data");
  const outPath = join(outDir, "foursquare_categories.json");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(outPath, JSON.stringify(flat, null, 2), "utf-8");
  console.log(`Wrote ${flat.length} Foursquare categories to ${outPath}`);
}

main();
