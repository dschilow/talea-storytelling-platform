-- Migration 20: Seed V2 personality data for all existing characters
-- Each character gets a unique personality with catchphrase, speech style, quirk, and emotional triggers

-- ═══════════════════════════════════════════════════════════════════════════
-- ORIGINAL 18 CHARACTERS (from migrations 5)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Frau Müller (wise guide, protective grandmother)
UPDATE character_pool SET
  dominant_personality = 'weise',
  secondary_traits = ARRAY['fürsorglich', 'geduldig', 'warmherzig'],
  catchphrase = 'Wer genau hinhört, dem flüstert der Wind die Antwort zu.',
  catchphrase_context = 'wenn jemand ratlos ist oder eine Entscheidung treffen muss',
  speech_style = ARRAY['ruhig', 'bedacht', 'ermutigend'],
  emotional_triggers = ARRAY['Kinder in Gefahr', 'Naturzerstörung', 'Ungerechtigkeit'],
  quirk = 'streicht sich nachdenklich über ihren grünen Schal'
WHERE id = 'char_001_frau_mueller';

-- 2. Professor Lichtweis (scholarly mentor, enthusiastic)
UPDATE character_pool SET
  dominant_personality = 'neugierig',
  secondary_traits = ARRAY['enthusiastisch', 'zerstreut', 'klug'],
  catchphrase = 'Faszinierend! Das muss ich sofort aufschreiben!',
  catchphrase_context = 'wenn er etwas Neues entdeckt oder eine überraschende Wendung eintritt',
  speech_style = ARRAY['enthusiastisch', 'fragend', 'abschweifend'],
  emotional_triggers = ARRAY['Rätsel', 'Lernmomente', 'falsche Behauptungen'],
  quirk = 'schiebt ständig seine runde Brille hoch, die immer wieder herunterrutscht'
WHERE id = 'char_002_professor_lichtweis';

-- 3. Die Alte Eiche (magical mentor, ancient)
UPDATE character_pool SET
  dominant_personality = 'weise',
  secondary_traits = ARRAY['uralt', 'schützend', 'geheimnisvoll'],
  catchphrase = 'Die Wurzeln wissen mehr als die Blätter ahnen.',
  catchphrase_context = 'wenn eine verborgene Wahrheit enthüllt wird',
  speech_style = ARRAY['langsam', 'poetisch', 'bedeutungsvoll'],
  emotional_triggers = ARRAY['Bedrohung des Waldes', 'verirrte Wanderer', 'Missachtung der Natur'],
  quirk = 'raschelt leise mit den Blättern bevor sie spricht'
WHERE id = 'char_003_alte_eiche';

-- 4. Silberhorn der Hirsch (noble protector)
UPDATE character_pool SET
  dominant_personality = 'mutig',
  secondary_traits = ARRAY['edel', 'beschützend', 'stolz'],
  catchphrase = 'Der Wald vergisst nie, wer ihm Gutes tut.',
  catchphrase_context = 'wenn jemand Mut beweist oder der Natur hilft',
  speech_style = ARRAY['bestimmt', 'ruhig', 'direkt'],
  emotional_triggers = ARRAY['Freunde in Gefahr', 'Ungerechtigkeit', 'Waldbedrohung'],
  quirk = 'senkt das Geweih zum Gruß wenn er jemandem vertraut'
WHERE id = 'char_004_hirsch_silberhorn';

-- 5. Luna die Katze (clever, independent)
UPDATE character_pool SET
  dominant_personality = 'neugierig',
  secondary_traits = ARRAY['clever', 'unabhängig', 'verschmitzt'],
  catchphrase = 'Miau... ich wusste es natürlich schon die ganze Zeit.',
  catchphrase_context = 'wenn sie Recht behält oder etwas entdeckt wird, das sie bereits ahnte',
  speech_style = ARRAY['schnippisch', 'überlegen', 'verspielt'],
  emotional_triggers = ARRAY['Rätsel', 'versteckte Dinge', 'wenn man sie unterschätzt'],
  quirk = 'putzt sich betont gelangweilt eine Pfote, wenn sie nachdenkt'
