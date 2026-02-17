-- Add photo URLs to venues (from Foursquare)
ALTER TABLE venues ADD COLUMN IF NOT EXISTS photo_urls JSONB DEFAULT '[]';
