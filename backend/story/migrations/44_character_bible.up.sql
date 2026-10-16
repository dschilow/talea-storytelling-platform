-- Migration 44: the character bible (2026-10-16, "Die Türlaunische").
--
-- The pool characters had a catchphrase, a quirk and a speech style — seasoning. What makes a figure carry a
-- book (Zippel, Pippi, Karlsson, das Sams) is a want, a fear, a secret, a comic pattern that repeats, a gesture a
-- child can imitate, and the permission to cause trouble. These columns hold that bible; book pitches cast the
-- plot engine (a villain with a plan, a guest with a mission) from figures marked can_lead / can_oppose, and the
-- writer gets the bible in the cast sheet so the figure is recognisable from book to book.
--
-- bible_version 0 = not filled yet (the admin endpoint /story/character-pool/enrich-bibles fills missing ones).

ALTER TABLE character_pool
  ADD COLUMN IF NOT EXISTS want TEXT,
  ADD COLUMN IF NOT EXISTS fear TEXT,
  ADD COLUMN IF NOT EXISTS secret TEXT,
  ADD COLUMN IF NOT EXISTS running_gag TEXT,
  ADD COLUMN IF NOT EXISTS gesture TEXT,
  ADD COLUMN IF NOT EXISTS comic_role TEXT,
  ADD COLUMN IF NOT EXISTS can_lead BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_oppose BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS villain_style TEXT CHECK (villain_style IS NULL OR villain_style IN ('comic', 'misunderstood', 'real')),
  ADD COLUMN IF NOT EXISTS intro_line TEXT,
  ADD COLUMN IF NOT EXISTS signature_visual TEXT,
  ADD COLUMN IF NOT EXISTS bible_version INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN character_pool.want IS 'What the figure always wants (drives its moves in any book)';
COMMENT ON COLUMN character_pool.fear IS 'What the figure fears or its sore spot (what the friendship or the finale answers)';
COMMENT ON COLUMN character_pool.secret IS 'What the figure hides at first (the listener may learn it before the heroes)';
COMMENT ON COLUMN character_pool.running_gag IS 'A comic pattern that repeats and escalates (appears, escalates, tips over)';
COMMENT ON COLUMN character_pool.gesture IS 'A gesture or habit a child can imitate; distinct from quirk when both exist';
COMMENT ON COLUMN character_pool.comic_role IS 'know-it-all | boaster | coward | grump | chaos | literalist | schemer | dreamer | fusspot';
COMMENT ON COLUMN character_pool.can_lead IS 'May carry a book as its plot engine (guest with a mission, star of a series)';
COMMENT ON COLUMN character_pool.can_oppose IS 'May be the opposing figure with a plan of its own';
COMMENT ON COLUMN character_pool.villain_style IS 'How it opposes when it does: comic (outwitted), misunderstood (answered), real (beaten)';
COMMENT ON COLUMN character_pool.intro_line IS 'How the figure introduces itself in its own words, usable as its first line';
COMMENT ON COLUMN character_pool.signature_visual IS 'One visual tag that tells the figure apart at a glance in a picture';
COMMENT ON COLUMN character_pool.bible_version IS '0 = bible not filled; 1 = seeded or enriched';

CREATE INDEX IF NOT EXISTS idx_character_pool_can_lead ON character_pool(can_lead) WHERE can_lead = TRUE;
CREATE INDEX IF NOT EXISTS idx_character_pool_can_oppose ON character_pool(can_oppose) WHERE can_oppose = TRUE;

-- ═══════════════════════════════════════════════════════════════════════════
-- Bibles of the 18 original figures (migrations 5 and 20). Written by hand, in the story language.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE character_pool SET
  want = 'dass in ihrem Garten und ihrer Straße alles seinen Platz hat – und dass die Kinder ihr endlich zuhören',
  fear = 'übersehen zu werden, seit niemand mehr an ihrem Zaun stehen bleibt',
  secret = 'sie weiß viel mehr über die seltsamen Dinge in der Nachbarschaft, als sie zugibt – sie hat sie als Kind selbst gesehen',
  running_gag = 'sie gibt einen Rat, der zuerst nach Unsinn klingt (den Wind fragen, den Schal wechseln) und sich jedes Mal später als richtig herausstellt – beim dritten Mal glauben ihr die Kinder sofort, und da ist es ausnahmsweise wirklich Unsinn',
  gesture = 'zieht den grünen Schal fester, bevor sie etwas Wichtiges sagt',
  comic_role = 'know-it-all',
  can_lead = FALSE, can_oppose = FALSE, villain_style = NULL,
  intro_line = 'Ich bin Frau Müller von nebenan, und ich habe das alles schon einmal gesehen. Fast alles.',
  signature_visual = 'green knitted shawl over gray hair bun',
  bible_version = 1
