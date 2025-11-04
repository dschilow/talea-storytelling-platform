-- Migration 1 Rollback: Drop Fairy Tales System

DROP TABLE IF EXISTS fairy_tale_usage_stats;
DROP TABLE IF EXISTS generated_story_scenes;
DROP TABLE IF EXISTS generated_stories;
DROP TABLE IF EXISTS fairy_tale_scenes;
DROP TABLE IF EXISTS fairy_tale_roles;
DROP TABLE IF EXISTS fairy_tales;
