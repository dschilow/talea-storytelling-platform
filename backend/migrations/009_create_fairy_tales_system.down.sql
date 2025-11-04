-- Migration 009 Rollback: Drop Fairy Tales System
-- Removes all tables related to fairy tales story generation

DROP TRIGGER IF EXISTS generated_story_scenes_updated_at ON generated_story_scenes;
DROP TRIGGER IF EXISTS generated_stories_updated_at ON generated_stories;
DROP TRIGGER IF EXISTS fairy_tale_scenes_updated_at ON fairy_tale_scenes;
DROP TRIGGER IF EXISTS fairy_tales_updated_at ON fairy_tales;

DROP FUNCTION IF EXISTS update_fairy_tales_updated_at();

DROP TABLE IF EXISTS fairy_tale_usage_stats;
DROP TABLE IF EXISTS avatar_consistency_profiles;
DROP TABLE IF EXISTS generated_story_scenes;
DROP TABLE IF EXISTS generated_stories;
DROP TABLE IF EXISTS fairy_tale_scenes;
DROP TABLE IF EXISTS fairy_tale_roles;
DROP TABLE IF EXISTS fairy_tales;
