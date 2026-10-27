# Talea-Bildtest: FLUX.2 Klein 4B und FLUX 3 Image Klein

Stand: 27. Oktober 2026. Drei entworfene Geschichtenrahmen, jeweils fünf Bildszenen: Titelbild und vier Handlungsmomente. Die Texte sind Bildregie-Briefings, keine fertig generierten Geschichten. Die Figurenreferenzen stammen aus dem vorhandenen Talea-Benchmark-Roster. Die Szenen, Prompts und die Sichtprüfung wurden in der Codex-Sitzung erstellt; für die Bildregie und die Sichtprüfung wurden keine zusätzlichen Modell-API-Aufrufe berechnet.

Zusätzlich wurden [45 Bilder zu moderner Bildregie, fünf Stilrichtungen und neuen Avatar-/Poolporträts](stil-und-portraets.md) generiert und ausgewertet.

## Ergebnis

| Messung | FLUX.2 Klein 4B | FLUX 3 Image Klein |
|---|---:|---:|
| Erster Versuch: Figurenprüfung bestanden | 7/15 | 14/15 |
| Davon Szenen mit 2 Figuren | 4/5 | 5/5 |
| Davon Szenen mit 3 Figuren | 2/7 | 6/7 |
| Davon Stressszenen mit 4 Figuren | 1/3 | 3/3 |
| Tatsächlich neu gezeichnet | 8 | 1 |
| Davon nach Sichtprüfung korrigiert | 1/8 | 1/1 |
| Bildaufrufe inklusive Wiederholung | 23 | 16 |
| Kosten dieser Aufrufe | $0,0240 | $0,0592 |
| Bestandene Szenen nach höchstens einer Wiederholung | 8/15 | 15/15 |
| Angefallene Bildkosten / bestandene Szene | $0,0030 | $0,00395 |
| Ø erster Bildaufruf einschließlich Download | 6,14 s | 7,98 s |

Die letzte Kostenzeile berücksichtigt auch die Kosten der fehlgeschlagenen Versuche. Sie ist **kein Vergleich bei gleicher Ausbeute**: Bei FLUX.2 sind sieben Szenen nach dem zweiten Bild noch nicht bestanden. Kosten für Bildregie, Referenzporträts, Qualitätsprüfung, eventuelle weitere Versuche und Speicherung sind nicht enthalten. Die Dauer ist eine lokale Einzeldauer inklusive Netzwerk und Download; der Test lief sequenziell, eine Produktionsgesamtlaufzeit wurde nicht gemessen.

Auch ohne die drei Vier-Figuren-Stresstests: FLUX.2 bestand 6/12 Szenen beim ersten Bild und blieb nach sechs Wiederholungen bei 6/12 ($0,0180); FLUX 3 bestand 11/12 und nach einer Wiederholung 12/12 ($0,0481). Vier Figuren liegen über der aktuellen Drei-Figuren-Grenze der Folgen-Pipeline.

## Methode und Grenzen

Für die 15 gepaarten Erstversuche wurden dieselben Szenen, dieselbe Reihenfolge der Figuren, dieselbe inline übergebene Referenzcollage und derselbe Seed verwendet. FLUX.2 lief mit `runware:400@4`, 1.024 × 1.024, vier Schritten, CFG 4, hoher Beschleunigung und dem aktuellen positiven und negativen Produktionsprompt. FLUX 3 lief mit `bfl:flux@3-image-klein`, 1.024 × 1.024 und 16 Schritten, ohne CFG und ohne negativen Prompt. Gleiche Seeds garantieren keine gleichen Zufallsergebnisse zwischen Modellfamilien.

