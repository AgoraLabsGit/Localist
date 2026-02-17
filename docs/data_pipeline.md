# Localist Data Pipeline

*API → AI enrichment → our DB. Compliant, low-cost, differentiated.*

**Related docs:** `docs/google-places-compliance.md` (TOS), `docs/architecture-api-db.md` (decisions), `docs/financial-model.md` (costs).

---

## Goals

- Use **Google Places** to discover places and provide **context** for enrichment.
- Run **AI** over that context to produce our own `short_description` and `vibe_tags`.
- Store only **our AI output** (plus `place_id` and metadata) in Supabase — never Google’s raw text.
- Keep API costs predictable via batch ingestion and short-TTL caching.

---

## The Special Sauce: Google Input → AI Output → Our DB

This is Localist’s differentiator: we use Google data as **input**, AI generates **our content**, and we store **only our output**.

| Stage | Source | What happens |
|-------|--------|--------------|
| **Input** | Google Places (Text Search, optionally Place Details) | Rating, address, name, optionally editorial summary — used only during AI call |
| **Transform** | LLM (Claude / GPT-4o-mini) | Produces original `short_description` + `vibe_tags` |
| **Store** | Supabase | We save **only** the AI output + `place_id` + our metadata |

**Compliance:** We do not cache or store Google’s text. We use it transiently as context. Our stored content is original.

---

## High-Level Flow

1. **Text Search** (Google) → candidate places with `place_id`, name, address, rating.
2. **Upsert** → `venues` + `highlights` in Supabase (minimal row: `place_id`, name, category, neighborhood, city).
3. **AI enrichment** → For each place: pass Google context to LLM → receive `short_description`, `vibe_tags` → write to Supabase.
4. **Feed** → 100% Supabase. No Google calls for browse/filter.
5. **Detail view** → Fetch Place Details on demand (24h cache). Merge with our stored data. Show attribution.

---

## AI Enrichment (MVP Focus)

### Input to the AI

We feed the LLM context from the **ingestion pipeline** (we never store this Google data long-term):

| Input | Source | Purpose |
|-------|--------|---------|
| `name` | Text Search | Place name |
| `category` | Our config | e.g. parrilla, cafe |
| `city`, `neighborhood` | Config + guess | Location context |
| `rating`, `user_rating_count` | Text Search | Quality / popularity |
| `formatted_address` | Text Search | Location detail |
| `editorial_summary` *(optional)* | Place Details | Extra context for richer copy |

Using Google data as **transient input** is allowed. We do not store or republish their text.

### Output from the AI

| Output | Stored in | Format |
|--------|-----------|--------|
| `short_description` | `highlights.short_description` | 1–2 sentences, Localist voice |
| `vibe_tags` | `highlights.vibe_tags` | Subset of controlled list: `solo_friendly`, `date_night`, `touristy`, `local`, etc. |
| `price_band` *(optional)* | `highlights.avg_expected_price` or new column | `cheap` / `mid` / `high` |

### MVP Path: Templates → AI

- **Phase 1 (MVP):** Deterministic templates. No AI. `short_description` = `"{name} — a top-rated {category} in {neighborhood}, Buenos Aires."` Cost: $0.
- **Phase 2 (Differentiation):** AI enrichment job. Use Google context as input. Store AI output. Cost: ~$0.0008/place (Haiku) or ~$0.0001/place (GPT-4o-mini).

---

## Cost Implications

### Google Places API

| Use | Cost |
|-----|------|
| Text Search (ingestion) | 8 calls/city/run ≈ $0.26/city |
| Place Details (detail view) | ~$17/1K calls. With 24h cache: cost ≈ unique places × 30, not total views. |
| Place Details (for AI input, optional) | +$2.72/city/run if we fetch details per place |

### AI

| Model | Per place | 10K places | 100K places |
|------|-----------|------------|------------|
| Claude Haiku | ~$0.0008 | ~$8 | ~$80 |
| GPT-4o-mini | ~$0.0001 | ~$1 | ~$10 |

**Ongoing:** Regenerate 10% monthly → ~$0.80/mo (Haiku) or ~$0.10/mo (GPT-4o-mini).

### Summary

- **MVP (templates):** Google ingestion + detail cache only. ~$5–100/mo depending on traffic.
- **AI-enabled:** Add AI cost above. Total typically under $150/mo at 10 cities, 1K places, moderate traffic.
- See `docs/financial-model.md` for full breakdown.

---

## Data We Store vs. Fetch

### Stored in Supabase (`venues` + `highlights`)

| Field | Notes |
|-------|-------|
| `google_place_id` | Allowed indefinitely |
| `name`, `city`, `neighborhood`, `category` | Our labels / taxonomy |
| `short_description`, `vibe_tags` | **AI-generated (our content)** |
| `is_featured` | Our curation |
| Timestamps | Created/updated by our pipeline |

We do **not** store: Google ratings, reviews, photos, addresses, hours, or editorial text.

### Fetched at Runtime (Detail View)

Via Place Details, with 24h cache:

- `formatted_address`, `opening_hours`, `rating`, `phone`, `website`, `photos`

Display with Google Maps attribution.

---

## Ingestion Pipeline

1. **Config** — Category queries per city (e.g. `best parrilla Buenos Aires`).
2. **Text Search** — Call `places:searchText` for each query. Extract `place_id`, name, address, rating.
3. **Upsert** — Insert/update `venues` (by `google_place_id`) and `highlights` (by `venue_id` + `category`).
4. **AI** — For each new/updated row: call LLM with context → write `short_description`, `vibe_tags`.
5. **Schedule** — Run via cron every 7–14 days per city.

Implementation: `scripts/ingest-places.ts`. Currently uses templates; AI enrichment to be added.

---

## Detail View

1. Frontend calls `GET /api/places/[id]`.
2. Backend: resolve `place_id` from Supabase → check Redis/Upstash cache.
3. Cache miss → Place Details → cache 24h → return merged response (our data + Google live data).
4. Show Google Maps attribution.

---

## Compliance Summary

- **We own:** Schema, taxonomy, `short_description`, `vibe_tags`, featured flags.
- **We store:** `place_id` + our own data only.
- **We use Google for:** Discovery (Text Search), live detail (Place Details). Context for AI is transient.
- **We never:** Cache Google text, build a clone of their DB, or display their content without attribution.

See `docs/google-places-compliance.md` for full TOS details.
