# Data Quality & Performance

Duplicate neighborhoods, duplicate venues, place detail load time, and sparse coverage. **AI pipeline:** [AI-PIPELINE](AI-PIPELINE.md). **Execution order:** [ROADMAP](ROADMAP.md).

---

## 1. Duplicate neighborhoods + all CAPS — **Implemented**

**Problem:** Area filter shows duplicates (e.g. Liniers vs LINIERS, San Cristóbal vs SAN CRISTOBAL) and many names in all caps.

**Root cause:**
- `city_neighborhoods`: GeoJSON sync inserts raw names from source (ALL CAPS); seed uses title case
- Highlights: Ingestion stores neighborhood from Google/FSQ (mixed casing)
- Merge in page/API combines both without deduplication or display normalization

**Implemented:** Display dedupe + title case in `src/lib/neighborhoods.ts`; one-time cleanup `npm run normalize:neighborhoods buenos-aires`.

---

## 2. Duplicate places (El Ateneo / El Ateneo Grand Splendid) — **Revised**

**Problem:** Different Google place_ids for what might be the same or related venues (chain vs branch).

**Root cause:** Google Places treats each listing as a separate establishment—each has a unique `place_id`. Our upsert key is `google_place_id`, so we store both. **Google ID cannot filter duplicates**—it's the source of them.

**Previously:** Canonical key (address or name+geohash) was used to merge venues. **Regression (migration 041):** Merging by canonical_key caused distinct businesses at the same address to overwrite each other—e.g. two Villa Urquiza cafés merged into one, losing the first. **Fix:** Stop merging by canonical_key. Each `google_place_id` = one venue. canonical_key kept for analytics only.

---

## 3. Place detail page load time — **Open**

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

## 4. Sparse coverage in outer neighborhoods — **Implemented**

**Problem:** Outer neighborhoods (e.g. Villa Urquiza in north BA) got few or no venues despite Google Maps having many. With row-major tile order (row 0 south → row 4 north), early tiles exhausted the category budget before northern tiles were processed.

**Root cause:** No per-tile reservation. With `maxCount ~283`, `perTileMax ~28`, and 25 tiles, the first ~10 tiles (south/center) used the full budget. Villa Urquiza (row 4) was never reached.

**Implemented fixes:**

| Fix | Where | Effect |
|-----|-------|--------|
| **Fair per-tile allocation** | `ingest-places-typed.ts` `searchGooglePlacesTyped` | `minPerTile = floor(maxCount/tiles)`. For each tile, cap at `min(perTileMax, maxCount - totalUsed - tilesLeft × minPerTile)` so every tile gets a minimum share. |
| **Grid 5×5** | migration 027 | Tile centers cover north (Villa Urquiza, Belgrano) and outer barrios. |
| **Multi-query, pagination, outer radius** | ingest script | cafe: type=cafe + type=restaurant "café"; 6–8 pages; 1.3× radius outer tiles; min_results_per_tile relaxation. |

**§5. Canonical key merge regression — Fixed (migration 041)**  
Merging venues by canonical_key (address hash) overwrote distinct businesses at the same address. E.g. 2 Villa Urquiza cafés → 1. Disabled merge; each place_id now gets its own venue.

**§6. Missing neighborhood queries (root cause of outer-barrio undercoverage):** ingest-places-typed did NOT run neighborhood-specific queries ("best cafe Villa Urquiza"). It only ran city-wide tile search—Google returns top city-wide results per tile, so local Villa Urquiza cafés ranked low. The legacy ingest had neighborhood queries; typed did not. **Fix:** Added neighborhood query phase to ingest-places-typed; added Villa Urquiza, Nuñez, Coghlan, Villa Ortuzar to config. Run `seed-cities` to persist.

**§7. Chicama edge case — investigated (2026-02):**

Chicama (Villa Urquiza anchor) was missing from cafe ingest. Investigation:

| Question | Finding |
|----------|---------|
| Does Google see Chicama? | Yes. Two locations: **Chicama** (Echeverría 4322, 4.0★/240), **Chicama Andonaegui** (Andonaegui 2052, 4.0★/960). Café/restaurant. |
| Does discovery surface it? | **Yes.** `neighborhood` ("café Villa Urquiza") and `chicama-only` ("Chicama Villa Urquiza") both return it. `minimal` does not. |
| Why does ingest drop it? | **Rating gate.** Main gate = 4.1+/6+. Chicama = 4.0★. Discovered then filtered before save. |

**Remediation options:**
- **Anchor list:** Maintain `must_have_place_ids` per city; seed/keep venues even if they fail the gate. Chicama (e.g. `ChIJjcTocUq3vJURQu5v4X9vLQ8`) would be included.
- **Lower gate for cafes:** Would include Chicama but could add lower-quality venues. Not recommended.
- **Manual seed:** One-off insert for Chicama. Simple but does not scale.

**Harness:** `npm run test:google-discovery buenos-aires 24 -- --chicama-debug` runs minimal+neighborhood only and reports whether Chicama appears (acceptance test).

**§8. General discovery gaps:** Even with neighborhood queries, venues can be missed due to (1) query relevance; (2) pagination limits; (3) rating gates. Mitigations: café de especialidad pattern; 8/10 pages for cafe/brunch; neighborhood queries for outer barrios.

**§9. Google discovery tests:** Focus: cafes, BA, problem tile (4-4) vs control (2-2). See `scripts/config/google-discovery-profiles.ts` for locked strategies and anchors.

```bash
# Full experiment on both tiles
npm run test:google-discovery buenos-aires -- --both-tiles --json

# Single strategy on problem tile
npm run test:google-discovery buenos-aires 24 -- --strategy=minimal --json

# Chicama acceptance test (minimal+neighborhood, reports if Chicama appears)
npm run test:google-discovery buenos-aires 24 -- --chicama-debug
```

Output: raw_count, main_gate_count, relaxed_gate_count, anchors_present, api_calls. JSON written to `scripts/test-results/discovery-{timestamp}.json`. Success criteria: ≥6–8 cafes passing main gate in problem tile, including anchors (Crisol Villa Urquiza, Chicama, etc.). Converge on one strategy for cafes before changing ingest.

**Verification checklist (post-ingest):**

1. `npm run ingest:places:typed -- buenos-aires --force --incremental`
2. `npx tsx scripts/fetch-venue-photos.ts`
3. `npm run fetch:venue-tips buenos-aires`
4. `npm run compute:scores buenos-aires`
5. Confirm coverage: `SELECT COUNT(*) FROM highlights h JOIN venues v ON h.venue_id = v.id WHERE v.neighborhood ILIKE '%Villa Urquiza%' AND h.category = 'cafe'` — expect ≥10.
6. `npm run enrich:venues:ai buenos-aires` then `npm run enrich:venues:ai:web buenos-aires` — Phase 2, after coverage confirmed
