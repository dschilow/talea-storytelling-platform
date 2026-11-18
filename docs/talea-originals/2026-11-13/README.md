# Die neuen Talea Originals vom 13. November 2026

Das ist Folge 5 beider Reihen. Claude Opus 5.5 hat die Geschichten über Claude Code mit dem eigenen Kontingent geschrieben. GPT-6.2 Sol hat sie gegengelesen und jedes Mal eine eigene Überarbeitung geliefert. Das Codex-Abo war bis 20. November, 15:25 Uhr aufgebraucht. Deshalb lief Sol diesmal über die OpenAI-API (`--provider openai --model gpt-6.2-sol`, Denkstufe high, je Lauf 3 bis 5 Minuten). Claude hat Sols Funde geprüft, die berechtigten übernommen, die falschen verworfen und beide Fassungen zusammengeführt. Es waren drei Runden mit Überarbeitung und eine Abschlussbewertung.

- **Bruno, der Flunkerfisch: Oma ist zwanzig.** [Lesefassung](bruno.md), [eigenständige HTML-Datei mit eingebetteten Bildern](bruno.html). Alle wollen Oma Rosi auf die Bank zum Jackenhalten setzen. Sie behauptet vor Brunos Glas: „Ich bin zwanzig! Ehrlich.“ Prompt ist sie zwanzig. Sie erkennt sich im Spiegel nicht, schlägt ein Rad und fährt rückwärts Rollschuh. Nur glaubt ihr keiner mehr, dass sie die Oma ist. Kein Kind kann den Zauber lösen. Erst als Ella sie fragt, was sie eigentlich will, sagt Oma die Wahrheit, und mit siebzig fährt sie ganz vorne. Staffelhinweis: Oma hat als junge Frau den Großen Brunello auf der Bühne gesehen und erkennt sein Plakat. Ella fragt Bruno zum ersten Mal, ob er etwas verheimlicht, um bleiben zu dürfen.
- **Die Monster-Müllabfuhr: Das Brokkoli-Monster.** [Lesefassung](monster.md), [HTML](monster.html). Im Gemüseladen deckt jemand jede Nacht 31 Plätze, und kein Gast kommt. Das Brokkoli-Monster aus den vergessenen Resten des Probiertellers will nur eins: „Pro-bie-ren!“ Ja sagen hilft nicht, Omas Schummeln mit dem Handschuh macht es schlimmer, und Gertrud niest Erbsen. Jona hat noch nie Brokkoli gegessen. Er probiert freiwillig ein einziges Röschen und darf ehrlich sagen, dass die Bäumchen komisch sind und der Stiel gut ist. Staffelhinweis: Flusi niest beim Wort „König“. Das Wort klingt für ihn wie das nächtliche Brummen im alten Waschsalon, wo er früher gewohnt hat. Die Crew fragt künftig jedes Monster: „Wartest du auf jemanden?“

## Sol-Lektorat

| Runde | Bruno | Monster |
|---|---|---|
| 1 – Erstfassung | 7 (Plot 6, Kanon 6) | 7 (Plot 6, Kanon 6) |
| 2 | 8 (Humor 9, Emotion 9) | 7 (Emotion 9, Kanon 6) |
| 3 | 8 | 7 |
| Abschluss | **8** (Kanon 9, Emotion 9) | **8** (Humor 9, Emotion 9, Kanon 8) |

Sol bewertet hart: 7 heißt gut, 8 sehr gut. Nach der Abschlussbewertung kamen noch kleine Korrekturen hinein, die Sol nicht noch einmal benotet hat:

- Papa entscheidet sich ausdrücklich für die Aufsicht an der Haustür.
- Die Socke blockiert die Rolle sichtbar.
- Oma ruft Papa auf der Bank zu: „Da hast du deine Ruhe!“
- Bruno hat „Hofblick“.
- Das Beet führt zurück zu den Gästen.
- Flusis Erinnerung ist konkreter geworden.

Wichtigste echte Funde:

- Ellas Rechnung „Das ist erst zwölf Jahre her“ tat so, als hätte der Zauber Omas Vergangenheit gelöscht. Er ändert aber nur ihr Alter.
- Papa ließ die Kinder mit einer jungen Frau in den Hof, die er für eine Fremde hielt.
- Nach Omas eigenem Schummeln setzte Ella sie erneut ohne Frage in den Plan.
- Das Rollschuhverbot im Hof galt nach dem Plopp nicht mehr.
- Jona biss erst in ein Röschen ungeklärter Herkunft. Jetzt kommt es vom frischen Probierteller, den Frau Grünwald freigegeben hat.
- Oma griff in der Küche nach einem Tonnendeckel, den es dort nicht gibt.
- Mehrere Nieser beim Wort „König“ wirkten wie ein magischer Wort-Alarm.

Verworfen wurde Sols Forderung, Flusis Waschsalon-Erinnerung zu streichen. Der Staffelplan verlangt sie ausdrücklich. Seit Runde 3 gibt das Prüfskript solche Entscheidungen mit `--note` an Sol weiter: Sol bewertet dann die Umsetzung, nicht die Entscheidung. Verworfen wurde auch Sols Runde-2-Satz „Papa ging nach oben“. Er hätte Mats mit der vermeintlich Fremden allein gelassen.

Alles Weitere steht in [sol-lektorat.json](sol-lektorat.json). Die vollständigen Gutachten und Sols eigene Fassungen liegen in [sol/](sol/). Die Zwischenfassungen sind `*.v2.txt` und `*.v3.txt`, die Endfassungen `*.lektoriert.txt`.

## Bilder

Je ein Cover und sechs Kapitelbilder, zwei pro Kapitel an verschiedenen Handlungsmomenten. Dazu kommen zwei neue Figurenporträts:

- **Oma Rosi mit zwanzig.** Drei Probenrunden zeichneten sie wie ein Kind. Erst mit tailliertem Kleid, Ohrringen, Lippenstift und kleinem Absatz wirkt sie erwachsen.
- **Brokkoli-Monster.** Das Wort „crown“ habe ich gemieden, denn die Krone gehört zum Sockenkönig.

Gezeichnet wurde mit **FLUX 3 Klein** (`bfl:flux@3-image-klein`) über Runware, mit Referenzblatt und Bounding Boxes je Figur. Jedes Bild wurde angesehen. Neu gezeichnet wurde wegen dieser Fehler:

- Schrift auf einem Schuhkarton und auf einem Ladenschild. Ein Rest auf einem kleinen Wandschild ist übermalt.
- Figuren, die frontal in die Kamera posierten.
- Kater Kaiser lief neben dem Rollschuh, statt darauf zu fahren.
- Das Brokkoli-Monster war doppelt im Bild.
- Das Brokkoli-Monster trug einen Kürbis als Hut.
- Ein Röschen lag offen in Omas Hand statt im Handschuh.

Prompts, Seeds und Kosten stehen in [bildnachweis.json](bildnachweis.json), die Kontaktbögen sind `*.bildkontrolle.jpg`. Kosten: rund 16 Cent für alle Bildaufrufe einschließlich Neuzeichnungen und Porträtproben. Eine Szene kostet mit Referenz inzwischen rund 0,5 Cent.

## Technik

- **Seeds:** `backend/story/library/seed/episodes/*.s1e5.json`, gebaut mit [scripts/library/prepare-s1e5.ts](../../../scripts/library/prepare-s1e5.ts) aus den `*.lektoriert.txt` und [kanon.json](kanon.json).
- **Veröffentlichung:** Freitag, 13. November 2026, 15:00 Uhr Europe/Berlin, also der Termin im Staffelraster. Wer das nach dem Deploy liest, sieht die Folgen sofort.
- **Gegenlesen:** `bun --env-file=.env.local run scripts/library/episode-review.ts --provider openai --model gpt-6.2-sol --effort high --revise --series <slug> --episode 5 --file <text> [--note "<Entscheidung>"]`. Mit Abo-Kontingent geht es weiter über `--provider codex` (die Codex-Konfiguration steht schon auf `gpt-6.2-sol`).
- **Lesefassungen:** `bun run scripts/library/export-friday-episodes.ts --date 2026-11-13 --episode 5`.
- **Prüfung:** Alle 100 Bibliothekstests bestanden (`cd backend && bun test story/library`). Dazu gehört die Seed-Prüfung von Wortgrenzen, Bildpositionen, Boxen, Dateien und Teaser-Präfix.
- **Hörspiel:** Es entsteht wie bei den früheren Folgen im Studio.
