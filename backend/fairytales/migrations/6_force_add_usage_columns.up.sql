-- Migration 6: FORCE ADD usage_count and last_used_at columns
-- Emergency fix: Migrations 2-4 were not executed on Railway
-- This ensures columns exist before fairy-tale-selector queries them

-- FORCE ADD usage_count column (idempotent)
DO $$
BEGIN
    -- Check if column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public'
          AND table_name = 'fairy_tale_usage_stats' 
          AND column_name = 'usage_count'
    ) THEN
        -- Add column with default
        ALTER TABLE fairy_tale_usage_stats 
        ADD COLUMN usage_count INTEGER NOT NULL DEFAULT 0;
        
        -- Initialize from total_generations
        UPDATE fairy_tale_usage_stats 
        SET usage_count = COALESCE(total_generations, 0);
        
        -- Add index
        CREATE INDEX idx_fairy_tale_usage_count 
        ON fairy_tale_usage_stats(usage_count);
        
        RAISE NOTICE 'SUCCESS: Column usage_count added to fairy_tale_usage_stats';
    ELSE
        RAISE NOTICE 'SKIPPED: Column usage_count already exists';
    END IF;
END $$;

-- FORCE ADD last_used_at column (idempotent)
DO $$
BEGIN
    -- Check if column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public'
          AND table_name = 'fairy_tale_usage_stats' 
          AND column_name = 'last_used_at'
    ) THEN
        -- Add column (nullable)
        ALTER TABLE fairy_tale_usage_stats 
        ADD COLUMN last_used_at TIMESTAMP;
        
        -- Add index
        CREATE INDEX idx_fairy_tale_last_used 
        ON fairy_tale_usage_stats(last_used_at);
        
        RAISE NOTICE 'SUCCESS: Column last_used_at added to fairy_tale_usage_stats';
    ELSE
        RAISE NOTICE 'SKIPPED: Column last_used_at already exists';
    END IF;
END $$;

-- Ensure usage stats entries exist for all fairy tales
INSERT INTO fairy_tale_usage_stats (tale_id, total_generations, successful_generations, failed_generations, usage_count)
SELECT id, 0, 0, 0, 0
FROM fairy_tales
WHERE id NOT IN (SELECT tale_id FROM fairy_tale_usage_stats)
ON CONFLICT (tale_id) DO NOTHING;

-- Verify columns exist
DO $$
DECLARE
    usage_count_exists BOOLEAN;
    last_used_at_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'fairy_tale_usage_stats' AND column_name = 'usage_count'
    ) INTO usage_count_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'fairy_tale_usage_stats' AND column_name = 'last_used_at'
    ) INTO last_used_at_exists;
    
    IF usage_count_exists AND last_used_at_exists THEN
        RAISE NOTICE '✅ MIGRATION 6 SUCCESS: Both columns exist in fairy_tale_usage_stats';
    ELSE
        RAISE EXCEPTION '❌ MIGRATION 6 FAILED: Missing columns (usage_count: %, last_used_at: %)', 
            usage_count_exists, last_used_at_exists;
    END IF;
END $$;
