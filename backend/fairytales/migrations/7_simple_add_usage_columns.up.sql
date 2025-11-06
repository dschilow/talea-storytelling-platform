-- Migration 7: Simple ADD COLUMN approach (no DO blocks)
-- Fixes Migration 6 syntax errors - Encore can't handle complex DO blocks

-- Add usage_count column (will fail silently if exists)
ALTER TABLE fairy_tale_usage_stats ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;

-- Add last_used_at column (will fail silently if exists)
ALTER TABLE fairy_tale_usage_stats ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP;

-- Update usage_count from total_generations (only NULL values)
UPDATE fairy_tale_usage_stats 
SET usage_count = COALESCE(total_generations, 0)
WHERE usage_count IS NULL;

-- Make usage_count NOT NULL with default
ALTER TABLE fairy_tale_usage_stats 
ALTER COLUMN usage_count SET NOT NULL,
ALTER COLUMN usage_count SET DEFAULT 0;

-- Create indices (will fail silently if exist)
CREATE INDEX IF NOT EXISTS idx_fairy_tale_usage_count ON fairy_tale_usage_stats(usage_count);
CREATE INDEX IF NOT EXISTS idx_fairy_tale_last_used ON fairy_tale_usage_stats(last_used_at);

-- Ensure all fairy tales have usage stats
INSERT INTO fairy_tale_usage_stats (tale_id, total_generations, successful_generations, failed_generations, usage_count)
SELECT id, 0, 0, 0, 0
FROM fairy_tales
WHERE id NOT IN (SELECT tale_id FROM fairy_tale_usage_stats)
ON CONFLICT (tale_id) DO NOTHING;
