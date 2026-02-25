-- Add audio cache columns to chapters table for pre-generated TTS audio.
-- Stores MP3 audio as base64 data URI to avoid re-generation on each listen.
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS audio_data TEXT;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS audio_mime_type TEXT DEFAULT 'audio/mpeg';
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS audio_generated_at TIMESTAMP;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS audio_voice_hash TEXT;
