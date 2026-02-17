# API & Data Ingestion Audit

*Comprehensive audit addressing: duplicate listings, Foursquare data completeness, Google vs Foursquare, and ingestion pipeline.*

---

## 1. Duplicate Listings (Multi-Category)

### Current Behavior

- **Schema:** One `highlight` row per `(venue_id, category)`. Upsert uses `onConflict: "venue_id,category"`.
- **Ingest:** We run 8 category-specific Google searches (e.g. "best rooftop bar", "best cocktail bar"). A place like **Alvear Roof Bar** can be returned by both → we create **2 highlights** (same venue, different category).
- **Result:** Same physical place appears twice in the feed with different category badges (Rooftop vs Cocktail Bar).

### Desired Behavior

- **One card per venue** with **multiple category tags** (e.g. "Rooftop · Cocktail Bar").
- Filtering by "Rooftop" or "Cocktail Bar" both show Alvear Roof Bar once.

### Implementation Options

| Approach | Schema Change | Ingest Change | UI Change |
|----------|---------------|---------------|-----------|
| **A) categories array on highlight** | `category TEXT` → `categories TEXT[]` | Merge categories when same venue found; single highlight per venue | Card shows multiple badges; filter checks `categories @> ARRAY[filter]` |
| **B) Junction table** | New `highlight_categories(highlight_id, category)` | Create one highlight per venue; insert multiple category rows | Similar |
| **C) Denormalized categories** | Add `categories TEXT[]` to `highlights`, keep `category` for backwards compat | Same as A | Same |

**Recommended: Option A** — Add `categories TEXT[]`, migrate existing `category` → `categories = ARRAY[category]`, update unique constraint to `(venue_id)` only, deduplicate on ingest.

---

## 2. Foursquare Data Completeness

### What We Currently Fetch

| Field | Fetched? | Stored | Display |
|-------|----------|--------|---------|
| address | ✅ | venues.address | Place detail |
| hours | ✅ | venues.opening_hours | Place detail |
| phone | ✅ | venues.phone | Place detail |
| website | ✅ | venues.website_url | Place detail, card url |
| rating | ✅ | venues.rating | Card, place detail |
| rating_count | ❌ (null) | venues.rating_count | — |

### What We're NOT Fetching (Available from Foursquare)

| Field | Endpoint/Field | Use Case |
|-------|----------------|----------|
| **photos** | `GET /places/{fsq_id}/photos` or `fields=photos` on details | Card image, detail gallery |
| **stats** (total_photos, total_ratings, total_tips) | `fields=stats` | rating_count from `total_ratings` |
| **price** | `fields=price` | $ / $$ / $$$ for card |
| **description** | `fields=description` | Rich description (compliance: check Foursquare ToS) |
| **location.neighborhood** | In location object | Better neighborhood fallback |
| **categories** | Foursquare categories | Could map to our category tags |

### Photos

- **Endpoint:** `GET https://places-api.foursquare.com/places/{fsq_place_id}/photos`
- **Params:** `limit` (default 10, max 50), `sort` (POPULAR, NEWEST), `classifications` (filter by food_or_drink, outdoor, menu, etc.)
- **URL assembly:** `prefix` + `{width}x{height}` + `suffix` (e.g. scaled 400x300)
- **Cost:** Extra API call per venue (or include in details if `fields=photos` returns inline)

**Recommendation:** Add `photos` to ingest (store 1–3 primary photo URLs in venues or a new `venue_photos` table). Display on place detail first; add to card if UI supports it. Each photo request = 1 extra Places API call.

---

## 3. Google Places vs Foursquare

### Current Flow

1. **Google Text Search** — Discovery (name, lat/lng, place_id). Filter by 4.5+ stars. No stored Google ratings.
2. **Google Geocoding** — Neighborhood from coords.
3. **Foursquare Search** — Match by name + coords to get fsq_place_id.
4. **Foursquare Place Details** — Address, hours, phone, website, rating.

