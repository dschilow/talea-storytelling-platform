-- Migration 35 down: re-enable Story Soul stage after robust code is deployed.

UPDATE pipeline_config
SET value = value || '{
  "soulStageEnabled": true,
  "soulStageDisabled": false,
  "soulAllowOnReject": true
}'::jsonb,
updated_at = CURRENT_TIMESTAMP
WHERE key = 'default';
