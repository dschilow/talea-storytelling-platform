DROP TRIGGER IF EXISTS character_publication ON character_pool;
DROP FUNCTION IF EXISTS stamp_character_publication();
ALTER TABLE character_pool DROP COLUMN IF EXISTS published_at;
