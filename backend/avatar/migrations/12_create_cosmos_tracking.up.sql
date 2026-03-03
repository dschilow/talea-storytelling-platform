-- Cosmos Tracking: competency_state per child/domain/skill
CREATE TABLE IF NOT EXISTS competency_state (
    id TEXT PRIMARY KEY,
    avatar_id TEXT NOT NULL,
    profile_id TEXT,
    domain_id TEXT NOT NULL,
    topic_id TEXT,
    skill_type TEXT NOT NULL DEFAULT 'REMEMBER',
    mastery DECIMAL(5,2) NOT NULL DEFAULT 0,
    confidence DECIMAL(5,2) NOT NULL DEFAULT 0,
    stage TEXT NOT NULL DEFAULT 'discovered',
    topics_explored INTEGER NOT NULL DEFAULT 0,
    last_activity_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_mastery CHECK (mastery >= 0 AND mastery <= 100),
    CONSTRAINT chk_confidence CHECK (confidence >= 0 AND confidence <= 100),
    CONSTRAINT chk_stage CHECK (stage IN ('discovered', 'understood', 'can_explain', 'mastered')),
    CONSTRAINT chk_skill_type CHECK (skill_type IN ('REMEMBER', 'UNDERSTAND', 'COMPARE', 'TRANSFER', 'EXPLAIN'))
);

CREATE INDEX IF NOT EXISTS idx_competency_state_avatar ON competency_state(avatar_id);
CREATE INDEX IF NOT EXISTS idx_competency_state_profile ON competency_state(profile_id);
CREATE INDEX IF NOT EXISTS idx_competency_state_domain ON competency_state(domain_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_competency_state_unique
    ON competency_state(avatar_id, domain_id, COALESCE(topic_id, ''), skill_type);

-- Evidence events: every quiz, recall, transfer, explain event
CREATE TABLE IF NOT EXISTS evidence_events (
    id TEXT PRIMARY KEY,
    avatar_id TEXT NOT NULL,
    profile_id TEXT,
    domain_id TEXT NOT NULL,
    topic_id TEXT,
    event_type TEXT NOT NULL,
    skill_type TEXT NOT NULL DEFAULT 'REMEMBER',
    score DECIMAL(5,2),
    max_score DECIMAL(5,2),
    payload JSONB,
    source_content_id TEXT,
    source_content_type TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_event_type CHECK (event_type IN ('quiz', 'recall', 'transfer', 'explain', 'doku_read', 'story_read'))
);

CREATE INDEX IF NOT EXISTS idx_evidence_events_avatar ON evidence_events(avatar_id);
CREATE INDEX IF NOT EXISTS idx_evidence_events_domain ON evidence_events(domain_id);
CREATE INDEX IF NOT EXISTS idx_evidence_events_created ON evidence_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_events_type ON evidence_events(event_type);

-- Recall tasks: scheduled review prompts
CREATE TABLE IF NOT EXISTS recall_tasks (
    id TEXT PRIMARY KEY,
    avatar_id TEXT NOT NULL,
    profile_id TEXT,
    domain_id TEXT NOT NULL,
    topic_id TEXT,
    source_content_id TEXT,
    source_content_type TEXT,
    due_at TIMESTAMP NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    questions JSONB,
    completed_at TIMESTAMP,
    score DECIMAL(5,2),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_recall_status CHECK (status IN ('pending', 'completed', 'skipped', 'expired'))
);

CREATE INDEX IF NOT EXISTS idx_recall_tasks_avatar ON recall_tasks(avatar_id);
CREATE INDEX IF NOT EXISTS idx_recall_tasks_due ON recall_tasks(due_at);
CREATE INDEX IF NOT EXISTS idx_recall_tasks_status ON recall_tasks(status);
CREATE INDEX IF NOT EXISTS idx_recall_tasks_pending ON recall_tasks(avatar_id, status, due_at)
    WHERE status = 'pending';
