# Data Model — Venues, Highlights, Cities

Single source of truth for the venue/highlight split and city/neighborhood architecture.

---

## 1. Venues vs Highlights — Should They Be Combined?

### Current model

| Table | Purpose | Granularity |
|-------|---------|-------------|
| **venues** | Physical place (one row per place) | 1 : 1 with a real-world location |
| **highlights** | Curation entry: "this place, featured as X category" | 1 per (venue, category) |

**Relationship:** 1 venue → N highlights. Unique key: `(venue_id, category)`.

**Venue** holds shared facts: name, address, lat/lng, hours, phone, rating, FSQ/Google IDs, `quality_score`.

**Highlight** holds presentation/slot-specific data: `title`, `short_description`, `category`, `vibe_tags`, `avg_expected_price`, `concierge_rationale`.

### Why the split exists

- **Multi-category places:** El Ateneo can be featured as both "bookstore" and "cafe". Different categories → different highlights.
- **Per-category presentation:** `short_description`, `vibe_tags`, `avg_expected_price` can differ by context (e.g. "Historic bookstore" vs "Café inside a theater").
- **Feed shape:** Highlights feed is category-centric. Filters work on highlights. Concierge slots target category groups.

### Recommendation: **Keep them separate**

**Reasons:**

1. **Multi-category is real** — Places that serve coffee + meals, or bars + live music, deserve multiple curated entries.
2. **Concierge slots** — "Tonight’s dinner" vs "Sunday cafe" naturally map to different category groups; highlight = slot entry.
3. **Merge cost** — Migrating would require collapsing N highlights into one row with `categories[]`, losing per-category descriptions and vibes.
4. **Denormalization is manageable** — `city`, `neighborhood` on both tables is redundant but simplifies queries. Could be reduced later via views or always-join.

**When merge might make sense:** If you find that &gt;95% of venues have exactly one highlight and you never need per-category descriptions. Today that’s not the case.

### Improvements to current model

1. **Treat venue as canonical** — For address, hours, coordinates, always read from `venues`. Highlights inherit through join.
2. **Reduce denormalization where it hurts** — `highlights.neighborhood` could be dropped in favor of `venues.neighborhood` if all highlight queries join venue. (Deferred: requires query audit.)
3. **Document in code** — Add a short comment above the schema: "Venue = place; Highlight = place-in-category. 1 venue → N highlights."

---

## 2. Cities & Neighborhoods — Database as Source of Truth

### Current state

You already have a DB-driven city/neighborhood layer:

| Table | Purpose |
|-------|---------|
| `cities` | slug, name, center, radius, grid params, GeoJSON config |
| `city_neighborhoods` | city_id, name, slug, geom (PostGIS), optional description |
| `city_categories` | Categories per city (discovery, taxonomy) |
| `city_neighborhood_queries` | Neighborhood-specific search queries |

Ingestion and app logic use these. **The database is the source of truth for cities and neighborhoods.**

### Gaps and hardcoding

1. **`NEARBY_NEIGHBORHOODS`** — Hardcoded in `src/lib/concierge.ts`. Used for "Near me" scoring and `getHomeAndAdjacentNeighborhoods()`. Should come from DB.
2. **Filter neighborhoods** — `filter-sheet.tsx` has a fallback list; when `neighborhoods` prop is passed from DB it’s correct, but the default is hardcoded.
3. **Default city "Buenos Aires"** — Scattered string fallbacks. Prefer `getDefaultCityNameFromDb()` everywhere.

### Recommended improvements

1. **Adjacent neighborhoods in DB** — Add `city_neighborhood_adjacencies` or `adjacent_neighborhood_ids` (JSONB on `city_neighborhoods`) so Concierge and filters read "nearby" from DB. Sync from GeoJSON/city config at seed or sync.
2. **Single neighborhoods loader** — API or lib that returns neighborhoods for a city (for filters, Concierge, onboarding). All consumers use same source.
3. **Remove `NEARBY_NEIGHBORHOODS`** — Once adjacencies are in DB, delete the hardcoded map. Concierge and filters call the loader.

### Schema addition (adjacent neighborhoods)

```sql
-- Option A: JSONB on city_neighborhoods
ALTER TABLE city_neighborhoods ADD COLUMN IF NOT EXISTS adjacent_neighborhood_ids UUID[];

-- Option B: Junction table (normalized)
CREATE TABLE city_neighborhood_adjacencies (
  neighborhood_id UUID REFERENCES city_neighborhoods(id),
  adjacent_id UUID REFERENCES city_neighborhoods(id),
  PRIMARY KEY (neighborhood_id, adjacent_id)
);
```

Option A is simpler; Option B is more flexible for future weights or metadata.

---

## 3. Neighborhood Adjacency & "Near Me"

**How does the app know Palermo is near Colegiales?**

Today: a hardcoded map `NEARBY_NEIGHBORHOODS` in `src/lib/concierge.ts` — manually maintained for Buenos Aires, used for Concierge scoring and "Near my neighborhood" filters.

Future: GeoJSON is synced into `city_neighborhoods.geom` (PostGIS). Adjacency can be computed from polygons (`ST_Touches`, `ST_DWithin`) and stored in `city_neighborhood_adjacencies` or `adjacent_neighborhood_ids`. Concierge and filters would query the DB instead of the hardcoded map.

---

## 4. Quick Reference

| Concept | Source | Notes |
|--------|--------|-------|
| Physical place | `venues` | One row per place; address, hours, coordinates |
| Place-in-category | `highlights` | One per (venue, category); description, vibe, price |
| City config | `cities` | Center, radius, grid, GeoJSON |
| Neighborhoods | `city_neighborhoods` | Names, polygons, (future) adjacencies |
| Categories | `city_categories` | Discovery + taxonomy |

---

## 5. Clarifying Questions

Before implementing adjacencies and removing hardcoding:

1. **Adjacency source** — Do you have GeoJSON or another source that defines "neighborhood X is adjacent to Y"? Or should we derive from polygon touch/overlap (PostGIS `ST_Touches`)?
2. **Multi-city timeline** — Is BA-only for now? If so, hardcoded BA adjacencies in a seed script are acceptable short-term; DB schema can stay city-agnostic.
3. **Venue–highlight cleanup** — Any plans to backfill `venue_id` for highlights that might be null? Migration 007 changed to `venue_id,category` unique; old data may have gaps.
4. **`avg_expected_price` location** — Currently on `highlights`. Should it move to `venues` (one price per place) or stay per-category (coffee vs dinner)?
