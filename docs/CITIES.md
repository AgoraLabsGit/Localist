# Cities & Categories

City config is in the database. Admin UI at `/admin`; AI onboarding at `/admin/onboard`.

---

## Schema

| Table | Purpose |
|-------|---------|
| `cities` | center, radius, target_venues |
| `city_neighborhoods` | Neighborhoods for filters & queries |
| `city_categories` | slug, search_query, min_rating, target_count, max_count, etc. |
| `city_neighborhood_queries` | Neighborhood-targeted discovery |

---

## New Deployment

1. `npx supabase db push`
2. Promote admin: `UPDATE users SET role = 'admin' WHERE email = 'you@email.com';`
3. `npx tsx scripts/seed-cities.ts`
4. `npx tsx scripts/ingest-places.ts buenos-aires`

---

## Add City

**Option A: AI** — `/admin/onboard` → "Add with AI" → city name → review → save.

**Option B: SQL** — Insert into `cities`, `city_neighborhoods`, `city_categories`, `city_neighborhood_queries`. See migrations 008, 009.

---

## AI City Onboarding

`scripts/onboard-city-ai.ts "Lisbon"` — Generates suggested config (center, neighborhoods, categories, queries). Human reviews before save. Env: `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`.
