-- Rollback for Migration 18

ALTER TABLE story_instances
  DROP COLUMN IF EXISTS selected_minutes;

ALTER TABLE story_instances
  DROP COLUMN IF EXISTS target_words;

ALTER TABLE story_instances
  DROP COLUMN IF EXISTS word_budget;

DROP TABLE IF EXISTS story_style_packs;
DROP TABLE IF EXISTS pipeline_config;
