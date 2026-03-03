-- Cleanup orphan/temporary tables that are not part of runtime features.
-- Safe to run multiple times.

DROP TABLE IF EXISTS test_table_proof CASCADE;
DROP TABLE IF EXISTS last_used_at_exists CASCADE;