WHERE id = 'char_005_luna_die_katze';

-- 6. Pip das Eichhörnchen (playful helper)
UPDATE character_pool SET
  dominant_personality = 'lustig',
  secondary_traits = ARRAY['verspielt', 'hilfsbereit', 'aufgedreht'],
  catchphrase = 'Nüsse! Äh, ich meine... natürlich helfe ich!',
  catchphrase_context = 'wenn er aufgeregt ist oder abgelenkt wird',
  speech_style = ARRAY['schnell', 'aufgeregt', 'übertreibend'],
  emotional_triggers = ARRAY['Spaß', 'Freunde die Hilfe brauchen', 'Nüsse'],
  quirk = 'hüpft aufgeregt von einem Fuß auf den anderen'
WHERE id = 'char_006_pip_das_eichhoernchen';

-- 7. Silberfunke (magical sprite, mischievous)
UPDATE character_pool SET
  dominant_personality = 'frech',
  secondary_traits = ARRAY['verspielt', 'geheimnisvoll', 'schelmisch'],
  catchphrase = 'Glitzer, Funkel, Sternenstaub – wer mich findet, dem hilft der Traum!',
  catchphrase_context = 'wenn sie jemandem einen magischen Hinweis gibt',
  speech_style = ARRAY['singend', 'reimend', 'neckend'],
  emotional_triggers = ARRAY['würdige Suchende', 'reine Herzen', 'Langweiler'],
  quirk = 'hinterlässt überall eine Spur aus silbernem Glitzerstaub'
WHERE id = 'char_007_silberfunke';

-- 8. Die Nebelfee (ethereal guide)
UPDATE character_pool SET
  dominant_personality = 'schüchtern',
  secondary_traits = ARRAY['sanft', 'geheimnisvoll', 'scheu'],
  catchphrase = 'Nicht alles, was verborgen ist, will gefunden werden...',
  catchphrase_context = 'wenn jemand zu voreilig nach Antworten sucht',
  speech_style = ARRAY['flüsternd', 'poetisch', 'zögerlich'],
  emotional_triggers = ARRAY['verlorene Seelen', 'wahre Not', 'laute Geräusche'],
  quirk = 'wird durchsichtiger wenn sie nervös ist'
WHERE id = 'char_008_nebelfee';

-- 9. Funkelflug der Drache (friendly dragon)
UPDATE character_pool SET
  dominant_personality = 'lustig',
  secondary_traits = ARRAY['freundlich', 'tollpatschig', 'beschützend'],
  catchphrase = 'Hups! Das sollte eigentlich nicht brennen...',
  catchphrase_context = 'wenn ihm versehentlich Feuer entfährt oder etwas schiefgeht',
  speech_style = ARRAY['enthusiastisch', 'entschuldigend', 'warmherzig'],
  emotional_triggers = ARRAY['echte Freunde', 'Abenteuer', 'wenn er ausgelacht wird'],
  quirk = 'niest kleine Feuerfunken wenn er aufgeregt ist'
WHERE id = 'char_009_golddrache';

-- 10. Graf Griesgram (misunderstood grump)
UPDATE character_pool SET
  dominant_personality = 'grummelig',
  secondary_traits = ARRAY['einsam', 'eigentlich nett', 'missverstandern'],
  catchphrase = 'Ruhe! Ich brauche absolute... na gut, EINE Frage noch.',
  catchphrase_context = 'wenn er so tut als wolle er Ruhe, aber eigentlich Gesellschaft genießt',
  speech_style = ARRAY['knapp', 'brummig', 'unwillig'],
  emotional_triggers = ARRAY['Eindringlinge', 'Lärm', 'Unordnung', 'wenn jemand nett zu ihm ist'],
  quirk = 'dreht sich weg um sein Lächeln zu verstecken'
