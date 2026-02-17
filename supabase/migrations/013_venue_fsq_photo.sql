-- Foursquare primary photo for venues (Places API)
-- prefix+suffix allows building URLs at different sizes
ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS fsq_photo_prefix TEXT,
  ADD COLUMN IF NOT EXISTS fsq_photo_suffix TEXT;
