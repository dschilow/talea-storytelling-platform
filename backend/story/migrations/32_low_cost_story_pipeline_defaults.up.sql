-- Migration 32: production low-cost story pipeline defaults.
--
-- Goal: keep one 1,200-1,500 word story from paying for multiple full
-- story/soul/critic passes. Expensive passes stay available through explicit
-- request overrides or future config changes.

INSERT INTO pipeline_config (key, value)
VALUES ('default', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

UPDATE pipeline_config
SET value = value || '{
  "blueprintMode": "deterministic",
  "soulGeneratorMaxOutputTokens": 1600,
  "soulGateEnabled": false,
  "soulRescueEnabled": false,
  "maxRewritePasses": 0,
  "maxExpandCalls": 1,
  "maxWarningPolishCalls": 0,
  "maxStoryTokens": 12000,
  "enableAdaptiveSecondCandidate": false,
  "maxSentenceTighteningChapters": 1,
  "maxSelectiveSurgeryEdits": 1,
  "enablePostSurgeryCritic": false,
  "enablePostLocalRepairCritic": false,
  "releaseCandidateCount": 1,
  "aiScenePromptEnabled": false,
  "strictReleaseGateMode": "warn"
}'::jsonb,
updated_at = CURRENT_TIMESTAMP
WHERE key = 'default';
