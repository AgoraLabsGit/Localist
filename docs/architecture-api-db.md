# Localist — API vs. Own DB Architecture

*Extends the OpenClaw discussion. Decision framework for data architecture.*

*For operational pipeline (ingestion, AI, costs): see `docs/data_pipeline.md`. For cost breakdown: `docs/financial-model.md`.*

---

## The Core Question

**Are we a UI on top of APIs (Google Places, Eventbrite, Luma, etc.) or an app on our own stored database?**

---

## Architecture Options

### Option A: API-First (Thin UI)

```
User → Our App → API (Google, Eventbrite, etc.) → Response
```

- **Feed / search / filters** → Every request proxies to external API
- **Our DB** → Users, saved_items, preferences only
- **Places data** → Never stored; fetched live

| Pros | Cons |
|------|------|
| New cities = config change + API keys | API goes down → app is dead |
| No ingestion pipeline | Cost scales with traffic (pay per request) |
| Always fresh data | Rate limits, latency, no offline |
| Minimal compliance risk (we don't cache) | Hard to customize (their schema, their categories) |
| | Can't add our curation layer (vibe_tags, "best of") |

**Cost (Google Places):** 1K users × 20 views/day = 20K Place Details/month ≈ $340/month (above $200 free credit). 10K users = $3.4K/month.

---

### Option B: DB-First (Our Data)

```
Ingestion (batch) → Our Supabase DB
User → Our App → Supabase only (feed, filters, search)
Detail view → optionally fetch fresh from Google (1 call per detail view)
```

- **Feed / search / filters** → 100% Supabase. Zero API calls for browsing.
- **Our DB** → venues, highlights, users, saved_items, ratings
- **Google API** → Ingestion only + optionally Place Details on detail page

| Pros | Cons |
|------|------|
| API down → feed still works (cached data) | Need ingestion pipeline per city |
| Cost predictable (ingestion is batch, controlled) | New city = run ingestion, review, QA |
| Full control: our categories, our curation | Slightly stale feed (refresh weekly/bi-weekly) |
| Offline-capable (if we cache client-side) | Compliance: must store only place_id + our metadata |
| Can add AI descriptions, vibe_tags, featured picks | |

**Cost (Google Places):**
- **Ingestion (Text Search):** 8 calls per city per run ≈ $0.26/city. Predictable.
- **Detail view (Place Details):** Per view without cache; with 24h TTL per place_id, cost = unique places viewed × ~30 days, not total views. Example: 200 hot places × 30 ≈ 6K calls/mo ≈ $100 (vs. 150K uncached ≈ $2.5K). See `docs/financial-model.md` for full model.

---

### Option C: Hybrid (Recommended)

**Own the feed. Fetch details on demand.**

| Layer | Source | When |
|-------|--------|------|
| **Feed** | Supabase | Always. Our curated list. |
| **Search / filters** | Supabase | Always. |
| **Place detail (rating, hours, address)** | Google Place Details | On detail page open. 1 call per view. |
| **Ingestion** | Google Text Search | Batch, weekly. Discover + place_id only. |

**What we store (compliant):**
- `place_id`, `name` (our label), `city`, `neighborhood`, `category`, `short_description` (ours), `vibe_tags` (ours), `is_featured`
- We do **not** store Google ratings, reviews, photos, or Google-authored text; only our own derived metadata and `place_id`.

**What we fetch live (detail page):**
- rating, hours, address, phone, website, photos

**Cost at scale:**
- 1K users, 5 detail views/day: 150K Place Details/month. With field masks (Essentials+): ~$200–400/month. At 10K users: need caching or accept higher cost.
- Mitigation: **Short TTL cache** (e.g. 24h per place_id in Redis/Upstash). 100 unique places × 1 call each/day = 3K/month. Well within free tier.

---

## New City Onboarding

| Model | New city workflow |
|-------|-------------------|
| **API-First** | Add city coords + API key. Instant. But: generic data, no curation. |
| **DB-First** | 1) Add city to config. 2) Run ingestion (categories × queries). 3) Review/QA. 4) Ship. Heavier but curated. |
| **Hybrid** | Same as DB-first. Worth it for quality. |

**Nimble path:** Start with 1 city (BA). Prove product. When expanding, build a "city onboarding runbook": config file + ingest script + 30 min QA. Not instant, but repeatable.

---

## Single Points of Failure

