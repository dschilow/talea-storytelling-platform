-- Add UNIQUE constraint to story_artifacts to prevent duplicate artifact assignments
-- This allows ON CONFLICT clause to work properly

ALTER TABLE story_artifacts
ADD CONSTRAINT story_artifacts_story_artifact_unique
UNIQUE (story_id, artifact_id);
