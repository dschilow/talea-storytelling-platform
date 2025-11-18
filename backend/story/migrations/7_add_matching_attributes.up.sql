-- Migration: Add comprehensive matching attributes to character pool
-- This enables species, gender, age, profession, and size filtering for accurate role matching

-- Add new columns for enhanced character matching
ALTER TABLE character_pool
  ADD COLUMN IF NOT EXISTS gender TEXT CHECK(gender IN ('male', 'female', 'neutral', 'any')) DEFAULT 'any',
  ADD COLUMN IF NOT EXISTS age_category TEXT CHECK(age_category IN ('child', 'teenager', 'young_adult', 'adult', 'elder', 'ageless', 'any')) DEFAULT 'any',
  ADD COLUMN IF NOT EXISTS species_category TEXT CHECK(species_category IN ('human', 'humanoid', 'animal', 'magical_creature', 'mythical', 'elemental', 'any')) DEFAULT 'any',
  ADD COLUMN IF NOT EXISTS profession_tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS size_category TEXT CHECK(size_category IN ('tiny', 'small', 'medium', 'large', 'giant', 'any')) DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS social_class TEXT CHECK(social_class IN ('royalty', 'nobility', 'merchant', 'craftsman', 'commoner', 'outcast', 'any')) DEFAULT 'any',
  ADD COLUMN IF NOT EXISTS personality_keywords TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS physical_description TEXT,
  ADD COLUMN IF NOT EXISTS backstory TEXT;

-- Create indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_character_pool_species ON character_pool(species_category);
CREATE INDEX IF NOT EXISTS idx_character_pool_gender ON character_pool(gender);
CREATE INDEX IF NOT EXISTS idx_character_pool_age ON character_pool(age_category);
CREATE INDEX IF NOT EXISTS idx_character_pool_size ON character_pool(size_category);
CREATE INDEX IF NOT EXISTS idx_character_pool_social_class ON character_pool(social_class);
CREATE INDEX IF NOT EXISTS idx_character_pool_profession_tags ON character_pool USING GIN(profession_tags);

-- Update existing characters with inferred values
UPDATE character_pool
SET
  species_category =
    CASE
      WHEN visual_profile->>'species' ILIKE '%duck%' THEN 'animal'
      WHEN visual_profile->>'species' ILIKE '%squirrel%' THEN 'animal'
      WHEN visual_profile->>'species' ILIKE '%fox%' THEN 'animal'
      WHEN visual_profile->>'species' ILIKE '%golem%' THEN 'magical_creature'
      WHEN visual_profile->>'species' ILIKE '%magical%' THEN 'magical_creature'
      WHEN visual_profile->>'species' ILIKE '%human%' THEN 'human'
      ELSE 'any'
    END,
  size_category =
    CASE
      WHEN visual_profile->>'description' ILIKE '%240cm%' THEN 'giant'
      WHEN visual_profile->>'description' ILIKE '%small%' THEN 'small'
      WHEN visual_profile->>'description' ILIKE '%medium%' THEN 'medium'
      ELSE 'medium'
    END,
  gender =
    CASE
      WHEN name ILIKE '%emma%' THEN 'female'
      WHEN name ILIKE '%heinrich%' THEN 'male'
      WHEN name ILIKE '%fritz%' THEN 'male'
      ELSE 'neutral'
    END,
  age_category =
    CASE
      WHEN archetype ILIKE '%elder%' THEN 'elder'
      WHEN archetype ILIKE '%child%' THEN 'child'
      ELSE 'adult'
    END
WHERE
  gender IS NULL OR
  species_category IS NULL OR
  size_category IS NULL OR
  age_category IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN character_pool.gender IS 'Character gender: male, female, neutral, or any (for flexible matching)';
COMMENT ON COLUMN character_pool.age_category IS 'Character age group: child, teenager, young_adult, adult, elder, ageless, or any';
COMMENT ON COLUMN character_pool.species_category IS 'Character species: human, humanoid, animal, magical_creature, mythical, elemental, or any';
COMMENT ON COLUMN character_pool.profession_tags IS 'Array of profession/role tags: ["royalty", "craftsman", "warrior", "magical", etc.]';
COMMENT ON COLUMN character_pool.size_category IS 'Physical size: tiny, small, medium, large, giant, or any';
COMMENT ON COLUMN character_pool.social_class IS 'Social position: royalty, nobility, merchant, craftsman, commoner, outcast, or any';
COMMENT ON COLUMN character_pool.personality_keywords IS 'Array of personality traits for matching: ["brave", "cunning", "kind", etc.]';
