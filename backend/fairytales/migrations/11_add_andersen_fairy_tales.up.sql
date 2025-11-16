-- Migration 11: Add 8 Andersen Fairy Tales
-- Adds andersen-002 through andersen-008, and andersen-016
-- (andersen-001 was already added in migration 10)

-- =====================================================
-- ANDERSEN FAIRY TALES (8 tales)
-- =====================================================

-- 2. DAS HÄSSLICHE ENTLEIN

INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
VALUES (
  'andersen-002',
  'Das hässliche Entlein',
  'andersen',
  'da',
  'The Ugly Duckling',
  'Dänemark',
  5,
  12,
  '["Tier", "Selbstakzeptanz", "Transformation"]',
  'Jeder ist einzigartig und wertvoll',
  'Ein vermeintlich hässliches Entlein wird von allen verspottet, bis es entdeckt, dass es in Wahrheit ein wunderschöner Schwan ist.',
  true
);

INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, profession_preference)
VALUES
  ('andersen-002', 'protagonist', 'Hässliches Entlein', 1, 'Junges Entlein das anders aussieht', true, '["Ente", "Vogel", "Tier"]'),
  ('andersen-002', 'antagonist', 'Spottende Enten', 3, 'Enten die das Entlein verspotten', true, '["Ente", "Vogel", "Tier"]'),
  ('andersen-002', 'supporting', 'Entenmutter', 1, 'Mutter die das Entlein ausbrütet', false, '["Ente", "Mutter", "Tier"]'),
  ('andersen-002', 'supporting', 'Bauernfamilie', 2, 'Menschen auf dem Bauernhof', false, '["Bauer", "Erwachsene"]'),
  ('andersen-002', 'helper', 'Schwäne', 3, 'Wunderschöne Schwäne am See', true, '["Schwan", "Vogel", "Tier"]');

INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, character_variables, setting, mood, duration_seconds)
VALUES
  ('andersen-002', 1, 'Das seltsame Ei',
   'Die [ENTENMUTTER] brütet ihre Eier aus. Das letzte und größte Ei braucht am längsten. Endlich schlüpft ein großes, graues Entlein - ganz anders als die anderen!',
   '{"SUPPORTING": "ENTENMUTTER", "PROTAGONIST": "HÄSSLICHES_ENTLEIN"}',
   'Bauernhof', 'überrascht', 75),

  ('andersen-002', 2, 'Die Ablehnung',
   'Alle [ENTEN] auf dem Hof verspotten das [HÄSSLICHE_ENTLEIN]: "Du bist viel zu groß und hässlich!" Selbst seine Geschwister beißen es. Das [ENTLEIN] fühlt sich furchtbar allein.',
   '{"PROTAGONIST": "HÄSSLICHES_ENTLEIN", "ANTAGONIST": "SPOTTENDE_ENTEN"}',
   'Entenhof', 'traurig', 85),

  ('andersen-002', 3, 'Die Flucht',
   'Das [HÄSSLICHE_ENTLEIN] kann die Hänseleien nicht mehr ertragen und läuft davon. Es versteckt sich im Schilf am großen Moor.',
   '{"PROTAGONIST": "HÄSSLICHES_ENTLEIN"}',
   'Moor', 'einsam', 70),

  ('andersen-002', 4, 'Der harte Winter',
   'Das [ENTLEIN] kämpft ums Überleben. Eine [BAUERNFAMILIE] nimmt es auf, aber die Kinder jagen es. Es flieht wieder in die Kälte des Winters.',
   '{"PROTAGONIST": "HÄSSLICHES_ENTLEIN", "SUPPORTING": "BAUERNFAMILIE"}',
   'Bauernhof und Schnee', 'verzweifelt', 90),

  ('andersen-002', 5, 'Die wunderschönen Schwäne',
   'Im Frühling sieht das [ENTLEIN] wunderschöne weiße [SCHWÄNE] auf dem See. Es bewundert sie: "Wie herrlich sie sind!" Es sehnt sich danach, bei ihnen zu sein.',
   '{"PROTAGONIST": "HÄSSLICHES_ENTLEIN", "HELPER": "SCHWÄNE"}',
   'See', 'sehnsuchtsvoll', 80),

  ('andersen-002', 6, 'Die Verwandlung',
   'Das [ENTLEIN] schwimmt zu den [SCHWÄNEN], bereit zu sterben. Doch als es ins Wasser blickt, sieht es sein Spiegelbild - es ist selbst ein wunderschöner Schwan geworden!',
   '{"PROTAGONIST": "HÄSSLICHES_ENTLEIN", "HELPER": "SCHWÄNE"}',
   'See', 'erlösend', 95),

  ('andersen-002', 7, 'Die Anerkennung',
   'Die [SCHWÄNE] begrüßen ihn als einen der ihren. Kinder am Ufer rufen: "Seht den neuen Schwan, er ist der Schönste!" Das frühere [ENTLEIN] ist glücklich, endlich zu wissen, wer es wirklich ist.',
   '{"PROTAGONIST": "HÄSSLICHES_ENTLEIN", "HELPER": "SCHWÄNE"}',
   'See', 'triumphierend', 75);

-- 3. DIE SCHNEEKÖNIGIN

INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
VALUES (
  'andersen-003',
  'Die Schneekönigin',
  'andersen',
  'da',
  'The Snow Queen',
  'Dänemark',
  8,
  20,
  '["Fantasy", "Abenteuer", "Freundschaft"]',
  'Wahre Freundschaft und Liebe besiegen alles',
  'Der kleine Kay wird von der Schneekönigin entführt. Seine Freundin Gerda reist bis ans Ende der Welt, um ihn zu retten.',
  true
);

INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, profession_preference)
VALUES
  ('andersen-003', 'protagonist', 'Gerda', 1, 'Mutiges Mädchen auf der Suche nach Kay', true, '["Kind", "Heldin"]'),
  ('andersen-003', 'supporting', 'Kay', 1, 'Junge der von der Schneekönigin entführt wird', true, '["Kind", "Junge"]'),
  ('andersen-003', 'antagonist', 'Schneekönigin', 1, 'Kalte und mächtige Eiskönigin', true, '["Königin", "Eiszauberin", "Bösewicht"]'),
  ('andersen-003', 'helper', 'Räubermädchen', 1, 'Wildes aber hilfsbereites Mädchen', false, '["Kind", "Räuber"]'),
  ('andersen-003', 'helper', 'Prinzessin und Prinz', 2, 'Fürstenpaar das Gerda hilft', false, '["Prinzessin", "Prinz"]'),
  ('andersen-003', 'helper', 'Rentier', 1, 'Treues Rentier das Gerda trägt', false, '["Rentier", "Tier"]');

INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, character_variables, setting, mood, duration_seconds)
VALUES
  ('andersen-003', 1, 'Der Zauberspiegel',
   'Ein böser Troll erschafft einen Spiegel, der alles Gute hässlich macht. Der Spiegel zerbricht und seine Splitter fliegen durch die Welt. Ein Splitter trifft [KAY] ins Auge und ins Herz.',
   '{"SUPPORTING": "KAY"}',
   'Stadt', 'unheilvoll', 85),

  ('andersen-003', 2, 'Die Entführung',
   'Die [SCHNEEKÖNIGIN] erscheint auf ihrem Schlitten. Der verzauberte [KAY] bindet seinen Schlitten an ihren und wird weit fort in den eisigen Norden entführt. [GERDA] ist verzweifelt.',
   '{"SUPPORTING": "KAY", "ANTAGONIST": "SCHNEEKÖNIGIN", "PROTAGONIST": "GERDA"}',
   'Winterlicher Marktplatz', 'dramatisch', 90),

  ('andersen-003', 3, 'Gerdas Aufbruch',
   '[GERDA] macht sich auf die Suche nach [KAY]. Sie wirft ihre roten Schuhe in den Fluss als Opfer und steigt in ein Boot, das sie zu einer alten Frau bringt.',
   '{"PROTAGONIST": "GERDA"}',
   'Fluss', 'entschlossen', 80),

  ('andersen-003', 4, 'Im Schloss',
   '[GERDA] kommt zu einem Schloss, wo eine [PRINZESSIN] und ein [PRINZ] leben. Sie hofft, [KAY] gefunden zu haben, aber es ist ein anderer Junge. Das Fürstenpaar gibt ihr warme Kleider und eine goldene Kutsche.',
   '{"PROTAGONIST": "GERDA", "HELPER": "PRINZESSIN"}',
   'Schloss', 'hoffnungsvoll', 85),

  ('andersen-003', 5, 'Das Räubermädchen',
   'Räuber überfallen die Kutsche. Das [RÄUBERMÄDCHEN] gefällt [GERDA] und lässt sie am Leben. Sie erfährt von Tauben, dass [KAY] bei der [SCHNEEKÖNIGIN] ist. Das [RENTIER] soll [GERDA] nach Lappland tragen.',
   '{"PROTAGONIST": "GERDA", "HELPER1": "RÄUBERMÄDCHEN", "HELPER2": "RENTIER"}',
   'Räuberhöhle', 'wild', 95),

  ('andersen-003', 6, 'Im Eispalast',
   '[GERDA] und das [RENTIER] erreichen den Palast der [SCHNEEKÖNIGIN]. [GERDA] findet [KAY], der gefühllos Eispuzzle legt. Die [SCHNEEKÖNIGIN] ist fort.',
   '{"PROTAGONIST": "GERDA", "SUPPORTING": "KAY", "HELPER": "RENTIER"}',
   'Eispalast', 'eiskalt', 90),

  ('andersen-003', 7, 'Die Erlösung',
   '[GERDA] weint vor Freude über [KAY]. Ihre warmen Tränen schmelzen den Eissplitter in seinem Herzen. [KAY] erwacht aus dem Zauber und weint - der Splitter im Auge wird herausgespült!',
   '{"PROTAGONIST": "GERDA", "SUPPORTING": "KAY"}',
   'Eispalast', 'erlösend', 100),

  ('andersen-003', 8, 'Die Heimkehr',
   '[GERDA] und [KAY] kehren gemeinsam nach Hause zurück. Sie sind gewachsen, aber in ihren Herzen sind sie noch immer Kinder. Ihre Freundschaft hat alles überwunden.',
   '{"PROTAGONIST": "GERDA", "SUPPORTING": "KAY"}',
   'Stadt', 'freudig', 75);

-- 4. DÄUMELINCHEN

INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
VALUES (
  'andersen-004',
  'Däumelinchen',
  'andersen',
  'da',
  'Thumbelina',
  'Dänemark',
  5,
  15,
  '["Fantasy", "Abenteuer", "Mut"]',
  'Mut und Hoffnung führen zum Glück',
  'Ein winziges Mädchen nicht größer als ein Daumen erlebt viele Abenteuer, bis sie ihren Platz bei den Blumenelfen findet.',
  true
);

INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, profession_preference)
VALUES
  ('andersen-004', 'protagonist', 'Däumelinchen', 1, 'Winziges Mädchen aus einer Blume', true, '["Kind", "Elfe"]'),
  ('andersen-004', 'antagonist', 'Kröte', 1, 'Hässliche Kröte die Däumelinchen entführt', true, '["Kröte", "Tier", "Bösewicht"]'),
  ('andersen-004', 'antagonist', 'Maikäfer', 1, 'Eitlerer Maikäfer', false, '["Käfer", "Insekt", "Tier"]'),
  ('andersen-004', 'antagonist', 'Feldmaus', 1, 'Praktische Feldmaus die Däumelinchen verheiraten will', false, '["Maus", "Tier"]'),
  ('andersen-004', 'supporting', 'Maulwurf', 1, 'Reicher aber blinder Maulwurf', false, '["Maulwurf", "Tier"]'),
  ('andersen-004', 'helper', 'Schwalbe', 1, 'Verletzte Schwalbe die Däumelinchen rettet', true, '["Schwalbe", "Vogel", "Tier"]'),
  ('andersen-004', 'love_interest', 'Blumenprinz', 1, 'Kleiner Prinz der Blumenelfen', true, '["Prinz", "Elfe"]');

INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, character_variables, setting, mood, duration_seconds)
VALUES
  ('andersen-004', 1, 'Die Geburt',
   'Eine Frau pflanzt ein Zauberkorn. Daraus wächst eine wunderschöne Blume. Als sie sich öffnet, sitzt darin ein winziges Mädchen, nicht größer als ein Daumen - [DÄUMELINCHEN]!',
   '{"PROTAGONIST": "DÄUMELINCHEN"}',
   'Haus', 'wundersam', 75),

  ('andersen-004', 2, 'Die Kröte',
   'Eine hässliche [KRÖTE] sieht [DÄUMELINCHEN] schlafen und denkt: "Eine perfekte Frau für meinen Sohn!" Sie entführt [DÄUMELINCHEN] auf ein Seerosenblatt.',
   '{"PROTAGONIST": "DÄUMELINCHEN", "ANTAGONIST": "KRÖTE"}',
   'Teich', 'beängstigend', 80),

  ('andersen-004', 3, 'Die Flucht mit den Fischen',
   '[DÄUMELINCHEN] weint so herzzerreißend, dass die Fische Mitleid haben. Sie nagen das Seerosenblatt ab, und [DÄUMELINCHEN] treibt davon. Ein Schmetterling zieht sie ans Ufer.',
   '{"PROTAGONIST": "DÄUMELINCHEN"}',
   'Bach', 'befreiend', 75),

  ('andersen-004', 4, 'Der Maikäfer',
   'Ein [MAIKÄFER] fliegt mit [DÄUMELINCHEN] in einen Baum. Doch die anderen Käfer finden sie hässlich: "Sie hat nur zwei Beine!" Der [MAIKÄFER] setzt sie im Wald ab.',
   '{"PROTAGONIST": "DÄUMELINCHEN", "ANTAGONIST": "MAIKÄFER"}',
   'Baum', 'verletzend', 80),

  ('andersen-004', 5, 'Bei der Feldmaus',
   'Im Winter findet [DÄUMELINCHEN] Unterschlupf bei einer [FELDMAUS]. Die [FELDMAUS] will sie mit ihrem Nachbarn, dem reichen [MAULWURF], verheiraten. [DÄUMELINCHEN] ist unglücklich.',
   '{"PROTAGONIST": "DÄUMELINCHEN", "ANTAGONIST": "FELDMAUS", "SUPPORTING": "MAULWURF"}',
   'Mauseloch', 'bedrückend', 90),

  ('andersen-004', 6, 'Die verletzte Schwalbe',
   '[DÄUMELINCHEN] findet eine verletzte [SCHWALBE] im Gang des [MAULWURFS]. Sie pflegt den Vogel den ganzen Winter. Im Frühling ist die [SCHWALBE] gesund.',
   '{"PROTAGONIST": "DÄUMELINCHEN", "HELPER": "SCHWALBE"}',
   'Unterirdischer Gang', 'fürsorglich', 85),

  ('andersen-004', 7, 'Die Flucht',
   'Am Tag der Hochzeit mit dem [MAULWURF] erscheint die [SCHWALBE]: "Komm mit mir!" [DÄUMELINCHEN] klettert auf ihren Rücken und sie fliegen in warme Länder.',
   '{"PROTAGONIST": "DÄUMELINCHEN", "HELPER": "SCHWALBE"}',
   'Himmel', 'befreiend', 90),

  ('andersen-004', 8, 'Das Blumenreich',
   'Die [SCHWALBE] setzt [DÄUMELINCHEN] auf eine weiße Blume. Dort lebt ein kleiner [BLUMENPRINZ] mit Flügeln! Er verliebt sich in [DÄUMELINCHEN] und macht sie zur Königin der Blumen.',
   '{"PROTAGONIST": "DÄUMELINCHEN", "LOVE_INTEREST": "BLUMENPRINZ"}',
   'Blumengarten', 'verzaubernd', 85);

