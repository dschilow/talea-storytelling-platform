-- Migration 3: FIX - Add usage_count column (Migration 2 failed silently)
-- This is a corrective migration because Migration 2's UPDATE statement failed
-- (it referenced usage_count in WHERE clause before the column existed)

-- Drop column if it somehow exists in invalid state
ALTER TABLE fairy_tale_usage_stats 
DROP COLUMN IF EXISTS usage_count;

-- Add usage_count column (fresh start)
ALTER TABLE fairy_tale_usage_stats 
ADD COLUMN usage_count INTEGER NOT NULL DEFAULT 0;

-- Set initial values from total_generations
UPDATE fairy_tale_usage_stats 
SET usage_count = COALESCE(total_generations, 0);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_fairy_tale_usage_count ON fairy_tale_usage_stats(usage_count);

-- Verify last_used_at exists (from Migration 2)
ALTER TABLE fairy_tale_usage_stats 
ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP;

-- Ensure index exists
CREATE INDEX IF NOT EXISTS idx_fairy_tale_last_used ON fairy_tale_usage_stats(last_used_at);
