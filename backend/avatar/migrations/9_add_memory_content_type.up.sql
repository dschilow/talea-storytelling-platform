ALTER TABLE avatar_memories
ADD COLUMN IF NOT EXISTS content_type TEXT NOT NULL DEFAULT 'story';

UPDATE avatar_memories
SET content_type = CASE
  WHEN LOWER(COALESCE(story_title, '')) LIKE '%quiz%' OR LOWER(COALESCE(experience, '')) LIKE '%quiz%' THEN 'quiz'
  WHEN LOWER(COALESCE(story_title, '')) LIKE '%doku%' OR LOWER(COALESCE(experience, '')) LIKE '%doku%' THEN 'doku'
  ELSE 'story'
END
WHERE content_type IS NULL OR content_type = '';

ALTER TABLE avatar_memories
DROP CONSTRAINT IF EXISTS avatar_memories_content_type_check;

ALTER TABLE avatar_memories
ADD CONSTRAINT avatar_memories_content_type_check
CHECK (content_type IN ('story', 'doku', 'quiz', 'activity'));

DELETE FROM avatar_memories t
USING (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY avatar_id, content_type, story_id
        ORDER BY created_at DESC, id DESC
      ) AS rn
    FROM avatar_memories
    WHERE story_id IS NOT NULL
  ) ranked
  WHERE rn > 1
) dupes
WHERE t.id = dupes.id;

CREATE INDEX IF NOT EXISTS idx_avatar_memories_content_type
ON avatar_memories(content_type);

CREATE UNIQUE INDEX IF NOT EXISTS idx_avatar_memories_unique_avatar_content
ON avatar_memories(avatar_id, content_type, story_id)
WHERE story_id IS NOT NULL;
