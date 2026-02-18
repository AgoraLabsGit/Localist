-- Phase 1 tweaks: sensible defaults to avoid NULL handling everywhere

ALTER TABLE user_preferences
  ALTER COLUMN radius_preference SET DEFAULT 'few_barrios',
  ALTER COLUMN touristy_vs_local_preference SET DEFAULT 'balanced',
  ALTER COLUMN primary_categories SET DEFAULT '[]'::jsonb,
  ALTER COLUMN secondary_categories SET DEFAULT '[]'::jsonb;
