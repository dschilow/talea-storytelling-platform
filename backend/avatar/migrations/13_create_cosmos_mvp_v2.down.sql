DROP INDEX IF EXISTS idx_recall_tasks_child_status;
DROP INDEX IF EXISTS idx_recall_tasks_child;

ALTER TABLE recall_tasks
    DROP CONSTRAINT IF EXISTS chk_recall_status;

ALTER TABLE recall_tasks
    ADD CONSTRAINT chk_recall_status
    CHECK (status IN ('pending', 'completed', 'skipped', 'expired'));

ALTER TABLE recall_tasks
    DROP COLUMN IF EXISTS done_at;

ALTER TABLE recall_tasks
    DROP COLUMN IF EXISTS payload;

ALTER TABLE recall_tasks
    DROP COLUMN IF EXISTS child_id;

DROP INDEX IF EXISTS idx_tracking_domain_state_child;
DROP TABLE IF EXISTS tracking_domain_state;

DROP INDEX IF EXISTS idx_tracking_topic_state_stage;
DROP INDEX IF EXISTS idx_tracking_topic_state_child;
DROP TABLE IF EXISTS tracking_topic_state;

DROP INDEX IF EXISTS idx_quiz_attempts_domain;
DROP INDEX IF EXISTS idx_quiz_attempts_topic;
DROP INDEX IF EXISTS idx_quiz_attempts_child;
DROP TABLE IF EXISTS quiz_attempts;

DROP INDEX IF EXISTS idx_content_items_topic;
DROP INDEX IF EXISTS idx_content_items_domain;
DROP INDEX IF EXISTS idx_content_items_child;
DROP TABLE IF EXISTS content_items;

DROP INDEX IF EXISTS idx_topics_created;
DROP INDEX IF EXISTS idx_topics_domain_kind;
DROP INDEX IF EXISTS idx_topics_domain;
DROP TABLE IF EXISTS topics;

DROP TABLE IF EXISTS domains;
