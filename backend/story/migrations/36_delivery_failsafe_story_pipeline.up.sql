-- Migration 36: delivery failsafe for the quality-first story pipeline.
--
-- Production logs on 2026-05-10 showed generation reaching the writer/critic
-- stages, then throwing at release because strict gates were configured to
-- block. The user-facing product must deliver a story and log quality issues,
-- not fail the request after spending writer tokens.

INSERT INTO pipeline_config (key, value)
VALUES ('default', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

UPDATE pipeline_config
SET value = value || '{
  "strictReleaseGateMode": "warn",
  "wholeStoryEditMode": false,
  "maxStoryTokens": 22000,
  "maxRewritePasses": 1,
  "maxExpandCalls": 1,
  "maxWarningPolishCalls": 1,
  "maxSelectiveSurgeryEdits": 3
}'::jsonb,
updated_at = CURRENT_TIMESTAMP
WHERE key = 'default';
