-- Down migration for tale_dna seeding
-- This removes the tale_dna entries added in the up migration

DELETE FROM tale_dna WHERE tale_id IN (
    'grimm-024',
    'grimm-083',
    'grimm-020',
    'grimm-036',
    'grimm-153',
    'grimm-033a'
);
