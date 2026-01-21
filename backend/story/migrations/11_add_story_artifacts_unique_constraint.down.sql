-- Remove UNIQUE constraint from story_artifacts

ALTER TABLE story_artifacts
DROP CONSTRAINT IF EXISTS story_artifacts_story_artifact_unique;
