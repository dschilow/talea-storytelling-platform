DROP TRIGGER IF EXISTS audio_doku_publication ON audio_dokus;
DROP FUNCTION IF EXISTS stamp_audio_doku_publication();
ALTER TABLE audio_dokus DROP COLUMN IF EXISTS published_at;
