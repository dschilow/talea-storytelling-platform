-- Migration 9: Add complete fairy tale scenes with all 5 chapters
-- Fixes Problem 4: Empty chapter descriptions for chapters 2-5

-- Add complete scenes for "Die kleine Meerjungfrau" (andersen-001)
-- This tale exists in the database but needs ALL 5 chapter descriptions

DELETE FROM fairy_tale_scenes WHERE tale_id = 'andersen-001';

-- Chapter 1: Die Unterwasserwelt
INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, setting, mood, illustration_prompt_template, duration_seconds)
VALUES (
  'andersen-001',
  1,
  'Die Unterwasserwelt',
  'Die {protagonist_title} lebt mit {protagonist_siblings} Schwestern im prächtigen Unterwasser-Palast. {protagonist_sie} träumt von der Welt über dem Wasser und den Menschen. Mit sehnsüchtigem Blick schaut {protagonist_sie} durch das Wasser zur Oberfläche, wo das Sonnenlicht wie goldene Fäden tanzt.',
  'Prachtvoller Unterwasser-Palast mit Korallen, tropischen Fischen, schimmerndem Wasser',
  'Magisch, sehnsüchtig, träumerisch',
  'HERO SHOT of {protagonist_name} ({protagonist_description}) gazing upward toward surface light. LIGHTING: soft underwater golden hour glow with shafts of light piercing blue water. COMPOSITION: foreground: iridescent coral and small tropical fish; midground: {protagonist_name} with shimmering {protagonist_tail_description}, longing expression; background: grand coral palace with arched windows and distant silhouettes of sisters. MOOD: magical, wistful, dreamy. STYLE: Watercolor illustration style, Axel Scheffler inspired; gentle textures, warm-cool contrast, storybook charm.',
  90
);

-- Chapter 2: Sturm und Rettung
INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, setting, mood, illustration_prompt_template, duration_seconds)
VALUES (
  'andersen-001',
  2,
  'Sturm und Rettung',
  'Ein gewaltiger Sturm tobt über dem Meer. Ein Schiff kentert in den Wellen. Die {protagonist_title} sieht einen jungen Prinzen in Seenot und rettet {protagonist_ihn} mutig vor dem Ertrinken. {protagonist_sie_cap} bringt {protagonist_ihn} an Land und bleibt verborgen, als Menschen {protagonist_ihn} finden. {protagonist_ihr_cap} Herz hat sich in den Prinzen verliebt.',
  'Stürmisches Meer bei Dämmerung, kenterndes Schiff, sandiger Strand',
  'Dramatisch, heldenhaft, aufregend',
  'WIDE SHOT of a storm-tossed sea at dusk. LIGHTING: dramatic storm light with dark clouds and silver highlights. FOREGROUND: churning waves, splintered wood, and flying rope. MIDGROUND: {protagonist_name} ({protagonist_transformation_hint}) carrying an unconscious prince toward a sandy shore; wet hair, water dripping. BACKGROUND: overturned boat and panicked crew on the beach. MOOD: urgent, heroic, tender. STYLE: Watercolor illustration style, Axel Scheffler inspired; dynamic motion, textured brushstrokes, emotional clarity.',
  90
);

-- Chapter 3: Der Handel mit der Meerhexe
INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, setting, mood, illustration_prompt_template, duration_seconds)
VALUES (
  'andersen-001',
  3,
  'Der Handel mit der Meerhexe',
  'Die {protagonist_title} sucht die {antagonist_title} in {antagonist_ihrer} dunklen Höhle auf. Die {antagonist_title} bietet {protagonist_ihr} einen Trank: {protagonist_sie_cap} wird menschliche Beine bekommen, aber {protagonist_ihre} wunderschöne Stimme verlieren. Jeder Schritt wird schmerzen. Wenn der Prinz eine andere heiratet, wird die {protagonist_title} zu Schaum werden. Verzweifelt vor Liebe akzeptiert {protagonist_sie} den Handel.',
  'Düstere Unterwasser-Höhle, schwaches phosphoreszierendes Licht, blubbernde Kessel',
  'Gespannt, geheimnisvoll, bedrohlich',
  'CLOSE-UP DRAMATIC ANGLE of {antagonist_name} ({antagonist_description}) as the sea witch, and {protagonist_name} ({protagonist_description}) in a rocky underwater cavern. LIGHTING: dramatic shafts of dim, eerie light and cool shadows. FOREGROUND: bubbling potion bottle in {antagonist_name} hands releasing silver vapors. MIDGROUND: {protagonist_name} clutching {protagonist_chest}, pain and hope on face. BACKGROUND: jumbled rocks, seaweed curtains, and faint bioluminescent glow. MOOD: tense, secretive, a touch of menace. STYLE: Watercolor illustration style, Axel Scheffler inspired; textured tones and expressive faces.',
  90
);

