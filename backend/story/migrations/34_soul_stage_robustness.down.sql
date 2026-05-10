-- Migration 34 down: restore migration 33 Soul defaults.

UPDATE pipeline_config
SET value = value || '{
  "soulRetryMax": 0,
  "soulAllowOnReject": false,
  "soulGeneratorMaxOutputTokens": 1600,
  "soulGateEnabled": true,
  "soulRescueEnabled": false
}'::jsonb,
updated_at = CURRENT_TIMESTAMP
WHERE key = 'default';
