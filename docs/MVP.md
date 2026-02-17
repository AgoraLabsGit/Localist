# Localist MVP — "Best of [City]"

## Vision
A curated city guide that answers: "What are the best places in [city] by category?"
Starting with Buenos Aires. Scaling to any city.

## Target Users (Launch)
- Digital nomads in BA
- Expats / long-term travelers
- Tourists wanting local-quality recommendations

## MVP Features (ship this)

### 1. Highlights Feed
- Browse top-rated places by **category** (parrilla, bar, cafe, museum, milonga, etc.)
- Filter by **neighborhood**
- Each card: name, category, neighborhood, price level, short description, Google rating
- Google Maps attribution on all screens

### 2. Place Detail
- Modal/drawer with full info
- Address, hours, rating, description
- External link (Google Maps / website)
- Save button

### 3. Save to List
- Tap heart to bookmark any place
- "Saved" tab shows all bookmarked places
- Persists across sessions (requires auth)

### 4. Basic Auth
- Email/password signup via Supabase Auth
- No onboarding preferences flow (everyone sees same BA content)
- Settings page: email, language, logout

## What's Deferred
- ❌ Events (Phase 2)
- ❌ Ratings/reviews by users
- ❌ Weekly email digest
- ❌ Premium/Stripe payments
- ❌ Advanced filters (vibe, time of day)
- ❌ Onboarding preferences
- ❌ Map view
- ❌ User-generated activities

## Data Pipeline (Our Differentiator)

**Special sauce:** Google data as **input** → AI generates **our content** → we store **only our output** in Supabase.

1. **Text Search** (Google) → discover places. Extract `place_id`, name, address, rating.
2. **Upsert** → `venues` + `highlights` in Supabase (`place_id`, name, category, neighborhood, city).
3. **Enrichment** — *Phase 1 (MVP):* Templates only (`"{name} — a top-rated {category} in {neighborhood}."`). *Phase 2:* AI uses Google context as transient input → produces `short_description`, `vibe_tags` → we store only AI output.
4. **Feed** → 100% Supabase. No Google calls for browse/filter.
5. **Detail view** → Fetch Place Details on demand (24h cache). Show attribution.

See `docs/data_pipeline.md` for full pipeline, costs, and compliance.

## Multi-City Path
- Same ingestion script, different city coordinates
- City selector in UI (BA default, more cities added by config)
- Each highlight tagged with `city`

## Tech Stack
Next.js 14 + TypeScript + Tailwind → Vercel
Supabase (Postgres + Auth)
Google Places API (New)
LLM (Claude / GPT-4o-mini) for AI enrichment when we add Phase 2

## Success Criteria
- 50+ quality highlights per city
- < 3 second page load
- Users can browse, save, and return to find their saves
- Clean enough to show to real users for feedback

---

*This replaces the original MVP scope from the project overview.*