WHERE id = 'char_010_graf_griesgram';

-- 11. Die Nebelhexe (trickster witch)
UPDATE character_pool SET
  dominant_personality = 'frech',
  secondary_traits = ARRAY['clever', 'verspielt', 'herausfordernd'],
  catchphrase = 'Hihihi! Das war doch nur ein kleiner Trick... oder?',
  catchphrase_context = 'wenn sie jemanden reingelegt hat oder ein Streich aufgedeckt wird',
  speech_style = ARRAY['neckend', 'geheimnisvoll', 'kichernd'],
  emotional_triggers = ARRAY['Langeweile', 'Herausforderungen', 'clevere Gegner'],
  quirk = 'kichert hinter vorgehaltener Hand bevor sie einen Zauber spricht'
WHERE id = 'char_011_die_nebelhexe';

-- 12. Brumm der Steinwächter (guardian golem)
UPDATE character_pool SET
  dominant_personality = 'loyal',
  secondary_traits = ARRAY['stark', 'langsam', 'ehrenhaft'],
  catchphrase = 'BRUMM. Nicht. Weiter. Gehen.',
  catchphrase_context = 'wenn er den Weg versperrt oder eine Warnung ausspricht',
  speech_style = ARRAY['knapp', 'langsam', 'dröhnend'],
  emotional_triggers = ARRAY['Eindringlinge', 'Regelbrecher', 'wenn jemand seinen Moosbart berührt'],
  quirk = 'kleine Steinchen fallen von ihm ab wenn er überrascht ist'
WHERE id = 'char_012_steingolem';

-- 13. Bäcker Braun (jovial baker)
UPDATE character_pool SET
  dominant_personality = 'hilfsbereit',
  secondary_traits = ARRAY['fröhlich', 'großzügig', 'gemütlich'],
  catchphrase = 'Kommt, probiert mal! Frisch aus dem Ofen!',
  catchphrase_context = 'wenn er jemanden trösten oder willkommen heißen möchte',
  speech_style = ARRAY['warmherzig', 'einladend', 'gemütlich'],
  emotional_triggers = ARRAY['hungrige Kinder', 'Feste', 'wenn jemand traurig ist'],
  quirk = 'wischt sich ständig die mehlbestäubten Hände an der Schürze ab'
WHERE id = 'char_013_baecker_braun';

-- 14. Frau Wellenreiter (lighthouse keeper)
UPDATE character_pool SET
  dominant_personality = 'weise',
  secondary_traits = ARRAY['ruhig', 'wachsam', 'geduldig'],
  catchphrase = 'Das Meer lehrt Geduld – und wer geduldig ist, findet den Weg.',
  catchphrase_context = 'wenn jemand ungeduldig ist oder den Mut verliert',
  speech_style = ARRAY['bedacht', 'ruhig', 'ermutigend'],
  emotional_triggers = ARRAY['Stürme', 'Schiffbrüchige', 'Sonnenuntergänge'],
  quirk = 'schaut immer kurz zum Horizont bevor sie antwortet'
WHERE id = 'char_014_leuchtturmwaerterin';

-- 15. Herr Seitenflug (librarian)
UPDATE character_pool SET
  dominant_personality = 'neugierig',
  secondary_traits = ARRAY['hilfsbereit', 'organisiert', 'enthusiastisch'],
  catchphrase = 'Ah! Dazu habe ich ein Buch! Moment... es war hier irgendwo...',
  catchphrase_context = 'wenn ein Thema angesprochen wird und er aufgeregt nach dem passenden Buch sucht',
  speech_style = ARRAY['enthusiastisch', 'wissend', 'abschweifend'],
  emotional_triggers = ARRAY['Fragen', 'Bücherliebhaber', 'wenn Bücher schlecht behandelt werden'],
  quirk = 'kramt in seinen vielen Westentaschen nach dem richtigen Lesezeichen'
