#!/usr/bin/env npx tsx
/**
 * Check highlights in a specific neighborhood — descriptions, photos, FSQ match.
 * Usage: npx tsx scripts/check-neighborhood.ts [neighborhood] [category]
 * Example: npx tsx scripts/check-neighborhood.ts "Villa Urquiza" cafe
 */
import { config } from "dotenv";
import { join } from "path";
config({ path: join(process.cwd(), ".env.local") });
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const neighborhood = process.argv[2] ?? "Villa Urquiza";
  const category = process.argv[3] ?? "cafe";

  const nNorm = (s: string) => s.toLowerCase().trim();
  const nMatch = (v: string | null) => v && nNorm(v).includes(nNorm(neighborhood));

  const { data: highlights, error } = await supabase
    .from("highlights")
    .select("id, title, short_description, category, neighborhood, venue:venues(id, name, neighborhood, foursquare_id, fsq_photo_prefix, photo_urls)")
    .eq("city", "Buenos Aires")
    .eq("status", "active")
    .eq("category", category);

  if (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }

  const inHood = (highlights ?? []).filter((h) => {
    const v = Array.isArray(h.venue) ? h.venue[0] : h.venue;
    const vNeigh = (v as { neighborhood?: string | null })?.neighborhood;
    const hNeigh = h.neighborhood as string | null;
    return nMatch(hNeigh ?? "") || nMatch(vNeigh ?? "");
  });

  let withDesc = 0;
  let withPhoto = 0;
  let withFsq = 0;

  console.log(`\n📊 ${neighborhood} — ${category}s (${inHood.length} highlights)\n`);

  for (const h of inHood) {
    const v = Array.isArray(h.venue) ? h.venue[0] : (h.venue as { id?: string; name?: string; neighborhood?: string | null; foursquare_id?: string | null; fsq_photo_prefix?: string | null; photo_urls?: string[] } | null);
    const hasDesc = Boolean(h.short_description && String(h.short_description).trim());
    const hasFsqPhoto = Boolean(v?.fsq_photo_prefix);
    const hasPhotoUrls = Array.isArray(v?.photo_urls) && v.photo_urls.length > 0;
    const hasPhoto = hasFsqPhoto || hasPhotoUrls;
    if (hasDesc) withDesc++;
    if (hasPhoto) withPhoto++;
    if (v?.foursquare_id) withFsq++;

    const desc = hasDesc ? "✓" : "—";
    const photo = hasPhoto ? "✓" : "—";
    const fsq = v?.foursquare_id ? "✓" : "—";
    console.log(`   ${(h.title as string).slice(0, 40).padEnd(42)} | desc:${desc} photo:${photo} fsq:${fsq}`);
  }

  console.log(`\n   Summary: ${withDesc}/${inHood.length} with description, ${withPhoto}/${inHood.length} with photo, ${withFsq}/${inHood.length} with FSQ match`);
  if (inHood.length === 0) {
    console.log(`\n   No highlights found. Run ingest with neighborhood queries, or check neighborhood name spelling.`);
  } else if (withDesc < inHood.length || withPhoto < inHood.length) {
    console.log(`\n   Remediation:`);
    if (withDesc < inHood.length) console.log(`   - Descriptions: npm run enrich:venues:ai buenos-aires && npm run enrich:venues:ai:web buenos-aires`);
    if (withPhoto < inHood.length) console.log(`   - Photos: npm run fetch:venue-photos (requires foursquare_id; fetches fsq_photo_prefix/suffix)`);
  }
  console.log("");
}

main();
