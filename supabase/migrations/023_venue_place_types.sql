-- Store Google types and Foursquare categories on venues (docs/DATA-PIPELINE.md)

ALTER TABLE venues ADD COLUMN IF NOT EXISTS google_types TEXT[];
ALTER TABLE venues ADD COLUMN IF NOT EXISTS fsq_categories JSONB;

COMMENT ON COLUMN venues.google_types IS 'Google Place types from discovery response.';
COMMENT ON COLUMN venues.fsq_categories IS 'Foursquare categories from details (id, name, primary).';
