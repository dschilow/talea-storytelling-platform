# Wunder & Witz

Die neue, ausdrücklich wählbare Story-Pipeline heißt im Admin-Wizard **Wunder & Witz**. Ihr API-Wert ist `storybookMode: true` plus `storybookEngine: "wonder-story-v1"`. Sie startet mit Sol 6.1 als Autor; die Modellauswahl bleibt möglich. Normale Nutzer erhalten weiterhin ihre bisherige Pipeline. Die Änderung ist lokal implementiert, nicht veröffentlicht.

## Wie die Geschichte entsteht

1. Der vollständige Wizard-Brief enthält Alter, Länge, Stimmung, Wünsche, Lernziel, Elternvorgaben, gesperrte Begriffe, Avatarfähigkeiten und belegte Erinnerungen.
2. Drei unterschiedliche Ideen konkurrieren miteinander. Eine passende redaktionelle Vorlage kann helfen; eine freie Idee bleibt ausdrücklich möglich. Vorlagen werden nach Genre, Alter, Spannung und zuletzt verwendeten Konzepten ausgewählt.
3. Ein zusammenhängender Kapitelplan legt Entscheidungen der Avatare, Ursache und Wirkung, Humor, früh eingeführte Hinweise und die tatsächliche Auflösung fest. Ein fliegender Drache darf seine Fähigkeiten behalten. Der Plan muss den einfachsten Ausweg berücksichtigen.
4. Ein Lektorat sucht konkrete Probleme im Plan. Höchstens zwei Reparaturen mit erneuter Prüfung; ein weiterhin widersprüchlicher Plan wird nicht ausgeschrieben.
5. Sol schreibt das vollständige Manuskript in einem zusammenhängenden Aufruf. Bei diesen Buchlängen schützt das die Stimme und die Übergänge besser als viele voneinander getrennte Mini-Aufträge. Kapitel bleiben einzeln adressierbar.
6. Ein Erstleser kennt nur Text und Leserwünsche, nicht den Plan. Er muss Verständlichkeit, aktive Avatarbeiträge und tatsächlich komische Stellen mit nachprüfbaren Zitaten belegen. Er prüft auch wiederholte Handlungsschritte und zu lange Regelerklärungen. In Produktion kommt dieses Lektorat aus einer anderen Modellfamilie.
7. Eine gezielte Überarbeitung betrifft die nötigen Kapitel. Unbetroffene Kapitel bleiben unverändert. Die Neufassung wird erneut gelesen und ersetzt den Entwurf nur ohne neue harte Fehler. Offene harte Fehler verhindern die Textfreigabe und damit Ausgaben für Bilder.

Die vorhandene Talea-Anbindung übernimmt Illustrationen, Figurenidentitäten, Artefakte, Kostenprotokolle und Avatarentwicklungen. Neue Nebenfiguren erhalten feste Identitäten für die Bilder; sie werden nicht als erfundene Datenbankeinträge in den Figurenpool geschrieben. Es gibt keine vorgetäuschte Qualitätsnote: Das Ergebnis enthält konkrete Lektoratsbelege und verbleibende Verbesserungshinweise.

## Redaktionelle Bibliothek

Sieben eigene Konzepte liegen in `backend/story/wonder/library.ts`: freier Schatten, Donnerwäsche, farbensammelnder Regenbogen, Roboterpicknick, Waldlieferung, rückwärts gefeiertes Fest und Drachenschluckauf. Jedes enthält tragende Szenen, Humorquelle, Grenzen der Anpassung und eine kurze literarische Probe.

Für **Der Kuchen kommt zuerst** gibt es zusätzlich ein vollständiges eigenes Referenzmanuskript in `masters.ts`. Der Autor erhält es nur bei dieser gewählten Vorlage. Die Adaption muss aus den tatsächlichen Avataren entstehen; Beispielnamen und erfundene frühere Erlebnisse dürfen nicht übernommen werden. Die Bibliothek ist ein redaktioneller Startbestand, keine Sammlung bereits mit Kindern validierter Bestseller.

## Ohne OpenRouter testen

