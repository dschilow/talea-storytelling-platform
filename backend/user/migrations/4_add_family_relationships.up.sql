-- Family Relationships Table
CREATE TABLE IF NOT EXISTS family_relationships (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  parent_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  child_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL DEFAULT 'parent', -- 'parent' | 'guardian'
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'pending' | 'removed'
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Prevent duplicate relationships
  UNIQUE(parent_user_id, child_user_id)
);

CREATE INDEX idx_family_relationships_parent ON family_relationships(parent_user_id);
CREATE INDEX idx_family_relationships_child ON family_relationships(child_user_id);

-- User Activity Tracking Table
CREATE TABLE IF NOT EXISTS user_activity (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL, -- 'story_read' | 'doku_read' | 'avatar_created' | 'story_created'
  entity_id TEXT, -- ID of story/doku/avatar
  entity_title TEXT, -- Title for easy display
  duration_minutes INTEGER DEFAULT 0, -- Time spent (for reading activities)
  metadata JSONB, -- Additional data (chapters read, etc.)
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_activity_user_id ON user_activity(user_id);
CREATE INDEX idx_user_activity_created_at ON user_activity(created_at);
CREATE INDEX idx_user_activity_user_date ON user_activity(user_id, created_at);

-- Parental Controls Table
CREATE TABLE IF NOT EXISTS parental_controls (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  parent_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  child_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Time limits
  daily_screen_time_limit_minutes INTEGER DEFAULT 60, -- 0 = unlimited
  weekly_screen_time_limit_minutes INTEGER DEFAULT 420, -- 0 = unlimited

  -- Content filters
  content_filter_level TEXT NOT NULL DEFAULT 'age_appropriate', -- 'none' | 'age_appropriate' | 'strict'
  allowed_story_genres TEXT[], -- Empty = all allowed
  blocked_story_genres TEXT[], -- Specific genres to block

  -- Feature access
  can_create_stories BOOLEAN DEFAULT true,
  can_create_avatars BOOLEAN DEFAULT true,
  can_view_public_stories BOOLEAN DEFAULT true,
  can_share_stories BOOLEAN DEFAULT false,

  -- Schedule
  allowed_hours_start TIME, -- e.g., '08:00:00'
  allowed_hours_end TIME, -- e.g., '20:00:00'
  allowed_days INTEGER[], -- 0=Sunday, 1=Monday, etc. Empty = all days

  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- One control set per parent-child pair
  UNIQUE(parent_user_id, child_user_id)
);

CREATE INDEX idx_parental_controls_parent ON parental_controls(parent_user_id);
CREATE INDEX idx_parental_controls_child ON parental_controls(child_user_id);