WHERE id = 'char_015_bibliothekar_seitenflug';

-- 16. Der Zeitweber (time mystical)
UPDATE character_pool SET
  dominant_personality = 'weise',
  secondary_traits = ARRAY['geheimnisvoll', 'geduldig', 'rätselhaft'],
  catchphrase = 'Die Zeit fließt nicht – sie tanzt.',
  catchphrase_context = 'wenn jemand über Vergangenheit oder Zukunft spricht',
  speech_style = ARRAY['rätselhaft', 'langsam', 'bedeutungsvoll'],
  emotional_triggers = ARRAY['Zeitparadoxe', 'wichtige Momente', 'Ungeduld'],
  quirk = 'seine Augen flackern wie Sanduhren wenn er nachdenkt'
WHERE id = 'char_016_zeitweber';

-- 17. Astra (cosmic visitor)
UPDATE character_pool SET
  dominant_personality = 'verträumt',
  secondary_traits = ARRAY['sanft', 'staunend', 'ätherisch'],
  catchphrase = 'Seht ihr? Jeder Stern erzählt eine Geschichte...',
  catchphrase_context = 'wenn die Nacht hereinbricht oder jemand einen Wunsch äußert',
  speech_style = ARRAY['abschweifend', 'poetisch', 'sanft'],
  emotional_triggers = ARRAY['klare Nächte', 'Träumer', 'Wünsche'],
  quirk = 'funkelt heller wenn sie sich freut'
WHERE id = 'char_017_sternentaenzerin';

-- 18. Morpheus (dream weaver)
UPDATE character_pool SET
  dominant_personality = 'schüchtern',
  secondary_traits = ARRAY['sanft', 'beschützend', 'kreativ'],
  catchphrase = 'Psst... schließ die Augen. Ich zeige dir etwas Schönes.',
  catchphrase_context = 'wenn er jemandem einen Traum schenkt oder Angst nimmt',
  speech_style = ARRAY['flüsternd', 'beruhigend', 'leise'],
  emotional_triggers = ARRAY['Alpträume', 'Schlafprobleme', 'traurige Träume'],
  quirk = 'kleine Traumwölkchen schweben um ihn herum'
WHERE id = 'char_018_traumweber';

-- ═══════════════════════════════════════════════════════════════════════════
-- 21 HUMAN CHARACTERS (from migration 8)
-- ═══════════════════════════════════════════════════════════════════════════

-- König Wilhelm (authoritative ruler)
UPDATE character_pool SET
  dominant_personality = 'weise',
  secondary_traits = ARRAY['gerecht', 'bestimmt', 'väterlich'],
  catchphrase = 'Ein König dient seinem Volk – nicht umgekehrt.',
  catchphrase_context = 'wenn es um Pflicht oder Gerechtigkeit geht',
  speech_style = ARRAY['förmlich', 'bestimmt', 'würdevoll'],
  emotional_triggers = ARRAY['Ungerechtigkeit', 'Bedrohung des Königreichs', 'mutige Taten'],
  quirk = 'streicht sich durch den weißen Bart wenn er nachdenkt'
WHERE id = '7f8e9a1b-2c3d-4e5f-6a7b-8c9d0e1f2a3b';

-- König Friedrich (strict ruler)
UPDATE character_pool SET
  dominant_personality = 'mutig',
  secondary_traits = ARRAY['streng', 'stolz', 'traditionell'],
  catchphrase = 'Ordnung ist das Fundament eines jeden Reiches!',
  catchphrase_context = 'wenn Chaos droht oder Regeln gebrochen werden',
  speech_style = ARRAY['bestimmt', 'knapp', 'fordernd'],
  emotional_triggers = ARRAY['Regelbruch', 'Unordnung', 'Feigheit'],
  quirk = 'klopft ungeduldig mit dem Siegelring auf den Thron'
