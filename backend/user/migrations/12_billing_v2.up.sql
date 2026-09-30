-- Coins are reserved before a generation and refunded when it fails.
ALTER TABLE quota_ledger ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP;
ALTER TABLE quota_ledger ADD COLUMN IF NOT EXISTS used_family_reserve BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_quota_ledger_user_kind_created
  ON quota_ledger(user_id, kind, created_at);
CREATE INDEX IF NOT EXISTS idx_quota_ledger_user_kind_ref
  ON quota_ledger(user_id, kind, content_ref);

-- "assist" meters invisible AI helpers separately from visible Tavi messages.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'metered_usage_kind_check'
      AND pg_get_constraintdef(oid) NOT LIKE '%assist%'
  ) THEN
    ALTER TABLE metered_usage DROP CONSTRAINT metered_usage_kind_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'metered_usage_kind_check') THEN
    ALTER TABLE metered_usage ADD CONSTRAINT metered_usage_kind_check
      CHECK (kind IN ('chat', 'assist', 'image', 'tts'));
  END IF;
END $$;

-- Hashed e-mails of deleted accounts, so a re-registration gets no second trial.
CREATE TABLE IF NOT EXISTS billing_trial_history (
  email_hash TEXT PRIMARY KEY,
  first_trial_started_at TIMESTAMP NOT NULL,
  recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
