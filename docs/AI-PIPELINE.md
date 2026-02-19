# AI Pipeline — Ingestion & Management

AI touchpoints for data ingestion, enrichment, and content generation. Single source of truth for the AI layer architecture.

**Related:** [DATA-PIPELINE](DATA-PIPELINE.md), [CITY-ONBOARDING](CITY-ONBOARDING.md), [COSTS](COSTS.md). **Execution order:** [ROADMAP](ROADMAP.md).

***

## Principles

1. **Batch over runtime**  
   AI runs at ingest or post-ingest; no per-request AI calls for feeds or place detail.

2. **Store outputs in DB**  
   AI summaries, tags, rationales live in our schema. All runtime reads go through Supabase.

3. **Avoid reruns**  
   Prefer generous ingest + filtering in-app over repeated ingest/enrichment runs.

4. **Cost guardrails**  
   Hard caps on AI calls per run; configurable later via `admin_settings`. Start with constants.

5. **Deterministic selection**  
   AI can propose text and suggestions but never invents venues; venue selection is always from our DB.

***

## Touchpoints

| Touchpoint | When | Input | Output | Script / Flow |
|-----------|------|-------|--------|---------------|
| **City onboarding** | Pre-ingest | City name | Config JSON | `onboard-city-ai.ts` |
| **Place enrichment** | Post-ingest | Venue + highlight | `short_description`, `vibe_tags`, `concierge_rationale`, `avg_expected_price` | `enrich-venues-ai.ts` |
| **Neighborhood guides** | Post-ingest | Barrio + counts + sample | 150–250 words or snippet | `enrich-neighborhoods-ai.ts` |
| **Weekend set suggestions** | Optional batch | Persona + neighborhoods | Set configs (human approval) | `suggest-weekend-sets-ai.ts` |
| **Venue dedup** | Ingest or batch | Candidate pair | same/different (review queue) | `dedupe-venues-ai.ts` |
| **Guided tours** | Manual / batch | Curated lists | Tour config + Maps links | `guided-tours-seed.ts` |
| **Blog/article links** | Post-enrichment | Place name + city | URLs per highlight | `link-blog-articles-ai.ts` |

For phasing and execution order, see [ROADMAP](ROADMAP.md) Phase 1.

***

## Pipeline Placement

```text
┌─────────────────────────────────────────────────────────┐
│ PRE-INGEST (AI onboarding)                             │
│  - onboard-city-ai.ts → cities, city_neighborhoods,     │
│    city_categories (+ optional grid_rows/grid_cols)     │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ INGEST (no AI)                                          │
│  - ingest-places-typed → venues, highlights (Google,    │
│    FSQ, manual)                                         │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ POST-INGEST (AI enrichment — separate batch layer)       │
│  - fetch-venue-photos                                   │
│  - compute-quality-scores                               │
│  - enrich-venues-ai → short_description, vibe_tags,     │
│    concierge_rationale, avg_expected_price              │
│  - enrich-neighborhoods-ai → barrio intros              │
│  - enrich-venues-ai-web → descriptions from web (no tips)│
│  - link-blog-articles-ai → highlight_articles           │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ RUNTIME (no AI)                                         │
│  - Explore, Highlights, Concierge, detail views read    │
│    only from Supabase (no live LLM calls)               │
└─────────────────────────────────────────────────────────┘
```

AI jobs are a **separate batch layer**: they read only from the DB and write enriched fields back. No ingestion script depends on AI; ingestion = coverage, enrichment = quality.

***

## 1. City Onboarding (Existing)

**Script:** `scripts/onboard-city-ai.ts`  
**Model:** GPT‑4o‑mini (see `COSTS.md` for details)

**Current:**  
Generates city config (center, radius, neighborhoods, categories).

**Caps & Gates (migration 036):**  
Ingestion is generous by default. Per-category caps scale with radius and population; dense metros get hundreds of venues per category. We avoid hard upper limits that would starve dense neighborhoods; instead we use soft minimum gates and city-scaled caps.

Helpers in `src/lib/venue-caps.ts`:
- `deriveVenueCaps({ population, radiusMeters, gridRows, gridCols })` → `{ maxCount, perTileMax }` (per-category, per-city)
- `deriveBaseGatesForCity(population)` → `{ minRating, minReviews }`
- `adjustGatesForThinCategory(base)` → relaxed gates for kids, tours, etc.

When `city_categories.max_count` or `per_tile_max` are set manually, they take precedence over derived defaults. `cities.population` (nullable) feeds derivation; null = midsize (2M) fallback.

