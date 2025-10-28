-- Create character_pool table for supporting characters
CREATE TABLE character_pool (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL, -- guide, companion, obstacle, discovery, etc.
    archetype TEXT NOT NULL, -- helpful_elder, loyal_animal, magical_creature, etc.

    -- Emotional profile
    emotional_nature JSONB NOT NULL, -- {dominant: "wise", secondary: ["kind", "brave"], triggers: [...]}

    -- Visual profile
    visual_profile JSONB NOT NULL, -- {description, imagePrompt, species, colorPalette}

    -- Availability and usage
    max_screen_time INTEGER DEFAULT 50, -- 0-100 percentage
    available_chapters INTEGER[] DEFAULT '{1,2,3,4,5}', -- Which chapters this character can appear in
    canon_settings TEXT[] DEFAULT '{}', -- Settings where this character fits (forest, castle, etc.)

    -- Tracking
    recent_usage_count INTEGER DEFAULT 0,
    total_usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Create index for faster role/archetype matching
CREATE INDEX idx_character_pool_role ON character_pool(role);
CREATE INDEX idx_character_pool_archetype ON character_pool(archetype);
CREATE INDEX idx_character_pool_active ON character_pool(is_active);

-- Create story_characters junction table to track which characters were used in which stories
CREATE TABLE story_characters (
    id TEXT PRIMARY KEY,
    story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    character_id TEXT NOT NULL REFERENCES character_pool(id),
    placeholder TEXT NOT NULL, -- The placeholder used (e.g., "{{WISE_ELDER}}")
    chapters_appeared INTEGER[] DEFAULT '{}', -- Which chapters this character appeared in
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_story_characters_story ON story_characters(story_id);
CREATE INDEX idx_story_characters_character ON story_characters(character_id);

-- Create story_skeleton table to store Phase 1 output
CREATE TABLE story_skeletons (
    id TEXT PRIMARY KEY,
    story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    title TEXT,
    chapters JSONB NOT NULL, -- Array of chapter skeletons with placeholders
    supporting_character_requirements JSONB NOT NULL, -- Array of character requirements
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_story_skeletons_story ON story_skeletons(story_id);
