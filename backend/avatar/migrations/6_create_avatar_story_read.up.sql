-- Create table to track which stories have been read by which avatars
-- This prevents duplicate personality development when re-reading stories
CREATE TABLE avatar_story_read (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    avatar_id TEXT NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
    story_id TEXT NOT NULL,
    story_title TEXT NOT NULL,
    read_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(avatar_id, story_id)
);

-- Index for faster lookups
CREATE INDEX avatar_story_read_avatar_id_idx ON avatar_story_read(avatar_id);
CREATE INDEX avatar_story_read_story_id_idx ON avatar_story_read(story_id);