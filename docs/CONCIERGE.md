# Concierge.md

Single source of truth for the Concierge feature: purpose, personas, data model, scoring, and UI/UX patterns.

***

## 1. Role & Value Proposition

**Concierge is the personal planner on top of our Highlights catalog.**

- **Highlights** = city-wide, user-driven browse & filter.
- **Concierge** = personalized, time- and location-aware picks for *your* real week.

Core value proposition:

> “Given who you are, where you spend time, and how you like to go out, Concierge gives you a small set of things you can realistically do this week—without you having to search.”

Key principles:

- Use the **same underlying venues/highlights** as the rest of the app.
- Differ only in **how results are selected, scored, grouped, and displayed**.
- No per-request external API or AI calls. All data comes from Supabase; AI runs in batch.

***

## 2. Personas & Behavior

We use `persona_type` to adjust radius and mix, not to fork logic entirely.

### Persona types

- `local`
  - Focus: routine-friendly spots near `home_neighborhood` and favorites.
  - Mix: more hidden gems and local favorites, fewer “tourist classics”.
  - Radius: tight around home + preferred neighborhoods.

- `nomad`
  - Focus: balance of work-friendly and social spots; explore more areas.
  - Mix: cafes/co-working by day, bars/experiences at night.
  - Radius: medium; both favorites and city-wide exploration.

- `tourist`
  - Focus: must-see places and iconic experiences, plus a few local-feeling picks.
  - Mix: more classic highlights; hidden gems where they match interests.
  - Radius: wide; most of the city is in play, with some bias toward central barrios.

**Implementation note:** Persona influences **weights**:

- Distance tolerance (how far from home/favorites).
- Hidden gem vs classic / must-visit weighting.
- Local favorite vs touristy weighting.

***

## 3. User Data Model (What Concierge Uses)

Concierge should build directly on existing schema.

### 3.1 Identity & scope

From `users`:

- `home_city`
  - Hard scope: only show venues in this city.

From `user_preferences`:

- `home_neighborhood`
  - Center for **“Near me”** and distance scoring.

- `preferred_neighborhoods` (JSONB)
  - Expanded spatial scope:
    - “Near me” radius (home + favorites).
    - “Favorite neighborhoods” filters.

- `user_cities` (JSONB)
  - For future multi-city support:
    - Concierge operates on the city where `is_home = true` or `home_city`.

### 3.2 Static preferences (when/what/how)

- `persona_type` (`local` | `nomad` | `tourist`)
  - Controls radius and hidden-gem vs classic mix (weights).

- **When to go**
  - `preferred_days` (JSONB)
  - `preferred_time_blocks` (JSONB)
  - `weekday_preferences` (JSONB)
  - `weekend_preferences` (JSONB)  
  Together define:
  - Which **sections** are relevant (e.g. “After work this week”, “Weekend afternoons”).
  - How to weight time windows and days in scoring.

- **What to do**
  - `interests` (JSONB)
    - Category-level preferences: cafe, parrilla, cocktail_bar, museum, nightlife, etc.
    - Used to:
      - Decide which **type groups** show up as sections.
      - Weight category matches within each section.
  - `vibe_tags_preferred` (JSONB)
    - Preferred vibes: date_night, local, lively, cozy, solo_friendly, etc.
    - Used as **soft weights** vs venue `vibe_tags`.

- **How much to spend**
  - `budget_band` (`cheap` | `mid` | `splurge`)
  - `budget_min`, `budget_max`
    - `budget_band` is primary; min/max support band inference.
    - Used as:
      - Soft filter and weight: prefer in-band, occasionally show out-of-band “stretch” picks.

- **How social**
  - `social_comfort_level` (1–5)
    - 1–2: bias toward calm, low-pressure venues.
    - 4–5: more tolerant of high-energy/nightlife spots.
    - Implemented as a weight against vibe tags (e.g. lively, crowded vs chill).

- **Meta**
  - `language` → UI only (localization).
  - `subscription_tier` → gate number of sections or suggestions.
  - `acquisition_source` → analytics / copy variations.
  - `onboarding_completed_at` → determines whether to show full Concierge or “finish setup”.

