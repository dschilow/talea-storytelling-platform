-- Rollback: Remove V2 personality fields from character_pool

DROP INDEX IF EXISTS idx_character_pool_dominant_personality;

ALTER TABLE character_pool
  DROP COLUMN IF EXISTS dominant_personality,
  DROP COLUMN IF EXISTS secondary_traits,
  DROP COLUMN IF EXISTS catchphrase,
  DROP COLUMN IF EXISTS catchphrase_context,
  DROP COLUMN IF EXISTS speech_style,
  DROP COLUMN IF EXISTS emotional_triggers,
  DROP COLUMN IF EXISTS quirk;
