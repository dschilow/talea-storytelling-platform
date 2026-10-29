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

Die Bildprüfung kostete mehr als die eigentliche Bilderzeugung. Zwei Bilder führten nach leeren Gemini-Antworten zum teureren Terra-Leser. Acht leere Antworten stehen im Anwendungslog mit null Tokens und null USD; eine nachgewiesene zusätzliche Gebühr enthalten diese Einträge nicht. Kostenfreiheit ist damit aber nicht bewiesen: Der Adapter verwendet bei fehlenden Nutzungsdaten ebenfalls null Tokens und eine daraus geschätzte Gebühr. Die Aufrufe erhöhten jedenfalls Wartezeit und Aufrufzahl. Eine weitere Bildprüfung lief in einen Timeout. Das Titelbild wurde mehrfach wegen Identitätsabweichungen verworfen; der Abschluss meldet `coverMissing: true` und verwendet ein Kapitelbild als Ersatz. Alle sechs Kapitelbild-Slots sind belegt, teilweise mit als fehlerhaft markierten Versuchen.

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

## FLUX-Vergleich mit fünf weiteren Geschichten

Weitere Grundlage sind die fünf am 29.10.2026 bereitgestellten JSON-Exporte und PDFs. **Alle fünf Läufe sind
Figurenserien (`character-series-v1`)**, nicht die andere Lane Talea-Folge. Jeder plante ein Titelbild plus sechs
Kapitelbilder und bezahlte elf Bildaufrufe. Die Bildanzahl wurde zusätzlich direkt in den PDFs geprüft.

| Geschichte | Tatsächliches Modell | Bildaufrufe | Gedruckte Bildplätze / 7 | Bilder, US-Cent | Prüfung, US-Cent | Zusammen, US-Cent |
|---|---|---:|---:|---:|---:|---:|
| Der Bücherwagen trippelt rückwärts (`b96b1be1`) | FLUX 3 Klein | 11 | 6 | 3,11 | 1,77 | 4,88 |
| Mein Tee fährt nach oben (`6dcb84ba`) | FLUX 3 Klein | 11 | 4 | 3,23 | 1,37 | 4,60 |
| Die Klingel meldet Federn (`f2330237`) | FLUX 2 Klein 4B | 11 | 4 | 0,97 | 0,88 | 1,85 |
| Sieben Räder und eine Mützenfahne (`feec85c9`) | FLUX 2 Klein 9B KV | 11 | 4 | 1,82 | 1,41 | 3,23 |
| Der Laubsauger macht Herbst (`0448ae4a`) | FLUX 2 Klein 9B KV | 11 | 3 | 2,76 | 1,84 | 4,60 |

Das sind **Bildkosten**, nicht die gesamte Storyrechnung. Die Prüfkosten sind weiterhin Bestandteil von
`textCostUSD`. Bei „Tee“ und „Klingel“ wird ein Kapitelbild zusätzlich als Cover verwendet: vier gedruckte
Bildplätze bedeuten dort drei unterschiedliche freigegebene Bilder. Die fehlenden Bilder fehlen bereits im
Generierungsergebnis; der PDF-Export hat sie nicht verschluckt.

Diese unterschiedlichen Geschichten sind kein kontrollierter Modellvergleich. Insbesondere belegen sie
**keine höhere Stabilität von FLUX 2**: Auch dessen Läufe verbrauchen sämtliche vier Bildreparaturen.
FLUX 3 lieferte im Bücherwagen-Lauf sogar die meisten belegten Bildplätze.

Die Einzelabrechnungen zeigen außerdem:

- FLUX 3: ein normaler Erstaufruf **0,0025 USD**, ein Szenen-Edit mit zusätzlicher bestehender Szene in diesen
  Logs **0,0037 USD**. Ein Edit war damit 48 % teurer als ein Erstbild, noch ohne erneute Prüfung.
