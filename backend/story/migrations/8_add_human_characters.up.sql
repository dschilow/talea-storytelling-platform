-- Migration: Add 21 comprehensive human characters to fix species matching
-- This solves the duck-as-king bug by providing proper human characters for human roles

-- 1. ROYALTY (5 characters)

INSERT INTO character_pool (
  id, name, role, archetype, emotional_nature, visual_profile, max_screen_time, available_chapters, canon_settings,
  gender, age_category, species_category, profession_tags, size_category, social_class
) VALUES
(
  '7f8e9a1b-2c3d-4e5f-6a7b-8c9d0e1f2a3b',
  'König Wilhelm',
  'authority',
  'ruler',
  '{"dominant": "authoritative", "secondary": ["just", "wise", "commanding"]}',
  '{"species": "human", "description": "König Wilhelm • Elderly king with white beard and golden crown, regal purple robes", "colorPalette": ["purple", "gold", "white"]}',
  70,
  '{1, 2, 3, 4, 5}',
  '{"fantasy", "medieval", "castle"}',
  'male',
  'elder',
  'human',
  '{"royalty", "ruler", "authority"}',
  'medium',
  'royalty'
),
(
  '8a9b0c1d-2e3f-4a5b-6c7d-8e9f0a1b2c3d',
  'König Friedrich',
  'authority',
  'ruler',
  '{"dominant": "strict", "secondary": ["demanding", "proud", "traditional"]}',
  '{"species": "human", "description": "König Friedrich • Middle-aged king with dark beard and iron crown, strict demeanor", "colorPalette": ["red", "gold", "black"]}',
  70,
  '{1, 2, 3, 4, 5}',
  '{"fantasy", "medieval", "castle"}',
  'male',
  'adult',
  'human',
  '{"royalty", "ruler", "authority"}',
  'medium',
  'royalty'
),
(
  '9b0c1d2e-3f4a-5b6c-7d8e-9f0a1b2c3d4e',
  'Königin Isabella',
  'authority',
  'ruler',
  '{"dominant": "elegant", "secondary": ["wise", "diplomatic", "kind"]}',
  '{"species": "human", "description": "Königin Isabella • Graceful queen with long flowing hair and silver crown, blue royal dress", "colorPalette": ["blue", "silver", "white"]}',
  70,
  '{1, 2, 3, 4, 5}',
  '{"fantasy", "medieval", "castle"}',
  'female',
  'adult',
  'human',
  '{"royalty", "ruler", "authority"}',
  'medium',
  'royalty'
),
(
  'a0b1c2d3-4e5f-6a7b-8c9d-0e1f2a3b4c5d',
  'Prinz Alexander',
  'protagonist',
  'hero',
  '{"dominant": "brave", "secondary": ["noble", "charming", "adventurous"]}',
  '{"species": "human", "description": "Prinz Alexander • Young handsome prince with golden hair and blue tunic, sword at his side", "colorPalette": ["blue", "gold", "white"]}',
  80,
  '{1, 2, 3, 4, 5}',
  '{"fantasy", "medieval", "castle"}',
  'male',
  'young_adult',
  'human',
  '{"royalty", "nobility", "warrior"}',
  'medium',
  'nobility'
),
(
  'b1c2d3e4-5f6a-7b8c-9d0e-1f2a3b4c5d6e',
  'Prinzessin Rosalinde',
  'protagonist',
  'hero',
  '{"dominant": "kind", "secondary": ["courageous", "intelligent", "graceful"]}',
  '{"species": "human", "description": "Prinzessin Rosalinde • Beautiful princess with rose-red hair and pink dress, gentle smile", "colorPalette": ["pink", "rose", "gold"]}',
  80,
  '{1, 2, 3, 4, 5}',
  '{"fantasy", "medieval", "castle"}',
  'female',
  'young_adult',
  'human',
  '{"royalty", "nobility"}',
  'medium',
  'nobility'
);

-- 2. CRAFTSMEN & WORKERS (3 characters)

