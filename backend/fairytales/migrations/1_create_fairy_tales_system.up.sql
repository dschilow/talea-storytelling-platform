-- Migration 1: Create Fairy Tales System with Initial Data
-- Creates all tables and seeds initial fairy tales

-- =====================================================
-- FAIRY TALES CORE TABLES
-- =====================================================

-- Fairy tales catalog table
CREATE TABLE fairy_tales (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  original_language TEXT,
  english_translation TEXT,
  culture_region TEXT NOT NULL,
  age_recommendation INTEGER NOT NULL,
  duration_minutes INTEGER DEFAULT 10,
  genre_tags TEXT NOT NULL DEFAULT '[]',
  moral_lesson TEXT,
  summary TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fairy_tales_source ON fairy_tales(source);
CREATE INDEX idx_fairy_tales_age ON fairy_tales(age_recommendation);
CREATE INDEX idx_fairy_tales_active ON fairy_tales(is_active);

-- Fairy tale roles definition
CREATE TABLE fairy_tale_roles (
  id SERIAL PRIMARY KEY,
  tale_id TEXT NOT NULL REFERENCES fairy_tales(id) ON DELETE CASCADE,
  role_type TEXT NOT NULL,
  role_name TEXT,
  role_count INTEGER DEFAULT 1,
  description TEXT,
  required BOOLEAN DEFAULT true,
  archetype_preference TEXT,
  age_range_min INTEGER,
  age_range_max INTEGER,
  profession_preference TEXT DEFAULT '[]',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fairy_tale_roles_tale ON fairy_tale_roles(tale_id);
CREATE INDEX idx_fairy_tale_roles_type ON fairy_tale_roles(role_type);

-- Narrative scenes for each tale
CREATE TABLE fairy_tale_scenes (
  id SERIAL PRIMARY KEY,
  tale_id TEXT NOT NULL REFERENCES fairy_tales(id) ON DELETE CASCADE,
  scene_number INTEGER NOT NULL,
  scene_title TEXT,
  scene_description TEXT NOT NULL,
  dialogue_template TEXT,
  character_variables TEXT DEFAULT '{}',
  setting TEXT,
  mood TEXT,
  illustration_prompt_template TEXT,
  duration_seconds INTEGER DEFAULT 60,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tale_id, scene_number)
);

CREATE INDEX idx_fairy_tale_scenes_tale ON fairy_tale_scenes(tale_id);
CREATE INDEX idx_fairy_tale_scenes_number ON fairy_tale_scenes(tale_id, scene_number);

-- =====================================================
-- STORY GENERATION TABLES
-- =====================================================

-- Generated stories with avatar mappings
CREATE TABLE generated_stories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tale_id TEXT NOT NULL REFERENCES fairy_tales(id),
  title TEXT NOT NULL,
  story_text TEXT,
  character_mappings TEXT NOT NULL,
  generation_params TEXT,
  status TEXT DEFAULT 'generating' CHECK (status IN ('generating', 'ready', 'failed')),
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_generated_stories_user ON generated_stories(user_id);
CREATE INDEX idx_generated_stories_tale ON generated_stories(tale_id);
CREATE INDEX idx_generated_stories_status ON generated_stories(status);
CREATE INDEX idx_generated_stories_created ON generated_stories(created_at);

-- Generated story scenes with images
CREATE TABLE generated_story_scenes (
  id SERIAL PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES generated_stories(id) ON DELETE CASCADE,
  scene_number INTEGER NOT NULL,
  scene_text TEXT NOT NULL,
  image_url TEXT,
  image_prompt TEXT,
  image_generation_status TEXT DEFAULT 'pending' CHECK (image_generation_status IN ('pending', 'generating', 'ready', 'failed')),
  consistency_score DECIMAL(3,1),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (story_id, scene_number)
);

CREATE INDEX idx_generated_story_scenes_story ON generated_story_scenes(story_id);
CREATE INDEX idx_generated_story_scenes_number ON generated_story_scenes(story_id, scene_number);

-- =====================================================
-- ANALYTICS & TRACKING
-- =====================================================

-- Track which tales are most popular
CREATE TABLE fairy_tale_usage_stats (
  tale_id TEXT PRIMARY KEY REFERENCES fairy_tales(id) ON DELETE CASCADE,
  total_generations INTEGER DEFAULT 0,
  successful_generations INTEGER DEFAULT 0,
  failed_generations INTEGER DEFAULT 0,
  avg_generation_time_seconds DECIMAL(10,2),
  last_generated_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fairy_tale_usage_tale ON fairy_tale_usage_stats(tale_id);

-- =====================================================
-- SEED DATA: Top Fairy Tales
-- =====================================================

-- 1. HÄNSEL UND GRETEL
INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
VALUES (
  'grimm-015',
  'Hänsel und Gretel',
  'grimm',
  'de',
  'Hansel and Gretel',
  'german',
  7,
  15,
  '["adventure", "dark", "moral", "family"]',
  'Cleverness and courage triumph over greed and evil',
  'Two siblings are abandoned in the forest and must use their wits to escape a wicked witch who lives in a gingerbread house.',
  true
);

-- Roles for Hänsel und Gretel
INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, archetype_preference, age_range_min, age_range_max, profession_preference)
VALUES
  ('grimm-015', 'protagonist', 'Hänsel', 1, 'Clever boy who saves his sister', true, 'hero', 6, 12, '["child"]'),
  ('grimm-015', 'protagonist', 'Gretel', 1, 'Brave girl who defeats the witch', true, 'hero', 6, 12, '["child"]'),
  ('grimm-015', 'antagonist', 'Hexe', 1, 'Evil witch who lures children', true, 'villain', 30, 200, '["witch", "villain"]'),
  ('grimm-015', 'supporting', 'Vater', 1, 'Poor woodcutter and father', false, 'guardian', 30, 60, '["adult", "woodcutter"]');

-- Scenes for Hänsel und Gretel
INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, character_variables, setting, mood, illustration_prompt_template, duration_seconds)
VALUES
  ('grimm-015', 1, 'Die arme Familie', 
   '[HÄNSEL] und [GRETEL] leben mit ihrem Vater in einer kleinen Hütte am Waldrand. Die Familie ist sehr arm und hat kaum etwas zu essen.',
   '{"PROTAGONIST1": "HÄNSEL", "PROTAGONIST2": "GRETEL", "SUPPORTING": "VATER"}',
   'cottage_forest_edge', 'somber',
   'Poor family in small cottage at forest edge, two children sitting at table, worried father, watercolor storybook style', 90),
   
  ('grimm-015', 2, 'Verloren im Wald',
   '[HÄNSEL] und [GRETEL] werden tief im dunklen Wald ausgesetzt. [HÄNSEL] hat Brotkrumen ausgestreut, aber die Vögel haben sie aufgepickt.',
   '{"PROTAGONIST1": "HÄNSEL", "PROTAGONIST2": "GRETEL"}',
   'dark_forest', 'mysterious',
   'Two children lost in dark mysterious forest, looking worried, birds flying above, mystical atmosphere', 75),
   
  ('grimm-015', 3, 'Das Lebkuchenhaus',
   '[HÄNSEL] und [GRETEL] entdecken ein wunderschönes Haus aus Lebkuchen, Zuckerguss und Süßigkeiten. Sie sind so hungrig und beginnen zu naschen.',
   '{"PROTAGONIST1": "HÄNSEL", "PROTAGONIST2": "GRETEL"}',
   'gingerbread_house', 'magical',
   'Enchanting gingerbread house decorated with candy and frosting, two amazed children eating, magical glowing', 80),
   
  ('grimm-015', 4, 'Die böse Hexe',
   'Eine alte [HEXE] kommt aus dem Haus. Sie tut freundlich, aber sie will die Kinder fangen und fressen.',
   '{"PROTAGONIST1": "HÄNSEL", "PROTAGONIST2": "GRETEL", "ANTAGONIST": "HEXE"}',
   'gingerbread_house', 'sinister',
   'Evil witch with crooked smile greeting two frightened children at gingerbread house door, ominous', 70),
   
  ('grimm-015', 5, 'Gefangen',
   '[HÄNSEL] wird in einen Käfig gesperrt. Die [HEXE] will ihn mästen. [GRETEL] muss für die Hexe arbeiten.',
   '{"PROTAGONIST1": "HÄNSEL", "PROTAGONIST2": "GRETEL", "ANTAGONIST": "HEXE"}',
   'witch_cottage_interior', 'tense',
   'Boy locked in cage, girl working in kitchen, witch checking on boy, dark interior', 85),
   
  ('grimm-015', 6, 'Gretels List',
   '[GRETEL] ist sehr clever. Als die [HEXE] in den Ofen schauen will, stößt [GRETEL] sie hinein und schließt die Tür!',
   '{"PROTAGONIST2": "GRETEL", "ANTAGONIST": "HEXE"}',
   'witch_cottage_interior', 'triumphant',
   'Brave girl pushing evil witch into oven, dramatic moment of victory, heroic action', 65),
   
  ('grimm-015', 7, 'Die Befreiung',
   '[GRETEL] befreit [HÄNSEL] aus dem Käfig. Sie finden Schätze und Edelsteine im Haus der Hexe.',
   '{"PROTAGONIST1": "HÄNSEL", "PROTAGONIST2": "GRETEL"}',
   'witch_cottage_interior', 'joyful',
   'Girl freeing boy from cage, treasure chests with jewels around them, happy reunion', 70),
   
  ('grimm-015', 8, 'Der Heimweg',
   '[HÄNSEL] und [GRETEL] finden den Weg nach Hause. Ein weißer Schwan hilft ihnen über den Fluss.',
   '{"PROTAGONIST1": "HÄNSEL", "PROTAGONIST2": "GRETEL"}',
   'river_forest', 'peaceful',
   'Two children riding on white swan across river, forest in background, hopeful journey home', 75),
   
  ('grimm-015', 9, 'Glückliches Ende',
   'Zurück zu Hause freut sich der [VATER] riesig. Mit den Schätzen ist die Familie nie wieder arm. Sie leben glücklich zusammen.',
   '{"PROTAGONIST1": "HÄNSEL", "PROTAGONIST2": "GRETEL", "SUPPORTING": "VATER"}',
   'cottage_forest_edge', 'happy',
   'Family reunion at cottage, father hugging children, treasure visible, warm happy ending', 80);