Aus dem Repository-Stamm, mit Bun und einer bereits angemeldeten Codex-CLI:

```powershell
bun scripts/wonder-story/run.ts --case magic --length medium
```

Das verwendet **gpt-6.1-sol über die Codex-Anmeldung und das vorhandene Kontingent**. Der CLI-Prozess erhält einen leeren temporären Arbeitsordner, keinen Zugriff auf Projektgeheimnisse im Prompt und einen reinen Textauftrag. Authentifizierung bleibt in Codex; die Anwendung übernimmt keine Anmeldetokens. Dieser Transport ist ausschließlich ein lokales Testwerkzeug, kein Produktionsdienst. Autor und Lektor sind hierbei dasselbe Modell, also keine unabhängige Modellprüfung.

Mit `TALEA_CODEX_BIN` lässt sich der CLI-Pfad festlegen. Der Standard sucht zunächst die gebündelte Desktop-CLI. Bei ausgeschöpftem Kontingent endet der Lauf; es gibt keinen automatischen kostenpflichtigen Wechsel.

Explizite API-Tests:

```powershell
bun scripts/wonder-story/run.ts --case realistic --length short --provider openrouter
bun scripts/wonder-story/run.ts --case magic --length medium --provider openrouter --resume-from Logs/wonder-story/pilot-magic-v2 --out Logs/wonder-story/resumed
bun scripts/wonder-story/report.ts
```

Der Testtransport verwendet `OPENROUTER_API_KEY` oder `OpenRouterAPIKey`, Sol 6.1 als Autor und Gemini 3.8 Flash als Lektor, höchstens zwölf neue API-Aufrufe pro Lauf. Das ist eine Aufrufbegrenzung, keine garantierte Dollarobergrenze. Modellkosten werden aus den Anbieterantworten protokolliert; fehlende Kostenangaben weist der Bericht separat aus. Erneut verwendete Antworten erzeugen keine neue Rechnung und behalten ihre ursprüngliche Modellherkunft. Nur exakt passende Aufgaben werden wiederverwendet, auch über mehrere Wiederaufnahmen hinweg.

Fixtures: `magic`, `realistic`, `dragon`, `space`, `bedtime`, `fairytale`; Längen `short`, `medium`, `long`. Alle Avatare sind fiktiv. `fairytale` bildet die gemeldete Kombination Märchen/Fantasiewelt/6–8/kurz mit Reimen, Wendung und fiktiven Elternvorgaben nach. `--dry` schreibt nur den Planungsauftrag. Pro Lauf liegen Brief, tatsächliche Modellaufträge, Antworten, Lektoratsbelege, Kosten und fertiger Vorlesetext unter `Logs/wonder-story/`. Fehlgeschlagene Läufe bleiben sichtbar.

### Korrektur des Produktionsabbruchs vom 19. Oktober

Der erste gemeldete Produktionslauf brach nach etwa 5½ Minuten bereits bei `wonder-plan` ab: Das Hinweisverzeichnis erfüllte die Prüfung der Vorbereitung und späteren Auflösung nicht. Die Story-Münze wurde automatisch zurückgebucht. Die alte Wiederholung erhielt nur die Sammelmeldung und erzeugte den gesamten Plan erneut. Die einzelnen abgelehnten Verweise waren nicht protokolliert; ihre konkrete ursprüngliche Form lässt sich deshalb nicht nachträglich belegen.

Die Prüfung benennt jetzt Eintrag und fehlerhafte Kapitelnummern. Sind ausschließlich diese Verweise fehlerhaft, korrigiert ein kurzer Modellaufruf nur `setups` anhand der vorhandenen Szenen. Alle übrigen Planfelder bleiben erhalten; der vollständige Plan muss erneut durch dieselbe Strukturprüfung und das unabhängige Lektorat. Fehlerhafte Auflösungen im selben oder einem früheren Kapitel bleiben gesperrt. Bei anderen Formatfehlern bekommt die Wiederholung die tatsächlich abgelehnte Ausgabe und die konkreten Fehler. Ungültige Ausgaben werden für die geschützten Admin-Diagnoselogs protokolliert.

