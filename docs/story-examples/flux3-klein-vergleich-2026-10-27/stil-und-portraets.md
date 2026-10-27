# FLUX 3: lebendigere Bildregie und neue Figurenreferenzen

27. Oktober 2026. Ergänzung zum [Modellvergleich](README.md). Alle Bildbriefings und die Sichtprüfung entstanden in Codex; es wurde keine Geschichte und kein zusätzlicher API-Aufruf für Bildregie oder Bewertung erzeugt.

Nach diesen Tests wurde auf Nutzerwunsch der [gemeinsame Bildstil von Bruno und der Monster-Müllabfuhr](../../bildstil-talea-originals.md) für alle Bildgenerierungen vereinheitlicht. Die nachfolgenden Messungen beschreiben weiterhin die zum Testzeitpunkt verwendeten Varianten.

## Ergebnis und Entscheidung

Der größte sichtbare Fortschritt kommt von **konkreter Regie**: eine handelnde Figur, unterschiedliche Reaktionen, erkennbare Blickziele und eine zum Moment passende Perspektive. Ein Stilzusatz allein änderte die vorher eher aufgereihten Figuren wenig. Die neue Regie lässt auch ruhige Momente ruhig.

Für Talea-Folge ist lokal ein moderner Bilderbuchstil auf Grundlage des bestehenden Talea-Originals-Stils eingebunden: weiche Tuschlinien, Gouache, matte Farben, zurückhaltende Papierstruktur und Platz um die Handlung. Die getesteten DreamWorks- und Pixar-Richtungen ergeben an diesen Figuren sehr ähnliche, überzeugende 3D-Bilder. Die nach Tove Jansson und Maurice Sendak benannten Versuche unterscheiden sich untereinander nur wenig; die vorhandenen Charaktervorlagen setzen ihre Ästhetik weiterhin stark durch. Die Namen dieser Studios oder Illustratoren sind kein Bestandteil des Produktionsstils.

**Neue Referenzporträts sind hilfreich, ein vollständiger Austausch aller Avatarbilder ist durch diesen Pilot nicht begründet.** Die fünf getesteten Figuren bleiben bei einer Übertragung mit dem alten Bild als Vorlage gut erkennbar. Neutrale Hintergründe und vollständige Silhouetten eignen sich besser für die Collage. Separate, versionierte Illustrationsreferenzen würden die bisherigen Profilbilder erhalten und könnten einmalig pro Figur und Stil entstehen. Eine solche automatische Umstellung oder eine Änderung bestehender Avatar- und Pooldaten wurde in diesem Test nicht vorgenommen.

## Stilversuch: 21 Bilder

Drei feste Szenen mit zwei oder drei Figuren: Sternenkarte mit Fuchs Bo, Garten mit Wolke Wuschel, ruhige Brückenszene mit zwei Kindern. Sieben Varianten pro Szene:

| Variante | Was geändert wurde |
|---|---|
| Bisheriger Prompt | Bisheriger kurzer FLUX.2-Prompt mit Originals-Stil und kurzem Handlungshinweis |
| Neue Bildbeschreibung | Vollständiger FLUX-3-Prompt und moderner Stil, ursprüngliche Szenenbeschreibung |
| Moderne Bilderbuchregie | Derselbe neue Prompt mit konkreten Gesten, Reaktionen, Blickzielen und Perspektive |
| DreamWorks-Richtung | Dieselbe konkrete Regie, 3D-Kinoanimationsstil |
| Pixar-Richtung | Dieselbe konkrete Regie, abgerundeter 3D-Kinoanimationsstil |
| Tove-Jansson-Richtung | Dieselbe konkrete Regie, Tuschlinien, luftige Komposition, zurückhaltendes Aquarell |
| Maurice-Sendak-Richtung | Dieselbe konkrete Regie, schraffierte Tuschzeichnung und gedeckte Aquarellfarben |

