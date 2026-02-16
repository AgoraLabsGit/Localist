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

## Data Pipeline
1. Google Places Text Search → discover top places by category + city
2. Store `place_id` + our metadata (category, neighborhood, city)
3. AI generates `short_description` and `vibe_tags` (not cached Google text)
4. On display: fetch fresh details from Google via `place_id`

## Multi-City Path
- Same ingestion script, different city coordinates
- City selector in UI (BA default, more cities added by config)
- Each highlight tagged with `city`

## Tech Stack
Next.js 14 + TypeScript + Tailwind + shadcn/ui → Vercel
Supabase (Postgres + Auth)
Google Places API (New)

## Success Criteria
- 50+ quality highlights per city
- < 3 second page load
- Users can browse, save, and return to find their saves
- Clean enough to show to real users for feedback

---

*This replaces the original MVP scope from the project overview.*
