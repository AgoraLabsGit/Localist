/**
 * Clear Foursquare photo data for venues with wrong FSQ match (e.g. La Baldosa Milonga showing fish store).
 * Use when ingest picked a nearby wrong venue due to loose matching.
 *
 * Usage:
 *   npx tsx scripts/fix-venue-fsq-photos.ts "La Baldosa Milonga"
 *   npx tsx scripts/fix-venue-fsq-photos.ts --list   # show venues with FSQ photos (for inspection)
 *
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
  const list = process.argv.includes("--list");
  const args = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const nameArg = args.length > 0 ? args.join(" ") : null;

  if (list) {
    const { data } = await supabase
      .from("venues")
      .select("id, name, neighborhood, foursquare_id, fsq_photo_prefix")
      .not("foursquare_id", "is", null);
    console.log("Venues with Foursquare data:\n");
    for (const v of data ?? []) {
      console.log(`  ${v.name} (${v.neighborhood}) — fsq: ${v.foursquare_id ?? "-"}`);
    }
    return;
  }

  if (!nameArg) {
    console.error("Usage: npx tsx scripts/fix-venue-fsq-photos.ts \"Venue Name\"");
    console.error("       npx tsx scripts/fix-venue-fsq-photos.ts --list");
    process.exit(1);
  }

  const { data: venues } = await supabase
    .from("venues")
    .select("id, name, foursquare_id")
    .ilike("name", `%${nameArg}%`);

  if (!venues?.length) {
    console.error(`No venue found matching "${nameArg}"`);
    process.exit(1);
  }
  if (venues.length > 1) {
    console.log(`Multiple matches. Clearing FSQ photos for all:`);
    for (const v of venues) console.log(`  - ${v.name} (${v.id})`);
  }

  for (const v of venues) {
    const { error } = await supabase
      .from("venues")
      .update({
        foursquare_id: null,
        fsq_photo_prefix: null,
        fsq_photo_suffix: null,
        photo_urls: [],
        has_fsq_data: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", v.id);

    if (error) {
      console.error(`Failed for ${v.name}:`, error.message);
    } else {
      console.log(`✅ Cleared FSQ data for: ${v.name}`);
    }
  }
}

main().catch(console.error);
