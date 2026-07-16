ALTER TABLE child_profiles
ADD COLUMN IF NOT EXISTS child_avatar_id TEXT;

WITH ranked_child_links AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY child_avatar_id
           ORDER BY is_default DESC, created_at ASC, id ASC
         ) AS row_number
  FROM child_profiles
  WHERE child_avatar_id IS NOT NULL
)
UPDATE child_profiles SET child_avatar_id = NULL WHERE id IN (SELECT id FROM ranked_child_links WHERE row_number > 1);

CREATE UNIQUE INDEX IF NOT EXISTS idx_child_profiles_child_avatar
ON child_profiles(child_avatar_id)
WHERE child_avatar_id IS NOT NULL;
