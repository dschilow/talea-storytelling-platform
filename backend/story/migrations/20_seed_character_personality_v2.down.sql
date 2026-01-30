-- Rollback: Clear V2 personality data (columns remain, data is removed)

UPDATE character_pool SET
  dominant_personality = NULL,
  secondary_traits = '{}',
  catchphrase = NULL,
  catchphrase_context = NULL,
  speech_style = '{}',
  emotional_triggers = '{}',
  quirk = NULL;
