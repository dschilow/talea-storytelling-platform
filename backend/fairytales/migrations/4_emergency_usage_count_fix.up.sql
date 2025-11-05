-- Migration 4: Emergency fix for usage_count column
-- Force-add usage_count if it doesn't exist (fixing Migration 2/3 issues)

-- Drop and recreate to ensure clean state
DO $$
BEGIN
    -- Check if column exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'fairy_tale_usage_stats' 
        AND column_name = 'usage_count'
    ) THEN
        RAISE NOTICE 'Column usage_count already exists, skipping';
    ELSE
        -- Add column
        ALTER TABLE fairy_tale_usage_stats 
        ADD COLUMN usage_count INTEGER NOT NULL DEFAULT 0;
        
        -- Set initial values
        UPDATE fairy_tale_usage_stats 
        SET usage_count = COALESCE(total_generations, 0);
        
        -- Add index
        CREATE INDEX IF NOT EXISTS idx_fairy_tale_usage_count 
        ON fairy_tale_usage_stats(usage_count);
        
        RAISE NOTICE 'Column usage_count successfully added';
    END IF;
END $$;
