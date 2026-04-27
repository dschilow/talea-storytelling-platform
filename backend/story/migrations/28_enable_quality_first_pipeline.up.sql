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
  "releaseCandidateCount": 1,
  "criticModel": "gpt-5.4-nano",
  "criticMinScore": 7.8,
  "maxSelectiveSurgeryEdits": 0,
  "blueprintRetryMax": 0,
  "pass3TargetScore": 7.8,
  "pass3WarnFloor": 6.4,
  "soulStageEnabled": true,
  "soulRetryMax": 0,
  "soulAllowOnReject": true,
  "soulAwareCriticMinScore": 7.8,
  "soulApprovedSingleCandidate": true,
  "soulGeneratorMaxOutputTokens": 2500,
  "imageRetryMax": 1
}'::jsonb,
updated_at = CURRENT_TIMESTAMP
WHERE key = 'default';
