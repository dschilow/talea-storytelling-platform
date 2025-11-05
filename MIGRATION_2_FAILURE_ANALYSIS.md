# 🔧 MIGRATION 2 FAILURE - ROOT CAUSE ANALYSIS

## The Problem

**Migration 2 ran successfully** (✅ logs confirmed), **BUT the column wasn't added** (❌ query still fails).

## Root Cause

**Line 9 of Migration 2** had a logic error:

```sql
-- ❌ WRONG: References usage_count before it exists
UPDATE fairy_tale_usage_stats 
SET usage_count = total_generations 
WHERE usage_count = 0;  -- <-- Column doesn't exist yet!
```

### Why This Failed Silently

1. **ALTER TABLE** with `ADD COLUMN IF NOT EXISTS` succeeds
2. **UPDATE** statement tries to reference `usage_count` in WHERE clause
3. **PostgreSQL throws error**: `ERROR: column "usage_count" does not exist`
4. **Migration system logs it as warning** but continues
5. **Column is never actually added** because transaction may have rolled back

### Evidence from Logs

```
2025-11-05T11:03:17.115149946Z [inf]  ✅ Success: /workspace/backend/fairytales/migrations/2_add_usage_count_column.up.sql
2025-11-05T11:13:56.683566467Z [err]  [FairyTaleSelector] Error selecting fairy tale: 
[Error: db error: ERROR: column "usage_count" does not exist]
```

**Translation**: Migration system said "success", but column still missing 9 minutes later.

## The Fix: Migration 3

Created **corrective migration** `3_fix_usage_count_column.up.sql`:

```sql
-- Clean slate approach
ALTER TABLE fairy_tale_usage_stats 
DROP COLUMN IF EXISTS usage_count;

-- Add column properly (with NOT NULL and DEFAULT)
ALTER TABLE fairy_tale_usage_stats 
ADD COLUMN usage_count INTEGER NOT NULL DEFAULT 0;

-- Populate from existing data (NOW column exists, so UPDATE works)
UPDATE fairy_tale_usage_stats 
SET usage_count = COALESCE(total_generations, 0);

-- Add index
CREATE INDEX IF NOT EXISTS idx_fairy_tale_usage_count ON fairy_tale_usage_stats(usage_count);
```

### Key Improvements

1. **Drop first** - Clean slate, no partial state
2. **Add with DEFAULT** - Column has valid value immediately
3. **UPDATE without WHERE** - Simpler, no reference to column in condition
4. **NOT NULL constraint** - Prevents future issues

## Deployment Status

- ✅ Migration 3 created
- ✅ Committed: `b144451`
- ✅ Pushed to GitHub
- ⏳ Railway deploying (3-5 minutes)

## Next Steps

### After Railway Deploys

1. **Call migration endpoint**:
```powershell
Invoke-WebRequest `
  -Uri "https://backend-2-production-3de1.up.railway.app/health/run-migrations" `
  -Method POST
```

Expected: `"Successfully ran 18 migrations"` (was 17, now +1)

2. **Test story generation from frontend**:
   - Go to https://www.talea.website
   - Create story with 2 avatars, age 6-8, genre adventure
   - Check logs for:
     - ✅ `[FairyTaleSelector] Found 2 good matches`
     - ✅ `[FairyTaleSelector] Selected: Hänsel und Gretel (score: 90, usage: 0)`
     - ❌ NO ERROR: column usage_count does not exist

3. **Test variance**:
   - Create SAME story again with identical parameters
   - Expected: Different fairy tale selected
   - Request 1 → Hänsel & Gretel
   - Request 2 → Rotkäppchen
   - Request 3 → Bremer Stadtmusikanten
   - Request 4 → Back to Hänsel & Gretel (rotation)

## Why Migration 2 Can't Be Fixed

Once a migration is marked as "ran", Encore won't run it again. The migration system tracks:

```
migrations_applied:
  - /workspace/backend/fairytales/migrations/1_create_fairy_tales_system.up.sql
  - /workspace/backend/fairytales/migrations/2_add_usage_count_column.up.sql  <-- Already tracked
```

So we need Migration 3 to actually apply the change.

## Lesson Learned

**Never reference a column in WHERE clause during the same migration that adds it.**

❌ **Wrong**:
```sql
ALTER TABLE t ADD COLUMN c INTEGER DEFAULT 0;
UPDATE t SET c = 5 WHERE c = 0;  -- ERROR: c doesn't exist yet!
```

✅ **Correct**:
```sql
ALTER TABLE t ADD COLUMN c INTEGER NOT NULL DEFAULT 0;
UPDATE t SET c = 5;  -- Works: no WHERE clause referencing c
```

Or use multi-step approach:
```sql
ALTER TABLE t ADD COLUMN c INTEGER;
UPDATE t SET c = COALESCE(old_column, 0);
ALTER TABLE t ALTER COLUMN c SET DEFAULT 0;
ALTER TABLE t ALTER COLUMN c SET NOT NULL;
```

## Expected Results After Fix

### Before (Migration 2 failed):
```
[err] [FairyTaleSelector] Error: column "usage_count" does not exist
[inf] [Phase3] No suitable fairy tale found, falling back to normal mode
```

### After (Migration 3 succeeds):
```
[inf] [FairyTaleSelector] Found 2 good matches (score >= 50)
[inf] [FairyTaleSelector] Selected: Hänsel und Gretel (score: 90, usage: 0)
[inf] [Phase3] Using fairy tale template: Hänsel und Gretel
[inf] [Phase3] Mapping 9 scenes to 5 chapters
```

## Verification Query

After migration, you can verify column exists:

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'fairy_tale_usage_stats'
ORDER BY ordinal_position;
```

Expected output:
```
tale_id                  | text      | NO  | 
total_generations        | integer   | YES | 0
successful_generations   | integer   | YES | 0
failed_generations       | integer   | YES | 0
avg_generation_time_secs | numeric   | YES | 
last_generated_at        | timestamp | YES | 
created_at               | timestamp | NO  | CURRENT_TIMESTAMP
updated_at               | timestamp | NO  | CURRENT_TIMESTAMP
usage_count              | integer   | NO  | 0  <-- NEW!
last_used_at             | timestamp | YES |     <-- NEW!
```

---

**Status**: Waiting for Railway deployment (~3-5 minutes from push at `b144451`)
