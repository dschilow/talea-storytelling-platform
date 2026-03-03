ALTER TABLE dokus
ADD COLUMN IF NOT EXISTS primary_profile_id TEXT;

CREATE INDEX IF NOT EXISTS idx_dokus_primary_profile
  ON dokus(primary_profile_id, created_at DESC);

CREATE TABLE IF NOT EXISTS doku_participants (
  id TEXT PRIMARY KEY,
  doku_id TEXT NOT NULL REFERENCES dokus(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL,
  avatar_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (doku_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_doku_participants_profile
  ON doku_participants(profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_doku_participants_doku
  ON doku_participants(doku_id);

CREATE TABLE IF NOT EXISTS doku_profile_state (
  profile_id TEXT NOT NULL,
  doku_id TEXT NOT NULL REFERENCES dokus(id) ON DELETE CASCADE,
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  progress_pct DECIMAL(5,2) NOT NULL DEFAULT 0,
  last_position_sec INTEGER,
  completion_state TEXT NOT NULL DEFAULT 'not_started'
    CHECK (completion_state IN ('not_started', 'in_progress', 'completed')),
  last_played_at TIMESTAMP,
  quiz_repeat_due_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (profile_id, doku_id)
);

CREATE INDEX IF NOT EXISTS idx_doku_profile_state_doku
  ON doku_profile_state(doku_id);

CREATE INDEX IF NOT EXISTS idx_doku_profile_state_profile
  ON doku_profile_state(profile_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS doku_quiz_results (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  doku_id TEXT NOT NULL REFERENCES dokus(id) ON DELETE CASCADE,
  attempt INTEGER NOT NULL DEFAULT 1,
  score INTEGER,
  total_questions INTEGER,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  mastery_delta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_doku_quiz_results_profile_doku
  ON doku_quiz_results(profile_id, doku_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audio_doku_profile_state (
  profile_id TEXT NOT NULL,
  doku_id TEXT NOT NULL REFERENCES audio_dokus(id) ON DELETE CASCADE,
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  progress_pct DECIMAL(5,2) NOT NULL DEFAULT 0,
  last_position_sec INTEGER,
  completion_state TEXT NOT NULL DEFAULT 'not_started'
    CHECK (completion_state IN ('not_started', 'in_progress', 'completed')),
  last_played_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (profile_id, doku_id)
);

CREATE INDEX IF NOT EXISTS idx_audio_doku_profile_state_profile
  ON audio_doku_profile_state(profile_id, updated_at DESC);

