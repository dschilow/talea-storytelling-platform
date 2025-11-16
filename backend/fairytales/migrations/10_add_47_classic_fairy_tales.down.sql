-- Migration 10 Down: Remove 47 Classic Fairy Tales

-- Delete all fairy tales added in migration 10
-- This will cascade delete all related roles, scenes, and usage stats

DELETE FROM fairy_tales WHERE id IN (
  -- Grimm tales
  'grimm-053', 'grimm-021', 'grimm-050', 'grimm-012', 'grimm-055',
  'grimm-024', 'grimm-005', 'grimm-083', 'grimm-020', 'grimm-036',
  'grimm-153', 'grimm-033a',

  -- Andersen tales
  'andersen-001', 'andersen-002', 'andersen-003', 'andersen-004',
  'andersen-005', 'andersen-006', 'andersen-008', 'andersen-016',
  'andersen-007',

  -- Russian tales
  'russian-001', 'russian-002', 'russian-003', 'russian-004',
  'russian-005', 'russian-006', 'russian-007', 'russian-008',

  -- 1001 Nights
  '1001-001', '1001-002', '1001-003',

  -- Literature classics
  'lit-001', 'lit-002', 'lit-003', 'lit-004', 'lit-005', 'lit-006',

  -- Legends
  'legend-001', 'legend-002', 'legend-003', 'legend-004', 'legend-005',

  -- Aesop fables
  'aesop-001', 'aesop-002', 'aesop-003', 'aesop-004'
);
