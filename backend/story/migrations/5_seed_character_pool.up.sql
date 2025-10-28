-- Seed initial character pool with diverse, high-quality supporting characters
-- These characters can be used across different stories

-- 1. GUIDE CHARACTERS (Mentors, Teachers, Wise Elders)

INSERT INTO character_pool (id, name, role, archetype, emotional_nature, visual_profile, max_screen_time, available_chapters, canon_settings) VALUES
('char_001_frau_mueller', 'Frau Müller', 'guide', 'helpful_elder',
    '{"dominant": "wise", "secondary": ["protective", "kind"], "triggers": ["children in danger", "nature destruction"]}'::jsonb,
    '{"description": "70-year-old woman, gray hair in neat bun, kind brown eyes, green knitted shawl", "imagePrompt": "elderly woman with gray hair bun, kind expression, green shawl, warm smile, grandmother figure, watercolor illustration", "species": "human", "colorPalette": ["green", "gray", "beige"]}'::jsonb,
    80, ARRAY[1,2,3,4,5], ARRAY['forest', 'village', 'mountain']),

('char_002_professor_lichtweis', 'Professor Lichtweis', 'guide', 'scholarly_mentor',
    '{"dominant": "curious", "secondary": ["wise", "patient", "enthusiastic"], "triggers": ["mysteries", "learning opportunities"]}'::jsonb,
    '{"description": "60-year-old professor, round glasses, wild white hair, colorful vest, always with a book", "imagePrompt": "elderly professor with round glasses, wild white hair, colorful vest, book in hand, enthusiastic expression, watercolor illustration", "species": "human", "colorPalette": ["purple", "white", "gold"]}'::jsonb,
    75, ARRAY[1,2,3,4,5], ARRAY['castle', 'village', 'city']),

('char_003_alte_eiche', 'Die Alte Eiche', 'guide', 'magical_mentor',
    '{"dominant": "wise", "secondary": ["ancient", "protective", "mysterious"], "triggers": ["forest threats", "lost travelers"]}'::jsonb,
    '{"description": "Ancient talking oak tree with a kind face in bark, glowing amber eyes, branches like protective arms", "imagePrompt": "ancient talking oak tree with wise face carved in bark, glowing amber eyes, protective branches, magical aura, watercolor illustration", "species": "magical_nature", "colorPalette": ["brown", "green", "amber"]}'::jsonb,
    70, ARRAY[1,2,3,5], ARRAY['forest', 'mountain']);

-- 2. COMPANION CHARACTERS (Loyal Friends, Animal Helpers)

INSERT INTO character_pool (id, name, role, archetype, emotional_nature, visual_profile, max_screen_time, available_chapters, canon_settings) VALUES
('char_004_hirsch_silberhorn', 'Silberhorn der Hirsch', 'companion', 'loyal_animal',
    '{"dominant": "protective", "secondary": ["noble", "wise", "brave"], "triggers": ["friends in danger", "injustice"]}'::jsonb,
    '{"description": "Noble forest deer with majestic silver antlers, deep brown eyes, magical silver shimmer on fur", "imagePrompt": "noble forest deer with silver antlers, majestic posture, deep brown eyes, magical silver shimmer, protective stance, watercolor illustration", "species": "animal", "colorPalette": ["brown", "silver", "green"]}'::jsonb,
    70, ARRAY[1,2,3,4,5], ARRAY['forest', 'mountain']),

('char_005_luna_die_katze', 'Luna', 'companion', 'clever_animal',
    '{"dominant": "clever", "secondary": ["curious", "independent", "loyal"], "triggers": ["puzzles", "hidden things"]}'::jsonb,
    '{"description": "Sleek black cat with bright green eyes, white paws, intelligent expression, graceful movements", "imagePrompt": "sleek black cat with bright green eyes, white paws, intelligent expression, graceful posture, watercolor illustration", "species": "animal", "colorPalette": ["black", "green", "white"]}'::jsonb,
    65, ARRAY[1,2,3,4,5], ARRAY['village', 'city', 'castle']),

('char_006_pip_das_eichhoernchen', 'Pip', 'companion', 'playful_helper',
    '{"dominant": "playful", "secondary": ["energetic", "helpful", "quick"], "triggers": ["fun opportunities", "friends needing help"]}'::jsonb,
    '{"description": "Energetic red squirrel with fluffy tail, bright eyes, always carrying acorns, cheerful expression", "imagePrompt": "energetic red squirrel with fluffy tail, bright eyes, carrying acorns, cheerful expression, playful pose, watercolor illustration", "species": "animal", "colorPalette": ["red", "orange", "brown"]}'::jsonb,
    60, ARRAY[2,3,4], ARRAY['forest', 'village', 'mountain']);

