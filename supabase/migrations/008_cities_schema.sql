-- Cities, neighborhoods, categories — DB-driven config for multi-city
-- Replaces hardcoded .ts config; enables admin/AI onboarding.

-- Cities
CREATE TABLE IF NOT EXISTS cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  center_lat DOUBLE PRECISION NOT NULL,
  center_lng DOUBLE PRECISION NOT NULL,
  radius_meters INTEGER NOT NULL DEFAULT 15000,
  geocode_language TEXT DEFAULT 'en',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Neighborhoods per city (for address parsing and neighborhood queries)
CREATE TABLE IF NOT EXISTS city_neighborhoods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(city_id, name)
);

-- Categories per city (defines discovery queries and taxonomy)
CREATE TABLE IF NOT EXISTS city_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  display_name TEXT NOT NULL,
  search_query TEXT NOT NULL,
  min_rating NUMERIC(2,1) NOT NULL DEFAULT 4.5,
  category_group TEXT NOT NULL DEFAULT 'other', -- restaurant|bar|cafe|museum|other
  is_city_specific BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(city_id, slug)
);

-- Neighborhood-targeted discovery (best-in-area when city-wide misses coverage)
CREATE TABLE IF NOT EXISTS city_neighborhood_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  city_category_id UUID NOT NULL REFERENCES city_categories(id) ON DELETE CASCADE,
  neighborhood_name TEXT NOT NULL,
  search_query TEXT NOT NULL,
  min_rating NUMERIC(2,1) NOT NULL DEFAULT 4.3,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(city_id, city_category_id, neighborhood_name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_city_neighborhoods_city ON city_neighborhoods(city_id);
CREATE INDEX IF NOT EXISTS idx_city_categories_city ON city_categories(city_id);
CREATE INDEX IF NOT EXISTS idx_city_neighborhood_queries_city ON city_neighborhood_queries(city_id);
CREATE INDEX IF NOT EXISTS idx_city_neighborhood_queries_category ON city_neighborhood_queries(city_category_id);
