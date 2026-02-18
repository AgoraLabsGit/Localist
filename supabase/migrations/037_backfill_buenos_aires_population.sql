-- Backfill population for Buenos Aires so deriveVenueCaps produces higher caps (300-600 per category)
-- GBA metro ~15M; without this, fallback 2M yields conservative 20 venues/km²
UPDATE cities
SET population = 15000000, updated_at = now()
WHERE slug = 'buenos-aires' AND population IS NULL;
