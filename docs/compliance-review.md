# Google Places Compliance Review

*Cross-reference of `google-places-compliance.md`, `data_pipeline.md`, and `architecture-api-db.md` against the current implementation.*

**Review date:** 2026-02-16

---

## Summary

| Area | Status | Notes |
|------|--------|-------|
| Place ID storage | ✅ Compliant | Stored indefinitely (explicitly allowed) |
| short_description | ✅ Compliant | Our template, not Google editorial_summary |
| Places API (New) + field masks | ✅ Compliant | Ingest uses minimal fields (discovery only) |
| Place detail: no Google API calls | ✅ Compliant | Data from our DB (Foursquare-sourced) |
| Open in Google Maps | ✅ Compliant | Uses place_id URL (no stored Google data) |
| Feed & detail: address, hours, rating | ✅ Compliant | From Foursquare, stored in our DB |
| Venues schema | ✅ Compliant | No google_rating/address/hours; Foursquare data only |
| Ingest script | ✅ Compliant | Google for discovery (4.5+ filter); Foursquare for rich data |

---

## Compliant Items

### 1. Place ID and our own content
- **Requirement:** Store `place_id` indefinitely; store only our metadata and AI/template output.
- **Implementation:** Ingest stores `place_id` (as `google_place_id` in venues), `short_description` from our template, `category` from our config. ✅

### 2. short_description
- **Requirement:** Do not cache Google editorial_summary; use our own text.
- **Implementation:** Ingest uses template `"{name} — a top-rated {category} in {neighborhood}, Buenos Aires."` Never stores `editorial_summary`. ✅

### 3. Places API (New) with field masks
- **Requirement:** Use Places API (New), not legacy; use field masks.
- **Implementation:** Ingest uses `places:searchText`; detail API uses `places/{id}`. Both send `X-Goog-FieldMask`. ✅

### 4. Detail view: fetch on demand
- **Requirement:** Fetch Place Details when displaying; don't pre-fetch and stockpile.
- **Implementation:** `GET /api/places/[id]` fetches from Google on each request. ✅

### 5. Detail view: attribution
- **Requirement:** Show Google Maps logo or "Google Maps" when displaying their data.
- **Implementation:** PlaceDetail shows "Place data from Google Maps" link. ✅

### 6. Feed: general attribution
- **Requirement:** Attribution on screens displaying place data.
- **Implementation:** Home page footer has "Powered by Google Maps". ⚠️ Cards show rating (Google data) but attribution is only in footer; may be acceptable if it's clear the whole page uses Google data.

---

## Non-Compliant Items

### 1. Venues table stores Google data

**From `data_pipeline.md` (line 113):**
> We do **not** store: Google ratings, reviews, photos, addresses, hours, or editorial text.

**From `architecture-api-db.md` (line 151):**
> **Schema** — ... No Google ratings/hours/address in DB.

**Current `venues` schema stores:**
| Column | Source | Compliant? |
|--------|--------|------------|
| address | Google `formatted_address` | ❌ |
| google_rating | Google `rating` | ❌ |
| google_rating_count | Google `user_ratings_total` | ❌ |
| opening_hours | Google `currentOpeningHours` | ❌ |
| phone | Google `nationalPhoneNumber` | ❌ (should fetch on display) |
| website_url | Google `websiteUri` | ❌ (highlights.url also stores it) |

**From `google-places-compliance.md` (line 16):**
> ❌ **Cache/store Google data** (ratings, reviews, photos, addresses, hours) **beyond temporary operational caching**

Indefinite storage in Postgres is not "temporary operational caching."

---

### 2. Ingest script writes Google data to venues

**From `scripts/ingest-places.ts` (upsertVenue):**
- `address: place.formatted_address ?? place.vicinity` — stores Google address
- `google_rating: place.rating ?? null` — stores Google rating
- `google_rating_count: place.user_ratings_total ?? null` — stores Google count
- `opening_hours: place.opening_hours?.weekday_text ?? null` — stores Google hours
- `phone`, `website_url` — stores Google data

All of this violates the pipeline docs.

---

### 3. Feed cards display cached Google data

**From `highlight-card.tsx`:**
- Displays `venue?.google_rating` and `venue?.google_rating_count`
- This data is read from our DB (cached from Google)
- Per compliance: we should either not show it, or fetch it on demand and display with attribution

---

## Recommendations

### Option A: Full compliance (remove cached Google data)

1. **Schema:** Add a migration to remove (or stop using) `address`, `google_rating`, `google_rating_count`, `opening_hours`, `phone`, `website_url` from `venues`. Keep `google_place_id`, `name`, `city`, `neighborhood`, `latitude`, `longitude`.
2. **Ingest:** Stop writing those fields. Use address only transiently for `guessNeighborhood` / reverse geocoding.
3. **Feed cards:** Remove rating and review count from cards (or optionally fetch per card via API — expensive).
4. **Detail view:** Already fetches from Google; no change. Attribution already present.

### Option B: Minimal change (clarify compliance boundary)

If you want to keep rating on cards for UX:

1. Add a note in the compliance doc that rating/review count on feed cards is "operational cache" with weekly refresh via re-ingestion.
2. Ensure the feed view has clear attribution (e.g. "Data from Google" near the rating).
3. Plan a later migration to Option A or to fetch-on-demand with a short-TTL cache.

### Optional: Remove `editorialSummary` from ingest field mask

We request `editorialSummary` in Text Search but never use or store it. Removing it reduces cost (Pro SKU) and avoids requesting data we don't need.

---

## Checklist Update

Update `google-places-compliance.md` checklist:

- [x] Ingest stores `place_id` + our metadata (category, neighborhood, city)
- [x] `short_description` = our own text, NOT Google editorial_summary
- [x] Places API (New) with field masks
- [x] Google Maps attribution on place detail modal
- [x] Feed footer: "Powered by Google Maps"
- [ ] **Remediate:** Stop storing Google rating, address, hours in venues (schema + ingest)
- [ ] **Remediate:** Feed cards either drop rating or fetch on demand
- [ ] Add 24h cache for Place Details (cost control; see TODO.md)
