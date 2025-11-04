-- Migration 009: Create Fairy Tales System
-- Implements professional story generation system with avatar integration

-- =====================================================
-- FAIRY TALES CORE TABLES
-- =====================================================

-- Fairy tales catalog table
CREATE TABLE IF NOT EXISTS fairy_tales (
  id VARCHAR(50) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  source VARCHAR(100) NOT NULL,  -- grimm, andersen, russian, etc.
  original_language VARCHAR(50),
  english_translation VARCHAR(255),
  culture_region VARCHAR(50),
  age_recommendation INT NOT NULL,
  duration_minutes INT DEFAULT 10,
  genre_tags JSONB DEFAULT '[]'::jsonb,
  moral_lesson VARCHAR(500),
  summary TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_fairy_tales_source (source),
  INDEX idx_fairy_tales_age (age_recommendation),
  INDEX idx_fairy_tales_active (is_active)
);

-- Fairy tale roles definition
CREATE TABLE IF NOT EXISTS fairy_tale_roles (
  id SERIAL PRIMARY KEY,
  tale_id VARCHAR(50) NOT NULL,
  role_type VARCHAR(50) NOT NULL,  -- protagonist, antagonist, helper, love_interest, supporting
  role_name VARCHAR(100),
  role_count INT DEFAULT 1,
  description TEXT,
  required BOOLEAN DEFAULT true,
  archetype_preference VARCHAR(100),  -- hero, villain, trickster, sage, etc.
  age_range_min INT,
  age_range_max INT,
  profession_preference JSONB DEFAULT '[]'::jsonb,  -- ["child", "wizard", "animal"]
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tale_id) REFERENCES fairy_tales(id) ON DELETE CASCADE,
  INDEX idx_fairy_tale_roles_tale (tale_id),
  INDEX idx_fairy_tale_roles_type (role_type)
);

-- Narrative blocks/scenes for each tale
CREATE TABLE IF NOT EXISTS fairy_tale_scenes (
  id SERIAL PRIMARY KEY,
  tale_id VARCHAR(50) NOT NULL,
  scene_number INT NOT NULL,
  scene_title VARCHAR(255),
  scene_description TEXT NOT NULL,
  dialogue_template TEXT,
  character_variables JSONB DEFAULT '{}'::jsonb,  -- {"PROTAGONIST": "name", "HELPER": "name"}
  setting VARCHAR(255),  -- "forest", "castle", "village"
  mood VARCHAR(100),  -- "mysterious", "happy", "tense"
  illustration_prompt_template TEXT,
  duration_seconds INT DEFAULT 60,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tale_id) REFERENCES fairy_tales(id) ON DELETE CASCADE,
  INDEX idx_fairy_tale_scenes_tale (tale_id),
  INDEX idx_fairy_tale_scenes_number (tale_id, scene_number),
  UNIQUE (tale_id, scene_number)
);

-- =====================================================
-- STORY GENERATION TABLES
-- =====================================================

-- Generated stories with avatar mappings
CREATE TABLE IF NOT EXISTS generated_stories (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  tale_id VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  story_text TEXT,
  character_mappings JSONB NOT NULL,  -- {"protagonist": "avatar-id-123", "helper": "avatar-id-456"}
  generation_params JSONB,  -- length, style, etc.
  status VARCHAR(50) DEFAULT 'generating',  -- generating, ready, failed
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tale_id) REFERENCES fairy_tales(id),
  INDEX idx_generated_stories_user (user_id),
  INDEX idx_generated_stories_tale (tale_id),
  INDEX idx_generated_stories_status (status),
  INDEX idx_generated_stories_created (created_at)
);

