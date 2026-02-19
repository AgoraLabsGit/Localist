# Localist Roadmap — 2026

## 0. Current focus (Q1 2026)

1. **Cafe ingestion optimization (BA only)**  
   - Lock in tile + neighborhood discovery for cafés, including anchor list for key places (e.g. Chicama).
2. **BA AI enrichment (descriptions + photos)**  
   - Ensure outer barrios (Villa Urquiza, Nuñez, Coghlan, Villa Ortúzar) have solid descriptions, vibe tags, and photos.
3. **Cost tracking wiring**  
   - Make Admin → Usage and `api_costs` reliable for ingest + AI runs, including Perplexity and OpenAI.

You should treat these three as the only priorities until they are done.

**Foursquare cost guardrail:** Do not run Foursquare API calls or FSQ-based ingestions until they are 100% necessary. FSQ has been our main cost driver. Lock in Google ingestion (discovery, profiles, coverage) first. Resume FSQ only when the Google-side pipeline is validated and FSQ is genuinely required.

**Design constraint (wide net → filter down):** Start with **Google-wide, cafe-only** (rating ≥ 4.0, more inclusive categories), verify neighborhood coverage in the DB, and only then turn on Foursquare + AI for that subset.

### Validation checklist

When validating cost tracking, Admin Usage dashboard, pipeline run logging, or AI enrichment fixes:

1. **Migrations** — `supabase db push` (042–044: run_metadata, pipeline_runs, api_costs).
2. **Ingest** — Run `npm run ingest:places:typed -- buenos-aires --force --incremental`; verify Admin → Usage shows G/FSQ and city.
3. **OpenAI cost import** — `npm run import:openai-costs`; verify costs appear in Admin → Usage (requires OpenAI usage in date range).
4. **AI enrichment** — Run `enrich:venues:ai` and `enrich:venues:ai:web`; verify runs and mode (perplexity/tavily+openai/openai) show in Usage.
5. **Manual costs** — `npm run record:api-cost -- perplexity YYYY-MM-DD 0.25`; verify Perplexity row appears in costs table.
6. **Legacy ingest** — Run `ingest-places`; verify pipeline_runs captures FSQ calls and city.
7. **AI JSON parsing** — Run `enrich:venues:ai:web`; startup shows correct mode; no `Unexpected token '*'` (markdown stripping fixes this).

***

## Phase 0 — Data foundation & coverage (BA first)

**Goal:** Stable ingestion and coverage for Buenos Aires: enough good venues, in the right categories, with solid base metadata.

### 0.0 Ingestion pipeline — problem scope

The pipeline must deliver **good coverage across all categories and neighborhoods** in a city. Current issues:

- **Outer barrios undercovered** — Tiles in the north/outer areas (e.g. Villa Urquiza) get few venues despite Google having many.
- **Query bias** — City-wide “best X Buenos Aires” queries favor central icons over local spots for many categories.
- **No fair per-tile allocation** — Early tiles use up the budget before outer tiles run.
- **No per-category discovery tuning** — Same patterns used for cafes, parrillas, bars, restaurants, etc., even when some need different approaches.
- **Edge cases filtered out** — Known places that fail the rating gate are dropped with no override.
- **Canonical key merge** — Previously merged distinct venues at the same address; fixed in migration 041.

**New principle:** Instead of starting with an over‑narrow discovery net and widening it incrementally (which has driven up costs and still missed coverage), we will pivot to a **wide‑net first** strategy on Google (broader category/types, rating ≥ 4.0) and then **filter down in our own pipeline** before hitting Foursquare or AI.

**What we've done:**

