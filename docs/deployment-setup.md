# Localist — Deployment Setup Checklist

*Complete step-by-step guide for Auth, Redirects, and Migrations. Do these in order.*

---

## Part 1: Supabase Auth Configuration

### Step 1.1 — Open URL Configuration

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your **Localist** project
3. Left sidebar: **Authentication** → **URL Configuration** (under CONFIGURATION)

### Step 1.2 — Set Site URL

| Environment | Site URL |
|-------------|----------|
| **Local dev** | `http://localhost:3000` |
| **Production** | `https://your-app.vercel.app` (replace with your actual domain) |

- For local dev: set Site URL to `http://localhost:3000`
- For production: after deploying to Vercel, set Site URL to your production URL
- **Save changes**

### Step 1.3 — Add Redirect URLs

Click **"Add URL"** and add each URL below. Add one at a time, then **Save changes** after each (or add all, then Save once).

**For local development:**
```
http://localhost:3000/auth/callback
http://localhost:3000/auth/reset-password
```

**For production (add when you deploy):**
```
https://your-app.vercel.app/auth/callback
https://your-app.vercel.app/auth/reset-password
```

Replace `your-app.vercel.app` with your real Vercel deployment URL.

**Why each URL:**
- `*/auth/callback` — OAuth providers and email confirmation redirect here after sign-up
- `*/auth/reset-password` — Password reset email link sends users here to set a new password

### Step 1.4 — Email Provider Settings (Optional)

Go to **Authentication** → **Sign In / Providers** → **Email**.

| Setting | Recommendation |
|---------|----------------|
| **Confirm email** | Off for MVP (users sign in immediately). Turn On for production if you want email verification. |
| **Secure password change** | Off for MVP; On for stricter security later |

### Step 1.5 — Verify Auth Works

1. Run locally: `npm run dev`
2. Go to `http://localhost:3000/auth/signup`
3. Sign up with a test email
4. Check **Authentication** → **Users** — you should see the new user
5. Check **Table Editor** → **public** → **users** — you should see the user there too (after running migrations below)

---

## Part 2: Migrations (Database Setup)

You have two options. Use **Option A** (CLI) if you have Supabase CLI set up. Use **Option B** (SQL Editor) otherwise.

### Option A — Supabase CLI (Recommended)

**Prerequisites:** Supabase CLI installed (`brew install supabase/tap/supabase` or `npm i -g supabase`)

1. **Get your Project Reference ID:**
   - Supabase Dashboard → **Project Settings** (gear icon) → **General**
   - Copy **Reference ID** (e.g. `abcdefghijklmnop`)

2. **Link and push:**
   ```bash
   cd /path/to/Localist
   supabase link --project-ref YOUR_PROJECT_REF
   ```
   - When prompted for database password, use the one from Project Settings → Database

3. **Push migrations:**
   ```bash
   supabase db push
   ```
   - This runs migrations 001–005 in order. Already-applied migrations are skipped automatically.

4. **Done.** Tables, trigger, RLS, and backfill are applied.

---

### Option B — SQL Editor (Manual)

If you can't use the CLI, run these in **Supabase Dashboard** → **SQL Editor**. Create a **New query** for each block and run them **in order**.

**Important:** If your database already has the tables from migration 001, **skip Block 1** and start with Block 2.

---

#### Block 1 — Initial Schema (run only if tables don't exist)

```sql
-- Localist MVP Schema
CREATE TABLE IF NOT EXISTS venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_place_id TEXT UNIQUE,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT NOT NULL DEFAULT 'Buenos Aires',
  neighborhood TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  phone TEXT,
  website_url TEXT,
  google_rating NUMERIC(2,1),
  google_rating_count INTEGER,
  opening_hours JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS highlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  short_description TEXT,
  category TEXT NOT NULL,
  vibe_tags JSONB DEFAULT '[]',
  venue_id UUID REFERENCES venues(id),
  city TEXT NOT NULL DEFAULT 'Buenos Aires',
  neighborhood TEXT,
  avg_expected_price NUMERIC(10,2),
  currency TEXT DEFAULT 'USD',
  url TEXT,
  is_featured BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT,
  role TEXT DEFAULT 'user',
  home_city TEXT DEFAULT 'Buenos Aires',
  language TEXT DEFAULT 'en',
  subscription_tier TEXT DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  interests JSONB DEFAULT '[]',
  budget_min NUMERIC(10,2),
  budget_max NUMERIC(10,2),
  preferred_neighborhoods JSONB DEFAULT '[]',
  preferred_days JSONB DEFAULT '[]',
  preferred_time_blocks JSONB DEFAULT '[]',
  social_comfort_level INTEGER DEFAULT 3
);

CREATE TABLE IF NOT EXISTS saved_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, target_type, target_id)
);

CREATE TABLE IF NOT EXISTS ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, target_type, target_id)
);

CREATE TABLE IF NOT EXISTS ingestion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  items_fetched INTEGER DEFAULT 0,
  items_successful INTEGER DEFAULT 0,
  error_log JSONB
);

CREATE INDEX IF NOT EXISTS idx_highlights_city ON highlights(city);
CREATE INDEX IF NOT EXISTS idx_highlights_category ON highlights(category);
CREATE INDEX IF NOT EXISTS idx_highlights_neighborhood ON highlights(neighborhood);
CREATE INDEX IF NOT EXISTS idx_venues_google_place_id ON venues(google_place_id);
CREATE INDEX IF NOT EXISTS idx_saved_items_user ON saved_items(user_id);
CREATE INDEX IF NOT EXISTS idx_ratings_target ON ratings(target_type, target_id);
```