INSERT INTO character_pool (
  id, name, role, archetype, emotional_nature, visual_profile, max_screen_time, available_chapters, canon_settings,
  gender, age_category, species_category, profession_tags, size_category, social_class
) VALUES
(
  'c2d3e4f5-6a7b-8c9d-0e1f-2a3b4c5d6e7f',
  'Müller Hans',
  'support',
  'craftsman',
  '{"dominant": "hardworking", "secondary": ["humble", "honest", "worried"]}',
  '{"species": "human", "description": "Müller Hans • Dusty miller with flour-covered apron, strong arms, weathered face", "colorPalette": ["brown", "white", "beige"]}',
  60,
  '{1, 2, 3, 4, 5}',
  '{"fantasy", "medieval", "village"}',
  'male',
  'adult',
  'human',
  '{"craftsman", "worker", "miller"}',
  'medium',
  'craftsman'
),
(
  'd3e4f5a6-7b8c-9d0e-1f2a-3b4c5d6e7f8a',
  'Schmied Konrad',
  'support',
  'craftsman',
  '{"dominant": "strong", "secondary": ["skilled", "proud", "reliable"]}',
  '{"species": "human", "description": "Schmied Konrad • Muscular blacksmith with leather apron, soot-covered face, powerful build", "colorPalette": ["black", "brown", "gray"]}',
  60,
  '{1, 2, 3, 4, 5}',
  '{"fantasy", "medieval", "village"}',
  'male',
  'adult',
  'human',
  '{"craftsman", "blacksmith", "worker"}',
  'large',
  'craftsman'
),
(
  'e4f5a6b7-8c9d-0e1f-2a3b-4c5d6e7f8a9b',
  'Bäcker Wilhelm',
  'support',
  'craftsman',
  '{"dominant": "cheerful", "secondary": ["generous", "warm", "friendly"]}',
  '{"species": "human", "description": "Bäcker Wilhelm • Plump jolly baker with white apron, red cheeks, flour in his beard", "colorPalette": ["white", "brown", "red"]}',
  60,
  '{1, 2, 3, 4, 5}',
  '{"fantasy", "medieval", "village"}',
  'male',
  'adult',
  'human',
  '{"craftsman", "baker", "worker"}',
  'medium',
  'craftsman'
);

-- 3. MAGICAL CHARACTERS (3 characters)

INSERT INTO character_pool (
  id, name, role, archetype, emotional_nature, visual_profile, max_screen_time, available_chapters, canon_settings,
  gender, age_category, species_category, profession_tags, size_category, social_class
) VALUES
(
  'f5a6b7c8-9d0e-1f2a-3b4c-5d6e7f8a9b0c',
  'Hexe Griselda',
  'antagonist',
  'villain',
  '{"dominant": "cunning", "secondary": ["wicked", "magical", "mysterious"]}',
  '{"species": "human", "description": "Hexe Griselda • Old witch with crooked nose, black robe, pointed hat, green magical aura", "colorPalette": ["black", "green", "purple"]}',
  70,
  '{1, 2, 3, 4, 5}',
  '{"fantasy", "forest", "mountain"}',
  'female',
  'elder',
  'human',
  '{"magical", "villain", "witch"}',
  'medium',
  'outcast'
),
(
  'a6b7c8d9-0e1f-2a3b-4c5d-6e7f8a9b0c1d',
  'Zauberer Merlin',
  'guide',
  'mentor',
  '{"dominant": "wise", "secondary": ["powerful", "mysterious", "kind"]}',
  '{"species": "human", "description": "Zauberer Merlin • Ancient wizard with long white beard, star-covered blue robe, wooden staff", "colorPalette": ["blue", "silver", "white"]}',
  70,
  '{1, 2, 3, 4, 5}',
  '{"fantasy", "castle", "forest"}',
  'male',
  'elder',
  'human',
  '{"magical", "wizard", "mentor"}',
  'medium',
  'any'
),
(
  'b7c8d9e0-1f2a-3b4c-5d6e-7f8a9b0c1d2e',
  'Magierin Luna',
  'guide',
  'helper',
  '{"dominant": "mysterious", "secondary": ["helpful", "magical", "gentle"]}',
  '{"species": "human", "description": "Magierin Luna • Young sorceress with silver hair, purple dress, glowing crystal staff", "colorPalette": ["purple", "silver", "blue"]}',
  60,
  '{1, 2, 3, 4, 5}',
  '{"fantasy", "forest"}',
  'female',
  'young_adult',
  'human',
  '{"magical", "helper", "sorceress"}',
  'medium',
  'any'
);

