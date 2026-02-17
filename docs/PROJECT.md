# Localist — Project Overview

*AI-assisted social life planner for Buenos Aires, scaling to other cities.*

**Core idea:** Tell me what to do this week without me having to search.

---

## Stack

- **Frontend:** Next.js 14+ (App Router), TypeScript, Tailwind, shadcn/ui
- **Backend:** Supabase (Postgres, Auth)
- **APIs:** Google Places (discovery), Foursquare (details)
- **Deploy:** Vercel

---

## Architecture (DB-First / Hybrid)

| Layer | Source | When |
|-------|--------|------|
| Feed / filters | Supabase | Always |
| Place detail (address, hours, rating) | Foursquare (in DB) | At ingest |
| Discovery | Google Text Search | Batch ingestion only |

**We store:** `place_id`, name, city, neighborhood, category, Foursquare data. **We do not store:** Google ratings/address/hours. Google = discovery gate only; Foursquare = durable source.

---

## MVP Scope (Shipped)

- Highlights feed with category + neighborhood filters
- Place detail modal (address, hours, rating, photos)
- Save to list (auth required)
- Auth: email/password via Supabase
- Concierge: personalized feed from user preferences
- Admin: cities, neighborhoods, AI city onboarding

---

## Data Flow

1. **Ingest** — Google Text Search → filter → Foursquare match + details → upsert `venues` + `highlights`
2. **Feed** — 100% Supabase. No API calls for browse/filter.
3. **Detail view** — Reads from DB. Foursquare attribution when showing their data.

---

## Mobile Strategy

- **PWA-first** — Add `manifest.json`, service worker.
- **Capacitor** — When ready, wrap Next.js in native shell.
- Keep data/business logic in server actions; types in `src/types/`; mobile-first layouts.
