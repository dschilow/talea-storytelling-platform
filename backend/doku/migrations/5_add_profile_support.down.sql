DROP TABLE IF EXISTS audio_doku_profile_state CASCADE;
DROP TABLE IF EXISTS doku_quiz_results CASCADE;
DROP TABLE IF EXISTS doku_profile_state CASCADE;
DROP TABLE IF EXISTS doku_participants CASCADE;

ALTER TABLE dokus
DROP COLUMN IF EXISTS primary_profile_id;

