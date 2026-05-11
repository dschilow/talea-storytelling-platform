-- Migration 38: raise the non-blocking story-quality target to 9.5.
--
-- The release gate intentionally stays in warn mode. This lets the pipeline
-- spend its bounded repair budget toward a 9.5 critic target without turning
-- generation into another user-visible failure path.

UPDATE pipeline_config
SET value = value || '{
  "strictReleaseGateMode": "warn",
  "pass3TargetScore": 9.5,
  "criticMinScore": 9.5,
  "pass3WarnFloor": 7.8,
  "maxStoryTokens": 26000,
  "maxRewritePasses": 0,
  "maxExpandCalls": 5,
  "maxWarningPolishCalls": 2,
  "maxSelectiveSurgeryEdits": 5,
  "enableAdaptiveSecondCandidate": true,
  "enablePostSurgeryCritic": true,
  "enablePostLocalRepairCritic": true
}'::jsonb,
updated_at = CURRENT_TIMESTAMP
WHERE key = 'default';