**Discovery without lowering gates:** For sparse tiles (e.g. Villa Urquiza), we get more candidates by: (1) multi-query per tile (e.g. cafe: type=cafe + type=restaurant "café"); (2) full pagination (6–8 pages); (3) 1.3× radius for outer tiles. Relaxation is the last resort when a tile still has fewer than `min_results_per_tile` after these. See [DATA-QUALITY-AND-PERFORMANCE](DATA-QUALITY-AND-PERFORMANCE.md) §4.

**Extension:**

- Add `grid_rows` and `grid_cols` to the AI output schema:

```jsonc
{
  "grid_rows": 5,
  "grid_cols": 5
}
```

- Prompt rule-of-thumb:

  - If `radiusMeters > 15000` or `neighborhoods.length > 30` → 5×5.  
  - If `neighborhoods.length > 20` → 4×4.  
  - Else → 3×3.

**Alternative formula-only fallback:**

- `rows = cols = min(6, max(3, ceil(radius_km / 5)))`.

***

## 2. Grid Derivation

**Principle:**  
Prefer a larger, stable grid and filter in-app over re-running city onboarding.

**Implementation:**

- Option A (preferred): include `grid_rows/grid_cols` in city onboarding output.  
- Option B: if missing, compute via `set-grid-params-from-bounds.ts` using radius / bbox.

***

## 3. Explore Filters — Data Requirements

Which filters work without AI enrichment vs need it:

| Filter | Data source | Works without AI? | Notes |
|--------|-------------|-------------------|-------|
| **Area** (Near me, My Neighborhoods) | Venues: lat/lng, neighborhood; Users: preferred_neighborhoods | ✓ Yes | Uses existing ingest data |
| **Price** ($, $$, $$$) | highlights.avg_expected_price | △ Partial | FSQ or AI fills; null → excluded when filtered |
| **Vibe** (Cozy, Lively, etc.) | highlights.vibe_tags | △ Partial | AI fills; null/empty → excluded when filtered |
| **Open now** | venues.opening_hours | ✗ No | FSQ only; many null. Chip removed until coverage improves. |
| **Time** (Today, Tonight, Weekend) | — | UI only | Not yet filtering; mood hints for future features |

**To make filters useful:** Run `npm run enrich:venues:ai` [city] after ingest so `vibe_tags` and `avg_expected_price` are populated. Without it, Price and Vibe filters will severely reduce results (only places with data match).

***

## 4. Place Enrichment (Post-Ingest) — MVP

**Two-stage pipeline:** GPT-4o-mini + tips first; Perplexity (or Tavily+OpenAI) for gaps. Both scripts process all eligible highlights in one run (no per-run cap). See run order below.

**Script:** `scripts/enrich-venues-ai.ts`  
**Model:** GPT‑4o‑mini (batch, 15 places per API call)

**Separate batch layer:** Runs *after* ingest + scores. Does not block or couple to ingestion. Ingestion = coverage; enrichment = quality of descriptions and tags.

**Foursquare tips (per [FSQ API terms](https://foursquare.com/legal/terms/apilicenseagreement/)):**

- Tips are fetched during ingest (`ingest-places-typed.ts`) via Places API `/places/{id}/tips`, stored in `venues.fsq_tips` (JSONB).
- **Live city refresh:** `npm run fetch:venue-tips` [city] fetches tips for venues with `foursquare_id` but missing or stale tips (>90 days). Use for enrichment without re-running full ingest. Respects FSQ cap.
- Server-side cache only; never call Foursquare at runtime.
- Tips are inputs for AI-derived summaries/tags; never exposed as raw searchable corpus. Our descriptions are original synthesis, not reuse or quotation of tip text.

**Tips cache preservation:** Never overwrite `fsq_tips` with null/empty. Ingest and `fetch-venue-tips` only write when new tips exist (`tips.length > 0`). AI scripts only read; they never modify. Run **tips → AI** (fetch tips first, then enrich).

**Token budget (per place):**

- Input ≤ 300 tokens (name, address, categories, neighborhood, FSQ tips, source description).  
- Output ≤ 150 tokens.

**Input fields:**

- From `venues` and/or `highlights`:
  - `name`, `address`, `city`, `neighborhood`
  - `fsq_tips` (cached from ingest; primary signal for vibe)
  - `categories` / `google_types` / `fsq_categories`
  - Existing `fsq_description` or other text
  - Existing `avg_expected_price` if present

**Output fields:**

- `highlights.short_description`  
  - 1–2 sentences, max ~250 characters.  
- `highlights.vibe_tags`  
  - Array of 3–6 tags, e.g. `["cozy","local","date_night"]`.  
- `highlights.concierge_rationale`  
  - One line in plain text, e.g. “Great for a cozy date-night dinner in Palermo with mid-range prices.”  
- `highlights.avg_expected_price` (optional)  
  - Only filled when null; otherwise leave existing value from FSQ.

**Prompt contract (sketch):**

- System: “You are a Buenos Aires city guide. Return concise JSON only.”  
- User: pass structured venue info; ask for:

```jsonc
{
  "short_description": "...",
  "vibe_tags": ["...", "..."],
  "concierge_rationale": "...",
  "avg_expected_price": 2
}
```

**Behavior:**

- Only processes highlights whose venue has `fsq_tips` (from ingest or `fetch:venue-tips`).  
- Skip highlights where `short_description` is already populated (idempotent).  
- Use `--backfill` to re-process including already-enriched.  
- **No per-run cap** — processes all eligible highlights. Paginates (1000 rows/page) to work around Supabase limit.
- **Safety cap:** `total active × 2` (max 10K), or `MAX_ENRICH_ITEMS` env override.

***

## 4b. Place Enrichment from Web (no-tip fallback)

**Script:** `scripts/enrich-venues-ai-web.ts`  
**Model:** Tavily + gpt-4o-mini (recommended), Perplexity Sonar, or gpt-4o-mini only (knowledge)

**Use case:** Highlights whose venue has *no* `fsq_tips`. Run after `enrich-venues-ai`.

**Input:** Place name, city, neighborhood, category. Perplexity searches the web for reviews and “what it’s known for.”

**Output:** Same as §4 — `short_description`, `vibe_tags`, `concierge_rationale`, `avg_expected_price`.

**Behavior:**

- Only processes venues with no (or empty) `fsq_tips`.
- **Priority:** 1) Perplexity Sonar (recommended), 2) Tavily + OpenAI, 3) OpenAI only (knowledge).
- **No per-run cap** — processes all eligible highlights. Paginates (1000 rows/page).
- **Safety cap:** `total active × 2` (max 5K), or `MAX_ENRICH_WEB_ITEMS` env override.
- CLI: `npm run enrich:venues:ai:web [city-slug]`

