-- Migration 34: make the Story Soul stage robust after quality-per-token rollout.
--
-- Production logs on 2026-05-10 showed Gemini Flash Lite hitting MAX_TOKENS at
-- 1600 tokens for Soul JSON, then falling back deterministically. Hard-failing
-- on that fallback aborted the whole story before the release critic could run.

INSERT INTO pipeline_config (key, value)
VALUES ('default', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

UPDATE pipeline_config
SET value = value || '{
  "soulRetryMax": 1,
  "soulAllowOnReject": true,
  "soulGeneratorMaxOutputTokens": 3000,
  "soulGateEnabled": true,
  "soulRescueEnabled": false
}'::jsonb,
updated_at = CURRENT_TIMESTAMP
WHERE key = 'default';
