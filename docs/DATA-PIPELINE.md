# Data Pipeline

*Google = discovery. Foursquare = durable data. Our DB = feed.*

---

## Architecture

| Layer | Purpose |
|-------|---------|
| **Discovery** | Google type-based + grid tiling → rating/reviews gate → candidates with `google_types` |
| **Enrichment** | Foursquare details, PostGIS neighborhoods, `fsq_categories` → scoring + AI |
| **Selection** | Feeds & Concierge read scored data; filters use stored metadata |

**Flow:** Google Text Search (per tile) → filter by rating/reviews → Foursquare match + details → venues + highlights.

**Key design:** Single rating gate (no two-lane logic at ingest). Per-category `google_included_type` + `text_query_keywords` from DB. Dedupe by `place_id` across tiles. PostGIS `lookup_neighborhood` with address/geocode fallbacks.

---

## Scripts

### Primary pipeline (v2)

| Path | Purpose | Run |
|------|---------|-----|
| `scripts/ingest-places-typed.ts` | Main ingest — type-based discovery, grid tiling, PostGIS, FSQ enrichment | `npm run ingest:places:typed` [city], `npm run ingest:places:typed:incremental` [city] |
| `scripts/lib/load-city-from-db.ts` | Loads city config from DB (grid, gates, address_aliases, GeoJSON) | (imported) |
| `scripts/sync-neighborhoods-from-geojson.ts` | Sync neighborhoods + polygons from GeoJSON | `npm run sync:neighborhoods` [city] |

### Post-ingest

| Path | Purpose | Run |
|------|---------|-----|
| `scripts/fetch-venue-photos.ts` | Foursquare photos | `npx tsx scripts/fetch-venue-photos.ts` |
| `scripts/compute-quality-scores.ts` | `quality_score`, `is_hidden_gem`, `is_local_favorite` | `npm run compute:scores` [city] |
| `scripts/update-descriptions-from-foursquare.ts` | Backfill `short_description` | `npm run update:descriptions` |

### Other

| Path | Purpose |
|------|---------|
| `scripts/seed-cities.ts` | Seeds cities, neighborhoods, categories from config |
| `scripts/onboard-city-ai.ts` | AI city config; `--save` inserts to DB |
| `scripts/ingest-places.ts` | Legacy two-lane ingest; fallback |
| `src/lib/admin-settings.ts` | Pipeline caps (max FSQ/Google calls) from `admin_settings` |

---

## Execution order

1. Set env: `GOOGLE_PLACES_API_KEY`, `FOURSQUARE_API_KEY`, Supabase vars
2. `supabase db push` (migrations 019–026)
3. `npx tsx scripts/seed-cities.ts`
4. `npm run sync:neighborhoods` [city]
5. `npm run ingest:places:typed` [city]
6. `npx tsx scripts/fetch-venue-photos.ts`
7. `npm run compute:scores` [city]

See [CITY-ONBOARDING](CITY-ONBOARDING.md) for new-city checklist.

---

## Migrations

| Migration | Purpose |
|-----------|---------|
| 019 | PostGIS |
| 020 | `city_neighborhoods`: slug, geom; `lookup_neighborhood` RPC |
| 021 | `cities`: grid_rows, grid_cols, min_rating_gate, min_reviews_gate |
| 022 | `city_categories`: google_included_type, text_query_keywords, gates |
| 023 | `venues`: google_types, fsq_categories |
| 024 | geom → MultiPolygon |
| 025 | `update_neighborhood_geom` RPC |
| 026 | `cities`: address_aliases, geojson_source_url, geojson_name_property, is_default |
| 027 | `venues`: canonical_key; grid 5×5 for BA; nextPageToken pagination (max 3 pages/tile) |

---

## City-agnostic design

- **Default city:** Ingest uses `getDefaultCitySlug()` when no slug passed.
- **Address aliases:** `cities.address_aliases` (e.g. `["CABA"]`) — skip city-level names when resolving neighborhood.
- **GeoJSON:** Per-city URL + property in DB; generic `sync:neighborhoods` reads from there.
- **App:** `GET /api/cities`, `getDefaultCityNameFromDb()` — page, Concierge, onboarding use DB.

---

## Safeguards (API costs)

- **Admin settings** — Max FSQ/Google calls from DB. Default 200 for FSQ.
- **`MAX_FOURSQUARE_CALLS`** — Env override if DB empty.
- **`--incremental`** — Skips Foursquare for venues that already have `foursquare_id`. Use `npm run ingest:places:typed:incremental` [city].

---

## Legacy pipeline

`ingest-places.ts` uses two-lane discovery (mainstream + hidden gem), text-query search, neighborhood queries. No tiling or type-based discovery. Keep as fallback; do not modify.