-- 4. VILLAINS & ROGUES (2 characters)

INSERT INTO character_pool (
  id, name, role, archetype, emotional_nature, visual_profile, max_screen_time, available_chapters, canon_settings,
  gender, age_category, species_category, profession_tags, size_category, social_class
) VALUES
(
  'c8d9e0f1-2a3b-4c5d-6e7f-8a9b0c1d2e3f',
  'Räuber Rolf',
  'antagonist',
  'villain',
  '{"dominant": "greedy", "secondary": ["cunning", "aggressive", "dangerous"]}',
  '{"species": "human", "description": "Räuber Rolf • Scarred bandit with eye patch, leather vest, sword and dagger", "colorPalette": ["brown", "black", "red"]}',
  60,
  '{1, 2, 3, 4, 5}',
  '{"fantasy", "forest", "mountain"}',
  'male',
  'adult',
  'human',
  '{"villain", "bandit", "rogue"}',
  'medium',
  'outcast'
),
(
  'd9e0f1a2-3b4c-5d6e-7f8a-9b0c1d2e3f4a',
  'Stiefmutter Brunhilde',
  'antagonist',
  'villain',
  '{"dominant": "cruel", "secondary": ["jealous", "vain", "manipulative"]}',
  '{"species": "human", "description": "Stiefmutter Brunhilde • Cold stepmother with severe expression, dark elegant dress, sharp features", "colorPalette": ["black", "red", "gray"]}',
  70,
  '{1, 2, 3, 4, 5}',
  '{"fantasy", "castle", "village"}',
  'female',
  'adult',
  'human',
  '{"villain", "noble"}',
  'medium',
  'nobility'
);

-- 5. WISE ELDERS & SCHOLARS (2 characters)

INSERT INTO character_pool (
  id, name, role, archetype, emotional_nature, visual_profile, max_screen_time, available_chapters, canon_settings,
  gender, age_category, species_category, profession_tags, size_category, social_class
) VALUES
(
  'e0f1a2b3-4c5d-6e7f-8a9b-0c1d2e3f4a5b',
  'Weise Frau Margarethe',
  'guide',
  'mentor',
  '{"dominant": "wise", "secondary": ["kind", "patient", "knowledgeable"]}',
  '{"species": "human", "description": "Weise Frau Margarethe • Old wise woman with gentle eyes, gray hair in bun, simple robes", "colorPalette": ["gray", "brown", "white"]}',
  60,
  '{1, 2, 3, 4, 5}',
  '{"fantasy", "village", "forest"}',
  'female',
  'elder',
  'human',
  '{"mentor", "healer", "elder"}',
  'medium',
  'commoner'
),
(
  'f1a2b3c4-5d6e-7f8a-9b0c-1d2e3f4a5b6c',
  'Gelehrter Professor Theodor',
  'guide',
  'mentor',
  '{"dominant": "intelligent", "secondary": ["curious", "helpful", "eccentric"]}',
  '{"species": "human", "description": "Gelehrter Professor Theodor • Elderly scholar with round glasses, ink-stained fingers, books under arm", "colorPalette": ["brown", "green", "gold"]}',
  60,
  '{1, 2, 3, 4, 5}',
  '{"fantasy", "castle", "city"}',
  'male',
  'elder',
  'human',
  '{"scholar", "mentor", "teacher"}',
  'medium',
  'nobility'
);

-- 6. MERCHANTS & INNKEEPERS (2 characters)

