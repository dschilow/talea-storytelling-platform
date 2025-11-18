-- Rollback Migration 14: Remove Enhanced Matching Requirements from Fairy Tale Roles

-- Drop indexes
DROP INDEX IF EXISTS idx_fairy_tale_roles_age;
DROP INDEX IF EXISTS idx_fairy_tale_roles_gender;
DROP INDEX IF EXISTS idx_fairy_tale_roles_species;

-- Remove columns
ALTER TABLE fairy_tale_roles
  DROP COLUMN IF EXISTS social_class_requirement,
  DROP COLUMN IF EXISTS size_requirement,
  DROP COLUMN IF EXISTS age_requirement,
  DROP COLUMN IF EXISTS gender_requirement,
  DROP COLUMN IF EXISTS species_requirement;
