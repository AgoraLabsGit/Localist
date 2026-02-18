-- Phase 1 Onboarding v2: Additional preference fields (ROADMAP Phase 1.1)

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS radius_preference TEXT CHECK (radius_preference IN ('near_home', 'few_barrios', 'whole_city')),
  ADD COLUMN IF NOT EXISTS primary_categories JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS secondary_categories JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS touristy_vs_local_preference TEXT CHECK (touristy_vs_local_preference IN ('touristy_ok', 'balanced', 'local_only'));

COMMENT ON COLUMN user_preferences.radius_preference IS 'How far to suggest: near_home, few_barrios, whole_city.';
COMMENT ON COLUMN user_preferences.primary_categories IS 'Top 2 category slugs that matter most (from interests).';
COMMENT ON COLUMN user_preferences.secondary_categories IS 'Rest of interests. Derived from step 4.';
COMMENT ON COLUMN user_preferences.touristy_vs_local_preference IS 'touristy_ok | balanced | local_only. Biases venue selection.';
