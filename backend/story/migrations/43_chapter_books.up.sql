-- Chapter books (chapter-book-v1): a volume is written in steps by a job,
-- chapters carry one to three pictures, and volumes of one series share a memory.

CREATE TABLE IF NOT EXISTS story_series (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    profile_id TEXT,
    title TEXT NOT NULL DEFAULT '',
    memory JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_story_series_user ON story_series(user_id);

ALTER TABLE stories ADD COLUMN IF NOT EXISTS series_id TEXT;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS series_volume INTEGER;
CREATE INDEX IF NOT EXISTS idx_stories_series ON stories(series_id, series_volume);

-- [{ "url": "...", "afterParagraph": 3 }] — a chapter of a book has several pictures.
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS images JSONB;

CREATE TABLE IF NOT EXISTS story_book_jobs (
    story_id TEXT PRIMARY KEY REFERENCES stories(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'running', 'waiting', 'done', 'failed')),
    stage TEXT NOT NULL DEFAULT 'queued',
    input JSONB NOT NULL,
    state JSONB NOT NULL DEFAULT '{}'::jsonb,
    attempts INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_story_book_jobs_status ON story_book_jobs(status, updated_at);
