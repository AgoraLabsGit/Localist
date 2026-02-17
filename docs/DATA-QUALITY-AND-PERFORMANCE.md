# Data Quality & Performance

Addresses duplicate neighborhoods, duplicate venues, place detail page load time, and sparse coverage in neighborhoods like Villa Urquiza.

**AI pipeline:** See `docs/AI-PIPELINE.md` for enrichment, static summaries, and Phase 2 (guided tours, blog links).

---

## 1. Duplicate neighborhoods + all CAPS

**Problem:** Area filter shows duplicates (e.g. Liniers vs LINIERS, San Cristóbal vs SAN CRISTOBAL) and many names in all caps.

**Root cause:**
- `city_neighborhoods`: GeoJSON sync inserts raw names from source (ALL CAPS); seed uses title case
- Highlights: Ingestion stores neighborhood from Google/FSQ (mixed casing)
- Merge in page/API combines both without deduplication or display normalization

**Fix:**
1. **Display layer** — Dedupe by normalized name (lowercase, no diacritics) and apply title case when rendering. Implemented in `src/lib/neighborhoods.ts`; used by home page and `/api/neighborhoods`. Highlight cards also use `toTitleCase` for neighborhood display.
2. **Source layer** — Sync script inserts with title case. One-time cleanup: `npm run normalize:neighborhoods buenos-aires`.

**Still seeing duplicates or all caps?**
- **DB push is not required** — normalization runs at request time; the normalize script updates data directly (no migrations).
- Ensure you ran: `npm run normalize:neighborhoods buenos-aires` against the same Supabase project your app uses (`.env.local`).
- Restart the dev server (`npm run dev`) or redeploy so the latest code is loaded. If deployed: `vercel --prod` or push to main.
- **Cached build:** Try `rm -rf .next && npm run dev` to clear Next.js cache.
3. **Ingestion** — Optionally normalise neighborhood before upsert so FSQ/Google variants (e.g. "LINIERS") become canonical (e.g. "Liniers") via PostGIS `lookup_neighborhood` or a mapping table.

---

## 2. Duplicate places (El Ateneo / El Ateneo Grand Splendid)

**Problem:** Different Google place_ids for what might be the same or related venues (chain vs branch).

**Root cause:** Google Places treats each listing as a separate establishment—each has a unique `place_id`. Our upsert key is `google_place_id`, so we store both. **Google ID cannot filter duplicates**—it's the source of them.

**Proposed solution: canonical dedup key**

Use **address + name** as the canonical identity, not `place_id`:

| Signal | Reliability | Use case |
|--------|-------------|----------|
| **Address** | High | Same physical place. Normalize (lowercase, trim, collapse spaces, strip city suffix). Two venues with same normalized address = merge. |
| **Coordinates** | Medium | Same lat/lng rounded to ~5 decimals (~1 m) = same place. Use when address missing. |
| **Name + distance** | Medium | Similar name (one contains other, or Levenshtein small) + &lt;100 m = probable duplicate. Risk: different branches. |
| **Google place_id** | N/A | Unique per listing; cannot dedupe. |
| **Foursquare ID** | N/A | Different IDs for different FSQ listings (chain vs branch). |

**Canonical key formula (at ingest, before upsert):**

1. **When address exists:** `canonical_key = hash(normalize_address(addr))`  
   - Same address = same place, regardless of Google listing variants.
2. **When address missing:** `canonical_key = hash(normalize_name(name) + geohash(lat,lng,7))`  
   - Geohash precision 7 ≈ 150 m. Same name + same ~150 m area = likely same place.
3. **Fallback:** No address, no coords → `place_id` (no dedup).

**Behavior:**
- Before upsert, compute `canonical_key` for the candidate venue.
- Look up existing venue with same `canonical_key` in same city.
- **If found:** Add highlight to existing venue (or merge), do *not* create new venue row. Optionally store `google_place_id` in a `venue_google_ids[]` array for "Open in Maps" links.
- **If not found:** Insert new venue as today.

**Schema (optional):** Add `venues.canonical_key TEXT` + unique index `(city_id, canonical_key)` to enforce one venue per physical place. Or compute on the fly without persisting.

**Edge cases:**
- **El Ateneo vs El Ateneo Grand Splendid:** Different addresses (Recoleta vs other) → different keys → keep both. Correct.
- **Two Google listings for same address:** Same address → same key → merge. Correct.
- **Chain branches (same name, different locations):** Different addresses/geohash → different keys → keep both. Correct.