- FLUX 2 9B KV: im Laubsauger-Lauf **0,00156–0,00325 USD je Bildaufruf**. „Immer halb so teuer“ trifft hier
  nicht zu; einzelne Aufrufe waren teurer als ein normales FLUX-3-Erstbild.
- Fehlende Zahnlücken, übertriebene spitze Ohren, falsche Personenhandlungen und zusätzliche Figuren kommen
  als Qualitätsbefunde vor. Daneben stehen echte Prüfausfälle. Ein fehlendes Bildurteil ist kein Beleg für ein
  schlechtes Bild.

### Herstellerdokumentation

Am 29.10.2026 geprüft:

1. [BFL: FLUX 3 Image Klein](https://docs.bfl.ml/flux_3/flux3_image_klein) beschreibt Klein als
   **5,6B-Modell**, nicht als das große FLUX-3-Modell. Die destillierte Variante verwendet 16 Schritte. BFL
   empfiehlt ausdrücklich den Prompt-Upsampler beziehungsweise vollständig ausgearbeitete Captions.
2. [BFL: Prompting Basics](https://docs.bfl.ml/guides/prompting_unified_basics) und
   [Layout-Prompts](https://docs.bfl.ml/guides/prompting_layout) empfehlen Medium, konkrete Szene, räumliche
   Beziehungen und sichtbare Eigenschaften statt Bewertungswörter und wiederholter Anweisungen.
3. [BFL: Multi-Reference Editing](https://docs.bfl.ml/guides/prompting_editing_multi_reference) beschreibt
   ausdrücklich die Rolle jeder Eingabereferenz und die Zuordnung nach Reihenfolge.
4. [BFL: technische Parameter](https://docs.bfl.ml/guides/prompting_unified_technical) erklärt positive
   Beschreibungen statt negativer Prompts.
5. [Runware: FLUX 3 Image Klein](https://runware.ai/docs/models/bfl-flux-3-image-klein) dokumentiert
   `inputs.referenceImages` und `settings.boundingBoxes`, mit `[top, left, bottom, right]` auf 0–1000.
   Die vorhandene Koordinatenreihenfolge ist korrekt. Ein expliziter Prompt-Upsampling-Schalter ist dort nicht
   dokumentiert; daraus lässt sich **nicht** schließen, ob Runware intern einen Upsampler betreibt.

### Kontrollierter lokaler Vergleich

Werkzeug: [series-prompt-ab.ts](../scripts/image-bench/series-prompt-ab.ts). Drei Original-Szenen (Bücher fallen
aus einer Kiste, ein Hocker mit Teetasse steigt, Tee spritzt auf einen Ärmel), je zwei feste Seeds, sechs
Varianten, insgesamt **36 neue Erstbilder**:

- Produktionsprompt FLUX 3 mit einem Bogen und Figurenregionen;
- zusammenhängende Caption mit beschreibenden Regionen und demselben Bogen;
- dieselbe Methode mit Einzelreferenzen;
- beide Caption-Varianten zusätzlich ohne Positionsbindung;
- FLUX 2 9B KV mit seinem unveränderten Produktionsprompt.

Die Captions wurden von etwa 3400–4100 auf etwa 1400–1800 Zeichen verkürzt, ohne die geplante Handlung zu
streichen. Es wurden weder neue Geschichten geschrieben noch Bildfehler durch automatische Wiederholungen
versteckt. Alle 36 Bildanfragen lieferten ein Bild; das sagt noch nichts über deren Freigabefähigkeit.

**Referenzgrenze:** Die originalen Avatar-Porträts sind in den Exporten nicht enthalten. Verwendet wurden
bereits vorhandene fiktive Benchmark-Avatare und die öffentlichen Serienporträts. Alle Varianten sehen
dieselben Figurenpixel, aber die Identität dieser Avatarbilder mit den Produktionsreferenzen ist nicht
belegt. Die Fixture-Datei hält diese Einschränkung fest.

**Sichtbefund, keine automatische Qualitätsnote:** Kürzere Captions und Einzelreferenzen brachten keinen
zuverlässigen Gewinn. FLUX 3 bewahrte die Gesichter oft besser, verfehlte aber weiterhin Gegenstandsbeziehungen;
etwa wurde die Kurbel mit dem Hocker verschmolzen. Ohne Positionsbindung entstand unter anderem ein zweiter
Hocker. FLUX 2 zeichnete in der Kistenszene die fliegenden Bücher deutlicher, aber auch deutlich spitze
Elfenohren. Keine Variante rechtfertigt die Aussage „kommt zuverlässig ohne Prüfung aus“.

Die sechs begonnenen Prüfungen mit **unveränderten Gemini-3.8-Flash-Kriterien** ergaben **kein einziges
Bildurteil**: fünf Antworten enthielten `native_finish_reason: "SAFETY"`, eine
`error.code: 403` mit `PROHIBITED_CONTENT`. Die Testbilder zeigen bekleidete gezeichnete Figuren in
Alltagsszenen; es handelt sich nicht um einen auswertbaren Qualitätsbefund. Weitere Prüfanfragen wurden
gestoppt. Die übrigen Bilder wurden ausdrücklich als **ungeprüfte Testbilder** erzeugt, nicht freigegeben.
Es wurde kein Ersatzprüfer benutzt und keine Sicherheitseinstellung abgeschaltet.

Runware meldete **0,08501 USD für die 36 Bilder**. Für die sechs gesperrten Prüfanfragen fehlten
Nutzungs-/Kostenangaben. Das Testjournal hält dafür vorsorglich **0,21 USD reserviert**; diese Reservierung
ist keine behauptete Anbieterabrechnung. Auf das Limit von 1,50 USD sind damit 0,29501 USD angerechnet.

### Übernommen: Provider-Sperren ausdrücklich behandeln

Der OpenRouter-Adapter verlor bisher den nativen Ablehnungsgrund: Aus `SAFETY` wurde „Empty response“.
Dadurch konnte die gleiche gesperrte Anfrage als vermeintlicher Ausfall erneut, auf einem anderen Tarif
oder bei einem Ersatzprüfer landen.

- `StorybookSafetyBlock` erhält einen begrenzten, protokollierbaren Grund und eventuell gemeldete Kosten.
- Der LLM-Port wiederholt eine ausdrückliche Sperre weder auf Flex/Standard noch bei einem Ersatzmodell.
- Das äußere Figurenserien-Budget behandelt auch eine Sperre ohne Tokens nicht als kostenlosen Kapazitätsfehler.
- Die Bildphase speichert `series_vision_safety_blocked` und den Grund. Das erzeugte Bild bleibt diagnostisch
  erhalten, aber **ohne Freigabe**; es gibt dafür weder erneute Prüfung noch Neuzeichnung.
- Normale Timeouts und tatsächlich leere/unlesbare Antworten behalten ihre begrenzte Wiederherstellung.
  Andere Bilder derselben Geschichte werden weiter geprüft.

Regressionstests decken Erstprüfung, Ersatzprüfung, verzögerte Wiederherstellung, Tarifwechsel und den
Erhalt gemeldeter Gebühren ab. Aus den älteren Exporten allein lässt sich nicht rückwirkend bestimmen,
welche ihrer leeren Antworten ebenfalls Safety-Sperren waren.

Validierung: **86 Tests in vier Dateien bestanden**. Die geänderten Dateien einschließlich des Benchmarkskripts
haben keine Typdiagnostik; der Gesamtprojekt-Typcheck enthält weiterhin bereits vorhandene Fehler.

**Nicht übernommen:** die experimentellen Captions, die Abschaffung der Bildprüfung oder eine automatische
Modellumstellung. Der FLUX-2-9B-KV-Standard bleibt unverändert. Ein belastbarer weiterer Vergleich braucht
die Original-Avatarreferenzen und wieder verwertbare Prüfantworten. Die gemessenen Unterschiede reichen
nicht für eine zugesicherte Erstversuchsquote oder eine pauschale Ersparnis.
