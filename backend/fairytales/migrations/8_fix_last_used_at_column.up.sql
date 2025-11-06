-- Migration 8: Fix last_used_at - Remove wrong table, add correct column
-- Problem: Migration 7 created table 'last_used_at_exists' instead of adding column 'last_used_at'
-- Solution: Ultra-simple SQL without DO blocks

-- Drop the incorrectly created table
DROP TABLE IF EXISTS last_used_at_exists;

-- Add last_used_at column to fairy_tale_usage_stats table
-- Using explicit ALTER TABLE with IF NOT EXISTS
ALTER TABLE fairy_tale_usage_stats 
ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP;

-- Create index for last_used_at column
CREATE INDEX IF NOT EXISTS idx_fairy_tale_last_used 
ON fairy_tale_usage_stats(last_used_at);
