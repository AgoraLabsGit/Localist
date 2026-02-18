# Localist — Project Overview

Localist is an AI-assisted social life planner that tells you what to do this week — without you having to search. Starting in Buenos Aires and scaling to other cities, it's a PWA that curates the best places to eat, drink, explore, and go out based on who you are and how you live.

**Who it's for:** Locals who want to break routines and discover hidden gems; digital nomads who need work-friendly cafes by day and social spots by night; tourists who want a mix of must-sees and authentic local experiences.

---

## Stack

- **Frontend:** Next.js 14+ (App Router), TypeScript, Tailwind, shadcn/ui
- **Backend:** Supabase (Postgres, Auth)
- **APIs:** Google Places (discovery), Foursquare (details)
- **Deploy:** Vercel

---

## Architecture

| Layer | Source | When |
|-------|--------|------|
| Feed / filters | Supabase | Always |
| Place detail (address, hours, rating) | Foursquare (in DB) | At ingest |
| Discovery | Google Text Search | Batch ingestion only |

**DB-first:** Google = discovery gate only; Foursquare = durable source. We store `place_id`, name, city, neighborhood, category, Foursquare data. No per-request API or AI calls for feeds or place detail.

**Mobile:** PWA-first (manifest, service worker); Capacitor wrap when ready. See [MOBILE-CONVERSION-AUDIT](MOBILE-CONVERSION-AUDIT.md).

---

## MVP Scope (Shipped)

- Highlights feed with category + neighborhood filters
- Place detail modal (address, hours, rating, photos)
- Save to list (auth required)
- Auth: email/password via Supabase
- Concierge: personalized feed from user preferences
- Admin: cities, neighborhoods, AI city onboarding

---

## Next steps

- **Execution order & phases:** [ROADMAP](ROADMAP.md)
- **Ingestion & pipeline:** [DATA-PIPELINE](DATA-PIPELINE.md)
- **PWA & Capacitor readiness:** [MOBILE-CONVERSION-AUDIT](MOBILE-CONVERSION-AUDIT.md)
