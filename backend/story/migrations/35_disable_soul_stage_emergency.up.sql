-- Migration 35: emergency-disable Story Soul stage.
--
-- The Soul pre-plan is optional. Production logs showed it can abort story
-- generation before the writer/critic path starts when deployed code still
-- has hard-fail Soul settings in memory. Disable it until the robust Soul
-- implementation is deployed and re-tested.

INSERT INTO pipeline_config (key, value)
VALUES ('default', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

UPDATE pipeline_config
SET value = value || '{
  "soulStageEnabled": false,
  "soulStageDisabled": true,
  "soulAllowOnReject": true
}'::jsonb,
updated_at = CURRENT_TIMESTAMP
WHERE key = 'default';
