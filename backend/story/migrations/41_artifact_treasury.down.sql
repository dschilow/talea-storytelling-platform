ALTER TABLE story_artifacts DROP COLUMN IF EXISTS brought_by_avatar_id;
ALTER TABLE story_artifacts DROP COLUMN IF EXISTS presence;

DROP TABLE IF EXISTS avatar_shard_grants;
DROP TABLE IF EXISTS artifact_shard_offers;
DROP TABLE IF EXISTS avatar_artifact_shards;
DROP TABLE IF EXISTS artifact_journal;

ALTER TABLE artifact_pool DROP COLUMN IF EXISTS set_id;
DROP TABLE IF EXISTS artifact_sets;
