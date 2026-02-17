-- Mark existing users with preferences as having completed onboarding
-- (avoids forcing them through the new flow)
UPDATE user_preferences
SET onboarding_completed_at = now()
WHERE onboarding_completed_at IS NULL
  AND (interests IS NOT NULL AND jsonb_array_length(interests) > 0
       OR preferred_neighborhoods IS NOT NULL AND jsonb_array_length(preferred_neighborhoods) > 0);
