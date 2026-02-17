-- Migration: Foursquare integration + remove non-compliant Google data
-- We store place_id (allowed) + our metadata. Address, hours, rating come from Foursquare.

-- Add Foursquare ID for place matching
ALTER TABLE venues ADD COLUMN IF NOT EXISTS foursquare_id TEXT;

-- Replace Google-sourced columns with generic names (populated from Foursquare)
ALTER TABLE venues ADD COLUMN IF NOT EXISTS rating NUMERIC(2,1);
ALTER TABLE venues ADD COLUMN IF NOT EXISTS rating_count INTEGER;

-- Drop Google-specific columns (compliance: don't store Google rating/address/hours)
ALTER TABLE venues DROP COLUMN IF EXISTS google_rating;
ALTER TABLE venues DROP COLUMN IF EXISTS google_rating_count;

-- address, opening_hours, phone, website_url remain; ingest will populate from Foursquare
-- (Previously from Google; now Foursquare-sourced. Column names are source-agnostic.)

CREATE INDEX IF NOT EXISTS idx_venues_foursquare_id ON venues(foursquare_id) WHERE foursquare_id IS NOT NULL;
