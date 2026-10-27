# Talea: Vergleich der Story-Pipelines

**Modellläufe beendet:** [Abschluss und Empfehlung](ABSCHLUSS.md). Der gemeinsame Kandidat ist noch nicht abschließend geprüft.

Stand: 26.10.2026, 16:06:29. Laufender Arbeitsbericht; offene Bewertungen sind keine Nullnoten.

## Methode

Alle sieben Kacheln des Admin-Wizards werden mit derselben fiktiven Familie (Nora und Ben), demselben kleinen Figurenpool, demselben Leserwunsch und ihren produktiven Formatbudgets ausgeführt. Sol 6.1 schreibt; Luna übernimmt günstige Planungs- und Prüfrollen. Im Kapitelbuch ersetzt Sol/Luna die externe Gemini-Prüfung. Die beiden anonymen Schlussbewertungen stammen aus frischen Sol- und Luna-Kontexten derselben Modellfamilie. Das ist keine Prüfung mit Kindern und kein statistisch belastbares Ranking: je Modus ein explorativer Fall. Keine Bilder, Live-Datenbankänderungen, API-Schlüssel oder OpenRouter-Rechnungen; die Inferenz nutzt das Codex-Abonnement.

Das feste Raster gewichtet Kausalität/Regel und Hauptfigurenhandlung mit je 20 %, Ensemble, Stimme, Humor/Wunder, Tempo, Vorlesbarkeit und emotionalen Schluss mit je 10 %. Gewünschte Hauptrolle und Format werden zusätzlich bewertet. Länge erhält keinen Bonus. Modelle sehen weder Pipeline- noch Autorennamen. Ungenaue Zitate werden nach einer begrenzten Korrektur ausdrücklich markiert, nicht zu Beweisen umgedeutet.

Geschichte und Developer teilen den Textkern screenplay-first-v12. Die Tests ersetzen ihre Infrastruktur durch leere Erinnerungen/Artefakte und einen kanonischen Testpool. Der bestehende Debug-Schalter überspringt Bilder, kann aber auch blockierende Diagnose-Gates umgehen; deshalb sind diese Ergebnisse als Textdiagnostik gekennzeichnet und keine Produktionsfreigabe. Der normale Kundenweg setzt die Qualitätsgates ebenfalls auf Warnung; Developer kann je Konfiguration strenger sein. Ihre erste zufällige Novelty-Richtung ist für Fortsetzungen eingefroren. Zwei identische Wiederholungen im ersten Standardlauf wurden lokal wiederverwendet; neu gestartete Läufe unterscheiden die Vorkommen.

## Ergebnisse

| Modus | Geschichte | Wörter | Modellstufen inkl. lokaler Wiederholung | Luna | Sol 6.1 | Mittel /10 | Textstatus |
|---|---|---:|---:|---:|---:|---:|---|
| Talea-Folge | [Der Topf läuft weg](episode.md) | 1230 | 1 | 7.7 | 8.1 | 7.9 | unverified |
| Wunder & Witz | — | — | 6 | offen | offen | — | no-story |
| Geschichte | [Der Waldpausenhof mit dem Schlangenkürzer](standard.md) | 811 | 15 | 6.3 | 6.7 | 6.5 | quality_gate_failed |
| Bilderbuch | [Der Hut hob ab](storybook.md) | 559 | 3 | 7.2 | 7.6 | 7.4 | failed |
| Kapitelbuch | [Platsch macht große Wellen](chapterbook.md) | 7621 | 33 | 7.5 | 7.2 | 7.35 | text-produced |
| Buchwerkstatt | [Pip und die durstige Waldkarte](workshop.md) | 489 | 3 | 6.2 | 7.2 | 6.7 | accepted |
| Developer | [Der geheime Kegelwart im Wald](developer.md) | 698 | 12 | 7.5 | 7.1 | 7.3 | quality_gate_failed |
| Gemeinsamer Kandidat | — | — | 3 | offen | offen | — | no-story |

## Tatsächliche Textwege und übertragbare Bausteine

