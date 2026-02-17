/**
 * Debug script: Check if Foursquare has a specific place.
 * Use to confirm whether missing data is due to Foursquare not having it vs our search not matching.
 *
 * Usage: npx tsx scripts/check-foursquare.ts "Backroom Bar"
 * Requires: FOURSQUARE_API_KEY in .env.local
 *
 * Note: Uses new Places API (places-api.foursquare.com). Old api.foursquare.com/v3/ returns 410.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

const FOURSQUARE_API_KEY = process.env.FOURSQUARE_API_KEY!;
const DEFAULT_LAT = -34.6037;
const DEFAULT_LNG = -58.3816;

const FSQ_HEADERS = {
  Authorization: `Bearer ${FOURSQUARE_API_KEY}`,
  Accept: "application/json",
  "X-Places-Api-Version": "2025-06-17",
};

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const query = args[0] ?? "Backroom Bar";

  if (!FOURSQUARE_API_KEY) {
    console.error("❌ FOURSQUARE_API_KEY required in .env.local");
    process.exit(1);
  }

  console.log(`\n🔍 Foursquare Places API search: "${query}" near (${DEFAULT_LAT}, ${DEFAULT_LNG})\n`);

  const searchUrl = new URL("https://places-api.foursquare.com/places/search");
  searchUrl.searchParams.set("ll", `${DEFAULT_LAT},${DEFAULT_LNG}`);
  searchUrl.searchParams.set("query", query);
  searchUrl.searchParams.set("limit", "10");
  searchUrl.searchParams.set("fields", "name,fsq_place_id,location,hours,tel,website,rating");

  const searchRes = await fetch(searchUrl.toString(), { headers: FSQ_HEADERS });
  const searchData = await searchRes.json();

  if (!searchRes.ok) {
    console.error("Search failed:", searchRes.status, JSON.stringify(searchData, null, 2));
    if (searchRes.status === 401) console.error("\n💡 Check FOURSQUARE_API_KEY. New Places API may require a Service Key.");
    process.exit(1);
  }

  const results = searchData.results ?? [];
  console.log(`Raw search: ${results.length} result(s)\n`);

  if (results.length === 0) {
    console.log("✅ CONFIRMED: Foursquare returned 0 results — Foursquare does not have this place (or query doesn't match).");
    return;
  }

  results.forEach((r: { name?: string; fsq_place_id?: string; location?: { formatted_address?: string } }, i: number) => {
    console.log(`  ${i + 1}. ${r.name} (fsq_place_id: ${r.fsq_place_id})`);
    console.log(`     Address: ${r.location?.formatted_address ?? "—"}`);
    console.log(`     Hours: ${(r as Record<string, unknown>).hours ? JSON.stringify((r as Record<string, unknown>).hours) : "—"}`);
    console.log(`     Rating: ${(r as Record<string, unknown>).rating ?? "—"}`);
  });

  // Fetch full details for first result
  const first = results[0];
  const fsqId = first?.fsq_place_id ?? (first as { fsq_id?: string }).fsq_id;
  if (!fsqId) {
    console.log("\n(First result has no fsq_place_id, skipping details fetch)");
    return;
  }

  console.log(`\n📋 Full details for "${first.name}" (${fsqId}):\n`);
  const detailUrl = `https://places-api.foursquare.com/places/${fsqId}?fields=location,hours,tel,website,rating`;
  const detailRes = await fetch(detailUrl, { headers: FSQ_HEADERS });
  const detail = await detailRes.json();

  if (!detailRes.ok) {
    console.error("Details fetch failed:", detailRes.status, detail);
    return;
  }

  const loc = detail.location ?? {};
  const address = loc.formatted_address ?? ([loc.address, loc.locality, loc.region].filter(Boolean).join(", ") || "—");
  console.log(`  Address: ${address}`);
  console.log(`  Hours:  ${JSON.stringify(detail.hours ?? "—")}`);
  console.log(`  Phone:  ${detail.tel ?? "—"}`);
  console.log(`  Website: ${detail.website ?? "—"}`);
  console.log(`  Rating: ${detail.rating ?? "—"}`);
}

main().catch(console.error);
