-- Add cost tracking fields to stories table
ALTER TABLE stories ADD COLUMN tokens_input INTEGER DEFAULT 0;
ALTER TABLE stories ADD COLUMN tokens_output INTEGER DEFAULT 0;
ALTER TABLE stories ADD COLUMN tokens_total INTEGER DEFAULT 0;
ALTER TABLE stories ADD COLUMN cost_input_usd REAL DEFAULT 0;
ALTER TABLE stories ADD COLUMN cost_output_usd REAL DEFAULT 0;
ALTER TABLE stories ADD COLUMN cost_total_usd REAL DEFAULT 0;
ALTER TABLE stories ADD COLUMN cost_mcp_usd REAL DEFAULT 0;
ALTER TABLE stories ADD COLUMN model_used TEXT DEFAULT 'gpt-5-mini';
