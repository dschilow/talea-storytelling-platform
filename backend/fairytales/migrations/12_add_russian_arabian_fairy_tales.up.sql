/* -- Migration 12: Add 11 Russian and Arabian Nights Fairy Tales
-- Adds russian-001 through russian-008 (8 tales)
-- Adds 1001-001 through 1001-003 (3 tales)

-- =====================================================
-- RUSSIAN FAIRY TALES (8 tales)
-- =====================================================

-- 1. WASSILISSA DIE WUNDERSCHÖNE

INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
VALUES (
  'russian-001',
  'Wassilissa die Wunderschöne',
  'russian',
  'ru',
  'Vasilisa the Beautiful',
  'Russland',
  8,
  18,
  '["Fantasy", "Mut", "Magie"]',
  'Mut und Weisheit überwinden das Böse',
  'Wassilissa wird von ihrer bösen Stiefmutter zu Baba Jaga geschickt. Mit Hilfe einer magischen Puppe besteht sie alle Prüfungen und findet ihr Glück.',
  true
);

INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, profession_preference)
VALUES
  ('russian-001', 'protagonist', 'Wassilissa', 1, 'Mutiges und kluges Mädchen', true, '["Kind", "Heldin"]'),
  ('russian-001', 'antagonist', 'Baba Jaga', 1, 'Furchteinflößende Hexe im Wald', true, '["Hexe", "Baba Jaga", "Bösewicht"]'),
  ('russian-001', 'antagonist', 'Stiefmutter', 1, 'Böse Stiefmutter', true, '["Erwachsene", "Stiefmutter"]'),
  ('russian-001', 'antagonist', 'Stiefschwestern', 2, 'Gemeine Stiefschwestern', true, '["Kind", "Schwester"]'),
  ('russian-001', 'helper', 'Magische Puppe', 1, 'Geschenk der verstorbenen Mutter', true, '["Puppe", "Magisches Objekt"]'),
  ('russian-001', 'love_interest', 'Zar', 1, 'Junger Zar', false, '["Zar", "König", "Prinz"]');

INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, character_variables, setting, mood, duration_seconds)
VALUES
  ('russian-001', 1, 'Das Geschenk der Mutter',
   'Vor ihrem Tod gibt Wassilissas Mutter ihr eine kleine [PUPPE]: "Füttere sie und sie wird dir helfen." [WASSILISSA] verspricht, die [PUPPE] immer bei sich zu tragen.',
   '{"PROTAGONIST": "WASSILISSA", "HELPER": "MAGISCHE_PUPPE"}',
   'Sterbezimmer', 'traurig', 80),

  ('russian-001', 2, 'Die böse Stiefamilie',
   'Der Vater heiratet erneut. Die [STIEFMUTTER] und ihre zwei [STIEFSCHWESTERN] sind grausam zu [WASSILISSA]. Sie geben ihr die schwerste Arbeit, doch [WASSILISSA] bleibt schön und freundlich - die [PUPPE] hilft ihr heimlich.',
   '{"PROTAGONIST": "WASSILISSA", "ANTAGONIST1": "STIEFMUTTER", "ANTAGONIST2": "STIEFSCHWESTERN", "HELPER": "MAGISCHE_PUPPE"}',
   'Haus', 'bedrückend', 85),

  ('russian-001', 3, 'Der Plan',
   'Als der Vater verreist, löscht die [STIEFMUTTER] absichtlich das Feuer: "Wassilissa muss zu Baba Jaga gehen und Feuer holen!" Die [STIEFSCHWESTERN] lachen böse - niemand kehrt von [BABA_JAGA] zurück.',
   '{"ANTAGONIST1": "STIEFMUTTER", "ANTAGONIST2": "STIEFSCHWESTERN", "PROTAGONIST": "WASSILISSA"}',
   'Haus', 'bedrohlich', 75),

  ('russian-001', 4, 'Im dunklen Wald',
   '[WASSILISSA] geht mutig in den finsteren Wald. Die [PUPPE] flüstert: "Hab keine Angst!" Reiter in Weiß, Rot und Schwarz galoppieren vorbei - Tag, Sonne und Nacht.',
   '{"PROTAGONIST": "WASSILISSA", "HELPER": "MAGISCHE_PUPPE"}',
   'Dunkler Wald', 'unheimlich', 90),

  ('russian-001', 5, 'Baba Jagas Hütte',
   'Die Hütte von [BABA_JAGA] steht auf Hühnerbeinen! Ein Zaun aus Knochen umgibt sie. [BABA_JAGA] erscheint in ihrem Mörser, rudert mit dem Stößel: "Wer wagt es, mich zu stören?"',
   '{"ANTAGONIST": "BABA_JAGA", "PROTAGONIST": "WASSILISSA"}',
   'Baba Jagas Hütte', 'furchterregend', 95),

  ('russian-001', 6, 'Die Aufgaben',
   '[BABA_JAGA] gibt [WASSILISSA] unmögliche Aufgaben: "Wasche die Wäsche, koche das Essen, säubere den Hof, trenne verdorbenes vom guten Korn - oder ich fresse dich!" Jede Nacht hilft die [PUPPE] heimlich.',
   '{"PROTAGONIST": "WASSILISSA", "ANTAGONIST": "BABA_JAGA", "HELPER": "MAGISCHE_PUPPE"}',
   'Baba Jagas Hütte', 'spannend', 100),

  ('russian-001', 7, 'Die Flucht mit dem Feuer',
   '[BABA_JAGA] ist wütend, dass [WASSILISSA] alles schafft. Sie gibt ihr einen Schädel mit glühenden Augen: "Hier ist dein Feuer!" [WASSILISSA] läuft nach Hause. Der Schädel leuchtet unheimlich.',
   '{"PROTAGONIST": "WASSILISSA", "ANTAGONIST": "BABA_JAGA"}',
   'Wald', 'triumphierend', 85),

  ('russian-001', 8, 'Die Gerechtigkeit',
   'Zu Hause starren die Augen des Schädels die [STIEFMUTTER] und [STIEFSCHWESTERN] an. Am Morgen sind sie zu Asche verbrannt. [WASSILISSA] ist frei. Sie webt wunderbare Stoffe und der [ZAR] verliebt sich in sie. Sie wird Zarin!',
   '{"PROTAGONIST": "WASSILISSA", "LOVE_INTEREST": "ZAR"}',
   'Palast', 'erlösend', 90);

-- 2. DER FEUERVOGEL

INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
VALUES (
  'russian-002',
  'Der Feuervogel',
  'russian',
  'ru',
  'The Firebird',
  'Russland',
  6,
  16,
  '["Abenteuer", "Magie", "Quest"]',
  'Treue Freundschaft wird belohnt',
  'Iwan findet eine goldene Feder des Feuervogels. Mit Hilfe des grauen Wolfs muss er den Feuervogel fangen, eine Prinzessin gewinnen und viele Abenteuer bestehen.',
  true
);

INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, profession_preference)
VALUES
  ('russian-002', 'protagonist', 'Iwan Zarewitsch', 1, 'Mutiger junger Prinz', true, '["Prinz", "Held"]'),
  ('russian-002', 'helper', 'Grauer Wolf', 1, 'Magischer sprechender Wolf', true, '["Wolf", "Tier", "Magisches Wesen"]'),
  ('russian-002', 'supporting', 'Feuervogel', 1, 'Wunderschöner magischer Vogel', true, '["Vogel", "Feuervogel", "Magisches Wesen"]'),
  ('russian-002', 'love_interest', 'Prinzessin Elena', 1, 'Wunderschöne Prinzessin', true, '["Prinzessin"]'),
  ('russian-002', 'antagonist', 'Böser Zar', 1, 'Gieriger Herrscher', true, '["Zar", "König", "Bösewicht"]'),
  ('russian-002', 'antagonist', 'Brüder', 2, 'Neidische Brüder von Iwan', false, '["Prinz", "Bruder"]');

INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, character_variables, setting, mood, duration_seconds)
VALUES
  ('russian-002', 1, 'Die goldene Feder',
   '[IWAN] findet im königlichen Garten eine leuchtende goldene Feder. Sie stammt vom [FEUERVOGEL]! Der Zar befiehlt: "Bring mir diesen Vogel oder verliere deinen Kopf!"',
   '{"PROTAGONIST": "IWAN_ZAREWITSCH", "SUPPORTING": "FEUERVOGEL"}',
   'Königlicher Garten', 'aufgeregt', 75),

  ('russian-002', 2, 'Der treue Wolf',
   '[IWAN] reitet in den Wald. Sein Pferd wird von einem [WOLF] gefressen. Doch der [WOLF] bereut: "Steig auf meinen Rücken, ich werde dir dienen!" Der [WOLF] ist magisch und kann sprechen.',
   '{"PROTAGONIST": "IWAN_ZAREWITSCH", "HELPER": "GRAUER_WOLF"}',
   'Dunkler Wald', 'überraschend', 80),

  ('russian-002', 3, 'Der Feuervogel im goldenen Käfig',
   'Der [WOLF] trägt [IWAN] zum Garten des [BÖSEN_ZARS]. "Nimm den [FEUERVOGEL], aber nicht den goldenen Käfig!", warnt der [WOLF]. Doch [IWAN] kann nicht widerstehen - Alarm ertönt!',
   '{"PROTAGONIST": "IWAN_ZAREWITSCH", "HELPER": "GRAUER_WOLF", "SUPPORTING": "FEUERVOGEL"}',
   'Zauberschloss', 'spannend', 90),

  ('russian-002', 4, 'Die Aufgabe',
   'Der [BÖSE_ZAR] erwischt [IWAN]: "Du kannst dein Leben retten, wenn du mir das Pferd mit der goldenen Mähne bringst!" Der [WOLF] seufzt: "Hättest du nur auf mich gehört!"',
   '{"PROTAGONIST": "IWAN_ZAREWITSCH", "ANTAGONIST": "BÖSER_ZAR", "HELPER": "GRAUER_WOLF"}',
   'Thronsaal', 'bedrohlich', 75),

  ('russian-002', 5, 'Die schöne Prinzessin',
   'Beim Versuch, das Pferd zu stehlen, muss [IWAN] nun [PRINZESSIN_ELENA] holen. Aber als er sie sieht, verliebt er sich unsterblich. Der [WOLF] hilft ihm, sie zu gewinnen.',
   '{"PROTAGONIST": "IWAN_ZAREWITSCH", "LOVE_INTEREST": "PRINZESSIN_ELENA", "HELPER": "GRAUER_WOLF"}',
   'Palast', 'romantisch', 85),

  ('russian-002', 6, 'Die Verwandlungen',
   'Der [WOLF] verwandelt sich abwechselnd in die [PRINZESSIN], das Pferd und den [FEUERVOGEL], um die gierigen Zaren auszutricksen. So behält [IWAN] alles: den Vogel, das Pferd und seine geliebte [PRINZESSIN]!',
   '{"HELPER": "GRAUER_WOLF", "PROTAGONIST": "IWAN_ZAREWITSCH"}',
   'Verschiedene Orte', 'listig', 95),

  ('russian-002', 7, 'Der Verrat der Brüder',
   'Auf dem Heimweg töten [IWANS] neidische [BRÜDER] ihn und stehlen alles. Doch der treue [WOLF] findet das Wasser des Lebens und erweckt [IWAN] wieder.',
   '{"PROTAGONIST": "IWAN_ZAREWITSCH", "ANTAGONIST": "BRÜDER", "HELPER": "GRAUER_WOLF"}',
   'Wald', 'dramatisch', 90),

  ('russian-002', 8, 'Das glückliche Ende',
   '[IWAN] kehrt zurück und entlarvt seine [BRÜDER]. Er heiratet [PRINZESSIN_ELENA] und wird Zar. Der [FEUERVOGEL] singt bei der Hochzeit, und der [WOLF] verabschiedet sich als treuer Freund.',
   '{"PROTAGONIST": "IWAN_ZAREWITSCH", "LOVE_INTEREST": "PRINZESSIN_ELENA", "SUPPORTING": "FEUERVOGEL", "HELPER": "GRAUER_WOLF"}',
   'Palast', 'triumphierend', 85);

-- 3. VÄTERCHEN FROST

INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
VALUES (
  'russian-003',
  'Väterchen Frost',
  'russian',
  'ru',
  'Father Frost',
  'Russland',
  6,
  14,
  '["Fantasy", "Moral", "Winter"]',
  'Freundlichkeit und Bescheidenheit werden belohnt',
  'Ein freundliches Mädchen wird im Winter ausgesetzt. Väterchen Frost prüft sie und belohnt ihre Güte. Die böse Stiefschwester wird für ihre Gier bestraft.',
  true
);

INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, profession_preference)
VALUES
  ('russian-003', 'protagonist', 'Nastenka', 1, 'Freundliches und geduldiges Mädchen', true, '["Kind", "Mädchen"]'),
  ('russian-003', 'helper', 'Väterchen Frost', 1, 'Wintergeist mit weißem Bart', true, '["Frost", "Wintergeist", "Zauberer"]'),
  ('russian-003', 'antagonist', 'Stiefmutter', 1, 'Böse Stiefmutter', true, '["Erwachsene", "Stiefmutter"]'),
  ('russian-003', 'antagonist', 'Marfusha', 1, 'Verwöhnte Stiefschwester', true, '["Kind", "Mädchen", "Schwester"]'),
  ('russian-003', 'supporting', 'Vater', 1, 'Schwacher aber gutherziger Vater', false, '["Erwachsene", "Vater"]'),
  ('russian-003', 'helper', 'Hündchen', 1, 'Kleiner treuer Hund', false, '["Hund", "Tier"]');

INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, character_variables, setting, mood, duration_seconds)
VALUES
  ('russian-003', 1, 'Das arme Mädchen',
   '[NASTENKA] arbeitet vom Morgen bis zum Abend. Die [STIEFMUTTER] und ihre Tochter [MARFUSHA] behandeln sie wie eine Dienerin. [NASTENKAS] [VATER] ist zu schwach, um sie zu verteidigen.',
   '{"PROTAGONIST": "NASTENKA", "ANTAGONIST1": "STIEFMUTTER", "ANTAGONIST2": "MARFUSHA", "SUPPORTING": "VATER"}',
   'Bauernhaus', 'traurig', 75),

  ('russian-003', 2, 'In den Winterwald',
   'Die [STIEFMUTTER] befiehlt dem [VATER]: "Bring [NASTENKA] in den Winterwald und lass sie dort!" Mit Tränen in den Augen gehorcht der [VATER]. [NASTENKA] sitzt allein unter einer Kiefer im eisigen Schnee.',
   '{"PROTAGONIST": "NASTENKA", "SUPPORTING": "VATER", "ANTAGONIST": "STIEFMUTTER"}',
   'Verschneiter Wald', 'einsam', 80),

  ('russian-003', 3, 'Väterchen Frost erscheint',
   'Knack, knack, knack! [VÄTERCHEN_FROST] springt von Baum zu Baum. Er fragt [NASTENKA]: "Ist dir warm, Mädchen?" Sie antwortet höflich: "Ganz warm, Väterchen Frost", obwohl sie fast erfriert.',
   '{"HELPER": "VÄTERCHEN_FROST", "PROTAGONIST": "NASTENKA"}',
   'Verschneiter Wald', 'magisch', 85),

  ('russian-003', 4, 'Die Prüfung',
   '[VÄTERCHEN_FROST] macht es immer kälter: "Ist dir warm?" [NASTENKA] bleibt freundlich und geduldig. Beeindruckt von ihrer Güte schenkt er ihr einen Pelzmantel, Schmuck und eine Truhe voller Schätze.',
   '{"HELPER": "VÄTERCHEN_FROST", "PROTAGONIST": "NASTENKA"}',
   'Verschneiter Wald', 'wundersam', 90),

  ('russian-003', 5, 'Die Rückkehr',
   'Das [HÜNDCHEN] bellt: "Wau-wau! [NASTENKA] kommt mit Schätzen!" Die [STIEFMUTTER] glaubt es nicht. Doch da kommt [NASTENKA] in prächtigen Kleidern, reich beschenkt!',
   '{"PROTAGONIST": "NASTENKA", "ANTAGONIST": "STIEFMUTTER", "HELPER": "HÜNDCHEN"}',
   'Vor dem Haus', 'triumphierend', 80),

  ('russian-003', 6, 'Die gierige Stiefschwester',
   'Die [STIEFMUTTER] schickt sofort ihre eigene Tochter [MARFUSHA] in den Wald: "Hol dir auch Geschenke!" [MARFUSHA] sitzt im Pelzmantel unter dem Baum und wartet ungeduldig.',
   '{"ANTAGONIST1": "MARFUSHA", "ANTAGONIST2": "STIEFMUTTER"}',
   'Verschneiter Wald', 'erwartungsvoll', 75),

  ('russian-003', 7, 'Die Strafe',
   '[VÄTERCHEN_FROST] fragt: "Ist dir warm?" [MARFUSHA] schreit: "Natürlich nicht, du dummer Alter! Gib mir sofort die Geschenke!" [VÄTERCHEN_FROST] wird böse und lässt sie im Eis erstarren.',
   '{"HELPER": "VÄTERCHEN_FROST", "ANTAGONIST": "MARFUSHA"}',
   'Verschneiter Wald', 'erschreckend', 85),

  ('russian-003', 8, 'Die Lehre',
   'Der [VATER] findet [MARFUSHA] erfroren. Die [STIEFMUTTER] weint bitterlich. [NASTENKA] aber lebt glücklich und heiratet einen guten Mann. Freundlichkeit triumphiert über Gier.',
   '{"PROTAGONIST": "NASTENKA", "SUPPORTING": "VATER"}',
   'Dorf', 'lehrreich', 70);

-- 4. DER KOLOBOK

INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
VALUES (
  'russian-004',
  'Der Kolobok',
  'russian',
  'ru',
  'The Little Round Bun',
  'Russland',
  4,
  8,
  '["Tier", "Lied", "Moral"]',
  'Vorsicht vor Übermut und Schmeichelei',
  'Ein rundes Brötchen rollt davon und singt ein Lied. Es entkommt vielen Tieren durch seine Schlauheit, wird aber am Ende vom listigen Fuchs überlistet.',
  true
);

INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, profession_preference)
VALUES
  ('russian-004', 'protagonist', 'Kolobok', 1, 'Rundes singенdes Brötchen', true, '["Brötchen", "Kolobok", "Magisches Wesen"]'),
  ('russian-004', 'supporting', 'Oma und Opa', 2, 'Altes Ehepaar', true, '["Oma", "Opa", "Alte"]'),
  ('russian-004', 'antagonist', 'Hase', 1, 'Hungriger Hase', true, '["Hase", "Tier"]'),
  ('russian-004', 'antagonist', 'Wolf', 1, 'Hungriger Wolf', true, '["Wolf", "Tier"]'),
  ('russian-004', 'antagonist', 'Bär', 1, 'Hungriger Bär', true, '["Bär", "Tier"]'),
  ('russian-004', 'antagonist', 'Fuchs', 1, 'Listiger Fuchs', true, '["Fuchs", "Tier"]');

INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, character_variables, setting, mood, duration_seconds)
VALUES
  ('russian-004', 1, 'Die Geburt',
   'Ein [OMA] backt aus den letzten Mehlresten ein Brötchen - den [KOLOBOK]. Sie legt ihn zum Abkühlen aufs Fensterbrett. Plötzlich rollt der [KOLOBOK] davon!',
   '{"SUPPORTING": "OMA_UND_OPA", "PROTAGONIST": "KOLOBOK"}',
   'Bauernhaus', 'überraschend', 65),

  ('russian-004', 2, 'Der Hase',
   'Der [KOLOBOK] rollt und singt: "Ich bin der Kolobok, rund und klein!" Da trifft er den [HASEN]: "Ich fresse dich!" Aber der [KOLOBOK] singt sein Lied und rollt davon.',
   '{"PROTAGONIST": "KOLOBOK", "ANTAGONIST": "HASE"}',
   'Waldweg', 'fröhlich', 70),

  ('russian-004', 3, 'Der Wolf',
   'Der [WOLF] versperrt den Weg: "Ich fresse dich!" Der [KOLOBOK] singt: "Ich bin vor Oma und Opa weggerollt, vor dem Hasen weggerollt, vor dir roll ich auch davon!" Und weg ist er!',
   '{"PROTAGONIST": "KOLOBOK", "ANTAGONIST": "WOLF"}',
   'Wald', 'mutig', 70),

  ('russian-004', 4, 'Der Bär',
   'Der große [BÄR] brummt: "Ich fresse dich!" Doch der [KOLOBOK] singt sein Lied wieder und rollt am [BÄREN] vorbei. Er wird immer übermütiger.',
   '{"PROTAGONIST": "KOLOBOK", "ANTAGONIST": "BÄR"}',
   'Wald', 'übermütig', 70),

  ('russian-004', 5, 'Der listige Fuchs',
   'Der [FUCHS] sagt süß: "Oh, was für ein schöner [KOLOBOK]! Sing mir dein Lied!" Der [KOLOBOK] singt stolz. Der [FUCHS] schmeichelt: "So schön! Aber ich höre schlecht. Komm näher!"',
   '{"PROTAGONIST": "KOLOBOK", "ANTAGONIST": "FUCHS"}',
   'Waldlichtung', 'hinterlistig', 75),

  ('russian-004', 6, 'Das Ende',
   'Der [KOLOBOK] rollt auf die Nase des [FUCHSES], dann auf seine Zunge. "Sing noch einmal!", sagt der [FUCHS]. Schnapp! Der [FUCHS] frisst den [KOLOBOK]. Ende der Geschichte!',
   '{"PROTAGONIST": "KOLOBOK", "ANTAGONIST": "FUCHS"}',
   'Waldlichtung', 'lehrreich', 65);

-- 5. DIE RÜBE

INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
VALUES (
  'russian-005',
  'Die Rübe',
  'russian',
  'ru',
  'The Gigantic Turnip',
  'Russland',
  4,
  8,
  '["Tier", "Teamwork", "Humor"]',
  'Zusammen schaffen wir mehr',
  'Ein Opa pflanzt eine Rübe, die riesig wächst. Alle müssen helfen, um sie herauszuziehen - vom Opa bis zur kleinsten Maus.',
  true
);

INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, profession_preference)
VALUES
  ('russian-005', 'protagonist', 'Opa', 1, 'Alter Bauer', true, '["Opa", "Bauer", "Alter"]'),
  ('russian-005', 'helper', 'Oma', 1, 'Alte Bäuerin', true, '["Oma", "Alte"]'),
  ('russian-005', 'helper', 'Enkelin', 1, 'Kleines Mädchen', true, '["Kind", "Enkelin"]'),
  ('russian-005', 'helper', 'Hund', 1, 'Treuer Hofhund', true, '["Hund", "Tier"]'),
  ('russian-005', 'helper', 'Katze', 1, 'Kleine Katze', true, '["Katze", "Tier"]'),
  ('russian-005', 'helper', 'Maus', 1, 'Winzige Maus', true, '["Maus", "Tier"]');

INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, character_variables, setting, mood, duration_seconds)
VALUES
  ('russian-005', 1, 'Die Riesige Rübe',
   '[OPA] pflanzt eine Rübe. Sie wächst und wächst und wird riesig! [OPA] versucht, sie herauszuziehen: "Eins, zwei, drei - zieh!" Aber die Rübe bewegt sich nicht.',
   '{"PROTAGONIST": "OPA"}',
   'Gemüsegarten', 'angestrengt', 70),

  ('russian-005', 2, 'Oma hilft',
   '[OPA] ruft [OMA]. [OMA] packt [OPA], [OPA] packt die Rübe. "Eins, zwei, drei - zieh!" Die Rübe bewegt sich ein bisschen, aber sie steckt fest.',
   '{"PROTAGONIST": "OPA", "HELPER": "OMA"}',
   'Gemüsegarten', 'angestrengt', 70),

  ('russian-005', 3, 'Die Enkelin kommt',
   '[OPA] ruft die [ENKELIN]. [ENKELIN] packt [OMA], [OMA] packt [OPA], [OPA] packt die Rübe. "Eins, zwei, drei - zieh!" Die Rübe wackelt, aber sie kommt nicht raus.',
   '{"PROTAGONIST": "OPA", "HELPER1": "OMA", "HELPER2": "ENKELIN"}',
   'Gemüsegarten', 'angestrengt', 70),

  ('russian-005', 4, 'Der Hund hilft',
   'Die [ENKELIN] ruft den [HUND]. [HUND] packt [ENKELIN], [ENKELIN] packt [OMA], [OMA] packt [OPA], [OPA] packt die Rübe. "Eins, zwei, drei - zieh!" Immer noch nicht!',
   '{"PROTAGONIST": "OPA", "HELPER1": "ENKELIN", "HELPER2": "HUND"}',
   'Gemüsegarten', 'angestrengt', 70),

  ('russian-005', 5, 'Die Katze hilft',
   'Der [HUND] ruft die [KATZE]. [KATZE] packt [HUND], [HUND] packt [ENKELIN], [ENKELIN] packt [OMA], [OMA] packt [OPA], [OPA] packt die Rübe. "Eins, zwei, drei - zieh!" Fast geschafft!',
   '{"PROTAGONIST": "OPA", "HELPER1": "HUND", "HELPER2": "KATZE"}',
   'Gemüsegarten', 'angestrengt', 70),

  ('russian-005', 6, 'Die winzige Maus',
   'Die [KATZE] ruft die kleine [MAUS]. [MAUS] packt [KATZE], [KATZE] packt [HUND], [HUND] packt [ENKELIN], [ENKELIN] packt [OMA], [OMA] packt [OPA], [OPA] packt die Rübe. "Eins, zwei, drei - zieh!" PLUMPS! Die Rübe kommt raus! Zusammen haben sie es geschafft!',
   '{"PROTAGONIST": "OPA", "HELPER1": "OMA", "HELPER2": "ENKELIN", "HELPER3": "HUND", "HELPER4": "KATZE", "HELPER5": "MAUS"}',
   'Gemüsegarten', 'triumphierend', 80);

-- 6. TEREMOK

INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
VALUES (
  ('russian-006',
  'Teremok',
  'russian',
  'ru',
  'The Little House',
  'Russland',
  4,
  10,
  '["Tier", "Gemeinschaft", "Humor"]',
  'Gemeinschaft und Teilen sind wichtig',
  'Ein kleines Haus im Wald wird zum Zuhause für immer mehr Tiere. Alle leben glücklich zusammen, bis ein großer Bär kommt.',
  true
);

INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, profession_preference)
VALUES
  ('russian-006', 'protagonist', 'Maus', 1, 'Kleine graue Maus', true, '["Maus", "Tier"]'),
  ('russian-006', 'helper', 'Frosch', 1, 'Grüner Frosch', true, '["Frosch", "Tier"]'),
  ('russian-006', 'helper', 'Hase', 1, 'Schneller Hase', true, '["Hase", "Tier"]'),
  ('russian-006', 'helper', 'Fuchs', 1, 'Schlaue Füchsin', true, '["Fuchs", "Tier"]'),
  ('russian-006', 'helper', 'Wolf', 1, 'Grauer Wolf', true, '["Wolf", "Tier"]'),
  ('russian-006', 'antagonist', 'Bär', 1, 'Riesiger Bär', true, '["Bär", "Tier"]');

INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, character_variables, setting, mood, duration_seconds)
VALUES
  ('russian-006', 1, 'Das leere Häuschen',
   'Im Wald steht ein kleines Häuschen - ein Teremok. Die [MAUS] läuft vorbei: "Wer wohnt im Teremok? Niemand? Dann wohne ich hier!" Die [MAUS] zieht ein.',
   '{"PROTAGONIST": "MAUS"}',
   'Wald', 'gemütlich', 65),

  ('russian-006', 2, 'Der Frosch zieht ein',
   'Der [FROSCH] hüpft vorbei: "Wer wohnt im Teremok?" Die [MAUS] antwortet: "Ich, die Maus! Und du?" - "Ich bin der Frosch!" - "Komm herein!" Sie leben zusammen.',
   '{"PROTAGONIST": "MAUS", "HELPER": "FROSCH"}',
   'Teremok', 'freundlich', 70),

  ('russian-006', 3, 'Hase, Fuchs und Wolf',
   'Nacheinander kommen der [HASE], der [FUCHS] und der [WOLF]. Jeder fragt: "Wer wohnt im Teremok?" Alle laden den Neuen ein. Bald sind fünf Tiere im kleinen Haus und leben glücklich zusammen.',
   '{"PROTAGONIST": "MAUS", "HELPER1": "HASE", "HELPER2": "FUCHS", "HELPER3": "WOLF"}',
   'Teremok', 'gesellig', 85),

  ('russian-006', 4, 'Der große Bär',
   'Ein riesiger [BÄR] stampft heran: "Wer wohnt im Teremok?" Alle Tiere antworten zusammen: "Maus, Frosch, Hase, Fuchs und Wolf! Und du?" - "Ich bin der Bär! Lasst mich rein!"',
   '{"PROTAGONIST": "MAUS", "HELPER1": "WOLF", "ANTAGONIST": "BÄR"}',
   'Vor dem Teremok', 'besorgt', 75),

  ('russian-006', 5, 'Das Haus bricht zusammen',
   'Die Tiere sagen: "Du bist zu groß!" Aber der [BÄR] quetscht sich trotzdem rein. KRACH! Das kleine Teremok bricht zusammen! Alle Tiere rennen raus.',
   '{"ANTAGONIST": "BÄR", "PROTAGONIST": "MAUS", "HELPER1": "FROSCH"}',
   'Teremok', 'chaotisch', 70),

  ('russian-006', 6, 'Das neue Haus',
   'Alle Tiere sind traurig. Aber dann sagt die [MAUS]: "Lasst uns zusammen ein neues, größeres Haus bauen!" Alle helfen mit. Bald steht ein schönes großes Teremok - mit Platz für alle, sogar für den [BÄREN]!',
   '{"PROTAGONIST": "MAUS", "HELPER1": "FROSCH", "HELPER2": "HASE", "HELPER3": "FUCHS", "HELPER4": "WOLF", "ANTAGONIST": "BÄR"}',
   'Wald', 'fröhlich', 85);

-- 7. BABA JAGA

INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
VALUES (
  'russian-007',
  'Baba Jaga',
  'russian',
  'ru',
  'Baba Yaga',
  'Russland',
  8,
  15,
  '["Fantasy", "Gruselig", "Mut"]',
  'Respekt und Mut besiegen das Böse',
  'Ein Mädchen wird von ihrer bösen Stiefmutter zu Baba Jaga geschickt. Mit Höflichkeit, Mut und klugen Geschenken entkommt sie der gefährlichen Hexe.',
  true
);

INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, profession_preference)
VALUES
  ('russian-007', 'protagonist', 'Mascha', 1, 'Mutiges kluges Mädchen', true, '["Kind", "Mädchen"]'),
  ('russian-007', 'antagonist', 'Baba Jaga', 1, 'Furchteinflößende Hexe', true, '["Hexe", "Baba Jaga", "Bösewicht"]'),
  ('russian-007', 'antagonist', 'Stiefmutter', 1, 'Böse Stiefmutter', true, '["Erwachsene", "Stiefmutter"]'),
  ('russian-007', 'helper', 'Katze', 1, 'Dünne hungrige Katze', true, '["Katze", "Tier"]'),
  ('russian-007', 'helper', 'Hund', 1, 'Dünner hungriger Hund', true, '["Hund", "Tier"]'),
  ('russian-007', 'helper', 'Birke', 1, 'Verdorrter Baum', false, '["Baum", "Pflanze"]'),
  ('russian-007', 'supporting', 'Tante', 1, 'Baba Jagas Schwester (angeblich)', false, '["Tante", "Erwachsene"]');

INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, character_variables, setting, mood, duration_seconds)
VALUES
  ('russian-007', 1, 'Der böse Plan',
   'Die [STIEFMUTTER] schickt [MASCHA] zu ihrer "lieben [TANTE]" - aber es ist Baba Jaga! Die echte Tante warnt [MASCHA]: "Nimm Öl, Brot, Fleisch und ein Band mit. Sei höflich zu allen!"',
   '{"PROTAGONIST": "MASCHA", "ANTAGONIST": "STIEFMUTTER", "SUPPORTING": "TANTE"}',
   'Dorf', 'bedrohlich', 75),

  ('russian-007', 2, 'Die Hütte auf Hühnerbeinen',
   '[MASCHA] findet die Hütte auf Hühnerbeinen. Sie dreht sich und dreht sich. [MASCHA] spricht höflich: "Häuschen, Häuschen, dreh dich mit dem Rücken zum Wald, mit der Tür zu mir!" Die Hütte gehorcht.',
   '{"PROTAGONIST": "MASCHA"}',
   'Dunkler Wald', 'unheimlich', 80),

  ('russian-007', 3, 'Bei Baba Jaga',
   '[BABA_JAGA] sitzt am Webstuhl: "Was willst du?" [MASCHA] antwortet höflich: "Ich komme Nadel und Faden ausleihen." [BABA_JAGA] grinst böse: "Geh ins Bad, ich heize den Ofen - ich meine, damit du dich wäschst!"',
   '{"PROTAGONIST": "MASCHA", "ANTAGONIST": "BABA_JAGA"}',
   'Baba Jagas Hütte', 'beängstigend', 85),

  ('russian-007', 4, 'Die Geschenke',
   'Während [BABA_JAGA] Holz holt, gibt [MASCHA] der dünnen [KATZE] Fleisch, dem [HUND] Brot, ölt das quietschende Tor und bindet der verdorrten [BIRKE] ein Band um. Alle sind gerührt.',
   '{"PROTAGONIST": "MASCHA", "HELPER1": "KATZE", "HELPER2": "HUND", "HELPER3": "BIRKE"}',
   'Hof', 'listig', 85),

  ('russian-007', 5, 'Die Flucht',
   'Die [KATZE] webt langsam am Webstuhl, damit [BABA_JAGA] denkt, [MASCHA] sei noch da. [MASCHA] flieht! Das Tor öffnet sich leise, die [BIRKE] versteckt sie, der [HUND] bellt nicht.',
   '{"PROTAGONIST": "MASCHA", "HELPER": "KATZE"}',
   'Wald', 'spannend', 90),

  ('russian-007', 6, 'Die Verfolgung',
   '[BABA_JAGA] entdeckt die Flucht und fliegt in ihrem Mörser hinterher, rudert mit dem Stößel! Sie schreit: "Warum habt ihr sie nicht aufgehalten?" Die Helfer antworten: "Sie war freundlich zu uns!"',
   '{"ANTAGONIST": "BABA_JAGA", "HELPER1": "KATZE", "HELPER2": "HUND"}',
   'Wald', 'aufregend', 90),

  ('russian-007', 7, 'Die Rettung',
   '[MASCHA] erreicht ihr Dorf. [BABA_JAGA] kann nicht weiter - sie darf nicht ins Dorf. Wütend fliegt sie zurück. [MASCHA] erzählt ihrem Vater alles, und er verjagt die böse [STIEFMUTTER].',
   '{"PROTAGONIST": "MASCHA", "ANTAGONIST": "BABA_JAGA"}',
   'Dorfgrenze', 'erlösend', 80);

-- 8. IWAN ZAREWITSCH UND DER GRAUE WOLF

INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
VALUES (
  'russian-008',
  'Iwan Zarewitsch und der graue Wolf',
  'russian',
  'ru',
  'Ivan Tsarevich and the Grey Wolf',
  'Russland',
  8,
  20,
  '["Abenteuer", "Magie", "Heldentum"]',
  'Treue Freundschaft und Mut führen zum Sieg',
  'Prinz Iwan reitet aus, um den Dieb der goldenen Äpfel zu finden. Mit Hilfe des magischen grauen Wolfs besteht er viele Abenteuer und gewinnt eine Prinzessin.',
  true
);

INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, profession_preference)
VALUES
  ('russian-008', 'protagonist', 'Iwan Zarewitsch', 1, 'Mutiger junger Prinz', true, '["Prinz", "Held", "Zarewitsch"]'),
  ('russian-008', 'helper', 'Grauer Wolf', 1, 'Magischer sprechender Wolf', true, '["Wolf", "Tier", "Magisches Wesen"]'),
  ('russian-008', 'supporting', 'Feuervogel', 1, 'Wunderschöner Vogel mit goldenen Federn', true, '["Vogel", "Feuervogel", "Magisches Wesen"]'),
  ('russian-008', 'love_interest', 'Prinzessin Elena', 1, 'Wunderschöne Prinzessin', true, '["Prinzessin"]'),
  ('russian-008', 'antagonist', 'Böse Zaren', 2, 'Gierige Herrscher', true, '["Zar", "König", "Bösewicht"]'),
  ('russian-008', 'antagonist', 'Böse Brüder', 2, 'Neidische Brüder von Iwan', true, '["Prinz", "Bruder", "Verräter"]'),
  ('russian-008', 'supporting', 'Alter Zar', 1, 'Iwans Vater', false, '["Zar", "König", "Vater"]');

INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, character_variables, setting, mood, duration_seconds)
VALUES
  ('russian-008', 1, 'Die goldenen Äpfel',
   'Der [ALTE_ZAR] besitzt einen Baum mit goldenen Äpfeln. Jede Nacht stiehlt ein [FEUERVOGEL] einen Apfel. Der [ZAR] befiehlt seinen drei Söhnen, den Dieb zu fangen. [IWAN] ist der Jüngste.',
   '{"SUPPORTING1": "ALTER_ZAR", "PROTAGONIST": "IWAN_ZAREWITSCH", "SUPPORTING2": "FEUERVOGEL"}',
   'Königlicher Garten', 'mysteriös', 80),

  ('russian-008', 2, 'Die goldene Feder',
   '[IWAN] wacht und sieht den [FEUERVOGEL]! Er greift zu, aber der Vogel fliegt davon - nur eine goldene Feder bleibt in [IWANS] Hand. Der [ZAR] will nun den ganzen Vogel haben!',
   '{"PROTAGONIST": "IWAN_ZAREWITSCH", "SUPPORTING": "FEUERVOGEL"}',
   'Garten', 'aufregend', 75),

  ('russian-008', 3, 'Der graue Wolf',
   '[IWAN] reitet in den Wald. Ein [WOLF] frisst sein Pferd! Doch der [WOLF] bereut: "Verzeih mir! Ich werde dir dienen!" Der [WOLF] ist riesig und magisch. [IWAN] sitzt auf seinem Rücken.',
   '{"PROTAGONIST": "IWAN_ZAREWITSCH", "HELPER": "GRAUER_WOLF"}',
   'Dunkler Wald', 'wundersam', 85),

  ('russian-008', 4, 'Die drei Quests',
   'Der [WOLF] bringt [IWAN] zu einem Schloss. "Nimm den [FEUERVOGEL], aber nicht den Käfig!" Doch [IWAN] kann nicht widerstehen. Alarm! Ein [BÖSER_ZAR] erwischt ihn: "Bring mir das Pferd mit der goldenen Mähne, oder sterbe!"',
   '{"PROTAGONIST": "IWAN_ZAREWITSCH", "HELPER": "GRAUER_WOLF", "ANTAGONIST": "BÖSE_ZAREN"}',
   'Schloss', 'dramatisch', 95),

  ('russian-008', 5, 'Die Liebe',
   'Um das Pferd zu bekommen, muss [IWAN] [PRINZESSIN_ELENA] holen. Doch als er sie sieht, verliebt er sich unsterblich! Der [WOLF] hat Mitleid: "Ich helfe dir!"',
   '{"PROTAGONIST": "IWAN_ZAREWITSCH", "LOVE_INTEREST": "PRINZESSIN_ELENA", "HELPER": "GRAUER_WOLF"}',
   'Palast', 'romantisch', 90),

  ('russian-008', 6, 'Die Verwandlungen',
   'Der kluge [WOLF] verwandelt sich nacheinander in die [PRINZESSIN], das Pferd und den [FEUERVOGEL]. So trickst er die gierigen [ZAREN] aus. [IWAN] behält seine Liebe und alle Schätze!',
   '{"HELPER": "GRAUER_WOLF", "PROTAGONIST": "IWAN_ZAREWITSCH"}',
   'Verschiedene Orte', 'listig', 100),

  ('russian-008', 7, 'Der Verrat',
   '[IWANS] böse [BRÜDER] sind neidisch. Sie ermorden ihn im Schlaf und stehlen [PRINZESSIN_ELENA] und die Schätze! [ELENA] weint bitterlich, darf aber nichts sagen.',
   '{"PROTAGONIST": "IWAN_ZAREWITSCH", "ANTAGONIST": "BÖSE_BRÜDER", "LOVE_INTEREST": "PRINZESSIN_ELENA"}',
   'Wald', 'tragisch', 90),

  ('russian-008', 8, 'Das Wasser des Lebens',
   'Der treue [WOLF] findet [IWAN]. Ein Rabe zeigt ihm das Wasser des Lebens und des Todes. Der [WOLF] besprengt [IWAN] - er erwacht! [IWAN] reitet nach Hause und entlarvt seine [BRÜDER].',
   '{"HELPER": "GRAUER_WOLF", "PROTAGONIST": "IWAN_ZAREWITSCH"}',
   'Wald', 'wundersam', 95),

  ('russian-008', 9, 'Das glückliche Ende',
   '[IWAN] heiratet [PRINZESSIN_ELENA]. Der [FEUERVOGEL] lebt in ihrem Garten. Der [GRAUE_WOLF] verabschiedet sich: "Du brauchst mich nicht mehr. Lebe glücklich!" [IWAN] dankt seinem treuesten Freund.',
   '{"PROTAGONIST": "IWAN_ZAREWITSCH", "LOVE_INTEREST": "PRINZESSIN_ELENA", "HELPER": "GRAUER_WOLF", "SUPPORTING": "FEUERVOGEL"}',
   'Palast', 'triumphierend', 85);

-- =====================================================
-- ARABIAN NIGHTS FAIRY TALES (3 tales)
-- =====================================================

-- 1. ALADIN UND DIE WUNDERLAMPE

INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
VALUES (
  '1001-001',
  'Aladin und die Wunderlampe',
  '1001-nights',
  'ar',
  'Aladdin and the Magic Lamp',
  'Arabien',
  8,
  22,
  '["Fantasy", "Abenteuer", "Magie"]',
  'Wünsche weise und gütig nutzen',
  'Aladin findet eine magische Lampe mit einem mächtigen Dschinn. Er wird reich, heiratet eine Prinzessin, muss aber gegen einen bösen Zauberer kämpfen.',
  true
);

INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, profession_preference)
VALUES
  ('1001-001', 'protagonist', 'Aladin', 1, 'Armer aber mutiger Junge', true, '["Kind", "Junge", "Held"]'),
  ('1001-001', 'helper', 'Dschinn der Lampe', 1, 'Mächtiger Geist in der Lampe', true, '["Dschinn", "Geist", "Magisches Wesen"]'),
  ('1001-001', 'antagonist', 'Böser Zauberer', 1, 'Falscher Onkel und Magier', true, '["Zauberer", "Magier", "Bösewicht"]'),
  ('1001-001', 'love_interest', 'Prinzessin Badr', 1, 'Wunderschöne Tochter des Sultans', true, '["Prinzessin"]'),
  ('1001-001', 'supporting', 'Aladins Mutter', 1, 'Arme Witwe', true, '["Mutter", "Erwachsene"]'),
  ('1001-001', 'supporting', 'Sultan', 1, 'Herrscher der Stadt', true, '["Sultan", "König"]'),
  ('1001-001', 'helper', 'Dschinn des Rings', 1, 'Kleinerer Geist im Ring', false, '["Dschinn", "Geist"]');

INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, character_variables, setting, mood, duration_seconds)
VALUES
  ('1001-001', 1, 'Der falsche Onkel',
   'Ein [BÖSER_ZAUBERER] kommt zu [ALADIN]: "Ich bin dein Onkel! Ich mache dich reich!" Er führt [ALADIN] zu einer geheimen Höhle. "Geh hinein und hol mir die alte Lampe!"',
   '{"PROTAGONIST": "ALADIN", "ANTAGONIST": "BÖSER_ZAUBERER"}',
   'Wüste vor der Höhle', 'mysteriös', 85),

  ('1001-001', 2, 'In der Schatzhöhle',
   '[ALADIN] steigt in die wunderbare Höhle voller Gold und Juwelen. Er findet die alte Lampe, steckt aber auch einen magischen Ring ein. Der [ZAUBERER] will die Lampe sofort: "Gib sie mir!"',
   '{"PROTAGONIST": "ALADIN", "ANTAGONIST": "BÖSER_ZAUBERER"}',
   'Magische Höhle', 'glitzernd', 95),

  ('1001-001', 3, 'Gefangen!',
   '[ALADIN] will erst herausklettern, dann die Lampe geben. Wütend verschließt der [ZAUBERER] die Höhle: "Stirb dort drin!" [ALADIN] reibt verzweifelt seine Hände - da berührt er den Ring!',
   '{"PROTAGONIST": "ALADIN"}',
   'Verschlossene Höhle', 'verzweifelt', 80),

  ('1001-001', 4, 'Der Dschinn des Rings',
   'Ein [DSCHINN_DES_RINGS] erscheint: "Ich bin dein Diener!" [ALADIN] wünscht: "Bring mich nach Hause!" Sofort ist er bei seiner [MUTTER]. Sie putzt die alte Lampe - da erscheint ein riesiger [DSCHINN_DER_LAMPE]!',
   '{"PROTAGONIST": "ALADIN", "HELPER1": "DSCHINN_DES_RINGS", "HELPER2": "DSCHINN_DER_LAMPE", "SUPPORTING": "ALADINS_MUTTER"}',
   'Aladins Haus', 'wundersam', 100),

  ('1001-001', 5, 'Reich und verliebt',
   'Der [DSCHINN] erfüllt alle Wünsche! [ALADIN] wird reich. Er sieht [PRINZESSIN_BADR] und verliebt sich. Der [DSCHINN] baut einen prächtigen Palast. Der [SULTAN] erlaubt die Hochzeit.',
   '{"PROTAGONIST": "ALADIN", "HELPER": "DSCHINN_DER_LAMPE", "LOVE_INTEREST": "PRINZESSIN_BADR", "SUPPORTING": "SULTAN"}',
   'Prachtvoller Palast', 'romantisch', 95),

  ('1001-001', 6, 'Neue Lampen für alte',
   'Der [BÖSE_ZAUBERER] kehrt zurück, verkleidet als Händler: "Neue Lampen für alte!" [PRINZESSIN_BADR] kennt das Geheimnis der Lampe nicht und tauscht sie! Der [ZAUBERER] triumphiert.',
   '{"ANTAGONIST": "BÖSER_ZAUBERER", "LOVE_INTEREST": "PRINZESSIN_BADR"}',
   'Vor dem Palast', 'betrügerisch', 90),

  ('1001-001', 7, 'Der gestohlene Palast',
   'Der [ZAUBERER] befiehlt dem [DSCHINN]: "Bring den Palast und die Prinzessin nach Afrika!" Über Nacht verschwinden Palast und [PRINZESSIN]! Der [SULTAN] ist wütend auf [ALADIN].',
   '{"ANTAGONIST": "BÖSER_ZAUBERER", "LOVE_INTEREST": "PRINZESSIN_BADR", "PROTAGONIST": "ALADIN"}',
   'Leere Stelle', 'dramatisch', 85),

  ('1001-001', 8, 'Die Rettung',
   '[ALADIN] reibt seinen Ring! Der kleinere [DSCHINN_DES_RINGS] bringt ihn nach Afrika. [ALADIN] gibt dem [ZAUBERER] Schlafpulver. Im Schlaf nimmt [ALADIN] die Lampe zurück!',
   '{"PROTAGONIST": "ALADIN", "HELPER": "DSCHINN_DES_RINGS", "ANTAGONIST": "BÖSER_ZAUBERER"}',
   'Afrika', 'spannend', 100),

  ('1001-001', 9, 'Für immer glücklich',
   'Der [DSCHINN_DER_LAMPE] tötet den [ZAUBERER] und bringt den Palast zurück. [ALADIN] und [PRINZESSIN_BADR] leben glücklich. [ALADIN] nutzt die Lampe weise, um seinem Volk zu helfen.',
   '{"PROTAGONIST": "ALADIN", "LOVE_INTEREST": "PRINZESSIN_BADR", "HELPER": "DSCHINN_DER_LAMPE"}',
   'Palast', 'triumphierend', 85);

-- 2. ALI BABA UND DIE 40 RÄUBER

INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
VALUES (
  '1001-002',
  'Ali Baba und die 40 Räuber',
  '1001-nights',
  'ar',
  'Ali Baba and the Forty Thieves',
  'Arabien',
  8,
  18,
  '["Abenteuer", "Spannung", "Cleverness"]',
  'Cleverness und Mut siegen über Gewalt',
  'Ali Baba entdeckt die geheime Höhle der Räuber mit dem Zauberspruch "Sesam öffne dich". Mit Hilfe der klugen Dienerin Morgiana überlebt er die Rache der Räuber.',
  true
);

INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, profession_preference)
VALUES
  ('1001-002', 'protagonist', 'Ali Baba', 1, 'Armer aber ehrlicher Holzfäller', true, '["Erwachsene", "Held", "Holzfäller"]'),
  ('1001-002', 'helper', 'Morgiana', 1, 'Kluge und mutige Dienerin', true, '["Dienerin", "Heldin", "Erwachsene"]'),
  ('1001-002', 'antagonist', 'Räuberhauptmann', 1, 'Anführer der 40 Räuber', true, '["Räuber", "Bösewicht", "Hauptmann"]'),
  ('1001-002', 'antagonist', 'Die 40 Räuber', 5, 'Gefährliche Diebe', true, '["Räuber", "Dieb", "Bösewicht"]'),
  ('1001-002', 'supporting', 'Kasim', 1, 'Gieriger reicher Bruder von Ali Baba', true, '["Bruder", "Erwachsene"]'),
  ('1001-002', 'supporting', 'Ali Babas Frau', 1, 'Treue Ehefrau', false, '["Ehefrau", "Erwachsene"]'),
  ('1001-002', 'supporting', 'Kasims Frau', 1, 'Neidische Schwägerin', false, '["Ehefrau", "Erwachsene"]');

INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, character_variables, setting, mood, duration_seconds)
VALUES
  ('1001-002', 1, 'Das Geheimnis',
   '[ALI_BABA] sammelt Holz im Wald. Plötzlich hört er Pferdegetrappel - die [RÄUBER] kommen! Er versteckt sich. Der [RÄUBERHAUPTMANN] ruft vor einem Felsen: "Sesam, öffne dich!" Ein Eingang öffnet sich!',
   '{"PROTAGONIST": "ALI_BABA", "ANTAGONIST1": "RÄUBERHAUPTMANN", "ANTAGONIST2": "DIE_40_RÄUBER"}',
   'Wald vor der Höhle', 'spannend', 90),

  ('1001-002', 2, 'In der Schatzhöhle',
   'Die [RÄUBER] verschwinden mit ihren Schätzen. [ALI_BABA] probiert: "Sesam, öffne dich!" Die Höhle öffnet sich! Drinnen: Gold, Seide, Juwelen! [ALI_BABA] nimmt nur ein paar Goldsäcke.',
   '{"PROTAGONIST": "ALI_BABA"}',
   'Schatzhöhle', 'aufregend', 85),

  ('1001-002', 3, 'Der gierige Bruder',
   '[ALI_BABAS] reicher Bruder [KASIM] bemerkt das Gold. [ALI_BABA] erzählt ihm das Geheimnis. Gierig stürmt [KASIM] zur Höhle und füllt Säcke. Doch dann vergisst er den Zauberspruch!',
   '{"PROTAGONIST": "ALI_BABA", "SUPPORTING": "KASIM"}',
   'Ali Babas Haus', 'warnend', 80),

  ('1001-002', 4, 'Die Rache der Räuber',
   'Die [RÄUBER] finden [KASIM] in ihrer Höhle und töten ihn. [ALI_BABA] holt den Leichnam. Die [RÄUBER] merken: "Jemand kennt unser Geheimnis!" Sie schwören Rache.',
   '{"ANTAGONIST": "RÄUBERHAUPTMANN", "SUPPORTING": "KASIM"}',
   'Schatzhöhle', 'bedrohlich', 85),

  ('1001-002', 5, 'Das Kreidezeichen',
   'Ein [RÄUBER] findet [ALI_BABAS] Haus und markiert die Tür mit Kreide. Doch die kluge [MORGIANA] bemerkt es und markiert alle Türen der Straße! Die [RÄUBER] können das richtige Haus nicht finden.',
   '{"HELPER": "MORGIANA", "ANTAGONIST": "DIE_40_RÄUBER"}',
   'Straße', 'listig', 85),

  ('1001-002', 6, 'Die Ölkrüge',
   'Der [RÄUBERHAUPTMANN] verkleidet sich als Ölhändler. Er bringt 40 Krüge - in 39 verstecken sich die [RÄUBER]! [MORGIANA] entdeckt den Trick. Sie gießt kochendes Öl in alle Krüge und tötet die Räuber.',
   '{"HELPER": "MORGIANA", "ANTAGONIST1": "RÄUBERHAUPTMANN", "ANTAGONIST2": "DIE_40_RÄUBER"}',
   'Ali Babas Hof', 'dramatisch', 100),

  ('1001-002', 7, 'Der Dolchtanz',
   'Der [RÄUBERHAUPTMANN] kommt erneut verkleidet. [MORGIANA] tanzt vor den Gästen - plötzlich stößt sie dem [HAUPTMANN] einen Dolch ins Herz! [ALI_BABA] ist schockiert, bis sie den Dolch des Hauptmanns zeigt.',
   '{"HELPER": "MORGIANA", "ANTAGONIST": "RÄUBERHAUPTMANN", "PROTAGONIST": "ALI_BABA"}',
   'Ali Babas Haus', 'spannend', 95),

  ('1001-002', 8, 'Die Belohnung',
   '[ALI_BABA] ist [MORGIANA] unendlich dankbar: "Du hast meine Familie gerettet!" Er gibt ihr die Freiheit und verheiratet sie mit seinem Sohn. Die Schatzhöhle bleibt ihr Geheimnis.',
   '{"PROTAGONIST": "ALI_BABA", "HELPER": "MORGIANA"}',
   'Ali Babas Haus', 'erlösend', 80);

-- 3. SINDBAD DER SEEFAHRER

INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
VALUES (
  '1001-003',
  'Sindbad der Seefahrer',
  '1001-nights',
  'ar',
  'Sinbad the Sailor',
  'Arabien',
  9,
  20,
  '["Abenteuer", "Fantasy", "Reise"]',
  'Mut und Weisheit überwinden alle Gefahren',
  'Sindbad erlebt sieben fantastische Seereisen voller Abenteuer: er trifft Riesen, fliegende Vögel, sprechende Schlangen und kehrt immer reicher zurück.',
  true
);

INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, profession_preference)
VALUES
  ('1001-003', 'protagonist', 'Sindbad', 1, 'Mutiger Seefahrer und Händler', true, '["Seefahrer", "Händler", "Held", "Erwachsene"]'),
  ('1001-003', 'supporting', 'Schiffskapitän', 1, 'Kapitän des Handelsschiffs', true, '["Kapitän", "Seefahrer", "Erwachsene"]'),
  ('1001-003', 'antagonist', 'Riesenvogel Rok', 1, 'Gigantischer mythischer Vogel', true, '["Vogel", "Riesenvogel", "Monster"]'),
  ('1001-003', 'antagonist', 'Einäugiger Riese', 1, 'Menschenfressender Zyklop', true, '["Riese", "Zyklop", "Monster"]'),
  ('1001-003', 'supporting', 'Alter Mann des Meeres', 1, 'Gefährlicher Wassergeist', true, '["Geist", "Alter Mann", "Bösewicht"]'),
  ('1001-003', 'helper', 'Händler', 2, 'Freundliche Kaufleute', false, '["Händler", "Erwachsene"]'),
  ('1001-003', 'supporting', 'Matrosen', 3, 'Schiffskameraden', false, '["Matrose", "Seefahrer"]');

INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, character_variables, setting, mood, duration_seconds)
VALUES
  ('1001-003', 1, 'Die erste Reise beginnt',
   '[SINDBAD] ist jung und abenteuerlustig. Er kauft Waren und segelt mit einem [HANDELSSCHIFF] los. "Die Welt ist groß!", denkt er. "Ich werde reich und berühmt werden!"',
   '{"PROTAGONIST": "SINDBAD", "SUPPORTING": "SCHIFFSKAPITÄN"}',
   'Hafen von Bagdad', 'aufgeregt', 75),

  ('1001-003', 2, 'Die wandernde Insel',
   'Das Schiff landet auf einer Insel. Die [MATROSEN] machen Feuer zum Kochen. Plötzlich bebt die Insel - es ist ein riesiger Wal! Alle rennen zum Schiff, aber [SINDBAD] fällt ins Meer!',
   '{"PROTAGONIST": "SINDBAD", "SUPPORTING": "MATROSEN"}',
   'Wal im Ozean', 'erschreckend', 90),

  ('1001-003', 3, 'Der Riesenvogel Rok',
   '[SINDBAD] strandet auf einer Insel. Er findet ein riesiges Ei, groß wie ein Haus! Der [RIESENVOGEL_ROK] erscheint - seine Flügel verdunkeln die Sonne! [SINDBAD] bindet sich an sein Bein und fliegt davon.',
   '{"PROTAGONIST": "SINDBAD", "ANTAGONIST": "RIESENVOGEL_ROK"}',
   'Einsame Insel', 'abenteuerlich', 95),

  ('1001-003', 4, 'Das Tal der Diamanten',
   'Der [ROK] lässt [SINDBAD] in einem Tal fallen - voller Diamanten und toter Schlangen! [SINDBAD] füllt seine Taschen. Riesige Adler kommen und tragen Fleischstücke weg - [SINDBAD] bindet sich an ein Stück!',
   '{"PROTAGONIST": "SINDBAD"}',
   'Tal der Diamanten', 'glitzernd', 90),

  ('1001-003', 5, 'Der einäugige Riese',
   'Auf einer anderen Reise landet [SINDBAD] bei einem [EINÄUGIGEN_RIESEN]. Der Zyklop frisst jeden Tag einen [MATROSEN]! [SINDBAD] macht einen Plan: Sie stechen dem Riesen glühende Spieße ins Auge!',
   '{"PROTAGONIST": "SINDBAD", "ANTAGONIST": "EINÄUGIGER_RIESE", "SUPPORTING": "MATROSEN"}',
   'Höhle des Riesen', 'gruselig', 100),

  ('1001-003', 6, 'Der Alte Mann des Meeres',
   '[SINDBAD] rettet einen [ALTEN_MANN] aus dem Wasser. Doch der Mann springt auf [SINDBADS] Schultern und will nicht mehr absteigen! Tagelang reitet er auf [SINDBAD]. Erst mit List und Wein wird [SINDBAD] ihn los.',
   '{"PROTAGONIST": "SINDBAD", "SUPPORTING": "ALTER_MANN_DES_MEERES"}',
   'Dschungelinsel', 'bedrückend', 95),

  ('1001-003', 7, 'Die Schlangeninsel',
   'Schiffbrüchig landet [SINDBAD] auf einer Insel voller Riesenschlangen! Eine goldene Schlange spricht: "Fürchte dich nicht! Ich bin der König hier." Sie gibt ihm Schätze und rettet ihn.',
   '{"PROTAGONIST": "SINDBAD"}',
   'Dschungelinsel', 'wundersam', 85),

  ('1001-003', 8, 'Nach Hause',
   'Nach sieben Reisen kehrt [SINDBAD] nach Bagdad zurück - steinreich! Er kauft ein Palast und lebt in Luxus. Aber er erzählt gern seine Abenteuer: "Die Welt ist voller Wunder!"',
   '{"PROTAGONIST": "SINDBAD"}',
   'Palast in Bagdad', 'triumphierend', 80),

  ('1001-003', 9, 'Die Weisheit',
   'Ein armer Träger namens Sindbad der Lastträger hört die Geschichten. Der reiche [SINDBAD] sagt: "Ich habe mein Glück durch Mut und Klugheit gefunden. Jeder kann es schaffen!" Er gibt dem Armen Gold.',
   '{"PROTAGONIST": "SINDBAD"}',
   'Palast', 'weise', 75);

-- Initialize usage stats for all new tales
INSERT INTO fairy_tale_usage_stats (tale_id, total_generations, successful_generations)
VALUES
  ('russian-001', 0, 0),
  ('russian-002', 0, 0),
  ('russian-003', 0, 0),
  ('russian-004', 0, 0),
  ('russian-005', 0, 0),
  ('russian-006', 0, 0),
  ('russian-007', 0, 0),
  ('russian-008', 0, 0),
  ('1001-001', 0, 0),
  ('1001-002', 0, 0),
  ('1001-003', 0, 0)
*/
SELECT 1;