WHERE id = 'char_001_frau_mueller' AND bible_version = 0;

UPDATE character_pool SET
  want = 'alles verstehen, aufschreiben und mit einem Namen versehen – vor allem das, was noch keinen hat',
  fear = 'dass ihm etwas entgeht, während er gerade die Brille sucht',
  secret = 'sein wichtigstes Notizbuch ist seit Jahren leer, weil er vor lauter Staunen nie zum Schreiben kommt',
  running_gag = 'er erfindet für jedes neue Ding sofort ein langes Fachwort, das sich keiner merken kann – die Kinder nennen es anders, und am Ende benutzt er ihr Wort',
  gesture = 'schiebt die runde Brille hoch, die sofort wieder rutscht',
  comic_role = 'know-it-all',
  can_lead = TRUE, can_oppose = FALSE, villain_style = NULL,
  intro_line = 'Professor Lichtweis, Erforscher von allem, was sich bewegt. Und von einigem, was es nicht tut.',
  signature_visual = 'wild white hair, round glasses, colourful vest',
  bible_version = 1
WHERE id = 'char_002_professor_lichtweis' AND bible_version = 0;

UPDATE character_pool SET
  want = 'dass der Wald so bleibt, wie sie ihn seit dreihundert Jahren kennt',
  fear = 'den Winter, in dem niemand mehr unter ihr sitzt und erzählt',
  secret = 'sie kann ihre Wurzeln ein kleines Stück bewegen – und hat damit schon einmal einen Weg verlegt',
  running_gag = 'sie beginnt jede Antwort mit „Als ich noch ein Setzling war …“ und braucht so lange, dass die Kinder die Antwort inzwischen selbst finden – worauf sie zufrieden raschelt, als hätte sie genau das gewollt',
  gesture = 'raschelt mit den Blättern, bevor sie spricht',
  comic_role = 'dreamer',
  can_lead = FALSE, can_oppose = FALSE, villain_style = NULL,
  intro_line = 'Setzt euch. Nein, nicht da – da schlafe ich. Ich bin die Alte Eiche, und ich habe Zeit.',
  signature_visual = 'oak tree with a kind face in the bark and amber eyes',
  bible_version = 1
WHERE id = 'char_003_alte_eiche' AND bible_version = 0;

UPDATE character_pool SET
  want = 'den Wald beschützen, ohne dass ihn jemand dabei beobachtet',
  fear = 'dass sein Geweih eines Tages zu schwer wird, um es hoch zu tragen',
  secret = 'er hat Angst vor Mäusen und würde das nie zugeben',
  running_gag = 'er stellt sich feierlich vor etwas, um es zu beschützen – und jedes Mal ist es das Falsche (ein Pilz, ein Hut, eine Pfütze), während die eigentliche Gefahr hinter ihm vorbeigeht',
  gesture = 'senkt das Geweih zum Gruß',
  comic_role = 'boaster',
  can_lead = FALSE, can_oppose = FALSE, villain_style = NULL,
  intro_line = 'Ich bin Silberhorn. Hinter mich, Kinder. Was auch immer das war.',
  signature_visual = 'deer with silver antlers and a silver shimmer on the fur',
  bible_version = 1
WHERE id = 'char_004_hirsch_silberhorn' AND bible_version = 0;

UPDATE character_pool SET
  want = 'immer schon gewusst haben, was gerade erst passiert',
  fear = 'einmal ehrlich überrascht zu werden – vor Zeugen',
  secret = 'sie hat einen Lieblingsplatz im Haus der Kinder, von dem niemand wissen darf, weil es die Wäschekiste ist',
  running_gag = 'sie behauptet nach jeder Wendung „Wusste ich doch“ – bis sie einmal wirklich etwas vorher weiß und keiner ihr glaubt',
  gesture = 'putzt sich betont gelangweilt eine Pfote',
  comic_role = 'know-it-all',
  can_lead = TRUE, can_oppose = FALSE, villain_style = NULL,
  intro_line = 'Luna. Ich war schon hier, bevor ihr gemerkt habt, dass ihr mich braucht.',
  signature_visual = 'sleek black cat with white paws and green eyes',
  bible_version = 1
