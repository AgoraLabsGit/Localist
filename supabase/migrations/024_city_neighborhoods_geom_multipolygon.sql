-- BA barrios GeoJSON uses MultiPolygon; allow geom to store it
ALTER TABLE city_neighborhoods ALTER COLUMN geom TYPE GEOMETRY(MultiPolygon, 4326)
  USING CASE WHEN geom IS NOT NULL THEN ST_Multi(geom) ELSE NULL END;
