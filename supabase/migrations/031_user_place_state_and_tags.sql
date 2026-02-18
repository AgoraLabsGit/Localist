-- User-place state: saved, visited, rating (consolidates saved_items semantics)
CREATE TABLE IF NOT EXISTS user_place_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id UUID NOT NULL REFERENCES highlights(id) ON DELETE CASCADE,
  is_saved BOOLEAN NOT NULL DEFAULT false,
  is_visited BOOLEAN NOT NULL DEFAULT false,
  rating INTEGER CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, place_id)
);

CREATE INDEX IF NOT EXISTS idx_user_place_state_user ON user_place_state(user_id);
CREATE INDEX IF NOT EXISTS idx_user_place_state_place ON user_place_state(place_id);

-- User custom tags for places
CREATE TABLE IF NOT EXISTS user_place_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id UUID NOT NULL REFERENCES highlights(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, place_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_user_place_tags_user ON user_place_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_user_place_tags_place ON user_place_tags(place_id);

-- View for distinct tags per user (lowercased, trimmed)
CREATE OR REPLACE VIEW user_distinct_tags AS
SELECT
  user_id,
  LOWER(TRIM(tag)) AS tag,
  COUNT(*)::int AS usage_count
FROM user_place_tags
GROUP BY user_id, LOWER(TRIM(tag));

GRANT SELECT ON user_distinct_tags TO authenticated;

-- Trigger for updated_at on user_place_state
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_place_state_updated_at ON user_place_state;
CREATE TRIGGER user_place_state_updated_at
  BEFORE UPDATE ON user_place_state
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS for user_place_state
ALTER TABLE user_place_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own place state" ON user_place_state;
CREATE POLICY "Users can view own place state"
  ON user_place_state FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own place state" ON user_place_state;
CREATE POLICY "Users can insert own place state"
  ON user_place_state FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own place state" ON user_place_state;
CREATE POLICY "Users can update own place state"
  ON user_place_state FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own place state" ON user_place_state;
CREATE POLICY "Users can delete own place state"
  ON user_place_state FOR DELETE
  USING (auth.uid() = user_id);

-- RLS for user_place_tags
ALTER TABLE user_place_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own place tags" ON user_place_tags;
CREATE POLICY "Users can view own place tags"
  ON user_place_tags FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own place tags" ON user_place_tags;
CREATE POLICY "Users can insert own place tags"
  ON user_place_tags FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own place tags" ON user_place_tags;
CREATE POLICY "Users can delete own place tags"
  ON user_place_tags FOR DELETE
  USING (auth.uid() = user_id);

-- Migrate existing saved_items to user_place_state (highlights only)
INSERT INTO user_place_state (user_id, place_id, is_saved)
SELECT user_id, target_id, true
FROM saved_items
WHERE target_type = 'highlight'
ON CONFLICT (user_id, place_id) DO UPDATE SET is_saved = true;
