DROP INDEX IF EXISTS idx_avatar_memories_profile;
DROP INDEX IF EXISTS idx_avatar_memories_retrieval;

ALTER TABLE avatar_memories
DROP CONSTRAINT IF EXISTS avatar_memories_importance_check;

ALTER TABLE avatar_memories
DROP CONSTRAINT IF EXISTS avatar_memories_memory_tier_check;

ALTER TABLE avatar_memories
DROP COLUMN IF EXISTS is_pinned,
DROP COLUMN IF EXISTS recall_count,
DROP COLUMN IF EXISTS last_recalled_at,
DROP COLUMN IF EXISTS tags,
DROP COLUMN IF EXISTS summary,
DROP COLUMN IF EXISTS importance,
DROP COLUMN IF EXISTS memory_tier,
DROP COLUMN IF EXISTS profile_id;

DROP INDEX IF EXISTS idx_avatars_one_child_per_profile;

ALTER TABLE avatars
DROP CONSTRAINT IF EXISTS avatars_avatar_role_check;
