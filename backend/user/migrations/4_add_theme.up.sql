-- Add theme column to users table
ALTER TABLE users ADD COLUMN theme TEXT DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system'));