| Kachel | Textkern | Zu prüfender Vorteil |
|---|---|---|
| Talea-Folge | episode/engine.ts; episode/prompts.ts | Figurenbibel, eigener Wunsch der Pool-Hauptfigur, eigene Stimmen, leiser Wendepunkt und Schlussgag; ein gemeinsamer Autorenaufruf |
| Wunder & Witz | wonder/engine.ts; wonder/prompts.ts | Ursache, veränderte Lage und Zustand nach jeder Szene; unabhängiges Planlesen |
| Geschichte | standard-mode-generation.ts → dev-mode-generation.ts | Persönliche Erinnerungen, Figurenkontinuität, Artefaktbesitz und belegte Avatarentwicklung außerhalb des Textkerns |
| Bilderbuch | storybook/engine.ts → oneshot-stage.ts | Knappes Seitenbudget, Vorleserhythmus, Umblätter-Moment und gezielte Kontinuitätskorrektur |
| Kapitelbuch | storybook/book/engine.ts | Bandfrage, Figurenmotor, bindendes Logbuch aus veröffentlichten Kapiteln, Wissen/Besitz/offene Fäden, fortsetzbare Batches |
| Buchwerkstatt | book-workshop/engine.ts | Kleiner verbindlicher Plan, Verständnisfragen allein aus dem Text, begrenzte Reparatur und erneute Prüfung genau dieser Fassung |
| Developer | dev-mode-generation.ts | Formverträge, harte Textprüfungen und Schutz davor, dass ein schwächeres Modell die Autorenstimme überschreibt |

Die sichtbare Auswahl hat sieben Wege und sechs unterschiedliche Textkerne. Zusätzlich existieren explizite Legacy-Schalter (useLegacyPipelineV2 und useCharacterPool=false), die keine der sieben Kacheln auswählen. Sie gehören zum technischen Bestand, nicht zu den hier getesteten Wizard-Modi.

## Einzelurteile und Fehler

### Talea-Folge

**gpt-6-luna: 7.7/10.** Ein lebendiges, gut vorlesbares Koboldabenteuer mit klarer Wunderregel, stillem Moment und rundem Schlussgag. Kicher hat eine erkennbare Schwäche und trifft eine wichtige Wahl, während die Kinder die konkrete Lösung finden. Die verlangte Pool-Hauptfigur fehlt, daher verfehlt die Geschichte einen zentralen Teil des Auftrags. Ungeprüfte Zitate in: causalityAndRule; diese werden nicht als Textbelege übernommen.

**gpt-6.1-sol: 8.1/10.** Eine starke, warmherzige Vorlesegeschichte mit eigenständigem Hauptcharakter und gelungenem Schlussgag. Für eine rundum überzeugende Fassung muss vor allem die Wunderregel beim ersten Topftreffer konsequent gelten.

### Wunder & Witz

Kein fertiges Manuskript. Ursache: Error: [wonder-story-v1] Der Plan hat nach dem Lektorat offene Probleme: Kapitel 3–4: Die Rückgabe ist zu arbeitslastig: Nach Busch und Hut folgen vier fast gleichartige Gegenstandsproben, dazu Falten und ein stiller Moment. Kürze die Wiederholungen, etwa indem Ben die vier passenden Zonen in einem Zug zuordnet und die Gruppe sie gemeinsam zurückfärbt; so bleibt mehr Raum für Kichers Entscheidung und den Schlussgag. Kapitel 2–3: Der Busch wird als eine der sieben weißen Sachen gezählt, doch die Regel sagt, dass Farbe an der durchquerten Bandstelle bleibt. Kläre, wie der verwurzelte Busch diese Zone durchquert und wie genau Nora und Kicher das Band auf demselben Weg zurückführen. Zeige die Bewegung eindeutig, damit Bens Beobachtung die Lösung wirklich trägt.


### Geschichte

**gpt-6-luna: 6.3/10.** Ein klar erzählter, sanft-magischer Text mit einem gelungenen Schlussbild und einer spürbaren kleinen Verlustangst. Als eigenständige Vorlesegeschichte ist er brauchbar; den Auftrag verfehlt er vor allem bei Hauptfigur, Abenteuer und Schlussgag.

**gpt-6.1-sol: 6.7/10.** Eine brauchbare, stellenweise berührende Vorlesegeschichte mit einer handlungsstarken Nora. Für größere Eigenständigkeit fehlen eine klar vorbereitete Wunderauflösung, mehr Entscheidungskraft für Pip und ein überraschender Schluss. Die gewünschte Hauptfigurenkonstellation wird deutlich verfehlt.

