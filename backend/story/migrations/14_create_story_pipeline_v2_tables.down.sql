-- Migration 14 down: remove Story Pipeline v2 tables

DROP TABLE IF EXISTS story_validations CASCADE;
DROP TABLE IF EXISTS story_images CASCADE;
DROP TABLE IF EXISTS story_image_specs CASCADE;
DROP TABLE IF EXISTS story_text_chapters CASCADE;
DROP TABLE IF EXISTS story_scene_directives CASCADE;
DROP TABLE IF EXISTS story_integration_plans CASCADE;
DROP TABLE IF EXISTS story_cast_sets CASCADE;
DROP TABLE IF EXISTS story_dna_templates CASCADE;
DROP TABLE IF EXISTS tale_dna CASCADE;
DROP TABLE IF EXISTS story_instances CASCADE;
