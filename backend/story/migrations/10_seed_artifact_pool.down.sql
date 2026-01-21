-- Remove all seeded artifacts
DELETE FROM artifact_pool WHERE id LIKE 'artifact_%';
