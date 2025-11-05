-- Rollback Migration 3: Remove usage_count and last_used_at columns

DROP INDEX IF EXISTS idx_fairy_tale_usage_count;
DROP INDEX IF EXISTS idx_fairy_tale_last_used;

ALTER TABLE fairy_tale_usage_stats 
DROP COLUMN IF EXISTS usage_count;

ALTER TABLE fairy_tale_usage_stats 
DROP COLUMN IF EXISTS last_used_at;
