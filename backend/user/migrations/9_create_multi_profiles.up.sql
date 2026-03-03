ALTER TABLE users
ADD COLUMN IF NOT EXISTS extra_profile_addons INTEGER NOT NULL DEFAULT 0;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS family_reserve_story INTEGER NOT NULL DEFAULT 0;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS family_reserve_doku INTEGER NOT NULL DEFAULT 0;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS family_reserve_story_used INTEGER NOT NULL DEFAULT 0;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS family_reserve_doku_used INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS child_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar_color TEXT,
  age INTEGER,
  reading_level TEXT,
  interests TEXT[] NOT NULL DEFAULT '{}',
  no_go_topics TEXT[] NOT NULL DEFAULT '{}',
  learning_goals TEXT[] NOT NULL DEFAULT '{}',
  competency_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  preferred_avatar_ids TEXT[] NOT NULL DEFAULT '{}',
  quiz_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_child_profiles_user
  ON child_profiles(user_id);

CREATE INDEX IF NOT EXISTS idx_child_profiles_archived
  ON child_profiles(user_id, is_archived);

CREATE UNIQUE INDEX IF NOT EXISTS idx_child_profiles_user_default
  ON child_profiles(user_id)
  WHERE is_default = TRUE;

CREATE TABLE IF NOT EXISTS profile_quota_policies (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  story_soft_cap INTEGER,
  story_hard_cap INTEGER,
  doku_soft_cap INTEGER,
  doku_hard_cap INTEGER,
  allow_family_reserve BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_quota_policies_user
  ON profile_quota_policies(user_id);

CREATE TABLE IF NOT EXISTS quota_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id TEXT REFERENCES child_profiles(id) ON DELETE SET NULL,
  period_start DATE NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('story', 'doku', 'audio')),
  units INTEGER NOT NULL DEFAULT 1 CHECK (units > 0),
  content_ref TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quota_ledger_user_period_kind
  ON quota_ledger(user_id, period_start, kind);

CREATE INDEX IF NOT EXISTS idx_quota_ledger_profile_period_kind
  ON quota_ledger(profile_id, period_start, kind);

INSERT INTO child_profiles (
  id,
  user_id,
  name,
  avatar_color,
  is_default,
  is_archived,
  created_at,
  updated_at
)
SELECT
  'profile_' || substr(md5(u.id || '_default'), 1, 20),
  u.id,
  CASE
    WHEN COALESCE(trim(u.name), '') <> '' THEN trim(u.name) || ' Kind'
    ELSE 'Kind'
  END,
  '#8ec5ff',
  TRUE,
  FALSE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM users u
WHERE NOT EXISTS (
  SELECT 1
  FROM child_profiles p
  WHERE p.user_id = u.id
);