WHERE id = '8a9b0c1d-2e3f-4a5b-6c7d-8e9f0a1b2c3d';

-- Königin Isabella (elegant ruler)
UPDATE character_pool SET
  dominant_personality = 'hilfsbereit',
  secondary_traits = ARRAY['elegant', 'diplomatisch', 'klug'],
  catchphrase = 'Mit Klugheit und Güte lässt sich jeder Streit lösen.',
  catchphrase_context = 'wenn ein Konflikt friedlich gelöst werden soll',
  speech_style = ARRAY['diplomatisch', 'warmherzig', 'bestimmt'],
  emotional_triggers = ARRAY['Streit', 'hilfsbedürftige Kinder', 'Unfreundlichkeit'],
  quirk = 'legt beruhigend die Hand auf die Schulter des Gegenübers'
WHERE id = '9b0c1d2e-3f4a-5b6c-7d8e-9f0a1b2c3d4e';

-- Prinz Alexander (brave hero)
UPDATE character_pool SET
  dominant_personality = 'mutig',
  secondary_traits = ARRAY['edel', 'abenteuerlustig', 'charmant'],
  catchphrase = 'Auf ins Abenteuer – wer kommt mit?',
  catchphrase_context = 'wenn ein neues Abenteuer beginnt oder Mut gefordert ist',
  speech_style = ARRAY['direkt', 'enthusiastisch', 'ermunternd'],
  emotional_triggers = ARRAY['Freunde in Gefahr', 'neue Abenteuer', 'Feigheit'],
  quirk = 'legt die Hand ans Schwert wenn er sich auf etwas konzentriert'
WHERE id = 'a0b1c2d3-4e5f-6a7b-8c9d-0e1f2a3b4c5d';

-- Prinzessin Rosalinde (kind heroine)
UPDATE character_pool SET
  dominant_personality = 'hilfsbereit',
  secondary_traits = ARRAY['mutig', 'klug', 'anmutig'],
  catchphrase = 'Stärke kommt nicht vom Schwert, sondern vom Herzen.',
  catchphrase_context = 'wenn jemand an sich zweifelt oder wahre Stärke zeigt',
  speech_style = ARRAY['warmherzig', 'ermutigend', 'bestimmt'],
  emotional_triggers = ARRAY['Ungerechtigkeit', 'verletzte Tiere', 'wenn andere aufgeben wollen'],
  quirk = 'steckt sich eine Blume ins Haar bevor es ernst wird'
WHERE id = 'b1c2d3e4-5f6a-7b8c-9d0e-1f2a3b4c5d6e';

-- Müller Hans (hardworking miller)
UPDATE character_pool SET
  dominant_personality = 'loyal',
  secondary_traits = ARRAY['fleißig', 'ehrlich', 'bescheiden'],
  catchphrase = 'Harte Arbeit lohnt sich immer – irgendwann.',
  catchphrase_context = 'wenn es schwierig wird und Durchhaltevermögen gefragt ist',
  speech_style = ARRAY['direkt', 'einfach', 'ehrlich'],
  emotional_triggers = ARRAY['Faulheit', 'Diebstahl', 'wenn seine Familie bedroht wird'],
  quirk = 'klopft Mehlstaub von den Händen bevor er spricht'
WHERE id = 'c2d3e4f5-6a7b-8c9d-0e1f-2a3b4c5d6e7f';

-- Schmied Konrad (strong blacksmith)
UPDATE character_pool SET
  dominant_personality = 'mutig',
  secondary_traits = ARRAY['stark', 'zuverlässig', 'stolz'],
  catchphrase = 'Was im Feuer geschmiedet wird, hält ewig!',
  catchphrase_context = 'wenn etwas auf die Probe gestellt wird oder Stärke gefragt ist',
  speech_style = ARRAY['bestimmt', 'knapp', 'ehrlich'],
  emotional_triggers = ARRAY['schlechtes Handwerk', 'Ungerechtigkeit', 'wenn Schwache bedroht werden'],
  quirk = 'hämmert unbewusst mit der Faust auf den Tisch wenn er redet'
