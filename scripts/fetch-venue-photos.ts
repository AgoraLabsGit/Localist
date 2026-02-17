/**
 * Fetch Foursquare photos for venues.
 * Uses Outdoor + Vibe (indoor_or_ambience) only — no menus, logos, cutlery, drink close-ups.
 *
 * Usage:
 *   npx tsx scripts/fetch-venue-photos.ts              # only venues missing photos
 *   npx tsx scripts/fetch-venue-photos.ts --refresh    # re-fetch all (requires "yes" or --yes)
 *   npx tsx scripts/fetch-venue-photos.ts --refresh --yes  # skip prompt (e.g. Cursor terminal)
 *   LOCALIST_PHOTO_REFRESH=1 npx tsx scripts/fetch-venue-photos.ts --refresh  # env var alternative
 *   npx tsx scripts/fetch-venue-photos.ts --debug       # fetch 1 venue, log raw API response
 *   npx tsx scripts/fetch-venue-photos.ts --refresh --no-fallback  # skip unfiltered fallback (saves ~50% credits)
 * Requires: FOURSQUARE_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import * as readline from "readline";

const FOURSQUARE_API_KEY = process.env.FOURSQUARE_API_KEY!;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FSQ_PHOTOS_URL = "https://places-api.foursquare.com/places";

/** Outdoor + Vibe (ambience) only — no menus, logos, food close-ups, product shots */
const PREFERRED_CLASSIFICATIONS =
  "outdoor,outdoor_building_exterior,outdoor_or_storefront,outdoor_scenery,indoor_or_ambience";

/** For scoring when fallback returns unfiltered photos */
const PREFERRED = [
  "outdoor",
  "outdoor_building_exterior",
  "outdoor_or_storefront",
  "outdoor_scenery",
  "outdoor_grounds",
  "indoor_or_ambience",
];
const AVOID = ["logos", "menu", "product", "food_or_drink", "indoor_general"];

function pickBestPhoto(items: Array<{ prefix?: string; suffix?: string; classifications?: string[] }>): { prefix: string; suffix: string } | null {
  if (!items?.length) return null;
  const valid = items.filter((p) => p?.prefix && p?.suffix);
  if (valid.length === 0) return null;
  const score = (p: { classifications?: string[] }) => {
    const classes = p.classifications ?? [];
    let s = 0;
    for (const c of classes) {
      if (PREFERRED.includes(c)) s += 10;
      if (AVOID.includes(c)) s -= 15;
    }
    return s;
  };
  valid.sort((a, b) => score(b) - score(a));
  return { prefix: valid[0].prefix!, suffix: valid[0].suffix! };
}

async function fetchPlacePhotos(fsqId: string): Promise<{ prefix: string; suffix: string } | null> {
  const headers = {
    Authorization: `Bearer ${FOURSQUARE_API_KEY}`,
    Accept: "application/json",
    "X-Places-Api-Version": "2025-06-17",
  };

  let items: Array<{ prefix?: string; suffix?: string; classifications?: string[] }> = [];

  const noFallback = process.env.LOCALIST_PHOTO_NO_FALLBACK === "1" || process.argv.includes("--no-fallback");
  const urls: string[] = [
    `${FSQ_PHOTOS_URL}/${fsqId}/photos?limit=20&classifications=${PREFERRED_CLASSIFICATIONS}`,
  ];
  if (!noFallback) urls.push(`${FSQ_PHOTOS_URL}/${fsqId}/photos?limit=20`);

  for (const url of urls) {
    const res = await fetch(url, { headers });
    if (!res.ok) continue;
    const json = await res.json();
    items = Array.isArray(json) ? json : (json.photos?.items ?? json.items ?? []);
    if (items?.length > 0) break;
  }

  return pickBestPhoto(items);
}

