-- RLS for saved_items: users can only access their own saves
ALTER TABLE saved_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own saved items" ON saved_items;
CREATE POLICY "Users can view own saved items"
  ON saved_items FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own saved items" ON saved_items;
CREATE POLICY "Users can insert own saved items"
  ON saved_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own saved items" ON saved_items;
CREATE POLICY "Users can delete own saved items"
  ON saved_items FOR DELETE
  USING (auth.uid() = user_id);
