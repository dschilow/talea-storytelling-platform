-- Update existing pipeline config to use quality-first story settings plus
-- current Flux image defaults.
-- Run this locally or through the Railway run-migration-sql endpoint.

INSERT INTO pipeline_config (key, value)
VALUES ('default', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

UPDATE pipeline_config
SET value = value || '{
    "runwareSteps": 4,
    "runwareCfgScale": 4,
    "releaseCandidateCount": 3,
    "criticMinScore": 8.6,
    "pass3TargetScore": 8.6,
    "pass3WarnFloor": 7.2,
    "soulStageEnabled": true,
    "soulAllowOnReject": false,
    "soulAwareCriticMinScore": 8.6,
    "soulApprovedSingleCandidate": false,
    "soulGeneratorMaxOutputTokens": 3600
}'::jsonb,
updated_at = CURRENT_TIMESTAMP
WHERE key = 'default';

-- Verify the update
SELECT key, value, updated_at FROM pipeline_config WHERE key = 'default';
