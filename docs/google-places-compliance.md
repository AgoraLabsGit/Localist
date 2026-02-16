# Google Places API (New) — Compliance Guide

## TL;DR
We CAN use Google Places to populate our DB, but we CANNOT cache most data. We store `place_id` (exempt from caching) and must re-fetch details on display. Or we display with proper Google attribution.

---

## What We CAN Do
- **Store `place_id` indefinitely** — explicitly exempt from caching restrictions
- **Store our own content** — our categories, vibe tags, descriptions (AI-generated from our own logic, not cached Google data)
- **Use Text Search / Nearby Search** to discover places
- **Use Place Details** to get ratings, hours, addresses
- **Use field masks** to only request what we need (controls costs)

## What We CANNOT Do
- ❌ **Cache/store Google data** (ratings, reviews, photos, addresses, hours) beyond temporary operational caching
- ❌ **Display Places data on non-Google maps** (must use Google Maps if showing on a map)
- ❌ **Remove or hide Google attribution** when displaying their data
- ❌ **Pre-fetch and stockpile** place details

## Our Compliant Architecture

### Option A: Hybrid (Recommended for MVP)
1. **Ingestion script** searches Google Places → stores only `place_id` + our own metadata (category, city, neighborhood we determine ourselves)
2. **AI generates descriptions** independently — NOT cached Google summaries
3. **On display**, we fetch fresh data from Google (rating, hours, address) using the stored `place_id`
4. **Show Google Maps attribution** (logo or text "Google Maps") on any screen displaying their data

### Option B: Full cache with attribution (riskier)
Store everything but ensure Google attribution is always displayed. TOS is ambiguous on this — Option A is safer.

## Attribution Requirements
When displaying Google Places data:
- Show **Google Maps logo** (preferred) or text "Google Maps" (if space-limited)
- Logo height: 16-19dp, with 10dp clearance on sides
- Font: Roboto or sans-serif, 12-16sp, accessible contrast
- Don't modify, translate, or wrap "Google Maps" text
- Include **third-party attributions** from Place Details responses

## Cost Control
- **$200/month free credit** from Google
- Use **field masks** — only request fields we need
- **Essentials SKU** (cheapest): name, place_id, formatted_address, location, types
- **Pro SKU** (pricier): adds ratings, reviews, opening_hours, editorial_summary
- **Cache `place_id`** to avoid redundant Text Search calls
- Batch ingestion on schedule (not per-user-request)

## Pricing (Pay-as-you-go)
- Text Search: ~$32 per 1,000 requests (Pro fields)
- Place Details: ~$17 per 1,000 requests (Pro fields)
- With $200 credit: ~6,000 Text Search calls or ~11,700 Detail calls free/month

## Implementation Notes
- Use Places API **(New)** — not the legacy version
- Always send `fieldMask` header to control SKU tier
- Store `place_id` + `city` + `category` + `neighborhood` in our DB
- Our `short_description` and `vibe_tags` = AI-generated, not Google data
- Fetch fresh on display OR accept the attribution requirements

---

*Last updated: 2026-02-16*
