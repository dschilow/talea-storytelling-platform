# Kapitelbuch: Wer treibt das Buch an? (2026-10-16)

Anlass war „Die Türlaunische“ (chapter-book-v1, 8 Kapitel, 6–8 Jahre, Story 5c113310), das erste Buch nach dem Umbau „Buchgefühl statt Drehbuch“. Die Prosa war auf Satzebene gut, das Buch blieb trotzdem leise: niemand arbeitete gegen die Helden, der Einsatz (ein Haustürklang) war nichts, was ein Kind malen kann, das zuhörende Kind wusste nie mehr als die Helden, die Nebenfiguren halfen nur, und die Helden lernten dieselbe Lektion wie im Buch davor. Zwei Bewertungen (diese Session und eine zweite KI) kamen unabhängig zu derselben Diagnose; die Familie wünscht sich Figuren wie Zippel, Pippi, Karlsson oder das Sams als Motor, ohne dass die Kinder zu Statisten werden.

## Befund am veröffentlichten Buch

| Messgröße | „Die Türlaunische“ | Vorlese-Kapitelbücher |
| --- | --- | --- |
| Kapitel ohne Lachmoment (Kritiker) | 6 von 8 | 0 |
| Kapitel ohne Haken | 4 von 8 | 0 |
| Spannung Kapitel 1–5 | 6, 6, 6, 7, 6 | steigend |
| Plan-Review vor dem Schreiben | overall 5, logic 5 | – |
| Nachbewertung nach der Revision | keine | – |
| „Klinke“ / „Klang“ / „Welle“ | 47 / 88 / 46 in 7.711 Wörtern | ein Motiv trägt nicht jeden Absatz |
| Gefühl im Bauch / Ellbogenstups | 7 / 3 | je einmal |
| Nebenfiguren auf Bildern | 0 von 16 | jede handelnde Figur |
| Kapitel-Rewrites | 4 (6,5 ct), alle bei Kritiker-Stimme 8–9 | – |
| Kosten | 27 ct (23 ct Text, 4 ct Bilder) | – |

## Ursachen

- Der Pitch kannte nur einen Motor: den Wunsch der Helden. Weil die Heldenprofile die einzigen starken Daten im Prompt sind, wurde die Begabung eines Helden zur Prämisse (gutes Gehör → Klangbuch), dreimal in fünf Büchern.
- Der Plan verlangte einen Gegenspieler mit Logik, aber keinen, der ohne die Helden handelt. Jeder Gegner wurde am Ende verstanden und getröstet.
- Der Plan-Review gab 5 von 10; die Revision zertifizierte sich selbst (`remaining: []`), und die Kapitel wurden geschrieben.
- Der Kritiker fand Lachmoment, Haken und Spannung – und meldete sie; nichts griff ein, solange der Humor über 5 lag.
- Die Bildregel „jede handelnde Figur in ein Bild“ stand nur im Prompt.
- `voice.ts` gab dem Writer Gefühlsbeispiele („a hot face, a stomach that drops“); der Writer übernahm sie siebenmal.
- Die Pool-Figuren hatten Spruch, Tick und Sprechweise – Würze für eine Szene, aber kein Wollen, keine Angst, kein Geheimnis, keinen komischen Mechanismus, der ein Buch tragen könnte.

## Änderungen (konfigurationsneutral; Altersband, Sprache, Genre/Form, Heldenzahl und Cast kommen weiter aus dem Wizard)

