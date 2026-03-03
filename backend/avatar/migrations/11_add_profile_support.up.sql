ALTER TABLE avatars
ADD COLUMN IF NOT EXISTS profile_id TEXT;

ALTER TABLE avatars
ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'profile';

ALTER TABLE avatars
ADD COLUMN IF NOT EXISTS source_avatar_id TEXT;

CREATE INDEX IF NOT EXISTS idx_avatars_profile
  ON avatars(profile_id);

CREATE INDEX IF NOT EXISTS idx_avatars_user_profile
  ON avatars(user_id, profile_id);

CREATE INDEX IF NOT EXISTS idx_avatars_source
  ON avatars(source_type, source_avatar_id);

CREATE TABLE IF NOT EXISTS avatar_family_blueprints (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  physical_traits TEXT NOT NULL,
  personality_traits TEXT NOT NULL,
  image_url TEXT,
  visual_profile TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_avatar_family_blueprints_user
  ON avatar_family_blueprints(user_id, is_active);

CREATE TABLE IF NOT EXISTS avatar_pool_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  physical_traits TEXT NOT NULL,
  personality_traits TEXT NOT NULL,
  image_url TEXT,
  visual_profile TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_avatar_pool_templates_active
  ON avatar_pool_templates(is_active, created_at DESC);

INSERT INTO avatar_pool_templates (
  id,
  name,
  description,
  physical_traits,
  personality_traits,
  image_url,
  visual_profile,
  is_active
)
VALUES
  (
    'pool_lina_stern',
    'Lina Stern',
    'Mutige Entdeckerin mit grosser Fantasie.',
    '{"characterType":"human","appearance":"kurze lockige Haare, warmes Lachen"}',
    '{"knowledge":0,"creativity":0,"vocabulary":0,"courage":0,"curiosity":0,"teamwork":0,"empathy":0,"persistence":0,"logic":0}',
    NULL,
    '{"ageApprox":"6-8","gender":"female","skin":{"tone":"light"},"hair":{"color":"brown","type":"curly","length":"short","style":"playful"},"eyes":{"color":"green"},"face":{"freckles":true},"accessories":["yellow scarf"],"consistentDescriptors":["child-friendly","storybook style"]}',
    TRUE
  ),
  (
    'pool_milo_wald',
    'Milo Wald',
    'Ruhiger Naturfreund mit neugierigem Blick.',
    '{"characterType":"human","appearance":"wuschelige Haare, runder Hut"}',
    '{"knowledge":0,"creativity":0,"vocabulary":0,"courage":0,"curiosity":0,"teamwork":0,"empathy":0,"persistence":0,"logic":0}',
    NULL,
    '{"ageApprox":"6-8","gender":"male","skin":{"tone":"tan"},"hair":{"color":"dark brown","type":"wavy","length":"medium","style":"messy"},"eyes":{"color":"brown"},"face":{"freckles":false},"accessories":["green explorer hat"],"consistentDescriptors":["friendly","nature explorer"]}',
    TRUE
  ),
  (
    'pool_nova_funkel',
    'Nova Funkel',
    'Lebhafte Lernheldin mit einem Sternenrucksack.',
    '{"characterType":"human","appearance":"lange blaue Schleife, sportlich"}',
    '{"knowledge":0,"creativity":0,"vocabulary":0,"courage":0,"curiosity":0,"teamwork":0,"empathy":0,"persistence":0,"logic":0}',
    NULL,
    '{"ageApprox":"9-12","gender":"female","skin":{"tone":"medium"},"hair":{"color":"black","type":"straight","length":"long","style":"ponytail"},"eyes":{"color":"hazel"},"face":{"freckles":false},"accessories":["star backpack"],"consistentDescriptors":["energetic","learning focused"]}',
    TRUE
  )
ON CONFLICT (id) DO NOTHING;