***

## 5. Neighborhood Guides (MVP+)

**Script:** `scripts/enrich-neighborhoods-ai.ts`  
**Model:** GPT‑4o‑mini (low volume, per city)

**Input:**

- Neighborhood name, city.  
- Category counts (e.g., 15 cafés, 6 bars) and sample of venues (name, category, price band, vibe_tags).

**Length:** Normal (≥5 highlights): ~150–250 words. Low-traffic (<5): 2–3 sentence snippet.

**Behavior:**

- Run *after* place enrichment so vibe_tags can inform descriptions.  
- Skip neighborhoods where `description` is already populated unless `--backfill` is passed.  
- CLI: `npm run enrich:neighborhoods:ai [city-slug]` or `npm run enrich:neighborhoods:ai [city-slug] -- --backfill`

**Output:**

- `city_neighborhoods.description`  
  - 2–3 sentences, max 350 characters, focusing on vibe + who it’s for.

**Usage:**

- Display at top of Neighborhood pages.  
- Used by Explore → Neighborhoods and Concierge sets (copy).

***

## 6. Weekend Set Suggestions (Phase 2)

**Script:** `scripts/suggest-weekend-sets-ai.ts`  
**Model:** GPT‑4o‑mini, inspiration only (low volume)

**Input:**

- City, list of neighborhoods, example highlights (names + categories + vibe tags).  
- Persona types and example slot patterns.

**Output:**

- Suggested set configs:

```jsonc
{
  "id": "sunday_chill_palermo",
  "label": "Sunday Chill in Palermo",
  "slots": [
    { "category_group": "outdoors" },
    { "category_group": "cafe" },
    { "category_group": "culture" }
  ]
}
```

**Important guardrails:**

- AI **never** introduces new venues.  
- Deterministic logic always selects venues for sets from our DB.  
- Suggested sets are stored in e.g. `concierge_set_suggestions` with an `approved` flag; only approved sets go live.

***

## 7. Venue Dedup (Optional, Phase 2)

**Script:** `scripts/dedupe-venues-ai.ts`  
**Model:** Claude Sonnet (or similar stronger reasoning model)

**Input:** pairs of venues that are likely duplicates (same name, nearby coordinates).

**Output:** decision:

```jsonc
{ "same_entity": true, "confidence": 0.92, "reason": "..." }
```

Used only to assist a human review queue; never auto-merges without confirmation.

***

## 8. Static Summaries / Detail Page

**Goal:**  
Place detail must be fully served from Supabase.

- For MVP, reuse `short_description` on detail.  
- In Phase 2, optional longer `ai_summary` field if needed (generated in the same enrichment step, but still stored in DB).
- **Optional:** Add `highlight_blurb` — 1–2 strong themes derived from tips (e.g. "Guests mention the pastries and quiet weekday vibe"). Show as *our* copy on detail; never raw FSQ tip text, names, or timestamps (per FSQ terms).

No runtime AI calls from the detail view.

***

## 9. Guided Tours with Maps Links (Phase 2)

