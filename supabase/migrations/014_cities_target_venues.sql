-- Add target_venues to cities: size-based ingestion target (e.g. 250 for BA, 150 for medium, 100 for small)
ALTER TABLE cities ADD COLUMN IF NOT EXISTS target_venues INTEGER DEFAULT 150;

COMMENT ON COLUMN cities.target_venues IS 'Target number of unique venues to ingest; drives pagination (more pages = more results). Large cities ~250, medium ~150, small ~100.';
