-- Helper for import-osm-neighborhoods-ba.ts
CREATE OR REPLACE FUNCTION update_neighborhood_geom(p_id UUID, p_wkt TEXT)
RETURNS void AS $$
  UPDATE city_neighborhoods
  SET geom = ST_Multi(ST_GeomFromText(p_wkt, 4326))
  WHERE id = p_id;
$$ LANGUAGE sql;
