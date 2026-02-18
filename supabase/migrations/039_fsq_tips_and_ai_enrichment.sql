-- Foursquare tips storage for AI enrichment (batch only)
-- Per FSQ terms: cache server-side, use for derived data (summaries/tags), no client-side tips dump.
-- See docs/AI-PIPELINE.md, ROADMAP Phase 2.1.

-- Venues: tips cached from FSQ Places API /places/{id}/tips
ALTER TABLE venues ADD COLUMN IF NOT EXISTS fsq_tips JSONB;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS fsq_tips_fetched_at TIMESTAMPTZ;

COMMENT ON COLUMN venues.fsq_tips IS 'Top N tips from Foursquare (text, created_at, lang, agree_count). Input for AI enrichment only; not exposed as raw corpus.';
COMMENT ON COLUMN venues.fsq_tips_fetched_at IS 'When tips were last fetched; skip re-fetch if <90 days.';

-- Highlights: AI enrichment output (enrich-venues-ai.ts)
ALTER TABLE highlights ADD COLUMN IF NOT EXISTS concierge_rationale TEXT;
COMMENT ON COLUMN highlights.concierge_rationale IS 'One-line rationale for Concierge: "Why this for tonight". From AI batch enrichment.';
