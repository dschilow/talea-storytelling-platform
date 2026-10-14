DROP TABLE IF EXISTS story_book_jobs;
ALTER TABLE chapters DROP COLUMN IF EXISTS images;
DROP INDEX IF EXISTS idx_stories_series;
ALTER TABLE stories DROP COLUMN IF EXISTS series_volume;
ALTER TABLE stories DROP COLUMN IF EXISTS series_id;
DROP TABLE IF EXISTS story_series;