### Drei Motoren, die Helden entscheiden
- `book/types.ts`: `StoryEngine` (heroes | villain | guest), `BookVillain` (Ziel, Plan, Züge je Kapitel ohne die Helden, Schwäche, `exposedBy`, Ausgang, Stil), `HeroDuty` (Talent mit Kapitel, Entscheidung am Höhepunkt mit Kapitel, Gefühl am Ende), `readerKnowsMore`, `stakeVisible`, `opponentScene`/`pov` je Kapitel, `turn` je Nebenfigur.
- `book/prompts.ts`: Der Pitch gibt den drei Ideen drei verschiedene Motoren (im Cozy-Buch ohne villain), verlangt einen malbaren Einsatz und verbietet die Heldenbegabung als Prämisse. Der Plan bekommt je Motor eigene Regeln: Züge des Gegenspielers ohne die Helden, Kaltstart in Kapitel 1 (`pov: "opponent"`), ein bis zwei Momente, in denen das Kind mehr weiß; Gast mit Mission und Geheimnis, Beinahe-Entdeckungen; in jedem Motor Heldenpflichten und eine Wendung je Nebenfigur. Altersstaffelung des Gegners (`plan.ts villainStyleFor`): 3–5 missverstanden, 6–8 komisch und überlistet (darf einfach verlieren), 9–12 echt. Writer: Zwischenszenen ohne die Helden als eigener kurzer Abschnitt mit Zeitangabe, höchstens 15 % des Kapitels, nie am Kapitelende; der entscheidende Zug gehört dem Helden aus der Bibel; höchstens ein gemeinsamer Spruch im ganzen Buch. Kritiker: `opponentPresent`, `newChant`, deutsche Grammatikhinweise (Konjunktiv II nach „als“, Reflexivpronomen, Pronomen-Genus).
- `book/plan.ts`: deterministische Checks (`checkEngine`): Gegenspieler handelt in mindestens zwei Kapiteln ohne die Helden, Plan durchschaut bis zur Mitte, Schwäche und Ausgang vorhanden, kein echter Gegner für 3–5; Gast mit Profil und Geheimnis; `readerKnowsMore` für villain/guest; Heldenpflichten je Held mit Entscheidung ab dem Tiefpunkt; `turn` je Nebenfigur; `stakeVisible`. Neue Review-Checks mit Caps: `stakesPaintable` 6, `villainActs`/`heroDecides` 6,5, `heroesSeeThrough`/`traitsNotPremise` 7, `castCausesTurns`/`readerKnowsMore`/`freshArc` 7,5; `needBeforeClimax` gilt nicht für einen komischen Gegner.

### Plan-Gate
- `book/engine.ts`: Nach der Revision wird der Plan erneut bewertet, wenn der erste Review unter 7 lag oder Pflichtkorrekturen hatte; unter dem Gate folgt eine zweite Revision (höchstens zwei). Log-Stufen `plan-review-after` und `plan-revision` mit `gate`. Kosten je Durchgang etwa 1 ct; ein Rewrite wegen eines schwachen Plans kostet 1,5–2,3 ct.

### Billiger statt neu schreiben
- `book/voice.ts` `voiceRewriteDisputed`: Ein einzelnes gemessenes Stimm-Signal gegen eine Kritiker-Stimme ≥ 8 ist kein Rewrite mehr (hätte in der Türlaunischen vier Rewrites, 6,5 ct, gespart). Zwei Signale zusammen gewinnen weiter.
- `book/engine.ts` `enginePatchNotes`: Fehlender Lachmoment bei Humor 6–7 → der Patch baut den geplanten Lacher in zwei bis vier Sätzen ein (bisher: nichts); Kapitel ohne Gegenkraft bei Spannung ≤ 5 → ein Satz, in dem der Gegenspieler näher kommt oder die Frist drückt; neuer Kinderspruch → streichen; zweite ausgesprochene Lehre → ersatzlos streichen. Alles im ohnehin laufenden Patch-Aufruf.

### Text-Checks
- `book/voice.ts`: `repeatedTics` (Bauch, heißes Gesicht, Lippen, Ellbogen, Kloß, Herz, Schulter, Atem, Hand – ab dreimal im Buch oder zweimal im Kapitel), `overusedWords` (Substantiv-Heuristik über Großschreibung im Satz; Schwelle etwa eins je 90 Wörter), `interludeShare` (Szenen ohne die Helden ab „Unterdessen …“ bis zum nächsten Heldennamen; Kaltstart ab drei Absätzen). Tics und Motive gehen in den Patch, der Zwischenszenen-Anteil nur ins Log (`LOG_ONLY_CODES`). Die konkreten Gefühlsbeispiele im Writer-Prompt sind gestrichen; stattdessen: jedes Körperbild und jede Geste zwischen den Helden höchstens einmal im Buch.
- `book/chapters.ts`: die drei Checks in `checkChapter`; der Kritiker-Parser liest `opponentPresent` und `newChant` (Zitat nur, wenn es im Text steht).
- Kurve im Log: `opponentPresent`, `interludeShare`, `lesson`, `laughPatched`, `voiceDisputed`.

### Bilder
- `book/illustrations.ts` `enforceCastPresence`: Jede Cast-Figur, die in einem Kapitel handelt, steht in mindestens einem Bild dieses Kapitels; die Motorfigur in jedem zweiten Bild des Stapels. Die Figur kommt ins Bild, dessen Absätze sie am häufigsten nennen; ist es voll, weicht der Held, der nahe dem Bild nicht genannt wird, und ein Held bleibt immer. Log-Stufe `pictures-directed` zeigt `castEnforced`.

