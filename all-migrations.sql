-- === avatar database ===
-- Migration: 1_create_avatars.up.sql
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

-- Migration: 2_add_visual_profile.up.sql
ALTER TABLE avatars
  ADD COLUMN visual_profile TEXT;


-- Migration: 3_create_avatar_memories.up.sql
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
-- Migration: 4_add_knowledge_traits.up.sql
-- Add knowledge subcategory traits to existing avatars
-- This migration updates all existing avatar personality_traits to include the new knowledge traits

-- This is a placeholder migration
-- The actual trait upgrades happen in the backend code when avatars are loaded
-- This ensures compatibility and handles missing traits gracefully
-- Migration: 5_create_avatar_doku_read.up.sql
-- Track which dokus have been read by which avatars to prevent duplicate processing
CREATE TABLE avatar_doku_read (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    avatar_id TEXT NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
    doku_id TEXT NOT NULL,
    doku_title TEXT NOT NULL,
    read_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Ensure each avatar can only read the same doku once
    UNIQUE(avatar_id, doku_id)
);

-- Index for fast lookups
CREATE INDEX idx_avatar_doku_read_avatar_id ON avatar_doku_read(avatar_id);
CREATE INDEX idx_avatar_doku_read_doku_id ON avatar_doku_read(doku_id);
-- Migration: 6_create_avatar_story_read.up.sql
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
-- === doku database ===
-- Migration: 1_create_dokus.up.sql
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

-- Migration: 2_add_metadata.up.sql
ALTER TABLE dokus
  ADD COLUMN metadata TEXT;

-- === story database ===
-- Migration: 1_create_stories.up.sql
CREATE TABLE stories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  cover_image_url TEXT,
  config TEXT NOT NULL,
  metadata TEXT,
  status TEXT NOT NULL CHECK (status IN ('generating', 'complete', 'error')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE chapters (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  chapter_order INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stories_user_id ON stories(user_id);
CREATE INDEX idx_stories_status ON stories(status);
CREATE INDEX idx_chapters_story_id ON chapters(story_id);
CREATE INDEX idx_chapters_order ON chapters(story_id, chapter_order);

-- Migration: 2_add_is_public.up.sql
ALTER TABLE stories
  ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT false;

-- Migration: 3_add_avatar_developments.up.sql
ALTER TABLE stories ADD COLUMN avatar_developments TEXT;
-- === user database ===
-- Migration: 1_create_users.up.sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  subscription TEXT NOT NULL DEFAULT 'starter',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);

-- Migration: 2_add_role.up.sql
ALTER TABLE users
  ADD COLUMN role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin'));

-- === ai database ===
-- Migration: 1_create_personality_tracking.up.sql
CREATE TYPE content_type_enum AS ENUM('story', 'doku', 'quiz');

CREATE TABLE personality_updates (
    id VARCHAR(36) PRIMARY KEY,
    avatar_id VARCHAR(36) NOT NULL,
    content_id VARCHAR(36) NOT NULL,
    content_type content_type_enum NOT NULL,
    content_title VARCHAR(255) NOT NULL,
    changes_json JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Ensure each avatar can only get updates once per content
    CONSTRAINT unique_avatar_content UNIQUE (avatar_id, content_id, content_type)
);

-- Indexes for performance
CREATE INDEX idx_avatar_id ON personality_updates (avatar_id);
CREATE INDEX idx_content ON personality_updates (content_id, content_type);
CREATE INDEX idx_created_at ON personality_updates (created_at);
