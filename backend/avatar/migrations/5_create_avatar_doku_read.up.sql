-- Track which dokus have been read by which avatars to prevent duplicate processing
CREATE TABLE avatar_doku_read (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    avatar_id TEXT NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
    doku_id TEXT NOT NULL,
    doku_title TEXT NOT NULL,
    read_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Ensure each avatar can only read the same doku once
    UNIQUE(avatar_id, doku_id)
);

-- Index for fast lookups
CREATE INDEX idx_avatar_doku_read_avatar_id ON avatar_doku_read(avatar_id);
CREATE INDEX idx_avatar_doku_read_doku_id ON avatar_doku_read(doku_id);