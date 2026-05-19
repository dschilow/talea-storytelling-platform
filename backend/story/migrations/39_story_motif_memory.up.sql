-- v11 §3 Long-term motif memory: blocks core motif reuse across last 50-100
-- stories (the in-memory recentStoryCount=8 only covered ~1 week of activity).
--
-- Each row captures one story's structural fingerprint at generation time so
-- the novelty gate can semantically compare a new candidate against the long
-- tail of past output, not just the freshest 8.
--
-- ON DELETE CASCADE: when a story is deleted, its motif fingerprint goes
-- away too — orphan fingerprints would skew similarity comparisons.

CREATE TABLE IF NOT EXISTS story_motif_memory (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id            UUID NOT NULL,
    user_id             TEXT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    title               TEXT NOT NULL,
    description         TEXT,
    core_premise        TEXT,
    central_object      TEXT,
    central_place       TEXT,
    magic_rule          TEXT,
    emotional_engine    TEXT,
    antagonist_problem  TEXT,
    final_image         TEXT,
    motif_tags          TEXT[] NOT NULL DEFAULT '{}',
    motif_keywords      TEXT[] NOT NULL DEFAULT '{}',
    pipeline_version    TEXT,

    CONSTRAINT story_motif_memory_story_unique UNIQUE (story_id)
);

CREATE INDEX IF NOT EXISTS idx_story_motif_memory_user_created
    ON story_motif_memory (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_story_motif_memory_keywords
    ON story_motif_memory USING GIN (motif_keywords);

CREATE INDEX IF NOT EXISTS idx_story_motif_memory_tags
    ON story_motif_memory USING GIN (motif_tags);
