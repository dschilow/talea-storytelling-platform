CREATE TABLE IF NOT EXISTS notification_announcements (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('update', 'audio', 'character', 'tip')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  href TEXT,
  action_label TEXT,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_by TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notification_announcements_published
  ON notification_announcements(published_at DESC);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  updates BOOLEAN NOT NULL DEFAULT TRUE,
  audio BOOLEAN NOT NULL DEFAULT TRUE,
  characters BOOLEAN NOT NULL DEFAULT TRUE,
  sharing BOOLEAN NOT NULL DEFAULT TRUE,
  tips BOOLEAN NOT NULL DEFAULT TRUE,
  read_before TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS notification_state (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_id TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (user_id, notification_id)
);

INSERT INTO notification_announcements (id, kind, title, body, href, action_label, pinned, created_by)
VALUES (
  'welcome-notifications', 'update', 'Alles Neue. Ein Ort.',
  'Willkommen bei deinen Mitteilungen. Hier findest du neue Funktionen, frische Audio-Dokus, neue Charaktere und Avatare, die mit dir geteilt wurden. Du entscheidest, welche Neuigkeiten dich interessieren.',
  NULL, NULL, TRUE, 'system'
), (
  'tip-family-profiles', 'tip', 'Ein eigenes Abenteuer für jedes Kind',
  'Mit Kinderprofilen bleiben Avatare, Geschichten und Lernfortschritte übersichtlich. In den Einstellungen kannst du eure Profile verwalten und Talea an eure Familie anpassen.',
  '/settings', 'Profile ansehen', FALSE, 'system'
)
ON CONFLICT (id) DO NOTHING;