- **Deprecated**
  - `primary_neighborhood`, `primary_neighborhood_freeform`
    - Migrate into `home_neighborhood` and `preferred_neighborhoods`. Concierge should ignore these directly.

### 3.3 Behavioral signals

From `saved_items`:

- Implicit preferences:
  - Categories, neighborhoods, and vibes of saved items build a **user affinity profile**.
- Use cases:
  - Boost similar categories/neighborhoods.
  - Boost venues with similar `vibe_tags`.

From `ratings`:

- Explicit preferences (stronger signal):
  - 4–5 stars: upweight similar venues.
  - 1–2 stars: downweight similar venues.
- Over time, shape:
  - Category- and vibe-level preference curves.
  - Tolerance for touristy vs local, distance vs quality trade-offs.

***

## 4. Additional Data to Collect (To Improve Concierge)

We’re mostly missing social context, hard “no” constraints, and exploration style. Minimal additions:

### 4.1 Social context

New fields (likely in `user_preferences`):

- `typical_group_type`: `solo` | `couple` | `friends` | `mixed` | `depends`
  - Used to weight:
    - `solo_friendly`, `date_night`, `group_friendly` vibe tags.

- (Optional) `relationship_focus`: `more_dates` | `more_friend_hangs` | `mostly_solo`
  - Further bias toward date-night vs social vs solo venues and sections.

### 4.2 Constraints & exploration style

- `dietary_flags` (JSONB)
  - e.g. `["vegetarian"]`, `["vegan"]`.
  - Used to downweight or filter incompatible food venues.

- `alcohol_preference`: `okay` | `lowkey` | `avoid`
  - Used to downweight bars/clubs for “avoid”, prefer cafés/restaurants.

- `exploration_style`: `favorites` | `balanced` | `adventurous`
  - `favorites`: re-surface similar-to-saved venues more often.
  - `balanced`: 50/50 mix.
  - `adventurous`: prefer novel neighborhoods/categories, fewer repeats.

- `weekly_outing_target`: integer (1–7)
  - Guides:
    - How many suggestions to show for the week.
    - Which days/time slots to fill first.

These can be collected in 1–2 optional onboarding taps or later in Settings.

***

## 5. Onboarding → Fields Mapping

Onboarding must write into the same fields Concierge reads from: `home_city`, `home_neighborhood`, `preferred_neighborhoods`, `persona_type`, `preferred_days`, `preferred_time_blocks`, `interests`, `vibe_tags_preferred`, `budget_band`, `typical_group_type`, `exploration_style`, `weekly_outing_target`, `dietary_flags`, `alcohol_preference`, `acquisition_source`, `onboarding_completed_at`. Settings must edit these same fields.

**For the 7-step Onboarding v2 flow**, see [ROADMAP](ROADMAP.md) Phase 1.

## 6. Concierge vs Highlights

### Highlights

- **Role:** Browse & explore (user-driven).
- **Data:** Full catalog, client-side filtering over:
  - Category/type (groups + subtypes).
  - Area/neighborhoods (multi-select, favorites, near-me via geolocation).
  - Vibes (explicit chips).
- **Sorting:** `quality_score` (+ optional light personalization).

### Concierge

- **Role:** Personal planner (system-driven).
- **Data:** Same highlights, but:
  - Scoped by user’s city, neighborhoods, and time context.
  - Ranked heavily by user preferences + behavior.
- **Filters (for user):**
  - Day/Time: Today, Tonight, This week, This weekend.
  - Area: Favorites / Near me vs All city.
  - Type: Coarse groups only (Food, Drinks, Cafes, Culture, Nightlife, Outdoors).
- **Value:** “Tell me what to do now / this week,” not “show everything.”

***

## 7. Set & Slot-Based Recommendations

Concierge uses **slots** (single suggestions) and **sets** (mini itineraries).

### 7.1 Slots (weekday single suggestions)

Weekdays should be lightweight:

- For a given context (e.g. “Tonight”):
  - 1x cafe (if relevant to persona/nomad).
  - 1x dinner spot.
  - 1x post-dinner option (bar, ice cream, or walking route).
- Each slot is **one card at a time**.

User actions per slot:

