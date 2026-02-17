-- Placeholder flag for local_favorite vibe (mainstream + not touristy)
-- Populated later by AI enrichment or rules; ingest leaves as false.
ALTER TABLE venues ADD COLUMN IF NOT EXISTS is_local_favorite BOOLEAN DEFAULT false;
COMMENT ON COLUMN venues.is_local_favorite IS 'Mainstream lane + high FSQ rating_count + not touristy. Set by AI/rules; ingest leaves false.';
