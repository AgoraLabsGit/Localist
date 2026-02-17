-- Backfill public.users from auth.users (for accounts created before 002 trigger was applied)
-- Safe to run multiple times: ON CONFLICT updates email if changed
INSERT INTO public.users (id, email)
SELECT id, email
FROM auth.users
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
