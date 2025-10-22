-- Drop logs table
DROP INDEX IF EXISTS idx_logs_timestamp;
DROP INDEX IF EXISTS idx_logs_source_timestamp;
DROP TABLE IF EXISTS logs;