### Figuren-Bibel für den Pool
- Migration 44 (`44_character_bible`): `want`, `fear`, `secret`, `running_gag`, `gesture`, `comic_role`, `can_lead`, `can_oppose`, `villain_style`, `intro_line`, `signature_visual`, `bible_version`; handgeschriebene Bibeln für die 18 Originalfiguren.
- `character-bible-core.ts` / `character-bible.ts`: `POST /story/character-pool/enrich-bibles` (Admin) füllt fehlende Bibeln mit je einem Support-Modell-Aufruf (etwa 0,1 ct je Figur), idempotent über `bible_version`; `ids`, `limit`, `force`. Die Spalten werden vor dem Lauf angelegt, falls Railway die Migration übersprungen hat.
- `storybook/casting.ts` lädt `SELECT *` (eine fehlende Spalte darf nicht den ganzen Pool kosten); `cast-selection.ts` übernimmt die Felder und gibt Figuren mit Bibel und mit `can_lead`/`can_oppose` einen kleinen Vorsprung; `book/catalogue.ts` zeigt `wants`, `can lead`, `can oppose (stil)`; `oneshot-prompt-en.ts castSheetEn` gibt dem Plan und dem Writer Wollen, Angst, Geheimnis, komischen Mechanismus, Geste und Vorstellungssatz. `character-pool-api.ts` liest und schreibt die Felder.

### Gedächtnis gegen Wiederholung
- `book/engine.ts planMotifs`/`motifLines`, `book-generation.ts`: Jedes fertige Buch hinterlässt in `bookAdmin.motifs` die inneren Bögen je Held und die Motive (Motorfigur, Einsatz, Wunder, Motor). `storybook/history.ts` liest sie als Zeilen „Lektion (Held) in „Titel“: …“ und „Motiv in „Titel“: …“; Pitch und Plan-Review bekommen sie unter „this family already knows“ (Fenster im Brief 8 → 16 Zeilen). Das Serien-Gedächtnis trägt `lessons` und `motifs` fort.

## Kosten

Die 27 ct der Türlaunischen verteilten sich auf 11 ct Kapitel, 6,5 ct Rewrites, 2 ct Kritiker, 3 ct Luna (Plan, Patch, Logbuch, Bild-QA) und 4 ct Bilder (45 % davon Redraws). Erwartung mit diesem Stand: die vier bestrittenen Stimm-Rewrites entfallen (−6,5 ct), Lacher und Spannung kommen über den Patch statt über Rewrites, das Plan-Gate kostet höchstens 1 ct zusätzlich und soll Rewrites wegen fehlendem Fortschritt vermeiden; die Figuren im Bild sollen die Redraws wegen „Extra-Kind mit Hut“ senken. Ziel: unter 20 ct bei gleicher Länge. Was nicht kleiner wird: die 8.000 Wörter Text (die Buchgefühl-Länge), der erste Kapitel-Aufruf ohne Cache (1,5 ct mehr als ein Kapitel im Stapel).

## Offen / zu messen

- Blind-Paare alter gegen neuer Prompt auf denselben Wizard-Konfigurationen (Kinderkrimi, Abenteuer, Magie, Cozy), zwei Richter aus verschiedenen Modell-Familien; Kennzahlen: Spannung Kapitel 1–5, Lachmoment je Kapitel, `opponentPresent`-Quote, Rewrites je Buch, Kosten je Buch.
- Die Schwellen von `overusedWords` (1 je 90 Wörter, mindestens 7) und `interludeShare` (25 % Warnung) stammen aus einem Buch; nach zehn Büchern nachjustieren.
- `enforceCastPresence` kann Figuren ohne Porträt ins Bild setzen; die Bild-QA erwartet sie dann (sie stehen in `onStage`), aber das Modell zeichnet sie ohne Referenz frei. Für die meistgenutzten Pool-Figuren Porträts erzeugen (`generateCharacterImage` gibt es schon).
- Nach dem Deploy einmal `POST /story/character-pool/enrich-bibles` aufrufen (Admin), danach stichprobenartig die Bibeln lesen und nachschärfen; die 18 Originalfiguren sind per Migration gesetzt.
- Frontend: der Charakter-Pool-Screen zeigt die Bibel-Felder noch nicht (der generierte Client braucht `encore gen client`).
