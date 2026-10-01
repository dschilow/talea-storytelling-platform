-- Background generation jobs for the audio-doku automation interface
-- (POST /automation/audio-dokus/jobs, see audio-automation.ts).
CREATE TABLE IF NOT EXISTS audio_doku_jobs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'done', 'failed', 'cancelled')),
  stage TEXT,
  topic TEXT NOT NULL,
  params JSONB NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  audio_doku_id TEXT,
  title TEXT,
  error TEXT,
  notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP,
  finished_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audio_doku_jobs_status_created
  ON audio_doku_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_audio_doku_jobs_audio_doku
  ON audio_doku_jobs(audio_doku_id);
