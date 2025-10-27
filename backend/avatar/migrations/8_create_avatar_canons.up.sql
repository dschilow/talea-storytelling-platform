-- Create avatar_canons table for storing standardized avatar analysis data
CREATE TABLE avatar_canons (
  id SERIAL PRIMARY KEY,
  avatar_id VARCHAR(255) NOT NULL UNIQUE,
  canon_data JSONB NOT NULL,
  version VARCHAR(10) NOT NULL DEFAULT '1.0',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX idx_avatar_canons_avatar_id ON avatar_canons(avatar_id);
CREATE INDEX idx_avatar_canons_created_at ON avatar_canons(created_at);

-- Add comment
COMMENT ON TABLE avatar_canons IS 'Stores standardized avatar analysis data for visual consistency across stories';
COMMENT ON COLUMN avatar_canons.avatar_id IS 'Reference to avatar ID';
COMMENT ON COLUMN avatar_canons.canon_data IS 'JSON data containing standardized avatar analysis';
COMMENT ON COLUMN avatar_canons.version IS 'Version of the canon schema';
