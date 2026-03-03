DROP TABLE IF EXISTS story_quiz_results CASCADE;
DROP TABLE IF EXISTS story_profile_state CASCADE;
DROP TABLE IF EXISTS story_participants CASCADE;

ALTER TABLE stories
DROP COLUMN IF EXISTS primary_profile_id;

