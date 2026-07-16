CREATE TABLE IF NOT EXISTS metered_usage (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('chat', 'image', 'tts')),
  units BIGINT NOT NULL DEFAULT 0 CHECK (units >= 0),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, period_start, kind)
);

CREATE INDEX IF NOT EXISTS idx_metered_usage_user_period
  ON metered_usage(user_id, period_start);