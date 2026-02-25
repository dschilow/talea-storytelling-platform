ALTER TABLE chapters DROP COLUMN IF EXISTS audio_data;
ALTER TABLE chapters DROP COLUMN IF EXISTS audio_mime_type;
ALTER TABLE chapters DROP COLUMN IF EXISTS audio_generated_at;
ALTER TABLE chapters DROP COLUMN IF EXISTS audio_voice_hash;
