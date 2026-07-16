ALTER TABLE avatars
ADD COLUMN IF NOT EXISTS avatar_role TEXT NOT NULL DEFAULT 'companion';

UPDATE avatars
SET avatar_role = 'companion'
WHERE avatar_role IS NULL OR avatar_role NOT IN ('child', 'companion');

ALTER TABLE avatars
DROP CONSTRAINT IF EXISTS avatars_avatar_role_check;

ALTER TABLE avatars
ADD CONSTRAINT avatars_avatar_role_check
CHECK (avatar_role IN ('child', 'companion'));

WITH ranked_child_avatars AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, profile_id
           ORDER BY created_at ASC, id ASC
         ) AS row_number
  FROM avatars
  WHERE avatar_role = 'child' AND profile_id IS NOT NULL
)
UPDATE avatars SET avatar_role = 'companion' WHERE id IN (SELECT id FROM ranked_child_avatars WHERE row_number > 1);
UPDATE avatars
SET is_public = FALSE
WHERE avatar_role = 'child';


CREATE UNIQUE INDEX IF NOT EXISTS idx_avatars_one_child_per_profile
ON avatars(user_id, profile_id)
WHERE avatar_role = 'child' AND profile_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS avatar_profile_links (
  avatar_id TEXT NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (avatar_id, profile_id)
);

-- Historic profile links pointed multiple child profiles at one mutable avatar.
-- Materialize each link as a profile-local companion with the same visual
-- identity but a fresh journey (traits, inventory, skills and memories).
INSERT INTO avatars (
  id,
  user_id,
  profile_id,
  name,
  description,
  physical_traits,
  personality_traits,
  image_url,
  visual_profile,
  creation_type,
  is_public,
  source_type,
  avatar_role,
  source_avatar_id,
  original_avatar_id,
  created_at,
  updated_at,
  inventory,
  skills
)
SELECT
  gen_random_uuid()::text,
  links.user_id,
  links.profile_id,
  source.name,
  source.description,
  source.physical_traits,
  jsonb_build_object(
    'knowledge', jsonb_build_object('value', 0, 'subcategories', jsonb_build_object()),
    'creativity', jsonb_build_object('value', 0, 'subcategories', jsonb_build_object()),
    'vocabulary', jsonb_build_object('value', 0, 'subcategories', jsonb_build_object()),
    'courage', jsonb_build_object('value', 0, 'subcategories', jsonb_build_object()),
    'curiosity', jsonb_build_object('value', 0, 'subcategories', jsonb_build_object()),
    'teamwork', jsonb_build_object('value', 0, 'subcategories', jsonb_build_object()),
    'empathy', jsonb_build_object('value', 0, 'subcategories', jsonb_build_object()),
    'persistence', jsonb_build_object('value', 0, 'subcategories', jsonb_build_object()),
    'logic', jsonb_build_object('value', 0, 'subcategories', jsonb_build_object())
  )::text,
  source.image_url,
  source.visual_profile,
  source.creation_type,
  FALSE,
  'clone',
  'companion',
  source.id,
  COALESCE(source.original_avatar_id, source.source_avatar_id, source.id),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  '[]',
  '[]'
FROM avatar_profile_links AS links
JOIN avatars AS source
  ON source.id = links.avatar_id
 AND source.user_id = links.user_id
WHERE source.profile_id IS DISTINCT FROM links.profile_id
  AND NOT EXISTS (
    SELECT 1
    FROM avatars AS existing
    WHERE existing.user_id = links.user_id
      AND existing.profile_id = links.profile_id
      AND existing.avatar_role = 'companion'
      AND (
        existing.source_avatar_id = source.id
        OR existing.original_avatar_id = COALESCE(
          source.original_avatar_id,
          source.source_avatar_id,
          source.id
        )
      )
  );

-- Links are no longer read by the application. Keeping an empty table makes
-- rollback/runtime helpers harmless while preventing shared mutable state.
DELETE FROM avatar_profile_links;


CREATE INDEX IF NOT EXISTS idx_avatar_profile_links_user_profile
ON avatar_profile_links(user_id, profile_id);

ALTER TABLE avatar_memories
ADD COLUMN IF NOT EXISTS profile_id TEXT;

ALTER TABLE avatar_memories
ADD COLUMN IF NOT EXISTS memory_tier TEXT NOT NULL DEFAULT 'episodic';

ALTER TABLE avatar_memories
ADD COLUMN IF NOT EXISTS importance SMALLINT NOT NULL DEFAULT 2;

ALTER TABLE avatar_memories
ADD COLUMN IF NOT EXISTS summary TEXT;

ALTER TABLE avatar_memories
ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE avatar_memories
ADD COLUMN IF NOT EXISTS last_recalled_at TIMESTAMP;

ALTER TABLE avatar_memories
ADD COLUMN IF NOT EXISTS recall_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE avatar_memories
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE avatar_memories m
SET profile_id = a.profile_id,
    summary = LEFT(COALESCE(NULLIF(m.experience, ''), m.story_title, 'Memory'), 240)
FROM avatars a
WHERE a.id = m.avatar_id
  AND (m.profile_id IS NULL OR m.summary IS NULL);

ALTER TABLE avatar_memories
DROP CONSTRAINT IF EXISTS avatar_memories_memory_tier_check;

ALTER TABLE avatar_memories
ADD CONSTRAINT avatar_memories_memory_tier_check
CHECK (memory_tier IN ('working', 'episodic', 'core'));

ALTER TABLE avatar_memories
DROP CONSTRAINT IF EXISTS avatar_memories_importance_check;

ALTER TABLE avatar_memories
ADD CONSTRAINT avatar_memories_importance_check
CHECK (importance BETWEEN 1 AND 5);

CREATE INDEX IF NOT EXISTS idx_avatar_memories_retrieval
ON avatar_memories(avatar_id, is_pinned DESC, importance DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_avatar_memories_profile
ON avatar_memories(profile_id, created_at DESC);
