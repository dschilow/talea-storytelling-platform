-- Remove cost tracking fields from stories table
ALTER TABLE stories DROP COLUMN tokens_input;
ALTER TABLE stories DROP COLUMN tokens_output;
ALTER TABLE stories DROP COLUMN tokens_total;
ALTER TABLE stories DROP COLUMN cost_input_usd;
ALTER TABLE stories DROP COLUMN cost_output_usd;
ALTER TABLE stories DROP COLUMN cost_total_usd;
ALTER TABLE stories DROP COLUMN cost_mcp_usd;
ALTER TABLE stories DROP COLUMN model_used;
