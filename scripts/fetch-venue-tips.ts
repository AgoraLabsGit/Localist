/**
 * Live city refresh: fetch Foursquare tips for venues that need them.
 * Targets venues with foursquare_id but no tips or stale tips (>90 days).
 * Tips are input for AI enrichment (short_description, vibe_tags); per FSQ terms, never exposed as raw corpus.
 * Never overwrites fsq_tips with null/empty — only updates when new tips are returned; leaves existing cache untouched.
 *
 * Usage:
 *   npx tsx scripts/fetch-venue-tips.ts [city-slug]       # only venues missing or stale tips (>90 days)
 *   npx tsx scripts/fetch-venue-tips.ts [city-slug] --refresh   # re-fetch all (ignore freshness)
 *   npx tsx scripts/fetch-venue-tips.ts --all             # all cities (no city filter)
 *
 * Requires: FOURSQUARE_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local
 * Requires: migration 039 (fsq_tips, fsq_tips_fetched_at on venues).
 * Respects admin_settings.max_foursquare_calls_per_run and MAX_FOURSQUARE_CALLS env override.
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { loadCityFromDb, getDefaultCitySlug } from "./lib/load-city-from-db";
import { loadPipelineSettings, resolveMaxFoursquareCalls } from "../src/lib/admin-settings";

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

const MAX_TIPS_PER_VENUE = 8;
const TIPS_FRESHNESS_DAYS = 90;
const RATE_LIMIT_MS = 150;

interface FoursquareTip {
  text: string;
  created_at?: string;
  lang?: string;
  likes?: number;
}

function isTipsStale(fetchedAt: string | null | undefined): boolean {
  if (!fetchedAt) return true;
  const d = new Date(fetchedAt);
  if (Number.isNaN(d.getTime())) return true;
  const daysSince = (Date.now() - d.getTime()) / (24 * 60 * 60 * 1000);
  return daysSince >= TIPS_FRESHNESS_DAYS;
}

async function fetchTips(fsqId: string): Promise<FoursquareTip[]> {
  const url = new URL(`${FSQ_BASE}/places/${fsqId}/tips`);
  url.searchParams.set("limit", String(MAX_TIPS_PER_VENUE));
  url.searchParams.set("sort", "POPULAR");
  url.searchParams.set("fields", "text,created_at,lang,agree_count");

  const res = await fetch(url.toString(), { headers: FSQ_HEADERS });
  if (!res.ok) return [];
  const data = await res.json();
  const items = Array.isArray(data) ? data : data?.results ?? [];
  return items
    .filter((t: { text?: string }) => typeof t?.text === "string" && t.text.trim().length > 0)
    .map((t: { text: string; created_at?: string; lang?: string; agree_count?: number }) => ({
      text: (t.text ?? "").trim(),
      created_at: t.created_at ?? undefined,
      lang: t.lang ?? undefined,
      likes: typeof t.agree_count === "number" ? t.agree_count : undefined,
    }));
}

async function main() {
  const startedAt = new Date();
  if (!FOURSQUARE_API_KEY) {
    console.error("❌ FOURSQUARE_API_KEY required in .env.local");
    process.exit(1);
  }

  const refresh = process.argv.includes("--refresh");
  const allCities = process.argv.includes("--all");
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const citySlug = allCities ? null : (args[0] ?? await getDefaultCitySlug(supabase));

  let cityName: string | null = null;
  if (!allCities && citySlug && citySlug.length > 1) {
    const city = await loadCityFromDb(supabase, citySlug);
    if (city) {
      cityName = city.cityFallbackName ?? city.name;
      console.log(`\n📍 Live city refresh: ${city.name}\n`);
    }
  } else {
    console.log("\n📍 Fetching tips for all cities\n");
  }

  let maxFsq: number | undefined;
  try {
    const settings = await loadPipelineSettings(supabase);
    maxFsq = resolveMaxFoursquareCalls(settings, process.env.MAX_FOURSQUARE_CALLS ? parseInt(process.env.MAX_FOURSQUARE_CALLS, 10) : undefined);
  } catch {
    maxFsq = process.env.MAX_FOURSQUARE_CALLS ? parseInt(process.env.MAX_FOURSQUARE_CALLS, 10) : undefined;
  }
  if (maxFsq != null) console.log(`   Foursquare cap: ${maxFsq}\n`);

  let query = supabase
    .from("venues")
    .select("id, name, foursquare_id, fsq_tips_fetched_at")
    .not("foursquare_id", "is", null);

  if (cityName) query = query.eq("city", cityName);

  const { data: venues, error } = await query;

  if (error) {
    console.error("Failed to fetch venues:", error);
    process.exit(1);
  }

  const toFetch = refresh
    ? (venues ?? []).filter((v) => v.foursquare_id)
    : (venues ?? []).filter((v) => v.foursquare_id && (isTipsStale(v.fsq_tips_fetched_at) || !v.fsq_tips_fetched_at));

  console.log(`   Found ${toFetch.length} venues to ${refresh ? "refresh" : "fetch"} tips for\n`);

  if (toFetch.length === 0) {
    console.log("   Nothing to do.");
    return;
  }

  let updated = 0;
  let failed = 0;
  let capped = false;
  let fsqCalls = 0;

  for (let i = 0; i < toFetch.length; i++) {
    if (maxFsq != null && i >= maxFsq) {
      capped = true;
      console.log(`\n   ⚠️ Reached Foursquare cap (${maxFsq}); stopping.`);
      break;
    }
    const venue = toFetch[i];
    fsqCalls++;
    const tips = await fetchTips(venue.foursquare_id!);
    // Only update when we have new tips; never overwrite with null/empty (preserve existing cache)
    if (tips.length === 0) {
      continue; // skip update, leave existing tips untouched
    }
    const { error: updErr } = await supabase
      .from("venues")
      .update({
        fsq_tips: tips,
        fsq_tips_fetched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", venue.id);

    if (updErr) {
      failed++;
    } else {
      updated++;
    }
    if ((i + 1) % 20 === 0 || i === toFetch.length - 1) {
      process.stdout.write(`\r   [${i + 1}/${toFetch.length}] Updated: ${updated}, Failed: ${failed}   `);
    }
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
  }

  const finishedAt = new Date();
  await supabase.from("pipeline_runs").insert({
    script: "fetch-venue-tips",
    city_slug: citySlug ?? (allCities ? null : null),
    status: "success",
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    items_processed: updated,
    run_metadata: { fsq_calls: fsqCalls },
  });

  console.log(`\n\n✨ Done. Updated: ${updated}, Failed: ${failed}${capped ? " (capped)" : ""}.`);
  console.log(`   📊 Foursquare calls: ${fsqCalls} (record in docs/COST-LOG.md)`);
  if (updated > 0) {
    console.log("   Run `npm run enrich:venues:ai [city-slug]` to regenerate short_description and vibe_tags from tips.");
  }
}

main().catch(console.error);
