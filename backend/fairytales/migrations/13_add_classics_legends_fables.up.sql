-- Migration 13: Add 18 Tales - Literature Classics, Legends, Fables, and Classic Grimm
-- Adds lit-001 through lit-006 (6 literature classics)
-- Adds legend-001 through legend-005 (5 legends)
-- Adds aesop-001 through aesop-004 (4 fables)
-- Adds grimm-015, grimm-026, grimm-027 (3 classic Grimm tales)
-- TOTAL: 18 tales to complete the Top 50

-- =====================================================
-- LITERATURE CLASSICS (6 tales)
-- =====================================================

-- 1. ALICE IM WUNDERLAND

INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
VALUES (
  'lit-001',
  'Alice im Wunderland',
  'literature',
  'en',
  'Alice in Wonderland',
  'England',
  8,
  22,
  '["Fantasy", "Abenteuer", "Logik"]',
  'Neugier führt zu wunderbaren Abenteuern',
  'Alice folgt einem weißen Kaninchen in einen Kaninchenbau und erlebt fantastische Abenteuer in einer verrückten Welt voller skurriler Charaktere.',
  true
);

INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, profession_preference)
VALUES
  ('lit-001', 'protagonist', 'Alice', 1, 'Neugieriges Mädchen', true, '["Kind", "Heldin"]'),
  ('lit-001', 'supporting', 'Weißes Kaninchen', 1, 'Hastiges Kaninchen mit Taschenuhr', true, '["Kaninchen", "Tier"]'),
  ('lit-001', 'supporting', 'Grinsekatze', 1, 'Verschwindende, grinsende Katze', true, '["Katze", "Magisches Wesen"]'),
  ('lit-001', 'antagonist', 'Herzkönigin', 1, 'Tyrannische Herrscherin', true, '["Königin", "Bösewicht"]'),
  ('lit-001', 'supporting', 'Verrückter Hutmacher', 1, 'Exzentrischer Hutmacher', false, '["Hutmacher", "Erwachsene"]'),
  ('lit-001', 'supporting', 'Märzhase', 1, 'Verrückter Hase beim Tee', false, '["Hase", "Tier"]'),
  ('lit-001', 'supporting', 'Raupe', 1, 'Rauchende Raupe auf Pilz', false, '["Raupe", "Insekt"]');

INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, character_variables, setting, mood, duration_seconds)
VALUES
  ('lit-001', 1, 'Das weiße Kaninchen',
   '[ALICE] sitzt gelangweilt am Flussufer, als ein [WEISSES_KANINCHEN] mit einer Taschenuhr vorbeirennt: "Oh je, oh je, ich komme zu spät!" Neugierig folgt [ALICE] ihm in seinen Bau.',
   '{"PROTAGONIST": "ALICE", "SUPPORTING": "WEISSES_KANINCHEN"}',
   'Flussufer', 'neugierig', 85),

  ('lit-001', 2, 'Der tiefe Fall',
   '[ALICE] fällt tief, tief, tief in den Kaninchenbau. Sie fällt so langsam, dass sie Zeit hat, Marmeladengläser aus Regalen zu nehmen. Endlich landet sie sanft auf einem Haufen trockener Blätter.',
   '{"PROTAGONIST": "ALICE"}',
   'Kaninchenbau', 'staunend', 90),

  ('lit-001', 3, 'Trink mich, Iss mich',
   '[ALICE] findet eine Flasche mit "TRINK MICH" und einen Kuchen mit "ISS MICH". Sie wird winzig klein, dann riesig groß! Sie weint einen ganzen See voller Tränen.',
   '{"PROTAGONIST": "ALICE"}',
   'Geheimnisvoller Raum', 'verwirrt', 95),

  ('lit-001', 4, 'Die Raupe',
   '[ALICE] begegnet einer [RAUPE], die auf einem Pilz sitzt und Wasserpfeife raucht. "Wer bist du?", fragt die [RAUPE]. [ALICE] weiß es nicht mehr - sie hat sich so oft verändert!',
   '{"PROTAGONIST": "ALICE", "SUPPORTING": "RAUPE"}',
   'Pilzwald', 'philosophisch', 85),

  ('lit-001', 5, 'Die verrückte Teeparty',
   'Der [HUTMACHER] und der [MÄRZHASE] feiern eine endlose Teeparty. "Kein Platz, kein Platz!", rufen sie, obwohl der Tisch riesig ist. Sie stellen [ALICE] unmögliche Rätsel.',
   '{"PROTAGONIST": "ALICE", "SUPPORTING1": "HUTMACHER", "SUPPORTING2": "MÄRZHASE"}',
   'Garten', 'absurd', 100),

  ('lit-001', 6, 'Die Grinsekatze',
   '[ALICE] trifft die [GRINSEKATZE], die nach und nach verschwindet, bis nur noch ihr Grinsen übrig ist. "Wir sind hier alle verrückt", sagt die [KATZE]. "Ich bin verrückt. Du bist verrückt."',
   '{"PROTAGONIST": "ALICE", "SUPPORTING": "GRINSEKATZE"}',
   'Wald', 'mysteriös', 80),

  ('lit-001', 7, 'Das Krocketspiel der Königin',
   'Die [HERZKÖNIGIN] zwingt [ALICE] zu einem absurden Krocketspiel mit Flamingos als Schlägern und Igeln als Bällen. "Ab mit dem Kopf!", schreit die [KÖNIGIN] bei jedem Fehler.',
   '{"PROTAGONIST": "ALICE", "ANTAGONIST": "HERZKÖNIGIN"}',
   'Königlicher Garten', 'chaotisch', 95),

  ('lit-001', 8, 'Der Prozess',
   '[ALICE] ist beim Prozess gegen den Herz-Buben. Alles ist Unsinn! Plötzlich wächst [ALICE] wieder. "Ihr seid nur ein Kartenspiel!", ruft sie. Die Karten fliegen auf sie zu - und [ALICE] erwacht am Flussufer. War alles ein Traum?',
   '{"PROTAGONIST": "ALICE", "ANTAGONIST": "HERZKÖNIGIN"}',
   'Gerichtssaal', 'triumphierend', 90);

-- 2. PETER PAN

INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
VALUES (
  'lit-002',
  'Peter Pan',
  'literature',
  'en',
  'Peter Pan',
  'England',
  7,
  20,
  '["Fantasy", "Abenteuer", "Freundschaft"]',
  'Die Magie der Kindheit bewahren',
  'Peter Pan, der Junge der nie erwachsen wird, nimmt Wendy und ihre Brüder mit nach Nimmerland, wo sie Piraten bekämpfen und fantastische Abenteuer erleben.',
  true
);

INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, profession_preference)
VALUES
  ('lit-002', 'protagonist', 'Peter Pan', 1, 'Junge der niemals erwachsen wird', true, '["Kind", "Held", "Flieger"]'),
  ('lit-002', 'protagonist', 'Wendy', 1, 'Mädchen aus London', true, '["Kind", "Heldin"]'),
  ('lit-002', 'helper', 'Glöckchen', 1, 'Eifersüchtige Fee', true, '["Fee", "Magisches Wesen"]'),
  ('lit-002', 'antagonist', 'Captain Hook', 1, 'Gefährlicher Pirat mit Haken', true, '["Pirat", "Bösewicht", "Kapitän"]'),
  ('lit-002', 'supporting', 'Verlorene Jungs', 5, 'Peters Gefährten in Nimmerland', true, '["Kind", "Abenteurer"]'),
  ('lit-002', 'supporting', 'Michael und John', 2, 'Wendys jüngere Brüder', false, '["Kind", "Junge"]');

INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, character_variables, setting, mood, duration_seconds)
VALUES
  ('lit-002', 1, 'Peter im Kinderzimmer',
   '[PETER_PAN] fliegt durchs Fenster ins Kinderzimmer der Darlings. [WENDY] näht seinen Schatten wieder an. [PETER] erzählt von Nimmerland - dem Land, wo man nie erwachsen wird!',
   '{"PROTAGONIST1": "PETER_PAN", "PROTAGONIST2": "WENDY"}',
   'Kinderzimmer', 'magisch', 85),

  ('lit-002', 2, 'Der Flug nach Nimmerland',
   '[GLÖCKCHEN] streut Feenstaub über [WENDY], [MICHAEL] und [JOHN]. "Denkt an etwas Schönes!", ruft [PETER]. Sie fliegen aus dem Fenster, über London, zur zweiten rechts und dann geradeaus bis zum Morgen!',
   '{"PROTAGONIST1": "PETER_PAN", "PROTAGONIST2": "WENDY", "SUPPORTING": "MICHAEL_UND_JOHN", "HELPER": "GLÖCKCHEN"}',
   'Nachthimmel über London', 'abenteuerlich', 95),

  ('lit-002', 3, 'Die verlorenen Jungs',
   'In Nimmerland treffen sie die [VERLORENEN_JUNGS]. Diese haben keine Mutter und bitten [WENDY], ihre Mutter zu sein. [WENDY] erzählt ihnen Gutenachtgeschichten.',
   '{"PROTAGONIST": "WENDY", "SUPPORTING": "VERLORENE_JUNGS"}',
   'Versteck der Verlorenen Jungs', 'heimelig', 85),

  ('lit-002', 4, 'Glöckchen in Gefahr',
   '[CAPTAIN_HOOK] hasst [PETER], weil dieser ihm die Hand abschlug und einem Krokodil zum Fraß vorwarf. Das Krokodil hat eine Uhr verschluckt - [HOOK] hört es ticken kommen! [HOOK] vergiftet [PETERS] Medizin, aber [GLÖCKCHEN] trinkt sie, um [PETER] zu retten.',
   '{"PROTAGONIST": "PETER_PAN", "ANTAGONIST": "CAPTAIN_HOOK", "HELPER": "GLÖCKCHEN"}',
   'Piratenschiff', 'dramatisch', 100),

  ('lit-002', 5, 'Die Rettung der Fee',
   '[GLÖCKCHEN] stirbt fast! [PETER] ruft allen Kindern der Welt zu: "Wenn ihr an Feen glaubt, klatscht in die Hände!" Überall klatschen Kinder - und [GLÖCKCHEN] wird gerettet!',
   '{"PROTAGONIST": "PETER_PAN", "HELPER": "GLÖCKCHEN"}',
   'Versteck', 'hoffnungsvoll', 80),

  ('lit-002', 6, 'Die Entführung',
   '[CAPTAIN_HOOK] und seine Piraten entführen [WENDY] und die [VERLORENEN_JUNGS]. Sie sollen von der Planke springen! [PETER] ist allein zurückgeblieben.',
   '{"PROTAGONIST": "WENDY", "ANTAGONIST": "CAPTAIN_HOOK", "SUPPORTING": "VERLORENE_JUNGS"}',
   'Piratenschiff', 'gefährlich', 90),

  ('lit-002', 7, 'Der Kampf mit Hook',
   '[PETER] fliegt zum Schiff! Er kämpft mit [HOOK] auf dem Deck. Das tickende Krokodil wartet im Wasser. [PETER] besiegt [HOOK], der ins Meer fällt - direkt ins Maul des Krokodils!',
   '{"PROTAGONIST": "PETER_PAN", "ANTAGONIST": "CAPTAIN_HOOK"}',
   'Piratenschiff', 'spannend', 100),

  ('lit-002', 8, 'Die Heimkehr',
   '[WENDY] merkt, dass ihre Mutter sie vermisst. Sie will nach Hause. Auch die [VERLORENEN_JUNGS] kommen mit. Nur [PETER] bleibt in Nimmerland - er will niemals erwachsen werden. [WENDY] verspricht, jedes Jahr zurückzukommen.',
   '{"PROTAGONIST1": "WENDY", "PROTAGONIST2": "PETER_PAN", "SUPPORTING": "VERLORENE_JUNGS"}',
   'Kinderzimmer', 'bittersüß', 85);

