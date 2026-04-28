-- Migration 29: raise release bar while keeping token costs bounded.
--
-- This updates existing pipeline_config rows without touching unrelated image
-- defaults. Strict drafts now fail before image/TTS generation when the story is
-- below the child-comprehension and critic release bar.

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
  "soulAllowOnReject": false,
  "soulAwareCriticMinScore": 8.6,
  "soulApprovedSingleCandidate": true,
  "soulGeneratorMaxOutputTokens": 2200,
  "imageRetryMax": 1,
  "aiScenePromptEnabled": false
}'::jsonb,
updated_at = CURRENT_TIMESTAMP
WHERE key = 'default';
