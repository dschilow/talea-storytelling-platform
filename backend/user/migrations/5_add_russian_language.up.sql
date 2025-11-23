-- Add Russian language support to preferred_language column
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_preferred_language_check;
ALTER TABLE users ADD CONSTRAINT users_preferred_language_check CHECK (preferred_language IN ('de', 'en', 'fr', 'es', 'it', 'nl', 'ru'));