-- 3. PINOCCHIO

INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
VALUES (
  'lit-003',
  'Pinocchio',
  'literature',
  'it',
  'Pinocchio',
  'Italien',
  6,
  18,
  '["Fantasy", "Moral", "Transformation"]',
  'Ehrlichkeit und gutes Verhalten machen uns zu echten Menschen',
  'Eine Holzpuppe erwacht zum Leben und träumt davon, ein echter Junge zu werden. Aber er muss erst lernen, ehrlich zu sein und Verantwortung zu übernehmen.',
  true
);

INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, profession_preference)
VALUES
  ('lit-003', 'protagonist', 'Pinocchio', 1, 'Holzpuppe die lebendig wird', true, '["Puppe", "Kind"]'),
  ('lit-003', 'supporting', 'Geppetto', 1, 'Armer Holzschnitzer, Pinocchios Vater', true, '["Vater", "Erwachsene", "Handwerker"]'),
  ('lit-003', 'helper', 'Blaue Fee', 1, 'Gute Fee die Pinocchio hilft', true, '["Fee", "Magisches Wesen"]'),
  ('lit-003', 'helper', 'Jiminy Grille', 1, 'Sprechende Grille, Pinocchios Gewissen', true, '["Grille", "Insekt", "Tier"]'),
  ('lit-003', 'antagonist', 'Feuerfresser', 1, 'Puppenspieler', false, '["Erwachsene", "Bösewicht"]'),
  ('lit-003', 'antagonist', 'Fuchs und Kater', 2, 'Betrügerisches Duo', false, '["Fuchs", "Katze", "Tier", "Bösewicht"]');

INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, character_variables, setting, mood, duration_seconds)
VALUES
  ('lit-003', 1, 'Die Geburt der Puppe',
   'Der arme [GEPPETTO] schnitzt aus einem sprechenden Holzstück eine Puppe. Plötzlich erwacht [PINOCCHIO] zum Leben! "Vater!", ruft er und rennt sofort davon.',
   '{"SUPPORTING": "GEPPETTO", "PROTAGONIST": "PINOCCHIO"}',
   'Werkstatt', 'wundersam', 85),

  ('lit-003', 2, 'Die Grille als Gewissen',
   'Die [JIMINY_GRILLE] wird [PINOCCHIOS] Gewissen. "Sei brav, gehe zur Schule, lüge nicht!", mahnt sie. [GEPPETTO] verkauft seine Jacke, um [PINOCCHIO] ein Schulbuch zu kaufen.',
   '{"PROTAGONIST": "PINOCCHIO", "HELPER": "JIMINY_GRILLE", "SUPPORTING": "GEPPETTO"}',
   'Geppettos Hütte', 'liebevoll', 80),

  ('lit-003', 3, 'Das Puppentheater',
   'Statt zur Schule zu gehen, verkauft [PINOCCHIO] sein Buch für eine Eintrittskarte zum Puppentheater. Der [FEUERFRESSER] will ihn verbrennen, lässt ihn aber gehen und gibt ihm fünf Goldstücke.',
   '{"PROTAGONIST": "PINOCCHIO", "ANTAGONIST": "FEUERFRESSER"}',
   'Puppentheater', 'aufregend', 90),

  ('lit-003', 4, 'Fuchs und Kater',
   'Der [FUCHS] und der [KATER] betrügen [PINOCCHIO]: "Pflanze deine Goldstücke! Es wächst ein Geldbaum!" [PINOCCHIO] glaubt ihnen und vergräbt sein Gold. Die [GRILLE] warnt ihn, aber er hört nicht.',
   '{"PROTAGONIST": "PINOCCHIO", "ANTAGONIST": "FUCHS_UND_KATER", "HELPER": "JIMINY_GRILLE"}',
   'Straße', 'betrügerisch', 95),

  ('lit-003', 5, 'Die erste Lüge',
   'Die [BLAUE_FEE] findet [PINOCCHIO]. "Wo sind deine Goldstücke?", fragt sie. [PINOCCHIO] lügt - und seine Nase wächst! Jedes Mal wenn er lügt, wird seine Nase länger!',
   '{"PROTAGONIST": "PINOCCHIO", "HELPER": "BLAUE_FEE"}',
   'Feenhaus', 'beschämend', 85),

  ('lit-003', 6, 'Das Spielzeugland',
   '[PINOCCHIO] geht mit bösen Jungs ins Spielzeugland, wo es keine Schule gibt. Es macht Spaß - bis alle Kinder in Esel verwandelt werden! [PINOCCHIO] bekommt Eselsohren und einen Schwanz.',
   '{"PROTAGONIST": "PINOCCHIO"}',
   'Spielzeugland', 'erschreckend', 100),

  ('lit-003', 7, 'Im Bauch des Wals',
   '[PINOCCHIO] erfährt, dass [GEPPETTO] von einem riesigen Wal verschluckt wurde, als er nach ihm suchte! [PINOCCHIO] lässt sich absichtlich verschlucken und findet [GEPPETTO] im Bauch des Wals.',
   '{"PROTAGONIST": "PINOCCHIO", "SUPPORTING": "GEPPETTO"}',
   'Im Wal', 'dramatisch', 95),

  ('lit-003', 8, 'Ein echter Junge',
   '[PINOCCHIO] rettet [GEPPETTO] aus dem Wal. Er pflegt seinen kranken Vater und arbeitet hart. Die [BLAUE_FEE] sieht, dass er sich verändert hat. Am Morgen erwacht [PINOCCHIO] als echter Junge!',
   '{"PROTAGONIST": "PINOCCHIO", "SUPPORTING": "GEPPETTO", "HELPER": "BLAUE_FEE"}',
   'Geppettos Hütte', 'triumphierend', 90);

-- 4. DAS DSCHUNGELBUCH

INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
VALUES (
  'lit-004',
  'Das Dschungelbuch',
  'literature',
  'en',
  'The Jungle Book',
  'Indien',
  8,
  20,
  '["Abenteuer", "Tiere", "Natur"]',
  'Respekt vor der Natur und ihren Gesetzen',
  'Der Menschenjunge Mogli wächst bei Wölfen im Dschungel auf. Mit Hilfe des Bären Balu und des Panthers Baghira lernt er die Gesetze des Dschungels.',
  true
);

INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, profession_preference)
VALUES
  ('lit-004', 'protagonist', 'Mogli', 1, 'Menschenjunge aufgewachsen im Dschungel', true, '["Kind", "Held"]'),
  ('lit-004', 'helper', 'Balu', 1, 'Gemütlicher Bär und Lehrer', true, '["Bär", "Tier"]'),
  ('lit-004', 'helper', 'Baghira', 1, 'Weiser schwarzer Panther', true, '["Panther", "Tier"]'),
  ('lit-004', 'antagonist', 'Shir Khan', 1, 'Gefährlicher Tiger', true, '["Tiger', 'Bösewicht", "Tier"]'),
  ('lit-004', 'supporting', 'Wolfsmutter Raksha', 1, 'Moglis Wolfsmutter', true, '["Wolf", "Mutter", "Tier"]'),
  ('lit-004', 'supporting', 'Kaa', 1, 'Weise Python', false, '["Schlange", "Tier"]'),
  ('lit-004', 'supporting', 'König Louie', 1, 'Affenkönig', false, '["Affe", "Tier", "König"]');

INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, character_variables, setting, mood, duration_seconds)
VALUES
  ('lit-004', 1, 'Das Menschenjunge',
   'Ein kleiner Junge verirrt sich im Dschungel. Der Tiger [SHIR_KHAN] jagt ihn! [BAGHIRA] rettet das Baby und bringt es zu [RAKSHA], der Wolfsmutter. "Ich werde ihn Mogli nennen - Frosch!", sagt sie liebevoll.',
   '{"PROTAGONIST": "MOGLI", "HELPER": "BAGHIRA", "SUPPORTING": "RAKSHA", "ANTAGONIST": "SHIR_KHAN"}',
   'Dschungel', 'gefährlich', 90),

  ('lit-004', 2, 'Die Ratsversammlung',
   'Im Wolfsrat fordert [SHIR_KHAN]: "Gebt mir das Menschenjunge!" Aber [BAGHIRA] bietet einen Büffel, und [BALU] verspricht, [MOGLI] die Gesetze des Dschungels zu lehren. [MOGLI] darf bleiben!',
   '{"PROTAGONIST": "MOGLI", "ANTAGONIST": "SHIR_KHAN", "HELPER1": "BAGHIRA", "HELPER2": "BALU"}',
   'Ratsfelsen', 'spannend', 85),

  ('lit-004', 3, 'Balus Unterricht',
   'Der gemütliche Bär [BALU] bringt [MOGLI] alles bei: "Das sind die Gesetze des Dschungels, Kleiner! Du musst die Meisterworte lernen!" [MOGLI] lernt die Sprachen der Tiere und wie man Früchte findet.',
   '{"PROTAGONIST": "MOGLI", "HELPER": "BALU"}',
   'Dschungel', 'fröhlich', 95),

  ('lit-004', 4, 'Die Entführung durch die Affen',
   'Das Affenvolk entführt [MOGLI] zu ihrem [KÖNIG_LOUIE]. "Zeig mir das rote Feuer der Menschen!", verlangt [LOUIE]. [BALU] und [BAGHIRA] eilen zur Rettung!',
   '{"PROTAGONIST": "MOGLI", "SUPPORTING": "KÖNIG_LOUIE", "HELPER1": "BALU", "HELPER2": "BAGHIRA"}',
   'Ruinenstadt', 'chaotisch', 100),

  ('lit-004', 5, 'Kaa die Schlange',
   'Die riesige Python [KAA] hilft, [MOGLI] zu befreien. "Vertrau mir", zischt [KAA] hypnotisch. Die Affen haben große Angst vor der Schlange!',
   '{"PROTAGONIST": "MOGLI", "SUPPORTING": "KAA", "HELPER1": "BALU", "HELPER2": "BAGHIRA"}',
   'Ruinenstadt', 'unheimlich', 85),

  ('lit-004', 6, 'Shir Khans Rache',
   '[SHIR_KHAN] hat nicht vergessen! Er plant, [MOGLI] zu töten. [BAGHIRA] warnt: "Der Tiger wird dich holen. Du musst ins Menschendorf gehen!" Aber [MOGLI] will bleiben.',
   '{"PROTAGONIST": "MOGLI", "ANTAGONIST": "SHIR_KHAN", "HELPER": "BAGHIRA"}',
   'Dschungel', 'bedrohlich', 80),

  ('lit-004', 7, 'Der Kampf mit dem Tiger',
   '[MOGLI] lockt [SHIR_KHAN] in eine Schlucht. Mit Hilfe der Büffel besiegt er den Tiger! Die Dschungeltiere feiern - [MOGLI] ist ein wahrer Held des Dschungels!',
   '{"PROTAGONIST": "MOGLI", "ANTAGONIST": "SHIR_KHAN", "HELPER": "BALU"}',
   'Schlucht', 'triumphierend', 100),

  ('lit-004', 8, 'Zwischen zwei Welten',
   '[MOGLI] sieht ein Mädchen aus dem Menschendorf. Er ist hin- und hergerissen. [BALU] ist traurig, aber versteht: "Du gehörst zu den Menschen, Kleiner." [MOGLI] umarmt seine Dschungelfreunde - er wird beide Welten in seinem Herzen tragen.',
   '{"PROTAGONIST": "MOGLI", "HELPER1": "BALU", "HELPER2": "BAGHIRA"}',
   'Dschungelrand', 'bittersüß', 90);

-- 5. HEIDI

INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
VALUES (
  'lit-005',
  'Heidi',
  'literature',
  'de',
  'Heidi',
  'Schweiz',
  7,
  18,
  '["Realismus", "Natur", "Familie"]',
  'Naturverbundenheit und Herzlichkeit heilen',
  'Das Waisenmädchen Heidi wächst glücklich bei ihrem Großvater in den Schweizer Bergen auf, wird nach Frankfurt gebracht, kehrt aber in ihre geliebten Berge zurück.',
  true
);

INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, profession_preference)
VALUES
  ('lit-005', 'protagonist', 'Heidi', 1, 'Fröhliches Waisenmädchen', true, '["Kind", "Heldin"]'),
  ('lit-005', 'supporting', 'Alm-Öhi', 1, 'Heidis Großvater, mürrischer Einsiedler', true, '["Großvater", "Erwachsene"]'),
  ('lit-005', 'supporting', 'Peter', 1, 'Geißenpeter, Heidis Freund', true, '["Kind", "Junge", "Hirte"]'),
  ('lit-005', 'supporting', 'Clara', 1, 'Krankes Mädchen im Rollstuhl', true, '["Kind", "Mädchen"]'),
  ('lit-005', 'supporting', 'Fräulein Rottenmeier', 1, 'Strenge Haushälterin', false, '["Erwachsene", "Haushälterin"]'),
  ('lit-005', 'supporting', 'Claras Großmutter', 1, 'Liebevolle alte Dame', false, '["Großmutter", "Erwachsene"]');

INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, character_variables, setting, mood, duration_seconds)
VALUES
  ('lit-005', 1, 'Ankunft auf der Alm',
   'Die kleine [HEIDI] wird zu ihrem Großvater [ALM-ÖHI] in die Berge gebracht. Der [ÖHI] ist ein mürrischer Einsiedler, aber [HEIDI] erobert sofort sein Herz mit ihrer Fröhlichkeit.',
   '{"PROTAGONIST": "HEIDI", "SUPPORTING": "ALM-ÖHI"}',
   'Bergalm', 'hoffnungsvoll', 85),

  ('lit-005', 2, 'Mit den Geißen',
   '[HEIDI] geht mit [PETER] und den Ziegen auf die Alm. Sie liebt die Berge, die Blumen, die frische Luft! [PETER] zeigt ihr die besten Plätze. [HEIDI] ist vollkommen glücklich.',
   '{"PROTAGONIST": "HEIDI", "SUPPORTING": "PETER"}',
   'Bergwiesen', 'fröhlich', 90),

  ('lit-005', 3, 'Der Alm-Öhi wird weich',
   '[HEIDI] schmilzt das harte Herz des [ALM-ÖHI]. Er lacht wieder, spricht wieder mit den Dorfleuten. Die Liebe des Kindes hat den einsamen Mann verändert.',
   '{"PROTAGONIST": "HEIDI", "SUPPORTING": "ALM-ÖHI"}',
   'Almhütte', 'herzerwärmend', 80),

  ('lit-005', 4, 'Nach Frankfurt',
   '[HEIDI] wird nach Frankfurt zu der reichen, kranken [CLARA] gebracht. Die strenge [FRÄULEIN_ROTTENMEIER] versteht [HEIDI] nicht. Die Stadt macht [HEIDI] krank vor Heimweh.',
   '{"PROTAGONIST": "HEIDI", "SUPPORTING1": "CLARA", "SUPPORTING2": "FRÄULEIN_ROTTENMEIER"}',
   'Großstadtvilla', 'bedrückend', 95),

  ('lit-005', 5, 'Freundschaft in der Stadt',
   'Trotz Heimweh freundet sich [HEIDI] mit [CLARA] an. [CLARAS_GROßMUTTER] besucht sie und versteht [HEIDIS] Sehnsucht. Sie bringt [HEIDI] Lesen bei.',
   '{"PROTAGONIST": "HEIDI", "SUPPORTING1": "CLARA", "SUPPORTING2": "CLARAS_GROßMUTTER"}',
   'Claras Zimmer', 'warm', 85),

  ('lit-005', 6, 'Das Gespenst',
   '[HEIDI] schlafwandelt vor Heimweh. Sie macht allen Angst - sie denken, es ist ein Gespenst! Der Doktor versteht: "Das Kind muss in die Berge zurück, sonst stirbt sie!"',
   '{"PROTAGONIST": "HEIDI"}',
   'Villa bei Nacht', 'unheimlich', 80),

  ('lit-005', 7, 'Zurück in den Bergen',
   '[HEIDI] kehrt zum [ALM-ÖHI] zurück! Sie läuft zu [PETER], umarmt die Ziegen, jubelt über jeden Grashalm. "Ich bin wieder zu Hause!" Der [ÖHI] hat Tränen in den Augen.',
   '{"PROTAGONIST": "HEIDI", "SUPPORTING1": "ALM-ÖHI", "SUPPORTING2": "PETER"}',
   'Bergalm', 'jubelnd', 90),

  ('lit-005', 8, 'Claras Heilung',
   '[CLARA] kommt zu Besuch in die Berge. Die frische Luft, die Natur, [HEIDIS] Fröhlichkeit - all das heilt sie! Am Ende des Sommers kann [CLARA] laufen! Die Berge haben ihre Magie gewirkt.',
   '{"PROTAGONIST": "HEIDI", "SUPPORTING": "CLARA"}',
   'Bergwiesen', 'wundersam', 95);

-- 6. DIE SCHATZINSEL

INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
VALUES (
  'lit-006',
  'Die Schatzinsel',
  'literature',
  'en',
  'Treasure Island',
  'England',
  10,
  22,
  '["Abenteuer", "Piraten", "Mut"]',
  'Mut und Cleverness besiegen Verrat',
  'Der junge Jim Hawkins findet eine Schatzkarte und segelt zur geheimnisvollen Schatzinsel, wo er sich gefährlichen Piraten stellen muss.',
  true
);

INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, profession_preference)
VALUES
  ('lit-006', 'protagonist', 'Jim Hawkins', 1, 'Mutiger junger Kabinenjunge', true, '["Kind", "Held"]'),
  ('lit-006', 'antagonist', 'Long John Silver', 1, 'Einbeiniger Pirat, charmant aber gefährlich', true, '["Pirat", "Bösewicht"]'),
  ('lit-006', 'helper', 'Dr. Livesey', 1, 'Weiser Doktor', true, '["Doktor", "Erwachsene"]'),
  ('lit-006', 'helper', 'Squire Trelawney', 1, 'Reicher Edelmann', true, '["Edelmann", "Erwachsene"]'),
  ('lit-006', 'helper', 'Captain Smollett', 1, 'Ehrlicher Kapitän', true, '["Kapitän", "Seemann"]'),
  ('lit-006', 'supporting', 'Ben Gunn', 1, 'Gestrandeter Matrose', false, '["Seemann", "Einsiedler"]');

INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, character_variables, setting, mood, duration_seconds)
VALUES
  ('lit-006', 1, 'Die geheimnisvolle Karte',
   'Ein alter Seemann stirbt im Gasthaus von [JIMS] Familie. [JIM] findet in seiner Truhe eine Schatzkarte! Sie zeigt die Insel des berüchtigten Piraten Captain Flint!',
   '{"PROTAGONIST": "JIM_HAWKINS"}',
   'Admiral Benbow Gasthaus', 'aufregend', 85),

  ('lit-006', 2, 'Die Expedition beginnt',
   '[SQUIRE_TRELAWNEY] und [DR_LIVESEY] sind begeistert! Sie charttern das Schiff "Hispaniola". [JIM] wird Kabinenjunge. Sie heuern eine Mannschaft an - darunter den einbeinigen Koch [LONG_JOHN_SILVER].',
   '{"PROTAGONIST": "JIM_HAWKINS", "HELPER1": "DR_LIVESEY", "HELPER2": "SQUIRE_TRELAWNEY", "ANTAGONIST": "LONG_JOHN_SILVER"}',
   'Hafen von Bristol', 'gespannt', 90),

  ('lit-006', 3, 'Die Verschwörung',
   '[JIM] versteckt sich im Apfelfass und belauscht [SILVER] und die Matrosen - sie sind Piraten! Sie planen, den Schatz zu stehlen und die ehrlichen Männer zu töten! [JIM] warnt [CAPTAIN_SMOLLETT].',
   '{"PROTAGONIST": "JIM_HAWKINS", "ANTAGONIST": "LONG_JOHN_SILVER", "HELPER": "CAPTAIN_SMOLLETT"}',
   'Schiffsdeck bei Nacht', 'gefährlich', 95),

  ('lit-006', 4, 'Die Schatzinsel',
   'Sie erreichen die Insel! [JIM] schleicht sich an Land und trifft [BEN_GUNN], einen gestrandeten Matrosen. "Ich bin seit drei Jahren hier!", flüstert [BEN]. Er kennt ein Geheimnis über den Schatz.',
   '{"PROTAGONIST": "JIM_HAWKINS", "SUPPORTING": "BEN_GUNN"}',
   'Dschungelinsel', 'mysteriös', 90),

  ('lit-006', 5, 'Die Belagerung',
   'Die Piraten greifen an! [JIM] und die Getreuen verschanzen sich im alten Blockhaus. [SILVER] kommt mit einer schwarzen Flagge - die Piraten wollen den ganzen Schatz!',
   '{"PROTAGONIST": "JIM_HAWKINS", "HELPER1": "DR_LIVESEY", "HELPER2": "CAPTAIN_SMOLLETT", "ANTAGONIST": "LONG_JOHN_SILVER"}',
   'Blockhaus', 'spannend', 100),

  ('lit-006', 6, 'Jims waghalsiger Plan',
   '[JIM] kapert heimlich das Schiff! Er segelt es zu einer versteckten Bucht. Aber ein verwundeter Pirat greift ihn an! [JIM] muss um sein Leben kämpfen.',
   '{"PROTAGONIST": "JIM_HAWKINS"}',
   'Hispaniola Schiff', 'dramatisch', 100),

  ('lit-006', 7, 'Die Schatzsuche',
   '[SILVER] zwingt [JIM], bei der Schatzsuche zu helfen. Sie folgen der Karte zu einer großen Kiefer. Aber - das Loch ist leer! Der Schatz ist weg! Die Piraten wollen [SILVER] und [JIM] töten!',
   '{"PROTAGONIST": "JIM_HAWKINS", "ANTAGONIST": "LONG_JOHN_SILVER"}',
   'Dschungel der Insel', 'verzweifelt', 95),

  ('lit-006', 8, 'Ben Gunns Geheimnis',
   'Plötzlich tauchen [DR_LIVESEY] und [BEN_GUNN] auf! [BEN] hatte den Schatz längst gefunden und versteckt! Die Piraten fliehen. [JIM] und seine Freunde kehren mit dem Schatz nach Hause zurück. Nur [SILVER] entwischt mit etwas Gold - [JIM] wird ihn nie vergessen.',
   '{"PROTAGONIST": "JIM_HAWKINS", "HELPER1": "DR_LIVESEY", "SUPPORTING": "BEN_GUNN", "ANTAGONIST": "LONG_JOHN_SILVER"}',
   'Höhle', 'triumphierend', 90);

-- =====================================================
-- LEGENDS (5 tales)
-- =====================================================

-- 7. ROBIN HOOD

INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
VALUES (
  'legend-001',
  'Robin Hood',
  'legend',
  'en',
  'Robin Hood',
  'England',
  9,
  20,
  '["Abenteuer", "Gerechtigkeit", "Helden"]',
  'Für Gerechtigkeit einzustehen ist richtig',
  'Der edle Gesetzlose Robin Hood stiehlt von den Reichen und gibt den Armen, während er sich dem bösen Sheriff von Nottingham widersetzt.',
  true
);

INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, profession_preference)
VALUES
  ('legend-001', 'protagonist', 'Robin Hood', 1, 'Edler Gesetzloser und Meisterschütze', true, '["Held", "Bogenschütze", "Räuber"]'),
  ('legend-001', 'helper', 'Little John', 1, 'Robins größter und stärkster Gefährte', true, '["Kämpfer", "Riese"]'),
  ('legend-001', 'helper', 'Bruder Tuck', 1, 'Kampfeslustiger Mönch', true, '["Mönch", "Kämpfer"]'),
  ('legend-001', 'helper', 'Maid Marian', 1, 'Robins große Liebe', true, '["Adelige", "Heldin"]'),
  ('legend-001', 'antagonist', 'Sheriff von Nottingham', 1, 'Korrupter Sheriff', true, '["Sheriff", "Bösewicht"]'),
  ('legend-001', 'supporting', 'Fröhliche Männer', 5, 'Robins treue Gefährten', false, '["Räuber", "Bogenschütze"]');

INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, character_variables, setting, mood, duration_seconds)
VALUES
  ('legend-001', 1, 'Der Kampf auf der Brücke',
   '[ROBIN] trifft einen Riesen auf einer schmalen Brücke. "Keiner geht vorbei!", ruft der Mann. Sie kämpfen mit Stäben - [ROBIN] fällt ins Wasser! Er lacht und bietet dem Riesen an, sich anzuschließen. So wird [LITTLE_JOHN] sein bester Freund.',
   '{"PROTAGONIST": "ROBIN_HOOD", "HELPER": "LITTLE_JOHN"}',
   'Waldbrücke', 'fröhlich', 90),

  ('legend-001', 2, 'Im Sherwood Forest',
   '[ROBIN] und seine [FRÖHLICHEN_MÄNNER] leben versteckt im Sherwood Forest. Sie sind Gesetzlose, aber sie stehlen nur von den Reichen, um den Armen zu helfen. Ihr Lager ist gut versteckt unter den mächtigen Eichen.',
   '{"PROTAGONIST": "ROBIN_HOOD", "SUPPORTING": "FRÖHLICHE_MÄNNER"}',
   'Sherwood Forest', 'abenteuerlich', 85),

  ('legend-001', 3, 'Der kämpfende Mönch',
   '[ROBIN] begegnet einem dicken Mönch an einem Fluss. [BRUDER_TUCK] kämpft überraschend gut! [ROBIN] ist beeindruckt: "Ein Mönch der kämpfen kann! Schließ dich uns an!" [TUCK] wird Teil der Bande.',
   '{"PROTAGONIST": "ROBIN_HOOD", "HELPER": "BRUDER_TUCK"}',
   'Flussübergang', 'humorvoll', 85),

  ('legend-001', 4, 'Der böse Sheriff',
   'Der [SHERIFF_VON_NOTTINGHAM] presst den armen Bauern unmenschliche Steuern ab. [ROBIN] überfällt seinen Geldtransport und verteilt das Gold an die hungernden Familien. Der [SHERIFF] tobt vor Wut!',
   '{"PROTAGONIST": "ROBIN_HOOD", "ANTAGONIST": "SHERIFF_VON_NOTTINGHAM"}',
   'Waldstraße', 'triumphierend', 95),

  ('legend-001', 5, 'Maid Marian',
   '[ROBIN] trifft [MAID_MARIAN], eine tapfere Adelige, die sich als Mann verkleidet hat, um ihm zu helfen. Sie kämpft Seite an Seite mit den [FRÖHLICHEN_MÄNNERN]. [ROBIN] verliebt sich in sie.',
   '{"PROTAGONIST": "ROBIN_HOOD", "HELPER": "MAID_MARIAN"}',
   'Wald', 'romantisch', 90),

  ('legend-001', 6, 'Der Bogenschützenwettbewerb',
   'Der [SHERIFF] veranstaltet einen Wettbewerb - eine Falle für [ROBIN]! [ROBIN] verkleidet sich und nimmt teil. Er gewinnt mit einem perfekten Schuss! Aber der [SHERIFF] erkennt ihn - [ROBIN] muss fliehen!',
   '{"PROTAGONIST": "ROBIN_HOOD", "ANTAGONIST": "SHERIFF_VON_NOTTINGHAM"}',
   'Nottingham Marktplatz', 'spannend', 100),

  ('legend-001', 7, 'Die Rettungsmission',
   'Der [SHERIFF] fängt [LITTLE_JOHN]! Er soll gehängt werden. [ROBIN] und [MARIAN] führen die [FRÖHLICHEN_MÄNNER] zu einem waghalsigen Rettungseinsatz. Pfeile fliegen! [JOHN] wird gerettet!',
   '{"PROTAGONIST": "ROBIN_HOOD", "HELPER1": "MAID_MARIAN", "HELPER2": "LITTLE_JOHN", "ANTAGONIST": "SHERIFF_VON_NOTTINGHAM"}',
   'Nottingham', 'dramatisch', 100),

  ('legend-001', 8, 'Die Rückkehr des Königs',
   'König Richard Löwenherz kehrt zurück! Er verzeiht [ROBIN] und bestraft den korrupten [SHERIFF]. [ROBIN] und [MARIAN] können heiraten. Die Gerechtigkeit siegt!',
   '{"PROTAGONIST": "ROBIN_HOOD", "HELPER": "MAID_MARIAN"}',
   'Schloss', 'freudig', 85);

-- 8. KÖNIG ARTUS

INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
VALUES (
  'legend-002',
  'König Artus und das Schwert im Stein',
  'legend',
  'en',
  'King Arthur',
  'England',
  10,
  20,
  '["Fantasy", "Ritter", "Magie"]',
  'Wahre Größe kommt von innen, nicht von Geburt',
  'Der junge Artus zieht das magische Schwert Excalibur aus dem Stein und wird König von England. Mit seinen Rittern der Tafelrunde verteidigt er das Reich.',
  true
);

INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, profession_preference)
VALUES
  ('legend-002', 'protagonist', 'Artus', 1, 'Junger Mann der König wird', true, '["König", "Held", "Ritter"]'),
  ('legend-002', 'helper', 'Merlin', 1, 'Weiser Zauberer', true, '["Zauberer", "Magier", "Weiser"]'),
  ('legend-002', 'helper', 'Lancelot', 1, 'Edelster Ritter der Tafelrunde', false, '["Ritter", "Held"]'),
  ('legend-002', 'supporting', 'Guinevere', 1, 'Artus\' Königin', false, '["Königin", "Adelige"]'),
  ('legend-002', 'antagonist', 'Mordred', 1, 'Artus\' verräterischer Sohn', false, '["Ritter", "Bösewicht"]'),
  ('legend-002', 'supporting', 'Ritter der Tafelrunde', 5, 'Tapfere Ritter', false, '["Ritter", "Held"]');

INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, character_variables, setting, mood, duration_seconds)
VALUES
  ('legend-002', 1, 'Das Schwert im Stein',
   'Auf dem Kirchplatz steckt ein Schwert in einem Stein. Goldene Buchstaben verkünden: "Wer dieses Schwert zieht, ist der rechtmäßige König!" Viele starke Ritter versuchen es - keiner schafft es.',
   '{}',
   'Kirchplatz', 'mystisch', 80),

  ('legend-002', 2, 'Der Knappe zieht das Schwert',
   '[ARTUS] ist nur der Knappe seines Bruders. Als dieser sein Schwert vergisst, geht [ARTUS] zum Stein. Er weiß nichts von der Prophezeiung und zieht das Schwert mühelos heraus! [MERLIN] lächelt - er wusste es immer.',
   '{"PROTAGONIST": "ARTUS", "HELPER": "MERLIN"}',
   'Kirchplatz', 'wundersam', 95),

  ('legend-002', 3, 'Die Krönung',
   '[ARTUS] wird zum König gekrönt! Viele Adelige zweifeln - er ist so jung! Doch [MERLIN] steht ihm bei: "Du wirst ein großer König sein. Aber du musst weise und gerecht regieren."',
   '{"PROTAGONIST": "ARTUS", "HELPER": "MERLIN"}',
   'Kathedrale', 'feierlich', 85),

  ('legend-002', 4, 'Die Tafelrunde',
   '[ARTUS] erschafft die Runde Tafel, an der alle [RITTER] gleichberechtigt sitzen - kein Platz ist wichtiger als der andere. Die edelsten [RITTER] des Landes versammeln sich: [LANCELOT], Gawain, Percival und viele mehr.',
   '{"PROTAGONIST": "ARTUS", "HELPER": "LANCELOT", "SUPPORTING": "RITTER_DER_TAFELRUNDE"}',
   'Camelot Thronsaal', 'erhaben', 90),

  ('legend-002', 5, 'Excalibur',
   '[ARTUS] bricht das Schwert aus dem Stein im Kampf. [MERLIN] führt ihn zur Dame vom See. Sie überreicht ihm Excalibur - das mächtigste Schwert der Welt! "Seine Scheide schützt dich vor Verwundung."',
   '{"PROTAGONIST": "ARTUS", "HELPER": "MERLIN"}',
   'Magischer See', 'magisch', 90),

  ('legend-002', 6, 'Die Hochzeit',
   '[ARTUS] heiratet die schöne [GUINEVERE]. Das Königreich feiert! Doch [MERLIN] warnt leise: "Große Liebe bringt oft große Prüfungen." [LANCELOT] und [GUINEVERE] begegnen sich zum ersten Mal.',
   '{"PROTAGONIST": "ARTUS", "SUPPORTING1": "GUINEVERE", "HELPER": "LANCELOT"}',
   'Camelot', 'festlich', 85),

  ('legend-002', 7, 'Verrat und Krieg',
   '[MORDRED], [ARTUS\'] eigener Sohn, erhebt sich gegen ihn. Er nutzt die verbotene Liebe zwischen [LANCELOT] und [GUINEVERE], um das Königreich zu spalten. [ARTUS] muss gegen seinen eigenen Sohn in den Krieg ziehen.',
   '{"PROTAGONIST": "ARTUS", "ANTAGONIST": "MORDRED", "HELPER": "LANCELOT"}',
   'Schlachtfeld', 'tragisch', 100),

  ('legend-002', 8, 'Die letzte Schlacht',
   'In der letzten Schlacht verwundet [MORDRED] [ARTUS] tödlich - aber [ARTUS] erschlägt auch ihn. Sterbend befiehlt [ARTUS]: "Wirf Excalibur in den See!" Eine Hand aus dem Wasser fängt das Schwert. [ARTUS] wird nach Avalon gebracht, um zu heilen. "Er wird wiederkehren, wenn England ihn am meisten braucht."',
   '{"PROTAGONIST": "ARTUS", "ANTAGONIST": "MORDRED"}',
   'Schlachtfeld und See', 'episch', 100);

-- 9. DER RATTENFÄNGER VON HAMELN

INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
VALUES (
  'legend-003',
  'Der Rattenfänger von Hameln',
  'legend',
  'de',
  'The Pied Piper of Hamelin',
  'Deutschland',
  8,
  14,
  '["Legende", "Moral", "Gerechtigkeit"]',
  'Halte immer deine Versprechen',
  'Ein geheimnisvoller Pfeifer befreit die Stadt Hameln von einer Rattenplage, doch als die Bürger ihm den versprochenen Lohn verweigern, nimmt er furchtbare Rache.',
  true
);

INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, profession_preference)
VALUES
  ('legend-003', 'protagonist', 'Rattenfänger', 1, 'Geheimnisvoller Mann mit bunter Kleidung', true, '["Pfeifer", "Fremder", "Magier"]'),
  ('legend-003', 'antagonist', 'Bürgermeister', 1, 'Geiziger Stadtoberer', true, '["Bürgermeister", "Erwachsene"]'),
  ('legend-003', 'supporting', 'Stadträte', 3, 'Habgierige Ratsherren', true, '["Erwachsene", "Ratsherr"]'),
  ('legend-003', 'supporting', 'Kinder von Hameln', 7, 'Die Kinder der Stadt', true, '["Kind"]');

INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, character_variables, setting, mood, duration_seconds)
VALUES
  ('legend-003', 1, 'Die Rattenplage',
   'Die Stadt Hameln wird von Ratten überrannt! Sie sind überall - in den Häusern, in den Kornkammern, auf den Straßen. Die Bürger sind verzweifelt. Der [BÜRGERMEISTER] und die [STADTRÄTE] wissen nicht, was sie tun sollen.',
   '{"ANTAGONIST": "BÜRGERMEISTER", "SUPPORTING": "STADTRÄTE"}',
   'Stadt Hameln', 'verzweifelt', 80),

  ('legend-003', 2, 'Der fremde Mann',
   'Ein seltsamer Mann in bunter Kleidung erscheint - der [RATTENFÄNGER]. "Ich kann euch von den Ratten befreien", sagt er. "Ich will 1000 Goldstücke." Der [BÜRGERMEISTER] verspricht es sofort.',
   '{"PROTAGONIST": "RATTENFÄNGER", "ANTAGONIST": "BÜRGERMEISTER"}',
   'Rathaus', 'hoffnungsvoll', 75),

  ('legend-003', 3, 'Die Befreiung',
   'Der [RATTENFÄNGER] zieht seine Pfeife hervor und beginnt zu spielen. Eine geheimnisvolle Melodie erklingt! Alle Ratten kommen hervor, folgen ihm wie verzaubert. Er führt sie zum Fluss - alle Ratten ertrinken! Hameln ist frei!',
   '{"PROTAGONIST": "RATTENFÄNGER"}',
   'Straßen von Hameln', 'magisch', 90),

  ('legend-003', 4, 'Der Verrat',
   'Der [RATTENFÄNGER] fordert seinen Lohn. Doch der geizige [BÜRGERMEISTER] und die [STADTRÄTE] lachen: "1000 Goldstücke? Für einen Pfeifer? Hier sind 50! Sei froh!" Der [RATTENFÄNGER] wird dunkel im Gesicht: "Ihr werdet es bereuen."',
   '{"PROTAGONIST": "RATTENFÄNGER", "ANTAGONIST": "BÜRGERMEISTER", "SUPPORTING": "STADTRÄTE"}',
   'Rathaus', 'bedrohlich', 85),

  ('legend-003', 5, 'Die Rache - Der Klang der Pfeife',
   'Am 26. Juni, während alle Erwachsenen in der Kirche sind, kehrt der [RATTENFÄNGER] zurück. Er spielt eine neue Melodie - silbern und verführerisch. Alle [KINDER] der Stadt kommen heraus, lächelnd, träumend.',
   '{"PROTAGONIST": "RATTENFÄNGER", "SUPPORTING": "KINDER"}',
   'Straßen von Hameln', 'unheimlich', 95),

  ('legend-003', 6, 'Das Verschwinden',
   'Die [KINDER] folgen dem [RATTENFÄNGER] aus der Stadt, tanzend und singend. Er führt sie zum Koppelberg. Der Berg öffnet sich - die [KINDER] verschwinden hinein! Nur zwei bleiben zurück: ein lahmes Kind, das nicht folgen konnte, und ein taubes Kind, das die Musik nicht hörte.',
   '{"PROTAGONIST": "RATTENFÄNGER", "SUPPORTING": "KINDER"}',
   'Koppelberg', 'tragisch', 100),

  ('legend-003', 7, 'Die Trauer',
   'Die Eltern kehren aus der Kirche zurück - die [KINDER] sind weg! Der [BÜRGERMEISTER] ist gebrochen. Sie suchen überall, rufen, weinen. Doch die [KINDER] bleiben verschwunden. Hameln wird eine traurige, stille Stadt. Die Lektion ist gelernt - aber zu spät.',
   '{"ANTAGONIST": "BÜRGERMEISTER"}',
   'Stadt Hameln', 'traurig', 75);

-- 10. TILL EULENSPIEGEL

INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
VALUES (
  'legend-004',
  'Till Eulenspiegel',
  'legend',
  'de',
  'Till Eulenspiegel',
  'Deutschland',
  8,
  16,
  '["Humor", "Schalk", "Weisheit"]',
  'Cleverness und Wortwitz entlarven Dummheit',
  'Der Schalk Till Eulenspiegel reist durchs Land und spielt den Menschen Streiche, indem er ihre Worte beim Wort nimmt und so ihre Eitelkeit und Dummheit entlarvt.',
  true
);

INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, profession_preference)
VALUES
  ('legend-004', 'protagonist', 'Till Eulenspiegel', 1, 'Schlauer Schalk und Narr', true, '["Schalk", "Narr", "Held"]'),
  ('legend-004', 'supporting', 'Bäckermeister', 1, 'Dummer Bäcker', false, '["Bäcker", "Handwerker"]'),
  ('legend-004', 'supporting', 'Schneidermeister', 1, 'Eitler Schneider', false, '["Schneider", "Handwerker"]'),
  ('legend-004', 'supporting', 'Marktfrau', 1, 'Geschwätzige Händlerin', false, '["Händler", "Erwachsene"]'),
  ('legend-004', 'supporting', 'Adelige', 2, 'Hochmütige Herren', false, '["Adelige", "Erwachsene"]');

INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, character_variables, setting, mood, duration_seconds)
VALUES
  ('legend-004', 1, 'Till wird geboren',
   'Als [TILL] geboren wird, wird er dreimal getauft - im Wasser, im Feuer und im Wind. "Dieser Junge wird außergewöhnlich!", sagen die Leute. Und sie sollen Recht behalten!',
   '{"PROTAGONIST": "TILL_EULENSPIEGEL"}',
   'Dorf', 'humorvoll', 70),

  ('legend-004', 2, 'Die Eulen und der Spiegel',
   '[TILL] bekommt seinen Namen vom Dorfwappen - eine Eule und ein Spiegel. "Eu-len-spie-gel!", lachen die Kinder. [TILL] lacht mit - der Name passt perfekt für einen, der den Menschen einen Spiegel vorhält!',
   '{"PROTAGONIST": "TILL_EULENSPIEGEL"}',
   'Dorf', 'fröhlich', 75),

  ('legend-004', 3, 'Der Bäcker',
   '[TILL] wird Bäckerlehrling. Der [BÄCKERMEISTER] sagt: "Back mir Eulen und Meerkatzen!" Er meint Gebäck. Aber [TILL] backt echte Formen von Eulen und Affen! Der [MEISTER] ist wütend - [TILL] hat genau das getan, was befohlen wurde!',
   '{"PROTAGONIST": "TILL_EULENSPIEGEL", "SUPPORTING": "BÄCKERMEISTER"}',
   'Bäckerei', 'schalkhaft', 90),

  ('legend-004', 4, 'Der Schneider',
   'Der eitle [SCHNEIDERMEISTER] sagt: "Schneide den Stoff auf der Bank!" [TILL] schneidet tatsächlich die Bank auf! "Ich tat, was Ihr sagtet!", grinst [TILL]. Der [MEISTER] kann nichts erwidern.',
   '{"PROTAGONIST": "TILL_EULENSPIEGEL", "SUPPORTING": "SCHNEIDERMEISTER"}',
   'Schneiderei', 'komisch', 85),

  ('legend-004', 5, 'Die Marktfrau',
   'Die geschwätzige [MARKTFRAU] behandelt [TILL] schlecht. [TILL] kauft all ihre schlechten Eier, klettert auf die Kirche und lässt sie auf die Leute regnen! Die ganze Stadt stinkt - aber alle lachen über die [MARKTFRAU].',
   '{"PROTAGONIST": "TILL_EULENSPIEGEL", "SUPPORTING": "MARKTFRAU"}',
   'Marktplatz', 'chaotisch', 90),

  ('legend-004', 6, 'Der König und die Hofnarren',
   '[TILL] kommt an einen Hof. Die [ADELIGEN] denken, sie sind klüger als ein Bauer. [TILL] macht sie mit Wortspielen lächerlich. Der König lacht - [TILL] ist der cleverste "Narr" den er je traf!',
   '{"PROTAGONIST": "TILL_EULENSPIEGEL", "SUPPORTING": "ADELIGE"}',
   'Königshof', 'triumphierend', 95),

  ('legend-004', 7, 'Tills Weisheit',
   '[TILL] wird älter. Seine Streiche haben immer einen tieferen Sinn gehabt - er entlarvte Heuchler, Geizhälse und Dummköpfe. Die einfachen Leute lieben ihn dafür.',
   '{"PROTAGONIST": "TILL_EULENSPIEGEL"}',
   'Verschiedene Orte', 'nachdenklich', 75),

  ('legend-004', 8, 'Das letzte Lachen',
   '[TILL] stirbt, aber selbst sein Grabstein ist ein Scherz - eine Eule und ein Spiegel. "Er hielt uns allen den Spiegel vor", sagen die Leute. Bis heute lachen Menschen über Tills Streiche!',
   '{"PROTAGONIST": "TILL_EULENSPIEGEL"}',
   'Friedhof', 'melancholisch', 70);

-- 11. DIE LORELEY

INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
VALUES (
  'legend-005',
  'Die Loreley',
  'legend',
  'de',
  'The Lorelei',
  'Deutschland',
  10,
  14,
  '["Legende", "Romantik", "Tragik"]',
  'Schönheit kann gefährlich sein',
  'Eine wunderschöne Nixe sitzt auf einem Felsen am Rhein und kämmt ihr goldenes Haar. Ihr betörender Gesang lockt Schiffer in den Tod.',
  true
);

INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, profession_preference)
VALUES
  ('legend-005', 'protagonist', 'Loreley', 1, 'Wunderschöne aber verfluchte Nixe', true, '["Nixe", "Magisches Wesen"]'),
  ('legend-005', 'supporting', 'Junger Schiffer', 1, 'Verliebter Fischer', true, '["Fischer", "Seemann"]'),
  ('legend-005', 'supporting', 'Alte Fischer', 2, 'Erfahrene Rheinschiffer', false, '["Fischer", "Seemann"]'),
  ('legend-005', 'supporting', 'Graf', 1, 'Adliger der Loreley liebte', false, '["Graf", "Adelige"]');

INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, character_variables, setting, mood, duration_seconds)
VALUES
  ('legend-005', 1, 'Die Verwandlung',
   'Einst war [LORELEY] ein Mädchen, das einen [GRAFEN] liebte. Er verließ sie für eine andere. Vor gebrochenem Herzen stürzte sie sich vom Felsen in den Rhein. Doch sie ertrank nicht - sie wurde zur Nixe, verdammt für immer zu singen.',
   '{"PROTAGONIST": "LORELEY", "SUPPORTING": "GRAF"}',
   'Rhein bei Sonnenuntergang', 'tragisch', 85),

  ('legend-005', 2, 'Der Felsen',
   '[LORELEY] sitzt auf ihrem hohen Felsen über dem Rhein. Sie kämmt ihr langes, goldenes Haar mit einem goldenen Kamm. Ihre Schönheit ist überirdisch - und furchtbar traurig.',
   '{"PROTAGONIST": "LORELEY"}',
   'Loreley-Felsen', 'melancholisch', 75),

  ('legend-005', 3, 'Der Gesang',
   '[LORELEY] beginnt zu singen. Ihre Stimme ist so schön, dass die Zeit stillzustehen scheint. Es ist ein Lied von Liebe und Verlust, von Sehnsucht und Einsamkeit. Jeder der es hört, ist gebannt.',
   '{"PROTAGONIST": "LORELEY"}',
   'Rhein bei Abenddämmerung', 'betörend', 80),

  ('legend-005', 4, 'Die Warnung der Alten',
   'Die [ALTEN_FISCHER] warnen immer wieder: "Fahrt nicht bei Sonnenuntergang am Loreley-Felsen vorbei! Hört nicht auf ihren Gesang! Viele sind schon an den Klippen zerschellt!"',
   '{"SUPPORTING": "ALTE_FISCHER"}',
   'Fischerdorf', 'warnend', 70),

  ('legend-005', 5, 'Der junge Schiffer',
   'Doch ein [JUNGER_SCHIFFER] glaubt nicht an die Geschichten. "Das ist nur Aberglaube!", lacht er. Er fährt am Abend zum Loreley-Felsen. Dann hört er den Gesang...',
   '{"SUPPORTING": "JUNGER_SCHIFFER"}',
   'Rhein', 'zuversichtlich', 75),

  ('legend-005', 6, 'Der Bann',
   'Der [SCHIFFER] kann nicht widerstehen. Er starrt zu [LORELEY] hinauf, vergisst alles - das Ruder, die Strömung, die Felsen. Die Melodie füllt seinen Geist. Er rudert direkt auf die tödlichen Klippen zu.',
   '{"PROTAGONIST": "LORELEY", "SUPPORTING": "JUNGER_SCHIFFER"}',
   'Rhein bei Dämmerung', 'hypnotisch', 90),

  ('legend-005', 7, 'Das Schicksal',
   'Das Boot zerschellt an den Felsen. Der [SCHIFFER] verschwindet in den Fluten. [LORELEY] singt weiter, eine Träne rollt über ihre Wange. Sie kann nicht aufhören - sie ist verflucht, für immer zu singen und zu locken.',
   '{"PROTAGONIST": "LORELEY", "SUPPORTING": "JUNGER_SCHIFFER"}',
   'Rhein', 'tragisch', 85),

  ('legend-005', 8, 'Die ewige Legende',
   'Bis heute sitzt [LORELEY] auf ihrem Felsen. Bei Sonnenuntergang kann man manchmal ihren Gesang hören - wunderschön und tödlich. Die Schiffer wissen es: Die Loreley singt noch immer.',
   '{"PROTAGONIST": "LORELEY"}',
   'Loreley-Felsen', 'zeitlos', 65);

-- =====================================================
-- AESOP FABLES (4 tales)
-- =====================================================

-- 12. DER FUCHS UND DIE TRAUBEN

INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
VALUES (
  'aesop-001',
  'Der Fuchs und die Trauben',
  'aesop',
  'grc',
  'The Fox and the Grapes',
  'Antikes Griechenland',
  5,
  8,
  '["Fabel", "Tiere", "Moral"]',
  'Wer etwas nicht erreichen kann, redet es schlecht',
  'Ein hungriger Fuchs sieht saftige Trauben hoch an einer Rebe. Er versucht sie zu erreichen, scheitert aber und verkündet: "Die Trauben sind sowieso sauer!"',
  true
);

INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, profession_preference)
VALUES
  ('aesop-001', 'protagonist', 'Fuchs', 1, 'Hungriger aber stolzer Fuchs', true, '["Fuchs", "Tier"]');

INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, character_variables, setting, mood, duration_seconds)
VALUES
  ('aesop-001', 1, 'Der hungrige Fuchs',
   'Ein [FUCHS] streift hungrig durch den Weinberg. Sein Magen knurrt. Da sieht er sie - prächtige, saftige Trauben, die hoch an einer Rebe hängen! Sie glänzen in der Sonne, perfekt reif.',
   '{"PROTAGONIST": "FUCHS"}',
   'Weinberg', 'gierig', 60),

  ('aesop-001', 2, 'Die Versuche',
   'Der [FUCHS] springt - zu kurz! Er springt wieder - noch immer zu kurz! Er rennt an und springt mit aller Kraft - aber die Trauben sind einfach zu hoch. Erschöpft gibt er auf.',
   '{"PROTAGONIST": "FUCHS"}',
   'Weinberg', 'frustriert', 75),

  ('aesop-001', 3, 'Saure Trauben',
   'Der [FUCHS] richtet sich stolz auf und verkündet laut: "Diese Trauben sind sowieso sauer! Ich wollte sie gar nicht haben!" Und er stolziert davon, die Nase hoch erhoben.',
   '{"PROTAGONIST": "FUCHS"}',
   'Weinberg', 'überheblich', 65),

  ('aesop-001', 4, 'Die Moral',
   'Wenn wir etwas nicht erreichen können, reden wir es oft schlecht. Das nennt man: "Saure Trauben"!',
   '{}',
   'Weinberg', 'lehrreich', 40);

-- 13. DIE SCHILDKRÖTE UND DER HASE

INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
VALUES (
  'aesop-002',
  'Die Schildkröte und der Hase',
  'aesop',
  'grc',
  'The Tortoise and the Hare',
  'Antikes Griechenland',
  5,
  10,
  '["Fabel", "Tiere", "Ausdauer"]',
  'Langsam und stetig gewinnt das Rennen',
  'Der schnelle Hase spottet über die langsame Schildkröte. Sie fordert ihn zu einem Wettrennen heraus - und gewinnt durch Ausdauer, während der Hase ein Nickerchen macht.',
  true
);

INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, profession_preference)
VALUES
  ('aesop-002', 'protagonist', 'Schildkröte', 1, 'Langsame aber beharrliche Schildkröte', true, '["Schildkröte", "Tier"]'),
  ('aesop-002', 'antagonist', 'Hase', 1, 'Schneller aber überheblicher Hase', true, '["Hase", "Tier"]'),
  ('aesop-002', 'supporting', 'Waldbewohner', 3, 'Zuschauende Tiere', false, '["Tier", "Fuchs", "Eichhörnchen", "Vogel"]');

INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, character_variables, setting, mood, duration_seconds)
VALUES
  ('aesop-002', 1, 'Die Herausforderung',
   'Der [HASE] lacht über die langsame [SCHILDKRÖTE]: "Du bist ja so lahm!" Die [SCHILDKRÖTE] bleibt ruhig: "Lass uns ein Rennen machen. Ich werde gewinnen." Der [HASE] lacht noch mehr: "Das will ich sehen!"',
   '{"PROTAGONIST": "SCHILDKRÖTE", "ANTAGONIST": "HASE"}',
   'Waldlichtung', 'herausfordernd', 70),

  ('aesop-002', 2, 'Der Start',
   'Alle [WALDBEWOHNER] kommen zum Zuschauen. Der Fuchs gibt das Startsignal! Der [HASE] schießt davon wie ein Pfeil. Die [SCHILDKRÖTE] beginnt ihren langsamen, stetigen Marsch.',
   '{"PROTAGONIST": "SCHILDKRÖTE", "ANTAGONIST": "HASE", "SUPPORTING": "WALDBEWOHNER"}',
   'Startlinie', 'aufgeregt', 65),

  ('aesop-002', 3, 'Der Vorsprung',
   'Der [HASE] ist so schnell, dass er bald einen riesigen Vorsprung hat. Er dreht sich um - die [SCHILDKRÖTE] ist nur ein kleiner Punkt in der Ferne. "Ich habe alle Zeit der Welt!", denkt er.',
   '{"ANTAGONIST": "HASE", "PROTAGONIST": "SCHILDKRÖTE"}',
   'Waldweg', 'übermütig', 60),

  ('aesop-002', 4, 'Das Nickerchen',
   'Der [HASE] legt sich unter einen Baum: "Ein kleines Schläfchen kann nicht schaden. Die Schildkröte braucht Stunden!" Er schläft ein, ein zufriedenes Lächeln auf dem Gesicht.',
   '{"ANTAGONIST": "HASE"}',
   'Unter einem Baum', 'sorglos', 65),

  ('aesop-002', 5, 'Die Schildkröte läuft',
   'Die [SCHILDKRÖTE] läuft weiter. Schritt für Schritt. Langsam, aber ohne Pause. Sie kommt am schlafenden [HASEN] vorbei. Sie läuft einfach weiter. Schritt für Schritt.',
   '{"PROTAGONIST": "SCHILDKRÖTE", "ANTAGONIST": "HASE"}',
   'Waldweg', 'beharrlich', 75),

  ('aesop-002', 6, 'Das Erwachen',
   'Der [HASE] wacht auf! Die Sonne steht tief. "Oh nein!" Er rast los, so schnell er kann. Aber es ist zu spät - die [SCHILDKRÖTE] überquert gerade die Ziellinie! Die [WALDBEWOHNER] jubeln!',
   '{"ANTAGONIST": "HASE", "PROTAGONIST": "SCHILDKRÖTE", "SUPPORTING": "WALDBEWOHNER"}',
   'Ziellinie', 'triumphierend', 80),

  ('aesop-002', 7, 'Die Lehre',
   'Die [SCHILDKRÖTE] lächelt müde: "Langsam und stetig gewinnt das Rennen." Der [HASE] schämt sich. Er hat gelernt: Talent allein reicht nicht - man braucht auch Ausdauer und Bescheidenheit!',
   '{"PROTAGONIST": "SCHILDKRÖTE", "ANTAGONIST": "HASE"}',
   'Ziellinie', 'lehrreich', 65);

-- 14. DER LÖWE UND DIE MAUS

INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
VALUES (
  'aesop-003',
  'Der Löwe und die Maus',
  'aesop',
  'grc',
  'The Lion and the Mouse',
  'Antikes Griechenland',
  5,
  8,
  '["Fabel", "Tiere", "Freundlichkeit"]',
  'Auch Kleine können Großen helfen',
  'Ein mächtiger Löwe verschont eine kleine Maus. Später rettet die Maus dem Löwen das Leben, indem sie ihn aus einem Jägernetz befreit.',
  true
);

INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, profession_preference)
VALUES
  ('aesop-003', 'protagonist', 'Maus', 1, 'Kleine aber tapfere Maus', true, '["Maus", "Tier"]'),
  ('aesop-003', 'supporting', 'Löwe', 1, 'Mächtiger König der Tiere', true, '["Löwe", "Tier"]');

INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, character_variables, setting, mood, duration_seconds)
VALUES
  ('aesop-003', 1, 'Die Begegnung',
   'Eine winzige [MAUS] läuft versehentlich über die Pfote des schlafenden [LÖWEN]. Der [LÖWE] erwacht und packt die [MAUS] mit seiner riesigen Pranke! "Wie wagst du es, mich zu stören?"',
   '{"PROTAGONIST": "MAUS", "SUPPORTING": "LÖWE"}',
   'Savanne', 'erschreckend', 65),

  ('aesop-003', 2, 'Die Gnade',
   'Die [MAUS] zittert: "Bitte, großer [LÖWE], verschone mich! Vielleicht kann ich dir eines Tages helfen!" Der [LÖWE] lacht: "Du? Mir helfen? Wie lustig!" Aber er lässt die [MAUS] gehen.',
   '{"PROTAGONIST": "MAUS", "SUPPORTING": "LÖWE"}',
   'Savanne', 'gnädig', 70),

  ('aesop-003', 3, 'Die Falle',
   'Wenige Tage später jagt der [LÖWE] durch den Dschungel - und gerät in ein Jägernetz! Je mehr er sich wehrt, desto fester ist er gefangen. Er brüllt verzweifelt um Hilfe!',
   '{"SUPPORTING": "LÖWE"}',
   'Dschungel', 'verzweifelt', 75),

  ('aesop-003', 4, 'Die Rettung',
   'Die [MAUS] hört das Brüllen und eilt herbei! "Ich werde dir helfen, wie ich versprochen habe!" Mit ihren scharfen Zähnen nagt sie die Seile durch. Strang für Strang. Der [LÖWE] wird frei!',
   '{"PROTAGONIST": "MAUS", "SUPPORTING": "LÖWE"}',
   'Dschungel', 'heroisch', 80),

  ('aesop-003', 5, 'Die Freundschaft',
   'Der [LÖWE] verneigt sich vor der [MAUS]: "Du hattest recht! Auch Kleine können Großen helfen. Du bist meine Freundin!" Von da an sind [LÖWE] und [MAUS] die besten Freunde.',
   '{"PROTAGONIST": "MAUS", "SUPPORTING": "LÖWE"}',
   'Savanne', 'herzlich', 60);

