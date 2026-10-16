DROP INDEX IF EXISTS idx_character_pool_can_oppose;
DROP INDEX IF EXISTS idx_character_pool_can_lead;

ALTER TABLE character_pool
  DROP COLUMN IF EXISTS bible_version,
  DROP COLUMN IF EXISTS signature_visual,
  DROP COLUMN IF EXISTS intro_line,
  DROP COLUMN IF EXISTS villain_style,
  DROP COLUMN IF EXISTS can_oppose,
  DROP COLUMN IF EXISTS can_lead,
  DROP COLUMN IF EXISTS comic_role,
  DROP COLUMN IF EXISTS gesture,
  DROP COLUMN IF EXISTS running_gag,
  DROP COLUMN IF EXISTS secret,
  DROP COLUMN IF EXISTS fear,
  DROP COLUMN IF EXISTS want;
