-- Migration: Add usage_count column to fairy_tale_usage_stats
-- This column tracks how many times each fairy tale has been selected (for variance system)

-- Step 1: Add usage_count column
ALTER TABLE fairy_tale_usage_stats 
ADD COLUMN IF NOT EXISTS usage_count INTEGER;

-- Step 2: Set initial values from total_generations (only for NULL values, not 0)
UPDATE fairy_tale_usage_stats 
SET usage_count = COALESCE(total_generations, 0)
WHERE usage_count IS NULL;

-- Step 3: Set default to 0 for future rows
ALTER TABLE fairy_tale_usage_stats 
ALTER COLUMN usage_count SET DEFAULT 0;

-- Step 4: Make column NOT NULL
ALTER TABLE fairy_tale_usage_stats 
ALTER COLUMN usage_count SET NOT NULL;

-- Step 5: Add index for performance (sorting by usage_count)
CREATE INDEX IF NOT EXISTS idx_fairy_tale_usage_count ON fairy_tale_usage_stats(usage_count);

-- Step 6: Add last_used_at column (for variance system tie-breaking)
ALTER TABLE fairy_tale_usage_stats 
ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP;

-- Step 7: Add index for performance
CREATE INDEX IF NOT EXISTS idx_fairy_tale_last_used ON fairy_tale_usage_stats(last_used_at);
