-- Add preferred_language column to users table
ALTER TABLE users ADD COLUMN preferred_language TEXT DEFAULT 'de' CHECK (preferred_language IN ('de', 'en', 'fr', 'es', 'it', 'nl'));
