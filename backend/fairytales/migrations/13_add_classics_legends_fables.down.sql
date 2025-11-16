-- Migration 13 Down: Remove 18 Literature Classics, Legends, Fables, and Classic Grimm Tales

-- Remove usage stats
DELETE FROM fairy_tale_usage_stats WHERE tale_id IN (
  'lit-001',
  'lit-002',
  'lit-003',
  'lit-004',
  'lit-005',
  'lit-006',
  'legend-001',
  'legend-002',
  'legend-003',
  'legend-004',
  'legend-005',
  'aesop-001',
  'aesop-002',
  'aesop-003',
  'aesop-004',
  'grimm-026',
  'grimm-015',
  'grimm-027'
);

-- Remove scenes
DELETE FROM fairy_tale_scenes WHERE tale_id IN (
  'lit-001',
  'lit-002',
  'lit-003',
  'lit-004',
  'lit-005',
  'lit-006',
  'legend-001',
  'legend-002',
  'legend-003',
  'legend-004',
  'legend-005',
  'aesop-001',
  'aesop-002',
  'aesop-003',
  'aesop-004',
  'grimm-026',
  'grimm-015',
  'grimm-027'
);

-- Remove roles
DELETE FROM fairy_tale_roles WHERE tale_id IN (
  'lit-001',
  'lit-002',
  'lit-003',
  'lit-004',
  'lit-005',
  'lit-006',
  'legend-001',
  'legend-002',
  'legend-003',
  'legend-004',
  'legend-005',
  'aesop-001',
  'aesop-002',
  'aesop-003',
  'aesop-004',
  'grimm-026',
  'grimm-015',
  'grimm-027'
);

-- Remove tales
DELETE FROM fairy_tales WHERE id IN (
  'lit-001',
  'lit-002',
  'lit-003',
  'lit-004',
  'lit-005',
  'lit-006',
  'legend-001',
  'legend-002',
  'legend-003',
  'legend-004',
  'legend-005',
  'aesop-001',
  'aesop-002',
  'aesop-003',
  'aesop-004',
  'grimm-026',
  'grimm-015',
  'grimm-027'
);
