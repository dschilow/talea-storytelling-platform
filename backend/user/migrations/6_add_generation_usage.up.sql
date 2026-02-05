CREATE TABLE IF NOT EXISTS generation_usage (
  user_id TEXT NOT NULL,
  period_start DATE NOT NULL,
  story_count INTEGER NOT NULL DEFAULT 0,
  doku_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_generation_usage_user_period
  ON generation_usage(user_id, period_start);
