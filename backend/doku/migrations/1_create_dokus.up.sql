CREATE TABLE dokus (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  topic TEXT NOT NULL,
  content JSONB NOT NULL,
  cover_image_url TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL CHECK (status IN ('generating', 'complete', 'error')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dokus_user_id ON dokus(user_id);
CREATE INDEX idx_dokus_public ON dokus(is_public);
