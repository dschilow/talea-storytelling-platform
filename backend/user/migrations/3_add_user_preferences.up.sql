-- Add user preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  -- Appearance settings
  theme TEXT NOT NULL DEFAULT 'light', -- 'light' | 'dark' | 'auto'
  language TEXT NOT NULL DEFAULT 'de',

  -- Reading preferences
  default_reader TEXT NOT NULL DEFAULT 'cinematic', -- 'cinematic' | 'scroll' | 'old'
  font_size TEXT NOT NULL DEFAULT 'medium', -- 'small' | 'medium' | 'large'
  animations_enabled BOOLEAN NOT NULL DEFAULT true,

  -- Privacy settings
  stories_public_by_default BOOLEAN NOT NULL DEFAULT false,

  -- Notification preferences
  email_story_complete BOOLEAN NOT NULL DEFAULT true,
  email_weekly_digest BOOLEAN NOT NULL DEFAULT true,
  email_marketing BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
