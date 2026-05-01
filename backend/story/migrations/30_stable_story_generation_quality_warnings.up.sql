-- Migration 30: keep story generation stable while preserving quality telemetry.
--
-- Quality gates are reported in validation logs, but generated stories should not
-- fail for non-safety quality warnings when usable content exists.

INSERT INTO pipeline_config (key, value)
VALUES ('default', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

UPDATE pipeline_config
SET value = value || '{
  "releaseCandidateCount": 1,
  "criticModel": "gpt-5.4-nano",
  "criticMinScore": 8.6,
  "maxSelectiveSurgeryEdits": 1,
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
