-- Migration 15 down: remove seeded StoryDNA templates and TaleDNA

DELETE FROM story_dna_templates WHERE template_id IN (
  'adventure_core_v1',
  'magic_worlds_v1',
  'animal_worlds_v1',
  'sci_fi_v1',
  'modern_v1'
);

DELETE FROM tale_dna WHERE tale_id IN ('grimm-026');
