CREATE TABLE IF NOT EXISTS character_life_stories (
    id TEXT PRIMARY KEY,
    character_id TEXT NOT NULL UNIQUE REFERENCES character_pool(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    cover_image_url TEXT,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('generating', 'draft', 'published', 'error')),
    age_group TEXT NOT NULL DEFAULT '6-8'
        CHECK (age_group IN ('3-5', '6-8', '9-12', '13+')),
    target_words INTEGER NOT NULL DEFAULT 1400,
    word_count INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 0,
    generation_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_error TEXT,
    created_by_user_id TEXT NOT NULL,
    published_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS character_life_story_chapters (
    id TEXT PRIMARY KEY,
    life_story_id TEXT NOT NULL REFERENCES character_life_stories(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    image_url TEXT,
    image_prompt TEXT,
    chapter_order INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (life_story_id, chapter_order)
);

CREATE INDEX IF NOT EXISTS idx_character_life_stories_status
    ON character_life_stories(status);

CREATE INDEX IF NOT EXISTS idx_character_life_stories_character
    ON character_life_stories(character_id);

CREATE INDEX IF NOT EXISTS idx_character_life_story_chapters_story_order
    ON character_life_story_chapters(life_story_id, chapter_order);

COMMENT ON TABLE character_life_stories IS
    'Editorial, canonical origin stories for reusable Talea character-pool characters.';

COMMENT ON TABLE character_life_story_chapters IS
    'Illustrated chapters belonging to a canonical character life story.';
