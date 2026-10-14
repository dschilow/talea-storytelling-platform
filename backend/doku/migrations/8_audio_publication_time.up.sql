-- Discovery starts when a finished episode first becomes public, including
-- episodes created privately and published much later.
ALTER TABLE audio_dokus ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

UPDATE audio_dokus
SET published_at = created_at AT TIME ZONE 'UTC'
WHERE published_at IS NULL AND is_public = TRUE AND BTRIM(audio_url) <> '';

CREATE OR REPLACE FUNCTION stamp_audio_doku_publication() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.published_at := OLD.published_at;
  END IF;
  IF NEW.published_at IS NULL AND NEW.is_public = TRUE AND BTRIM(NEW.audio_url) <> '' THEN
    NEW.published_at := CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audio_doku_publication ON audio_dokus;
CREATE TRIGGER audio_doku_publication
BEFORE INSERT OR UPDATE OF is_public, audio_url, published_at ON audio_dokus
FOR EACH ROW EXECUTE FUNCTION stamp_audio_doku_publication();

CREATE INDEX IF NOT EXISTS idx_audio_dokus_published ON audio_dokus(published_at DESC);
