DROP INDEX IF EXISTS idx_child_profiles_child_avatar;

ALTER TABLE child_profiles
DROP COLUMN IF EXISTS child_avatar_id;
