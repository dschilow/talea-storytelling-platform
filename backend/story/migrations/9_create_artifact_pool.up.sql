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
)