-- Generated story scenes with images
CREATE TABLE IF NOT EXISTS generated_story_scenes (
  id SERIAL PRIMARY KEY,
  story_id VARCHAR(36) NOT NULL,
  scene_number INT NOT NULL,
  scene_text TEXT NOT NULL,
  image_url VARCHAR(500),
  image_prompt TEXT,
  image_generation_status VARCHAR(50) DEFAULT 'pending',  -- pending, generating, ready, failed
  consistency_score DECIMAL(3,1),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (story_id) REFERENCES generated_stories(id) ON DELETE CASCADE,
  INDEX idx_generated_story_scenes_story (story_id),
  INDEX idx_generated_story_scenes_number (story_id, scene_number),
  UNIQUE (story_id, scene_number)
);

-- =====================================================
-- CHARACTER CONSISTENCY TABLES
-- =====================================================

-- Avatar consistency profiles for image generation
CREATE TABLE IF NOT EXISTS avatar_consistency_profiles (
  avatar_id VARCHAR(36) PRIMARY KEY,
  key_identifiers JSONB NOT NULL,  -- {profession, age, hair_color, eye_color, etc}
  immutable_features JSONB NOT NULL,  -- Features that must NEVER change
  varying_features JSONB NOT NULL,  -- Features that can vary (emotions, poses)
  consistency_hash VARCHAR(64),
  consistency_score DECIMAL(3,1) DEFAULT 10.0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE CASCADE,
  INDEX idx_avatar_consistency_avatar (avatar_id)
);

-- =====================================================
-- ANALYTICS & TRACKING
-- =====================================================

-- Track which tales are most popular
CREATE TABLE IF NOT EXISTS fairy_tale_usage_stats (
  tale_id VARCHAR(50) PRIMARY KEY,
  total_generations INT DEFAULT 0,
  successful_generations INT DEFAULT 0,
  failed_generations INT DEFAULT 0,
  avg_generation_time_seconds DECIMAL(10,2),
  last_generated_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tale_id) REFERENCES fairy_tales(id) ON DELETE CASCADE,
  INDEX idx_fairy_tale_usage_tale (tale_id)
);

-- =====================================================
-- TRIGGERS & FUNCTIONS
-- =====================================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_fairy_tales_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER fairy_tales_updated_at
  BEFORE UPDATE ON fairy_tales
  FOR EACH ROW
  EXECUTE FUNCTION update_fairy_tales_updated_at();

CREATE TRIGGER fairy_tale_scenes_updated_at
  BEFORE UPDATE ON fairy_tale_scenes
  FOR EACH ROW
  EXECUTE FUNCTION update_fairy_tales_updated_at();

CREATE TRIGGER generated_stories_updated_at
  BEFORE UPDATE ON generated_stories
  FOR EACH ROW
  EXECUTE FUNCTION update_fairy_tales_updated_at();

CREATE TRIGGER generated_story_scenes_updated_at
  BEFORE UPDATE ON generated_story_scenes
  FOR EACH ROW
  EXECUTE FUNCTION update_fairy_tales_updated_at();

-- =====================================================
-- INITIAL DATA SEED
-- =====================================================

-- Add sample fairy tale for testing
INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary)
VALUES (
  'grimm-015',
  'Hänsel und Gretel',
  'grimm',
  'de',
  'Hansel and Gretel',
  'german',
  7,
  15,
  '["adventure", "dark", "moral", "family"]'::jsonb,
  'Cleverness and courage triumph over greed and evil',
  'Two siblings are abandoned in the forest and must use their wits to escape a wicked witch who lives in a gingerbread house.'
) ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE fairy_tales IS 'Catalog of fairy tales available for story generation';
COMMENT ON TABLE fairy_tale_roles IS 'Role definitions for each fairy tale (protagonist, antagonist, etc.)';
COMMENT ON TABLE fairy_tale_scenes IS 'Narrative scenes/blocks for each fairy tale';
COMMENT ON TABLE generated_stories IS 'User-generated stories with avatar mappings';
COMMENT ON TABLE generated_story_scenes IS 'Individual scenes of generated stories with images';
COMMENT ON TABLE avatar_consistency_profiles IS 'Consistency profiles for avatar image generation';