WHERE id = 'd3e4f5a6-7b8c-9d0e-1f2a-3b4c5d6e7f8a';

-- Bäcker Wilhelm (cheerful baker)
UPDATE character_pool SET
  dominant_personality = 'lustig',
  secondary_traits = ARRAY['großzügig', 'herzlich', 'gesprächig'],
  catchphrase = 'Ohne Frühstück kein Abenteuer – hier, nimm ein Brötchen!',
  catchphrase_context = 'wenn er jemanden aufmuntern oder stärken will',
  speech_style = ARRAY['fröhlich', 'einladend', 'übertreibend'],
  emotional_triggers = ARRAY['leere Mägen', 'traurige Gesichter', 'Feiertage'],
  quirk = 'schnuppert an allem als ob es frisches Brot wäre'
WHERE id = 'e4f5a6b7-8c9d-0e1f-2a3b-4c5d6e7f8a9b';

-- Hexe Griselda (cunning witch)
UPDATE character_pool SET
  dominant_personality = 'frech',
  secondary_traits = ARRAY['listig', 'geheimnisvoll', 'launisch'],
  catchphrase = 'Knusper, knusper... ach, das war eine Andere. Ich bin VIEL schlimmer!',
  catchphrase_context = 'wenn sie Angst machen will oder sich vorstellt',
  speech_style = ARRAY['drohend', 'kichernd', 'geheimnisvoll'],
  emotional_triggers = ARRAY['freche Kinder', 'wenn ihr Zauber nicht wirkt', 'Einsamkeit'],
  quirk = 'rührt ständig in einem unsichtbaren Kessel'
WHERE id = 'f5a6b7c8-9d0e-1f2a-3b4c-5d6e7f8a9b0c';

-- Zauberer Merlin (wise wizard)
UPDATE character_pool SET
  dominant_personality = 'weise',
  secondary_traits = ARRAY['mächtig', 'geduldig', 'gütig'],
  catchphrase = 'Magie liegt nicht im Zauberstab – sie liegt in dir.',
  catchphrase_context = 'wenn jemand Selbstvertrauen braucht oder an Magie zweifelt',
  speech_style = ARRAY['bedacht', 'geheimnisvoll', 'ermutigend'],
  emotional_triggers = ARRAY['Missbrauch von Magie', 'lernwillige Schüler', 'Ungeduld'],
  quirk = 'lässt kleine Funken aus der Stabspitze sprühen wenn er schmunzelt'
WHERE id = 'a6b7c8d9-0e1f-2a3b-4c5d-6e7f8a9b0c1d';

-- Magierin Luna (mysterious sorceress)
UPDATE character_pool SET
  dominant_personality = 'schüchtern',
  secondary_traits = ARRAY['hilfsbereit', 'magisch', 'zurückhaltend'],
  catchphrase = 'Der Kristall zeigt mir... oh, das ist unerwartet.',
  catchphrase_context = 'wenn sie eine Vision hat oder etwas Überraschendes entdeckt',
  speech_style = ARRAY['leise', 'nachdenklich', 'geheimnisvoll'],
  emotional_triggers = ARRAY['magische Störungen', 'Hilfesuchende', 'dunkle Magie'],
  quirk = 'ihr Kristallstab leuchtet heller wenn sie aufgeregt ist'
WHERE id = 'b7c8d9e0-1f2a-3b4c-5d6e-7f8a9b0c1d2e';

-- Räuber Rolf (greedy bandit)
UPDATE character_pool SET
  dominant_personality = 'frech',
  secondary_traits = ARRAY['gierig', 'listig', 'feige'],
  catchphrase = 'Her mit dem Gold! Äh... ich meine... das ist eine Weggebühr!',
  catchphrase_context = 'wenn er rauben will aber versucht es nett klingen zu lassen',
  speech_style = ARRAY['drohend', 'nervös', 'prahlerisch'],
  emotional_triggers = ARRAY['Gold', 'wenn er erwischt wird', 'stärkere Gegner'],
  quirk = 'schielt nervös nach links und rechts bevor er spricht'
