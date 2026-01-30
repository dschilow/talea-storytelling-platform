-- Update existing pipeline config to use new Flux settings
-- Run this to update the database with the new parameters

UPDATE pipeline_config
SET value = jsonb_set(
    jsonb_set(
        value,
        '{runwareSteps}',
        '4'
    ),
    '{runwareCfgScale}',
    '4'
),
updated_at = CURRENT_TIMESTAMP
WHERE key = 'default';

-- Verify the update
SELECT key, value, updated_at FROM pipeline_config WHERE key = 'default';
