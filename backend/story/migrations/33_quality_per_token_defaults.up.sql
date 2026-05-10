-- Migration 33: quality-per-token story pipeline defaults.
--
-- Goal: raise release quality without returning to unbounded expensive passes.
-- Support work stays on cheap models; costly extra prose is only spent when the
-- first candidate is below the adaptive release band.

INSERT INTO pipeline_config (key, value)
VALUES ('default', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

UPDATE pipeline_config
SET value = value || '{
  "soulGateEnabled": true,
  "soulAllowOnReject": false,
  "soulRescueEnabled": false,
  "soulGeneratorMaxOutputTokens": 1600,
  "releaseCandidateCount": 1,
  "enableAdaptiveSecondCandidate": true,
  "maxRewritePasses": 1,
  "maxExpandCalls": 1,
  "maxWarningPolishCalls": 1,
  "maxSelectiveSurgeryEdits": 3,
  "wholeStoryEditMode": true,
  "enablePostSurgeryCritic": true,
  "enablePostLocalRepairCritic": true,
  "strictReleaseGateMode": "block",
  "aiScenePromptEnabled": false,
  "maxStoryTokens": 14000
}'::jsonb,
updated_at = CURRENT_TIMESTAMP
WHERE key = 'default';
