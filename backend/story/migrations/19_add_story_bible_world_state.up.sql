-- Migration 19: Story Bible, Outline, World State storage

CREATE TABLE IF NOT EXISTS story_bibles (
    story_instance_id TEXT PRIMARY KEY REFERENCES story_instances(id) ON DELETE CASCADE,
    story_bible JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS story_outlines (
    story_instance_id TEXT PRIMARY KEY REFERENCES story_instances(id) ON DELETE CASCADE,
    outline JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS story_world_states (
    story_instance_id TEXT NOT NULL REFERENCES story_instances(id) ON DELETE CASCADE,
    chapter INTEGER NOT NULL,
    state JSONB NOT NULL,
    PRIMARY KEY (story_instance_id, chapter)
);

CREATE INDEX IF NOT EXISTS idx_story_world_states_story ON story_world_states(story_instance_id);
