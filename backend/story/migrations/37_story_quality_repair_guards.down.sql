-- Migration 37 down: restore the previous delivery-failsafe budget.

UPDATE pipeline_config
SET value = value || '{
  "strictReleaseGateMode": "warn",
  "wholeStoryEditMode": false,
  "maxStoryTokens": 22000,
  "maxRewritePasses": 1,
  "maxExpandCalls": 1,
  "maxWarningPolishCalls": 1,
  "maxSelectiveSurgeryEdits": 3,
  "pass3TargetScore": 8.6,
  "criticMinScore": 8.6,
  "pass3WarnFloor": 7.2,
  "enableAdaptiveSecondCandidate": true,
  "enablePostSurgeryCritic": true,
  "enablePostLocalRepairCritic": true
}'::jsonb,
updated_at = CURRENT_TIMESTAMP
WHERE key = 'default';
