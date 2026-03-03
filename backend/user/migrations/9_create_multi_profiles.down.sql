DROP TABLE IF EXISTS quota_ledger CASCADE;
DROP TABLE IF EXISTS profile_quota_policies CASCADE;
DROP TABLE IF EXISTS child_profiles CASCADE;

ALTER TABLE users
DROP COLUMN IF EXISTS family_reserve_doku_used;

ALTER TABLE users
DROP COLUMN IF EXISTS family_reserve_story_used;

ALTER TABLE users
DROP COLUMN IF EXISTS family_reserve_doku;

ALTER TABLE users
DROP COLUMN IF EXISTS family_reserve_story;

ALTER TABLE users
DROP COLUMN IF EXISTS extra_profile_addons;

