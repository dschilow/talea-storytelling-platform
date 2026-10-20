-- Talea library (mode 1): pre-produced series and episodes, the same for every child.
-- Series are defined by a versioned bible; their characters live in their own table so an
-- admin can edit and extend them. Episodes are written once, reviewed, then published.

CREATE TABLE IF NOT EXISTS library_series (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    info JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    sort_order INTEGER NOT NULL DEFAULT 0,
    active_bible_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS library_series_bibles (
    series_id TEXT NOT NULL REFERENCES library_series(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    bible JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (series_id, version)
);

CREATE TABLE IF NOT EXISTS library_characters (
    series_id TEXT NOT NULL REFERENCES library_series(id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    data JSONB NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (series_id, id)
);

CREATE TABLE IF NOT EXISTS library_episodes (
    id TEXT PRIMARY KEY,
    series_id TEXT NOT NULL REFERENCES library_series(id) ON DELETE CASCADE,
    season INTEGER NOT NULL,
    episode INTEGER NOT NULL,
    title TEXT NOT NULL,
    logline TEXT NOT NULL DEFAULT '',
    plan JSONB NOT NULL DEFAULT '{}'::jsonb,
    idea TEXT,
    status TEXT NOT NULL DEFAULT 'planned',
    content JSONB,
    bible_version INTEGER,
    scores JSONB,
    generation JSONB NOT NULL DEFAULT '{}'::jsonb,
    publish_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (series_id, season, episode)
);
CREATE INDEX IF NOT EXISTS idx_library_episodes_visible ON library_episodes(status, publish_at);

CREATE TABLE IF NOT EXISTS library_progress (
    profile_id TEXT NOT NULL,
    episode_id TEXT NOT NULL REFERENCES library_episodes(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    chapter_index INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (profile_id, episode_id)
);
CREATE INDEX IF NOT EXISTS idx_library_progress_user ON library_progress(user_id);