---

## 3. Place detail page load time

**Problem:** Detail modal feels slow to load.

**Current flow:**
1. User taps card → modal opens
2. Client fetches `GET /api/places/[id]`
3. API reads from Supabase only (no Google/FSQ calls)
4. Response rendered

**Bottlenecks:**
- Client-side fetch after modal opens (waterfall)
- API route cold start (serverless)
- Supabase query latency

**Improvements:**

| Change | Impact |
|--------|--------|
| **Prefetch on hover** | Request starts before click; modal opens with data ready |
| **Server component** | If we move to `/place/[id]` page, data fetched server-side, no client waterfall |
| **Static / ISR** | Pre-render top N places; cache API responses |
| **Embed in feed** | Pass place data with highlight; no extra fetch when opening modal |

**Static data:** All detail data (name, address, hours, photos, rating) already comes from our DB. We do **not** call Google/FSQ on the detail page. Making it "static" means:
- Pre-fetch or cache the Supabase response
- Or restructure so the feed payload includes enough for the modal (no extra request)

**AI pipeline for speed + cost:** Precompute at ingest and store in DB—no runtime API calls for the detail view:
- AI summaries/descriptions generated during enrichment → stored in `highlights.short_description` or new `ai_summary` column
- Feed prefetches or embeds minimal place data; modal opens instantly
- Future: AI-generated vibe tags, recommended-for personas—all batch jobs, not per-request

---

## 4. Sparse coverage in Villa Urquiza

**Problem:** Only 1 establishment (Sin Rumbo) for Villa Urquiza; Google Maps shows many more.

**Current state:**
- Grid: 3×3, center -34.60, -58.38, radius 15km
- Villa Urquiza ~ -34.57, -58.50 — within tile 3 (W center)
- One venue, one highlight

**Parameters to change (architecture):**

| Parameter | Table | Current (BA) | Effect on sparse neighborhoods |
|-----------|-------|-------------|--------------------------------|
| `grid_rows`, `grid_cols` | `cities` | 3×3 | **Denser grid** = tile centers closer to outer barrios; each subregion gets its own 20 results. 5×5 puts a tile ~centered on Villa Urquiza. |
| `maxResultCount` | Hardcoded (20) | 20 | Higher = more per request; doesn't help distribution. |
| `nextPageToken` | Not implemented | — | **Pagination** = get page 2, 3… for tiles that return a full page. Surfaces less prominent places. |
| `min_rating_gate`, `min_reviews_gate` | `cities` / `city_categories` | 4.3, 5 | Relax slightly for sparse barrios (future: per-neighborhood gates). |
| `max_count` per category | `city_categories` | Varies | If low, we stop before reaching outer tiles. |

**Pagination vs grid — which first?**

| Approach | What it does | Impact on sparse areas | Effort |
|----------|--------------|------------------------|--------|
| **Grid** | More, smaller tiles. 5×5 = 25 tiles vs 9. | Puts tile centers *inside* Villa Urquiza. Location bias returns local places first instead of Palermo/Recoleta. | Low: change `grid_rows`, `grid_cols` in DB. No code change. |
| **Pagination** | Follow `nextPageToken` when Google returns 20. | For tiles that fill 20 results, page 2+ may include less prominent places from that area. | Medium: loop on `nextPageToken` in `searchGooglePlacesTyped`. |

**Recommendation: grid first, then pagination**

1. **Grid first** — Increase BA to 5×5 (or 4×4). Cheapest, lowest risk. Tile radius drops from ~5 km to ~3 km. Villa Urquiza gets a tile whose center is nearer, so top-20 results are more likely to come from that barrio.
2. **Pagination second** — Add `nextPageToken` for tiles that return 20. Helps when a tile has many good results; page 2+ catches places that didn’t make the first 20.

**Order of operations:** (1) Implement venue deduplication (§2). (2) Update `cities.grid_rows=5`, `grid_cols=5` for BA. (3) Run ingest → measure Villa Urquiza count. (4) Add `nextPageToken` pagination if still sparse.

---

## Implementation priority

1. **Neighborhood normalization** — Done: dedupe + title case
2. **Venue deduplication** — Done: canonical key at ingest (migration 027, `ingest-places-typed`).
3. **Villa Urquiza / sparse coverage** — Grid 5×5 for BA done; add `nextPageToken` pagination if still sparse.
4. **Place detail** — Static data + AI pipeline (see Roadmap)
