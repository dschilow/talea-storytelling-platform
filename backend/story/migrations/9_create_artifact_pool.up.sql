-- Create artifact_pool table for story rewards (analog to character_pool)
CREATE TABLE IF NOT EXISTS artifact_pool (
    id TEXT PRIMARY KEY,

    -- Basic info (bilingual)
    name_de TEXT NOT NULL,              -- "Kristallschwert"
    name_en TEXT NOT NULL,              -- "Crystal Sword"
    description_de TEXT NOT NULL,       -- German description
    description_en TEXT NOT NULL,       -- English description

    -- Categorization
    category TEXT NOT NULL,             -- weapon, clothing, magic, book, tool, tech, nature, potion, jewelry, armor, map
    rarity TEXT NOT NULL DEFAULT 'common', -- common, uncommon, rare, legendary

    -- Story integration
    story_role TEXT NOT NULL,           -- How the artifact helps in a story
    discovery_scenarios TEXT[] NOT NULL DEFAULT '{}', -- Where/how it can be found
    usage_scenarios TEXT[] NOT NULL DEFAULT '{}',     -- How it can be used

    -- Visual
    emoji TEXT,                         -- Fallback emoji representation
    visual_keywords TEXT[] NOT NULL DEFAULT '{}', -- For image generation

    -- Genre affinity (0.0 - 1.0 for matching)
    genre_adventure DECIMAL(3,2) DEFAULT 0.5,
    genre_fantasy DECIMAL(3,2) DEFAULT 0.5,
    genre_mystery DECIMAL(3,2) DEFAULT 0.5,
    genre_nature DECIMAL(3,2) DEFAULT 0.5,
    genre_friendship DECIMAL(3,2) DEFAULT 0.5,
    genre_courage DECIMAL(3,2) DEFAULT 0.5,
    genre_learning DECIMAL(3,2) DEFAULT 0.5,

    -- Usage tracking (like character_pool)
    recent_usage_count INTEGER DEFAULT 0,
    total_usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP,
    last_used_in_story_id TEXT,

    -- Metadata
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for faster matching
CREATE INDEX IF NOT EXISTS idx_artifact_pool_category ON artifact_pool(category);
CREATE INDEX IF NOT EXISTS idx_artifact_pool_rarity ON artifact_pool(rarity);
CREATE INDEX IF NOT EXISTS idx_artifact_pool_active ON artifact_pool(is_active);

-- Junction table to track which artifacts were used in which stories
CREATE TABLE IF NOT EXISTS story_artifacts (
    id TEXT PRIMARY KEY,
    story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    artifact_id TEXT NOT NULL REFERENCES artifact_pool(id),
    discovery_chapter INTEGER,          -- Chapter where artifact was discovered
    usage_chapter INTEGER,              -- Chapter where artifact was used
    is_unlocked BOOLEAN DEFAULT FALSE,  -- Has the user read the story and unlocked it?
    unlocked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_story_artifacts_story ON story_artifacts(story_id);
CREATE INDEX IF NOT EXISTS idx_story_artifacts_artifact ON story_artifacts(artifact_id);
CREATE INDEX IF NOT EXISTS idx_story_artifacts_unlocked ON story_artifacts(is_unlocked);