### Bilderbuch

**gpt-6-luna: 7.2/10.** Eine klare, warmherzige Vorlesegeschichte mit gutem Zusammenspiel und einer leicht merkbaren Hutregel. Kicher prägt den Anfang und den Schluss, doch in der entscheidenden Rettung bleibt er eher Anlass als Handlungsträger.

**gpt-6.1-sol: 7.6/10.** Eine starke, gut vorlesbare Geschichte mit eigenwilliger Hauptfigur, wirksamen Kindern und sanftem Witz. Für größere Geschlossenheit brauchen Wunderregel und Gewinnbedingung mehr Präzision.

### Kapitelbuch

**gpt-6-luna: 7.5/10.** Ein warmes, klar gebautes Abenteuer mit wirksamen Beiträgen der Kinder und einer nachvollziehbaren Rettung. Als Vorlesetext funktioniert es, verfehlt aber die gewünschte Hauptrolle: Platsch ist ein sympathischer Begleiter, während Nora die Geschichte trägt.

**gpt-6.1-sol: 7.2/10.** Ein warmes, stellenweise sehr komisches Kapitelbuch mit starker Nora und wirksamen Begleitern. Für eine überzeugende Endfassung müssen Wunderregel und Bewegungsabläufe klarer, die Arbeitsphasen knapper und die beauftragte Pool-Hauptrolle tatsächlich zentral werden.

### Buchwerkstatt

**gpt-6-luna: 6.2/10.** Eine klare, sanfte Vorlesegeschichte mit einem brauchbaren Schlussbild und gut gesetztem Ruhepunkt. Als eigenständiger Text ist sie ordentlich, verfehlt aber die zentrale Figurenaufgabe: Der verlangte Kobold fehlt, und Pip verfolgt nicht seinen Profilwunsch.

**gpt-6.1-sol: 7.2/10.** Eine gut vorlesbare, sanft komische Geschichte mit wirksamen Kinderfiguren und gelungenem Schlussbild. Für größere Eigenständigkeit braucht Pip einen persönlicheren Wunsch und eine schwierigere, folgenreiche Wahl.

### Developer

**gpt-6-luna: 7.5/10.** Ein sorgfältig gebautes, gut vorlesbares Waldspiel mit einem überzeugenden Wendepunkt um Bens zerbrochenen Stock. Als eigenständige Kurzgeschichte funktioniert es ordentlich; die geforderte Pool-Hauptfigur und der überraschende Schlussgag fehlen.

**gpt-6.1-sol: 7.1/10.** Eine sorgfältige, leise Spielgeschichte mit starkem Gegenstandsmotiv und überzeugender Kinderkooperation. Literarisch gut, aber beim Wunder etwas funktional und beim Humor zurückhaltend; Pool-Hauptrolle, Kapitelgestaltung und Schlussüberraschung erfüllen den Auftrag nur teilweise.

### Gemeinsamer Kandidat

Kein fertiges Manuskript. Ursache: Error: Codex unified-episode-oneshot-repair failed (1): exceeded retry limit, last status: 429 Too Many Requests


## Reproduktion

<code>bun scripts/pipeline-bakeoff/queue.ts</code> führt fehlende Baselines nacheinander aus. <code>bun scripts/pipeline-bakeoff/review.ts Logs/pipeline-bakeoff/2026-10-26/MODUS</code> bewertet eine vorhandene Geschichte. Exakt passende, bereits vollständig gespeicherte Anfragen werden beim Fortsetzen lokal wiederverwendet. Unterschiedliche Wiederholungen innerhalb eines Laufs bleiben getrennt. Der Codex-Transport garantiert nicht den nativen JSON-Modus des Produktionsproviders; Formatfehler sind deshalb gesondert zu lesen. Rein technische HTTP-429-Drosselung erhält eine Pause und einen Retry; keine anderen Konten, keine gekauften Credits, kein Quotenreset. Quellhashes vor der Zusammenführung stehen in [baseline-quellen.json](baseline-quellen.json); Eingaben, rohe Antworten und Ereignisse bleiben unter Logs/pipeline-bakeoff/2026-10-26.