- Save (adds to `saved_items`).
- “Not this one” → immediately replace with next candidate.
- Optional “Hide” for longer-term suppression.

This aligns with: “Suggest 1 cafe, 1 dinner spot, 1 walking route; user can reject and a new one is populated.”

### 7.2 Sets (weekend mini-itineraries)

Weekends/longer windows can show simple sets like **“Sunday Chill”**:

- Example: “Sunday Chill in Palermo”
  - 1 park/outdoor spot.
  - 1 cafe/bakery.
  - 1 museum/gallery/historic spot.

Other examples:

- “Rainy Sunday culture crawl”
- “Romantic afternoon in Recoleta”
- “Foodie Sunday in San Telmo”

Each set is a **bundle of slots** sharing a neighborhood/time context, not a full hour-by-hour itinerary.

***

## 8. How Sets & Slots Are Built

### 8.1 Rule-based core (no AI required)

Use deterministic logic with Concierge scoring.

#### Slot definition (conceptual)

```ts
type ConciergeSlot = {
  id: string;                   // e.g. "weekday_tonight_cafe"
  label: string;                // "Cafe for tonight"
  category_group: "cafe" | "restaurant" | "bar" | "culture" | "outdoors" | "walk";
  time_context: "today" | "tonight" | "this_weekend";
  max_distance: "near" | "city";
  allow_replacement: boolean;
};
```

For each slot:

1. Filter highlights by:
   - `home_city`.
   - Category group.
   - Area:
     - “Near” → `home_neighborhood` + `preferred_neighborhoods` with distance limit.
     - “All” → entire city.
   - Budget band.
   - Time context → opening hours if available.
2. Score with `concierge_score`.
3. Return top N candidates for that slot.

UI shows the first candidate; “Not this one” steps through the candidate list (and can request more if exhausted).

#### Set definition (conceptual)

```ts
type ConciergeSet = {
  id: string;                     // "sunday_chill"
  label: string;                  // "Sunday Chill in Palermo"
  time_context: "this_weekend";
  area_strategy: "favorite_neighborhoods"; // how we pick base area
  slots: ConciergeSlot[];         // e.g. park, cafe, museum
};
```

To build a set:

1. Choose a base neighborhood:
   - One of `preferred_neighborhoods` (or `home_neighborhood`) that has enough candidate venues for each slot.
   - Adjust choice based on persona & vibe (locals → more residential; tourists → more central).
2. For each slot in `slots`:
   - Run `getConciergeCandidates(user, context, slot, limit)` scoped to base neighborhood.
   - Pick the top candidate.
3. Bundle the chosen venues as the set’s contents.

**Reject behavior:**

- Option A: Per-slot reject (simpler):
  - Reject a single card → fetch next candidate for that slot.
- Option B: Whole-set reject (future):
  - Reject entire set → re-run set generation with a different base neighborhood or theme.

### 8.2 AI as optional enhancer (not required for v1)

AI is **not** needed to choose venues in sets. It can be used later to:

- Generate set **titles** and short descriptions:
  - Input: selected venues (names, neighborhoods, categories, vibe tags).
  - Output: something like:  
    “Slow Sunday in Palermo: start in Parque Tres de Febrero, coffee at X, and finish at MALBA.”

- Suggest **themes**:
  - E.g. “coffee crawl”, “date afternoon”, “art & wine”.

AI should **not**:

- Bypass DB by inventing venues.
- Decide factual attributes (hours, location, safety).

Underlying venue selection remains rule-based + Concierge scoring for transparency and control.

***

## 9. Concierge Scoring (High-Level)

### 9.0 Batch vs runtime (do not rerun scores on preference change)

**Place scores are split into two layers:**

1. **Batch, global (persona-agnostic)**
   - `npm run compute:scores` writes `quality_score` to `venues`.
   - Uses: popularity, rating, FSQ signals, AI tags, `is_featured`.
   - Runs **only** after ingest or when the global quality model changes.
   - Implemented in `scripts/compute-quality-scores.ts`; stored in `venues.quality_score`.

