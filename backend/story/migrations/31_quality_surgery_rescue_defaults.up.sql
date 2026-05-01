-- Migration 31: enable cheap chapter-local rescue for quality-critical drafts.
--
-- Older Railway configs may still contain maxSelectiveSurgeryEdits=0 or 1 from
-- experiments. The current pipeline relies on selective surgery to repair
-- artifact continuity, dialogue, antagonist showdown, and ending payoff before
-- the user-facing story is returned.

INSERT INTO pipeline_config (key, value)
VALUES ('default', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

UPDATE pipeline_config
SET value = value || '{
  "maxSelectiveSurgeryEdits": 2,
  "soulStageEnabled": true,
  "soulAllowOnReject": true,
  "aiScenePromptEnabled": false,
  "strictReleaseGateMode": "warn"
}'::jsonb,
updated_at = CURRENT_TIMESTAMP
WHERE key = 'default';
