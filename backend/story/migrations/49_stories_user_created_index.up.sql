-- The library lists a family's stories newest first, one page of 50 at a time: WHERE user_id = ? ORDER BY created_at DESC
-- LIMIT 50 OFFSET n. With only idx_stories_user_id every page sorted all of the user's rows again; this index hands them
-- over in order. (Runs on every boot via health/run-migrations; IF NOT EXISTS keeps it idempotent.)
CREATE INDEX IF NOT EXISTS idx_stories_user_created ON stories(user_id, created_at DESC);
