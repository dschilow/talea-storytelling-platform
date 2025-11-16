-- Migration 11 Down: Remove 8 Andersen Fairy Tales

-- Remove usage stats
DELETE FROM fairy_tale_usage_stats WHERE tale_id IN (
  'andersen-002',
  'andersen-003',
  'andersen-004',
  'andersen-005',
  'andersen-006',
  'andersen-007',
  'andersen-008',
  'andersen-016'
);

-- Remove scenes
DELETE FROM fairy_tale_scenes WHERE tale_id IN (
  'andersen-002',
  'andersen-003',
  'andersen-004',
  'andersen-005',
  'andersen-006',
  'andersen-007',
  'andersen-008',
  'andersen-016'
);

-- Remove roles
DELETE FROM fairy_tale_roles WHERE tale_id IN (
  'andersen-002',
  'andersen-003',
  'andersen-004',
  'andersen-005',
  'andersen-006',
  'andersen-007',
  'andersen-008',
  'andersen-016'
);

-- Remove tales
DELETE FROM fairy_tales WHERE id IN (
  'andersen-002',
  'andersen-003',
  'andersen-004',
  'andersen-005',
  'andersen-006',
  'andersen-007',
  'andersen-008',
  'andersen-016'
);
