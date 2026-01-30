-- Migration 18: Pipeline quality config + story length metadata + style packs

ALTER TABLE story_instances
  ADD COLUMN IF NOT EXISTS selected_minutes INTEGER;

ALTER TABLE story_instances
  ADD COLUMN IF NOT EXISTS target_words INTEGER;

ALTER TABLE story_instances
  ADD COLUMN IF NOT EXISTS word_budget JSONB;

CREATE TABLE IF NOT EXISTS pipeline_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO pipeline_config (key, value)
VALUES (
  'default',
  '{
    "wpm": 140,
    "runwareSteps": 4,
    "runwareCfgScale": 4,
    "storyRetryMax": 2,
    "imageRetryMax": 2,
    "maxPropsVisible": 7
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS story_style_packs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  language TEXT NOT NULL,
  category TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  rules JSONB NOT NULL,
  prompt_fragments JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_story_style_packs_language_category
  ON story_style_packs(language, category);

INSERT INTO story_style_packs (id, name, language, category, version, rules, prompt_fragments, is_active)
VALUES
  (
    'default-de-v1',
    'Kinderbuch-Standard',
    'de',
    NULL,
    1,
    '[
      "Zeige statt nur zu sagen: sinnliche Details (Geruch, Klang, Licht, Haptik).",
      "Kurze, klare Saetze mit Rhythmus. Variiere Satzanfaenge.",
      "Natuerliche Dialoge, sparsam aber wirkungsvoll.",
      "Jede Figur handelt aktiv und treibt die Szene voran.",
      "Keine Meta-Saetze oder Pipeline-Begriffe.",
      "Kapitelstruktur: 2-5 kurze Absaetze, gelegentlich direkte Rede.",
      "Jedes Kapitel endet mit einem kleinen Ausblick (ausser im letzten Kapitel)."
    ]'::jsonb,
    '{"closingHint":"Jedes Kapitel endet mit einem sanften Ausblick (ausser im letzten Kapitel)."}'::jsonb,
    TRUE
  ),
  (
    'default-en-v1',
    'Children''s Book Standard',
    'en',
    NULL,
    1,
    '[
      "Show, don''t tell: use vivid sensory details.",
      "Short, clear sentences with rhythmic flow and varied starts.",
      "Natural dialogue, sparing but effective.",
      "Each character acts meaningfully in the scene.",
      "No meta or pipeline language.",
      "Chapter structure: 2-5 short paragraphs, occasional dialogue.",
      "Each chapter ends with a gentle forward-looking line (except the final chapter)."
    ]'::jsonb,
    '{"closingHint":"Each chapter ends with a gentle forward-looking line (except the final chapter)."}'::jsonb,
    TRUE
  )
ON CONFLICT (id) DO NOTHING;
