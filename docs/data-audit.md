# Localist Data Audit — Sources, Storage, Display

Use this to verify each field is ingested and displayed correctly.

**For a full API & ingestion audit** (duplicates, multi-category, photos, Google vs Foursquare), see [api-ingestion-audit.md](api-ingestion-audit.md).

---

## 1. Data Sources Summary

| Source | Purpose | What we fetch |
|--------|---------|---------------|
| **Google Places (Text Search)** | Discovery | place_id, name, lat/lng, formatted_address, rating (filter only) |
| **Google Geocoding** | Neighborhood | address_components → sublocality/neighborhood |
| **Foursquare (Search)** | Match places | fsq_place_id (to link our place to Foursquare; new Places API) |
| **Foursquare (Place Details)** | Rich data | address, hours, phone, website, rating |

---

## 2. Field-by-Field Audit

### Venues table (one row per physical place)

| Field | Source | Ingest logic | Display |
|-------|--------|--------------|---------|
| `google_place_id` | Google Text Search | From `places.id` | Used for "Open in Google Maps" |
| `name` | Google Text Search | From `places.displayName.text` | Card title, place detail |
| `city` | Hardcoded | Always "Buenos Aires" | — |
| `neighborhood` | Google Geocoding → Foursquare fallback | `resolveNeighborhoodFromCoords()`; if "Buenos Aires", try `guessNeighborhood(fsq.address)` | **Card: `highlight.neighborhood`** |
| `latitude`, `longitude` | Google Text Search | From `places.location` | Apple Maps link |
| `foursquare_id` | Foursquare Search | From matched place `fsq_place_id` (Places API) | — |
| `address` | Foursquare Place Details | `location.formatted_address` or `[address, locality, region].join()` | Place detail |
| `opening_hours` | Foursquare Place Details | `hours.display` (string→array) or `hours.regular` mapped to strings | Place detail |
| `phone` | Foursquare Place Details | `tel` | Place detail |
| `website_url` | Foursquare Place Details | `website` | Place detail |
| `rating` | Foursquare Place Details | `rating` | Card, place detail |
| `rating_count` | Foursquare Place Details | Always null (FSQ doesn't expose in basic) | Card, place detail |

### Highlights table (one row per place×category — same place can have multiple)

| Field | Source | Ingest logic | Display |
|-------|--------|--------------|---------|
| `title` | Google | Same as venue name | Card, place detail |
| `short_description` | **Our template** | `"{name} — a top-rated {category} in {neighborhood}, Buenos Aires."` | Card, place detail |
| `category` | **Our config** | From which search query returned it (e.g. "rooftop" if from "best rooftop bar" query) | Card badge, filters |
| `venue_id` | — | Links to venues | — |
| `neighborhood` | Same as venue | Copied from venue at ingest | **Card location line** |
| `url` | Foursquare | From `website` | Place detail "Visit website" |
| `vibe_tags` | Not populated | Always `[]` (Phase 2 AI) | Card shows none |
| `avg_expected_price` | Not populated | Always null | Card shows no $ |

---

## 3. Backroom Bar Example

**Why it appears as Rooftop:**
- We run two separate searches: "best cocktail bar" → `cocktail_bar`, "best rooftop bar" → `rooftop`
- Backroom Bar can be returned by both → we create 2 highlights (same venue, different category)
- Filter "Rooftop" shows the rooftop highlight; filter "Cocktail bar" shows the cocktail one

**Why you might not see hours:**
1. Foursquare didn't return hours for that venue
2. We didn't match Backroom Bar in Foursquare (name/coords mismatch) → `fsq` is null → no hours stored
3. Foursquare returns hours in a format we don't parse (e.g. `hours.display` is object)

**Why you might not see neighborhood:**
1. Google Geocoding returned "Buenos Aires" (no barrio in components)
2. Foursquare address didn't contain a known barrio name (fallback didn't help)
3. Data was ingested before we added the Foursquare address fallback → re-run ingest to refresh

---

## 4. Descriptions

**All descriptions are from our template:**
```
"{name} — a top-rated {category} in {neighborhood}, Buenos Aires."
```
- `name` = real (Google)
- `category` = real (from our search query)
- `neighborhood` = real (Geocoding or Foursquare address fallback)
- The wording "a top-rated … in …, Buenos Aires" is fixed. We do **not** use Google or Foursquare editorial text (compliance).

---

## 5. Verification Checklist

For any place (e.g. Backroom Bar):

- [ ] **Category** — Matches filter? Check `highlights.category` in DB.
- [ ] **Neighborhood** — Card shows it? Check `highlights.neighborhood` and `venues.neighborhood`.
- [ ] **Hours** — Place detail shows them? Check `venues.opening_hours` (JSONB).
- [ ] **Address** — Place detail? Check `venues.address`.
- [ ] **Rating** — Card and detail? Check `venues.rating`.
- [ ] **Description** — Matches template with real name/category/neighborhood?

---

## 6. Common Issues

| Symptom | Likely cause |
|---------|--------------|
| No hours | Foursquare no match, or hours in unsupported format |
| No neighborhood / "Buenos Aires" | Geocoding + Foursquare address had no barrio; re-ingest after fallback fix |
| Same place in 2 categories | Expected — different search queries, same venue |
| No rating | Foursquare no match or no rating in FSQ |

---

## 7. Quick DB Check (Supabase SQL Editor)

```sql
-- Backroom Bar: find venue + highlights
SELECT v.id, v.name, v.neighborhood, v.address, v.opening_hours, v.rating, v.foursquare_id
FROM venues v
WHERE v.name ILIKE '%backroom%';

SELECT h.id, h.title, h.category, h.neighborhood, h.short_description
FROM highlights h
JOIN venues v ON v.id = h.venue_id
WHERE v.name ILIKE '%backroom%';
```

Interpret:
- **foursquare_id null** → No FSQ match → no address, hours, phone, website, rating from Foursquare
- **opening_hours null** → Foursquare had no hours, or we didn't match
- **neighborhood = 'Buenos Aires'** → Geocoding + address fallback had no barrio

---

## 8. Possible Future Improvements

| Issue | Idea |
|-------|------|
| Neighborhood gaps | Use Foursquare `location.neighborhood` (array) when Geocoding fails |
| No hours | Foursquare v3 may omit `hours`; many venues simply don't have data |
| Day mapping | FSQ `hours.regular[].day`: 1=Mon…7=Sun; verify our `days[]` index mapping |
