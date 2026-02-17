/**
 * Compute quality_score, is_hidden_gem, is_local_favorite for venues.
 * Uses Foursquare data only (no Google).
 *
 * Formula: FSQ rating (0-10) + rating_count signal, capped at 60 when has_fsq_data=false.
 * Boost: is_featured +15. Slight penalty for is_hidden_gem (lower signal).
 *
 * Classification (FSQ rating + rating_count):
 * - is_hidden_gem: high rating (≥8.5), low reviews (<50) — strong signal, small sample
 * - is_local_favorite: high rating (≥8.2), medium+ reviews (≥50) — not touristy by count
 *
 * Usage:
 *   npx tsx scripts/compute-quality-scores.ts [city-slug]
 *   npx tsx scripts/compute-quality-scores.ts --all    # All cities
 *
 * Run after ingest. Safe to re-run; idempotent.
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CAP_WHEN_NO_FSQ = 60;
const FEATURED_BOOST = 15;
const HIDDEN_GEM_PENALTY = 0.9;

const HIDDEN_GEM_MIN_RATING = 8.5;
const HIDDEN_GEM_MAX_REVIEWS = 50;
const LOCAL_FAVORITE_MIN_RATING = 8.2;
const LOCAL_FAVORITE_MIN_REVIEWS = 50;

function computeRawScore(rating: number | null, ratingCount: number | null): number {
  if (rating == null || rating < 0) return 0;
  const r = Math.min(10, Math.max(0, rating));
  const n = Math.min(500, Math.max(0, ratingCount ?? 0));
  const countFactor = n <= 0 ? 0.3 : 0.3 + 0.7 * (Math.log10(n + 1) / Math.log10(501));
  return (r / 10) * 85 * countFactor; // max ~85 from rating+count
}

function computeQualityScore(row: {
  rating: number | null;
  rating_count: number | null;
  has_fsq_data: boolean;
  is_hidden_gem: boolean;
  is_featured?: boolean;
}): number {
  let score = computeRawScore(row.rating, row.rating_count);
  if (row.is_hidden_gem) score *= HIDDEN_GEM_PENALTY;
  if (row.is_featured) score += FEATURED_BOOST;
  if (!row.has_fsq_data) score = Math.min(score, CAP_WHEN_NO_FSQ);
  return Math.round(Math.min(100, Math.max(0, score)));
}

function classifyVenue(rating: number | null, ratingCount: number | null, hasFsqData: boolean): {
  is_hidden_gem: boolean;
  is_local_favorite: boolean;
} {
  if (!hasFsqData || rating == null) return { is_hidden_gem: false, is_local_favorite: false };
  const r = rating;
  const n = ratingCount ?? 0;
  const is_hidden_gem = r >= HIDDEN_GEM_MIN_RATING && n < HIDDEN_GEM_MAX_REVIEWS && n > 0;
  const is_local_favorite =
    r >= LOCAL_FAVORITE_MIN_RATING && n >= LOCAL_FAVORITE_MIN_REVIEWS && !is_hidden_gem;
  return { is_hidden_gem, is_local_favorite };
}

async function main() {
  const args = process.argv.filter((a) => !a.startsWith("--"));
  const citySlug = args[2];
  const all = process.argv.includes("--all");

  let cityName: string | null = null;
  if (!all && citySlug) {
    const { data: city } = await supabase
      .from("cities")
      .select("name")
      .eq("slug", citySlug)
      .single();
    cityName = city?.name ?? null;
    if (!cityName) {
      console.error(`Unknown city: ${citySlug}. Use --all for all cities.`);
      process.exit(1);
    }
  }

  let query = supabase
    .from("venues")
    .select("id, name, city, rating, rating_count, has_fsq_data, is_hidden_gem, is_local_favorite");

  if (cityName) query = query.eq("city", cityName);

  const [{ data: venues, error }, { data: featuredVenueIds }] = await Promise.all([
    query,
    supabase.from("highlights").select("venue_id").eq("is_featured", true).not("venue_id", "is", null),
  ]);

  if (error) {
    console.error("Failed to fetch venues:", error.message);
    process.exit(1);
  }

  if (!venues?.length) {
    console.log("No venues to score.");
    return;
  }

  const featuredSet = new Set((featuredVenueIds ?? []).map((r) => r.venue_id).filter(Boolean));

  console.log(`\n📊 Computing quality_score for ${venues.length} venues...\n`);

  let updated = 0;
  for (const v of venues) {
    const { is_hidden_gem, is_local_favorite } = classifyVenue(
      v.rating,
      v.rating_count,
      v.has_fsq_data ?? true
    );
    const score = computeQualityScore({
      rating: v.rating,
      rating_count: v.rating_count,
      has_fsq_data: v.has_fsq_data ?? true,
      is_hidden_gem,
      is_featured: featuredSet.has(v.id),
    });

    const { error: updErr } = await supabase
      .from("venues")
      .update({
        quality_score: score,
        is_hidden_gem,
        is_local_favorite,
        updated_at: new Date().toISOString(),
      })
      .eq("id", v.id);

    if (updErr) {
      console.error(`  Failed ${v.name}:`, updErr.message);
    } else {
      updated++;
      if (updated % 50 === 0 || updated === venues.length) {
        process.stdout.write(`\r  Updated: ${updated}/${venues.length}`);
      }
    }
  }

  console.log(`\n\n✅ Done. Updated ${updated} venues with quality_score.\n`);
}

main().catch(console.error);
