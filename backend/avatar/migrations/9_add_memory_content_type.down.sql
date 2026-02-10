DROP INDEX IF EXISTS idx_avatar_memories_unique_avatar_content;
DROP INDEX IF EXISTS idx_avatar_memories_content_type;

ALTER TABLE avatar_memories
DROP CONSTRAINT IF EXISTS avatar_memories_content_type_check;

ALTER TABLE avatar_memories
DROP COLUMN IF EXISTS content_type;
