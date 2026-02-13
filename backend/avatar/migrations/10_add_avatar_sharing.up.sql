CREATE TABLE IF NOT EXISTS avatar_share_contacts (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_trusted BOOLEAN NOT NULL DEFAULT TRUE,
  target_user_id TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (owner_user_id, contact_email)
);

CREATE INDEX IF NOT EXISTS idx_avatar_share_contacts_owner
  ON avatar_share_contacts(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_avatar_share_contacts_target_user
  ON avatar_share_contacts(target_user_id);

CREATE TABLE IF NOT EXISTS avatar_shares (
  id TEXT PRIMARY KEY,
  avatar_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  target_email TEXT NOT NULL,
  target_user_id TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_avatar_shares_avatar FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE CASCADE,
  CONSTRAINT fk_avatar_shares_contact FOREIGN KEY (contact_id) REFERENCES avatar_share_contacts(id) ON DELETE CASCADE,
  UNIQUE (avatar_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_avatar_shares_owner
  ON avatar_shares(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_avatar_shares_avatar
  ON avatar_shares(avatar_id);

CREATE INDEX IF NOT EXISTS idx_avatar_shares_target_email
  ON avatar_shares(target_email);

CREATE INDEX IF NOT EXISTS idx_avatar_shares_target_user
  ON avatar_shares(target_user_id);
