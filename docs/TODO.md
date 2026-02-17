# Localist MVP — Todo

## Next Steps (Priority Order)

1. **Place Details cache** — Add 24h TTL (Upstash Redis) to cap Google API cost.
2. **PWA readiness** — `manifest.json`, test on devices.
3. **Production deploy** — Vercel, env vars, production redirect URLs.
4. **Phase 2: AI enrichment** — Add LLM step to ingestion. See `docs/data_pipeline.md`.

---

## Data
- [x] Run ingestion: `npm run ingest:places` (144 highlights)
- [ ] Generate Supabase types: `npm run db:types` (optional; manual types in place)

## Highlights Feed
- [x] Replace mock data with Supabase query (highlights + venue join)
- [x] Add category filter (parrilla, cafe, museum, etc.)
- [x] Add neighborhood filter
- [x] Add Google Maps attribution ("Powered by Google Maps" in footer)

## Place Detail
- [x] Modal/drawer component with full place info
- [x] Show address, hours, rating, description
- [x] Links: Google Maps, Apple Maps (iOS), website
- [x] Save button in modal
- [ ] Add 24h cache for Place Details (cost control)

## Save to List
- [x] Wire heart button → save to `saved_items`
- [x] Implement Saved tab (fetch user's saved highlights)
- [x] Handle unauthenticated: prompt sign-in when tapping Save

## Auth
- [x] Auth UI: sign up / sign in (email + password)
- [x] Forgot password / reset password flows
- [x] Settings page: email display, logout
- [x] Protect saved list: redirect to sign-in when needed

## Deployment
- [x] Supabase Auth config (redirects, URL configuration)
- [x] Migrations pushed (trigger, RLS, backfill)

## Data Pipeline (Phase 2 — AI Enrichment)
- [ ] Add AI enrichment step to ingestion (or separate job)
- [ ] Pass Google context to LLM, store only AI output (short_description, vibe_tags)
- [ ] See `docs/data_pipeline.md` for spec and costs

## Mobile App Readiness
- [ ] Add `manifest.json` for PWA install (name, icons, theme_color)
- [ ] Test responsive layout on real devices (iOS Safari, Android Chrome)
- [ ] When ready: add Capacitor, wrap Next.js build

## Polish
- [ ] Add shadcn/ui components as needed (Sheet, Button, etc.)
- [ ] Fix `.env.local.example` — remove real API key placeholder

## Notes
- **Templates (Phase 1):** Ingest uses deterministic templates. AI cost = $0. Phase 2 adds LLM.
- **Shadcn UI:** Not installed. Add when needed.
