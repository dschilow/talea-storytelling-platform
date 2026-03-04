import { avatarDB } from "./db";

let ensureMvpSchemaPromise: Promise<void> | null = null;

/**
 * Defensive runtime ensure for the Cosmos MVP schema.
 * Keeps APIs functional when migration execution is delayed.
 */
export async function ensureCosmosMvpSchema(): Promise<void> {
  if (ensureMvpSchemaPromise) {
    return ensureMvpSchemaPromise;
  }

  ensureMvpSchemaPromise = (async () => {
    await avatarDB.exec`
      CREATE TABLE IF NOT EXISTS domains (
          domain_id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          icon TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await avatarDB.exec`
      INSERT INTO domains (domain_id, title, icon) VALUES
        ('space', 'Weltraum', 'space'),
        ('nature', 'Natur und Tiere', 'nature'),
        ('history', 'Geschichte', 'history'),
        ('tech', 'Technik', 'tech'),
        ('body', 'Mensch und Koerper', 'body'),
        ('earth', 'Erde und Klima', 'earth'),
        ('arts', 'Kunst und Musik', 'arts'),
        ('logic', 'Logik und Raetsel', 'logic')
      ON CONFLICT (domain_id) DO NOTHING
    `;

    await avatarDB.exec`
      CREATE TABLE IF NOT EXISTS topics (
          topic_id TEXT PRIMARY KEY,
          domain_id TEXT NOT NULL REFERENCES domains(domain_id),
          kind TEXT NOT NULL CHECK (kind IN ('canonical', 'longTail')),
          title TEXT NOT NULL,
          aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await avatarDB.exec`
      CREATE INDEX IF NOT EXISTS idx_topics_domain ON topics(domain_id)
    `;
    await avatarDB.exec`
      CREATE INDEX IF NOT EXISTS idx_topics_domain_kind ON topics(domain_id, kind)
    `;
    await avatarDB.exec`
      CREATE INDEX IF NOT EXISTS idx_topics_created ON topics(created_at DESC)
    `;

    await avatarDB.exec`
      CREATE TABLE IF NOT EXISTS content_items (
          content_id TEXT PRIMARY KEY,
          child_id TEXT NOT NULL,
          domain_id TEXT NOT NULL REFERENCES domains(domain_id),
          topic_id TEXT NOT NULL REFERENCES topics(topic_id),
          type TEXT NOT NULL CHECK (type IN ('doku', 'story')),
          package_json JSONB NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await avatarDB.exec`
      CREATE INDEX IF NOT EXISTS idx_content_items_child ON content_items(child_id, created_at DESC)
    `;
    await avatarDB.exec`
      CREATE INDEX IF NOT EXISTS idx_content_items_domain ON content_items(child_id, domain_id, created_at DESC)
    `;
    await avatarDB.exec`
      CREATE INDEX IF NOT EXISTS idx_content_items_topic ON content_items(child_id, topic_id, created_at DESC)
    `;

    await avatarDB.exec`
      CREATE TABLE IF NOT EXISTS quiz_attempts (
          id TEXT PRIMARY KEY,
          child_id TEXT NOT NULL,
          content_id TEXT REFERENCES content_items(content_id) ON DELETE SET NULL,
          topic_id TEXT NOT NULL REFERENCES topics(topic_id),
          domain_id TEXT NOT NULL REFERENCES domains(domain_id),
          answers JSONB NOT NULL,
          score JSONB NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await avatarDB.exec`
      CREATE INDEX IF NOT EXISTS idx_quiz_attempts_child ON quiz_attempts(child_id, created_at DESC)
    `;
    await avatarDB.exec`
      CREATE INDEX IF NOT EXISTS idx_quiz_attempts_topic ON quiz_attempts(child_id, topic_id, created_at DESC)
    `;
    await avatarDB.exec`
      CREATE INDEX IF NOT EXISTS idx_quiz_attempts_domain ON quiz_attempts(child_id, domain_id, created_at DESC)
    `;

    await avatarDB.exec`
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
      )
    `;
    await avatarDB.exec`
      CREATE INDEX IF NOT EXISTS idx_tracking_topic_state_child ON tracking_topic_state(child_id, updated_at DESC)
    `;
    await avatarDB.exec`
      CREATE INDEX IF NOT EXISTS idx_tracking_topic_state_stage ON tracking_topic_state(child_id, stage)
    `;

    await avatarDB.exec`
      CREATE TABLE IF NOT EXISTS tracking_domain_state (
          child_id TEXT NOT NULL,
          domain_id TEXT NOT NULL REFERENCES domains(domain_id),
          evolution_index INTEGER NOT NULL DEFAULT 0 CHECK (evolution_index >= 0),
          planet_level INTEGER NOT NULL DEFAULT 1 CHECK (planet_level >= 1 AND planet_level <= 50),
          last_activity_at TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (child_id, domain_id)
      )
    `;
    await avatarDB.exec`
      CREATE INDEX IF NOT EXISTS idx_tracking_domain_state_child ON tracking_domain_state(child_id, updated_at DESC)
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
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
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
          child_id TEXT,
          domain_id TEXT NOT NULL,
          topic_id TEXT,
          source_content_id TEXT,
          source_content_type TEXT,
          due_at TIMESTAMP NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          questions JSONB,
          payload JSONB,
          done_at TIMESTAMP,
          completed_at TIMESTAMP,
          score DECIMAL(5,2),
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await avatarDB.exec`
      ALTER TABLE recall_tasks ADD COLUMN IF NOT EXISTS child_id TEXT
    `;
    await avatarDB.exec`
      ALTER TABLE recall_tasks ADD COLUMN IF NOT EXISTS payload JSONB
    `;
    await avatarDB.exec`
      ALTER TABLE recall_tasks ADD COLUMN IF NOT EXISTS done_at TIMESTAMP
    `;
    await avatarDB.exec`
      ALTER TABLE recall_tasks DROP CONSTRAINT IF EXISTS chk_recall_status
    `;
    await avatarDB.exec`
      ALTER TABLE recall_tasks
      ADD CONSTRAINT chk_recall_status
      CHECK (status IN ('pending', 'done', 'skipped', 'completed', 'expired'))
    `;
    await avatarDB.exec`
      CREATE INDEX IF NOT EXISTS idx_recall_tasks_child ON recall_tasks(child_id, due_at DESC)
    `;
    await avatarDB.exec`
      CREATE INDEX IF NOT EXISTS idx_recall_tasks_child_status ON recall_tasks(child_id, status, due_at)
    `;
  })();

  try {
    await ensureMvpSchemaPromise;
  } catch (error) {
    ensureMvpSchemaPromise = null;
    throw error;
  }
}
