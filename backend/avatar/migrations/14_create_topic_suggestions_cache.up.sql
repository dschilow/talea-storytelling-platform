CREATE TABLE IF NOT EXISTS topic_suggestions_cache (
    child_id TEXT NOT NULL,
    domain_id TEXT NOT NULL REFERENCES domains(domain_id),
    age_band TEXT NOT NULL,
    items_json JSONB NOT NULL DEFAULT '{"domainId":"","generatedAt":"","items":[]}'::jsonb,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (child_id, domain_id, age_band)
);

CREATE INDEX IF NOT EXISTS idx_topic_suggestions_cache_child
    ON topic_suggestions_cache(child_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_topic_suggestions_cache_domain
    ON topic_suggestions_cache(domain_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS topic_suggestion_events (
    id TEXT PRIMARY KEY,
    child_id TEXT NOT NULL,
    domain_id TEXT NOT NULL REFERENCES domains(domain_id),
    action TEXT NOT NULL,
    payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_topic_suggestion_events_child
    ON topic_suggestion_events(child_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_topic_suggestion_events_domain
    ON topic_suggestion_events(domain_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_topic_suggestion_events_action
    ON topic_suggestion_events(action, created_at DESC);
