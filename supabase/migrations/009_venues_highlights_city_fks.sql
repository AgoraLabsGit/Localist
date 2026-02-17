-- Add city_id and city_category_id FKs to venues and highlights
-- Keeps city/category text columns for backward compatibility during transition

-- Venues: link to cities
ALTER TABLE venues ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES cities(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_venues_city_id ON venues(city_id) WHERE city_id IS NOT NULL;

-- Highlights: link to cities and city_categories
ALTER TABLE highlights ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES cities(id) ON DELETE SET NULL;
ALTER TABLE highlights ADD COLUMN IF NOT EXISTS city_category_id UUID REFERENCES city_categories(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_highlights_city_id ON highlights(city_id) WHERE city_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_highlights_city_category_id ON highlights(city_category_id) WHERE city_category_id IS NOT NULL;

-- Unique constraint for highlights: one per (venue, category)
-- First ensure we have it for (venue_id, category) if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'highlights_venue_id_category_key'
  ) THEN
    ALTER TABLE highlights ADD CONSTRAINT highlights_venue_id_category_key UNIQUE (venue_id, category);
  END IF;
END $$;

-- Note: Backfill of city_id and city_category_id happens in seed script (after cities/categories exist)
-- Run: npx tsx scripts/seed-cities.ts
