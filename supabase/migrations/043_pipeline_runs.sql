-- Pipeline runs for fetch-venue-tips and enrich-venues-ai (scripts that don't use ingestion_jobs)
-- Admin usage page uses ingestion_jobs + pipeline_runs
-- See docs/COST-LOG.md
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script TEXT NOT NULL,
  city_slug TEXT,
  status TEXT DEFAULT 'success',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  items_processed INTEGER,
  run_metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_finished_at ON pipeline_runs(finished_at DESC);

COMMENT ON TABLE pipeline_runs IS 'API/AI runs from fetch-venue-tips, enrich-venues-ai; ingestion_jobs covers ingest-places-typed';
