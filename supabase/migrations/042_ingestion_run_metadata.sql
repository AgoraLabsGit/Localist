-- Add run_metadata to ingestion_jobs for cost correlation with API dashboards
-- See docs/COST-LOG.md
ALTER TABLE ingestion_jobs ADD COLUMN IF NOT EXISTS run_metadata JSONB;

COMMENT ON COLUMN ingestion_jobs.run_metadata IS 'API call counts and city for cost tracking: { google_calls, fsq_calls, city_slug }';
