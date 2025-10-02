CREATE TABLE avatar_memories (
  id TEXT PRIMARY KEY,
  avatar_id TEXT NOT NULL,
  story_id TEXT,
  story_title TEXT,
  experience TEXT,
  emotional_impact TEXT CHECK (emotional_impact IN ('positive', 'negative', 'neutral')),
  personality_changes TEXT, -- JSON string
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE CASCADE
);

-- Add index for fast lookups by avatar
CREATE INDEX idx_avatar_memories_avatar_id ON avatar_memories(avatar_id);
-- Add index for chronological ordering
CREATE INDEX idx_avatar_memories_created_at ON avatar_memories(created_at);