CREATE TABLE avatars (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  physical_traits TEXT NOT NULL,
  personality_traits TEXT NOT NULL,
  image_url TEXT,
  creation_type TEXT NOT NULL CHECK (creation_type IN ('ai-generated', 'photo-upload')),
  is_public BOOLEAN NOT NULL DEFAULT false,
  original_avatar_id TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_avatars_user_id ON avatars(user_id);
CREATE INDEX idx_avatars_public ON avatars(is_public);
CREATE INDEX idx_avatars_original ON avatars(original_avatar_id);