-- 2. ROTKÄPPCHEN
INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
VALUES (
  'grimm-026',
  'Rotkäppchen',
  'grimm',
  'de',
  'Little Red Riding Hood',
  'german',
  5,
  10,
  '["moral", "adventure", "animals"]',
  'Always listen to your parents and be careful of strangers',
  'A little girl wearing a red hood visits her grandmother but encounters a cunning wolf on the way.',
  true
);

INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, archetype_preference, age_range_min, age_range_max, profession_preference)
VALUES
  ('grimm-026', 'protagonist', 'Rotkäppchen', 1, 'Innocent girl with red hood', true, 'innocent', 5, 10, '["child"]'),
  ('grimm-026', 'antagonist', 'Wolf', 1, 'Cunning and hungry wolf', true, 'trickster', 5, 100, '["wolf", "animal", "villain"]'),
  ('grimm-026', 'supporting', 'Großmutter', 1, 'Kind elderly grandmother', false, 'elder', 60, 100, '["grandmother", "elder"]'),
  ('grimm-026', 'helper', 'Jäger', 1, 'Brave hunter who saves them', false, 'hero', 25, 50, '["hunter", "adult", "hero"]');

INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, character_variables, setting, mood, illustration_prompt_template, duration_seconds)
VALUES
  ('grimm-026', 1, 'Der Auftrag',
   '[ROTKÄPPCHEN] bekommt von ihrer Mutter einen Korb mit Kuchen und Wein für die kranke [GROSSMUTTER]. "Geh nicht vom Weg ab!", sagt die Mutter.',
   '{"PROTAGONIST": "ROTKÄPPCHEN"}',
   'village_cottage', 'cheerful',
   'Girl in red hood with basket, mother waving goodbye at cottage door, sunny village', 60),
   
  ('grimm-026', 2, 'Begegnung im Wald',
   'Im Wald trifft [ROTKÄPPCHEN] auf den [WOLF]. "Wohin gehst du?", fragt der schlaue Wolf freundlich.',
   '{"PROTAGONIST": "ROTKÄPPCHEN", "ANTAGONIST": "WOLF"}',
   'forest_path', 'mysterious',
   'Girl in red hood meeting large wolf on forest path, wolf appearing friendly but cunning', 70),
   
  ('grimm-026', 3, 'Die Ablenkung',
   'Der [WOLF] schlägt vor: "Schau die schönen Blumen! Pflück ein paar für deine Großmutter." [ROTKÄPPCHEN] vergisst die Warnung und sammelt Blumen.',
   '{"PROTAGONIST": "ROTKÄPPCHEN", "ANTAGONIST": "WOLF"}',
   'forest_clearing', 'deceptive',
   'Girl picking flowers in forest while wolf sneaks away in background, colorful flowers', 65),
   
  ('grimm-026', 4, 'Bei der Großmutter',
   '[ROTKÄPPCHEN] kommt zum Haus der [GROSSMUTTER]. "Großmutter, was hast du für große Ohren!" - "Damit ich dich besser hören kann!"',
   '{"PROTAGONIST": "ROTKÄPPCHEN", "ANTAGONIST": "WOLF"}',
   'grandmother_cottage', 'tense',
   'Girl at bedside of wolf disguised in grandmother clothes and nightcap, suspenseful scene', 75),
   
  ('grimm-026', 5, 'Die Rettung',
   'Der [WOLF] hat [ROTKÄPPCHEN] und die [GROSSMUTTER] gefressen! Aber der [JÄGER] kommt und rettet beide.',
   '{"PROTAGONIST": "ROTKÄPPCHEN", "SUPPORTING": "GROSSMUTTER", "HELPER": "JÄGER"}',
   'grandmother_cottage', 'heroic',
   'Brave hunter rescuing girl and grandmother from wolf, victorious heroic moment', 80),
   
  ('grimm-026', 6, 'Happy End',
   '[ROTKÄPPCHEN], die [GROSSMUTTER] und der [JÄGER] essen gemeinsam Kuchen. [ROTKÄPPCHEN] verspricht, nie wieder vom Weg abzugehen.',
   '{"PROTAGONIST": "ROTKÄPPCHEN", "SUPPORTING": "GROSSMUTTER", "HELPER": "JÄGER"}',
   'grandmother_cottage', 'happy',
   'Girl, grandmother and hunter having cake together at table, warm celebration, lesson learned', 70);

