-- Remove deprecated primary_neighborhood column (replaced by home_neighborhood per 029)

ALTER TABLE user_preferences DROP COLUMN IF EXISTS primary_neighborhood;
