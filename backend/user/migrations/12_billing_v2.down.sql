DROP TABLE IF EXISTS billing_trial_history;

DELETE FROM metered_usage WHERE kind = 'assist';
ALTER TABLE metered_usage DROP CONSTRAINT IF EXISTS metered_usage_kind_check;
ALTER TABLE metered_usage ADD CONSTRAINT metered_usage_kind_check
  CHECK (kind IN ('chat', 'image', 'tts'));

DROP INDEX IF EXISTS idx_quota_ledger_user_kind_ref;
DROP INDEX IF EXISTS idx_quota_ledger_user_kind_created;
ALTER TABLE quota_ledger DROP COLUMN IF EXISTS used_family_reserve;
ALTER TABLE quota_ledger DROP COLUMN IF EXISTS refunded_at;
