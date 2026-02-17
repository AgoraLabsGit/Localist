/**
 * One-time: Normalize city_neighborhoods.name to title case.
 * Fixes ALL CAPS from GeoJSON sync (e.g. LINIERS → Liniers).
 *
 * Usage: npx tsx scripts/normalize-neighborhood-names.ts [city-slug]
 *        npx tsx scripts/normalize-neighborhood-names.ts buenos-aires
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Avoids \\b\\w so accented chars (ó, ñ) don't trigger spurious caps. */
function toTitleCase(name: string): string {
  let result = "";
  let startOfWord = true;
  for (const c of name.toLowerCase()) {
    if (/\s/.test(c)) {
      startOfWord = true;
      result += c;
    } else {
      result += startOfWord ? c.toUpperCase() : c;
      startOfWord = false;
    }
  }
  return result;
}

async function main() {
  const citySlug = process.argv[2] ?? "buenos-aires";

  const { data: city } = await supabase
    .from("cities")
    .select("id, name")
    .eq("slug", citySlug)
    .single();

  if (!city) {
    console.error(`City ${citySlug} not found`);
    process.exit(1);
  }

  const { data: neighborhoods } = await supabase
    .from("city_neighborhoods")
    .select("id, name")
    .eq("city_id", city.id);

  let updated = 0;
  for (const n of neighborhoods ?? []) {
    const normalized = toTitleCase(n.name);
    if (n.name !== normalized) {
      const { error } = await supabase
        .from("city_neighborhoods")
        .update({ name: normalized })
        .eq("id", n.id);
      if (!error) {
        console.log(`  ${n.name} → ${normalized}`);
        updated++;
      }
    }
  }

  console.log(`\n✨ Updated ${updated} neighborhood names for ${city.name}`);
}

main().catch(console.error);