async function main() {
  if (!FOURSQUARE_API_KEY) {
    console.error("❌ FOURSQUARE_API_KEY required in .env.local");
    process.exit(1);
  }

  const debug = process.argv.includes("--debug");
  const refresh = process.argv.includes("--refresh");
  const skipConfirm =
    process.argv.includes("--yes") || process.env.LOCALIST_PHOTO_REFRESH === "1";

  if (debug) {
    const { data: venues } = await supabase
      .from("venues")
      .select("id, name, foursquare_id")
      .not("foursquare_id", "is", null);
    const v = (venues ?? []).find((x) => x.foursquare_id) ?? venues?.[0];
    if (!v?.foursquare_id) {
      console.error("No venue with foursquare_id found");
      process.exit(1);
    }
    // Prefer venue we know has photos (Elena, etc.)
    const testVenue = v;
    console.log(`\n🔍 Debug: ${testVenue.name} (${testVenue.foursquare_id})\n`);
    const url = `${FSQ_PHOTOS_URL}/${testVenue.foursquare_id}/photos?limit=10&classifications=${PREFERRED_CLASSIFICATIONS}`;
    console.log("Request (filtered):", url);
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${FOURSQUARE_API_KEY}`,
        Accept: "application/json",
        "X-Places-Api-Version": "2025-06-17",
      },
    });
    console.log("Status:", res.status);
    const json = await res.json();
    console.log("Response type:", Array.isArray(json) ? "array" : typeof json);
    const items = Array.isArray(json) ? json : (json.photos?.items ?? json.items ?? []);
    console.log("Photos count:", items?.length);
    if (items?.length > 0) {
      console.log("\nFirst 3 photos (prefix, classifications):");
      items.slice(0, 3).forEach((p: { prefix?: string; classifications?: string[] }, i: number) => {
        console.log(`  ${i + 1}. classifications=${JSON.stringify(p.classifications ?? [])}`);
      });
    }
    const unfilteredUrl = `${FSQ_PHOTOS_URL}/${testVenue.foursquare_id}/photos?limit=10`;
    console.log("\nRequest (unfiltered):", unfilteredUrl);
    const res2 = await fetch(unfilteredUrl, {
      headers: {
        Authorization: `Bearer ${FOURSQUARE_API_KEY}`,
        Accept: "application/json",
        "X-Places-Api-Version": "2025-06-17",
      },
    });
    const json2 = await res2.json();
    const items2 = Array.isArray(json2) ? json2 : (json2.photos?.items ?? json2.items ?? []);
    console.log("Unfiltered photos count:", items2?.length);
    if (items2?.length > 0) {
      console.log("\nFirst 5 photos (classifications):");
      items2.slice(0, 5).forEach((p: { prefix?: string; classifications?: string[] }, i: number) => {
        console.log(`  ${i + 1}. ${JSON.stringify(p.classifications ?? [])}`);
      });
    }
    process.exit(0);
  }

  const { data: venues, error } = await supabase
    .from("venues")
    .select("id, foursquare_id, fsq_photo_prefix")
    .not("foursquare_id", "is", null);

  if (error) {
    console.error("Failed to fetch venues:", error);
    process.exit(1);
  }

  const toFetch = refresh
    ? (venues ?? []).filter((v) => v.foursquare_id)
    : (venues ?? []).filter((v) => v.foursquare_id && !v.fsq_photo_prefix);
  console.log(`Found ${toFetch.length} venues to ${refresh ? "refresh" : "fetch"}`);

  if (refresh && toFetch.length > 0 && !skipConfirm) {
    if (!process.stdin.isTTY) {
      console.error("Non-interactive terminal. Use --yes or LOCALIST_PHOTO_REFRESH=1 to confirm.");
      process.exit(1);
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise<string>((resolve) => {
      rl.question(
        `⚠️  Refresh will make ~${toFetch.length * 2} API calls. Type "yes" to continue: `,
        resolve
      );
    });
    rl.close();
    if (answer.toLowerCase().trim() !== "yes") {
      console.log("Aborted.");
      process.exit(0);
    }
  }

  let ok = 0;
  let fail = 0;
  let i = 0;

  for (const venue of toFetch) {
    i++;
    const fsqId = venue.foursquare_id!;
    const photo = await fetchPlacePhotos(fsqId);
    if (photo) {
      const { error: updErr } = await supabase
        .from("venues")
        .update({
          fsq_photo_prefix: photo.prefix,
          fsq_photo_suffix: photo.suffix,
        })
        .eq("id", venue.id);
      if (updErr) {
        console.error(`  [${i}/${toFetch.length}] Failed ${venue.id}:`, updErr.message);
        fail++;
      } else {
        ok++;
      }
    } else {
      fail++;
    }
    if (i % 15 === 0 || i === toFetch.length) {
      process.stdout.write(`\r  [${i}/${toFetch.length}] Updated: ${ok}, Failed: ${fail}   `);
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\nDone. Updated: ${ok}, Failed: ${fail}`);
}

main();
