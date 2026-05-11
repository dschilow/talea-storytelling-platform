-- Migration 38 down: restore the 9.0 non-blocking quality target.

UPDATE pipeline_config
SET value = value || '{
  "pass3TargetScore": 9.0,
  "criticMinScore": 9.0,
  "pass3WarnFloor": 7.4
}'::jsonb,
updated_at = CURRENT_TIMESTAMP
WHERE key = 'default';
