# APIs: Setup & Compliance

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
