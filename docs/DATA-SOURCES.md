# Foursquare vs Google — Data Sources

What we get from each API and where we have gaps. See `docs/AI-PIPELINE.md` for how the AI layer fills null data.

---

## What Google Places Text Search provides (no extra call)

| Field | Google Text Search | Used today |
|-------|--------------------|------------|
| place_id, name | ✓ | ✓ |
| formatted_address | ✓ | Not stored when no FSQ |
| location (lat/lng) | ✓ | ✓ |
| rating, user_ratings_total | ✓ | Gating only (e.g. 4.3+), never stored |
| addressComponents | ✓ | Neighborhood fallback |
| types / primaryType | ✓ | ✓ (google_types) |

We never call Place Details, so we don't get Google's hours, phone, website, or photos.

---

## What Foursquare adds (2 calls per place: search + details)

| Field | From Foursquare | Shown in UI |
|-------|-----------------|-------------|
| Address | ✓ (location.formatted_address) | Place detail, maps link |
| Opening hours | ✓ | Place detail |
| Phone | ✓ | Place detail |
| Website | ✓ | Place detail, highlight card |
| Rating | ✓ (0–10) | Cards + detail |
| Rating count | ✓ | Cards + detail |
| Photos | ✓ (via fetch-venue-photos) | Cards + detail |
| Description | ✓ | Highlight short_description |
| Price | ✓ | Highlight avg_expected_price |
| Categories | ✓ | fsq_categories |

---

## When there is no FSQ match

| Field | Value |
|-------|-------|
| address | null |
| opening_hours | null |
| phone | null |
| website | null |
| rating | 9 |
| rating_count | null |
| photo_urls | [] |
| short_description | null |
| avg_expected_price | null |

We could store `place.formatted_address` when there's no FSQ, but today we do not.

---

## Impact in the app

| Screen | Without Foursquare |
|--------|--------------------|
| Highlight cards | No photo, "9+" rating, no review count |
| Place detail | No address, hours, phone, website; no photo; "9+" rating |
| Concierge / filters | No fsq_categories; no price; limited descriptions |

Foursquare drives almost all of the "detail" UX: address, hours, phone, website, photos, normalized rating, and descriptions.

---

## AI Layer: Filling Null Data

When FSQ is missing, the AI pipeline can fill some gaps. Batch jobs run post-ingest; outputs stored in DB. See `docs/AI-PIPELINE.md`.

| Field | AI can fill? | Approach |
|-------|--------------|----------|
| **short_description** | ✓ Yes | Generate 2–3 sentences from venue name, category, neighborhood. Highest value. Skip when FSQ already has description. |
| **vibe_tags** | ✓ Yes | Infer tags (e.g. `["cozy", "local", "date_night"]`) from name + category + neighborhood. Improves filters even without FSQ. |
| **avg_expected_price** | ✓ Optional | Estimate $/$$/$$$ from category + neighborhood (e.g. "cafe in Palermo" → $$). Low confidence; show as "Est." in UI. |
| **website** | △ Risky | Web search + LLM: "official website [venue name] [city]". Validate URL before storing; risk of wrong/malicious links. |
| address | No (code change) | Store `place.formatted_address` when FSQ missing. Not AI—ingest logic change. |
| opening_hours | No | Factual; requires Place Details or FSQ. |
| phone | No | Factual; requires Place Details or FSQ. |
| photo_urls | No | AI cannot generate or find images reliably. |
| rating / rating_count | Display choice | Show "—" or "Unrated" instead of "9+"; AI doesn't help. |

**Implementation:**

1. **enrich-places-ai.ts** — Batch job after ingest. For each highlight with `short_description` null: call LLM with (name, category, neighborhood, city). Output: `short_description`, `vibe_tags`. Optionally `avg_expected_price` (integer 1–4).
2. **Skip if populated** — Don't overwrite FSQ data. Only fill when null.
3. **Cap per run** — `admin_settings.max_ai_calls_per_run` to control cost.
4. **Address fallback** — Ingest: when no FSQ, set `venue.address = place.formatted_address`. No AI.

**Priority:** short_description and vibe_tags first; address fallback (code change); price estimate and website as optional later.

---

## Cost vs value

From `docs/COSTS.md`:
- ~18.75 credits/call ≈ $0.01875/call
- New city: ~300–400 calls ≈ $5–7
- Ongoing: ~$0.02 per place if you re-enrich often

**Value:**
- Hours, phone, website — needed for visit decisions.
- Photos — needed for visual browsing.
- Address — useful; Google could partially cover if we stored formatted_address when FSQ is missing.
- Rating — we already gate by Google; FSQ mainly enriches what we show.
- Categories — improve filtering and labels.

---

## Summary

- Foursquare is the main source of contact and visit info (hours, phone, website), photos, and descriptions.
- Without Foursquare we could still:
  - Use Google formatted_address (store it when FSQ missing)
  - Use Google rating for display if desired
  - Call Google Place Details for hours/phone/website/photos (~$17/1K)
- **AI layer** fills short_description, vibe_tags, and optionally price when FSQ is missing—reducing reliance on FSQ for new/obscure places.
- Keeping Foursquare for enrichment remains sensible given cost and data quality. Incremental ingest is a good lever to control costs by skipping FSQ for venues already enriched.
