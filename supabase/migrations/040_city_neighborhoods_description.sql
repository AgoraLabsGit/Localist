-- AI-generated micro-guide for neighborhoods (enrich-neighborhoods-ai.ts)
-- 2-3 sentences, max 350 chars; vibe + who it's for.
-- See docs/AI-PIPELINE.md §5.

ALTER TABLE city_neighborhoods ADD COLUMN IF NOT EXISTS description TEXT;
COMMENT ON COLUMN city_neighborhoods.description IS '2-3 sentence micro-guide from AI batch enrichment. Vibe + who it''s for. Max 350 chars.';