-- 15. DER HIRTENJUNGE UND DER WOLF

INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
VALUES (
  'aesop-004',
  'Der Hirtenjunge und der Wolf',
  'aesop',
  'grc',
  'The Boy Who Cried Wolf',
  'Antikes Griechenland',
  6,
  10,
  '["Fabel", "Moral", "Ehrlichkeit"]',
  'Lügen haben kurze Beine - wer lügt, dem glaubt man nicht',
  'Ein Hirtenjunge ruft aus Langeweile mehrmals fälschlich "Wolf!", bis die Dorfbewohner ihm nicht mehr glauben - mit tragischen Folgen.',
  true
);

INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, profession_preference)
VALUES
  ('aesop-004', 'protagonist', 'Hirtenjunge', 1, 'Gelangweilter junger Schafhirte', true, '["Kind", "Hirte"]'),
  ('aesop-004', 'supporting', 'Dorfbewohner', 4, 'Hilfsbereite Bauern', true, '["Bauer", "Erwachsene"]'),
  ('aesop-004', 'antagonist', 'Wolf', 1, 'Hungriger Wolf', true, '["Wolf", "Tier"]');

INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, character_variables, setting, mood, duration_seconds)
VALUES
  ('aesop-004', 1, 'Die Langeweile',
   'Der [HIRTENJUNGE] hütet die Schafe auf der Weide. Es ist so langweilig! Jeden Tag dasselbe. Nichts passiert. Er gähnt und schaut zu, wie die Schafe grasen.',
   '{"PROTAGONIST": "HIRTENJUNGE"}',
   'Bergweide', 'gelangweilt', 60),

  ('aesop-004', 2, 'Die erste Lüge',
   'Dem [HIRTENJUNGEN] kommt eine Idee: "Ich weiß, wie ich Spaß haben kann!" Er rennt zum Dorf und schreit: "Wolf! Wolf! Ein Wolf greift die Schafe an!" Die [DORFBEWOHNER] rennen mit Heugabeln herbei!',
   '{"PROTAGONIST": "HIRTENJUNGE", "SUPPORTING": "DORFBEWOHNER"}',
   'Dorf und Weide', 'aufgeregt', 75),

  ('aesop-004', 3, 'Die Enttäuschung',
   'Die [DORFBEWOHNER] kommen außer Atem auf der Weide an - aber da ist kein Wolf! Nur der [HIRTENJUNGE] lacht: "Ha ha! Reingelegt!" Die [DORFBEWOHNER] sind verärgert und gehen zurück ins Dorf.',
   '{"PROTAGONIST": "HIRTENJUNGE", "SUPPORTING": "DORFBEWOHNER"}',
   'Weide', 'verärgert', 70),

  ('aesop-004', 4, 'Die zweite Lüge',
   'Ein paar Tage später ist dem [HIRTENJUNGEN] wieder langweilig. "Das war so lustig!" Er ruft wieder: "Wolf! Wolf!" Wieder rennen die [DORFBEWOHNER] herbei. Wieder ist da kein Wolf! "Hör auf damit!", schimpfen sie.',
   '{"PROTAGONIST": "HIRTENJUNGE", "SUPPORTING": "DORFBEWOHNER"}',
   'Dorf und Weide', 'wütend', 75),

  ('aesop-004', 5, 'Die dritte Lüge',
   'Der [HIRTENJUNGE] macht es noch einmal. Die [DORFBEWOHNER] kommen - und wieder ist da kein Wolf. Jetzt sind sie richtig wütend: "Lügner! Uns täuschst du nicht wieder!" Sie gehen kopfschüttelnd davon.',
   '{"PROTAGONIST": "HIRTENJUNGE", "SUPPORTING": "DORFBEWOHNER"}',
   'Weide', 'zornig', 70),

  ('aesop-004', 6, 'Der echte Wolf',
   'Tage später - ein echter [WOLF] schleicht sich an die Herde! Der [HIRTENJUNGE] bekommt schreckliche Angst! "Wolf! Wolf! Wirklich ein Wolf!" schreit er verzweifelt.',
   '{"PROTAGONIST": "HIRTENJUNGE", "ANTAGONIST": "WOLF"}',
   'Weide', 'panisch', 80),

  ('aesop-004', 7, 'Niemand kommt',
   'Aber die [DORFBEWOHNER] hören den Ruf und schütteln nur den Kopf: "Wieder seine Lügen! Wir fallen nicht noch einmal darauf herein!" Niemand kommt. Der [WOLF] reißt mehrere Schafe. Der [HIRTENJUNGE] lernt eine harte Lektion.',
   '{"PROTAGONIST": "HIRTENJUNGE", "ANTAGONIST": "WOLF", "SUPPORTING": "DORFBEWOHNER"}',
   'Weide und Dorf', 'tragisch', 85),

  ('aesop-004', 8, 'Die Moral',
   'Der [HIRTENJUNGE] kehrt weinend ins Dorf zurück. "Ich habe die Wahrheit gesagt!" - "Einem Lügner glaubt man nicht, selbst wenn er die Wahrheit spricht", sagen die [DORFBEWOHNER]. Die Lektion ist gelernt.',
   '{"PROTAGONIST": "HIRTENJUNGE", "SUPPORTING": "DORFBEWOHNER"}',
   'Dorf', 'lehrreich', 65);

-- =====================================================
-- CLASSIC GRIMM TALES (3 tales)
-- =====================================================

-- 16. HÄNSEL UND GRETEL

INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
VALUES (
  'grimm-015',
  'Hänsel und Gretel',
  'grimm',
  'de',
  'Hansel and Gretel',
  'Deutschland',
  6,
  16,
  '["Abenteuer", "Mut", "Geschwisterliebe"]',
  'Geschwisterliebe und Mut überwinden das Böse',
  'Zwei Geschwister werden im Wald ausgesetzt, finden ein Lebkuchenhaus und müssen sich vor einer bösen Hexe retten.',
  true
);

INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, profession_preference)
VALUES
  ('grimm-015', 'protagonist', 'Hänsel', 1, 'Mutiger Junge', true, '["Kind", "Held", "Junge"]'),
  ('grimm-015', 'protagonist', 'Gretel', 1, 'Cleveres Mädchen', true, '["Kind", "Heldin", "Mädchen"]'),
  ('grimm-015', 'antagonist', 'Hexe', 1, 'Böse Hexe die Kinder frisst', true, '["Hexe", "Bösewicht"]'),
  ('grimm-015', 'antagonist', 'Stiefmutter', 1, 'Böse Stiefmutter', true, '["Stiefmutter", "Erwachsene"]'),
  ('grimm-015', 'supporting', 'Vater', 1, 'Schwacher aber liebender Vater', true, '["Vater", "Erwachsene", "Holzfäller"]');

INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, character_variables, setting, mood, duration_seconds)
VALUES
  ('grimm-015', 1, 'Die Hungersnot',
   'Eine große Hungersnot herrscht. Die böse [STIEFMUTTER] sagt zum [VATER]: "Wir haben nicht genug zu essen! Wir müssen [HÄNSEL] und [GRETEL] im Wald aussetzen!" Der [VATER] ist traurig, aber er gibt nach.',
   '{"ANTAGONIST": "STIEFMUTTER", "SUPPORTING": "VATER", "PROTAGONIST1": "HÄNSEL", "PROTAGONIST2": "GRETEL"}',
   'Arme Hütte', 'verzweifelt', 80),

  ('grimm-015', 2, 'Die weißen Kieselsteine',
   '[HÄNSEL] belauscht den Plan! Nachts sammelt er weiße Kieselsteine, die im Mondlicht glänzen. Am nächsten Tag, als sie in den Wald gehen, lässt [HÄNSEL] heimlich die Steine fallen - einen nach dem anderen.',
   '{"PROTAGONIST1": "HÄNSEL"}',
   'Wald', 'clever', 85),

  ('grimm-015', 3, 'Die erste Rettung',
   'Die Eltern lassen die Kinder allein zurück. Aber [HÄNSEL] und [GRETEL] folgen den glänzenden Kieselsteinen zurück nach Hause! Die [STIEFMUTTER] ist wütend. Der [VATER] ist heimlich froh.',
   '{"PROTAGONIST1": "HÄNSEL", "PROTAGONIST2": "GRETEL", "ANTAGONIST": "STIEFMUTTER", "SUPPORTING": "VATER"}',
   'Wald und Hütte', 'triumphierend', 75),

  ('grimm-015', 4, 'Die Brotkrumen',
   'Die [STIEFMUTTER] sperrt die Tür ab - [HÄNSEL] kann keine Steine mehr sammeln! Beim zweiten Mal streut er Brotkrumen aus. Aber die Vögel fressen sie auf! [HÄNSEL] und [GRETEL] verirren sich hoffnungslos im Wald.',
   '{"PROTAGONIST1": "HÄNSEL", "PROTAGONIST2": "GRETEL", "ANTAGONIST": "STIEFMUTTER"}',
   'Tiefer Wald', 'verzweifelt', 90),

  ('grimm-015', 5, 'Das Lebkuchenhaus',
   'Nach drei Tagen finden [HÄNSEL] und [GRETEL] ein wundersames Häuschen aus Lebkuchen, Kuchen und Zuckerwerk! Sie sind so hungrig und beginnen zu knabbern. "Knusper, knusper, Knäuschen, wer knuspert an meinem Häuschen?"',
   '{"PROTAGONIST1": "HÄNSEL", "PROTAGONIST2": "GRETEL"}',
   'Lichtung', 'staunend', 85),

  ('grimm-015', 6, 'Die böse Hexe',
   'Eine alte [HEXE] kommt heraus. Sie scheint freundlich: "Kommt herein, liebe Kinder!" Aber sie ist böse! Sie sperrt [HÄNSEL] in einen Käfig: "Ich werde dich mästen und dann fressen!" [GRETEL] muss arbeiten.',
   '{"PROTAGONIST1": "HÄNSEL", "PROTAGONIST2": "GRETEL", "ANTAGONIST": "HEXE"}',
   'Hexenhaus', 'gruselig', 95),

  ('grimm-015', 7, 'Gretels List',
   'Die [HEXE] will [HÄNSEL] essen! Sie heizt den Ofen: "Krieche hinein und prüfe, ob er heiß genug ist!" befiehlt sie [GRETEL]. Aber das clevere [GRETEL] sagt: "Ich weiß nicht wie. Zeig es mir!" Als die [HEXE] sich vorbeugt, schubst [GRETEL] sie in den Ofen!',
   '{"PROTAGONIST2": "GRETEL", "ANTAGONIST": "HEXE"}',
   'Hexenhaus', 'spannend', 100),

  ('grimm-015', 8, 'Die Heimkehr',
   '[GRETEL] befreit [HÄNSEL]! Sie finden Truhen voller Perlen und Edelsteine. Ein weißer Schwan trägt sie über das Wasser. Sie kehren nach Hause zurück - die [STIEFMUTTER] ist tot, der [VATER] überglücklich! Sie sind reich und leben glücklich.',
   '{"PROTAGONIST1": "HÄNSEL", "PROTAGONIST2": "GRETEL", "SUPPORTING": "VATER"}',
   'Heimweg und Hütte', 'freudig', 90);

-- 17. ROTKÄPPCHEN

INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
VALUES (
  'grimm-026',
  'Rotkäppchen',
  'grimm',
  'de',
  'Little Red Riding Hood',
  'Deutschland',
  5,
  12,
  '["Moral", "Abenteuer", "Tiere"]',
  'Höre auf Warnungen und vertraue nicht Fremden',
  'Ein kleines Mädchen mit roter Kappe besucht ihre Großmutter und begegnet einem bösen Wolf, der sie und die Großmutter verschlingt.',
  true
);

INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, profession_preference)
VALUES
  ('grimm-026', 'protagonist', 'Rotkäppchen', 1, 'Kleines Mädchen mit roter Kappe', true, '["Kind", "Mädchen"]'),
  ('grimm-026', 'antagonist', 'Wolf', 1, 'Böser hungriger Wolf', true, '["Wolf", "Tier", "Bösewicht"]'),
  ('grimm-026', 'supporting', 'Großmutter', 1, 'Kranke alte Frau', true, '["Großmutter", "Erwachsene"]'),
  ('grimm-026', 'helper', 'Jäger', 1, 'Tapferer Jäger', true, '["Jäger", "Erwachsene", "Held"]'),
  ('grimm-026', 'supporting', 'Mutter', 1, 'Rotkäppchens Mutter', false, '["Mutter", "Erwachsene"]');

INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, character_variables, setting, mood, duration_seconds)
VALUES
  ('grimm-026', 1, 'Der Auftrag',
   'Die [MUTTER] sagt zu [ROTKÄPPCHEN]: "Deine [GROßMUTTER] ist krank. Bring ihr diesen Korb mit Kuchen und Wein. Aber bleib auf dem Weg und rede nicht mit Fremden!" [ROTKÄPPCHEN] verspricht es.',
   '{"PROTAGONIST": "ROTKÄPPCHEN", "SUPPORTING1": "MUTTER", "SUPPORTING2": "GROßMUTTER"}',
   'Haus', 'fürsorglich', 70),

  ('grimm-026', 2, 'Die Begegnung im Wald',
   'Im Wald trifft [ROTKÄPPCHEN] den [WOLF]. "Wohin gehst du, kleines Mädchen?" - "Zu meiner [GROßMUTTER]." Der [WOLF] ist schlau: "Schau die schönen Blumen! Pflück deiner Großmutter einen Strauß!" [ROTKÄPPCHEN] vergisst die Warnung.',
   '{"PROTAGONIST": "ROTKÄPPCHEN", "ANTAGONIST": "WOLF"}',
   'Wald', 'täuschend', 85),

  ('grimm-026', 3, 'Der Wolf bei der Großmutter',
   'Während [ROTKÄPPCHEN] Blumen pflückt, rennt der [WOLF] zum Haus der [GROßMUTTER]. "Wer ist da?" - "Rotkäppchen!" lügt der [WOLF] mit verstellter Stimme. Er stürmt herein und verschluckt die [GROßMUTTER] in einem Happs!',
   '{"ANTAGONIST": "WOLF", "SUPPORTING": "GROßMUTTER"}',
   'Großmutters Haus', 'erschreckend', 80),

  ('grimm-026', 4, 'Die Verkleidung',
   'Der [WOLF] zieht die Nachthaube und das Nachthemd der [GROßMUTTER] an und legt sich ins Bett. Er wartet auf [ROTKÄPPCHEN].',
   '{"ANTAGONIST": "WOLF"}',
   'Großmutters Schlafzimmer', 'unheimlich', 60),

  ('grimm-026', 5, 'Ei, Großmutter...',
   '[ROTKÄPPCHEN] kommt an. "Ei, [GROßMUTTER], was hast du für große Ohren!" - "Damit ich dich besser hören kann!" - "Ei, was hast du für große Augen!" - "Damit ich dich besser sehen kann!" - "Ei, was hast du für große Hände!" - "Damit ich dich besser packen kann!" - "Aber Großmutter, was hast du für ein entsetzlich großes Maul!" - "Damit ich dich besser fressen kann!"',
   '{"PROTAGONIST": "ROTKÄPPCHEN", "ANTAGONIST": "WOLF"}',
   'Großmutters Schlafzimmer', 'gruselig', 95),

  ('grimm-026', 6, 'Der Wolf frisst',
   'Der [WOLF] springt aus dem Bett und verschluckt [ROTKÄPPCHEN] mit einem Happs! Dann legt er sich wieder ins Bett, satt und zufrieden, und schnarcht laut.',
   '{"ANTAGONIST": "WOLF", "PROTAGONIST": "ROTKÄPPCHEN"}',
   'Großmutters Schlafzimmer', 'dramatisch', 70),

  ('grimm-026', 7, 'Der Jäger',
   'Ein [JÄGER] kommt vorbei und hört das laute Schnarchen. "So laut schnarcht die alte Frau nicht!" Er geht hinein und sieht den [WOLF] mit dickem Bauch. "Da bist du, alter Sünder! Die Großmutter ist wohl noch zu retten!"',
   '{"HELPER": "JÄGER", "ANTAGONIST": "WOLF"}',
   'Großmutters Haus', 'hoffnungsvoll', 75),

  ('grimm-026', 8, 'Die Rettung',
   'Der [JÄGER] schneidet dem schlafenden [WOLF] den Bauch auf. [ROTKÄPPCHEN] und die [GROßMUTTER] springen heraus! Sie füllen dem [WOLF] den Bauch mit Steinen. Als er aufwacht und weglaufen will, fallen die Steine ihn tot um. [ROTKÄPPCHEN] hat gelernt: "Ich werde nie wieder vom Weg abgehen!"',
   '{"HELPER": "JÄGER", "PROTAGONIST": "ROTKÄPPCHEN", "SUPPORTING": "GROßMUTTER", "ANTAGONIST": "WOLF"}',
   'Großmutters Haus', 'erlösend', 90);

-- 18. DIE BREMER STADTMUSIKANTEN

INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
VALUES (
  'grimm-027',
  'Die Bremer Stadtmusikanten',
  'grimm',
  'de',
  'The Town Musicians of Bremen',
  'Deutschland',
  5,
  14,
  '["Tiere", "Abenteuer", "Teamwork"]',
  'Zusammen sind wir stark',
  'Vier alte Tiere - Esel, Hund, Katze und Hahn - werden von ihren Besitzern verstoßen. Gemeinsam ziehen sie nach Bremen und vertreiben Räuber aus einem Haus.',
  true
);

INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, profession_preference)
VALUES
  ('grimm-027', 'protagonist', 'Esel', 1, 'Alter aber kluger Esel', true, '["Esel", "Tier"]'),
  ('grimm-027', 'protagonist', 'Hund', 1, 'Treuer alter Jagdhund', true, '["Hund", "Tier"]'),
  ('grimm-027', 'protagonist', 'Katze', 1, 'Alte Katze', true, '["Katze", "Tier"]'),
  ('grimm-027', 'protagonist', 'Hahn', 1, 'Alter Hahn', true, '["Hahn", "Vogel", "Tier"]'),
  ('grimm-027', 'antagonist', 'Räuber', 4, 'Böse Räuberbande', true, '["Räuber", "Bösewicht"]');

INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, character_variables, setting, mood, duration_seconds)
VALUES
  ('grimm-027', 1, 'Der Esel läuft weg',
   'Der [ESEL] ist alt geworden. Sein Herr will ihn loswerden. Der [ESEL] hört es und denkt: "Ich gehe nach Bremen und werde Stadtmusikant!" Er macht sich auf den Weg.',
   '{"PROTAGONIST1": "ESEL"}',
   'Bauernhof', 'entschlossen', 70),

  ('grimm-027', 2, 'Der Hund schließt sich an',
   'Unterwegs trifft der [ESEL] einen [HUND], der erschöpft am Wegrand liegt. "Ich bin zu alt zum Jagen. Mein Herr wollte mich erschlagen!" - "Komm mit nach Bremen!", sagt der [ESEL]. "Wir werden Musikanten!" Der [HUND] ist begeistert.',
   '{"PROTAGONIST1": "ESEL", "PROTAGONIST2": "HUND"}',
   'Landstraße', 'hoffnungsvoll', 75),

  ('grimm-027', 3, 'Die Katze kommt dazu',
   'Eine traurige [KATZE] sitzt am Weg. "Ich bin alt und fange keine Mäuse mehr. Die Bäuerin wollte mich ertränken!" - "Komm mit uns nach Bremen!", rufen [ESEL] und [HUND]. "Wir machen Musik!" Die [KATZE] schnurrt vor Freude.',
   '{"PROTAGONIST1": "ESEL", "PROTAGONIST2": "HUND", "PROTAGONIST3": "KATZE"}',
   'Dorf', 'fröhlich', 75),

  ('grimm-027', 4, 'Der Hahn vervollständigt die Gruppe',
   'Ein [HAHN] sitzt auf einem Tor und kräht aus Leibeskräften. "Morgen bin ich Suppenhuhn!" jammert er. "Komm mit!", rufen die drei. "Wir ziehen nach Bremen!" Der [HAHN] flattert zu ihnen herab. Nun sind sie vier!',
   '{"PROTAGONIST1": "ESEL", "PROTAGONIST2": "HUND", "PROTAGONIST3": "KATZE", "PROTAGONIST4": "HAHN"}',
   'Bauernhof', 'vereint', 80),

  ('grimm-027', 5, 'Das Räuberhaus',
   'Die vier werden müde. Da sehen sie ein Licht - ein Haus! Der [ESEL] schaut durchs Fenster: [RÄUBER] sitzen am Tisch voller Essen und Schätze! "Wenn wir das Haus hätten!", seufzt der [ESEL].',
   '{"PROTAGONIST1": "ESEL", "PROTAGONIST2": "HUND", "PROTAGONIST3": "KATZE", "PROTAGONIST4": "HAHN", "ANTAGONIST": "RÄUBER"}',
   'Wald bei Nacht', 'begierig', 75),

  ('grimm-027', 6, 'Die Pyramide',
   'Die vier haben einen Plan! Der [ESEL] stellt sich ans Fenster, der [HUND] springt auf seinen Rücken, die [KATZE] auf den Hund, der [HAHN] auf die Katze. Dann beginnen sie alle zusammen zu "musizieren": "I-A! Wau-wau! Miau! Kikeriki!"',
   '{"PROTAGONIST1": "ESEL", "PROTAGONIST2": "HUND", "PROTAGONIST3": "KATZE", "PROTAGONIST4": "HAHN"}',
   'Vor dem Räuberhaus', 'komisch', 85),

  ('grimm-027', 7, 'Die Flucht der Räuber',
   'Der schreckliche Lärm erschreckt die [RÄUBER] zu Tode! "Ein Gespenst!", schreien sie und rennen panisch in den Wald. Die vier Tiere stürmen ins Haus und machen es sich gemütlich.',
   '{"PROTAGONIST1": "ESEL", "PROTAGONIST2": "HUND", "PROTAGONIST3": "KATZE", "PROTAGONIST4": "HAHN", "ANTAGONIST": "RÄUBER"}',
   'Räuberhaus', 'triumphierend', 80),

  ('grimm-027', 8, 'Der Späher',
   'Später schicken die [RÄUBER] einen Späher zurück. Im Dunkeln kratzt ihn die [KATZE], beißt ihn der [HUND], tritt ihn der [ESEL], und der [HAHN] kräht: "Kikeriki!" Der Räuber rennt weg: "Eine Hexe, ein Riese und ein Richter mit Messer!" Die [RÄUBER] kommen nie zurück. Die vier Musikanten leben glücklich im Haus - Bremen haben sie nie erreicht!',
   '{"PROTAGONIST1": "ESEL", "PROTAGONIST2": "HUND", "PROTAGONIST3": "KATZE", "PROTAGONIST4": "HAHN", "ANTAGONIST": "RÄUBER"}',
   'Räuberhaus', 'glücklich', 95);
