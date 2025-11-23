ALTER TABLE users
  ADD COLUMN preferred_language TEXT NOT NULL DEFAULT 'de' CHECK (preferred_language IN ('de', 'en', 'fr', 'es', 'it'));
