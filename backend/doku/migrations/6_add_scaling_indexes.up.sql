CREATE INDEX IF NOT EXISTS idx_dokus_user_created_at
  ON dokus(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dokus_status_updated_at
  ON dokus(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_dokus_user_status_updated_at
  ON dokus(user_id, status, updated_at DESC);
