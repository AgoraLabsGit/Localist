#!/usr/bin/env npx tsx
/**
 * Quick check: are short_description and vibe_tags populated in highlights?
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data, error } = await supabase
    .from("highlights")
    .select("title, short_description, vibe_tags, updated_at")
    .eq("city", "Buenos Aires")
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }

  const withDesc = (data ?? []).filter((h) => h.short_description?.trim()).length;
  const withVibe = (data ?? []).filter((h) => Array.isArray(h.vibe_tags) && h.vibe_tags.length > 0).length;
  console.log(`\n📊 Sample of 20 highlights (most recently updated):`);
  console.log(`   With short_description: ${withDesc}/20`);
  console.log(`   With vibe_tags: ${withVibe}/20\n`);
  for (const h of data ?? []) {
    const desc = h.short_description ? (h.short_description as string).slice(0, 60) + "…" : "—";
    console.log(`   ${(h.title as string).slice(0, 35).padEnd(36)} | ${desc}`);
  }
}

main();