WHERE id = 'c8d9e0f1-2a3b-4c5d-6e7f-8a9b0c1d2e3f';

-- Stiefmutter Brunhilde (cruel stepmother)
UPDATE character_pool SET
  dominant_personality = 'weise',
  secondary_traits = ARRAY['eitel', 'berechnend', 'eifersüchtig'],
  catchphrase = 'Schönheit vergeht – aber Macht bleibt!',
  catchphrase_context = 'wenn es um Kontrolle oder Einfluss geht',
  speech_style = ARRAY['förmlich', 'schneidend', 'überlegen'],
  emotional_triggers = ARRAY['wenn jemand schöner ist', 'Kontrollverlust', 'Widerspruch'],
  quirk = 'betrachtet sich in jeder spiegelnden Oberfläche'
WHERE id = 'd9e0f1a2-3b4c-5d6e-7f8a-9b0c1d2e3f4a';

-- Weise Frau Margarethe (wise elder)
UPDATE character_pool SET
  dominant_personality = 'weise',
  secondary_traits = ARRAY['gütig', 'geduldig', 'heilkundig'],
  catchphrase = 'Gegen jedes Leid ist ein Kraut gewachsen.',
  catchphrase_context = 'wenn sie tröstet oder einen Heilmittel-Tipp gibt',
  speech_style = ARRAY['warmherzig', 'ruhig', 'ermutigend'],
  emotional_triggers = ARRAY['Kranke', 'verzweifelte Eltern', 'wenn Kräuter falsch verwendet werden'],
  quirk = 'reibt getrocknete Kräuter zwischen den Fingern während sie spricht'
WHERE id = 'e0f1a2b3-4c5d-6e7f-8a9b-0c1d2e3f4a5b';

-- Professor Theodor (eccentric scholar)
UPDATE character_pool SET
  dominant_personality = 'neugierig',
  secondary_traits = ARRAY['zerstreut', 'enthusiastisch', 'exzentrisch'],
  catchphrase = 'Moment! Ich habe hier irgendwo eine Notiz dazu... äh... war es dieses Buch?',
  catchphrase_context = 'wenn er nach einer Information sucht und sich in seinen Büchern verliert',
  speech_style = ARRAY['abschweifend', 'enthusiastisch', 'vergesslich'],
  emotional_triggers = ARRAY['Entdeckungen', 'dumme Fragen', 'verlorene Bücher'],
  quirk = 'hat immer Tintenflecken an den Fingern und merkt es nie'
WHERE id = 'f1a2b3c4-5d6e-7f8a-9b0c-1d2e3f4a5b6c';

-- Händler Gustav (shrewd merchant)
UPDATE character_pool SET
  dominant_personality = 'frech',
  secondary_traits = ARRAY['geschäftstüchtig', 'redselig', 'opportunistisch'],
  catchphrase = 'Nur heute, nur für euch – ein Sonderpreis! Na gut, ZWEI Sonderpreise!',
  catchphrase_context = 'wenn er etwas verkaufen oder einen Deal machen will',
  speech_style = ARRAY['überredend', 'schnell', 'charmant'],
  emotional_triggers = ARRAY['gute Geschäfte', 'Konkurrenz', 'leere Kassen'],
  quirk = 'reibt sich die Hände wenn er einen guten Deal wittert'
WHERE id = 'a2b3c4d5-6e7f-8a9b-0c1d-2e3f4a5b6c7d';

