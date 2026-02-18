-- Concierge Phase C1: Additional user_preferences fields (CONCIERGE.md §4)
-- typical_group_type, dietary_flags, alcohol_preference, exploration_style, weekly_outing_target

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS typical_group_type TEXT CHECK (typical_group_type IN ('solo', 'couple', 'friends', 'mixed', 'depends')),
  ADD COLUMN IF NOT EXISTS dietary_flags JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS alcohol_preference TEXT CHECK (alcohol_preference IN ('okay', 'lowkey', 'avoid')),
  ADD COLUMN IF NOT EXISTS exploration_style TEXT CHECK (exploration_style IN ('favorites', 'balanced', 'adventurous')),
  ADD COLUMN IF NOT EXISTS weekly_outing_target INTEGER CHECK (weekly_outing_target IS NULL OR (weekly_outing_target >= 1 AND weekly_outing_target <= 7));

COMMENT ON COLUMN user_preferences.typical_group_type IS 'Usual group: solo, couple, friends, etc. Weights vibe_tags (solo_friendly, date_night).';
COMMENT ON COLUMN user_preferences.dietary_flags IS 'e.g. ["vegetarian"], ["vegan"]. Downweights incompatible food venues.';
COMMENT ON COLUMN user_preferences.alcohol_preference IS 'okay | lowkey | avoid. Downweights bars for avoid.';
COMMENT ON COLUMN user_preferences.exploration_style IS 'favorites=re-surface similar, balanced=50/50, adventurous=novel picks.';
COMMENT ON COLUMN user_preferences.weekly_outing_target IS '1-7. Guides how many suggestions to show for the week.';
