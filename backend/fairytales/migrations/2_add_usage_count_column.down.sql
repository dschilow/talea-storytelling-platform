-- Rollback migration: Remove usage_count column

DROP INDEX IF EXISTS idx_fairy_tale_last_used;
DROP INDEX IF EXISTS idx_fairy_tale_usage_count;

ALTER TABLE fairy_tale_usage_stats 
DROP COLUMN IF EXISTS last_used_at;

ALTER TABLE fairy_tale_usage_stats 
DROP COLUMN IF EXISTS usage_count;