-- 3. DIE BREMER STADTMUSIKANTEN
INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
VALUES (
  'grimm-027',
  'Die Bremer Stadtmusikanten',
  'grimm',
  'de',
  'The Town Musicians of Bremen',
  'german',
  5,
  12,
  '["adventure", "animals", "teamwork", "humor"]',
  'Teamwork and friendship can overcome any obstacle',
  'Four aging animals - a donkey, dog, cat, and rooster - run away to become musicians and outsmart a band of robbers.',
  true
);

INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, archetype_preference, age_range_min, age_range_max, profession_preference)
VALUES
  ('grimm-027', 'protagonist', 'Esel', 1, 'Wise old donkey, leader', true, 'sage', 10, 100, '["donkey", "animal"]'),
  ('grimm-027', 'protagonist', 'Hund', 1, 'Loyal hunting dog', true, 'loyal_companion', 8, 100, '["dog", "animal"]'),
  ('grimm-027', 'protagonist', 'Katze', 1, 'Clever cat', true, 'trickster', 8, 100, '["cat", "animal"]'),
  ('grimm-027', 'protagonist', 'Hahn', 1, 'Loud rooster', true, 'jester', 5, 100, '["rooster", "bird", "animal"]');

-- Initialize usage stats
INSERT INTO fairy_tale_usage_stats (tale_id, total_generations, successful_generations)
VALUES
  ('grimm-015', 0, 0),
  ('grimm-026', 0, 0),
  ('grimm-027', 0, 0);
