-- Migration 14: Add Enhanced Matching Requirements to Fairy Tale Roles
-- Enables species, gender, age, size, and social class filtering for precise character matching

-- Add new columns for enhanced role matching
ALTER TABLE fairy_tale_roles
  ADD COLUMN IF NOT EXISTS species_requirement TEXT CHECK(species_requirement IN ('human', 'humanoid', 'animal', 'magical_creature', 'mythical', 'elemental', 'any')) DEFAULT 'any',
  ADD COLUMN IF NOT EXISTS gender_requirement TEXT CHECK(gender_requirement IN ('male', 'female', 'neutral', 'any')) DEFAULT 'any',
  ADD COLUMN IF NOT EXISTS age_requirement TEXT CHECK(age_requirement IN ('child', 'teenager', 'young_adult', 'adult', 'elder', 'ageless', 'any')) DEFAULT 'any',
  ADD COLUMN IF NOT EXISTS size_requirement TEXT CHECK(size_requirement IN ('tiny', 'small', 'medium', 'large', 'giant', 'any')) DEFAULT 'any',
  ADD COLUMN IF NOT EXISTS social_class_requirement TEXT CHECK(social_class_requirement IN ('royalty', 'nobility', 'merchant', 'craftsman', 'commoner', 'outcast', 'any')) DEFAULT 'any';

-- Create indexes for filtering performance
CREATE INDEX IF NOT EXISTS idx_fairy_tale_roles_species ON fairy_tale_roles(species_requirement);
CREATE INDEX IF NOT EXISTS idx_fairy_tale_roles_gender ON fairy_tale_roles(gender_requirement);
CREATE INDEX IF NOT EXISTS idx_fairy_tale_roles_age ON fairy_tale_roles(age_requirement);

-- Update existing Rumpelstilzchen roles with proper requirements
-- This is the reference fairy tale - ensure perfect matching!

-- König (King) - Must be human male adult royalty
UPDATE fairy_tale_roles
SET
  species_requirement = 'human',
  gender_requirement = 'male',
  age_requirement = 'adult',
  size_requirement = 'medium',
  social_class_requirement = 'royalty'
WHERE tale_id = 'grimm-055'
  AND role_name ILIKE '%könig%'
  AND role_type = 'authority';

-- Müller (Miller) - Must be human male adult craftsman
UPDATE fairy_tale_roles
SET
  species_requirement = 'human',
  gender_requirement = 'male',
  age_requirement = 'adult',
  size_requirement = 'medium',
  social_class_requirement = 'craftsman'
WHERE tale_id = 'grimm-055'
  AND role_name ILIKE '%müller%'
  AND role_type = 'obstacle';

