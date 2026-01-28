-- Down migration: Remove additional TaleDNA entries
DELETE FROM tale_dna WHERE tale_id IN (
  'grimm-053',
  'grimm-015',
  'grimm-050',
  'grimm-055',
  'grimm-001',
  'grimm-027',
  'grimm-021',
  'grimm-012',
  'grimm-005'
);
