-- Migration 14: Story Pipeline v2 tables

CREATE TABLE IF NOT EXISTS story_instances (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    category TEXT NOT NULL,
    tale_id TEXT,
    language TEXT NOT NULL,
    age_min INTEGER NOT NULL,
    age_max INTEGER NOT NULL,
    length_hint TEXT,
    emotion_profile JSONB,
    variant_seed INTEGER NOT NULL,
    variant_choices JSONB NOT NULL,
    request_hash TEXT,
    status TEXT NOT NULL DEFAULT 'running',
    error TEXT
);

CREATE INDEX IF NOT EXISTS idx_story_instances_category_tale ON story_instances(category, tale_id);
CREATE INDEX IF NOT EXISTS idx_story_instances_request_hash ON story_instances(request_hash);
CREATE INDEX IF NOT EXISTS idx_story_instances_status ON story_instances(status);

CREATE TABLE IF NOT EXISTS story_cast_sets (
    story_instance_id TEXT PRIMARY KEY REFERENCES story_instances(id) ON DELETE CASCADE,
    cast_set JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS story_integration_plans (
    story_instance_id TEXT PRIMARY KEY REFERENCES story_instances(id) ON DELETE CASCADE,
    integration_plan JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS story_scene_directives (
    story_instance_id TEXT NOT NULL REFERENCES story_instances(id) ON DELETE CASCADE,
    chapter INTEGER NOT NULL,
    directive JSONB NOT NULL,
    PRIMARY KEY (story_instance_id, chapter)
);

CREATE TABLE IF NOT EXISTS story_text_chapters (
    story_instance_id TEXT NOT NULL REFERENCES story_instances(id) ON DELETE CASCADE,
    chapter INTEGER NOT NULL,
    title TEXT,
    text TEXT NOT NULL,
    PRIMARY KEY (story_instance_id, chapter)
);

CREATE TABLE IF NOT EXISTS story_image_specs (
    story_instance_id TEXT NOT NULL REFERENCES story_instances(id) ON DELETE CASCADE,
    chapter INTEGER NOT NULL,
    image_spec JSONB NOT NULL,
    PRIMARY KEY (story_instance_id, chapter)
);

CREATE TABLE IF NOT EXISTS story_images (
    story_instance_id TEXT NOT NULL REFERENCES story_instances(id) ON DELETE CASCADE,
    chapter INTEGER NOT NULL,
    image_url TEXT,
    provider TEXT,
    meta JSONB,
    PRIMARY KEY (story_instance_id, chapter)
);

CREATE TABLE IF NOT EXISTS story_validations (
    story_instance_id TEXT PRIMARY KEY REFERENCES story_instances(id) ON DELETE CASCADE,
    validation_report JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS tale_dna (
    tale_id TEXT PRIMARY KEY,
    tale_dna JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS story_dna_templates (
    category TEXT NOT NULL,
    template_id TEXT NOT NULL,
    story_dna JSONB NOT NULL,
    PRIMARY KEY (category, template_id)
);

CREATE INDEX IF NOT EXISTS idx_story_dna_templates_category ON story_dna_templates(category);
