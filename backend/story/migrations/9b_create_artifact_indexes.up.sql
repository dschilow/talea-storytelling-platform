-- Create indexes for artifact_pool table (separated for transaction safety)

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
