-- City-agnostic config: GeoJSON sources and address aliases (docs/DATA-PIPELINE.md)

ALTER TABLE cities ADD COLUMN IF NOT EXISTS address_aliases JSONB DEFAULT '[]';
ALTER TABLE cities ADD COLUMN IF NOT EXISTS geojson_source_url TEXT;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS geojson_name_property TEXT;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

COMMENT ON COLUMN cities.address_aliases IS 'Names to treat as city-level in neighborhood resolution (e.g. ["CABA"] for Buenos Aires)';
COMMENT ON COLUMN cities.geojson_source_url IS 'URL to GeoJSON for neighborhood polygons (optional)';
COMMENT ON COLUMN cities.geojson_name_property IS 'Property path for neighborhood name, e.g. properties.BARRIO';
COMMENT ON COLUMN cities.is_default IS 'Default city when user has no preference';

-- Backfill for cities with known GeoJSON (run seed first; this updates existing rows)
UPDATE cities SET
  address_aliases = '["CABA"]'::jsonb,
  geojson_source_url = 'https://cdn.buenosaires.gob.ar/datosabiertos/datasets/barrios/barrios.geojson',
  geojson_name_property = 'properties.BARRIO',
  is_default = true
WHERE slug = 'buenos-aires';

-- If no city is default yet, set the first active city as default
UPDATE cities SET is_default = true
WHERE id = (SELECT id FROM cities WHERE status = 'active' ORDER BY name LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM cities WHERE is_default = true);
