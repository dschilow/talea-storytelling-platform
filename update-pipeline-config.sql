-- Update existing pipeline config to use stable quality-warning story settings
-- plus current Flux image defaults.
-- Run this locally or through the Railway run-migration-sql endpoint.

INSERT INTO pipeline_config (key, value)
VALUES ('default', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

UPDATE pipeline_config
SET value = value || '{
    "runwareSteps": 4,
    "runwareCfgScale": 4,
    "releaseCandidateCount": 1,
    "criticModel": "gpt-5.4-nano",
    "criticMinScore": 8.6,
    "maxSelectiveSurgeryEdits": 2,
    "blueprintRetryMax": 0,
    "pass3TargetScore": 8.6,
    "pass3WarnFloor": 7.2,
    "soulStageEnabled": true,
    "soulRetryMax": 0,
    "soulAllowOnReject": true,
    "soulAwareCriticMinScore": 8.6,
    "soulApprovedSingleCandidate": true,
    "soulGeneratorMaxOutputTokens": 2200,
    "imageRetryMax": 1,
    "aiScenePromptEnabled": false,
    "strictReleaseGateMode": "warn"
}'::jsonb,
updated_at = CURRENT_TIMESTAMP
WHERE key = 'default';

-- Verify the update
SELECT key, value, updated_at FROM pipeline_config WHERE key = 'default';
