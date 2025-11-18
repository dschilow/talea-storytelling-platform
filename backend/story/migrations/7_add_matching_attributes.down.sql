-- Rollback: Remove matching attributes from character pool

-- Drop indexes
DROP INDEX IF EXISTS idx_character_pool_profession_tags;
DROP INDEX IF EXISTS idx_character_pool_social_class;
DROP INDEX IF EXISTS idx_character_pool_size;
DROP INDEX IF EXISTS idx_character_pool_age;
DROP INDEX IF EXISTS idx_character_pool_gender;
DROP INDEX IF EXISTS idx_character_pool_species;

-- Remove columns
ALTER TABLE character_pool
  DROP COLUMN IF EXISTS backstory,
  DROP COLUMN IF EXISTS physical_description,
  DROP COLUMN IF EXISTS personality_keywords,
  DROP COLUMN IF EXISTS social_class,
  DROP COLUMN IF EXISTS size_category,
  DROP COLUMN IF EXISTS profession_tags,
  DROP COLUMN IF EXISTS species_category,
  DROP COLUMN IF EXISTS age_category,
  DROP COLUMN IF EXISTS gender;