WHERE id = 'char_005_luna_die_katze' AND bible_version = 0;

UPDATE character_pool SET
  want = 'dabei sein, egal wobei – und dabei möglichst viele Nüsse unterbringen',
  fear = 'den Winter zu verschlafen und alles zu verpassen',
  secret = 'er hat die Verstecke seiner Nüsse vergessen und markiert deshalb heimlich alles mit Kratzern',
  running_gag = 'er bietet seine Hilfe an, verschwindet mitten im Satz hinter einer Nuss und taucht genau dann wieder auf, wenn die Kinder ihn nicht mehr erwarten – mit der Lösung im Maul, aus Versehen',
  gesture = 'hüpft aufgeregt von einem Fuß auf den anderen',
  comic_role = 'chaos',
  can_lead = FALSE, can_oppose = FALSE, villain_style = NULL,
  intro_line = 'Pip! Ich helfe! Wobei denn? Egal! Ist das eine Nuss?',
  signature_visual = 'red squirrel with a fluffy tail carrying an acorn',
  bible_version = 1
WHERE id = 'char_006_pip_das_eichhoernchen' AND bible_version = 0;

UPDATE character_pool SET
  want = 'dass alle ihre Rätsel lösen – und dass niemand es zu schnell schafft',
  fear = 'dass ihre Reime jemandem egal sind',
  secret = 'ihre Hinweise sind oft geraten; sie weiß selbst nicht immer, wo der Weg hinführt',
  running_gag = 'sie spricht nur in Reimen, und wenn ihr kein Reim einfällt, erfindet sie ein Wort – die Kinder übernehmen das Wort, und am Ende des Buchs sagt es das ganze Dorf',
  gesture = 'dreht eine funkelnde Schleife in der Luft, bevor sie verschwindet',
  comic_role = 'literalist',
  can_lead = FALSE, can_oppose = TRUE, villain_style = 'comic',
  intro_line = 'Silberfunke heiß ich, flink und klein – wer mir folgt, kommt selten heim. Spaß! Meistens.',
  signature_visual = 'tiny sprite with silver butterfly wings and a sparkle trail',
  bible_version = 1
WHERE id = 'char_007_silberfunke' AND bible_version = 0;

UPDATE character_pool SET
  want = 'Verlorenes zu den Richtigen zurückbringen, ohne dass jemand sie dabei sieht',
  fear = 'laute Stimmen und helle Mittage',
  secret = 'sie ist selbst einmal verloren gegangen und hat den Weg nach Hause nie gefunden',
  running_gag = 'sie wird durchsichtiger, je nervöser sie ist – die Kinder reden deshalb absichtlich über Langweiliges, bis sie wieder zu sehen ist',
  gesture = 'legt einen Finger an die Lippen, bevor sie etwas Wichtiges sagt',
  comic_role = 'dreamer',
  can_lead = TRUE, can_oppose = FALSE, villain_style = NULL,
  intro_line = 'Nicht erschrecken. Ich bin die Nebelfee, und ich bin nur ein bisschen hier.',
  signature_visual = 'translucent fairy of mist with flowing silver hair',
  bible_version = 1
WHERE id = 'char_008_nebelfee' AND bible_version = 0;

UPDATE character_pool SET
  want = 'endlich einmal etwas richtig Großes richtig machen',
  fear = 'ausgelacht zu werden, wenn wieder etwas anbrennt',
  secret = 'er kann noch gar nicht richtig fliegen und hüpft nur sehr hoch',
  running_gag = 'er niest Funken, wenn er aufgeregt ist – erst auf einen Hut, dann auf einen Zaun, und im Finale genau auf das Richtige',
  gesture = 'klemmt den Schwanz zwischen die Beine, wenn er sich entschuldigt',
  comic_role = 'chaos',
  can_lead = TRUE, can_oppose = FALSE, villain_style = NULL,
  intro_line = 'Funkelflug! Entschuldigung. Das war ich. Das da auch.',
  signature_visual = 'small golden dragon with tiny wings and big eyes',
  bible_version = 1
WHERE id = 'char_009_golddrache' AND bible_version = 0;

