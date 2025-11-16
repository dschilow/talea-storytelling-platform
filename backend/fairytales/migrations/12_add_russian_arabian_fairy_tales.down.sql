-- Migration 12 Down: Remove 11 Russian and Arabian Nights Fairy Tales

-- Remove usage stats
DELETE FROM fairy_tale_usage_stats WHERE tale_id IN (
  'russian-001',
  'russian-002',
  'russian-003',
  'russian-004',
  'russian-005',
  'russian-006',
  'russian-007',
  'russian-008',
  '1001-001',
  '1001-002',
  '1001-003'
);

-- Remove scenes
DELETE FROM fairy_tale_scenes WHERE tale_id IN (
  'russian-001',
  'russian-002',
  'russian-003',
  'russian-004',
  'russian-005',
  'russian-006',
  'russian-007',
  'russian-008',
  '1001-001',
  '1001-002',
  '1001-003'
);

-- Remove roles
DELETE FROM fairy_tale_roles WHERE tale_id IN (
  'russian-001',
  'russian-002',
  'russian-003',
  'russian-004',
  'russian-005',
  'russian-006',
  'russian-007',
  'russian-008',
  '1001-001',
  '1001-002',
  '1001-003'
);

-- Remove tales
DELETE FROM fairy_tales WHERE id IN (
  'russian-001',
  'russian-002',
  'russian-003',
  'russian-004',
  'russian-005',
  'russian-006',
  'russian-007',
  'russian-008',
  '1001-001',
  '1001-002',
  '1001-003'
);