| Work | Purpose |
|------|---------|
| Discovery test harness | Runs query strategies per category on problem/control tiles, outputs JSON for comparison |
| JSON log schema | `discovery-*.json` — metadata, strategies, overlap, target matches for reproducibility |
| Per-tile allocation | `minPerTile`, `maxFromThisTile` — reserve capacity per tile so outer tiles aren't starved |
| Neighborhood queries | Add queries like “best cafe Villa Urquiza” for undercovered barrios; config-driven per city |
| Discovery profiles | `GOOGLE_DISCOVERY_PROFILES` — per-category strategy config; cafe wired to minimal |
| Cafe as pilot | Cafes used to validate the flow: harness → select strategy → wire into ingest → verify |
| Cafe minimal profile | `type=cafe` + "café" beats “best cafe” for outer tiles; applied only to cafes for now |
| `--category` flag | Runs ingest for one or more categories to test changes safely |
| Chicama investigation | Found via neighborhood strategy but dropped by 4.1+ gate (rating 4.0) |
| `--chicama-debug` | Acceptance test: minimal + neighborhood must surface Chicama; confirms discovery path works |

**What's missing:**

1. **Other category profiles** — Apply the same harness-based process to parrilla, bar, restaurant, etc., and wire profiles into ingest.
2. **Anchor / exception handling** — Generic `must_have_place_ids` (e.g. `city_must_have_place_ids`) so venues that fail the gate can still be included across categories.
3. **Pipeline-wide metrics** — Before/after counts by category and neighborhood for the whole pipeline.
4. **Generalized harness** — Extend beyond cafes to run strategies per category group.

**Next steps:**

1. Implement **anchor list** (e.g. `city_must_have_place_ids`) so known venues bypass the gate when needed.
2. Extend the harness to **parrilla, bar, restaurant** and tune discovery per category.
3. Wire those profiles into the ingest so **all categories** use profile-driven discovery.
4. Run full ingest, collect **metrics by category and neighborhood**, and iterate on profiles and allocation.

---

### 0.1 Pipeline & migrations

- Keep **v2 pipeline** as the source of truth:
  - `scripts/ingest-places-typed.ts` (Google + FSQ ingest, tiling, gates).
  - `scripts/fetch-venue-photos.ts`.
  - `scripts/compute-quality-scores.ts`.
  - `scripts/sync-neighborhoods-from-geojson.ts`.
  - `scripts/seed-cities.ts`.
- Ensure key migrations are applied:
  - PostGIS and tiling (`cities`, `city_tiles`).
  - `city_categories`, `venues.google_types`, `venues.fsq_categories`.
  - Canonical key fix (migration 041).
  - Cost-related migrations: 042–044 (`run_metadata`, `pipeline_runs`, `api_costs`).

**Production ingest command for live cities:**

```bash
npm run ingest:places:typed -- <city-slug> --force --incremental
```

Never drop `--force` for live cities. See [DATA-PIPELINE](DATA-PIPELINE.md) §Guardrails.

**Note:** Per the Foursquare cost guardrail (Current focus), avoid full ingest runs that trigger FSQ until Google ingestion is locked in. Use `--category` and harness/testing to validate discovery first; only run FSQ when necessary.

### 0.2 Cafe discovery (BA) — finalize and freeze

- Strategy (wide net → filter down):
  - Tiles: `type=cafe` + text `"café"` (minimal profile) with **Google-side rating floor around 4.0** to get a broad set of candidates.
  - Neighborhood: "café {neighborhood}" (e.g. "café Villa Urquiza") as supplemental queries to pull in local anchors.
  - Avoid over‑restrictive queries like `best-city` / `city-no-best` and `type-only` for cafes.
  - Apply our stricter **pipeline gates** (e.g. 4.1★ / 6+ reviews) and **anchor overrides** after ingesting from Google, not inside the Google query.
- Tools:
  - `test-google-discovery.ts` harness with JSON logs in `scripts/test-results/`.
  - `GOOGLE_DISCOVERY_PROFILES.cafe` wired to `minimal`.
  - `--category=cafe` flag for cafe-only ingest.
- Remaining work:
  - Add `must_have_place_ids` anchor list for BA cafés (e.g. Chicama Andonaegui).
  - Ensure anchors bypass rating gate while the global gate stays at 4.1★ / 6+.
  - Define simple **coverage benchmarks** for cafes (e.g. minimum cafe counts per key neighborhood like Villa Urquiza, Nuñez, Coghlan, Villa Ortúzar) and ensure these are met using Google-only ingest before running Foursquare tips or AI enrichment for that category.
  - Run cafe-only ingest and record:
    - Cafe counts per neighborhood.
    - Presence of anchors (Crisol, Dorina, Porta negra, Bilbo, Chicama).
    - Rating distribution for cafes.
