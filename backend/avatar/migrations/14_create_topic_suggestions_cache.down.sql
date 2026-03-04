DROP INDEX IF EXISTS idx_topic_suggestion_events_action;
DROP INDEX IF EXISTS idx_topic_suggestion_events_domain;
DROP INDEX IF EXISTS idx_topic_suggestion_events_child;
DROP TABLE IF EXISTS topic_suggestion_events;

DROP INDEX IF EXISTS idx_topic_suggestions_cache_domain;
DROP INDEX IF EXISTS idx_topic_suggestions_cache_child;
DROP TABLE IF EXISTS topic_suggestions_cache;
