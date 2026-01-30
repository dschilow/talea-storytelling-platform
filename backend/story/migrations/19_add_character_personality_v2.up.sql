-- Migration 19: Add V2 personality fields to character_pool
-- Enables unique, recognizable characters with catchphrases, speech patterns, quirks, and emotional triggers

ALTER TABLE character_pool
  ADD COLUMN IF NOT EXISTS dominant_personality TEXT,
  ADD COLUMN IF NOT EXISTS secondary_traits TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS catchphrase TEXT,
  ADD COLUMN IF NOT EXISTS catchphrase_context TEXT,
  ADD COLUMN IF NOT EXISTS speech_style TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS emotional_triggers TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS quirk TEXT;

-- Index for personality-based matching
CREATE INDEX IF NOT EXISTS idx_character_pool_dominant_personality ON character_pool(dominant_personality);

-- Comments
COMMENT ON COLUMN character_pool.dominant_personality IS 'Primary personality trait: mutig, neugierig, schüchtern, etc.';
COMMENT ON COLUMN character_pool.secondary_traits IS 'Supporting personality traits array';
COMMENT ON COLUMN character_pool.catchphrase IS 'Iconic phrase the character uses (max 1x per story!)';
COMMENT ON COLUMN character_pool.catchphrase_context IS 'When to use the catchphrase: wenn sie Angst hat, bei Erfolg, etc.';
COMMENT ON COLUMN character_pool.speech_style IS 'Speech patterns: förmlich, direkt, verspielt, flüsternd, etc.';
COMMENT ON COLUMN character_pool.emotional_triggers IS 'Situations that cause strong emotional reactions';
COMMENT ON COLUMN character_pool.quirk IS 'Unique mannerism: räuspert sich immer, zwirbelt am Bart, etc.';