- Once metrics look good, declare **cafe ingestion done** and use this pattern for other categories.

### 0.3 Other categories (pattern reuse)

Extend the harness and profiles beyond cafes (see 0.0 "What's missing" and "Next steps"). Category groups:

- Parrilla / restaurants.
- Bars (including cerveceria, dive_bar / classic bar if desired).
- Pizza, bakery / panaderia, empanadas.
- Culture: art_gallery.

For each group:

1. **Generalize the harness** — Run strategies per category on problem/control tiles.
2. **Select wide‑net profile** — For each category, choose a tile + neighborhood profile that:
   - Uses inclusive Google discovery (broader types/text + rating floor around 4.0).
   - Defers stricter filtering to our own gates and anchor logic.
3. **Add anchors** — Optional `must_have_place_ids` only for true anchors (bypass gate).
4. **Wire into ingest** — Add to city config, `city_categories`, `GOOGLE_DISCOVERY_PROFILES`.
5. **Set coverage benchmarks before FSQ/AI** — For each category, define per‑neighborhood coverage targets and confirm they are met with Google-only ingest before running Foursquare tips and AI enrichment for that category.
6. **Collect metrics** — Before/after counts by category and neighborhood; iterate.

### 0.4 City onboarding automation (future)

Bridge layer for adding new cities with **1 command**. Consumes Geo APIs / GeoJSON; writes `cities` and `city_categories`. See [CITY-ONBOARDING](CITY-ONBOARDING.md) and [AI-PIPELINE](AI-PIPELINE.md).

- **Inputs:** Geo APIs / GeoJSON (center, radius, bbox, neighborhoods); city metadata (population, language, country).
- **Logic:** Auto-derive `grid_rows`/`grid_cols`, `max_count`/`per_tile_max`, `min_rating_gate`/`min_reviews_gate` per category from radius and population.
- **Outputs:** Writes into `cities` and `city_categories`.
- **Tasks:** Update `scripts/onboard-city-ai.ts` so adding a new city is one command, no manual gate tuning.

---

## Phase 1 — AI enrichment & static data

**Goal:** Enrich venues and neighborhoods in batch so runtime is DB-only with good text and tags.

Full docs: [AI-PIPELINE](AI-PIPELINE.md).

### 1.1 Place enrichment (venues)

Enrichment scripts should run **only after** the ingestion pipeline has reached its coverage benchmarks for a city/category (wide‑net Google ingest + internal filtering). Do not use AI to compensate for missing venues.

- Inputs:
  - `fsq_tips` (JSONB) and `fsq_tips_fetched_at` on `venues`.
  - Google/FSQ types, rating, rating_count, existing `avg_expected_price`.
- Scripts:
  - `npm run fetch:venue-tips <city>` — backfill tips, no overwrite with empty.
  - `npm run enrich:venues:ai <city>` — tip-based enrichment:
    - Uses FSQ tips + categories to produce:
      - `short_description`.
      - `vibe_tags`.
      - `concierge_rationale`.
      - `avg_expected_price` (if null).
  - `npm run enrich:venues:ai:web <city>` — web-based enrichment (Perplexity / Tavily+OpenAI / OpenAI) for venues without tips.
- JSON handling:
  - Strip markdown (`**bold**`, code fences) before `JSON.parse` in both enrichment scripts.

**Pipeline flow:** GPT-4o-mini + tips first, then Perplexity (or Tavily+OpenAI) for gaps. Both scripts now process all eligible highlights (no per-run cap).

**Run order (per city):**

```bash
npm run fetch:venue-tips <city>
npm run enrich:venues:ai <city>      # 04mini + FSQ tips → venues WITH tips
npm run enrich:venues:ai:web <city>  # Perplexity/Tavily → venues WITHOUT tips
npm run fetch:venue-photos
npm run enrich:neighborhoods:ai <city>
```

