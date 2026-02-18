-- City onboarding: population, per-tile caps, sparse-tile relaxation (docs/ROADMAP.md 0.3, AI-PIPELINE)

-- cities: population for deriving caps and gates (null = midsize metro fallback)
ALTER TABLE cities ADD COLUMN IF NOT EXISTS population INTEGER;
COMMENT ON COLUMN cities.population IS 'Metro population; used to derive max_count, per_tile_max, gates. Null = midsize (2M) fallback.';

-- city_categories: per-tile caps and sparse-tile threshold
ALTER TABLE city_categories ADD COLUMN IF NOT EXISTS per_tile_max INTEGER DEFAULT 40;
ALTER TABLE city_categories ADD COLUMN IF NOT EXISTS min_results_per_tile INTEGER DEFAULT 8;

COMMENT ON COLUMN city_categories.per_tile_max IS 'Max places per tile before moving on; prevents one tile from taking all of max_count.';
COMMENT ON COLUMN city_categories.min_results_per_tile IS 'Below this, relax gates for that tile only (sparse-tile relaxation).';
