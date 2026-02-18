-- Store imported API costs (OpenAI via Costs API; Google/FSQ = manual)
-- See docs/COST-LOG.md, scripts/import-openai-costs.ts
CREATE TABLE IF NOT EXISTS api_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  cost_date DATE NOT NULL,
  cost_usd NUMERIC(12, 6) NOT NULL,
  raw_data JSONB,
  imported_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(provider, cost_date)
);

CREATE INDEX IF NOT EXISTS idx_api_costs_provider_date ON api_costs(provider, cost_date DESC);

COMMENT ON TABLE api_costs IS 'Imported costs from OpenAI Costs API; Google/FSQ manual only';