### 1.2 Neighborhood guides

- Script:
  - `npm run enrich:neighborhoods:ai <city>`
    - For neighborhoods with many highlights: 150–250 word guide.
    - For low-traffic neighborhoods: 2–3 sentence snippet.
- Output:
  - Writes `city_neighborhoods.description`.
- Usage:
  - Explore → Neighborhoods.
  - Context text for Concierge.

### 1.3 Diagnostics & remediation

- `npm run check:neighborhood "Villa Urquiza" cafe`:
  - Shows counts with/without description, photos, FSQ tips.
- If a neighborhood has venues but no descriptions:
  - Re-run the enrichment pipeline in order.
- If a neighborhood has 0 highlights:
  - Re-run ingest with `--force --incremental` and ensure neighborhood queries include it (e.g. `"best cafe Villa Urquiza"` in `neighborhoodQueries`).

### 1.4 AI model tuning (no fine-tuning for now)

- **Perplexity:** No fine-tuning available; use better prompts and presets.
- **GPT-4o-mini:** Fine-tuning possible but not worth it at current scale. Prefer prompt refinement, few-shot examples, and `response_format: { type: "json_object" }` for consistent output.
- Revisit fine-tuning when we have 10+ cities or 50K+ venues with persistent quality issues.

### 1.5 AI enrichment audit

- **Coverage:** Count highlights with vs without `short_description`, `vibe_tags`, `concierge_rationale` by category and neighborhood.
- **Source split:** Tip-based (04mini) vs web-based (Perplexity) enrichment; identify neighborhoods/categories where tips are sparse.
- **Quality spot-checks:** Sample descriptions for tone, accuracy, and vibe_tag consistency.
- **Cost alignment:** Match `pipeline_runs` and `api_costs` to runs; ensure Perplexity usage is justified for no-tip venues.
- **Tools:** Extend `check-neighborhood` or add `check-enrichment` script for city-wide stats.

### 1.6 Multilingual place descriptions (ES, PT)

**Goal:** Store translated `short_description` and `concierge_rationale` so place content matches the user's locale (i18n). No patchy or runtime translations.

**Schema:**

- Add to `highlights`:
  - `short_description_es`, `short_description_pt` (TEXT)
  - `concierge_rationale_es`, `concierge_rationale_pt` (TEXT)
- Keep `short_description` and `concierge_rationale` as EN (default/fallback).

**Model choice (quality over cost for translations):**

- **Avoid:** GPT-4o-mini for translation — tends toward patchy, inconsistent output for ES/PT.
- **Preferred options:**
  - **GPT-4o** (full): Strong multilingual; single prompt can output EN + ES + PT in one call.
  - **Claude (Haiku or Sonnet):** Excellent Spanish/Portuguese; good for translation-only pass.
  - **DeepL API:** Dedicated translation; highest consistency and fluency; add as provider in `api_costs`.
- **Recommendation:** Use GPT-4o or Claude for the translation step; benchmark quality on a sample before committing. If results are still uneven, add DeepL as a dedicated translation layer.

**Implementation:**

1. **Enrichment scripts:** Extend `enrich-venues-ai.ts` and `enrich-venues-ai-web.ts`:
   - Option A: Single prompt — ask model to output EN, ES, PT in one JSON call.
   - Option B: Two-pass — generate EN first, then run a translation-only pass (EN → ES, EN → PT) with the chosen model.
2. **Read path:** All feeds, place detail, and Concierge pick the locale column (e.g. `short_description_es` for `es`) with fallback to EN when null.
3. **Backfill script:** `enrich:venues:translate` or similar — translate existing highlights that have EN but missing ES/PT; batch by locale to control cost.
4. **Neighborhood guides:** Consider `city_neighborhoods.description_es`, `description_pt` in a later pass if guides are user-facing.

**Run order (per city, after enrichment):**

```bash
npm run enrich:venues:ai <city>
npm run enrich:venues:ai:web <city>
npm run enrich:venues:translate <city>   # new: backfill ES/PT from EN
```

