-- Migration 28 down: restore the previous conservative story pipeline defaults.

INSERT INTO pipeline_config (key, value)
VALUES ('default', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

UPDATE pipeline_config
SET value = value || '{
  "releaseCandidateCount": 2,
  "criticMinScore": 8.2,
  "pass3TargetScore": 8.2,
  "pass3WarnFloor": 6.5,
  "soulStageEnabled": false,
  "soulAllowOnReject": true,
  "soulAwareCriticMinScore": 7.8,
  "soulApprovedSingleCandidate": true,
  "soulGeneratorMaxOutputTokens": 2500
}'::jsonb,
updated_at = CURRENT_TIMESTAMP
WHERE key = 'default';
