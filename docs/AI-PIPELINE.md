# AI Pipeline — Ingestion & Management

AI touchpoints for data ingestion, enrichment, and content generation. Single source of truth for AI layer architecture.

**Related:** `docs/DATA-PIPELINE.md`, `docs/DATA-SOURCES.md`, `docs/CITY-ONBOARDING.md`, `docs/DATA-QUALITY-AND-PERFORMANCE.md`

---

## Principles

1. **Batch over runtime** — AI runs at ingest or post-ingest; no per-request AI calls for place detail or feeds.
2. **Store outputs in DB** — AI summaries, tags, links live in our schema; detail view reads only from Supabase.
3. **Avoid reruns** — Prefer larger grids, generous caps at ingest; filter down in app rather than re-ingesting.
4. **Cost guardrails** — Caps on AI calls per run; configurable in `admin_settings`.

---

## Touchpoints

| Touchpoint | When | Input | Output | Script / Flow |
|------------|------|-------|--------|---------------|
| **City onboarding** | Pre-ingest | City name | Config JSON (center, radius, neighborhoods, categories, **grid_rows/grid_cols**) | `onboard-city-ai.ts` |
| **Grid derivation** | Onboarding or manual | radius, neighborhood count | `grid_rows`, `grid_cols` | Extend AI prompt or `set-grid-params-from-bounds.ts` |
| **Place enrichment** | Post-ingest | Venue + highlight | `short_description`, `vibe_tags` | `enrich-places-ai.ts` (future) |
| **Venue dedup** | Ingest or batch | Candidate pair | "same entity" / "different" | Optional; human review queue |
| **Static summaries** | Post-ingest | Place details | `ai_summary`, `vibe_tags` | Batch job; stored in DB |
| **Guided tours** | Phase 2 | Curated place lists | Tour config + Maps links | AI or manual; `guided_tours` table |
| **Blog/article links** | Phase 2 | Place name + city | URLs to relevant articles | AI search + manual curation; `highlight_articles` |

---

## Pipeline Placement

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PRE-INGEST (AI onboarding)                                                  │
│  onboard-city-ai.ts → cities, city_neighborhoods, city_categories           │
│  + grid_rows, grid_cols from radius/neighborhood count                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  INGEST (no AI)                                                              │
│  ingest-places-typed → venues, highlights (Google + FSQ)                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  POST-INGEST (AI enrichment)                                                 │
│  fetch-venue-photos, compute-quality-scores                                 │
│  enrich-places-ai → short_description, vibe_tags (batch)                     │
│  [Phase 2] link-blog-articles → highlight_articles (batch)                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  RUNTIME (no AI)                                                             │
│  Feeds, place detail, filters read only from Supabase                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Touchpoint Details

### 1. City Onboarding (Existing)

**Script:** `scripts/onboard-city-ai.ts`

**Current:** Generates city config (center, radius, neighborhoods, categories). Does not output `grid_rows` / `grid_cols`.

**Extension:** Add to AI prompt schema:
```json
"grid_rows": 5,
"grid_cols": 5
```
Rule: `radiusMeters > 15000` or `neighborhoods.length > 30` → 5×5; `> 20` → 4×4; else 3×3.

---

### 2. Grid Derivation

**Principle:** Prefer larger grid than rerun. Filter down later; avoid re-ingestion.

**Options:**
- **A. AI in onboarding** — Include grid in AI output (above).
- **B. Formula** — `rows = cols = min(6, max(3, ceil(radius_km / 5)))`.
- **C. GeoJSON bbox** — Future script `set-grid-params-from-bounds.ts` derives from polygon extent.

---

### 3. Place Enrichment (Post-Ingest)

**Script:** `enrich-places-ai.ts` (future)

**Input:** Venue name, address, category, neighborhood, FSQ description (if any).

**Output:** `short_description` (2–3 sentences), `vibe_tags` (e.g. `["cozy", "local", "date_night"]`), optionally `avg_expected_price`.

**Fills null data:** When FSQ is missing, AI generates short_description and vibe_tags. See `docs/DATA-SOURCES.md` § AI Layer: Filling Null Data.

**Store:** `highlights.short_description`, `highlights.vibe_tags` or `venues.ai_summary`.

**Run:** Batch after ingest; cap calls via `admin_settings`. Skip when short_description already populated (FSQ or prior run).

---

### 4. Venue Dedup (Optional)

**When:** During ingest (canonical key) or batch (AI-assisted merge).

**AI role:** When canonical key is ambiguous, LLM judges "same entity" vs "different branch." Output feeds human review queue.

---

### 5. Static Summaries (Detail Page)

**Goal:** No runtime AI; detail view loads instantly from DB.

**Flow:** Post-ingest batch generates `ai_summary` (or enriches `short_description`). Stored on highlight/venue. Place detail reads only Supabase.

---

### 6. Guided Tours w/ Maps Links (Phase 2)

**What:** Curated multi-stop itineraries (e.g. "Palermo Coffee Crawl", "San Telmo History Walk").

**Data model:**
- `guided_tours` — id, city_id, title, description, duration, order
- `guided_tour_stops` — tour_id, venue_id, stop_order, notes
- Each stop links to Maps via `venues.google_place_id`.

**AI role (optional):** Generate tour from category + neighborhood; or manual curation. Maps links: `https://www.google.com/maps/search/?api=1&query_place_id={place_id}`.

**UI:** Tours list → Tour detail with ordered stops → "Open in Maps" per stop; optional "Start tour" opens Maps with waypoints.

---

### 7. Blog/Article Links (Phase 2)

**What:** Links to relevant articles/blogs about a place, shown on the place detail page for users who want deeper context.

**Data model:**
- `highlight_articles` — id, highlight_id, url, title, source, fetched_at

**AI role:** Search (e.g. "El Ateneo Grand Splendid Buenos Aires" + site:medium.com OR site:blog) → extract URLs. Or manual curation. Batch job post-ingest.

**UI:** Place detail → "Read more" section with 1–3 article links (title, source, open in new tab).

---

## Model & Prompt Strategy

| Job | Model | Rationale |
|-----|-------|------------|
| City onboarding | GPT-4o-mini / Claude Haiku | Structured output, low cost |
| Place enrichment | GPT-4o-mini | Short text, consistency |
| Venue dedup (if AI) | Claude Sonnet | Nuanced judgment |
| Blog link discovery | Web search + LLM extract | Hybrid |

---

## Cost Controls

- **admin_settings** — `max_ai_calls_per_run`, `max_ai_calls_per_month` (future).
- **Batching** — Process N highlights per run; resume token.
- **Skip if populated** — Don't re-enrich highlights that already have `short_description`.
- **Cache** — Same place in multiple categories: enrich once, reuse.

---

## Ops / Runbooks

| Job | Trigger | Backfill |
|-----|---------|----------|
| City onboarding | Manual: `npx tsx scripts/onboard-city-ai.ts "City" --save` | N/A |
| Place enrichment | Post-ingest; or cron weekly for new highlights | `--backfill` flag |
| Blog links | Post-enrichment; or weekly batch | `--backfill` |
| Guided tours | Manual or admin UI | N/A |

---

## Phase 2 Features Summary

| Feature | AI / Data | UI |
|---------|-----------|-----|
| **Guided Tours** | Tour config (title, stops, order); Maps links per stop | Tours list; tour detail with Maps "Start tour" / per-stop links |
| **Blog/Article Links** | Batch job finds + stores URLs per highlight | Place detail "Read more" section with article links |
