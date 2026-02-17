# Data Pipeline & Ingestion

*Google = discovery. Foursquare = durable data. Our DB = feed.*

---

## Flow

```
Google Text Search → filter (rating + reviews) → Foursquare match + details → venues + highlights
```

- **Google:** `place_id`, name, lat/lng. Rating + `userRatingCount` used only for filtering; never stored.
- **Foursquare:** address, hours, phone, website, rating, rating_count, description. Stored in `venues` / `highlights`.

---

## Two-Lane Discovery

| Lane | Min reviews | Min rating | Cap |
|------|-------------|------------|-----|
| Mainstream | e.g. 30 | 4.5 | up to `max_count` |
| Hidden gem | e.g. 5 | 4.6 | ≤30% of category slots |

Per-category: `target_count`, `max_count`, `min_reviews_main`, `min_reviews_gem` in `city_categories`. Global: `max_total_per_city` on `cities`.

---

## Scripts

| Script | Purpose |
|--------|---------|
| `ingest-places.ts` | Google → Foursquare → upsert. Use `--incremental` to skip FSQ for existing venues. |
| `fetch-venue-photos.ts` | Foursquare photos. Default: venues missing photos only. |
| `update-descriptions-from-foursquare.ts` | Backfill `short_description` from FSQ |
| `seed-cities.ts` | Populate cities, categories, neighborhoods |
| `onboard-city-ai.ts` | AI city config generation |
| `compute-quality-scores.ts` | *(Planned)* FSQ-only scoring; order feeds by score |

---

## Key Fields

**Venues:** `google_place_id`, `foursquare_id`, `name`, `address`, `opening_hours`, `rating`, `rating_count`, `quality_score`, `has_fsq_data`, `is_hidden_gem`

**Highlights:** `venue_id`, `category`, `short_description`, `vibe_tags`, `avg_expected_price`

---

## Safeguards (API cost control)

- **Admin Settings** — `/admin/settings`: max Foursquare/Google calls per run. DB-backed; default 200 for FSQ.
- **Env override** — `MAX_FOURSQUARE_CALLS` in .env.local overrides if DB value empty.
- **--incremental** — Skips Foursquare/Geocoding for venues that already have `foursquare_id`.
- **maxCount** — Per-category cap enforced in city-wide and neighborhood loops.

---

## Vibe Tags (controlled vocabulary)

`solo_friendly`, `group_friendly`, `date_night`, `lively`, `touristy`, `local`, `hidden_gem`, `local_favorite`. AI enrichment (Phase 2) will populate; filter-sheet and highlight-card support them.
