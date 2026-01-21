ALTER TABLE artifact_pool
  ADD COLUMN IF NOT EXISTS image_url TEXT;