-- Wirtin Martha (warm innkeeper)
UPDATE character_pool SET
  dominant_personality = 'hilfsbereit',
  secondary_traits = ARRAY['tratschig', 'mütterlich', 'herzlich'],
  catchphrase = 'Setzt euch hin, esst was Warmes – dann sieht die Welt gleich anders aus!',
  catchphrase_context = 'wenn Reisende ankommen oder jemand traurig aussieht',
  speech_style = ARRAY['warmherzig', 'bestimmt', 'plaudernd'],
  emotional_triggers = ARRAY['hungrige Reisende', 'Klatsch', 'ungewaschene Hände am Tisch'],
  quirk = 'trocknet ständig ein Glas ab, auch wenn es schon sauber ist'
WHERE id = 'b3c4d5e6-7f8a-9b0c-1d2e-3f4a5b6c7d8e';

-- Diener Johann (loyal servant)
UPDATE character_pool SET
  dominant_personality = 'loyal',
  secondary_traits = ARRAY['bescheiden', 'aufmerksam', 'nervös'],
  catchphrase = 'Wie Ihr wünscht... obwohl... nein, natürlich wie Ihr wünscht.',
  catchphrase_context = 'wenn er anderer Meinung ist, sich aber nicht traut es zu sagen',
  speech_style = ARRAY['förmlich', 'leise', 'unterwürfig'],
  emotional_triggers = ARRAY['Befehle', 'wenn sein Herr in Gefahr ist', 'Chaos im Haushalt'],
  quirk = 'verbeugt sich reflexartig bei jeder Anrede'
WHERE id = 'c4d5e6f7-8a9b-0c1d-2e3f-4a5b6c7d8e9f';

-- Magd Elsa (hardworking maid)
UPDATE character_pool SET
  dominant_personality = 'hilfsbereit',
  secondary_traits = ARRAY['fleißig', 'hoffnungsvoll', 'still'],
  catchphrase = 'Ich schaffe das schon... ich schaffe das immer.',
  catchphrase_context = 'wenn sie müde ist aber trotzdem weitermacht',
  speech_style = ARRAY['leise', 'bescheiden', 'bestimmt'],
  emotional_triggers = ARRAY['Ungerechtigkeit', 'wenn jemand freundlich zu ihr ist', 'Überarbeitung'],
  quirk = 'summt leise vor sich hin wenn sie arbeitet'
WHERE id = 'd5e6f7a8-9b0c-1d2e-3f4a-5b6c7d8e9f0a';

-- Hirtenjunge Peter (playful shepherd boy)
UPDATE character_pool SET
  dominant_personality = 'neugierig',
  secondary_traits = ARRAY['verspielt', 'mutig', 'treu'],
  catchphrase = 'Meine Schafe haben es mir erzählt! Die wissen alles!',
  catchphrase_context = 'wenn er eine Information hat die er irgendwo aufgeschnappt hat',
  speech_style = ARRAY['aufgeregt', 'direkt', 'kindlich'],
  emotional_triggers = ARRAY['seine Schafe', 'Abenteuer', 'Ungerechtigkeit gegenüber Schwächeren'],
  quirk = 'hat immer einen Grashalm im Mund'
WHERE id = 'e6f7a8b9-0c1d-2e3f-4a5b-6c7d8e9f0a1b';

-- Bauerntochter Greta (kind farm girl)
UPDATE character_pool SET
  dominant_personality = 'hilfsbereit',
  secondary_traits = ARRAY['fleißig', 'fröhlich', 'naturverbunden'],
  catchphrase = 'Schau mal, die Blumen haben mir den Weg gezeigt!',
  catchphrase_context = 'wenn sie die Natur als Wegweiser nutzt oder etwas in der Natur entdeckt',
  speech_style = ARRAY['fröhlich', 'einfach', 'herzlich'],
  emotional_triggers = ARRAY['verletzte Tiere', 'Erntezeit', 'wenn jemand die Natur missachtet'],
  quirk = 'pflückt immer Blumen und verschenkt sie an alle'
WHERE id = 'f7a8b9c0-1d2e-3f4a-5b6c-7d8e9f0a1b2c';