**Principles:** Batch-only; no runtime translation API calls. Store once, read by locale.

---

## Phase 2 — Cost tracking & monitoring

**Goal:** Make cost visible and tied to real runs (ingest, tips, AI), so you can scale safely.

### 2.1 Database & logging

- Tables:
  - `ingestion_jobs` — stores run metadata, including:
    - `google_calls`, `fsq_calls`, `city_slug`.
  - `pipeline_runs` — records fetch-tips and AI enrichment runs:
    - `type`, `city_slug`, `fsq_calls`, `ai_calls`, `model`/`mode`.
  - `api_costs` — per provider, per date:
    - `provider` (openai, anthropic, perplexity, google, foursquare, etc.).
    - `date`, `amount`, `currency`.
- Scripts:
  - Ingestion:
    - `ingest-places-typed` → logs to `ingestion_jobs` with Google/FSQ counts.
    - Legacy `ingest-places` → logs FSQ calls.
  - Tips + AI:
    - `fetch-venue-tips` → `pipeline_runs` with FSQ calls.
    - `enrich-venues-ai` → `pipeline_runs` with AI calls + model.
    - `enrich-venues-ai-web` → `pipeline_runs` with AI calls + mode (Perplexity / Tavily+OpenAI / OpenAI).

### 2.2 Cost import and manual recording

- OpenAI:
  - `npm run import:openai-costs` — uses OpenAI usage API; writes rows into `api_costs`.
- Perplexity / Google / Foursquare:
  - `npm run record:api-cost -- <provider> YYYY-MM-DD <amount>` — manual insert into `api_costs`.
- Future:
  - Add Anthropic import script similar to OpenAI's if you keep using Claude.

### 2.3 Admin → Usage dashboard

- Shows pipeline runs in one place:
  - Type (ingest, tips, AI, web enrichment).
  - City.
  - Items processed.
  - API calls (G/FSQ or AI).
  - Status.
  - Cost per provider (when present in `api_costs`).

### 2.4 Operational habit

After any significant batch run (ingest or AI):

1. Open Admin → Usage and confirm the run is logged.
2. Run `npm run import:openai-costs` for recent dates.
3. Run `record:api-cost` for Perplexity/Google/FSQ once billing data is available.

Later: consider a small cron or GitHub Action to run the OpenAI import daily.

---

## Phase 3 — Onboarding & preferences

**Goal:** Collect the minimal high-signal data needed to personalize Highlights and Concierge.

### 3.1 Preference model

Extend `user_preferences` with:

- Behavior & timing:
  - `weekly_outing_target`.
  - `preferred_time_blocks` (JSONB).
- Social:
  - `typical_group_type`.
- Constraints:
  - `dietary_flags` (JSONB).
  - `alcohol_preference`.
- Geography & exploration:
  - `radius_preference`.
  - `exploration_style`.
- Interests:
  - `primary_categories` (JSONB).
  - `secondary_categories` (JSONB).
  - `touristy_vs_local_preference`.

Ensure existing fields are wired: `persona_type`, `home_neighborhood`, `preferred_neighborhoods`, `interests`, `vibe_tags_preferred`, `budget_band`.

### 3.2 Onboarding flow v2

- 6–7 steps to fill the fields above:
  - Where you are (city, home neighborhood).
  - Who you are (local/nomad/visitor).
  - When & how often.
  - What you're into.
  - Budget & vibe.
  - Constraints & exploration.
  - Acquisition source + mark `onboarding_completed_at`.

### 3.3 Settings → Preferences

- Single Preferences screen that edits the same `user_preferences` fields.
- Avoid duplicate preference storage.

---

## Phase 4 — Explore / Highlights scoring & UX

**Goal:** Make Highlights/Explore feel curated and lightly personal.

**Bug fix:** Explore → Neighborhoods currently shows places (venues) instead of neighborhoods (barrios). Fix: Surface neighborhoods as the primary entity—neighborhood cards with guides/counts that link to place lists—not a flat list of places.

### 4.1 Shared highlight scoring

