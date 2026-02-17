# Roadmap & Tasks

---

## Phase 1 — Shipped

- Highlights feed, place detail, save to list, auth
- Foursquare-sourced data (address, hours, rating, photos)
- Admin, AI city onboarding
- Ingestion pipeline (two-lane, caps, `has_fsq_data`/`is_hidden_gem`)

---

## Phase 2 — Next

### Track A: Pipeline & AI

1. ~~**Enforce maxCount in neighborhood loop**~~ — Done
2. ~~**Implement quality_score**~~ — Script exists; feed orders by score
3. **Admin pipeline settings** — `admin_settings` table; max Foursquare/Google/AI calls configurable from Settings (not .env)
4. **AI enrichment** — `short_description` + `vibe_tags`; backfill missing highlights
5. **Ops** — Coverage report, cost guardrails
6. **Broaden discovery** — Relax "best X" dependency

### Track B: UI/UX

1. Search bar on main pages
2. Place detail scroll on mobile (pop-up/drawer)
3. Saved tab: category/neighborhood filters
4. PWA: `manifest.json`, icons, install test

### Deferred

- Foursquare Tips (detail view; see `CONCIERGE.md`)
- Events table

---

## Database Model

| Scope | Tables |
|-------|--------|
| Universal | `users`, `user_preferences` |
| City config | `cities`, `city_neighborhoods`, `city_categories`, `city_neighborhood_queries` |
| City data | `venues`, `highlights` |
| User | `saved_items`, `ratings` |

---

## Quick Commands

```bash
npm run ingest:places        # Ingest (BA default)
npx tsx scripts/seed-cities.ts
npx supabase db push         # Migrations
```

---

## Deployment

### Supabase Auth

1. **URL Configuration** — Site URL, redirects: `/auth/callback`, `/auth/reset-password`
2. **Confirm email** — Off for MVP

### Env Vars (Vercel)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_PLACES_API_KEY`, `FOURSQUARE_API_KEY`

### Troubleshooting

| Problem | Fix |
|---------|-----|
| User in Auth but not `public.users` | Run users backfill (migration) |
| Save 401 | Check RLS on `saved_items` |
| `db push` fails | `supabase link --project-ref YOUR_REF` first |