Eine echte Sol-/Gemini-Probe reparierte ein absichtlich beschädigtes Verzeichnis eines fiktiven Testplans samt unabhängiger Prüfung in 10,5 Sekunden für rund 0,012 US-Dollar. Das ist eine Einzelmessung der Reparatur, keine Zeitgarantie für eine ganze Geschichte. Regressionstests belegen, dass eine weiter ungültige Reparatur nicht ausgeschrieben wird.

Die HTTP-Logs zeigen zudem einen nach rund 37 Sekunden vom Client geschlossenen Handyaufruf und anschließend einen sauber abgewiesenen doppelten Aufruf derselben Story-ID. Die Wiederaufnahme im Wizard wartete bisher höchstens drei Minuten. Bei Wunder & Witz verfolgt sie jetzt denselben Lauf bis zu 15 Minuten; eine neue kostenpflichtige Generierung wird dabei nicht gestartet. Ein terminaler Serverfehler beendet die Wartezeit sofort, und das Verlassen des Wizards beendet die Abfragen. 91 Tests einschließlich dieser Fälle bestehen.

Der zusätzliche vollständige Texttest mit der Märchen-Fixture bestand danach ebenfalls: „Ein Regenbogen kommt selten durchs Fenster“, 1.150 Wörter, vier Modellaufrufe, 0,10905 US-Dollar. Planung und fertiger Text wurden unabhängig gelesen; es war keine Formatwiederholung erforderlich. Testdaten und Text liegen unter `Logs/wonder-story/production-fix-fairytale/`. Illustrationen und echte Kundenavatare waren nicht Teil dieses lokalen Modelltests.

```powershell
bun scripts/wonder-story/repair-probe.ts --source Logs/wonder-story/realistic-completed --out Logs/wonder-story/repair-probe
```

## Verifikation und Grenzen

```powershell
bun test backend/story/wonder/wonder.test.ts backend/story/storybook/quality.test.ts frontend/screens/Story/storyGenerateWithModelFallback.test.ts
cd frontend
bun run build
```

Die Tests prüfen unter anderem Avataridentitäten und Fähigkeiten im Brief, mitgebrachte Artefakte, vorbereitete Auflösungen, exakte Kapitelnummern, echte Textzitate, Abbruch bei unbrauchbaren Plänen, unveränderte Kapitel sowie das Zurückweisen einer verschlechterten Überarbeitung. Der bestehende Bild- und Freigabetest bleibt Teil des Checks.

Die reale Wizard-Komponente wurde separat im Browser bei 320, 390 und 1280 Pixeln sowie mit Tastatur und reduzierter Bewegung geprüft. Das ersetzt keinen angemeldeten Durchlauf gegen die Produktionsdatenbank. Die echten Modelltests betreffen den Text; Bilder und Avataränderungen wurden nicht kostenpflichtig in Produktion erzeugt.

Die vollständigen Projekt-Typprüfungen stoßen auf bestehende Fehler außerhalb dieser Änderung. Die geänderten Produktionsdateien ergeben keine neuen Diagnosen. Die Encore-Client-Regenerierung scheitert lokal am Windows-Socket des Daemons. Der vorhandene Leap-Client importiert `StoryConfig` direkt aus dem Backend und erhält die neue Auswahl dadurch bereits; generierter Code wurde nicht von Hand geändert.

Qualität wird an den tatsächlich gespeicherten Geschichten beurteilt. Die ersten Abenteuerpläne waren zu klein und zu reparaturlastig. Deshalb wurden die Spannungsauswahl und die Erstleserprüfung verschärft. Positive Modellurteile allein beweisen keine Überlegenheit gegenüber der alten Talea-Pipeline oder der Schwerkraft-Geschichte. Ein belastbarer Vergleich braucht gleich konfigurierte alte und neue Geschichten sowie verblindete menschliche Leser.

Fertige Beispiele und die konkreten Testergebnisse stehen in [Wunder-Testgeschichten](story-examples/wonder/README.md).