Die Bilder wurden von Codex sichtbar und nicht verblindet beurteilt. Bestanden heißt hier: die Hauptfiguren sind jeweils einmal erkennbar, mit ihrer Art und den wesentlichen Identitätsmerkmalen; keine gravierende Verschmelzung oder Kleidungsübertragung. Kleine, unbeteiligte Hintergrundpersonen auf dem Markt sind zulässig. Szeneninterpretation und Ästhetik wurden zusätzlich betrachtet, aber nicht in diese binäre Figurenquote eingerechnet. Dieses Kriterium ist **keine Ausführung der produktiven Terra-Bild-QA**. Der Seed ist pro Szene nur einmal vertreten; Ergebnisse sind ein Pilot und keine abgesicherte Produktionsfehlerquote.

Nach der Sichtung wurde für jede der neun auffälligen Basisszenen genau ein neuer Bildaufruf mit neuem Seed und einer konkreten Korrektur angefordert. Dabei blieb die vollständige Figuren-Collage erhalten. Die produktive Pipeline kann andere Rückfallstufen, eine kleinere Collage, weitere Versuche oder eine Vignette verwenden; deshalb lassen sich die Ergebnisse nicht als exakte Produktionskosten ausgeben.

Die JSONL-Datei mit jeder Antwort, den vom Anbieter genannten Kosten und den Zeitmessungen, alle Bilder, Referenzblätter, Prompts und Kontaktbögen liegen lokal unter `Logs/image-bench/flux3-story-comparison-2026-10-27/`. Der Ordner ist Git-ignoriert. Der 400er-Probeversuch mit `JPEG` ist dort ebenfalls als Fehler dokumentiert; ein ausgegebener Bildpreis lag dafür nicht vor. Alle 57 erfolgreichen Generierungen zusammen kosteten laut Runware $0,1511, einschließlich Stil-, Referenz- und Originals-Experimenten. Die Wiederholungen waren echte neue Bildaufrufe.

## Auffällige Bilder

| Szene | FLUX.2, erster Versuch | FLUX 3, erster Versuch | Wiederholung |
|---|---|---|---|
| Wald-Titelbild | Fuchs doppelt, blondes Kind fehlt | Figuren vollständig | FLUX.2: Tiermerkmale gehen auf beide Kinder über |
| Baumhöhle | Braunhaariges Kind fehlt | Figuren vollständig | FLUX.2: Kind fehlt weiterhin |
| Wald, vier Figuren | Fuchs als Mensch mit Fuchsschwanz | Vier Figuren erkennbar | FLUX.2: alle vier Figuren erkennbar |
| Wolke-Titelbild | Wolke und Kind vermischt | Figuren vollständig, Regenaktion schwach | FLUX.2: Wolke fehlt |
| Drache am Teich | Braunhaariges Kind doppelt | Blondhaariges Kind doppelt | FLUX.2: blondes Kind doppelt; FLUX 3: Figuren vollständig |
| Garten, vier Figuren | Drachenflügel am Kind, Drache fehlt | Vier Figuren erkennbar | FLUX.2: Kind und Wolke doppelt |
| Hexen-Titelbild | Kind trägt Hexenrobe und -hut | Figuren vollständig | FLUX.2: Hexenkleidung am blonden Kind |
| Hexenküche | Kind trägt Hexenrobe und -hut | Figuren vollständig | FLUX.2: Kind wieder als Hexe, zusätzliche kleine Figur |

## Einzelreferenzen und Stil

Für jede der drei Vier-Figuren-Szenen wurde FLUX 3 zusätzlich mit vier getrennten Referenzbildern und einem daran angepassten Prompt getestet. Der Seed und die Ausgangsszene entsprechen dem Collage-Basistest. Die getrennten Referenzen belegten in allen drei Versuchen $0,0037 pro Bild, ebenso wie die drei Collage-Aufrufe. Die mittlere HTTP-Aufrufdauer war 10,23 s gegenüber 7,27 s; inklusive Download 11,73 s gegenüber 8,82 s. Diese Messung zeigt keinen Preisaufschlag, und sie ist zu klein, um künftige Preise auszuschließen. Der Prompt musste zwischen Einzelreferenzen und Collage verändert werden; deshalb ist der Vergleich kein isolierter Referenzanzahl-Test.

