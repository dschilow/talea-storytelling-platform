# Figurenserie: Abbrüche und Kosten am 29. Oktober 2026

Untersucht wurden der exportierte Lauf `abfc9b06` und die zugehörige PDF sowie die Railway-Backend-Logs. Die folgenden Beträge stammen aus den protokollierten Anbieterabrechnungen dieses einen erfolgreichen Laufs; die zwei anderen, abgebrochenen Geschichten sind darin nicht enthalten.

## Warum zwei Geschichten abbrachen

Die Läufe `9019823b` und `23302f05` brachen um 12:42:43 beziehungsweise 12:48:33 Uhr (Europe/Berlin) bei `Serienbild 0 braucht eine körperliche Handlung ...` ab. Die Bildregie konnte den Titelbildplan nicht in das verlangte Schema bringen. Der Text war zu diesem Zeitpunkt bereits erzeugt und geprüft. Das war kein Railway-Serviceausfall und kein Beleg für ein Problem durch parallele unterschiedliche Geschichten.

Zusätzlich gab es um 12:42:11 Uhr einen abgewiesenen Doppelstart: Für dieselbe Figurenwelt im selben Kinderprofil lief bereits eine Folge. Diese Sperre schützt die Folgenchronologie und bleibt erhalten. Unterschiedliche Figurenwelten können parallel laufen, soweit das allgemeine Generierungslimit dies zulässt.

Die Bildplanung verwendet jetzt bei einem ungültigen Titelbildplan einen bereits validierten Kapitelbildmoment mit Serienfigur, möglichst zusammen mit einem Familienavatar, in einer eigenen Cover-Komposition. Die gültigen Szenen-, Quellen- und Figurenprüfungen bleiben Voraussetzung. Ein kaputtes Kapitelbildschema wird damit nicht freigegeben. Das Feld `coverSourcePage` macht den Ersatz im Bildplan nachvollziehbar.

## Kosten des erfolgreichen Laufs

| Bestandteil | USD | US-Cent, gerundet |
|---|---:|---:|
| Erster Storyentwurf, Sol | 0,021834 | 2,18 |
| Drei Textprüfungen und zwei lokale Sol-Korrekturen | 0,018757 | 1,88 |
| Bildplanung, Haiku | 0,002590 | 0,26 |
| Bildprüfung, Gemini plus Terra-Ersatzleser | 0,034616 | 3,46 |
| Zehn Bildaufrufe inklusive Korrekturen | 0,028600 | 2,86 |
| Avatarentwicklung | 0,000701 | 0,07 |
| **Gesamt** | **0,107098** | **10,71** |

`textCostUSD` im bisherigen Abschlusslog umfasst sämtliche LLM-Aufrufe und damit auch die Bildprüfung. `imageCheckCostUSD` ist darin enthalten und darf nicht noch einmal zum Gesamtpreis addiert werden.

Die Bildprüfung kostete mehr als die eigentliche Bilderzeugung. Zwei Bilder führten nach leeren Gemini-Antworten zum teureren Terra-Leser. Acht protokollierte leere Antworten wurden mit null Tokens und null USD abgerechnet; sie erhöhten Wartezeit und Aufrufzahl, nicht unmittelbar die Rechnung. Eine weitere Bildprüfung lief in einen Timeout. Das Titelbild wurde mehrfach wegen Identitätsabweichungen verworfen; der Abschluss meldet `coverMissing: true` und verwendet ein Kapitelbild als Ersatz. Alle sechs Kapitelbild-Slots sind belegt, teilweise mit als fehlerhaft markierten Versuchen.

## Belegte Optimierungen

1. **Bereits bezahlten Text vor Titelbild-Schemafehlern bewahren.** Der validierte Ersatzmoment verhindert den hier gefundenen Abbruchpfad ohne einen weiteren Bildplanungsaufruf.
2. **Tippfehler lokal korrigieren.** Ein eindeutiger, zitierter kleiner Schreibfehler wie `Hofenster` → `Hoffenster` benötigt keinen Sol-Auftrag mit dem ganzen Manuskript und keinen weiteren vollständigen Kontrollaufruf. In diesem Lauf kostete die entsprechende zweite Reparatur mit Nachprüfung zusammen rund 0,00819 USD, also 0,82 US-Cent. Namen, Wortersetzungen, mehrdeutige Treffer und größere Eingriffe bleiben ausgeschlossen.
3. **Kleinere Aufträge für echte lokale Korrekturen.** Sol erhält weiterhin das vollständige Manuskript, die belegten Fehler, die Weltregeln und die zulässige bisherige Familiengeschichte. Bei kleinen Korrekturen werden zukünftige Folgenpläne und der gesamte übrige Serienkontext nicht erneut mitgesendet. Große Fehler und fehlende erste Begegnungen erhalten weiterhin den vollständigen Vertrag.
4. **Keine verschachtelten Wiederholungen der Bildprüfung.** Die Bildphase organisiert bereits Flex, Standard und den unabhängigen Ersatzleser. Die zusätzliche kostenlose Wiederholung im äußeren Budget wird für diese Aufrufe übersprungen. Die unabhängige Prüfung entfällt nicht.
5. **Logik vor Tippfehlern.** Die zwei Plätze im Textlektorat sind für kausale Fehler und widersprüchliche Gegenstandswege reserviert. Bis zu drei kleine Schreibfehler können separat gemeldet und sicher lokal angewendet werden.

Die Anzahl der vorgesehenen Illustrationen, der Storyautor und die Sperren für echte Identitäts-, Anatomie- und Sicherheitsfehler wurden für diese Optimierung beibehalten. Die neue Figurenserien-Policy trägt Version 12.

## Verworfenes Experiment

Vier echte Gemini-Prüfungen verglichen die bisherige Stilvorlage (1216 × 832) mit einer auf 512 Pixel verkleinerten Kopie. Das gute Kontrollbild wurde in beiden Varianten angenommen, das Bild mit mehrfach gezeichnetem Drachen in beiden Varianten abgelehnt. Die Eingabetokenzahlen blieben jedoch identisch: 4918 beziehungsweise 4996. Die Kosten lagen bei 0,00422475 USD in beiden guten Fällen und 0,004647 / 0,0047145 USD im Fehlerfall. Die kleine Abweichung entstand im Antwortumfang. Deshalb wurde die Verkleinerung nicht übernommen. Gesamter gemessener Vergleichsaufwand: 0,017811 USD.

## Einordnung der neuen Geschichte

Redaktionelle Einschätzung: **7/10 insgesamt**, Text ungefähr **7,5/10**. Die klare erste Begegnung, aktive Kinder und die tatsächliche Lieferfahrt funktionieren. Abzüge gibt es für kleine Gegenstands- und Handlungsanschlüsse (erst loslassen, dann weiterhin festhalten; Übergabe der Klammer), den nicht vollständig vorbereiteten Schlussgag und wechselnde Wagenformen beziehungsweise nicht genau getroffene Bildhandlungen. Sechs unterschiedliche Illustrationen sind im PDF vorhanden; ein eigenständig freigegebenes Titelbild fehlt laut Laufprotokoll.

Die automatisierten Regressionstests prüfen diese technischen Fehlerpfade und das begrenzte Korrekturverfahren. Sie beweisen keine feste Gesamtersparnis und keine Fehlerfreiheit neuer Manuskripte. Ein vollständiger neuer Produktionslauf wurde für diesen Audit nicht bezahlt; eine neue pauschale Gesamtkostenzahl wird daher nicht als gemessen ausgegeben.
