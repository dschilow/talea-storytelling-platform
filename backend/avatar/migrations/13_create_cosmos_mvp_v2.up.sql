CREATE TABLE IF NOT EXISTS domains (
    domain_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    icon TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO domains (domain_id, title, icon) VALUES
  ('space', 'Weltraum', 'space'),
  ('nature', 'Natur und Tiere', 'nature'),
  ('history', 'Geschichte', 'history'),
  ('tech', 'Technik', 'tech'),
  ('body', 'Mensch und Koerper', 'body'),
  ('earth', 'Erde und Klima', 'earth'),
  ('arts', 'Kunst und Musik', 'arts'),
  ('logic', 'Logik und Raetsel', 'logic')
ON CONFLICT (domain_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS topics (
    topic_id TEXT PRIMARY KEY,
    domain_id TEXT NOT NULL REFERENCES domains(domain_id),
    kind TEXT NOT NULL CHECK (kind IN ('canonical', 'longTail')),
    title TEXT NOT NULL,
    aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_topics_domain ON topics(domain_id);
CREATE INDEX IF NOT EXISTS idx_topics_domain_kind ON topics(domain_id, kind);
CREATE INDEX IF NOT EXISTS idx_topics_created ON topics(created_at DESC);

CREATE TABLE IF NOT EXISTS content_items (
    content_id TEXT PRIMARY KEY,
    child_id TEXT NOT NULL,
    domain_id TEXT NOT NULL REFERENCES domains(domain_id),
    topic_id TEXT NOT NULL REFERENCES topics(topic_id),
    type TEXT NOT NULL CHECK (type IN ('doku', 'story')),
    package_json JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_content_items_child ON content_items(child_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_items_domain ON content_items(child_id, domain_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_items_topic ON content_items(child_id, topic_id, created_at DESC);

CREATE TABLE IF NOT EXISTS quiz_attempts (
    id TEXT PRIMARY KEY,
    child_id TEXT NOT NULL,
    content_id TEXT REFERENCES content_items(content_id) ON DELETE SET NULL,
    topic_id TEXT NOT NULL REFERENCES topics(topic_id),
    domain_id TEXT NOT NULL REFERENCES domains(domain_id),
    answers JSONB NOT NULL,
    score JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_child ON quiz_attempts(child_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_topic ON quiz_attempts(child_id, topic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_domain ON quiz_attempts(child_id, domain_id, created_at DESC);

CREATE TABLE IF NOT EXISTS tracking_topic_state (
    child_id TEXT NOT NULL,
    topic_id TEXT NOT NULL REFERENCES topics(topic_id),
    mastery DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (mastery >= 0 AND mastery <= 100),
    confidence DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 100),
    stage TEXT NOT NULL DEFAULT 'discovered' CHECK (stage IN ('discovered', 'understood', 'apply', 'retained')),
    last_activity_at TIMESTAMP,
    stats JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (child_id, topic_id)
);

CREATE INDEX IF NOT EXISTS idx_tracking_topic_state_child ON tracking_topic_state(child_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_topic_state_stage ON tracking_topic_state(child_id, stage);

CREATE TABLE IF NOT EXISTS tracking_domain_state (
    child_id TEXT NOT NULL,
    domain_id TEXT NOT NULL REFERENCES domains(domain_id),
    evolution_index INTEGER NOT NULL DEFAULT 0 CHECK (evolution_index >= 0),
    planet_level INTEGER NOT NULL DEFAULT 1 CHECK (planet_level >= 1 AND planet_level <= 50),
    last_activity_at TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (child_id, domain_id)
);

CREATE INDEX IF NOT EXISTS idx_tracking_domain_state_child ON tracking_domain_state(child_id, updated_at DESC);

ALTER TABLE recall_tasks
    ADD COLUMN IF NOT EXISTS child_id TEXT;

ALTER TABLE recall_tasks
    ADD COLUMN IF NOT EXISTS payload JSONB;

ALTER TABLE recall_tasks
    ADD COLUMN IF NOT EXISTS done_at TIMESTAMP;

ALTER TABLE recall_tasks
    DROP CONSTRAINT IF EXISTS chk_recall_status;

ALTER TABLE recall_tasks
    ADD CONSTRAINT chk_recall_status
    CHECK (status IN ('pending', 'done', 'skipped', 'completed', 'expired'));

CREATE INDEX IF NOT EXISTS idx_recall_tasks_child ON recall_tasks(child_id, due_at DESC);
CREATE INDEX IF NOT EXISTS idx_recall_tasks_child_status ON recall_tasks(child_id, status, due_at);
