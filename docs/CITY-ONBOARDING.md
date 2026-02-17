# City Onboarding Guide

Clean pipeline for adding new cities to Localist. Follow this checklist to ensure full neighborhood coverage, correct grid tiling, and working Area filters.

**AI layer:** See `docs/AI-PIPELINE.md` for AI onboarding, grid derivation, and Phase 2 features.

---

## Schema (cities)

| Table | Purpose |
|-------|---------|
| `cities` | center, radius, grid_rows, grid_cols, address_aliases, geojson_source_url, geojson_name_property |
| `city_neighborhoods` | Neighborhoods for filters; `geom` for PostGIS lookup |
| `city_categories` | google_included_type, text_query_keywords, min_rating_gate, max_count |
| `city_neighborhood_queries` | Neighborhood-targeted discovery (legacy) |

---

## Pipeline Overview

```
1. Create city (AI or manual)     → cities table
2. Sync neighborhoods             → city_neighborhoods (from GeoJSON or AI)
3. Set grid params                 → cities.grid_rows, grid_cols (optional; default 3×3)
4. Seed categories                 → city_categories (google_included_type, etc.)
5. Import polygons (if GeoJSON)    → city_neighborhoods.geom (PostGIS)
6. Run ingest                     → venues, highlights
7. Post-ingest                    → photos, quality scores
```

---

## Step-by-Step

### 1. Create City

**Option A: AI onboarding** — `npx tsx scripts/onboard-city-ai.ts "Lisbon"` generates config. Use `--save` to insert to DB. Or Admin UI → Add city with AI.

**Option B: Manual** — Add to `scripts/config/cities.ts` and run seed.

**Option C: Direct DB** — Insert into `cities` with slug, name, center_lat, center_lng, radius_meters, target_venues, geocode_language, status='active'.

---

### 2. Sync Neighborhoods

Neighborhoods power the Area filter and PostGIS lookup. **Single source of truth: `city_neighborhoods`.**

**For any city with GeoJSON configured in DB** (migration 026 sets BA):
```bash
npm run sync:neighborhoods buenos-aires
npm run sync:neighborhoods lisbon --url=https://... --property=properties.name
```
- Reads `geojson_source_url` and `geojson_name_property` from `cities`
- Creates missing neighborhoods, updates `geom` for PostGIS
- Override with `--url=` and `--property=` if not in DB

**For cities without GeoJSON:**
- AI onboarding suggests 15–25 neighborhoods (saved in step 1)
- Or add manually via Admin → Cities → [slug] → Neighborhoods
- Later: add city-specific GeoJSON sync scripts (e.g. Lisbon, NYC)

---

### 3. Set Grid Parameters (Optional)

`grid_rows` and `grid_cols` control tiling for discovery. If null, ingest uses 3×3.

**When to customize:**
- Large metros (Tokyo, NYC): 4×4 or 5×5
- Small cities: 2×2

**Options:**
- Manual: `UPDATE cities SET grid_rows=4, grid_cols=4 WHERE slug='buenos-aires';`
- Future: `scripts/set-grid-params-from-bounds.ts` — derive from Nominatim/GeoJSON bbox

---

### 4. Seed Categories

```bash
npx tsx scripts/seed-cities.ts
```
Populates `city_categories` with universal + city-specific categories. Also sets `google_included_type` and `text_query_keywords` for discovery.

---

### 5. Import Polygons (if GeoJSON exists)

**Any city with GeoJSON in DB:** `npm run sync:neighborhoods [slug]` updates geom.

---

### 6. Run Ingest

```bash
npm run ingest:places:typed buenos-aires
```
Uses tiling, PostGIS neighborhoods, and type-based discovery.

---

### 7. Post-Ingest

```bash
npx tsx scripts/fetch-venue-photos.ts
npm run compute:scores buenos-aires
```

---

## Area Filter (UI)

The Area filter options come from:
1. `city_neighborhoods` for the user's city
2. Union with distinct `neighborhood` values from highlights

So: run `sync:neighborhoods [city-slug]` **before** ingest to populate all neighborhoods in the filter. Ingestion can still resolve neighborhoods via address/geocode even if they're not in `city_neighborhoods`; those will appear in the filter once we have highlights there.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Villa Urquiza / Saavedra missing in Area filter | Sync not run for city | `npm run sync:neighborhoods buenos-aires` |
| No venues in certain neighborhoods | Tiling not covering that area; or rating gate too strict | Check grid params; lower min_rating_gate |
| `lookup_neighborhood` returns null | `geom` not populated | Run `npm run sync:neighborhoods` [city] |
| Area filter shows hardcoded list | Page not passing `neighborhoods` prop | Ensure page fetches from DB and passes to HighlightsFeed |

---

## Checklist for New City

- [ ] City created in DB (AI or manual)
- [ ] Neighborhoods populated (GeoJSON sync or AI/manual)
- [ ] Grid params set (optional)
- [ ] Categories seeded (`seed-cities`)
- [ ] Polygons imported (if GeoJSON available)
- [ ] Ingest run (`ingest:places:typed [slug]`)
- [ ] Photos + scores run
- [ ] Verify Area filter shows expected neighborhoods
- [ ] Add city to DB; app uses `GET /api/cities` for supported cities
