-- Separate "where you live" from "favorite neighborhoods" (docs/CONCIERGE-VS-HIGHLIGHTS.md)
-- home_neighborhood = for "Near me" / Concierge radius; preferred_neighborhoods = for filters, scoring

ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS home_neighborhood TEXT;

COMMENT ON COLUMN user_preferences.home_neighborhood IS 'Neighborhood user lives in. Used for Near me radius, Concierge sections.';
COMMENT ON COLUMN user_preferences.primary_neighborhood IS 'Deprecated: use home_neighborhood. Kept for backfill.';
COMMENT ON COLUMN user_preferences.preferred_neighborhoods IS 'Favorite neighborhoods to explore. Used for Area filter, personalization.';

-- Backfill: if primary_neighborhood exists and home_neighborhood null, copy
UPDATE user_preferences SET home_neighborhood = primary_neighborhood WHERE home_neighborhood IS NULL AND primary_neighborhood IS NOT NULL;
