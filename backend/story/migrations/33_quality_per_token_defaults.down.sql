-- Migration 33 down: restore low-cost warning-only defaults from migration 32.

UPDATE pipeline_config
SET value = value || '{
  "soulGateEnabled": false,
  "soulAllowOnReject": true,
  "soulRescueEnabled": false,
  "soulGeneratorMaxOutputTokens": 1600,
  "releaseCandidateCount": 1,
  "enableAdaptiveSecondCandidate": false,
  "maxRewritePasses": 0,
  "maxExpandCalls": 1,
  "maxWarningPolishCalls": 0,
  "maxSelectiveSurgeryEdits": 1,
  "wholeStoryEditMode": false,
  "enablePostSurgeryCritic": false,
  "enablePostLocalRepairCritic": false,
  "strictReleaseGateMode": "warn",
  "aiScenePromptEnabled": false,
  "maxStoryTokens": 12000
}'::jsonb,
updated_at = CURRENT_TIMESTAMP
WHERE key = 'default';
