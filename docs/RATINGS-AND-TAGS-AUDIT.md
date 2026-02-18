# Ratings and Tags Audit

**Date:** 2025-02-18

## Summary

The ratings and tags systems are largely working correctly. A few bugs and inconsistencies were identified and fixed.

---

## Architecture

### Ratings
- **Storage:** `user_place_state.rating` (1–5), keyed by `place_id` (references `highlights.id`)
- **APIs:** `POST /api/user-place-state` (upsert), `GET /api/user-place-context` (fetch state + tags)
- **UI:** PlaceDetail (rate after marking visited), HighlightCard (shows ★ N badge)

### Tags
- **Storage:** `user_place_tags` (user_id, place_id, tag), keyed by highlight ID
- **APIs:** `POST /api/user-tags/add`, `POST /api/user-tags/remove`, `GET /api/user-tags/distinct`
- **View:** `user_distinct_tags` for filter autocomplete (usage_count for ordering)
- **UI:** PlaceDetail (add/remove tags), FilterSheet (My Places: filter by tag)

---

## Issues Found and Fixed

### 1. **Rating not aggregated across venue highlights** ✅ FIXED

**Problem:** Venues can have multiple highlights (e.g. same place in "cafe" and "brunch"). User state is stored per highlight. `getUserStateForVenue` only looked at `primaryState?.rating`, so if the user rated a different highlight of the same venue, the rating wouldn't show on the card.

**Fix:** Aggregate rating across all `highlightIds` (same pattern as `yourPlacesFiltered`).

### 2. **PlaceDetail: tags not pre-populated from cache** ✅ FIXED

**Problem:** When opening PlaceDetail from a card, `selectedUserTags` was always `[]`, causing a brief flash of "no tags" before the fetch completed—even when we had tags in `initialTagsByPlaceId`.

**Fix:** Pre-populate `selectedUserTags` from `initialTagsByPlaceId[primary.id]` when opening. Tags are shown/edited per highlight (primary); aggregating across venue highlights would allow attempting to remove tags stored on other highlights, causing confusion.

### 3. **Tags cache not updated after add/remove in PlaceDetail** ✅ FIXED

**Status:** Fixed.

**Behavior:** When a user adds or removes a tag in PlaceDetail, the parent's `selectedUserTags` updated but the page-level cache did not, so "My Places" filtered by that tag wouldn't show the place until refresh.

**Fix:** Added `tagsByPlaceId` local state (initialized from `initialTagsByPlaceId`). On `onTagsChange`, update both `selectedUserTags` and `tagsByPlaceId`. All filtering and pre-population now use `tagsByPlaceId`.

---

## Verified Working

| Area | Status |
|------|--------|
| Rating validation (1–5) | ✅ API and DB constraint |
| Rating persistence via `user-place-state` | ✅ Insert/upsert |
| Rating display in PlaceDetail | ✅ After visited |
| Rating in Concierge scoring | ✅ `ratingsByHighlightId` used correctly |
| Tags add (normalization, dedup) | ✅ Lowercase, unique constraint |
| Tags remove | ✅ Correct `.eq()` chain |
| Tags in My Places filter | ✅ Aggregates across `highlightIds` |
| `user_distinct_tags` view | ✅ Filter autocomplete in FilterSheet |
| RLS on `user_place_state` and `user_place_tags` | ✅ Own rows only |
| `user-place-context` fetches both state + tags | ✅ Parallel queries |

---

## Edge Cases

- **Venue merging:** Saved state uses `getSavedHighlightId` (prefer saved highlight); visited/rating now aggregate across all highlights for the venue.
- **PlaceDetail fetch vs. props:** PlaceDetail fetches `/api/user-place-context` on mount, which overwrites initial props. Pre-populating from cache reduces perceived latency.
- **Legacy `ratings` table (001):** Not used; `user_place_state` is the source of truth.
