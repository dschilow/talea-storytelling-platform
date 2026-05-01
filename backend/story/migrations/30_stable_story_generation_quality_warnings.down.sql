-- Migration 30 down: restore strict quality-blocking DB setting.

INSERT INTO pipeline_config (key, value)
VALUES ('default', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

UPDATE pipeline_config
SET value = value || '{
  "soulAllowOnReject": false,
  "strictReleaseGateMode": "block"
}'::jsonb,
updated_at = CURRENT_TIMESTAMP
WHERE key = 'default';
