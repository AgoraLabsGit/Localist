# Data Pipeline

*Google = discovery. Foursquare = durable data. Our DB = feed.*

**Data model:** See [DATA-MODEL](DATA-MODEL.md) for venues vs highlights and cities/neighborhoods.

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
| `scripts/ingest-places-typed.ts` | Main ingest — type-based discovery, grid tiling, PostGIS, FSQ enrichment | See **Production ingest** below |

**Production ingest (live cities):**

```bash
npm run ingest:places:typed -- <city-slug> --force --incremental
```

Example: `npm run ingest:places:typed -- buenos-aires --force --incremental`

Use this for coverage improvements on live cities. Do **not** run without `--force` for live cities—`max_total_per_city` would skip discovery entirely.
| `scripts/lib/load-city-from-db.ts` | Loads city config from DB (grid, gates, address_aliases, GeoJSON) | (imported) |
| `scripts/sync-neighborhoods-from-geojson.ts` | Sync neighborhoods + polygons from GeoJSON | `npm run sync:neighborhoods` [city] |

### Post-ingest

| Path | Purpose | Run |
|------|---------|-----|
| `scripts/fetch-venue-photos.ts` | Foursquare photos | `npx tsx scripts/fetch-venue-photos.ts` |
| `scripts/fetch-venue-tips.ts` | Foursquare tips (live city refresh; input for AI enrichment) | `npm run fetch:venue-tips` [city], `npm run fetch:venue-tips -- --all` |
| `scripts/compute-quality-scores.ts` | `quality_score`, `is_hidden_gem`, `is_local_favorite` | `npm run compute:scores` [city] — **Run after ingest only**; never on preference change. Runtime reranking in `concierge.ts`. |
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
5. `npm run ingest:places:typed -- <city> --force --incremental` (live cities; for fresh cities omit `--incremental` on first run)
6. `npx tsx scripts/fetch-venue-photos.ts`
7. `npm run fetch:venue-tips` [city] — tips for AI enrichment (optional; skips venues with fresh tips <90 days)
8. `npm run compute:scores` [city]
9. **AI enrichment (Phase 2, batch)** — Run after ingest + scores; separate from ingestion. Two-stage: `npm run enrich:venues:ai` [city] (GPT-4o-mini + tips) then `npm run enrich:venues:ai:web` [city] (Perplexity for no-tip venues). Both process all eligible highlights (no per-run cap). Idempotent. See [AI-PIPELINE](AI-PIPELINE.md), [ROADMAP](ROADMAP.md).

**Operational note:** Ingestion is about *coverage*; AI enrichment is about *quality of descriptions and tags*. Confirm coverage (e.g. Villa Urquiza cafés) before running enrichment.

**Live city refresh (BA and similar):** `--force --incremental` is the documented default. Never run live refreshes without `--force`—discovery would be skipped when `max_total_per_city` is reached.

1. **Ingest** — `npm run ingest:places:typed -- buenos-aires --force --incremental`
2. **Photos** — `npx tsx scripts/fetch-venue-photos.ts`
3. **Tips** — `npm run fetch:venue-tips buenos-aires` — Foursquare tips for AI enrichment. Main ingest skips FSQ for existing venues; this script backfills tips for venues with `foursquare_id` but missing/stale `fsq_tips`.
4. **Scores** — `npm run compute:scores buenos-aires`
5. **Coverage verification** — `SELECT v.neighborhood, h.category, COUNT(*) FROM highlights h JOIN venues v ON h.venue_id = v.id WHERE v.city = 'Buenos Aires' GROUP BY 1, 2 ORDER BY 1, 2` — confirm outer neighborhoods (e.g. Villa Urquiza) have ≥ target per category
6. **AI enrichment** — `npm run enrich:venues:ai buenos-aires` then `npm run enrich:venues:ai:web buenos-aires` (Phase 2; run after coverage confirmed)

**Refresh metadata:**
- `ingestion_jobs` — per run: `source`, `finished_at`, `items_fetched`, `items_successful`. Use for city-level "last ingest" decisions.
- `venues.fsq_tips_fetched_at` — tips freshness (skip re-fetch if <90 days).
- `venues.updated_at` — last upsert. No per-venue `last_ingested_at`; `ingestion_jobs` and `updated_at` are usually sufficient.

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
| 036 | `cities`: population; `city_categories`: per_tile_max, min_results_per_tile (caps + sparse-tile relaxation) |
| 037 | Backfill BA population (15M) for derived caps |
| 039 | `venues`: fsq_tips, fsq_tips_fetched_at (for fetch:venue-tips) |
| 041 | Drop canonical_key unique constraint; stop merging distinct venues (fixes Villa Urquiza regression) |

**Caps:** Per-category `max_count` and `per_tile_max` scale with radius and population. When null, `deriveVenueCaps()` yields 300–600 per category for BA-like metros. Per-tile caps prevent one tile from dominating; **fair per-tile allocation** reserves `minPerTile = floor(maxCount/tiles)` for each tile so outer neighborhoods (e.g. north BA) aren't starved. Sparse-tile relaxation lowers gates only in tiles with few results. See [AI-PIPELINE](AI-PIPELINE.md) §1, [DATA-QUALITY-AND-PERFORMANCE](DATA-QUALITY-AND-PERFORMANCE.md) §4.

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
- **`--incremental`** — Skips Foursquare entirely for venues that already have `foursquare_id`. Saves cost; tips for existing venues come from `fetch:venue-tips` (see step 3 below).
- **`--force`** — Bypasses `max_total_per_city`. Required for coverage rebalancing; without it, discovery is skipped when cap is reached.

**Guardrails:**

- Never rely on `max_total_per_city` for rebalancing. Coverage fixes must use `--force` so caps do not short-circuit discovery.
- Incremental is the default for production cities. Full (non-incremental) runs only for rare hard-reset situations.
- Watch cost/venue while a run is in progress. If marginal gain is poor (e.g. +30–40 venues for >$10), stop and verify `--incremental` is set.

---

## Legacy pipeline

`ingest-places.ts` uses two-lane discovery (mainstream + hidden gem), text-query search, neighborhood queries. No tiling or type-based discovery. Keep as fallback; do not modify.
