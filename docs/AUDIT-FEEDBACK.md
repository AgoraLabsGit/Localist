# Audit Feedback & Task List

See also: `docs/SPATIAL-DATA.md` for how adjacency (Palermo near Colegiales) is derived.

From frontend verification of improvements (2025-02-17).

---

## 1. Neighborhoods

| # | Result | Notes |
|---|--------|-------|
| 1.1 | ✅ Passed | No duplicate neighborhoods |
| 1.2 | ⚠️ Fixed | Was: Lanú**S** Oeste, Nuñ**E**z. **Fix applied:** `toTitleCase` now uses word-based logic (capitalize first letter of each word only) to avoid mis-capping accented chars. |
| 1.3 | ✅ Passed | Filter empty neighborhoods: balance between wide net vs. avoiding residential / no-places areas. **Task:** Add configurable filter. |
| 1.4 | ✅ Passed | Villa Urquiza, Saavedra, etc. show |

---

## 2. Venues & Places

| # | Result | Notes |
|---|--------|-------|
| 2.1 | ⏳ Needs ingest | Run `npm run ingest:places:typed buenos-aires` (or incremental) |
| 2.2 | ⏳ Needs ingest | Same |
| 2.3 | ✅ Passed | 9+ for venues without FSQ |

---

## 3. City & Onboarding

| # | Result | Notes |
|---|--------|-------|
| 3.1 | ✅ Assumed OK | Cities from DB — cannot verify from UI but architecture correct |
| 3.2 | ✅ Done | **Home vs favorites split:** Onboarding now has two steps — "Where do you live?" (home_neighborhood) and "Favorite neighborhoods" (multi-select). Settings Location: separate "Home neighborhood" and "Favorite neighborhoods." Migration 029 adds `home_neighborhood`. |
| 3.3 | ⏸️ Ignored | **New Orleans:** Deferred until BA is perfected. |

---

## 4. General

| # | Result | Notes |
|---|--------|-------|
| 4.1–4.3 | ✅ Passed | |
| 4.4 | ✅ Done | Sticky filter, search bar, and headers already in place |
| 4.5 | ✅ Passed | |
| 4.6 | ✅ Fixed | **Photo mismatch** — Stricter FSQ matching: no fallback to `results[0]` when no name/token match. Added token overlap check. Run `npm run fix:venue-fsq-photos "La Baldosa Milonga"` to clear wrong FSQ data for existing venues. |

---

## Task List (by priority)

| ID | Task | Effort | Notes |
|----|------|--------|-------|
| a1 | ~~Fix toTitleCase (LanúS, NuñEz)~~ | Done | Word-based title case |
| a2 | ~~Filter neighborhoods with no places from Area filter~~ | Done | Page filters city_neighborhoods to those with highlights |
| a3 | ~~Multi-select neighborhoods (onboarding + settings)~~ | Done | Home vs favorites split; home_neighborhood + preferred_neighborhoods |
| a4 | ~~Near me / adjacent neighborhoods~~ | Done | "Near my neighborhood" filter (home + adjacent from NEARBY_NEIGHBORHOODS) |
| a5 | New Orleans | Ignored | Deferred until BA perfected (per user) |
| a6 | ~~Photo mismatch: La Baldosa~~ | Done | Run `npm run fix:venue-fsq-photos "La Baldosa"` to clear wrong FSQ data |
| a7 | ~~Sticky filter/highlight button~~ | Done | Already in place |
