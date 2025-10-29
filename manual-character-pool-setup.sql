-- Manual Character Pool Setup Script
-- Run this directly in Railway Postgres console if the init endpoint doesn't work

-- 1. Create character_pool table
CREATE TABLE IF NOT EXISTS character_pool (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  archetype TEXT NOT NULL,
  emotional_nature JSONB NOT NULL,
  visual_profile JSONB NOT NULL,
  max_screen_time INTEGER DEFAULT 50,
  available_chapters INTEGER[] DEFAULT '{1,2,3,4,5}',
  canon_settings TEXT[] DEFAULT '{}',
  recent_usage_count INTEGER DEFAULT 0,
  total_usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_character_pool_role ON character_pool(role);
CREATE INDEX IF NOT EXISTS idx_character_pool_archetype ON character_pool(archetype);
CREATE INDEX IF NOT EXISTS idx_character_pool_active ON character_pool(is_active);

-- 2. Create story_characters junction table
CREATE TABLE IF NOT EXISTS story_characters (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  character_id TEXT NOT NULL REFERENCES character_pool(id),
  placeholder TEXT NOT NULL,
  chapters_appeared INTEGER[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_story_characters_story ON story_characters(story_id);
CREATE INDEX IF NOT EXISTS idx_story_characters_character ON story_characters(character_id);

-- 3. Create story_skeletons table
CREATE TABLE IF NOT EXISTS story_skeletons (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  title TEXT,
  chapters JSONB NOT NULL,
  supporting_character_requirements JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_story_skeletons_story ON story_skeletons(story_id);

-- 4. Add avatar_developments to stories if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='stories' AND column_name='avatar_developments') THEN
    ALTER TABLE stories ADD COLUMN avatar_developments JSONB;
  END IF;
END $$;

-- 5. Check if tables were created
SELECT 'character_pool' as table_name, COUNT(*) as row_count FROM character_pool
UNION ALL
SELECT 'story_characters', COUNT(*) FROM story_characters
UNION ALL
SELECT 'story_skeletons', COUNT(*) FROM story_skeletons;
