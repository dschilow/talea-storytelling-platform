CREATE TABLE IF NOT EXISTS audio_dokus (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  cover_description TEXT,
  cover_image_url TEXT,
  audio_url TEXT NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audio_dokus_user_id ON audio_dokus(user_id);
CREATE INDEX IF NOT EXISTS idx_audio_dokus_public ON audio_dokus(is_public);