---

#### Block 2 — User Trigger (sync auth.users → public.users)

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

#### Block 3 — RLS for saved_items

```sql
ALTER TABLE saved_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own saved items" ON saved_items;
CREATE POLICY "Users can view own saved items"
  ON saved_items FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own saved items" ON saved_items;
CREATE POLICY "Users can insert own saved items"
  ON saved_items FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own saved items" ON saved_items;
CREATE POLICY "Users can delete own saved items"
  ON saved_items FOR DELETE USING (auth.uid() = user_id);
```

---

#### Block 4 — RLS for users, user_preferences, ratings

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own preferences" ON user_preferences;
CREATE POLICY "Users can view own preferences" ON user_preferences FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own preferences" ON user_preferences;
CREATE POLICY "Users can insert own preferences" ON user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own preferences" ON user_preferences;
CREATE POLICY "Users can update own preferences" ON user_preferences FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own ratings" ON ratings;
CREATE POLICY "Users can view own ratings" ON ratings FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own ratings" ON ratings;
CREATE POLICY "Users can insert own ratings" ON ratings FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own ratings" ON ratings;
CREATE POLICY "Users can update own ratings" ON ratings FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own ratings" ON ratings;
CREATE POLICY "Users can delete own ratings" ON ratings FOR DELETE USING (auth.uid() = user_id);
```

---

#### Block 5 — Backfill public.users (existing auth users)

```sql
INSERT INTO public.users (id, email)
SELECT id, email FROM auth.users
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
```

---

#### Block 6 — Foursquare compliance (add rating columns, remove Google cache)

**Run this if you added Foursquare integration.** Adds `foursquare_id`, `rating`, `rating_count`; removes `google_rating`, `google_rating_count`.

```sql
ALTER TABLE venues ADD COLUMN IF NOT EXISTS foursquare_id TEXT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS rating NUMERIC(2,1);
ALTER TABLE venues ADD COLUMN IF NOT EXISTS rating_count INTEGER;
ALTER TABLE venues DROP COLUMN IF EXISTS google_rating;
ALTER TABLE venues DROP COLUMN IF EXISTS google_rating_count;
CREATE INDEX IF NOT EXISTS idx_venues_foursquare_id ON venues(foursquare_id) WHERE foursquare_id IS NOT NULL;
```

---

### Verify Migrations

1. **Table Editor** → **public** → **users**: Should have rows (your sign-ups).
2. **users** table: Green "RLS enabled" badge.
3. **saved_items** table: Green "RLS enabled" badge.
4. Sign in, tap heart on a highlight — it should save. **Saved** tab should show it.

---

## Part 3: Production Deployment (Vercel)

### Step 3.1 — Environment Variables

In **Vercel** → your project → **Settings** → **Environment Variables**, add:

| Name | Value | Env |
|------|-------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | From Supabase: Project Settings → API → Project URL | Production, Preview |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | From Supabase: Project Settings → API → anon public | Production, Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | From Supabase: Project Settings → API → service_role | Production, Preview |
| `GOOGLE_PLACES_API_KEY` | Your Google Places API key | Production, Preview |
| `FOURSQUARE_API_KEY` | **Service API Key** from Foursquare (see [docs/foursquare-setup.md](foursquare-setup.md)) | Production, Preview |

### Step 3.2 — Update Supabase Redirect URLs

After your first deploy:

1. Supabase → **Authentication** → **URL Configuration**
2. **Site URL:** Set to `https://your-actual-domain.vercel.app`
3. **Redirect URLs:** Add:
   - `https://your-actual-domain.vercel.app/auth/callback`
   - `https://your-actual-domain.vercel.app/auth/reset-password`
4. **Save changes**

### Step 3.3 — Redeploy

Trigger a new deploy (or push a commit) so the app runs with the correct env vars and Supabase config.

---

## Quick Reference

| Task | Where |
|------|-------|
| Auth URLs, redirects | Supabase → Authentication → URL Configuration |
| Email / providers | Supabase → Authentication → Sign In / Providers |
| Migrations (CLI) | `supabase link` then `supabase db push` |
| Migrations (manual) | Supabase → SQL Editor, run blocks 1–6 in order |
| Env vars (prod) | Vercel → Settings → Environment Variables |
| Project ref | Supabase → Project Settings → General → Reference ID |
| Foursquare API key | [docs/foursquare-setup.md](foursquare-setup.md) — use **Service API Key**, not legacy |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| User in Auth but not in public.users | Run Block 5 (backfill) in SQL Editor |
| "Redirect URL not allowed" | Add the exact URL to Redirect URLs in Supabase |
| Save button does nothing / 401 | Check RLS policies; ensure Block 3 ran; user must be signed in |
| `supabase db push` fails with "project ref" | Run `supabase link --project-ref YOUR_REF` first |
