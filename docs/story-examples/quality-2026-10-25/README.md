# Story-Qualitätstest vom 25. Oktober 2026

**Korrektur vom 26. Oktober:** Dieser Bericht betrifft die normale Geschichte-Pipeline, nicht die vom Nutzer gemeinte **Talea-Folge (`talea-folge-v1`)**. Die Noten dürfen nicht auf Talea-Folge übertragen werden. Die zuletzt noch enthaltene Änderung am Lektorat der normalen Pipeline wurde am 26. Oktober ebenfalls zurückgenommen. Der gesonderte Talea-Folge-Test ist im [Talea-Folge-Bericht](/C:/MyProjects/Talea/talea-storytelling-platform/docs/story-examples/talea-folge-2026-10-26/README.md) dokumentiert; die Belege liegen unter `Logs/episode-quota/2026-10-26-*`.

Die Ausgangsgeschichte aus der normalen Talea-Pipeline erreicht im separaten Modelllektorat **7,0/10**. Die redaktionell überarbeitete Lesefassung erreicht **7,9/10**. Die getesteten Änderungen an Planung und Autorenprompts verbessern die automatische Erzeugung nicht zuverlässig und wurden zurückgenommen.

[Ausgangsgeschichte: Das Gartenbeet und der geheime Aussaatdienst](vorher.md) · [Überarbeitete Lesefassung: Der Spaten hat Dienst](ueberarbeitet.md)

| Fassung | Luna | Sol 6.1 | Mittel |
| --- | ---: | ---: | ---: |
| Ausgangsgeschichte | 6,95 | 7,05 | 7,00 |
| Versuch 1: strengere Regelprüfung | 6,75 | 6,75 | 6,75 |
| Versuch 2: Kalibrierung und räumliche Abläufe | 6,20 | 7,30 | 6,75 |
| Kontrolllauf: ursprünglicher Plan, engere Autorenhinweise | 6,45 | 6,45 | 6,45 |
| Redaktionelle Überarbeitung | 7,70 | 8,15 | 7,925 |

Die Nachkommastellen ergeben sich aus der Gewichtung der Kriterien; sie drücken keine entsprechende Messgenauigkeit aus. Beide Lektorate stammen aus derselben Modellfamilie. Es gab keine Bewertung mit Kindern oder menschlichen Testlesern.

## Was konkret besser wurde

In der Ausgangsfassung wachsen Rübe und Bohnen bei unterschiedlichen Handlungen: Saat wird gedreht, eine Rübe versteckt, eine falsche Zeichnung verheimlicht. Die Lösung verändert gleichzeitig Saatlage und Auftragsgröße. Ein zuhörendes Kind kann deshalb keine eindeutige Ursache erkennen.

Die Lesefassung reduziert das Wunder auf einen sprechenden, selbst arbeitenden Spaten mit einer beobachtbaren Gewohnheit: Ausgegrabenes wirft er hinter sich. Zwei Versuche zeigen das früh. Dieselbe Wurfrichtung verursacht den Schaden und trägt die Auflösung; die Kinder verändern seine Ausrichtung und prüfen den Landebereich. Ihre Gefühle ändern ihre Entscheidungen, nicht die Naturgesetze der Magie.

Nela hält zunächst an ihrer geraden Zeichnung fest; Jaro möchte seine selbst gezogene Rübe behalten. Die gebogene Wegführung löst diesen konkreten Gegensatz. Beide Kinder handeln selbst. Der Schlussgag setzt die bekannte Wurfgefahr voraus, statt eine neue Fähigkeit einzuführen. Die Geschichte umfasst genau 900 Wörter Erzähltext auf fünf Leseseiten.

| Kriterium | Vorher, Mittel | Überarbeitung, Mittel |
| --- | ---: | ---: |
| Verständlichkeit und Kausalität, Gewicht 20 % | 6,0 | 8,0 |
| Eigenständige Beiträge der Kinder, 15 % | 8,0 | 8,5 |
| Figuren und Dialog, 15 % | 7,0 | 8,0 |
| Gefühl, 10 % | 7,5 | 7,5 |
| Humor, 10 % | 6,5 | 7,5 |
| Tempo und Spannung, 10 % | 7,0 | 8,0 |
| Sprache und Vorlesbarkeit, 10 % | 7,5 | 8,0 |
| Eigenständigkeit und Auflösung, 10 % | 7,0 | 7,5 |

Kleine Schwächen bleiben: Die Lage von Fritzis Eingang und die Ausrichtung des Spatenstiels im Finale könnten noch eindeutiger sein. Das Lektorat liegt deshalb unter 9/10. Die bewertete Lesefassung wurde nach diesen Urteilen nicht weiter verändert.

[Vollständiges Lektorat vorher](bewertung-vorher.md) · [Vollständiges Lektorat der Überarbeitung](bewertung-nachher.md) · [Alle Modellbewertungen als JSON](bewertungen.json)

## Was tatsächlich getestet wurde

Ausgeführt wurde `generateStoryDevMode`, der Textkern `screenplay-first-v12`, den `standard-quality-v1` verwendet. Der Test enthält Ideenprüfung, Logline, Beat-Sheet, Szenenkarten, Schreiben, Reparaturen und Abschlussprüfung. Figuren: die fiktiven siebenjährigen Kinder Nela und Jaro; deutscher Leserbrief für 6–8 Jahre, mittlere Länge, lustiges Gartenabenteuer. `debug: true` unterdrückt Bilder und erlaubt die Prüfung von Geschichten mit offenen Qualitätswarnungen. Datenbank, Pub/Sub und Anbieter-HTTP sind im lokalen Test durch gesperrte oder lokale Adapter ersetzt. Erinnerungen, echte Kundenavatare, Persönlichkeitsänderungen und die produktive API wurden nicht getestet.

