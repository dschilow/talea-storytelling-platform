-- Revert only the low-cost story-pipeline knobs from migration 32 to the
-- previous quality-warning defaults.

UPDATE pipeline_config
SET value = value || '{
  "blueprintMode": "llm",
  "soulGeneratorMaxOutputTokens": 2200,
  "soulGateEnabled": true,
  "soulRescueEnabled": true,
  "maxRewritePasses": 1,
  "maxExpandCalls": 4,
  "maxWarningPolishCalls": 3,
  "maxStoryTokens": 20000,
  "enableAdaptiveSecondCandidate": true,
  "maxSentenceTighteningChapters": 5,
  "maxSelectiveSurgeryEdits": 2,
  "enablePostSurgeryCritic": true,
  "enablePostLocalRepairCritic": true,
  "releaseCandidateCount": 1,
  "aiScenePromptEnabled": false,
  "strictReleaseGateMode": "warn"
}'::jsonb,
updated_at = CURRENT_TIMESTAMP
WHERE key = 'default';