### Can We Drop Google?

| Capability | Google | Foursquare |
|------------|--------|-------------|
| **Discovery** | Text Search: "best rooftop bar BA" → ranked results | Place Search: query + ll + radius. No semantic "best" ranking. |
| **Quality filter** | 4.5+ rating (transient) | Rating 0–10; can filter by min rating |
| **Coverage** | Strong globally | 100M+ POIs, 247 countries; BA coverage good (we see ~70–80% match) |
| **Rating robustness** | Google reviews (billions) | Tips, likes, check-ins; algorithm-based |
| **Compliance** | Must not store/display non-compliant fields | More permissive for address, hours, photos |

### Foursquare Rating

- **Scale:** 0–10 (we store as-is; Google was 1–5).
- **Signals:** Likes/dislikes, tips sentiment, check-ins, passive data.
- **Transparency:** Algorithm is proprietary.
- **rating_count:** We don't fetch `stats.total_ratings`; currently null. A rating of "8.1 (0)" suggests zero or very low contribution count.

### Recommendation

| Scenario | Recommendation |
|----------|----------------|
| **Keep both** | Use Google for discovery (semantic "best X" queries) + Foursquare for rich data. Current approach. |
| **Foursquare-only** | Use Foursquare Search with `query` + `sort=RATING`. Simpler, one vendor. Risk: no semantic "best rooftop bar" — you get "rooftop bar" sorted by rating. May miss places Foursquare doesn't have. |
| **Hybrid** | Try Foursquare-only for one city; compare result quality and coverage. |

**Verdict:** Keep Google for discovery for now. Foursquare ratings are algorithmic and not always backed by visible review counts; Google's 4.5+ filter taps into a larger, review-based signal. Add `stats` to Foursquare fetch to get `total_ratings` and consider minimum rating count for filtering.

---

## 4. Ingestion Pipeline Summary

### Data Flow

```
Google Text Search (8 queries)
    ↓ place_id, name, lat/lng, rating (filter 4.5+)
Google Geocoding (reverse)
    ↓ neighborhood
Foursquare Search (name + ll)
    ↓ fsq_place_id
Foursquare Place Details
    ↓ address, hours, phone, website, rating
    ↓
Supabase: venues (upsert by google_place_id), highlights (upsert by venue_id,category)
```

### Gaps & Improvements

| Gap | Fix |
|-----|-----|
| Duplicate cards (same venue, multiple categories) | Multi-category schema (see §1) |
| No photos | Add Foursquare photos fetch; store and display |
| rating_count always null | Add `fields=stats` to Foursquare details; map `total_ratings` |
| No price tier | Add `fields=price`; map to avg_expected_price or separate field |
| Some venues "Buenos Aires" only | Try Foursquare `location.neighborhood` when Geocoding fails |

### API Cost Snapshot (per city, ~120 places)

| API | Calls | Notes |
|-----|-------|-------|
| Google Text Search | 8 | One per category |
| Google Geocoding | ~120 | One per place |
| Foursquare Search | ~120 | One per place |
| Foursquare Details | ~90 | Matched places only |
| **Foursquare Photos** (if added) | ~90 | One per matched place |

---

## 5. Action Items

### Short Term

1. **Add Foursquare `stats`** — Fetch `total_ratings` for rating_count.
2. **Add Foursquare `price`** — Populate price tier for cards.
3. **Multi-category schema** — Design and implement categories array + deduplication.

### Medium Term

4. **Foursquare photos** — Fetch and store; add to place detail (and optionally cards).
5. **Foursquare `location.neighborhood`** — Use as fallback when Geocoding returns "Buenos Aires".

### Long Term / Evaluate

6. **Foursquare-only discovery** — Run experiment for one city; compare quality and coverage vs Google.
7. **Rating quality** — Consider minimum rating_count threshold for "best" filter.
