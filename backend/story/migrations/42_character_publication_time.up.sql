-- A character is discoverable once it is active and has its first image.
ALTER TABLE character_pool ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

UPDATE character_pool
SET published_at = COALESCE(created_at AT TIME ZONE 'UTC', CURRENT_TIMESTAMP)
WHERE published_at IS NULL AND is_active = TRUE AND BTRIM(image_url) <> '';

CREATE OR REPLACE FUNCTION stamp_character_publication() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.published_at := OLD.published_at;
  END IF;
  IF NEW.published_at IS NULL AND NEW.is_active = TRUE AND BTRIM(NEW.image_url) <> '' THEN
    NEW.published_at := CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS character_publication ON character_pool;
CREATE TRIGGER character_publication
BEFORE INSERT OR UPDATE OF is_active, image_url, published_at ON character_pool
FOR EACH ROW EXECUTE FUNCTION stamp_character_publication();

CREATE INDEX IF NOT EXISTS idx_character_pool_published ON character_pool(published_at DESC);