-- 5. DES KAISERS NEUE KLEIDER

INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
VALUES (
  'andersen-005',
  'Des Kaisers neue Kleider',
  'andersen',
  'da',
  'The Emperor''s New Clothes',
  'Dänemark',
  6,
  10,
  '["Humor", "Satire", "Moral"]',
  'Ehrlichkeit ist wichtiger als Eitelkeit',
  'Ein eitler Kaiser wird von zwei Betrügern ausgetrickst, die vorgeben, unsichtbare Kleider zu weben. Nur ein Kind traut sich, die Wahrheit zu sagen.',
  true
);

INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, profession_preference)
VALUES
  ('andersen-005', 'protagonist', 'Kaiser', 1, 'Eitler Herrscher der Mode liebt', true, '["Kaiser", "König", "Adeliger"]'),
  ('andersen-005', 'antagonist', 'Betrüger', 2, 'Zwei falsche Weber', true, '["Betrüger", "Dieb", "Schwindler"]'),
  ('andersen-005', 'supporting', 'Minister', 2, 'Hofbeamte des Kaisers', true, '["Minister", "Berater", "Adeliger"]'),
  ('andersen-005', 'helper', 'Kind', 1, 'Ehrliches Kind das die Wahrheit sagt', true, '["Kind"]'),
  ('andersen-005', 'supporting', 'Volk', 3, 'Bürger der Stadt', false, '["Bürger", "Erwachsene"]');

INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, character_variables, setting, mood, duration_seconds)
VALUES
  ('andersen-005', 1, 'Der eitle Kaiser',
   'Der [KAISER] interessiert sich nur für schöne Kleider. Er gibt sein ganzes Geld für Mode aus und wechselt jede Stunde sein Gewand.',
   '{"PROTAGONIST": "KAISER"}',
   'Palast', 'prunkvoll', 70),

  ('andersen-005', 2, 'Die falschen Weber',
   'Zwei [BETRÜGER] kommen zum [KAISER]: "Wir können Stoff weben, der für dumme Menschen unsichtbar ist!" Der [KAISER] ist begeistert und beauftragt sie.',
   '{"PROTAGONIST": "KAISER", "ANTAGONIST": "BETRÜGER"}',
   'Thronsaal', 'listig', 80),

  ('andersen-005', 3, 'Die leeren Webstühle',
   'Die [BETRÜGER] tun so, als würden sie weben, aber die Webstühle sind leer. Sie fordern Gold und Seide und stecken alles in ihre Taschen.',
   '{"ANTAGONIST": "BETRÜGER"}',
   'Webstube', 'betrügerisch', 75),

  ('andersen-005', 4, 'Der erste Minister',
   'Der [KAISER] schickt einen [MINISTER] zur Kontrolle. Der [MINISTER] sieht nichts, denkt aber: "Ich darf nicht dumm erscheinen!" Also lobt er den prächtigen Stoff.',
   '{"SUPPORTING": "MINISTER", "ANTAGONIST": "BETRÜGER"}',
   'Webstube', 'verlegen', 85),

  ('andersen-005', 5, 'Der Kaiser sieht nichts',
   'Der [KAISER] selbst kommt. Er sieht nichts, traut sich aber nicht, es zuzugeben. "Herrlich! Wunderschön!", lügt er.',
   '{"PROTAGONIST": "KAISER", "ANTAGONIST": "BETRÜGER"}',
   'Webstube', 'peinlich', 80),

  ('andersen-005', 6, 'Die Prozession',
   'Die [BETRÜGER] tun so, als würden sie den [KAISER] ankleiden. Der [KAISER] geht nackt durch die Stadt! Das [VOLK] jubelt und lobt die "Kleider", denn niemand will dumm erscheinen.',
   '{"PROTAGONIST": "KAISER", "SUPPORTING": "VOLK"}',
   'Straßen', 'absurd', 90),

  ('andersen-005', 7, 'Die Wahrheit',
   'Ein kleines [KIND] ruft plötzlich: "Aber der Kaiser hat ja gar nichts an!" Die Wahrheit verbreitet sich. Der [KAISER] spürt, dass alle recht haben, aber er läuft mit noch mehr Würde weiter.',
   '{"PROTAGONIST": "KAISER", "HELPER": "KIND", "SUPPORTING": "VOLK"}',
   'Straßen', 'entlarvend', 85);

-- 6. DIE PRINZESSIN AUF DER ERBSE

INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
VALUES (
  'andersen-006',
  'Die Prinzessin auf der Erbse',
  'andersen',
  'da',
  'The Princess and the Pea',
  'Dänemark',
  5,
  8,
  '["Humor", "Romantik", "Märchen"]',
  'Wahre Vornehmheit zeigt sich in Feinfühligkeit',
  'Ein Prinz sucht eine echte Prinzessin. Eine durchnässte Fremde behauptet, eine Prinzessin zu sein. Eine Erbse unter zwanzig Matratzen wird sie auf die Probe stellen.',
  true
);

INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, profession_preference)
VALUES
  ('andersen-006', 'protagonist', 'Prinz', 1, 'Junger Prinz auf Brautsuche', true, '["Prinz", "Adeliger"]'),
  ('andersen-006', 'love_interest', 'Prinzessin', 1, 'Durchnässte Fremde die behauptet Prinzessin zu sein', true, '["Prinzessin"]'),
  ('andersen-006', 'supporting', 'Alte Königin', 1, 'Mutter des Prinzen die den Test durchführt', true, '["Königin", "Mutter"]'),
  ('andersen-006', 'supporting', 'König', 1, 'Vater des Prinzen', false, '["König", "Vater"]');

INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, character_variables, setting, mood, duration_seconds)
VALUES
  ('andersen-006', 1, 'Die Suche',
   'Der [PRINZ] reist um die ganze Welt, um eine echte Prinzessin zu finden. Er trifft viele, aber keine ist echt genug. Traurig kehrt er nach Hause zurück.',
   '{"PROTAGONIST": "PRINZ"}',
   'Verschiedene Königreiche', 'sehnsuchtsvoll', 75),

  ('andersen-006', 2, 'Der Sturm',
   'Ein schrecklicher Sturm tobt. Es donnert und blitzt, und der Regen prasselt herab. Plötzlich klopft jemand am Stadttor.',
   '{}',
   'Vor dem Schloss', 'stürmisch', 60),

  ('andersen-006', 3, 'Die durchnässte Fremde',
   'Ein völlig durchnässtes Mädchen steht vor der Tür. Wasser tropft von ihren Haaren und Kleidern. Aber sie behauptet: "Ich bin eine echte Prinzessin!"',
   '{"LOVE_INTEREST": "PRINZESSIN"}',
   'Schlosstor', 'mysteriös', 70),

  ('andersen-006', 4, 'Der geheime Test',
   'Die [ALTE_KÖNIGIN] denkt: "Das werden wir ja sehen!" Sie legt heimlich eine Erbse aufs Bett und stapelt zwanzig Matratzen und zwanzig Daunendecken darauf.',
   '{"SUPPORTING": "ALTE_KÖNIGIN"}',
   'Gästezimmer', 'listig', 75),

  ('andersen-006', 5, 'Die schlaflose Nacht',
   'Am nächsten Morgen fragt die [KÖNIGIN]: "Wie haben Sie geschlafen?" Die [PRINZESSIN] antwortet: "Furchtbar! Etwas Hartes lag im Bett. Ich habe die ganze Nacht kein Auge zugetan!"',
   '{"LOVE_INTEREST": "PRINZESSIN", "SUPPORTING": "ALTE_KÖNIGIN"}',
   'Frühstückssaal', 'überrascht', 80),

  ('andersen-006', 6, 'Die wahre Prinzessin',
   'Die [KÖNIGIN] ist begeistert: "Nur eine echte Prinzessin könnte so empfindlich sein!" Der [PRINZ] ist überglücklich, endlich eine echte Prinzessin gefunden zu haben.',
   '{"PROTAGONIST": "PRINZ", "LOVE_INTEREST": "PRINZESSIN", "SUPPORTING": "ALTE_KÖNIGIN"}',
   'Schloss', 'freudig', 70),

  ('andersen-006', 7, 'Die Hochzeit',
   'Der [PRINZ] und die [PRINZESSIN] heiraten. Die Erbse wird ins königliche Museum gelegt, wo sie noch heute zu sehen ist - wenn niemand sie gestohlen hat!',
   '{"PROTAGONIST": "PRINZ", "LOVE_INTEREST": "PRINZESSIN"}',
   'Schloss', 'festlich', 60);

-- 7. DIE NACHTIGALL

INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
VALUES (
  'andersen-007',
  'Die Nachtigall',
  'andersen',
  'da',
  'The Nightingale',
  'Dänemark',
  7,
  15,
  '["Moral", "Fantasy", "Natur"]',
  'Natürliche Schönheit ist wertvoller als Künstlichkeit',
  'Der Kaiser von China wird von einer echten Nachtigall verzaubert, ersetzt sie aber durch eine künstliche. Als er todkrank wird, rettet nur die echte Nachtigall sein Leben.',
  true
);

INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, profession_preference)
VALUES
  ('andersen-007', 'protagonist', 'Nachtigall', 1, 'Kleiner Vogel mit wunderschöner Stimme', true, '["Vogel", "Nachtigall", "Tier"]'),
  ('andersen-007', 'supporting', 'Kaiser von China', 1, 'Mächtiger aber einsamer Herrscher', true, '["Kaiser", "König", "Herrscher"]'),
  ('andersen-007', 'antagonist', 'Künstliche Nachtigall', 1, 'Mechanischer Vogel mit Juwelen', true, '["Roboter", "Spielzeug"]'),
  ('andersen-007', 'supporting', 'Küchenmädchen', 1, 'Mädchen das die Nachtigall kennt', false, '["Dienerin", "Kind"]'),
  ('andersen-007', 'antagonist', 'Tod', 1, 'Personifizierter Tod', false, '["Tod", "Geist"]'),
  ('andersen-007', 'supporting', 'Hofstaat', 3, 'Höflinge und Minister', false, '["Minister", "Adeliger"]');

INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, character_variables, setting, mood, duration_seconds)
VALUES
  ('andersen-007', 1, 'Der prächtige Palast',
   'Der [KAISER] von China lebt im prächtigsten Palast der Welt. Besucher schwärmen: "Alles ist wunderbar, aber der Gesang der [NACHTIGALL] im Wald ist das Schönste!"',
   '{"SUPPORTING": "KAISER", "PROTAGONIST": "NACHTIGALL"}',
   'Porzellanpalast', 'prachtvoll', 75),

  ('andersen-007', 2, 'Die Suche',
   'Der [KAISER] befiehlt: "Bringt mir diese [NACHTIGALL]!" Der [HOFSTAAT] sucht verzweifelt. Endlich zeigt ein [KÜCHENMÄDCHEN] ihnen den kleinen grauen Vogel im Wald.',
   '{"SUPPORTING1": "KAISER", "SUPPORTING2": "KÜCHENMÄDCHEN", "PROTAGONIST": "NACHTIGALL"}',
   'Wald', 'suchend', 80),

  ('andersen-007', 3, 'Der Gesang am Hof',
   'Die [NACHTIGALL] singt vor dem [KAISER]. Ihr Lied ist so schön, dass dem [KAISER] Tränen über die Wangen laufen. "Du sollst für immer bei mir bleiben!", sagt er.',
   '{"PROTAGONIST": "NACHTIGALL", "SUPPORTING": "KAISER"}',
   'Thronsaal', 'bezaubernd', 90),

  ('andersen-007', 4, 'Das Geschenk aus Japan',
   'Der Kaiser von Japan schickt eine [KÜNSTLICHE_NACHTIGALL] aus Gold und Diamanten. Sie kann ein Lied singen und bewegt sich wie ein Uhrwerk. Alle bewundern sie mehr als die echte [NACHTIGALL].',
   '{"ANTAGONIST": "KÜNSTLICHE_NACHTIGALL", "PROTAGONIST": "NACHTIGALL", "SUPPORTING": "KAISER"}',
   'Thronsaal', 'oberflächlich', 85),

  ('andersen-007', 5, 'Die Flucht',
   'Die echte [NACHTIGALL] fühlt sich nicht mehr gebraucht und fliegt zurück in den Wald. Der [KAISER] verbietet, sie zu erwähnen. Die [KÜNSTLICHE_NACHTIGALL] singt jeden Abend.',
   '{"PROTAGONIST": "NACHTIGALL", "SUPPORTING": "KAISER", "ANTAGONIST": "KÜNSTLICHE_NACHTIGALL"}',
   'Palast und Wald', 'verlassen', 75),

  ('andersen-007', 6, 'Die Uhr bricht',
   'Nach einem Jahr bricht die [KÜNSTLICHE_NACHTIGALL] zusammen. Sie darf nur noch einmal im Jahr singen. Jahre vergehen. Der [KAISER] wird todkrank. Der [TOD] sitzt auf seiner Brust.',
   '{"SUPPORTING": "KAISER", "ANTAGONIST1": "TOD"}',
   'Schlafgemach', 'bedrohlich', 90),

  ('andersen-007', 7, 'Die Rückkehr',
   'Die echte [NACHTIGALL] kehrt zurück und singt am Fenster. Ihr Lied ist so schön, dass selbst der [TOD] lauscht und schließlich verschwindet. Der [KAISER] ist gerettet!',
   '{"PROTAGONIST": "NACHTIGALL", "SUPPORTING": "KAISER", "ANTAGONIST": "TOD"}',
   'Schlafgemach', 'erlösend', 95),

  ('andersen-007', 8, 'Die Freundschaft',
   'Der [KAISER] will die [NACHTIGALL] wieder im goldenen Käfig halten. Aber sie antwortet: "Ich bleibe frei, aber ich komme jeden Abend und singe für dich." So bleibt sie des [KAISERS] treueste Freundin.',
   '{"PROTAGONIST": "NACHTIGALL", "SUPPORTING": "KAISER"}',
   'Palast', 'friedlich', 70);

-- 8. DER STANDHAFTE ZINNSOLDAT

INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
VALUES (
  'andersen-008',
  'Der standhafte Zinnsoldaten',
  'andersen',
  'da',
  'The Steadfast Tin Soldier',
  'Dänemark',
  6,
  12,
  '["Liebe", "Abenteuer", "Tragisch"]',
  'Wahre Liebe und Standhaftigkeit überdauern alles',
  'Ein einbeiniger Zinnsoldat verliebt sich in eine Papiertänzerin. Er erlebt viele Abenteuer und kehrt am Ende zu seiner Liebe zurück.',
  true
);

INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, profession_preference)
VALUES
  ('andersen-008', 'protagonist', 'Zinnsoldat', 1, 'Einbeiniger Spielzeugsoldat', true, '["Soldat", "Spielzeug"]'),
  ('andersen-008', 'love_interest', 'Papiertänzerin', 1, 'Zierliche Ballerina aus Papier', true, '["Tänzerin", "Ballerina", "Spielzeug"]'),
  ('andersen-008', 'antagonist', 'Schwarzer Kobold', 1, 'Böser Geist aus der Schnupftabakdose', true, '["Kobold", "Teufel", "Spielzeug"]'),
  ('andersen-008', 'supporting', 'Junge', 1, 'Kind dem das Spielzeug gehört', false, '["Kind", "Junge"]'),
  ('andersen-008', 'supporting', 'Ratte', 1, 'Ratte im Kanal', false, '["Ratte", "Tier"]'),
  ('andersen-008', 'supporting', 'Fisch', 1, 'Großer Fisch der den Soldaten verschluckt', false, '["Fisch", "Tier"]');

INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, character_variables, setting, mood, duration_seconds)
VALUES
  ('andersen-008', 1, 'Die Geschenkbox',
   'Ein [JUNGE] bekommt eine Schachtel mit 25 Zinnsoldaten. Der letzte [ZINNSOLDAT] hat nur ein Bein, weil das Zinn nicht reichte. Er steht stolz aufrecht.',
   '{"PROTAGONIST": "ZINNSOLDAT", "SUPPORTING": "JUNGE"}',
   'Kinderzimmer', 'feierlich', 70),

  ('andersen-008', 2, 'Die Liebe auf den ersten Blick',
   'Der [ZINNSOLDAT] sieht ein Pappschloss mit einer [PAPIERTÄNZERIN]. Sie steht auf einem Bein mit ausgestreckten Armen. Der [SOLDAT] denkt: "Sie hat auch nur ein Bein! Sie wäre die perfekte Frau für mich!" Er verliebt sich unsterblich.',
   '{"PROTAGONIST": "ZINNSOLDAT", "LOVE_INTEREST": "PAPIERTÄNZERIN"}',
   'Kinderzimmer', 'verliebt', 85),

  ('andersen-008', 3, 'Der böse Kobold',
   'Ein [SCHWARZER_KOBOLD] springt aus einer Schnupftabakdose: "Du sollst die Tänzerin nicht anstarren!" Doch der [ZINNSOLDAT] bleibt standhaft und ignoriert ihn.',
   '{"PROTAGONIST": "ZINNSOLDAT", "ANTAGONIST": "SCHWARZER_KOBOLD"}',
   'Kinderzimmer', 'bedrohlich', 75),

  ('andersen-008', 4, 'Der Sturz',
   'Am nächsten Morgen steht der [ZINNSOLDAT] am Fenster. Plötzlich - war es der Wind oder der [KOBOLD]? - fällt er aus dem dritten Stock auf die Straße! Er steckt kopfüber zwischen Pflastersteinen.',
   '{"PROTAGONIST": "ZINNSOLDAT"}',
   'Straße', 'dramatisch', 80),

  ('andersen-008', 5, 'Die Reise im Papierboot',
   'Zwei Jungen finden den [ZINNSOLDATEN] und setzen ihn in ein Papierboot. Das Boot treibt in den Rinnstein, dann in den Kanal! Eine [RATTE] schreit: "Zoll zahlen!" Aber der [SOLDAT] fährt standhaft weiter.',
   '{"PROTAGONIST": "ZINNSOLDAT", "SUPPORTING": "RATTE"}',
   'Kanal', 'abenteuerlich', 90),

  ('andersen-008', 6, 'Im Bauch des Fisches',
   'Das Boot sinkt und ein großer [FISCH] verschluckt den [ZINNSOLDATEN]. Es ist dunkel. Der [SOLDAT] bleibt standhaft in seiner Position, das Gewehr an der Schulter.',
   '{"PROTAGONIST": "ZINNSOLDAT", "SUPPORTING": "FISCH"}',
   'Fischmagen', 'dunkel', 70),

  ('andersen-008', 7, 'Die Rückkehr',
   'Der [FISCH] wird gefangen und landet in derselben Küche! Das Dienstmädchen findet den [ZINNSOLDATEN] im Fischbauch. Der [JUNGE] stellt ihn zurück auf den Tisch - direkt vor die [PAPIERTÄNZERIN]!',
   '{"PROTAGONIST": "ZINNSOLDAT", "LOVE_INTEREST": "PAPIERTÄNZERIN", "SUPPORTING": "JUNGE"}',
   'Kinderzimmer', 'wundersam', 85),

  ('andersen-008', 8, 'Das Feuer der Liebe',
   'Plötzlich wirft der [JUNGE] den [ZINNSOLDATEN] ins Feuer - vielleicht war es der [KOBOLD]? Der [SOLDAT] schmilzt, aber schaut standhaft zur [TÄNZERIN]. Ein Windstoß weht sie zu ihm ins Feuer. Am nächsten Tag findet man ein Zinnherz und eine verbrannte Paillette - vereint in der Asche.',
   '{"PROTAGONIST": "ZINNSOLDAT", "LOVE_INTEREST": "PAPIERTÄNZERIN"}',
   'Kamin', 'tragisch', 95);

-- 9. DAS MÄDCHEN MIT DEN SCHWEFELHÖLZERN

INSERT INTO fairy_tales (id, title, source, original_language, english_translation, culture_region, age_recommendation, duration_minutes, genre_tags, moral_lesson, summary, is_active)
VALUES (
  'andersen-016',
  'Das Mädchen mit den Schwefelhölzern',
  'andersen',
  'da',
  'The Little Match Girl',
  'Dänemark',
  8,
  10,
  '["Traurig", "Mitgefühl", "Sozial"]',
  'Mitgefühl mit den Armen und Schwachen',
  'Ein armes Mädchen versucht in der Silvesternacht Schwefelhölzer zu verkaufen. Frierend zündet sie die Hölzer an und hat wunderschöne Visionen, bevor sie friedlich einschläft.',
  true
);

