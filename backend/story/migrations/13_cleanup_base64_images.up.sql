-- Migration: Clean up base64 images from character_pool.image_url
-- Base64 images are too large for image prompts and cause issues
-- This migration removes base64 data URIs, keeping only HTTP(S) URLs

-- Remove all base64 data URIs (they start with "data:image/")
UPDATE character_pool
SET image_url = NULL
WHERE image_url IS NOT NULL
  AND image_url LIKE 'data:image/%';

-- Log the cleanup
DO $$
DECLARE
  cleaned_count INT;
BEGIN
  SELECT COUNT(*) INTO cleaned_count
  FROM character_pool
  WHERE image_url IS NULL;

  RAISE NOTICE 'Cleaned % base64 images from character_pool', cleaned_count;
END $$;
