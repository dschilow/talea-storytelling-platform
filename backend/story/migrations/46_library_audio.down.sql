DROP TABLE IF EXISTS library_voice_cast;
ALTER TABLE library_episodes DROP COLUMN IF EXISTS audio_script;
ALTER TABLE library_episodes DROP COLUMN IF EXISTS audio;