Alle Varianten verwenden dieselben ursprünglichen Porträts in derselben Collage, den gleichen Seed je Szene und FLUX 3 Image Klein, 16 Schritte, hohe Beschleunigung, `safety.checkContent`, WEBP, 1.024 × 1.024. Die ersten beiden Vergleiche ändern mehrere Promptbestandteile zugleich; der Effekt jedes einzelnen Wortes wurde nicht isoliert.

Alle 21 Bilder zeigen die erwarteten Hauptfiguren jeweils einmal, ohne auffällige Art- oder Kleidungsübertragung. Die Szenenbefolgung bleibt begrenzt: Adrian schaut auf der Brücke häufig zu Alexander statt ins Wasser; die Schirmhaltung und das Niesen sind nicht immer genau getroffen. Die alte Bibliotheksreferenz von Bo bringt in mehreren Stilbildern kleine Pseudobeschriftungen auf Büchern mit. Diese Fehler sind bei der Aussage zu den Figuren berücksichtigt, aber keine bestandene vollständige Produktions-QA.

## Porträtversuch: 15 Porträts und 9 Szenen

Neu übertragen wurden die Avatare **Alexander und Adrian** sowie die Poolfiguren **Bo, Wuschel und Griselda**. Jede Figur wurde mit ihrer vorhandenen Referenz und einer festen Beschreibung in drei Richtungen generiert: modernes Bilderbuch, DreamWorks und Pixar. Je ein vollständiges Einzelporträt auf hellem, neutralem Hintergrund, 768 × 768; gleiche Seeds je Figur. Die erkennbaren Merkmale bleiben erhalten: Haar- und Augenfarben und Kleidung der Kinder, Bos Brille und Büchertasche, Wuschels Regenbogenschal, Griseldas Hut, Nase und schwarze Robe. Gesicht und Proportionen werden durch den Stil etwas verändert; eine exakte Identitätsgleichheit ist damit nicht bewiesen.

Anschließend wurden **dieselben neun gerichteten Szenen** aus dem Stilversuch wiederholt, mit unverändertem Prompt, Modell, Größe und Seed. Ausschließlich die eine Referenzcollage enthielt nun die jeweils neu erzeugten Porträts. Damit entstehen neun direkte Vergleiche mit den bereits vorhandenen Bildern.

- Alle neun Szenen behalten die zwei beziehungsweise drei erwarteten Figuren mit den wesentlichen Merkmalen bei.
- Die Bibliotheksbilder mit neuen Referenzen übernehmen keine sichtbaren Buchbeschriftungen aus Bos altem Porträt.
- Die Gartenszene erhält mit den neuen Referenzen in allen drei Stilen einen Hintergrund bis zum Bildrand; die moderne Variante mit alten Referenzen hatte einen weißen Aquarellrand.
- Stilgleiche Referenzen ergeben einen zusammenhängenden Look. Sie beseitigen die beschriebenen Schwächen bei Blickrichtung und Schirmhaltung nicht zuverlässig.

Die neuen Porträts unterscheiden sich von den alten zugleich in Stil, Bildausschnitt, Körperdarstellung und Hintergrund. Welcher dieser Faktoren den Vorteil bewirkt, wurde nicht getrennt geprüft. Die Sichtprüfung ist klein und nicht verblindet; daraus folgt keine belastbare Produktionsfehlerquote. Es gab in diesen 45 Zusatzbildern keine API-Fehler und keine Wiederholungsaufrufe; kleine Hand-, Blick- und Szenenfehler bleiben möglich. Die produktive Terra-QA wurde für diese Bilder nicht aufgerufen.

## Gemessene Kosten und Zeit

| Gruppe | Bilder | Gemeldete Bildkosten | Ø API-Antwort | Ø mit Download |
|---|---:|---:|---:|---:|
| Sieben Stil-/Promptvarianten × drei Szenen | 21 | $0,0525 | 4,06 s | 4,44 s |
| Fünf Figuren × drei Porträtstile | 15 | $0,0219 | 2,91 s | 3,19 s |
| Szenen mit neuen Referenzen | 9 | $0,0225 | 4,78 s | 5,09 s |
| Gesamt Zusatztests | 45 | **$0,0969** | — | — |

