# Localist: Mobile App Conversion Audit

For execution order and phasing, see [ROADMAP](ROADMAP.md) Phase 5.

## Executive summary

The app is already architected for **PWA-first** with a planned **Capacitor** native wrap (per [PROJECT](PROJECT.md)). The UI is largely mobile-ready with responsive layouts and touch-friendly patterns already in place. Several gaps remain before a polished PWA install or native packaging.

---

## 1. Strategy

PWA-first (manifest, service worker); Capacitor wrap when ready. See [PROJECT](PROJECT.md). **Current state:** PWA manifest and service worker not yet implemented; Capacitor referenced only in code comments.

---

## 2. PWA readiness

| Area | Status | Notes |
|------|--------|-------|
| `manifest.json` | ❌ Missing | ROADMAP Track B: "PWA: manifest.json, icons, install test" |
| Service worker | ❌ Missing | No offline or install support |
| Icons | ❓ Unknown | No `public/` icons located |
| Viewport / theme | ✅ Done | `layout.tsx` has `device-width`, `themeColor` |
| Offline support | ❌ Missing | No caching or offline fallback |

**Recommendation:** Add `manifest.json` with name, short_name, start_url, icons (192, 512), display: standalone. Add icons. Add service worker (e.g. `next-pwa` or workbox). Consider offline fallback for main routes.

---

## 3. Layout & responsive design

**Strengths:**
- Tailwind `sm:` breakpoints used consistently (e.g. `place-detail.tsx`: drawer on small screens, centered modal on desktop)
- Mobile-friendly sizing (`text-sm`, `px-4`, `py-2.5`)
- Touch targets: `touch-manipulation` on interactive elements
- Design tokens in `globals.css` labeled "mobile friendly"
- Place detail: bottom-sheet pattern on mobile (85vh, drag handle)
- Filter sheet: side panel (drawer from right) — suitable for phones
- Font stack includes SF Pro Text for iOS

**Gaps:**
| Item | Location | Issue |
|------|----------|-------|
| Safe area insets | All fixed/absolute layouts | No `env(safe-area-inset-*)` for notch/home indicator |
| Sticky header offset | `place-detail.tsx` | May overlap status bar when wrapped |
| Filter sheet width | `filter-sheet.tsx` | `w-72 sm:w-80` — adequate but could adapt to very narrow screens |
| Fixed z-index stacking | Multiple components | `z-40`, `z-50` used; review layering |

---

## 4. Touch & interaction

**Strengths:**
- `touch-manipulation` on buttons and interactive elements
- Action targets: cards (full tap), icon buttons 32–40px
- `HighlightCard` uses `active:scale-[0.99]` for touch feedback
- Web Share API used in `place-detail.tsx` when available

**Gaps:**
- Some icon buttons (e.g. heart, check) are ~32px; Apple HIG recommends 44×44pt minimum for primary actions
- No pull-down-to-close on place detail drawer
- No swipe gestures (e.g. swipe between tabs)
- No haptic feedback

---

## 5. Native / device APIs

| API | Status | Location | Notes |
|-----|--------|----------|-------|
| Geolocation | ✅ Used | `highlights-feed.tsx`, `onboarding-flow.tsx` | "Near me" filter, city detection |
| Web Share | ✅ Used | `place-detail.tsx` | Share button |
| Clipboard | ✅ Used | `place-detail.tsx` | Copy address |
| External links | ⚠️ Web only | `place-detail.tsx` | `window.open()`; Capacitor `Browser.open` noted in comments |
| Push notifications | ❌ Missing | — | Future feature for engagement |
| Camera | ❌ N/A | — | Not required for current scope |

For Capacitor: `place-detail.tsx` line 224 has a comment for `Browser.open` — that pattern should be wired when wrapping.

---

## 6. Auth & deep links

- Supabase auth callback: `/auth/callback`; redirects configured
- Password reset: `/auth/reset-password`
- Deep links: For Capacitor, will need URL scheme or universal links; ensure OAuth redirect URIs work in-app

---

## 7. Performance

- Next.js 14 (App Router)
- Lucide icons tree-shaken via `optimizePackageImports`
- Data flow: feed and filters from Supabase; no per-request API calls
- Place detail: fetches `/api/places/[id]` on open; ROADMAP mentions precomputed detail for speed

**Mobile considerations:**
- Large images: no responsive images or `srcset` seen
- Place detail photo strip: horizontal scroll — fine on mobile
- Concierge sections: client-side fetch; consider prefetch or cache

---

## 8. Architecture & Capacitor fit

- **Next.js App Router** — Compatible; Capacitor typically uses static export or proxies to deployed site
- **Supabase** — Works in WebView; auth flow needs redirect handling in native shell
- **Stripe** (subscriptions) — Payment sheet may need testing in WebView for 3DS
- No obvious `document`/`window` assumptions that would break in native wrapper

**Capacitor integration checklist:**
1. Add `@capacitor/core`, `@capacitor/cli`
2. Add platforms: `npx cap add ios` (and `android`)
3. Build: `next build` + `npx cap copy` / `sync`
4. Configure `capacitor.config.ts` (server URL for dev; `file://` or bundled for prod if using static export)
5. Replace `window.open` with `Browser.open` for maps/website links
6. Add safe area handling
7. Optional: `@capacitor/status-bar` for status bar styling
8. Set up deep links / universal links for auth and sharing

---

## 9. Content & navigation

- Tab nav: My Places | Concierge | Explore
- Onboarding: multi-step flow with back/next
- Settings: location, preferences, account, concierge preferences
- Auth: login, signup, forgot/reset password

Navigation is link-based and compatible with mobile. No bottom nav bar; tab nav at top — acceptable but consider thumb-reach on large phones.

---

## 10. Priority order

For phased execution, see [ROADMAP](ROADMAP.md) Phase 5.

### PWA foundation
1. Add `manifest.json` + icons
2. Add service worker (offline + installability)
3. Test "Add to Home Screen" on iOS and Android
4. Add safe area insets for fixed UIs

### Mobile polish
1. Increase touch targets to 44px for primary actions
2. Add pull-to-dismiss on place detail drawer (optional)
3. Add responsive images where relevant
4. Verify deep links for auth and sharing

### Capacitor (native)
1. Add Capacitor and iOS/Android projects
2. Wire `Browser.open` for external links
3. Configure auth redirect URIs for native shell
4. Test Stripe in WebView
5. Submit to stores (App Store / Play Store)

---

## Summary table

| Category | Status | Blockers |
|----------|--------|----------|
| PWA manifest/icons | ❌ Not implemented | — |
| Service worker / offline | ❌ Not implemented | — |
| Responsive layout | ✅ Mostly ready | Safe area insets |
| Touch targets | ⚠️ Good | Some < 44px |
| Device APIs | ⚠️ Partial | Geolocation, Share used |
| Capacitor readiness | ⚠️ Comment only | Needs integration |
| Auth deep links | ❓ Unknown | Needs verification in native shell |

Overall: the app is well-positioned for mobile. The main work is completing the PWA layer (manifest, SW, icons, safe areas) for installability, then optionally wrapping with Capacitor for native app stores.
