-- Migration: Add tags and visual keywords to character_pool for improved matching
-- Date: 2025-10-31
-- Purpose: Enhance character matching with searchable tags and visual attributes

-- Add new columns for improved matching
ALTER TABLE character_pool 
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS visual_tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS profession_tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS setting_affinity JSONB DEFAULT '{}';

-- Create indexes for better search performance
CREATE INDEX IF NOT EXISTS idx_character_pool_tags ON character_pool USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_character_pool_visual_tags ON character_pool USING GIN (visual_tags);
CREATE INDEX IF NOT EXISTS idx_character_pool_profession_tags ON character_pool USING GIN (profession_tags);
CREATE INDEX IF NOT EXISTS idx_character_pool_setting_affinity ON character_pool USING GIN (setting_affinity);

-- Add comments
COMMENT ON COLUMN character_pool.tags IS 'General character tags for matching (e.g., ["wise", "helpful", "mysterious"])';
COMMENT ON COLUMN character_pool.visual_tags IS 'Visual appearance tags (e.g., ["glasses", "beard", "tall", "mechanical"])';
COMMENT ON COLUMN character_pool.profession_tags IS 'Profession/role tags (e.g., ["doctor", "teacher", "baker"])';
COMMENT ON COLUMN character_pool.setting_affinity IS 'Setting compatibility scores {"forest": 10, "city": 8, "space": 3}';

-- Function to auto-generate tags from existing data
CREATE OR REPLACE FUNCTION update_character_tags()
RETURNS void AS $$
DECLARE
  char_record RECORD;
  new_tags TEXT[];
  new_visual_tags TEXT[];
  new_profession_tags TEXT[];
BEGIN
  FOR char_record IN SELECT id, archetype, emotional_nature, visual_profile FROM character_pool
  LOOP
    new_tags := '{}';
    new_visual_tags := '{}';
    new_profession_tags := '{}';

    -- Extract tags from archetype
    IF char_record.archetype IS NOT NULL THEN
      new_tags := new_tags || ARRAY[LOWER(char_record.archetype)];
    END IF;

    -- Extract tags from emotional nature
    IF char_record.emotional_nature IS NOT NULL THEN
      DECLARE
        emotional_data JSONB;
        dominant TEXT;
        secondary_array TEXT[];
      BEGIN
        emotional_data := char_record.emotional_nature::JSONB;
        dominant := emotional_data->>'dominant';
        
        IF dominant IS NOT NULL THEN
          new_tags := new_tags || ARRAY[LOWER(dominant)];
        END IF;

        -- Extract secondary traits
        IF emotional_data->'secondary' IS NOT NULL THEN
          SELECT ARRAY_AGG(LOWER(value::TEXT)) INTO secondary_array
          FROM jsonb_array_elements_text(emotional_data->'secondary');
          
          IF secondary_array IS NOT NULL THEN
            new_tags := new_tags || secondary_array;
          END IF;
        END IF;
      END;
    END IF;

    -- Extract visual tags from visual profile
    IF char_record.visual_profile IS NOT NULL THEN
      DECLARE
        visual_data JSONB;
        description TEXT;
        species TEXT;
      BEGIN
        visual_data := char_record.visual_profile::JSONB;
        description := LOWER(visual_data->>'description');
        species := LOWER(visual_data->>'species');

        -- Common visual keywords
        IF description ~ 'glasses|brille' THEN
          new_visual_tags := new_visual_tags || ARRAY['glasses'];
        END IF;
        
        IF description ~ 'beard|bart' THEN
          new_visual_tags := new_visual_tags || ARRAY['beard'];
        END IF;
        
        IF description ~ 'tall|gross|large' THEN
          new_visual_tags := new_visual_tags || ARRAY['tall'];
        END IF;
        
        IF description ~ 'small|klein|kurz' THEN
          new_visual_tags := new_visual_tags || ARRAY['small'];
        END IF;
        
        IF description ~ 'mechanical|robot|blech|metal' THEN
          new_visual_tags := new_visual_tags || ARRAY['mechanical'];
        END IF;

        -- Species tag
        IF species IS NOT NULL AND species != '' THEN
          new_visual_tags := new_visual_tags || ARRAY[species];
        END IF;

        -- Profession extraction
        IF description ~ 'doctor|arzt|doktor' THEN
          new_profession_tags := new_profession_tags || ARRAY['doctor'];
        END IF;
        
        IF description ~ 'teacher|lehrer|lehrerin' THEN
          new_profession_tags := new_profession_tags || ARRAY['teacher'];
        END IF;
        
        IF description ~ 'baker|bäcker|baecker' THEN
          new_profession_tags := new_profession_tags || ARRAY['baker'];
        END IF;
        
        IF description ~ 'police|polizist' THEN
          new_profession_tags := new_profession_tags || ARRAY['police'];
        END IF;
      END;
    END IF;

    -- Update the character with new tags
    UPDATE character_pool
    SET 
      tags = new_tags,
      visual_tags = new_visual_tags,
      profession_tags = new_profession_tags,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = char_record.id;
  END LOOP;

  RAISE NOTICE 'Character tags updated successfully';
END;
$$ LANGUAGE plpgsql;

-- Execute the function to populate tags
SELECT update_character_tags();

-- Example query to find characters by tags
-- SELECT name, archetype, tags, visual_tags, profession_tags
-- FROM character_pool
-- WHERE 'wise' = ANY(tags)
--   AND 'glasses' = ANY(visual_tags)
--   AND is_active = TRUE
-- ORDER BY recent_usage_count ASC
-- LIMIT 5;
