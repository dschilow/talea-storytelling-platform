-- Talea Originals: voices of a series on other engines than ElevenLabs (Gemini via OpenRouter).
-- The persona stays in library_voice_cast: it belongs to the figure, not to an engine.
-- library/store.ts creates the same table at runtime (Railway has skipped migration files before).
CREATE TABLE IF NOT EXISTS library_voice_engine_cast (
  series_id TEXT NOT NULL REFERENCES library_series(id) ON DELETE CASCADE,
  speaker_id TEXT NOT NULL,
  family TEXT NOT NULL,
  voice_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'admin',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (series_id, speaker_id, family)
);
