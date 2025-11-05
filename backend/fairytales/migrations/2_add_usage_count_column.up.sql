-- Migration: Add usage_count column to fairy_tale_usage_stats
-- This column tracks how many times each fairy tale has been selected (for variance system)

ALTER TABLE fairy_tale_usage_stats 
ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;

-- Set initial usage_count from total_generations for existing rows
UPDATE fairy_tale_usage_stats 
SET usage_count = total_generations 
WHERE usage_count = 0;

-- Add index for performance (sorting by usage_count)
CREATE INDEX IF NOT EXISTS idx_fairy_tale_usage_count ON fairy_tale_usage_stats(usage_count);

-- Add last_used_at column (for variance system tie-breaking)
ALTER TABLE fairy_tale_usage_stats 
ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_fairy_tale_last_used ON fairy_tale_usage_stats(last_used_at);
