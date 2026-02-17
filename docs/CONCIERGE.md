# Concierge & Onboarding

---

## Onboarding Flow (Design)

- **Max 5–7 taps** before feed.
- **Screens:** Welcome → Location (city + neighborhood) → Persona (local/nomad/tourist) → Weekday habits → Weekend habits → Categories → Optional vibes/budget → Acquisition source.
- **Data:** `home_city`, `primary_neighborhood`, `persona_type`, `weekday_preferences`, `weekend_preferences`, `interests`, `vibe_tags_preferred`, `acquisition_source`.
- **Tab:** "Concierge" — handpicked picks for your week.

---

## Foursquare Tips (Phase 2)

**What:** User micro-reviews ("Try the negroni", "Come for sundown").

**Where:** Place detail — "What people say" section on open.

**API:** `GET /places/{fsq_id}/tips` — fetch on demand; **no caching allowed**. 1 call per detail view.

**Attribution:** Link to Foursquare venue + "Powered by Foursquare" badge.
