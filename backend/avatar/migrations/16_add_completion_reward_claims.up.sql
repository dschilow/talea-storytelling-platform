-- Atomic idempotency gate for progression rewards. The read-history tables
-- remain the user-facing completion history; this table exists solely to make
-- concurrent completion requests safe before cross-service mutations run.
CREATE TABLE IF NOT EXISTS avatar_completion_reward_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    avatar_id TEXT NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
    content_type TEXT NOT NULL CHECK (content_type IN ('story', 'doku')),
    content_id TEXT NOT NULL,
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (avatar_id, content_type, content_id)
);
-- Backfill historic completions so the claim ledger and read history agree.
INSERT INTO avatar_completion_reward_claims (avatar_id, content_type, content_id, claimed_at)
SELECT avatar_id, 'story', story_id, read_at
FROM avatar_story_read
ON CONFLICT (avatar_id, content_type, content_id) DO NOTHING;

INSERT INTO avatar_completion_reward_claims (avatar_id, content_type, content_id, claimed_at)
SELECT avatar_id, 'doku', doku_id, read_at
FROM avatar_doku_read
ON CONFLICT (avatar_id, content_type, content_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_avatar_completion_reward_claims_content
    ON avatar_completion_reward_claims(content_type, content_id);
