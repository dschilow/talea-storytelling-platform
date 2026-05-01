-- Revert Migration 31 defaults.

UPDATE pipeline_config
SET value = value || '{
  "maxSelectiveSurgeryEdits": 1
}'::jsonb,
updated_at = CURRENT_TIMESTAMP
WHERE key = 'default';
