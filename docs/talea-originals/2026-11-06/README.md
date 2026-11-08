# Die neuen Talea Originals vom 6. November 2026

Folge 4 beider Reihen. Claude Opus 5.5 hat die Geschichten über Claude Code mit dem eigenen Kontingent geschrieben. GPT-6.1 Sol hat sie über das Codex-Abo gegengelesen und jedes Mal eine eigene Überarbeitung geliefert (`codex exec`, kein API-Schlüssel, Denkstufe high). Claude hat Sols Funde geprüft, berechtigte übernommen, falsche verworfen und beide Fassungen zusammengeführt. Das waren drei Runden mit Überarbeitung und eine Abschlussbewertung.

- **Bruno, der Flunkerfisch: Mats kommt nicht runter** – [Lesefassung](bruno.md), [eigenständige HTML-Datei mit eingebetteten Bildern](bruno.html). Mats soll die Sachen vom hohen Schrank holen und behauptet vor Brunos Glas: „Ich kann fliegen!“ Fliegen kann er jetzt, landen nicht. Die Wahrheit hieße unter der Decke: runterfallen. Erst als er um Hilfe bittet, holen Ella, Lia und Papa ihn herunter, und danach gibt er freiwillig seine Angst vor der Höhe zu. Staffelhinweis: Bruno mischt mit der Flosse drei nasse Spielkarten und deckt Ellas Karte auf.
- **Die Monster-Müllabfuhr: Alarm in der Turnhalle** – [Lesefassung](monster.md), [HTML](monster.html). Ein Pupsmonster aus vergessenen Turnbeuteln pupst sich durch die Halle. Hinterherrennen hilft nicht, Raumspray macht es schlimmer. Jona leitet mit der Trillerpfeife den Durchzug: zwölf Fenster, dann pustet Gertrud. Staffelhinweis: Vor der Pension liegen Abdrücke wie von nassen Socken. Kein Gast fehlt, und keiner hat solche Füße, also kam jemand von draußen. Beim Schnüffler wächst die Kiste mit Socken ohne Partner.

## Sol-Lektorat

| Runde | Bruno | Monster |
|---|---|---|
| 1 – Erstfassung | 6 (Plot 5, Kanon 5) | 7 (Plot 6) |
| 2 | 7 (Emotion 9) | 7,5 (Humor 9) |
| 3 | 7,8 | 8 |
| Abschluss | **7,8** (Kanon 9, Emotion 9) | **8** (Kanon 9, Humor 9) |

Sol bewertet hart: 7 heißt gut, 8 sehr gut. Mehr als 8 hat Sol bei den Originals bisher nicht vergeben. Nach der Abschlussbewertung kamen nur noch kleine Korrekturen hinein, die nicht noch einmal benotet wurden: Ellas Vorwurf, das verdeckte Mischen beim Kartentrick, zwei Spurenreihen statt behaupteter Laufrichtung und fest zugeschnürte Turnbeutel.

Wichtigste echte Funde:

- Zug an einer Kapuzenkordel am Hals; die Kordel sitzt jetzt unten am Jackensaum.
- Mats sank, obwohl er sonst wie ein Ballon aufsteigt.
- Er gestand, solange er noch frei schwebte.
- Jona war allein in der Umkleide.
- Gertruds Pusten kennt Jona schon aus Folge 1.
- Eine Schlussbemerkung von Mats wäre vor dem Glas selbst eine Flunkerei gewesen.

Verworfen wurden:

- „Das Mäusehündchen ist erfundener Kanon“. Es steht im Text von E1 und auf Flunker-Karte Nr. 1. Seit Runde 2 bekommt Sol deshalb alle früheren Folgen im Volltext.
- Die Streichung des Mehlvergleichs. Der Staffelplan verlangt die Erkenntnis „jemand kam von außen“.

Alles Weitere steht in [sol-lektorat.json](sol-lektorat.json). Die Zwischenfassungen sind `*.v2.txt` und `*.v3.txt`, die Endfassungen `*.lektoriert.txt`.

## Bilder

Je ein Cover und sechs Kapitelbilder, zwei pro Kapitel an verschiedenen Handlungsmomenten, dazu ein neues Figurenporträt (Pupsmonster). Gezeichnet wurde mit **FLUX 3 Klein** (`bfl:flux@3-image-klein`) über Runware, mit Referenzblatt und Bounding Boxes je Figur. Jedes Bild wurde angesehen. Neu gezeichnet wurden unter anderem:

- ein Fisch außerhalb seines Glases;
- ein Kind im offenen Fenster, das als Bildmoment ersetzt wurde;
- Bärentatzen statt Sockenabdrücken;
- Schrift an einer Hallenwand;
- eine Turnhalle ohne Dach;
- eine dazuerfundene Fahrerin neben Gertrud;
- zwei Werkzeugkoffer statt einem.

Prompts, Seeds und Kosten stehen in [bildnachweis.json](bildnachweis.json), die Kontaktbögen sind `*.bildkontrolle.jpg`. Kosten: rund 9 Cent für alle Bildaufrufe einschließlich der Neuzeichnungen und Porträtproben.

## Technik

- Seeds: `backend/story/library/seed/episodes/*.s1e4.json`, gebaut mit [scripts/library/prepare-s1e4.ts](../../../scripts/library/prepare-s1e4.ts) aus den `*.lektoriert.txt` und [kanon.json](kanon.json). Veröffentlichung: Freitag, 6. November 2026, 15:00 Uhr Europe/Berlin. Wer das liest, nachdem das Deploy durch ist, sieht die Folgen sofort.
- Gegenlesen über das Codex-Abo: `bun run scripts/library/episode-review.ts --provider codex --effort high --revise --series <slug> --episode N --file <text>`. Die CLI kommt aus der Codex-Desktop-App (`CODEX_BIN=…\WindowsApps\OpenAI.Codex_*\app\resources\codex.exe`); die npm-Version 0.36 ist für Sol 6.1 zu alt. Ein Lauf dauert 8–13 Minuten.
- Lesefassungen: `bun run scripts/library/export-friday-episodes.ts --date 2026-11-06 --episode 4`.
- Prüfung: alle 100 Bibliothekstests bestanden (`cd backend && bun test story/library`), darunter die Seed-Prüfung von Wortgrenzen, Bildpositionen, Boxen, Dateien und Teaser-Präfix.
- Das Hörspiel entsteht wie bei den früheren Folgen im Studio.