2. **Runtime reranker (user-specific)**
   - Applied **at request time** in the app/API.
   - Pulls a candidate set (e.g. top N by `quality_score` + filters).
   - Adjusts rank on the fly using:
     - Vibe tag matches (e.g. +weight if `remote_work` and user cares)
     - Price alignment vs user budget
     - Neighborhood proximity vs preferred neighborhoods
     - Persona (local/tourist/nomad) weights
   - Implemented in `src/lib/concierge.ts` (`scorePlace`).

**When to rerun batch scores:**

- ✅ Ingest added or updated venues
- ✅ Global quality model changed (new FSQ weight, new AI features)

**When NOT to rerun batch scores:**

- ❌ User changes persona, sliders, or preferences
- ❌ Toggling filters in the UI

Persona and preference changes are handled via **runtime reranking over static scores**, not by re-running the batch pipeline.

### 9.1 Inputs

Given user U, context C (day/time, radius), and slot S (type group, time_context, distance):

- User:
  - `home_city`
  - `home_neighborhood`, `preferred_neighborhoods`
  - `persona_type`
  - `preferred_days`, `preferred_time_blocks`
  - `weekday_preferences`, `weekend_preferences`
  - `interests`
  - `vibe_tags_preferred`
  - `budget_band`
  - `social_comfort_level`
  - `typical_group_type` (if available)
  - `dietary_flags`, `alcohol_preference` (if available)
  - `exploration_style`
  - `weekly_outing_target`
  - `saved_items`
  - `ratings`

- Venue:
  - `city_id`, `neighborhood`, coordinates
  - `categories` / `google_types` / `fsq_categories`
  - `vibe_tags`
  - `avg_expected_price` (FSQ or AI-estimate)
  - `has_fsq_data`, `rating`, `rating_count`
  - `quality_score`
  - Opening hours (if available)
  - Novelty vs user history (based on saved/visited/ratings)

### 9.2 Scoring sketch

For each candidate:

```txt
score = w_quality   * quality_score
      + w_location  * f_distance(user, venue, persona_type, slot.max_distance)
      + w_time      * f_time_match(user_time_prefs, venue_hours, context)
      + w_interest  * f_category_match(interests, slot.category_group, venue_categories)
      + w_vibe      * f_vibe_match(vibe_tags_preferred, social_comfort_level, typical_group_type, venue_vibe_tags)
      + w_budget    * f_budget_match(budget_band, venue_price)
      + w_behavior  * f_behavioral_affinity(saved_items, ratings, venue)
      + w_explore   * f_exploration_bonus(exploration_style, venue_novelty)
```

- `f_distance`: persona- and slot-aware distance score; “near” vs “city-wide”.
- `f_time_match`: whether the venue is open and fits the selected time block/day.
- `f_category_match`: alignment with user `interests` and slot’s category group.
- `f_vibe_match`: overlap of vibes, tuned by social comfort and group type.
- `f_budget_match`: how close the price is to the user’s band.
- `f_behavioral_affinity`: similarity to saved/rated items.
- `f_exploration_bonus`: boost/penalty depending on novelty vs history.

Weights (`w_*`) can be tuned gradually.

***

## 10. UI/UX Integration

To fully integrate Concierge with UX:

- **Concierge tab layout**
  - Sections based on time context, e.g.:
    - “Tonight near you” → several slots (cafe, dinner, after-dinner).
    - “This weekend” → 1–2 sets like “Sunday Chill”.
    - Persona-based section: “Hidden gems locals love”, “Must-see classics”, etc.
  - Each slot renders **one card** at a time with:
    - Save / favorite.
    - “Not this one” → next candidate.

- **Feedback loop**
  - Save → `saved_items` row; feeds future scores.
  - Rating → `ratings` row; strong positive/negative signal.
  - Reject → at minimum, avoid re-showing same venue for some time; optionally track soft negatives for tuning.

***

## 11. Data & Ownership

- **Single source of truth** for user preferences:
  - `users`, `user_preferences`, `saved_items`, `ratings` tables.
- Concierge:
  - Reads only from Supabase.
  - Never calls external APIs or AI at request time.
- Onboarding & Settings:
  - Must write to these same fields.

This document is the SSOT for the Concierge overhaul: any changes to onboarding, scoring, slot/set definitions, or UI should be reflected here.