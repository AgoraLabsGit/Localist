# APIs: Setup & Compliance

---

## What we get from Google vs Foursquare

| Field | Google Text Search | Foursquare |
|-------|--------------------|------------|
| place_id, name, lat/lng | ✓ | — |
| types / primaryType | ✓ (google_types) | — |
| rating, user_ratings_total | Gating only (not stored) | ✓ (display) |
| formatted_address | ✓ (not stored when no FSQ) | ✓ |
| opening_hours, phone, website | — | ✓ |
| photos | — | ✓ (via fetch-venue-photos) |
| short_description | — | ✓ |
| avg_expected_price | — | ✓ |
| fsq_categories | — | ✓ |

**When there is no FSQ match:** address, hours, phone, website, photo_urls, short_description, avg_expected_price are null. AI batch job can fill short_description, vibe_tags, optionally avg_expected_price — see [AI-PIPELINE](AI-PIPELINE.md).

---

## Google Places

- **Discovery only** — Text Search at ingest. Rating + `userRatingCount` for filtering; never stored.
- **Store:** `place_id` only. Foursquare provides address, hours, rating for display.
- **Attribution:** "Powered by Google Maps" in footer; Maps link uses `place_id`.

**Field masks:** Use minimal fields. No editorial_summary if unused.

---

## Foursquare

- **Setup:** [foursquare.com/developers](https://foursquare.com/developers) → Create Project → **Service API Key** (not legacy).
- **Env:** `FOURSQUARE_API_KEY` in `.env.local`
- **Usage:** Place Search + Place Details at ingest. Photos via `fetch-venue-photos.ts`.

**Tips:** Fetch on place detail open (no caching allowed). See `CONCIERGE.md`.

---

## Compliance Summary

| Area | Status |
|------|--------|
| Google: place_id + our metadata only | ✅ |
| Address/hours/rating from Foursquare | ✅ |
| Google Maps attribution | ✅ |
| Field masks, Places API (New) | ✅ |
