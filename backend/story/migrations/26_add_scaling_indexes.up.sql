CREATE INDEX IF NOT EXISTS idx_stories_user_created_at
  ON stories(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stories_status_updated_at
  ON stories(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_stories_user_status_updated_at
  ON stories(user_id, status, updated_at DESC);