- Add `src/lib/highlights-scoring.ts` with:

  - `scoreHighlight(h, ctx): number` that:
    - Uses `quality_score` as base.
    - Adds distance, recency, and simple affinity from `user_place_state`/`user_place_tags`.
    - Adjusts weights by context (generic vs category vs neighborhood).

- Use `scoreHighlight` wherever Highlights are shown (home, category pages, neighborhood pages).

### 4.2 Explore filter bar

- On category pages, add a small filter bar:

  - Time (Anytime / Open now / Tonight).
  - Area (All city / Near me / My barrios).
  - Filters (price + vibes drawer).

- Wire to scoring context:
  - Time → boost likely-open or recently active venues.
  - Area → adjust distance weighting.

---

## Phase 5 — Concierge (planner)

**Goal:** Use enriched data + prefs to power a strong planning experience.

### 5.1 Scoring upgrades

- Extend `scorePlace` in `src/lib/concierge.ts` to account for:
  - `preferred_time_blocks` and current time (time match).
  - `exploration_style` (novelty vs favorites).
  - `dietary_flags` and `alcohol_preference` (hard filters).
  - `radius_preference` (distance weighting).

### 5.2 Sections & bundles

- Keep slot/section model, but:
  - Add simple "weekend sets" (small curated bundles) generated from top scored venues.
  - Use AI only for naming/description of bundles, not venue selection.

### 5.3 Feedback loop

- Short-term:
  - Session-level "reject" list for venues in a given plan.
- Long-term:
  - Persist soft negatives in `user_place_state` and subtract in scoring.

---

## Phase 6 — Mobile / PWA / Capacitor

**Goal:** Make Localist feel like an app, not just a website.

### 6.1 PWA

- Add `manifest.json` (name, icons, start_url, display=standalone).
- Add service worker (Next.js PWA pattern).
- Test:
  - Lighthouse PWA audit.
  - Add to Home Screen on Android/iOS.

### 6.2 Mobile polish

- Respect safe-area insets.
- Make primary CTAs tappable on small screens.
- Ensure drawers and filter sheets feel good on mobile.

### 6.3 Capacitor (optional later)

- Wrap PWA in Capacitor for iOS/Android if store distribution becomes a priority.

---

## Phase 7 — Content & long tail

**Goal:** Add editorial content and advanced features once the core loop is strong.

- Guided tours & multi-stop sets.
- Articles or blog posts tied to venues.
- Extra AI helpers:
  - Batch set generation.
  - Dedup helpers.
  - Data quality analyzers.

---

## Post-MVP backlog (Phase 2+)

Tasks that fall outside immediate MVP context. Prioritize when core loop is solid.

### Data & AI

- **Grid size logic** — AI vs API for setting city grid. Prefer larger grid than rerun ingestion; filter down later. Avoid reruns to control API costs.
- **Periodic ingestion refresh** — Monthly or quarterly refresh so DB stays up to date with Google + Foursquare (evaluate cadence vs cost).
- **Custom categories via AI** — City-specific categories generated by AI.
- **Audit Google/FourSquare types and categories** — Ensure type mapping and category usage are correct and efficient.

### Maps & exploration

- **Add map view** — Map-based browse of venues/neighborhoods.
- **Exploration map** — Map of visited places or neighborhoods, color-coded by how much has been explored.
- **Demographics / location-intelligence API** — Integrate external demographics or location data where useful.

### UI

- **PWA** — `manifest.json`, icons, install test (see Phase 6).
- **Fix search bar bugs** — Resolve known issues in search.
- **Language settings** — Add Spanish (and i18n foundation).
- **Google Maps Saved import** — Support import from Google Maps Saved lists via Google Takeout file upload.

### Onboarding & Concierge

- **Onboarding data storage** — Ensure onboarding responses are stored appropriately in `user_preferences`.
- **Guided tours with Maps links** — Multi-stop tours with Maps integration (see Phase 7).

### Content

- **Blog / article links** — Tie articles or blog posts to venues (see Phase 7).

---

That's your clean slate. Tomorrow you can start at **Phase 0 / Current focus** and move down when you're ready.