UPDATE character_pool SET
  want = 'Ruhe – behauptet er; eigentlich will er, dass jemand bleibt',
  fear = 'dass das Haus abends still ist',
  secret = 'er backt heimlich Kekse für Besucher, die er dann wegschickt',
  running_gag = 'er wirft die Kinder hinaus und ruft ihnen durch die Tür noch eine Frage hinterher – jedes Mal eine längere',
  gesture = 'dreht sich weg, um sein Lächeln zu verstecken',
  comic_role = 'grump',
  can_lead = FALSE, can_oppose = TRUE, villain_style = 'misunderstood',
  intro_line = 'Graf Griesgram. Raus. Wer seid ihr überhaupt? Nein, sagt es nicht. Na gut, sagt es.',
  signature_visual = 'old nobleman with gray beard and dark formal clothes',
  bible_version = 1
WHERE id = 'char_010_graf_griesgram' AND bible_version = 0;

UPDATE character_pool SET
  want = 'dass endlich jemand ihre Streiche durchschaut – das wäre ein würdiger Gegner',
  fear = 'Langeweile und Leute, die alles ernst nehmen',
  secret = 'ihre Zauber halten nur bis zum nächsten Niesen; deshalb hat sie immer Pfeffer dabei',
  running_gag = 'sie kündigt einen „ganz kleinen Trick“ an, und der Trick wird jedes Mal größer – bis ihr der dritte selbst über den Kopf wächst',
  gesture = 'kichert hinter vorgehaltener Hand, bevor sie einen Zauber spricht',
  comic_role = 'schemer',
  can_lead = FALSE, can_oppose = TRUE, villain_style = 'comic',
  intro_line = 'Ich bin die Nebelhexe, und das hier war ein Versehen. Hihi. War es nicht.',
  signature_visual = 'witch with wild curly hair and patchwork robes',
  bible_version = 1
WHERE id = 'char_011_die_nebelhexe' AND bible_version = 0;

UPDATE character_pool SET
  want = 'seine Regel bewahren, auch wenn er vergessen hat, warum es sie gibt',
  fear = 'dass sich jemand an seinem Moosbart festhält',
  secret = 'er hat vor langer Zeit einmal jemanden durchgelassen und schämt sich noch immer',
  running_gag = 'er sagt „Nicht. Weiter. Gehen.“ – und lässt sich jedes Mal mit einer anderen Winzigkeit ablenken, von einem Marienkäfer bis zu einer Frage, wie spät es ist',
  gesture = 'kleine Steinchen fallen von ihm ab, wenn er überrascht ist',
  comic_role = 'fusspot',
  can_lead = FALSE, can_oppose = TRUE, villain_style = 'misunderstood',
  intro_line = 'BRUMM. Ich bin Brumm. Und ihr seid: nicht hier.',
  signature_visual = 'large moss-covered stone golem with glowing eyes',
  bible_version = 1
WHERE id = 'char_012_steingolem' AND bible_version = 0;

UPDATE character_pool SET
  want = 'dass niemand hungrig aus seiner Backstube geht – und dass sein neues Brot endlich gelingt',
  fear = 'dass der Ofen eines Morgens kalt bleibt',
  secret = 'er probiert seit Jahren ein Rezept aus, das noch nie geklappt hat, und versteckt die Versuche hinter den Mehlsäcken',
  running_gag = 'er hält jedem, der traurig oder in Eile ist, ein Gebäck hin – auch Figuren, die gar nicht essen können, und jedes Mal findet er einen Grund, warum es trotzdem passt',
  gesture = 'wischt die mehlbestäubten Hände an der Schürze ab',
  comic_role = 'fusspot',
  can_lead = FALSE, can_oppose = FALSE, villain_style = NULL,
  intro_line = 'Bäcker Braun. Erst probieren, dann reden – so ist das hier.',
  signature_visual = 'round baker with a flour-dusted apron',
  bible_version = 1
WHERE id = 'char_013_baecker_braun' AND bible_version = 0;

UPDATE character_pool SET
  want = 'dass ihr Licht jede Nacht brennt, egal was draußen tobt',
  fear = 'eine Nacht zu verschlafen',
  secret = 'sie hat selbst nie auf einem Schiff gestanden; sie wird seekrank',
  running_gag = 'sie beantwortet jede Frage mit einem Meeresvergleich, der immer weniger passt – bis sie beim dritten selbst lacht und einfach die Antwort sagt',
  gesture = 'schaut kurz zum Horizont, bevor sie antwortet',
  comic_role = 'dreamer',
  can_lead = FALSE, can_oppose = FALSE, villain_style = NULL,
  intro_line = 'Frau Wellenreiter. Das Licht da oben ist meins. Was treibt euch an meinen Strand?',
  signature_visual = 'lighthouse keeper with a braided gray plait and sea-blue eyes',
  bible_version = 1
