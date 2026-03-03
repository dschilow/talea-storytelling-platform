DROP TABLE IF EXISTS avatar_pool_templates CASCADE;
DROP TABLE IF EXISTS avatar_family_blueprints CASCADE;

ALTER TABLE avatars
DROP COLUMN IF EXISTS source_avatar_id;

ALTER TABLE avatars
DROP COLUMN IF EXISTS source_type;

ALTER TABLE avatars
DROP COLUMN IF EXISTS profile_id;

