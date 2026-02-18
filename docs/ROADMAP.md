# Roadmap & Tasks

---

## Data ingestion pipeline (priority)

**Goal:** Perfect the ingestion architecture before moving on. Spec: `docs/DATA-PIPELINE.md`.

### Migrations (next available: 019–023)

1. **019_enable_postgis.sql** — Enable PostGIS extension
2. **020_city_neighborhoods_geom.sql** — Add `slug`, `geom` to `city_neighborhoods`; create `lookup_neighborhood` RPC
3. **021_cities_tiling_and_gates.sql** — `cities`: `grid_rows`, `grid_cols`, `min_rating_gate`, `min_reviews_gate`
4. **022_city_categories_discovery.sql** — `city_categories`: `google_included_type`, `text_query_keywords`, `min_rating_gate`, `min_reviews_gate`
5. **023_venue_place_types.sql** — `venues`: `google_types`, `fsq_categories`
6. **024_city_neighborhoods_geom_multipolygon.sql** — `geom` → MultiPolygon (BA GeoJSON)
7. **025_update_neighborhood_geom_function.sql** — RPC for import script

### Script: `ingest-places-typed.ts`

6. Create new experimental script (copy of `ingest-places.ts`); mark as EXPERIMENTAL
7. Replace two-lane logic with single rating gate (per-category/city/global)
8. Implement grid tiling (per-city `grid_rows`/`grid_cols`)
9. Google type-based discovery: `includedType` + `text_query_keywords` from config
10. Dedupe by `place_id` across tiles
11. PostGIS neighborhood lookup (`lookupNeighborhoodByGeom`) with fallbacks
12. Persist `google_types`, `fsq_categories`, `neighborhood`; update `load-city-from-db.ts` for new fields
13. ~~Run BA ingestion; verify coverage, caps, neighborhood correctness, type metadata~~ ✓

### Separate: OSM polygons

14. ~~**Neighborhood polygons**~~ ✓ — `npm run sync:neighborhoods` [city] syncs from GeoJSON (per-city config in DB).

### Data quality & sparse coverage

15. ~~**Venue deduplication**~~ ✓ — Canonical key at ingest (migration 027).
16. ~~**Sparse neighborhoods**~~ ✓ — Grid 5×5 + `nextPageToken` pagination (max 3 pages/tile).
17. **Place detail speed** — Static data + AI pipeline: precompute at ingest; store summaries in DB; no runtime calls for detail view.

---

## Phase 1 — Shipped

- Highlights feed, place detail, save to list, auth
- Foursquare-sourced data (address, hours, rating, photos)
- Admin, AI city onboarding
- Ingestion pipeline (two-lane, caps, `has_fsq_data`/`is_hidden_gem`)

---

## Phase 2 — After pipeline

AI layer spec: `docs/AI-PIPELINE.md`

### Track A: Pipeline & AI (post–ingest)

1. **Admin pipeline settings** — `admin_settings` table; max Foursquare/Google/AI calls configurable from Settings (not .env)
2. **AI enrichment** — `enrich-places-ai.ts`: `short_description` + `vibe_tags`; backfill missing highlights
3. **Ops** — Coverage report, cost guardrails
4. **Static data + AI pipeline** — Precompute place detail at ingest; store AI summaries in DB; no runtime API calls for detail view (speed + cost). See `docs/DATA-QUALITY-AND-PERFORMANCE.md` §3.

### Track B: UI/UX

1. ~~Search bar on main pages~~ ✓
2. ~~Place detail scroll on mobile (pop-up/drawer)~~ ✓
3. ~~Saved tab: category/neighborhood filters~~ ✓
4. PWA: `manifest.json`, icons, install test

### Track C: Phase 2 Content

