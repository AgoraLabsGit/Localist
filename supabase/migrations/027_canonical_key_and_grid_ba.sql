-- Venue deduplication + grid 5×5 for BA (docs/DATA-QUALITY-AND-PERFORMANCE.md, docs/DATA-PIPELINE.md)

-- Canonical key: one venue per physical place (address or name+geohash)
ALTER TABLE venues ADD COLUMN IF NOT EXISTS canonical_key TEXT;
COMMENT ON COLUMN venues.canonical_key IS 'Dedup key: hash(normalize_address) or hash(normalize_name+geohash7). Same key = same place.';

-- Unique per city when key present (enables merge-before-insert)
CREATE UNIQUE INDEX IF NOT EXISTS idx_venues_city_canonical_key
  ON venues (city_id, canonical_key)
  WHERE canonical_key IS NOT NULL AND city_id IS NOT NULL;

-- Grid 5×5 for Buenos Aires (improves coverage in Villa Urquiza etc.)
UPDATE cities
SET grid_rows = 5, grid_cols = 5
WHERE slug = 'buenos-aires';