-- 3. DISCOVERY CHARACTERS (Magical Creatures, Mysterious Beings)

INSERT INTO character_pool (id, name, role, archetype, emotional_nature, visual_profile, max_screen_time, available_chapters, canon_settings) VALUES
('char_007_silberfunke', 'Silberfunke', 'discovery', 'magical_sprite',
    '{"dominant": "playful", "secondary": ["mysterious", "wise", "mischievous"], "triggers": ["worthy seekers", "pure hearts"]}'::jsonb,
    '{"description": "Small glowing sprite with silver butterfly wings, sparkling trail, mischievous smile, size of a hand", "imagePrompt": "small glowing sprite with silver butterfly wings, sparkles and magical light trail, mischievous smile, tiny size, watercolor illustration", "species": "magical_creature", "colorPalette": ["silver", "blue", "white"]}'::jsonb,
    50, ARRAY[3,4,5], ARRAY['forest', 'castle', 'mountain']),

('char_008_nebelfee', 'Die Nebelfee', 'discovery', 'ethereal_guide',
    '{"dominant": "mysterious", "secondary": ["gentle", "wise", "elusive"], "triggers": ["lost souls", "true need"]}'::jsonb,
    '{"description": "Translucent fairy-like being made of mist and moonlight, flowing silver hair, barely visible face, ethereal presence", "imagePrompt": "ethereal fairy made of mist and moonlight, translucent form, flowing silver hair, gentle glow, mysterious presence, watercolor illustration", "species": "magical_creature", "colorPalette": ["silver", "white", "blue"]}'::jsonb,
    45, ARRAY[2,3,4], ARRAY['forest', 'mountain', 'beach']),

('char_009_golddrache', 'Funkelflug', 'discovery', 'friendly_dragon',
    '{"dominant": "protective", "secondary": ["friendly", "wise", "playful"], "triggers": ["true friends", "adventure"]}'::jsonb,
    '{"description": "Small friendly dragon with golden scales, large curious eyes, tiny wings, size of a large dog, playful demeanor", "imagePrompt": "small friendly dragon with golden scales, large curious eyes, tiny wings, playful expression, non-threatening, watercolor illustration", "species": "magical_creature", "colorPalette": ["gold", "orange", "red"]}'::jsonb,
    65, ARRAY[3,4,5], ARRAY['mountain', 'castle', 'forest']);

-- 4. OBSTACLE CHARACTERS (Challenges, Antagonists with Depth)

INSERT INTO character_pool (id, name, role, archetype, emotional_nature, visual_profile, max_screen_time, available_chapters, canon_settings) VALUES
('char_010_graf_griesgram', 'Graf Griesgram', 'obstacle', 'misunderstood_grump',
    '{"dominant": "grumpy", "secondary": ["lonely", "protective", "misunderstood"], "triggers": ["trespassers", "noise", "disorder"]}'::jsonb,
    '{"description": "Old nobleman with stern face, gray beard, dark formal clothes, actually just lonely and set in his ways", "imagePrompt": "elderly nobleman with stern expression, gray beard, dark formal Victorian clothes, lonely eyes, not truly evil, watercolor illustration", "species": "human", "colorPalette": ["gray", "black", "purple"]}'::jsonb,
    60, ARRAY[2,3,4], ARRAY['castle', 'village', 'city']),

('char_011_die_nebelhexe', 'Die Nebelhexe', 'obstacle', 'trickster_witch',
    '{"dominant": "mischievous", "secondary": ["clever", "playful", "mysterious"], "triggers": ["boredom", "challenges", "clever opponents"]}'::jsonb,
    '{"description": "Middle-aged witch with wild curly hair, mischievous grin, colorful patchwork robes, not evil just playful", "imagePrompt": "witch with wild curly hair, mischievous grin, colorful patchwork robes, playful expression, not threatening, watercolor illustration", "species": "magical_human", "colorPalette": ["purple", "green", "orange"]}'::jsonb,
    55, ARRAY[2,3,4,5], ARRAY['forest', 'village', 'mountain']),

('char_012_steingolem', 'Brumm der Steinwächter', 'obstacle', 'guardian_challenge',
    '{"dominant": "protective", "secondary": ["strong", "slow", "honorable"], "triggers": ["intruders", "rule-breakers"]}'::jsonb,
    '{"description": "Large stone golem covered in moss, slow but powerful, ancient guardian with a kind heart beneath rough exterior", "imagePrompt": "large stone golem covered in moss, powerful but not aggressive, ancient guardian, kind glowing eyes, watercolor illustration", "species": "magical_creature", "colorPalette": ["gray", "green", "brown"]}'::jsonb,
    50, ARRAY[2,3,4], ARRAY['mountain', 'castle', 'forest']);

