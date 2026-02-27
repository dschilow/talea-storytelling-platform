CREATE TABLE IF NOT EXISTS generated_audio_library (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('story', 'doku')),
  source_id TEXT NOT NULL,
  source_title TEXT NOT NULL,
  item_id TEXT NOT NULL,
  item_title TEXT NOT NULL,
  item_subtitle TEXT,
  item_order INTEGER,
  cache_key TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'audio/mpeg',
  cover_image_url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS generated_audio_library_user_cache_idx
  ON generated_audio_library(user_id, cache_key);

CREATE INDEX IF NOT EXISTS generated_audio_library_user_created_idx
  ON generated_audio_library(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS generated_audio_library_user_type_idx
  ON generated_audio_library(user_id, source_type);
