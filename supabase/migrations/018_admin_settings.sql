-- Admin pipeline settings (configurable from admin UI, not .env)
-- Keys: max_foursquare_calls_per_run, max_google_calls_per_run, ai_enrichment_enabled

CREATE TABLE IF NOT EXISTS admin_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- RLS: only admins can read/write
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage admin_settings"
  ON admin_settings FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

-- Service role bypass (for ingest scripts)
CREATE POLICY "Service role can read admin_settings"
  ON admin_settings FOR SELECT
  TO service_role
  USING (true);

-- Seed defaults (200 = ~100 venues get full FSQ data; doesn't throttle dev)
INSERT INTO admin_settings (key, value, description) VALUES
  ('max_foursquare_calls_per_run', '200', 'Cap Foursquare API calls per ingest run. Empty = no limit.'),
  ('max_google_calls_per_run', '', 'Cap Google Places API calls per ingest run. Empty = no limit.'),
  ('ai_enrichment_enabled', 'false', 'Enable AI enrichment in pipeline. true/false.')
ON CONFLICT (key) DO NOTHING;
