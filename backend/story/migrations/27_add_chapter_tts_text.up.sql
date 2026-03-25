-- Add tts_text column to chapters table for storing TTS-enriched text
-- (with xAI expression tags like [pause], <whisper>, etc.)
-- The regular 'content' column remains the clean display text.
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS tts_text TEXT;