Bei der Sichtprüfung waren mit Collage 3/3 dieser Szenen vollständig, mit Einzelreferenzen 1/3: Im Wald ist der Fuchs doppelt und das blonde Kind fehlt; auf dem Markt fehlt Gustav. Für diese Figuren ist die bestehende Collage daher der bessere Ausgangspunkt. Runware beschreibt FLUX 3 Image Klein als rechenzeitabhängig abgerechnet und nennt derzeit vier Referenzbilder als API-Limit, nicht einen festen Aufpreis pro Referenz. [Runware: Modell und Preise](https://runware.ai/docs/models/bfl-flux-3-image-klein)

Ein separates Stil-Experiment ergänzte drei Vier-Figuren-Prompts um eine Gouache-/Papier-Regie; alle drei Bilder zeigten die vier Figuren. Dafür wurde ein anderer Seed verwendet, sodass der Stil nicht unabhängig vom Zufall bewertet werden kann. Der allgemeine Eindruck ist wärmer und detaillierter, aber kein belastbarer Qualitätsnachweis.

## Vergleich mit Talea Originals

Die Originals verwenden in `backend/story/library/images.ts` dasselbe FLUX 3 Image Klein, 16 Schritte, eine einzelne Figuren-Collage, 1.216 × 832 Pixel, eine positive Aufforderung zu Handlung statt Kameraposen und je nach Szene räumliche Bounding-Boxes. In den beiden Seed-Serien beschreibt die `imageStyleEn`-Zeile warme handgezeichnete Kinderbuchillustration mit weichen Tuschekonturen, Gouachetextur und gemütlichem Licht. Die Figuren haben eigene Referenzporträts und visuelle Serienprofile. Für das endgültige Aussehen sind daher Modell, Referenzbilder, Szenenführung, Format und Stil gemeinsam relevant.

Das Original-Rezept wurde nachträglich mit denselben Talea-Figuren und Seeds auf sechs Szenen übertragen: drei Titelbilder und drei Vier-Figuren-Szenen, zunächst im quadratischen Vergleichsformat. Alle sechs waren nach dem obigen Figurenkriterium brauchbar. Für jede Vier-Figuren-Szene kamen je ein Querformatbild ohne und eines mit grob manuell gesetzten Boxen hinzu. Das Querformat-Marktmotiv duplizierte ein Kind; bei den Boxen erschien im Garten eine zusätzliche Wolke. Boxen sind damit kein Erfolgsgarant. Der Originals-Stil wirkt in diesen Bildern etwas kräftiger und buchähnlicher; aus sechs subjektiv beurteilten Paaren lässt sich der Anteil des Stils gegenüber dem Modell und den Referenzen nicht sauber quantifizieren.

## Einordnung

Für einen kontrollierten Produktions-Pilot bietet sich FLUX 3 Image Klein mit **einer Collage** und dem Originals-inspirierten Stil an. Die bisherige QA und die Drei-Figuren-Grenze sollten zunächst erhalten bleiben; vier Figuren funktionieren hier häufig, sind aber erst anhand von drei Szenen geprüft. Der Test rechtfertigt noch keine allgemeine Zusage zu Kosten, Trefferquote oder einer zuverlässigen vierköpfigen Besetzung. Die produktive Integration muss die abweichenden Parameter berücksichtigen: FLUX 3 unterstützt in dieser Runware-Konfiguration keinen negativen Prompt und kein CFG; statt `JPEG` wurde `JPG` erfolgreich angenommen.

Lokale Kontaktbögen: `Logs/image-bench/flux3-story-comparison-2026-10-27/sheets/forest-paired.jpg`, `cloud-paired.jpg`, `witch-paired.jpg`, `*-four.jpg`, `*-origins.jpg` und `retry-1.jpg` bis `retry-3.jpg`.