-- Müllerstochter (Miller's Daughter) - Must be human female young_adult
UPDATE fairy_tale_roles
SET
  species_requirement = 'human',
  gender_requirement = 'female',
  age_requirement = 'young_adult',
  size_requirement = 'medium',
  social_class_requirement = 'commoner'
WHERE tale_id = 'grimm-055'
  AND role_name ILIKE '%tochter%'
  AND role_type = 'protagonist';

-- Rumpelstilzchen - Magical creature, male, small
UPDATE fairy_tale_roles
SET
  species_requirement = 'magical_creature',
  gender_requirement = 'male',
  age_requirement = 'ageless',
  size_requirement = 'small',
  social_class_requirement = 'any'
WHERE tale_id = 'grimm-055'
  AND role_name ILIKE '%rumpelstilzchen%'
  AND role_type = 'antagonist';

-- Update common role patterns across all fairy tales with intelligent inference

-- Kings (Könige) - Human male adult royalty
UPDATE fairy_tale_roles
SET
  species_requirement = 'human',
  gender_requirement = 'male',
  age_requirement = 'adult',
  social_class_requirement = 'royalty'
WHERE (role_name ILIKE '%könig%' OR role_name ILIKE '%king%')
  AND role_type IN ('authority', 'obstacle', 'support')
  AND species_requirement = 'any';

-- Queens (Königinnen) - Human female adult royalty
UPDATE fairy_tale_roles
SET
  species_requirement = 'human',
  gender_requirement = 'female',
  age_requirement = 'adult',
  social_class_requirement = 'royalty'
WHERE (role_name ILIKE '%königin%' OR role_name ILIKE '%queen%')
  AND species_requirement = 'any';

-- Princes (Prinzen) - Human male young_adult nobility
UPDATE fairy_tale_roles
SET
  species_requirement = 'human',
  gender_requirement = 'male',
  age_requirement = 'young_adult',
  social_class_requirement = 'nobility'
WHERE (role_name ILIKE '%prinz%' OR role_name ILIKE '%prince%')
  AND role_name NOT ILIKE '%prinzessin%'
  AND species_requirement = 'any';

-- Princesses (Prinzessinnen) - Human female young_adult nobility
UPDATE fairy_tale_roles
SET
  species_requirement = 'human',
  gender_requirement = 'female',
  age_requirement = 'young_adult',
  social_class_requirement = 'nobility'
WHERE (role_name ILIKE '%prinzessin%' OR role_name ILIKE '%princess%')
  AND species_requirement = 'any';

-- Witches (Hexen) - Human female elder with magical profession
UPDATE fairy_tale_roles
SET
  species_requirement = 'human',
  gender_requirement = 'female',
  age_requirement = 'elder',
  social_class_requirement = 'outcast'
WHERE (role_name ILIKE '%hexe%' OR role_name ILIKE '%witch%')
  AND species_requirement = 'any';

-- Wizards/Magicians (Zauberer) - Human male elder with magical profession
UPDATE fairy_tale_roles
SET
  species_requirement = 'human',
  gender_requirement = 'male',
  age_requirement = 'elder',
  social_class_requirement = 'any'
WHERE (role_name ILIKE '%zauberer%' OR role_name ILIKE '%magier%' OR role_name ILIKE '%wizard%')
  AND species_requirement = 'any';

-- Millers (Müller) - Human male adult craftsman
UPDATE fairy_tale_roles
SET
  species_requirement = 'human',
  gender_requirement = 'male',
  age_requirement = 'adult',
  social_class_requirement = 'craftsman'
WHERE (role_name ILIKE '%müller%' OR role_name ILIKE '%miller%')
  AND species_requirement = 'any';

-- Bakers (Bäcker) - Human adult craftsman
UPDATE fairy_tale_roles
SET
  species_requirement = 'human',
  age_requirement = 'adult',
  social_class_requirement = 'craftsman'
WHERE (role_name ILIKE '%bäcker%' OR role_name ILIKE '%baker%')
  AND species_requirement = 'any';

-- Blacksmiths (Schmiede) - Human male adult craftsman, large size
UPDATE fairy_tale_roles
SET
  species_requirement = 'human',
  gender_requirement = 'male',
  age_requirement = 'adult',
  size_requirement = 'large',
  social_class_requirement = 'craftsman'
WHERE (role_name ILIKE '%schmied%' OR role_name ILIKE '%blacksmith%')
  AND species_requirement = 'any';

-- Merchants/Traders (Händler) - Human adult merchant class
UPDATE fairy_tale_roles
SET
  species_requirement = 'human',
  age_requirement = 'adult',
  social_class_requirement = 'merchant'
WHERE (role_name ILIKE '%händler%' OR role_name ILIKE '%kaufmann%' OR role_name ILIKE '%merchant%')
  AND species_requirement = 'any';

-- Daughters (Töchter) - Human female young_adult
UPDATE fairy_tale_roles
SET
  species_requirement = 'human',
  gender_requirement = 'female',
  age_requirement = 'young_adult'
WHERE role_name ILIKE '%tochter%'
  AND species_requirement = 'any';

-- Sons (Söhne) - Human male young_adult
UPDATE fairy_tale_roles
SET
  species_requirement = 'human',
  gender_requirement = 'male',
  age_requirement = 'young_adult'
WHERE role_name ILIKE '%sohn%'
  AND species_requirement = 'any';

-- Mothers (Mütter) - Human female adult
UPDATE fairy_tale_roles
SET
  species_requirement = 'human',
  gender_requirement = 'female',
  age_requirement = 'adult'
WHERE role_name ILIKE '%mutter%'
  AND species_requirement = 'any';

-- Fathers (Väter) - Human male adult
UPDATE fairy_tale_roles
SET
  species_requirement = 'human',
  gender_requirement = 'male',
  age_requirement = 'adult'
WHERE role_name ILIKE '%vater%'
  AND species_requirement = 'any';

-- Children (Kinder) - Human child
UPDATE fairy_tale_roles
SET
  species_requirement = 'human',
  age_requirement = 'child',
  size_requirement = 'small'
WHERE (role_name ILIKE '%kind%' OR role_name ILIKE '%child%' OR role_name ILIKE '%junge%' OR role_name ILIKE '%mädchen%')
  AND species_requirement = 'any';

-- Dwarfs/Gnomes (Zwerge) - Magical creature, small
UPDATE fairy_tale_roles
SET
  species_requirement = 'magical_creature',
  age_requirement = 'ageless',
  size_requirement = 'small'
WHERE (role_name ILIKE '%zwerg%' OR role_name ILIKE '%gnom%' OR role_name ILIKE '%dwarf%')
  AND species_requirement = 'any';

-- Giants (Riesen) - Magical creature or mythical, giant size
UPDATE fairy_tale_roles
SET
  species_requirement = 'magical_creature',
  age_requirement = 'adult',
  size_requirement = 'giant'
WHERE (role_name ILIKE '%riese%' OR role_name ILIKE '%giant%')
  AND species_requirement = 'any';

-- Wolves - Animal
UPDATE fairy_tale_roles
SET
  species_requirement = 'animal',
  age_requirement = 'adult'
WHERE (role_name ILIKE '%wolf%' OR description ILIKE '%wolf%')
  AND species_requirement = 'any';

-- Foxes - Animal, cunning
UPDATE fairy_tale_roles
SET
  species_requirement = 'animal',
  age_requirement = 'adult',
  size_requirement = 'small'
WHERE (role_name ILIKE '%fuchs%' OR role_name ILIKE '%fox%')
  AND species_requirement = 'any';

-- Bears - Animal, large
UPDATE fairy_tale_roles
SET
  species_requirement = 'animal',
  age_requirement = 'adult',
  size_requirement = 'large'
WHERE (role_name ILIKE '%bär%' OR role_name ILIKE '%bear%')
  AND species_requirement = 'any';

-- Birds - Animal, tiny
UPDATE fairy_tale_roles
SET
  species_requirement = 'animal',
  size_requirement = 'tiny'
WHERE (role_name ILIKE '%vogel%' OR role_name ILIKE '%bird%' OR role_name ILIKE '%taube%')
  AND species_requirement = 'any';

-- Add documentation comments
COMMENT ON COLUMN fairy_tale_roles.species_requirement IS 'Required character species: human, humanoid, animal, magical_creature, mythical, elemental, or any';
COMMENT ON COLUMN fairy_tale_roles.gender_requirement IS 'Required character gender: male, female, neutral, or any';
COMMENT ON COLUMN fairy_tale_roles.age_requirement IS 'Required character age: child, teenager, young_adult, adult, elder, ageless, or any';
COMMENT ON COLUMN fairy_tale_roles.size_requirement IS 'Required character size: tiny, small, medium, large, giant, or any';
COMMENT ON COLUMN fairy_tale_roles.social_class_requirement IS 'Required social class: royalty, nobility, merchant, craftsman, commoner, outcast, or any';