-- 5. SUPPORT CHARACTERS (Townspeople, Minor Helpers)

INSERT INTO character_pool (id, name, role, archetype, emotional_nature, visual_profile, max_screen_time, available_chapters, canon_settings) VALUES
('char_013_baecker_braun', 'Bäcker Braun', 'support', 'helpful_villager',
    '{"dominant": "kind", "secondary": ["helpful", "cheerful", "generous"], "triggers": ["hungry children", "community events"]}'::jsonb,
    '{"description": "Jovial baker with flour-dusted apron, warm smile, round belly, always smells like fresh bread", "imagePrompt": "friendly baker with flour-dusted apron, warm smile, round belly, holding fresh bread, cheerful expression, watercolor illustration", "species": "human", "colorPalette": ["brown", "white", "gold"]}'::jsonb,
    40, ARRAY[1,2,5], ARRAY['village', 'city']),

('char_014_leuchtturmwaerterin', 'Frau Wellenreiter', 'support', 'sea_keeper',
    '{"dominant": "calm", "secondary": ["wise", "protective", "patient"], "triggers": ["storms", "lost sailors"]}'::jsonb,
    '{"description": "Weather-worn lighthouse keeper with braided gray hair, kind sea-blue eyes, practical clothing, speaks of the ocean", "imagePrompt": "lighthouse keeper woman with braided gray hair, sea-blue eyes, practical clothing, weathered face, wise expression, watercolor illustration", "species": "human", "colorPalette": ["blue", "white", "gray"]}'::jsonb,
    45, ARRAY[1,2,3], ARRAY['beach', 'village']),

('char_015_bibliothekar_seitenflug', 'Herr Seitenflug', 'support', 'knowledge_keeper',
    '{"dominant": "curious", "secondary": ["helpful", "organized", "enthusiastic"], "triggers": ["questions", "book lovers"]}'::jsonb,
    '{"description": "Thin librarian with tall stature, round glasses, vest with many pockets full of bookmarks, loves sharing knowledge", "imagePrompt": "thin librarian with round glasses, vest with many pockets, bookmarks everywhere, enthusiastic expression, surrounded by books, watercolor illustration", "species": "human", "colorPalette": ["brown", "beige", "gold"]}'::jsonb,
    40, ARRAY[1,2,3], ARRAY['castle', 'village', 'city']);

-- 6. SPECIAL/UNIQUE CHARACTERS (For Specific Story Types)

INSERT INTO character_pool (id, name, role, archetype, emotional_nature, visual_profile, max_screen_time, available_chapters, canon_settings) VALUES
('char_016_zeitweber', 'Der Zeitweber', 'special', 'time_mystical',
    '{"dominant": "mysterious", "secondary": ["wise", "ancient", "patient"], "triggers": ["time paradoxes", "important moments"]}'::jsonb,
    '{"description": "Ageless being with flowing robes that shimmer like time itself, eyes like hourglasses, speaks in riddles about past and future", "imagePrompt": "mystical being with shimmering time-like robes, hourglass eyes, ageless face, mysterious presence, flowing ethereal clothing, watercolor illustration", "species": "magical_being", "colorPalette": ["silver", "blue", "purple"]}'::jsonb,
    40, ARRAY[3,4,5], ARRAY['castle', 'mountain', 'forest']),

('char_017_sternentaenzerin', 'Astra', 'special', 'cosmic_visitor',
    '{"dominant": "wonder", "secondary": ["gentle", "wise", "ethereal"], "triggers": ["clear nights", "dreamers", "wishes"]}'::jsonb,
    '{"description": "Celestial being with skin like night sky filled with stars, flowing cosmic hair, gentle glow, brings messages from the stars", "imagePrompt": "celestial being with starry skin, cosmic flowing hair, gentle glow, ethereal beauty, star-filled appearance, watercolor illustration", "species": "cosmic_being", "colorPalette": ["dark blue", "silver", "purple"]}'::jsonb,
    35, ARRAY[4,5], ARRAY['mountain', 'beach', 'forest']),

('char_018_traumweber', 'Morpheus', 'special', 'dream_weaver',
    '{"dominant": "gentle", "secondary": ["mysterious", "protective", "creative"], "triggers": ["nightmares", "sleep troubles", "dreams"]}'::jsonb,
    '{"description": "Soft-featured being wrapped in clouds and moonlight, carries a bag of dreams, gentle purple glow, comforting presence", "imagePrompt": "dream-like being wrapped in clouds, moonlight glow, bag of dreams, soft purple aura, comforting gentle face, watercolor illustration", "species": "dream_being", "colorPalette": ["purple", "white", "silver"]}'::jsonb,
    40, ARRAY[3,4,5], ARRAY['castle', 'village', 'forest']);
