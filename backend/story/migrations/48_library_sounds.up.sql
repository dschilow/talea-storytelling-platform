-- Talea Originals: the sound library every story shares. Every generated spot effect
-- and ambience bed is kept with a German name, a precise English description and
-- keywords, so later screenplays play it again instead of generating it anew.
-- The audio itself lives in the bucket under storage_key (prefix library/).
-- library/store.ts creates the same table at runtime (Railway has skipped migration files before).
CREATE TABLE IF NOT EXISTS library_sounds (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  prompt TEXT NOT NULL,
  seconds DOUBLE PRECISION NOT NULL DEFAULT 0,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '',
  storage_key TEXT NOT NULL,
  uses INTEGER NOT NULL DEFAULT 0,
  blocked BOOLEAN NOT NULL DEFAULT FALSE,
  origin TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMPTZ
);