INSERT INTO fairy_tale_roles (tale_id, role_type, role_name, role_count, description, required, profession_preference)
VALUES
  ('andersen-016', 'protagonist', 'Schwefelhölzermädchen', 1, 'Armes kleines Mädchen mit Schwefelhölzern', true, '["Kind", "Armes Mädchen"]'),
  ('andersen-016', 'supporting', 'Großmutter', 1, 'Verstorbene geliebte Großmutter (als Vision)', true, '["Großmutter", "Geist", "Engel"]'),
  ('andersen-016', 'supporting', 'Reiche Leute', 2, 'Gleichgültige Passanten', false, '["Erwachsene", "Reiche"]');

INSERT INTO fairy_tale_scenes (tale_id, scene_number, scene_title, scene_description, character_variables, setting, mood, duration_seconds)
VALUES
  ('andersen-016', 1, 'Die Silvesternacht',
   'Es ist der letzte Abend des Jahres. Ein kleines [MÄDCHEN] läuft barfuß durch die Schneestraßen. Sie trägt Schwefelhölzer, die sie verkaufen soll. Niemand hat ihr heute auch nur eines abgekauft.',
   '{"PROTAGONIST": "SCHWEFELHÖLZERMÄDCHEN"}',
   'Verschneite Straße', 'bitterkalt', 75),

  ('andersen-016', 2, 'Die Angst vor zu Hause',
   'Das [MÄDCHEN] traut sich nicht nach Hause. Der Vater wird sie schlagen, wenn sie kein Geld bringt. Auch zu Hause ist es kalt, denn das Dach hat große Risse.',
   '{"PROTAGONIST": "SCHWEFELHÖLZERMÄDCHEN"}',
   'Straßenecke', 'verzweifelt', 70),

  ('andersen-016', 3, 'Das erste Streichholz',
   'Zitternd vor Kälte zündet das [MÄDCHEN] ein Schwefelholz an. Es brennt warm und hell! In der Flamme sieht sie einen großen eisernen Ofen. Sie streckt die Hände danach aus - doch das Holz erlischt.',
   '{"PROTAGONIST": "SCHWEFELHÖLZERMÄDCHEN"}',
   'Mauerecke', 'sehnsuchtsvoll', 80),

  ('andersen-016', 4, 'Das zweite Streichholz',
   'Das [MÄDCHEN] zündet ein zweites an. Im Licht sieht sie durch die Mauer einen Tisch mit Braten und Gänsebraten. Die Gans springt vom Teller und watschelt zu ihr - dann erlischt das Licht.',
   '{"PROTAGONIST": "SCHWEFELHÖLZERMÄDCHEN"}',
   'Mauerecke', 'hungernd', 80),

  ('andersen-016', 5, 'Der Weihnachtsbaum',
   'Das dritte Holz zeigt einen prächtigen Weihnachtsbaum, noch schöner als der, den sie beim reichen Kaufmann durchs Fenster sah. Tausend Kerzen brennen - das Holz erlischt.',
   '{"PROTAGONIST": "SCHWEFELHÖLZERMÄDCHEN"}',
   'Mauerecke', 'träumend', 75),

  ('andersen-016', 6, 'Die Sternschnuppe',
   'Eine Sternschnuppe fällt. Das [MÄDCHEN] erinnert sich: "Wenn ein Stern fällt, steigt eine Seele zu Gott auf", hatte ihre verstorbene [GROSSMUTTER] gesagt - die Einzige, die sie je liebte.',
   '{"PROTAGONIST": "SCHWEFELHÖLZERMÄDCHEN", "SUPPORTING": "GROSSMUTTER"}',
   'Mauerecke', 'wehmütig', 70),

  ('andersen-016', 7, 'Die Großmutter',
   'Das [MÄDCHEN] zündet ein ganzes Bündel Schwefelhölzer an! Im hellen Licht erscheint die [GROSSMUTTER], strahlend und schön. "Großmutter! Nimm mich mit!", ruft das [MÄDCHEN]. Die [GROSSMUTTER] nimmt sie in die Arme und sie fliegen zusammen ins Licht, dorthin, wo es keinen Hunger, keine Kälte und keine Angst mehr gibt.',
   '{"PROTAGONIST": "SCHWEFELHÖLZERMÄDCHEN", "SUPPORTING": "GROSSMUTTER"}',
   'Mauerecke', 'erlösend', 100),

  ('andersen-016', 8, 'Der Neujahrsmorgen',
   'Am Neujahrsmorgen finden Leute das kleine [MÄDCHEN] erfroren in der Ecke, umgeben von abgebrannten Streichhölzern. "Sie wollte sich wärmen", sagen sie mitleidig. Niemand weiß, welch herrliche Dinge sie gesehen hat und wie glücklich sie mit ihrer [GROSSMUTTER] ins neue Jahr eingegangen ist.',
   '{"PROTAGONIST": "SCHWEFELHÖLZERMÄDCHEN", "SUPPORTING": "GROSSMUTTER"}',
   'Straßenecke', 'friedlich', 80);

-- Initialize usage stats for all new tales
INSERT INTO fairy_tale_usage_stats (tale_id, total_generations, successful_generations)
VALUES
  ('andersen-002', 0, 0),
  ('andersen-003', 0, 0),
  ('andersen-004', 0, 0),
  ('andersen-005', 0, 0),
  ('andersen-006', 0, 0),
  ('andersen-007', 0, 0),
  ('andersen-008', 0, 0),
  ('andersen-016', 0, 0);
