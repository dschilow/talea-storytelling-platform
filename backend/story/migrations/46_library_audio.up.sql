-- Talea Originals: audio dramas (Hörspiele) per episode and the voice cast of a series.
-- library/store.ts creates the same columns at runtime (Railway has skipped migration files before).
ALTER TABLE library_episodes ADD COLUMN IF NOT EXISTS audio JSONB;
ALTER TABLE library_episodes ADD COLUMN IF NOT EXISTS audio_script JSONB;

CREATE TABLE IF NOT EXISTS library_voice_cast (
  series_id TEXT NOT NULL REFERENCES library_series(id) ON DELETE CASCADE,
  speaker_id TEXT NOT NULL,
  voice_id TEXT,
  persona TEXT,
  source TEXT NOT NULL DEFAULT 'admin',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (series_id, speaker_id)
);