WHERE id = 'char_014_leuchtturmwaerterin' AND bible_version = 0;

UPDATE character_pool SET
  want = 'zu jeder Frage das richtige Buch finden – sofort',
  fear = 'ein Buch mit Eselsohr',
  secret = 'das wichtigste Buch der Bibliothek hat er selbst verlegt und sucht es seit Jahren',
  running_gag = 'er hat zu allem ein Buch, findet es nie und zieht stattdessen jedes Mal etwas anderes aus der Westentasche – einen Löffel, einen Schlüssel, einen Keks –, das später genau gebraucht wird',
  gesture = 'kramt in den vielen Westentaschen nach dem richtigen Lesezeichen',
  comic_role = 'know-it-all',
  can_lead = FALSE, can_oppose = FALSE, villain_style = NULL,
  intro_line = 'Seitenflug, Herr Seitenflug. Dazu habe ich ein Buch. Irgendwo.',
  signature_visual = 'tall thin librarian with a vest full of pockets and bookmarks',
  bible_version = 1
WHERE id = 'char_015_bibliothekar_seitenflug' AND bible_version = 0;

UPDATE character_pool SET
  want = 'dass die Zeit in Ordnung bleibt – jede Minute an ihrem Platz',
  fear = 'einen Moment, der sich nicht wiederholen lässt',
  secret = 'er kommt selbst ständig zu spät, weil er zwischen den Zeiten die Übersicht verliert',
  running_gag = 'er sagt „Das hier ist noch nicht passiert“ über Dinge, die gerade passieren – und einmal über etwas, das wirklich noch kommt',
  gesture = 'seine Augen flackern wie Sanduhren, wenn er nachdenkt',
  comic_role = 'literalist',
  can_lead = TRUE, can_oppose = TRUE, villain_style = 'misunderstood',
  intro_line = 'Ihr seid früh. Oder spät. Ich bin der Zeitweber, und ich bin mir nicht sicher.',
  signature_visual = 'ageless being in shimmering robes with hourglass eyes',
  bible_version = 1
WHERE id = 'char_016_zeitweber' AND bible_version = 0;

UPDATE character_pool SET
  want = 'einen Wunsch finden, der groß genug ist, um ihn zu den Sternen zu tragen',
  fear = 'den Morgen, wenn niemand mehr nach oben schaut',
  secret = 'sie ist vom Himmel gefallen und weiß nicht, wie sie zurückkommt',
  running_gag = 'sie zeigt auf einen Stern und erzählt seine Geschichte – und jedes Mal ist es eine Straßenlaterne, ein Glühwürmchen oder ein Fensterlicht; die Kinder korrigieren sie immer leiser',
  gesture = 'funkelt heller, wenn sie sich freut',
  comic_role = 'dreamer',
  can_lead = TRUE, can_oppose = FALSE, villain_style = NULL,
  intro_line = 'Ich heiße Astra. Ist das hier eure Welt? Sie ist lauter, als sie von oben aussieht.',
  signature_visual = 'celestial being with starry skin and flowing cosmic hair',
  bible_version = 1
WHERE id = 'char_017_sternentaenzerin' AND bible_version = 0;

UPDATE character_pool SET
  want = 'jedem einen guten Traum bringen – pünktlich',
  fear = 'seinen Traumbeutel zu verlieren',
  secret = 'er selbst kann nicht träumen und sammelt deshalb die Träume der anderen',
  running_gag = 'er flüstert so leise, dass ihn keiner versteht, und bekommt jedes Mal eine andere falsche Antwort – bis er einmal laut spricht und alle erschrecken',
  gesture = 'kleine Traumwölkchen schweben um ihn herum, wenn er aufgeregt ist',
  comic_role = 'coward',
  can_lead = TRUE, can_oppose = FALSE, villain_style = NULL,
  intro_line = 'Psst. Morpheus. Nicht so laut, die Träume schlafen noch.',
  signature_visual = 'soft-featured being wrapped in clouds with a purple glow and a dream bag',
  bible_version = 1
WHERE id = 'char_018_traumweber' AND bible_version = 0;
