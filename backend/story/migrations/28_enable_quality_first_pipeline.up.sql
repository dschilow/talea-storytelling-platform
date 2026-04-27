-- Migration 28: enable quality-first story generation defaults.
--
-- Existing deployments can have a pipeline_config row that overrides the code
-- defaults. Keep this migration additive and top-level only so unrelated image
-- and runtime settings remain untouched.

INSERT INTO pipeline_config (key, value)
VALUES ('default', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

UPDATE pipeline_config
SET value = value || '{
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
