-- SQL Script to manually create the logs table in Railway PostgreSQL
-- Run this in Railway's PostgreSQL Data tab or using psql

-- Create logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    request JSONB NOT NULL,
    response JSONB NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indices for efficient querying
CREATE INDEX IF NOT EXISTS idx_logs_source_timestamp ON logs(source, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp DESC);

-- Verify the table was created
SELECT
    tablename,
    schemaname
FROM pg_tables
WHERE tablename = 'logs';

-- Check row count
SELECT COUNT(*) as log_count FROM logs;

-- Show sample rows (if any)
SELECT
    id,
    source,
    timestamp,
    LEFT(request::text, 50) as request_preview,
    LEFT(response::text, 50) as response_preview
FROM logs
ORDER BY timestamp DESC
LIMIT 5;
