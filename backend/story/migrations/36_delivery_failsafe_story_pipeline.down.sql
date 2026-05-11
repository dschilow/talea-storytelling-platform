-- Migration 36 down: restore the stricter quality-first release behavior.

UPDATE pipeline_config
SET value = value || '{
  "strictReleaseGateMode": "block",
  "wholeStoryEditMode": true,
  "maxStoryTokens": 14000,
  "maxRewritePasses": 1,
  "maxExpandCalls": 1,
  "maxWarningPolishCalls": 1,
  "maxSelectiveSurgeryEdits": 3
}'::jsonb,
updated_at = CURRENT_TIMESTAMP
WHERE key = 'default';
