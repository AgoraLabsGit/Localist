-- Type-based discovery config per category (docs/DATA-PIPELINE.md)

ALTER TABLE city_categories ADD COLUMN IF NOT EXISTS google_included_type TEXT;
ALTER TABLE city_categories ADD COLUMN IF NOT EXISTS text_query_keywords TEXT;
ALTER TABLE city_categories ADD COLUMN IF NOT EXISTS min_rating_gate NUMERIC(2,1);
ALTER TABLE city_categories ADD COLUMN IF NOT EXISTS min_reviews_gate INTEGER;

COMMENT ON COLUMN city_categories.google_included_type IS 'Google Place type for includedType (e.g. cafe, bar, restaurant).';
COMMENT ON COLUMN city_categories.text_query_keywords IS 'Comma-separated keywords for niche categories (e.g. parrilla,asado).';
COMMENT ON COLUMN city_categories.min_rating_gate IS 'Category-level min rating at ingest.';
COMMENT ON COLUMN city_categories.min_reviews_gate IS 'Category-level min reviews at ingest.';
