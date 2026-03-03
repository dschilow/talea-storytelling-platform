ALTER TABLE stories
ADD COLUMN IF NOT EXISTS primary_profile_id TEXT;

CREATE INDEX IF NOT EXISTS idx_stories_primary_profile
  ON stories(primary_profile_id, created_at DESC);

CREATE TABLE IF NOT EXISTS story_participants (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL,
  avatar_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (story_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_story_participants_profile
  ON story_participants(profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_story_participants_story
  ON story_participants(story_id);

CREATE TABLE IF NOT EXISTS story_profile_state (
  profile_id TEXT NOT NULL,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  progress_pct DECIMAL(5,2) NOT NULL DEFAULT 0,
  last_position_sec INTEGER,
  completion_state TEXT NOT NULL DEFAULT 'not_started'
    CHECK (completion_state IN ('not_started', 'in_progress', 'completed')),
  last_played_at TIMESTAMP,
  quiz_repeat_due_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (profile_id, story_id)
);

CREATE INDEX IF NOT EXISTS idx_story_profile_state_story
  ON story_profile_state(story_id);

CREATE INDEX IF NOT EXISTS idx_story_profile_state_profile
  ON story_profile_state(profile_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS story_quiz_results (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  attempt INTEGER NOT NULL DEFAULT 1,
  score INTEGER,
  total_questions INTEGER,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  mastery_delta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_story_quiz_results_profile_story
  ON story_quiz_results(profile_id, story_id, created_at DESC);