INSERT INTO character_pool (
  id, name, role, archetype, emotional_nature, visual_profile, max_screen_time, available_chapters, canon_settings,
  gender, age_category, species_category, profession_tags, size_category, social_class
) VALUES
(
  'a2b3c4d5-6e7f-8a9b-0c1d-2e3f4a5b6c7d',
  'Händler Gustav',
  'support',
  'neutral',
  '{"dominant": "greedy", "secondary": ["shrewd", "talkative", "opportunistic"]}',
  '{"species": "human", "description": "Händler Gustav • Plump merchant with colorful vest, gold rings, persuasive smile", "colorPalette": ["gold", "purple", "green"]}',
  50,
  '{1, 2, 3, 4, 5}',
  '{"fantasy", "village", "city"}',
  'male',
  'adult',
  'human',
  '{"merchant", "trader", "shopkeeper"}',
  'medium',
  'merchant'
),
(
  'b3c4d5e6-7f8a-9b0c-1d2e-3f4a5b6c7d8e',
  'Wirtin Martha',
  'support',
  'helper',
  '{"dominant": "warm", "secondary": ["gossipy", "helpful", "motherly"]}',
  '{"species": "human", "description": "Wirtin Martha • Cheerful innkeeper with rosy cheeks, apron, welcoming arms", "colorPalette": ["red", "white", "brown"]}',
  50,
  '{1, 2, 3, 4, 5}',
  '{"fantasy", "village", "city"}',
  'female',
  'adult',
  'human',
  '{"innkeeper", "helper", "worker"}',
  'medium',
  'commoner'
);

-- 7. SERVANTS & WORKERS (4 characters)

INSERT INTO character_pool (
  id, name, role, archetype, emotional_nature, visual_profile, max_screen_time, available_chapters, canon_settings,
  gender, age_category, species_category, profession_tags, size_category, social_class
) VALUES
(
  'c4d5e6f7-8a9b-0c1d-2e3f-4a5b6c7d8e9f',
  'Diener Johann',
  'support',
  'helper',
  '{"dominant": "loyal", "secondary": ["humble", "obedient", "nervous"]}',
  '{"species": "human", "description": "Diener Johann • Thin servant with neat uniform, respectful bow, attentive eyes", "colorPalette": ["black", "white", "gray"]}',
  40,
  '{1, 2, 3, 4, 5}',
  '{"fantasy", "castle", "village"}',
  'male',
  'adult',
  'human',
  '{"servant", "helper", "worker"}',
  'small',
  'commoner'
),
(
  'd5e6f7a8-9b0c-1d2e-3f4a-5b6c7d8e9f0a',
  'Magd Elsa',
  'support',
  'helper',
  '{"dominant": "hardworking", "secondary": ["kind", "tired", "hopeful"]}',
  '{"species": "human", "description": "Magd Elsa • Young maid with simple dress, tired but kind eyes, worn hands", "colorPalette": ["brown", "white", "blue"]}',
  40,
  '{1, 2, 3, 4, 5}',
  '{"fantasy", "castle", "village"}',
  'female',
  'young_adult',
  'human',
  '{"servant", "helper", "worker"}',
  'small',
  'commoner'
),
(
  'e6f7a8b9-0c1d-2e3f-4a5b-6c7d8e9f0a1b',
  'Hirtenjunge Peter',
  'companion',
  'innocent',
  '{"dominant": "playful", "secondary": ["brave", "curious", "loyal"]}',
  '{"species": "human", "description": "Hirtenjunge Peter • Young shepherd boy with simple tunic, wooden staff, cheerful smile", "colorPalette": ["brown", "green", "beige"]}',
  50,
  '{1, 2, 3, 4, 5}',
  '{"fantasy", "village", "forest"}',
  'male',
  'child',
  'human',
  '{"shepherd", "child", "worker"}',
  'small',
  'commoner'
),
(
  'f7a8b9c0-1d2e-3f4a-5b6c-7d8e9f0a1b2c',
  'Bauerntochter Greta',
  'companion',
  'innocent',
  '{"dominant": "kind", "secondary": ["hardworking", "cheerful", "helpful"]}',
  '{"species": "human", "description": "Bauerntochter Greta • Peasant girl with braided hair, simple dress, basket of flowers", "colorPalette": ["blue", "brown", "yellow"]}',
  50,
  '{1, 2, 3, 4, 5}',
  '{"fantasy", "village", "forest"}',
  'female',
  'child',
  'human',
  '{"farmer", "child", "worker"}',
  'small',
  'commoner'
);
