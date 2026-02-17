-- Extend city_neighborhoods for PostGIS polygons (docs/DATA-PIPELINE.md)

ALTER TABLE city_neighborhoods ADD COLUMN IF NOT EXISTS slug TEXT NOT NULL DEFAULT '';
ALTER TABLE city_neighborhoods ADD COLUMN IF NOT EXISTS geom GEOMETRY(POLYGON, 4326);

CREATE INDEX IF NOT EXISTS idx_city_neighborhoods_geom
  ON city_neighborhoods USING GIST (geom) WHERE geom IS NOT NULL;

-- Point-in-polygon lookup. Returns neighborhood name when lat/lng falls inside a polygon.
CREATE OR REPLACE FUNCTION lookup_neighborhood(city_id UUID, lng DOUBLE PRECISION, lat DOUBLE PRECISION)
RETURNS TEXT AS $$
  SELECT name
  FROM city_neighborhoods
  WHERE city_neighborhoods.city_id = lookup_neighborhood.city_id
    AND geom IS NOT NULL
    AND ST_Contains(
          geom,
          ST_SetSRID(ST_Point(lng, lat), 4326)
        )
  LIMIT 1;
$$ LANGUAGE sql STABLE;
