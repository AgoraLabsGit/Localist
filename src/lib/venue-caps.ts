/**
 * City onboarding: derive venue caps and gates from population, radius, grid.
 * Used by AI onboarding, seed scripts, and ingest. DB values take precedence when set.
 *
 * See docs/AI-PIPELINE.md, docs/ROADMAP.md 0.3.
 */

export type VenueCapsInput = {
  population?: number | null;
  radiusMeters?: number | null;
  gridRows?: number | null;
  gridCols?: number | null;
};

export type VenueCaps = {
  maxCount: number;
  perTileMax: number;
};

export function deriveVenueCaps({
  population,
  radiusMeters,
  gridRows,
  gridCols,
}: VenueCapsInput): VenueCaps {
  const effectivePopulation = population ?? 2_000_000;

  const radiusKm = (radiusMeters ?? 8000) / 1000;
  const areaKm2 = Math.PI * radiusKm * radiusKm;

  let venuesPerKm2Target = 20;
  if (effectivePopulation > 3_000_000) venuesPerKm2Target = 30;
  if (effectivePopulation > 8_000_000) venuesPerKm2Target = 40;

  const maxCount = Math.round(venuesPerKm2Target * areaKm2);

  const rows = gridRows ?? 3;
  const cols = gridCols ?? 3;
  const tiles = rows * cols;
  const avgPerTile = maxCount / tiles;
  const perTileMax = Math.round(Math.max(25, Math.min(120, avgPerTile * 2.5)));

  return { maxCount, perTileMax };
}

export type Gates = {
  minRating: number;
  minReviews: number;
};

export function deriveBaseGatesForCity(population?: number | null): Gates {
  const effectivePopulation = population ?? 2_000_000;

  let minRating = 4.0;
  let minReviews = 4;

  if (effectivePopulation > 8_000_000) {
    minRating = 4.1;
    minReviews = 6;
  }

  if (effectivePopulation < 1_000_000) {
    minRating = 3.8;
    minReviews = 2;
  }

  return { minRating, minReviews };
}

export function adjustGatesForThinCategory(base: Gates): Gates {
  return {
    minRating: base.minRating - 0.2,
    minReviews: Math.max(1, base.minReviews - 1),
  };
}

/** Category slugs that typically have sparse data; use relaxed gates. */
const THIN_CATEGORY_SLUGS = new Set([
  "kids_activities",
  "tours",
  "waterfront",
  "theater",
  "historical_place",
  "art_gallery",
]);

export function isThinCategory(slug: string): boolean {
  return THIN_CATEGORY_SLUGS.has(slug);
}
