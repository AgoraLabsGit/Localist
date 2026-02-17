-- Location handling per spec: primary_neighborhood_freeform, user_cities
-- For MVP: user_cities holds one entry with is_home=true

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS primary_neighborhood_freeform TEXT,
  ADD COLUMN IF NOT EXISTS user_cities JSONB DEFAULT '[]';

-- Backfill: migrate existing home_city + primary_neighborhood into user_cities
-- (run after users have data; upsert handles new users)
-- Note: We backfill via application logic on first read/save to avoid cross-table joins in migration
-- For existing rows, we leave user_cities = [] until they update preferences
