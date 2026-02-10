CREATE TABLE IF NOT EXISTS parental_controls (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  pin_hash TEXT,
  pin_salt TEXT,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  blocked_themes TEXT[] NOT NULL DEFAULT '{}',
  blocked_words TEXT[] NOT NULL DEFAULT '{}',
  learning_goals TEXT[] NOT NULL DEFAULT '{}',
  profile_keywords TEXT[] NOT NULL DEFAULT '{}',
  daily_story_limit INTEGER,
  daily_doku_limit INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_parental_controls_enabled
ON parental_controls(enabled);

INSERT INTO parental_controls (
  user_id,
  enabled,
  onboarding_completed,
  blocked_themes,
  blocked_words,
  learning_goals,
  profile_keywords,
  daily_story_limit,
  daily_doku_limit
)
SELECT
  id,
  FALSE,
  FALSE,
  ARRAY[]::TEXT[],
  ARRAY[]::TEXT[],
  ARRAY[]::TEXT[],
  ARRAY[]::TEXT[],
  NULL,
  NULL
FROM users
ON CONFLICT (user_id) DO NOTHING;