1. **Guided Tours w/ Maps Links** — Curated multi-stop itineraries (e.g. "Palermo Coffee Crawl"). `guided_tours` + `guided_tour_stops` tables; each stop links to Google Maps. UI: tours list → tour detail with "Start tour" / per-stop Maps links. Spec: `docs/AI-PIPELINE.md` §6.
2. **Blog/Article Links** — Links to articles about a place on the detail page (for users who want more context). `highlight_articles` table; batch job (AI or manual) finds relevant URLs. UI: place detail "Read more" section. Spec: `docs/AI-PIPELINE.md` §7.

### Deferred

- Foursquare Tips (detail view; see `CONCIERGE.md`)
- Events table

---

## Concierge Overhaul

**Spec:** `docs/CONCIERGE.md` — personal planner on top of Highlights; time- and location-aware picks.

### Phase C1 — Foundation (Data & Preferences)

1. **user_preferences fields** ✓ — Migration 032: `typical_group_type`, `dietary_flags`, `alcohol_preference`, `exploration_style`, `weekly_outing_target`
2. **Concierge API** ✓ — Reads `persona_type`, `budget_band`; uses `user_place_state` for saved + ratings
3. **Ratings + behavioral affinity** ✓ — Load ratings; `buildAffinityProfile` + `f_behavioral_affinity` in scoring

### Phase C2 — Scoring Overhaul

1. **Full scoring formula** — Partial: ✓ `f_distance`, `f_budget_match`, `f_behavioral_affinity`; ⬜ `f_exploration_bonus`
2. **Time match** — ⬜ `f_time_match` using `preferred_time_blocks`, venue opening hours (when available)

### Phase C3 — Slots & Sets

1. **Slot types** ✓ — Weekday: dinner + drinks (tonight); near home, drinks, cafe (today)
2. **Set types** — ⬜ Weekend mini-itineraries: "Sunday Chill" (park + cafe + museum)
3. **Candidate fetching** ✓ — 8 candidates per slot; client cycles on "Not this one"
4. **"Not this one"** ✓ — UI + slot index state; next candidate from list

### Phase C4 — UI/UX

1. **Slot layout** ✓ — One card per slot; Save / "Not this one" buttons
2. **Time filters** ✓ — Today, Tonight, This week, This weekend (CONCIERGE §6)
3. **Weekend sets** — ⬜ Bundle cards (park + cafe + museum) with set title
4. **Feedback loop** — ⬜ Reject → avoid re-showing venue for session/duration

### Concierge Principles (from spec)

- Same venues/highlights as Highlights; differ only in selection, scoring, grouping
- No per-request external API or AI calls; all data from Supabase
- Onboarding & Settings write to same `user_preferences` fields Concierge reads

---

## Database Model

| Scope | Tables |
|-------|--------|
| Universal | `users`, `user_preferences` |
| City config | `cities`, `city_neighborhoods`, `city_categories`, `city_neighborhood_queries` |
| City data | `venues`, `highlights` |
| Phase 2 content | `guided_tours`, `guided_tour_stops`, `highlight_articles` |
| User | `saved_items`, `ratings` |

---

## Quick Commands

```bash
npx supabase db push         # Migrations (required before ingest:places:typed)
npx tsx scripts/seed-cities.ts
# Set city_categories.google_included_type + text_query_keywords for type-based discovery
npm run ingest:places:typed   # Ingest (experimental: type-based + tiling)
npm run ingest:places        # Ingest (legacy, two-lane fallback)
```

---

## Deployment

### Supabase Auth

1. **URL Configuration** — Site URL, redirects: `/auth/callback`, `/auth/reset-password`
2. **Confirm email** — Off for MVP

### Env Vars (Vercel)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_PLACES_API_KEY`, `FOURSQUARE_API_KEY`

### Troubleshooting

| Problem | Fix |
|---------|-----|
| User in Auth but not `public.users` | Run users backfill (migration) |
| Save 401 | Check RLS on `saved_items` |
| `db push` fails | `supabase link --project-ref YOUR_REF` first |
