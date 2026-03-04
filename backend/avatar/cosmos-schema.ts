import { avatarDB } from "./db";

let ensureSchemaPromise: Promise<void> | null = null;

/**
 * Ensures cosmos tracking tables/indexes exist.
 * This is a defensive runtime safeguard when migration 12 was not fully applied.
 */
export async function ensureCosmosTrackingSchema(): Promise<void> {
  if (ensureSchemaPromise) {
    return ensureSchemaPromise;
  }

  ensureSchemaPromise = (async () => {
    await avatarDB.exec`
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
      )
    `;
    await avatarDB.exec`
      ALTER TABLE competency_state ADD COLUMN IF NOT EXISTS profile_id TEXT
    `;
    await avatarDB.exec`
      ALTER TABLE competency_state ADD COLUMN IF NOT EXISTS topic_id TEXT
    `;
    await avatarDB.exec`
      ALTER TABLE competency_state ADD COLUMN IF NOT EXISTS skill_type TEXT
    `;
    await avatarDB.exec`
      ALTER TABLE competency_state ADD COLUMN IF NOT EXISTS mastery DECIMAL(5,2) NOT NULL DEFAULT 0
    `;
    await avatarDB.exec`
      ALTER TABLE competency_state ADD COLUMN IF NOT EXISTS confidence DECIMAL(5,2) NOT NULL DEFAULT 0
    `;
    await avatarDB.exec`
      ALTER TABLE competency_state ADD COLUMN IF NOT EXISTS stage TEXT NOT NULL DEFAULT 'discovered'
    `;
    await avatarDB.exec`
      ALTER TABLE competency_state ADD COLUMN IF NOT EXISTS topics_explored INTEGER NOT NULL DEFAULT 0
    `;
    await avatarDB.exec`
      ALTER TABLE competency_state ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP
    `;
    await avatarDB.exec`
      ALTER TABLE competency_state ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    `;
    await avatarDB.exec`
      ALTER TABLE competency_state ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    `;

    await avatarDB.exec`
      CREATE INDEX IF NOT EXISTS idx_competency_state_avatar ON competency_state(avatar_id)
    `;
    await avatarDB.exec`
      CREATE INDEX IF NOT EXISTS idx_competency_state_profile ON competency_state(profile_id)
    `;
    await avatarDB.exec`
      CREATE INDEX IF NOT EXISTS idx_competency_state_domain ON competency_state(domain_id)
    `;
    // Remove duplicates before creating the unique index used by ON CONFLICT.
    await avatarDB.exec`
      WITH ranked AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY avatar_id, domain_id, COALESCE(topic_id, ''), skill_type
            ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
          ) AS rn
        FROM competency_state
      )
      DELETE FROM competency_state
      WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
    `;
    await avatarDB.exec`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_competency_state_unique
      ON competency_state(avatar_id, domain_id, COALESCE(topic_id, ''), skill_type)
    `;

    await avatarDB.exec`
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
      )
    `;
    await avatarDB.exec`
      ALTER TABLE evidence_events ADD COLUMN IF NOT EXISTS profile_id TEXT
    `;
    await avatarDB.exec`
      ALTER TABLE evidence_events ADD COLUMN IF NOT EXISTS topic_id TEXT
    `;
    await avatarDB.exec`
      ALTER TABLE evidence_events ADD COLUMN IF NOT EXISTS event_type TEXT
    `;
    await avatarDB.exec`
      ALTER TABLE evidence_events ADD COLUMN IF NOT EXISTS skill_type TEXT NOT NULL DEFAULT 'REMEMBER'
    `;
    await avatarDB.exec`
      ALTER TABLE evidence_events ADD COLUMN IF NOT EXISTS score DECIMAL(5,2)
    `;
    await avatarDB.exec`
      ALTER TABLE evidence_events ADD COLUMN IF NOT EXISTS max_score DECIMAL(5,2)
    `;
    await avatarDB.exec`
      ALTER TABLE evidence_events ADD COLUMN IF NOT EXISTS payload JSONB
    `;
    await avatarDB.exec`
      ALTER TABLE evidence_events ADD COLUMN IF NOT EXISTS source_content_id TEXT
    `;
    await avatarDB.exec`
      ALTER TABLE evidence_events ADD COLUMN IF NOT EXISTS source_content_type TEXT
    `;
    await avatarDB.exec`
      ALTER TABLE evidence_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    `;

    await avatarDB.exec`
      CREATE INDEX IF NOT EXISTS idx_evidence_events_avatar ON evidence_events(avatar_id)
    `;
    await avatarDB.exec`
      CREATE INDEX IF NOT EXISTS idx_evidence_events_domain ON evidence_events(domain_id)
    `;
    await avatarDB.exec`
      CREATE INDEX IF NOT EXISTS idx_evidence_events_created ON evidence_events(created_at DESC)
    `;
    await avatarDB.exec`
      CREATE INDEX IF NOT EXISTS idx_evidence_events_type ON evidence_events(event_type)
    `;

    await avatarDB.exec`
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
      )
    `;
    await avatarDB.exec`
      ALTER TABLE recall_tasks ADD COLUMN IF NOT EXISTS profile_id TEXT
    `;
    await avatarDB.exec`
      ALTER TABLE recall_tasks ADD COLUMN IF NOT EXISTS topic_id TEXT
    `;
    await avatarDB.exec`
      ALTER TABLE recall_tasks ADD COLUMN IF NOT EXISTS source_content_id TEXT
    `;
    await avatarDB.exec`
      ALTER TABLE recall_tasks ADD COLUMN IF NOT EXISTS source_content_type TEXT
    `;
    await avatarDB.exec`
      ALTER TABLE recall_tasks ADD COLUMN IF NOT EXISTS due_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    `;
    await avatarDB.exec`
      ALTER TABLE recall_tasks ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    `;
    await avatarDB.exec`
      ALTER TABLE recall_tasks ADD COLUMN IF NOT EXISTS questions JSONB
    `;
    await avatarDB.exec`
      ALTER TABLE recall_tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP
    `;
    await avatarDB.exec`
      ALTER TABLE recall_tasks ADD COLUMN IF NOT EXISTS score DECIMAL(5,2)
    `;
    await avatarDB.exec`
      ALTER TABLE recall_tasks ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    `;

    await avatarDB.exec`
      CREATE INDEX IF NOT EXISTS idx_recall_tasks_avatar ON recall_tasks(avatar_id)
    `;
    await avatarDB.exec`
      CREATE INDEX IF NOT EXISTS idx_recall_tasks_due ON recall_tasks(due_at)
    `;
    await avatarDB.exec`
      CREATE INDEX IF NOT EXISTS idx_recall_tasks_status ON recall_tasks(status)
    `;
    await avatarDB.exec`
      CREATE INDEX IF NOT EXISTS idx_recall_tasks_pending
      ON recall_tasks(avatar_id, status, due_at)
      WHERE status = 'pending'
    `;
  })();

  try {
    await ensureSchemaPromise;
  } catch (error) {
    ensureSchemaPromise = null;
    throw error;
  }
}
