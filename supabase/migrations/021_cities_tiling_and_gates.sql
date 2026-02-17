-- Grid tiling and rating gates per city (docs/DATA-PIPELINE.md)

ALTER TABLE cities ADD COLUMN IF NOT EXISTS grid_rows INTEGER;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS grid_cols INTEGER;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS min_rating_gate NUMERIC(2,1);
ALTER TABLE cities ADD COLUMN IF NOT EXISTS min_reviews_gate INTEGER;

COMMENT ON COLUMN cities.grid_rows IS 'Tiling grid rows (e.g. 3 for 3×3). Null = use default.';
COMMENT ON COLUMN cities.grid_cols IS 'Tiling grid cols. Null = use default.';
COMMENT ON COLUMN cities.min_rating_gate IS 'City-level fallback for min rating at ingest.';
COMMENT ON COLUMN cities.min_reviews_gate IS 'City-level fallback for min reviews at ingest.';