**Data model:**

- `guided_tours`  
  - `id`, `city_id`, `title`, `description`, `duration_minutes`  
- `guided_tour_stops`  
  - `tour_id`, `venue_id`, `stop_order`, `notes`

**Maps link pattern:**

- `https://www.google.com/maps/search/?api=1&query_place_id={venues.google_place_id}`

**AI role (optional):**

- Suggest initial tours from curated lists; human curates and saves.

***

## 10. Blog / Article Links (Phase 2)

**Data model:**

- `highlight_articles`  
  - `id`, `highlight_id`, `url`, `title`, `source`, `fetched_at`

**AI role:**

- Search: “<place name> Buenos Aires review / article” (with domain whitelists).  
- Extract top 1–3 relevant URLs; store metadata.  
- All links can be manually reviewed or whitelisted.

**UI:**

- Place detail → “Read more” section with article titles linking out.

***

## 11. Model & Prompt Strategy (Summary)

For detailed pricing and model choices, see `COSTS.md`. Current defaults:

- **City onboarding:** GPT‑4o‑mini (or Claude Haiku) — structured config, low cost.  
- **Place enrichment:** **GPT‑4o‑mini** — main batch model, ~US$0.0001/place target.  
- **Neighborhood micro-guides:** GPT‑4o‑mini.  
- **Weekend set suggestions:** GPT‑4o‑mini (low volume, curated).  
- **Venue dedup:** Claude Sonnet (if needed).  
- **Blog/article discovery:** external search + LLM extraction.

***

## 12. Cost Controls

- Hard-code per-job caps initially (to be wired to `admin_settings` later):

  - Enrichment scripts: no per-run cap; process all eligible. Safety cap = total active × 2 (max 10K tip-based, 5K web). Override: `MAX_ENRICH_ITEMS`, `MAX_ENRICH_WEB_ITEMS`.
  - `MAX_AI_CALLS_PER_MONTH` (soft; log + alert if exceeded) — future.

- Always **batch** calls (N places per request) where possible.  
- “Skip if populated” rule for enrichment jobs.  
- Add logging + simple alerting when:

  - Error rate > threshold (e.g., 5%).  
  - Actual usage approaches monthly cap.

***

## 13. Ops / Runbooks

| Job | Trigger | Backfill / Notes |
|-----|---------|------------------|
| City onboarding | Manual: `npx tsx scripts/onboard-city-ai.ts "Buenos Aires" --save` | Run once per city. |
| Place enrichment | After ingest batch; optional cron (daily/weekly) | `--backfill` flag to process all highlights with null `short_description`. |
| Place enrichment (web) | After place enrichment | No-tip venues only. Tavily+OpenAI or Perplexity. |
| Neighborhood guides | Manual per city or cron after enrichment | Re-run rarely; `--backfill` to overwrite. |
| Weekend set suggestions | Manual | Suggestions stored as drafts; require human approval. |
| Guided tours | Manual or admin UI | Purely optional content layer. |
| Blog link discovery | After enrichment; occasional cron | Respect per-run URL & call caps. |

***

## 14. Execution Order

For execution order and phasing, see [ROADMAP](ROADMAP.md) Phase 1.

***

## 15. Do This Next — Turn On the AI Pipeline

The code-level pipeline is complete. To make it operational:

**Order matters:** tips → AI. Never overwrite tips with null/empty; only refresh when stale (90 days) and AI has already consumed them or you're about to re-run AI.

1. **Configure API keys** — Add to `.env.local`:
   ```bash
   OPENAI_API_KEY=sk-...
   ```
   For tip-based enrichment: `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`.

   For web-based enrichment (no-tip venues): add `PERPLEXITY_API_KEY` (recommended) — get from [Perplexity API](https://docs.perplexity.ai/).

2. **Ensure FSQ tips exist** — Run fetch first so venues have tips for AI input:
   ```bash
   npm run fetch:venue-tips buenos-aires
   ```

3. **Run enrichment scripts** (in order; both process all eligible highlights per run):
   ```bash
   npm run enrich:venues:ai buenos-aires     # 04mini + tips → venues WITH tips
   npm run enrich:venues:ai:web buenos-aires # Perplexity → venues WITHOUT tips
   npm run enrich:neighborhoods:ai buenos-aires
   ```

4. **Verify** — Check that `highlights.short_description`, `highlights.vibe_tags`, and `city_neighborhoods.description` are populated in Supabase.

**Full operational flow (live city):**

1. Ingest: `npm run ingest:places:typed -- <city> --force --incremental`
2. Backfill tips: `npm run fetch:venue-tips <city>`
3. AI enrichment: `npm run enrich:venues:ai <city>` (then `enrich:venues:ai:web <city>`, then `enrich:neighborhoods:ai <city>`)