-- Chapter 4: An Land
INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, setting, mood, illustration_prompt_template, duration_seconds)
VALUES (
  'andersen-001',
  4,
  'An Land',
  'Mit menschlichen Beinen lebt die {protagonist_title} nun im Schloss. Jeder Schritt schmerzt wie Messerstiche, aber {protagonist_sie} tanzt mutig für den Prinzen. {protagonist_sie_cap} kann nicht sprechen und {protagonist_ihr} Herz bricht, als der Prinz eine Prinzessin aus einem Nachbarreich heiraten will. Er glaubt, diese Prinzessin habe {protagonist_ihn} damals gerettet.',
  'Königliches Schloss mit Gärten, Ballsaal, Sonnenuntergang am Strand',
  'Bittersüß, hoffnungsvoll aber schmerzhaft',
  'DRAMATIC ANGLE of {protagonist_name} ({protagonist_human_description}) on the shoreline, now with human legs, looking toward a distant castle garden where the Prince and a princess walk. LIGHTING: golden hour sunlight with soft warm highlights. FOREGROUND: {protagonist_name} standing in wet sand, small footprints behind. MIDGROUND: Prince in fine clothes, laughing with a young princess; guests and banners blur. BACKGROUND: castle towers, fluttering pennants, and distant sea. MOOD: bittersweet, hopeful yet aching. STYLE: Watercolor illustration style, Axel Scheffler inspired; rich warm palette and gentle detail.',
  90
);

-- Chapter 5: Das Opfer
INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, setting, mood, illustration_prompt_template, duration_seconds)
VALUES (
  'andersen-001',
  5,
  'Das Opfer',
  'Am Hochzeitstag des Prinzen hat die {protagonist_title} nur eine Chance zu überleben: {protagonist_Sie} müsste den Prinzen töten. Doch {protagonist_ihre} Liebe ist zu groß. {protagonist_sie_cap} wirft das Messer ins Meer und springt bei Sonnenaufgang ins Wasser, wo {protagonist_ihr} Körper zu Schaum wird. Aber {protagonist_ihre} selbstlose Liebe wird belohnt – {protagonist_sie} verwandelt sich in einen Luftgeist und erhält die Chance, durch gute Taten eine unsterbliche Seele zu erlangen.',
  'Strand bei Morgengrauen, sanfte Wellen, weicher goldener Nebel',
  'Feierlich, zärtlich, erhebend',
  'WIDE SHOT of the shore at dawn with gentle waves and soft light. LIGHTING: soft golden morning light, delicate highlights on water. FOREGROUND: empty wet sand with faint footprints leading to the sea. MIDGROUND: faint shimmering figure dissolving into sea foam ({protagonist_name}, {protagonist_transformation_hint}) as magical sparkles rise. BACKGROUND: distant castle silhouette, {helper_characters} watching from rocks. MOOD: solemn, tender, uplifting. STYLE: Watercolor illustration style, Axel Scheffler inspired; airy textures and gentle emotion.',
  90
);

-- Add character role mapping for role transformation system
-- This helps Phase2 know which avatars should get which transformations

UPDATE fairy_tales 
SET summary = 'Eine junge Meerjungfrau träumt davon, ein Mensch zu werden und verliebt sich in einen Prinzen. Sie macht einen gefährlichen Handel mit der Meerhexe und gibt ihre Stimme auf, um menschliche Beine zu bekommen. Doch wahre Liebe erfordert das größte Opfer.'
WHERE id = 'andersen-001';
