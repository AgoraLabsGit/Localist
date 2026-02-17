-- Ingestion pipeline redesign (docs/DATA-PIPELINE.md)
-- Adds caps, two-lane discovery, quality scoring, and hidden-gem support.

-- Cities: max total venues as safety valve (stop discovery when reached)
ALTER TABLE cities ADD COLUMN IF NOT EXISTS max_total_per_city INTEGER;
COMMENT ON COLUMN cities.max_total_per_city IS 'Hard cap on venues per city; stop discovery when reached. e.g. 600-800. Null = no cap.';

-- Backfill sensible default for existing cities (target_venues * 3 as rough cap)
UPDATE cities SET max_total_per_city = COALESCE(target_venues, 150) * 3 WHERE max_total_per_city IS NULL;

-- City categories: per-category targets and two-lane review thresholds
ALTER TABLE city_categories ADD COLUMN IF NOT EXISTS target_count INTEGER DEFAULT 20;
ALTER TABLE city_categories ADD COLUMN IF NOT EXISTS max_count INTEGER DEFAULT 50;
ALTER TABLE city_categories ADD COLUMN IF NOT EXISTS min_reviews_main INTEGER DEFAULT 30;
ALTER TABLE city_categories ADD COLUMN IF NOT EXISTS min_reviews_gem INTEGER DEFAULT 5;

COMMENT ON COLUMN city_categories.target_count IS 'Target places per category (e.g. 20 parrillas). Drives pagination.';
COMMENT ON COLUMN city_categories.max_count IS 'Hard cap per category; stop when reached.';
COMMENT ON COLUMN city_categories.min_reviews_main IS 'Mainstream lane: min Google user_ratings_total (e.g. 30-50). Per (city, category).';
COMMENT ON COLUMN city_categories.min_reviews_gem IS 'Hidden-gem lane: min reviews when rating is high (e.g. 5-10). Per (city, category). Ingest caps gems at Math.floor(max_count * 0.3) per category.';

-- Venues: quality scoring and Foursquare/hidden-gem flags
ALTER TABLE venues ADD COLUMN IF NOT EXISTS quality_score INTEGER;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS has_fsq_data BOOLEAN DEFAULT true;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS is_hidden_gem BOOLEAN DEFAULT false;

COMMENT ON COLUMN venues.quality_score IS 'Computed from Foursquare rating/count + editorial. 0-100. null = not yet scored.';
COMMENT ON COLUMN venues.has_fsq_data IS 'false when no Foursquare match. compute-quality-scores must apply min(raw_score, 60) when false.';
COMMENT ON COLUMN venues.is_hidden_gem IS 'true when came through hidden-gem lane (min_reviews_gem <= reviews < min_reviews_main).';

-- Backfill has_fsq_data from foursquare_id
UPDATE venues SET has_fsq_data = (foursquare_id IS NOT NULL AND foursquare_id != '') WHERE has_fsq_data IS NULL;
UPDATE venues SET has_fsq_data = false WHERE foursquare_id IS NULL OR foursquare_id = '';

-- Index for ordering by quality (used when joining highlights to venues)
CREATE INDEX IF NOT EXISTS idx_venues_quality_score ON venues(quality_score DESC) WHERE quality_score IS NOT NULL;
