-- Onboarding flow data per docs/CONCIERGE.md
-- Screen 1: primary_neighborhood (home_city already on users)
-- Screen 2: persona_type (local | nomad | tourist)
-- Screen 3: weekday_preferences
-- Screen 4: weekend_preferences
-- Screen 5: interests (existing)
-- Screen 6: vibe_tags_preferred, budget_band
-- Screen 7: acquisition_source
-- Tracking: onboarding_completed_at

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS primary_neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS persona_type TEXT CHECK (persona_type IN ('local', 'nomad', 'tourist')),
  ADD COLUMN IF NOT EXISTS weekday_preferences JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS weekend_preferences JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS vibe_tags_preferred JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS budget_band TEXT CHECK (budget_band IN ('cheap', 'mid', 'splurge')),
  ADD COLUMN IF NOT EXISTS acquisition_source TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
