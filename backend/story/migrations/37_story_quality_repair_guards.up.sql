-- Migration 37: quality repair guards and safer cost allocation.
--
-- Keep delivery non-blocking, but stop spending the budget on risky full-story
-- rewrites. Buy cheap per-chapter repairs for all short/damaged chapters and
-- allow release surgery to touch every chapter when the critic finds local fixes.

INSERT INTO pipeline_config (key, value)
VALUES ('default', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

UPDATE pipeline_config
SET value = value || '{
  "strictReleaseGateMode": "warn",
  "wholeStoryEditMode": false,
  "maxStoryTokens": 26000,
  "maxRewritePasses": 0,
  "maxExpandCalls": 5,
  "maxWarningPolishCalls": 2,
  "maxSelectiveSurgeryEdits": 5,
  "pass3TargetScore": 9.0,
  "criticMinScore": 9.0,
  "pass3WarnFloor": 7.4,
  "enableAdaptiveSecondCandidate": true,
  "enablePostSurgeryCritic": true,
  "enablePostLocalRepairCritic": true
}'::jsonb,
updated_at = CURRENT_TIMESTAMP
WHERE key = 'default';
