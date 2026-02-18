-- Bump min_results_per_tile to 8 so sparse-tile relaxation triggers less often
-- (better discovery first: multi-query + full pagination)
UPDATE city_categories
SET min_results_per_tile = 8, updated_at = now()
WHERE min_results_per_tile IS NULL OR min_results_per_tile < 8;
