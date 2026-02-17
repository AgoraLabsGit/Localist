# Localist - Project Overview

*AI-assisted social life planner for Buenos Aires (expanding to other cities later)*

**Core idea:** Tell me what to do this week without me having to search.

## Status

MVP in progress. See `docs/MVP.md` and `docs/TODO.md`.

## Quick Reference

- **Stack:** Next.js + TypeScript + Tailwind, Supabase (Postgres + Auth), Google Places API, Vercel
- **Data:** Google Places → **AI enrichment** → Supabase. Our differentiator: use Google as input, store only AI-generated `short_description` + `vibe_tags`. MVP starts with templates; AI is Phase 2 upgrade. See `docs/data_pipeline.md`.
- **Model:** Freemium ($5/mo premium), affiliate commissions, venue promotions later
- **MVP scope:** BA only, highlights feed, filters, save/rate. Events + digest deferred.

## Mobile App Strategy

**Goal:** Design and code for eventual native mobile app without a full rewrite.

### Approach: Capacitor (recommended for MVP path)

1. **PWA-first** — Ship as responsive PWA (current setup). Add `manifest.json`, service worker.
2. **Capacitor wrap** — When ready, add `@capacitor/core` and wrap the existing Next.js build in a native shell. One codebase, deploy to iOS/Android app stores.
3. **Supabase** — Already backend-agnostic; works identically on web and native.
4. **Styling** — Tailwind is web-only. If Capacitor isn’t enough and you later need React Native:
   - Extract shared logic (types, API helpers, business rules) into `packages/shared`
   - Use **NativeWind** (Tailwind for React Native) so styling patterns transfer.

### Design principles

- Keep **data fetching and business logic** in server actions / API routes or shared modules — no UI coupling.
- Keep **types** in `src/types/` — reusable by any client.
- Prefer **responsive/mobile-first layouts** (`max-w-lg`, touch targets) — already in place.
- Avoid Next.js-specific patterns in shared code (e.g. keep Supabase client usage generic).

### Future: React Native (if Capacitor limits hit)

- Monorepo: `apps/web` (Next.js), `apps/mobile` (Expo), `packages/shared` (types, API, utils).
- NativeWind for Tailwind-like styling in RN.
- Same Supabase project; duplicate only UI components.

### Mobile Prep — Do Now (low effort)

- [ ] Add `manifest.json` for PWA install (name, icons, theme_color). Next.js can generate via `manifest` in `next.config`.
- [ ] Layout already mobile-first (`max-w-lg`, touch-friendly). No changes needed.
- [ ] Supabase + API routes work identically from web and Capacitor. No prep needed.
