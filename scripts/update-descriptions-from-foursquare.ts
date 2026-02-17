/**
 * Backfill short_description from Foursquare Place Details description.
 * Updates all highlights for venues that have foursquare_id.
 *
 * Usage: npx tsx scripts/update-descriptions-from-foursquare.ts
 * Requires: FOURSQUARE_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const FOURSQUARE_API_KEY = process.env.FOURSQUARE_API_KEY!;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FSQ_BASE = "https://places-api.foursquare.com";
const FSQ_HEADERS = {
  Authorization: `Bearer ${FOURSQUARE_API_KEY}`,
  Accept: "application/json",
  "X-Places-Api-Version": "2025-06-17",
};

async function fetchFoursquareDescription(fsqId: string): Promise<string | null> {
  const url = new URL(`${FSQ_BASE}/places/${fsqId}`);
  url.searchParams.set("fields", "description");
  const res = await fetch(url.toString(), { headers: FSQ_HEADERS });
  if (!res.ok) return null;
  const p = await res.json();
  const d = p.description;
  return typeof d === "string" && d.trim() ? d.trim() : null;
}


async function main() {
  if (!FOURSQUARE_API_KEY) {
    console.error("❌ FOURSQUARE_API_KEY required in .env.local");
    process.exit(1);
  }

  const { data: venues, error: venError } = await supabase
    .from("venues")
    .select("id, foursquare_id, name")
    .not("foursquare_id", "is", null);

  if (venError) {
    console.error("Failed to fetch venues:", venError);
    process.exit(1);
  }

  const { data: highlights, error: hlError } = await supabase
    .from("highlights")
    .select("id, venue_id, title, category, neighborhood, city");

  if (hlError) {
    console.error("Failed to fetch highlights:", hlError);
    process.exit(1);
  }

  const venueById = new Map((venues ?? []).map((v) => [v.id, v]));
  const highlightsByVenue = new Map<string, typeof highlights>();
  for (const h of highlights ?? []) {
    if (!h.venue_id) continue;
    const list = highlightsByVenue.get(h.venue_id) ?? [];
    list.push(h);
    highlightsByVenue.set(h.venue_id, list);
  }

  const toProcess = (venues ?? []).filter((v) => v.foursquare_id);
  console.log(`Updating descriptions for ${toProcess.length} venues (${highlights?.length ?? 0} highlights)`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const venue of toProcess) {
    const fsqId = venue.foursquare_id!;
    const venueHighlights = highlightsByVenue.get(venue.id) ?? [];
    if (venueHighlights.length === 0) continue;

    const description = await fetchFoursquareDescription(fsqId);
    const newDesc = description ?? null; // No generic template — Foursquare only or empty

    for (const h of venueHighlights) {

      const { error } = await supabase
        .from("highlights")
        .update({ short_description: newDesc, updated_at: new Date().toISOString() })
        .eq("id", h.id);

      if (error) {
        console.error(`  Failed to update highlight ${h.id}:`, error.message);
        failed++;
      } else {
        updated++;
        if (description) {
          console.log(`  ✅ ${venue.name} (${h.category}): Foursquare description`);
        } else {
          skipped++;
        }
      }
    }

    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\nDone. Updated: ${updated} (${updated - skipped} from Foursquare, ${skipped} cleared/no description), Failed: ${failed}`);
}

main();
