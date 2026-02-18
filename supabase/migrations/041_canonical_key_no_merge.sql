-- Stop merging distinct venues by canonical_key (root cause of Villa Urquiza café regression)
-- Two different businesses at same address were merged; second overwrote first's highlight.
-- canonical_key remains for analytics; ingest now uses google_place_id as sole identity.

DROP INDEX IF EXISTS idx_venues_city_canonical_key;

COMMENT ON COLUMN venues.canonical_key IS 'Dedup key for analytics; NOT used to merge. Hash(normalize_address) or hash(name+geohash7).';
