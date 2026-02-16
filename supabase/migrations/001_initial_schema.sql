-- Localist MVP Schema (Highlights-first)

-- Venues (from Google Places)
CREATE TABLE venues (
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

-- Highlights (curated places)
CREATE TABLE highlights (
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

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT,
  role TEXT DEFAULT 'user',
  home_city TEXT DEFAULT 'Buenos Aires',
  language TEXT DEFAULT 'en',
  subscription_tier TEXT DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User preferences
CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  interests JSONB DEFAULT '[]',
  budget_min NUMERIC(10,2),
  budget_max NUMERIC(10,2),
  preferred_neighborhoods JSONB DEFAULT '[]',
  preferred_days JSONB DEFAULT '[]',
  preferred_time_blocks JSONB DEFAULT '[]',
  social_comfort_level INTEGER DEFAULT 3
);

-- Saved items
CREATE TABLE saved_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  target_type TEXT NOT NULL, -- 'highlight' or 'event'
  target_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, target_type, target_id)
);

-- Ratings
CREATE TABLE ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, target_type, target_id)
);

-- Ingestion jobs
CREATE TABLE ingestion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  items_fetched INTEGER DEFAULT 0,
  items_successful INTEGER DEFAULT 0,
  error_log JSONB
);

-- Indexes
CREATE INDEX idx_highlights_city ON highlights(city);
CREATE INDEX idx_highlights_category ON highlights(category);
CREATE INDEX idx_highlights_neighborhood ON highlights(neighborhood);
CREATE INDEX idx_venues_google_place_id ON venues(google_place_id);
CREATE INDEX idx_saved_items_user ON saved_items(user_id);
CREATE INDEX idx_ratings_target ON ratings(target_type, target_id);
