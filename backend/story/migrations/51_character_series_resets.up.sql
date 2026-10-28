-- Admin test resets of the Figurenserie counter ("4 Folgen erlebt"): per user, profile and series the stories created up
-- to reset_at stop counting. Nothing is deleted; the stories stay readable in the library.
CREATE TABLE IF NOT EXISTS character_series_resets (
  user_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  series_id TEXT NOT NULL,
  reset_at TIMESTAMP NOT NULL,
  reset_by TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, profile_id, series_id)
);
