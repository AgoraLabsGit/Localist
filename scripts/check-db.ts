/**
 * Verify what's actually in the DB after ingest.
 * Run: npx tsx scripts/check-db.ts
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("\n📊 DB diagnostic — venues & highlights\n");

  const { data: venues, error: vErr } = await supabase
    .from("venues")
    .select("id, name, neighborhood, foursquare_id, rating, rating_count, address, photo_urls")
    .limit(10);

  if (vErr) {
    console.error("Venues query error:", vErr.message);
    return;
  }

  console.log("Sample venues (first 10):\n");
  for (const v of venues ?? []) {
    const hasPhotos = Array.isArray(v.photo_urls) && v.photo_urls.length > 0;
    console.log(`  ${v.name}`);
    console.log(`    neighborhood: ${v.neighborhood ?? "(null)"}`);
    console.log(`    foursquare_id: ${v.foursquare_id ?? "(null)"}`);
    console.log(`    rating: ${v.rating ?? "(null)"} | rating_count: ${v.rating_count ?? "(null)"}`);
    console.log(`    address: ${v.address ? "yes" : "no"} | photos: ${hasPhotos ? v.photo_urls.length : 0}`);
    console.log("");
  }

  const { data: highlights, error: hErr } = await supabase
    .from("highlights")
    .select("title, category, neighborhood, avg_expected_price, venue:venues(neighborhood, rating, rating_count)")
    .limit(10);

  if (hErr) {
    console.error("Highlights query error:", hErr.message);
    return;
  }

  console.log("Sample highlights (first 10):\n");
  for (const h of highlights ?? []) {
    const v = Array.isArray(h.venue) ? h.venue[0] : h.venue;
    console.log(`  ${h.title} [${h.category}]`);
    console.log(`    highlight.neighborhood: ${h.neighborhood ?? "(null)"}`);
    console.log(`    venue.neighborhood: ${v?.neighborhood ?? "(null)"}`);
    console.log(`    avg_expected_price: ${h.avg_expected_price ?? "(null)"} (→ $/$$/$$$)`);
    console.log(`    venue.rating: ${v?.rating ?? "(null)"} | rating_count: ${v?.rating_count ?? "(null)"}`);
    console.log("");
  }

  const { count: venueCount } = await supabase
    .from("venues")
    .select("id", { count: "exact", head: true });
  const { count: withNeighborhood } = await supabase
    .from("venues")
    .select("id", { count: "exact", head: true })
    .not("neighborhood", "is", null)
    .neq("neighborhood", "Buenos Aires");
  const { count: withFsq } = await supabase
    .from("venues")
    .select("id", { count: "exact", head: true })
    .not("foursquare_id", "is", null);
  const { count: withPrice } = await supabase
    .from("highlights")
    .select("id", { count: "exact", head: true })
    .not("avg_expected_price", "is", null);

  console.log("Summary:");
  console.log(`  Total venues: ${venueCount ?? 0}`);
  console.log(`  With Foursquare match: ${withFsq ?? 0}`);
  console.log(`  With specific neighborhood (not "Buenos Aires"): ${withNeighborhood ?? 0}`);
  console.log(`  Highlights with price: ${withPrice ?? 0}`);
  console.log("");
}

main().catch(console.error);