Luna (`gpt-6-luna`) übernimmt die unterstützenden Aufgaben, Sol 6.1 (`gpt-6.1-sol`) den Erzähltext. Beide laufen ausschließlich über die vorhandene Codex-Anmeldung und deren Kontingent. Es gibt keinen Wechsel auf eine kostenpflichtige API. Die Kostenangabe `0` in den Testartefakten bedeutet keine zusätzliche API-Rechnung; die Aufrufe verbrauchen Codex-Kontingent. Der CLI-Transport ist kein identischer Ersatz für Anbieter-HTTP: Er verwendet eigene Systeminstruktionen und Denkstufe `low` und erzwingt keinen API-Ausgabetoken-Grenzwert.

Die Bewertung erfolgt anhand von Text und Leserbrief, ohne Pipeline-Noten oder Plan. Die feste Skala und Gewichtung stehen in `scripts/story-quality/evaluation.ts`. Bei manchen frühen Luna-Lektoraten stimmen Anführungszeichen nicht wörtlich mit dem Manuskript überein; diese Belege sind als `unsupportedQuotes` markiert. Beide Lektorate der besseren Lesefassung enthalten ausschließlich nachprüfbare Zitate.

Für die ersten Variationen wurden die tatsächlich verwendeten Kreativvorgaben der Ausgangsgeschichte übernommen. Der abschließende Kontrolllauf verwendet darüber hinaus die fünf exakt passenden ursprünglichen Planungsantworten erneut. Dadurch bleiben Idee, Plan und Szenenkarten identisch. Trotz dieser Kontrolle fällt der Text unter die Ausgangsnote. Ein einzelner Leserbrief und einzelne Modellstichproben beweisen keine generelle Überlegenheit einer Pipeline.

Die drei automatisch erzeugten Varianten und die Ausgangsgeschichte bleiben unter dem internen Premium-Ziel von 9. Ihre Metadaten melden `quality_gate_failed`; das ist eine redaktionelle Zielverfehlung, kein Fehler beim Ausführen des Texttests. Die normale Produktpipeline behandelt solche Qualitätsbefunde als Warnung. Die bessere Lesefassung wurde redaktionell überarbeitet; sie ist ausdrücklich kein Nachweis eines vollautomatischen Qualitätsgewinns.

## Behaltene Änderungen und Prüfung

- Ein lokaler Texttest für die normale Pipeline mit Modellbegrenzung auf Luna und Sol 6.1, Aufrufgrenze, tatsächlichen Prompts, Antworten und Wiederverwendung exakt passender Aufgaben.
- Ein fest gewichtetes Lektorat mit überprüften Textzitaten. Die Endnote wird aus den acht Dimensionen berechnet.
- Eine zusätzliche Anweisung im Produktionslektorat: Ursache und Wirkung aus der Prosa rekonstruieren und unbelegte Ausnahmen konkret benennen. Das verbessert die Fragestellung der Prüfung; ein allgemeiner Qualitätsgewinn des Erzähltexts ist damit nicht belegt. Notenschwellen und Freigaberegeln wurden nicht abgesenkt.
- Der Codex-Testadapter verträgt fehlende Windows-Variablen `TEMP`/`TMP`; sein endgültiger Arbeitsordner liegt wieder außerhalb des Repositorys. Ein abschließender echter Zugangscheck besteht mit beiden Modellen. Die Story-Vergleiche nutzten zuvor leere Arbeitsordner unter dem jeweiligen Logverzeichnis; die protokollierten Läufe enthalten keine Modell-Werkzeugaufrufe.

103 v11-Smoketests, 15 §H/§I-Prüfungen, sechs Gate-Policy-Prüfungen und sechs Cast-Tests bestehen, insgesamt 130 Prüfungen. `git diff --check` besteht. `run-pipeline-tests.ts` lässt sich hier wegen der fehlenden `ENCORE_RUNTIME_LIB` nicht starten. Es wurde nichts veröffentlicht oder an Produktionsdaten geändert.

Die Rohdaten liegen lokal unter `Logs/story-quality/2026-10-25-*`. Ein vorzeitig beendeter Anlauf `2026-10-25-improved` besitzt keine fertige Geschichte und ist nicht in den Bewertungen enthalten.

## Erneut ausführen

```powershell
bun scripts/story-quality/run.ts --smoke --out Logs/story-quality/access-check
bun scripts/story-quality/run.ts --out Logs/story-quality/new-run
bun scripts/story-quality/run.ts --evaluate Logs/story-quality/new-run --out Logs/story-quality/new-review
bun scripts/story-quality/run.ts --resume-from Logs/story-quality/new-run --out Logs/story-quality/controlled-run
```

Der Test erfordert Bun und eine angemeldete, aktuelle Codex-CLI. Falls der Sandbox-Zugriff auf den lokalen Codex-Anmeldedienst blockiert wird, benötigt der Testprozess die entsprechende Ausführungsfreigabe. Die Authentifizierung bleibt in Codex; das Testskript liest oder kopiert keine Anmeldetokens.