Ein 1.024er-Szenenbild wurde jeweils mit $0,0025 gemeldet. Zwölf Porträts wurden mit $0,0012, drei mit $0,0025 berechnet, jeweils bei tatsächlich 768 × 768 ausgegebenen Pixeln. Der Grund dieser Preisabweichung ist aus den Antworten nicht belegt; für eine Migration sollte man deshalb keine feste Porträtpauschale versprechen. Die Messwerte enthalten nur die gemeldeten Runware-Bildkosten, keine Speicher-, LLM- oder Produktions-QA-Kosten. Die neuen Referenzen waren hier im Mittel nicht schneller: ihr Nutzen liegt in der Bildgestaltung, keine Laufzeiteinsparung wurde gezeigt.

## Umsetzung und Nachprüfbarkeit

Talea-Folge nutzt lokal den FLUX-3-Prompt für Cover, Seitenbilder, Wiederholungen und Ersatzvignetten. Er erhält die vollständige Bildbeschreibung und die Korrektur, ordnet die tatsächlichen Positionen der einzigen Referenzcollage zu, bindet Namen an ihre kurzen sichtbaren Merkmale und zählt Objekte getrennt von lebenden Figuren. Andere Storybook-Pipelines behalten ihren bisherigen Prompt. Neue Gastporträts verwenden denselben Bilderbuchstil wie die Seitenbilder. Figurenprüfung und Drei-Figuren-Grenze bleiben aktiv.

Die Bildregie verlangt nun für jede Figur eine konkrete Geste oder Gewichtsverlagerung, einen sichtbaren Ausdruck und ein Blickziel; sie variiert Bildnähe und Anordnung und orientiert sich weiter am gewählten Absatz des fertigen Texts. Sie soll keine zusätzlichen Ereignisse oder Requisiten erfinden.

Validierung: 337 Tests in den Episode-/Storybook-Modulen und im Modellparameter-Adapter bestanden. Der vollständige Backend-Typecheck meldet weiterhin 76 bereits bestehende Fehler; in den hier geänderten Produktionsmodulen wurden keine TypeScript-Diagnosen gemeldet. Die Änderungen sind lokal und wurden in diesem Schritt nicht veröffentlicht.

Skripte:

- `scripts/image-bench/flux3-style-study.ts`: 21 Stil-/Promptbilder, bei erneutem Start werden vorhandene Erfolge übersprungen.
- `scripts/image-bench/flux3-portrait-study.ts`: 15 Porträts und neun Vergleichsszenen; die Kontrollprompts kommen unverändert aus dem Stilversuch.
- `scripts/image-bench/flux3-style-sheets.ts`: beschriftete Vergleichsbögen.

Lokale, Git-ignorierte Artefakte mit vollständigem Prompt, Seed, Einzelpreis und Zeit pro Bild:

- `Logs/image-bench/flux3-style-study-2026-10-27/results.jsonl`, Bilder unter `images/`, Vergleichsbögen unter `sheets/`.
- `Logs/image-bench/flux3-portrait-study-2026-10-27/results.jsonl`, Bilder unter `images/`, Vergleichsbögen `sheets/avatars.jpg`, `pool.jpg`, `map-references.jpg`, `rain-references.jpg`, `stream-references.jpg`.

Die vollständigen Bildbeschreibungen richten sich nach dem [offiziellen FLUX-3-Promptleitfaden von Runware](https://runware.ai/docs/models/bfl-flux-3-image-klein/guides/prompting). Parameterabweichungen gegenüber FLUX.2 stehen in der [Modellreferenz](https://runware.ai/docs/models/bfl-flux-3-image-klein). Die Preise und Zeiten oben stammen aus den tatsächlich ausgeführten Tests.
