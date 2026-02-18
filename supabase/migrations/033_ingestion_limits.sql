-- Higher ingestion limits to reduce run frequency (docs/DATA-PIPELINE.md)

-- Foursquare cap: 200 → 1000 so more venues get full enrichment per run
UPDATE admin_settings
SET value = '1000', updated_at = now()
WHERE key = 'max_foursquare_calls_per_run'
  AND value = '200';

-- Category max_count: 50 → 80 for Buenos Aires to discover more places per category
UPDATE city_categories
SET max_count = 80, updated_at = now()
WHERE city_id = (SELECT id FROM cities WHERE slug = 'buenos-aires')
  AND (max_count IS NULL OR max_count = 50);
