# Spatial / Neighborhood Adjacency

## How does the app know Palermo is near Colegiales?

**Today:** A **hardcoded map** in `src/lib/concierge.ts` — `NEARBY_NEIGHBORHOODS`:

```ts
Palermo: ["Villa Crespo", "Colegiales", "Belgrano", "Recoleta"],
Colegiales: ["Palermo", "Belgrano", "Villa Crespo"],
// ...
```

This is manually maintained for Buenos Aires and used for Concierge scoring (boosting places in nearby neighborhoods).

**Can we get it from Geo API?** Yes — from the geometry we already have:

1. **GeoJSON** (e.g. barrios.geojson) is synced into `city_neighborhoods.geom` (PostGIS).
2. **PostGIS** can compute adjacency between neighborhood polygons:
   - `ST_Touches(a.geom, b.geom)` — share a border
   - `ST_DWithin(a.geom, b.geom, distance)` — within X meters
3. A migration or script can build a `neighborhood_adjacency` table (or similar) from these polygons.
4. The Concierge and filters can then query this instead of the hardcoded map.

**Next step:** Add a migration that populates adjacency from `city_neighborhoods.geom` using `ST_Touches`, and switch `concierge.ts` to use it when available (with the current map as fallback for cities without polygons).