| Dependency | API-First | DB-First |
|------------|-----------|----------|
| Google Places down | Feed broken | Feed works, detail page degrades |
| Supabase down | Auth/saves broken | Full outage |
| Eventbrite down (future) | Events broken | N/A (we'd cache events too) |

**DB-first reduces API SPOF:** Core experience (browse, filter, save) survives API outages.

---

## Monetization vs. API Cost

*These numbers are **pre-cache**. With 24h TTL per place and 100–300 active places/month, effective cost shrinks to low hundreds or less, and the paid-sub coverage requirement drops dramatically.*

| Users | Place Details (uncached) | Est. monthly cost | At $5/mo premium, need X% paid |
|-------|--------------------------|-------------------|--------------------------------|
| 1K | 150K calls | ~$400 | 8% paid (80 subs) |
| 10K | 1.5M calls | ~$4K | 80% paid — unrealistic |

**Mental model:** Pay per **unique place per day**, not per view. Cache aggressively.

**Conclusion:** Per-view API calls don't scale. We need either:
1. **Cache aggressively** (TTL per place) so cost ≈ unique places viewed, not total views
2. **DB-first** for feed; only detail page hits API, with cache
3. **Limit free tier detail views** or paywall detail page for free users

---

## Recommendation

**For Localist, we implement Option C (Hybrid):** curated feed in Supabase, Google Places for ingestion + detail views with caching.

**Go DB-first (Option B/C) with TOS-compliant minimal store:**

1. **Ingestion:** Batch, weekly. Store `place_id` + our metadata only. Slim `venues` table.
2. **Feed:** 100% Supabase. Zero Google calls for browsing.
3. **Detail page:** Fetch Place Details on view. Add server-side cache (e.g. Upstash Redis, 24h TTL per place_id) to cap cost.
4. **New cities:** Runbook + ingest. Accept 1–2 day lead time per city.
5. **Compliance:** Restructure schema/ingest to remove cached Google data (rating, address, hours). See OpenClaw remediation.

This architecture supports the current **highlights-only MVP** and generalizes when we add events (Eventbrite/Luma) later. Events will follow the same pattern: ingestion → Supabase → feed, with external APIs used only for ingestion and enrichment, not direct user queries.

**Category source:** Our categories come from the *ingestion search queries*, not Google's API. We query "best parrilla BA" → tag results as `parrilla`. We treat Google results as **candidates**; final inclusion and category assignment is our decision (query + manual/AI curation). We create a curated layer, not a reskinned Google UI.

---

## Operational Checklist (Hybrid for Localist)

1. **Schema** — `venues` (id, google_place_id, name, city, neighborhood, latitude, longitude) + `highlights` (venue_id, title, category, short_description, vibe_tags, is_featured, city, neighborhood, status). No Google ratings/hours/address in DB.
2. **Ingestion job (per city)** — Run Google Text Search with queries like "best parrilla Buenos Aires", "best cocktail bar Palermo", etc. Upsert by `google_place_id` into venues; upsert highlights with our category and labels.
3. **Feed** — All list and filter queries hit Supabase only (`WHERE city = ? AND category = ? AND neighborhood = ?`).
4. **Detail view** — On first view (or cache miss): call Place Details → store in Redis/Upstash with 24h TTL keyed by `place_id`. Return cached data on subsequent views.
5. **Monitoring** — Track Google API usage by endpoint and cache hit rate to validate the financial model.

---

## Scaling: 100K Places, Multiple Cities

**Postgres handles 100K rows easily.** A few considerations:

| Concern | Approach |
|--------|----------|
| **Query performance** | Indexes on `city`, `category`, `neighborhood` (already in schema). Filter by city first — e.g. 10 cities × 10K places each. Query returns in &lt;50ms. |
| **Pagination** | Cursor-based (`WHERE id > last_id`) or `LIMIT 20 OFFSET n`. Avoid deep OFFSET; use keyset pagination for infinite scroll. |
| **Search** | Postgres full-text search (`to_tsvector`) on title + description. Or Supabase pg_trgm for fuzzy search. Add when needed. |
| **Storage** | 100K highlights × ~500B ≈ 50MB. Venues similar. Supabase free tier = 500MB. Pro = 8GB. |
| **Connection pooling** | Supabase handles this. At very high scale, consider PgBouncer (included in Pro). |

**Editor picks:** Add `is_featured` or a score column per city/category for "editor picks" — easy at 100K rows and gives a strong curation layer that pure API-first cannot match.

**Bottom line:** 100K places across 10–20 cities is well within Supabase's capacity. No schema changes required. Add pagination and search when UX demands it.

---

## AI Cost (DB-First)

**Use case:** Transform Google API output → our unique `short_description` + `vibe_tags` for Supabase. See `docs/financial-model.md` for full breakdown.

| Item | Cost |
|------|------|
| Per place (Claude Haiku): ~325 tokens | ~$0.0008 |
| 100K places (one-time) | **~$80** |
| Monthly refresh (10% of places) | **~$8/mo** |
| GPT-4o-mini | ~10× cheaper (~$10 per 100K) |

**MVP:** For MVP, we use deterministic templates only. AI cost = $0. AI enrichment is an optional upgrade once we see usage and need more differentiated content.
