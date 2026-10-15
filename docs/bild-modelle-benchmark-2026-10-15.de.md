# Bild-Modelle, Referenzen, Prompts und Stil — Benchmark vom 15.10.2026

Ziel: eine Alternative zu FLUX.2 klein 9B/4B finden, die nicht teurer ist und bessere Bilder liefert, dazu die beste Art, Figuren-Referenzen zu übergeben, und die Frage, ob sich der Stil ändern sollte.
Gemessen wurde mit `scripts/image-bench/` (README dort), 1.298 bewertete Bilder, rund 2,5 $ Runware plus etwa 0,4 $ Bild-Judge.

## Kurzfassung

1. **Es gibt in dieser Preisklasse keine bessere Alternative zu FLUX.2 klein.** Alle getesteten Konkurrenten sind entweder schlechter (Boogu, Kandinsky, Qwen-Image-Edit) oder 4–25× teurer (Muse, P-Image-Edit, Qwen-Edit-2511).
2. **Innerhalb der klein-Familie ist 4B nicht schlechter als 9B und rund 30 % billiger** (0,13 ¢ gegen 0,19 ¢ je Bild; 90 % gegen 85 % brauchbar, Unterschied nicht signifikant). Das ist per Umgebungsvariable umstellbar, ohne Code.
3. **Der heutige Referenz-Weg (ein neutraler Sprite-Streifen) ist schon einer der besten.** Raster liegt gleichauf. Einzelreferenzen, Kanon-Karten und Freisteller sind nicht besser, die letzten beiden spürbar schlechter. Ihre Regel „immer Kollage“ ist durch die Messung gedeckt.
4. **Prompt und Einstellungen sind keine Hebel:** 768 px ist nicht billiger, 8 statt 4 Schritte verdoppelt die Kosten ohne Gewinn, die Beschleunigung ändert nichts, die Prompt-Varianten liegen im Rauschen.
5. **Der größte echte Fehler** ist ein Doppelgänger des Helden in Szenen mit Kind plus Fabelwesen (65 % in der schlechtesten Szene, fast nur wenn eine Referenz mitgegeben wird). Keine Formulierung behebt ihn. Beim Neuzeichnen hilft aber ein Blatt nur mit den Held:innen (4 von 6 sauber gegen 0 von 6), das ist seit 2026-10-15 in der Pipeline (siehe Umsetzung). Klein 4B Base löst die Problem-Szene zwar besser (67–83 %), ist aber ein anderes Modell mit anderem Look; ein Einbau als Rückfall wurde wieder entfernt. **Vorgabe: alle Bilder von einem Modell, FLUX.2 klein 4B.**
6. **Stil:** Der Stil im Prompt wirkt kaum, weil die Porträts im Referenz-Streifen den Look vorgeben. Es gibt keinen Qualitätsgrund, den Stil zu wechseln; ein Wechsel wäre eine reine Gestaltungsentscheidung und müsste über neue Porträts laufen.

## Modelle

132 Runware-Bildmodelle gelesen, 76 nehmen Referenzbilder, 11 kosten höchstens 1,2 ¢. Getestet (Screening, 64 Bilder, 4 Szenen, 2 Seeds, nach Neubewertung):

| Modell | ¢/Bild gemessen | Brauchbar | Befund |
|---|---|---|---|
| FLUX.2 klein 4B (`runware:400@4`) | 0,12–0,13 | 75–96 % | billigstes, gleiche Qualität wie 9B |
| FLUX.2 klein 9B (`runware:400@2`, heute) | 0,19–0,22 | 63–88 % | Referenz |
| FLUX.2 klein 9B KV (`runware:400@6`) | 0,25 | 75–90 % | nicht billiger, trotz „KV-Cache“ |
| FLUX.2 klein 4B Base (`runware:400@5`) | 0,6–0,9 | 100 % (n=8), s5 67–83 % | 5× Preis, anderer Look — nicht einsetzbar, weil alle Bilder von einem Modell kommen sollen |
| FLUX.2 klein 9B Base (`runware:400@3`) | 1,4 | 75 % | 7× Preis, nicht besser |
| Meta Muse Image | 1,0 | 75 % | löst die Problem-Szene, aber `seed` wird abgelehnt (kein Neuwürfeln), anderer Look |
| P-Image-Edit | 0,9 | 88 % | 4× Preis, kein Vorteil |
| Qwen-Image-Edit / -2511 | 0,9 / 3,2 | 25–100 % | scheitert an Sprites; 2511 kostet real 3 ¢ statt der gelisteten 0,6–1 ¢ |
| Boogu Edit Turbo, Kandinsky 5 Lite | 0,3 / 0,9 | 0 % | zeichnen das Referenzblatt nach bzw. Müll |

Runware rechnet klein nach Rechenzeit ab, die Kosten je Aufruf schwanken. Alle Werte sind Mittel über viele Bilder.

## Referenzen (567 Bilder, 3 Modelle, 7 Szenen, 3 Seeds; danach über alle Läufe ohne Doppelzählung)

| Strategie | Brauchbar | Hinweis |
|---|---|---|
| Raster 2×2 | 86–89 % | gleichauf mit Sprite, nicht belegt besser |
| **Sprite-Streifen (heute)** | **82–86 %** | |
| Einzelreferenzen („image 1, image 2“) | 79–83 % | teurer, nicht besser |
| Sprite mit 768-px-Zellen | 79–83 % | nichts gewonnen |
| Freisteller (Hintergrund entfernt) | 74–79 % | schlechter |
| Kanon-Karte (ganze Figur auf Weiß, einmal erzeugt) | 69–75 % | schlechter |
| keine Referenz (nur Text) | 71–74 % | Identität und Kleidung schwächer |

Nach Figurenzahl: 1 Figur 100 %, 2 Figuren 91 %, 3 Figuren 56 %, 4 Figuren 65 %. Die 3-Figuren-Schwäche kommt fast allein aus einer Szene (Kind + Drache + Wolke, 20 %), dort wird der Held in 65 % der Fälle doppelt gezeichnet; ohne Referenz tritt das kaum auf.

## Prompt und Einstellungen

- Helden-Blatt gegen Doppelgänger (Nachtrag, 60 Bilder, klein 4B, 5 Szenen × 6 Seeds): nur Held:innen aufs Blatt, alle anderen als Text → Doppelgänger 7 % gegen 20 %; in der Problem-Szene 4/6 sauber gegen 0/6. Dafür Identität und Kleidung leicht schwächer (0,89–0,94 gegen 1,0 in einzelnen Szenen), insgesamt gleich viele bestanden (77 %). Deshalb nur als Neuzeichnen-Strategie.

- Prompt-Varianten (über alle Läufe): Aussehens-Text weglassen 91 %, heute 84 %, kompakt 81 %, Links-nach-rechts-Anordnung 79 %. Mit frischen Seeds ohne die Problem-Szene gleichauf (92 % gegen 92 %). Der Vorsprung kommt nur aus den schwierigen Szenen und ist **nicht bestätigt**.
- Szenen-Umformulierung („zwischen ihnen“ weg) und Held-zuerst auf dem Blatt: keine Wirkung (25–47 %).
- Einstellungen an klein 4B (je 12 Bilder): 768 px 0,13–0,145 ¢ gegen 0,12–0,13 ¢ bei 1024 px, also nicht billiger; 8 Schritte 0,21–0,25 ¢ ohne Qualitätsgewinn; Beschleunigung `high` gegen `none` ohne Unterschied. Die heutige Einstellung (4 Schritte, `high`, 1024) liegt im Ranking vorn.

## Stil

- Sechs Stil-Texte (Aquarell, Gouache, flache Tusche, Papierschnitt, Soft-3D, Bleistift/Aquarell) halten die Figuren alle gleich stabil (81–100 %). Optisch sind fünf davon kaum zu unterscheiden, **Papierschnitt entsteht gar nicht**. Nur Soft-3D bricht aus (3D-Film-Look, Figuren bleiben erkennbar) und wurde vom Ranking am niedrigsten gewählt.
- Stilwechsel über neue Porträts: Die 8 Testporträts wurden in flache Tusche und Papierschnitt neu gezeichnet (16 Bilder, 0,04 $; der ganze Pool mit 128 Figuren wären etwa 0,35 $). Figuren-Stabilität blieb gleich (92 % und 94 % gegen 97 % bei Aquarell, 36 Bilder je Stil). Der Look ändert sich aber nur leicht: flache Tusche wird etwas sauberer, Papierschnitt sieht weiter nach Aquarell aus. FLUX.2 klein liefert diese Texturen in ganzen Szenen nicht.
- Einordnung: Ein Wechsel würde sich nur lohnen, wenn ein Modell den Stil wirklich liefern kann. Das war in dieser Preisklasse nicht der Fall. Nutzer-Avatare lassen sich außerdem nicht stillschweigend neu zeichnen. **Aquarell bleibt.**

## Umsetzung (2026-10-15)

| Änderung | Wo | Wirkung |
|---|---|---|
| Bildmodell auf FLUX.2 klein 4B (`runware:400@4`) | `storybook-mode-generation.ts` (`IMAGE_MODEL`, gilt für Bilderbuch und Kapitelbuch), Charakter-Lebensgeschichten (`LIFE_STORY_IMAGE_MODEL`), Live-Test-Skripte. Alle anderen Pipelines liefen schon auf 4B. | ≈ −30 % Bildkosten. Zurück auf 9B: `TALEA_STORYBOOK_IMAGE_MODEL=runware:400@2` |
| Doppelgänger → Neuzeichnen mit Held:innen-Blatt | `storybook/images.ts` (`doubled`, bisher nur bei Tier-Merkmalen auf Menschen) | Szene Kind+Drache+Wolke: 4/6 sauber gegen 0/6 mit vollem Blatt; Doppelgänger 17 % gegen 100 %. Als erster Versuch ungeeignet (Identität/Kleidung leicht schwächer), deshalb nur im Neuzeichnen |
| ~~Zusätzlicher Versuch mit klein 4B Base~~ — **wieder entfernt (2026-10-15)** | – | Der erste echte Lauf (Buch 29ae501d) zeichnete 6 von 35 Bildern mit dem Base-Modell (5,2 ¢, mehr als die 29 Standard-Aufrufe zusammen) und der Look wich sichtbar ab. Die Schätzung „≈ 0,03 ¢ je Bild“ war falsch: in diesem Buch scheiterten fast alle Bilder zweimal. | – |
| **Neuzeichnen behält die volle Szene** (Ort, Licht, Handlung) statt der 35-Wörter-`simpleScene`; Korrektursatz ohne „Simple clear composition / one pose per figure“ | `storybook/images.ts` (`REDRAW_KEEPS_SCENE`, `sceneOf`, reduzierter Plan) | Buch 29ae501d zeigte Figuren vorn ohne Szene und Aktion. Messung (klein 4B, 3-Figuren-Szenen in Produktionslänge, 12 Bilder je Variante): altes Neuzeichnen **0 % gute Szenen**, Umgebung 1,1/3, Aktion 0,75/3, 83 % Vignette; volle Szene + neuer Satz **92 %**, Umgebung 3,0, Aktion 2,6, 0 % Vignette, mehr saubere Bilder (67 % gegen 42 %). Gleiche Kosten (derselbe Aufruf), eher weniger Neuzeichnungen |
| nicht übernommen | – | Aussehens-Zeilen weglassen („nolooks“, nicht signifikant, Produktionszeilen sind schon kurz), Raster statt Sprite, Einzelreferenzen, Kanon-Karten, 768 px, 8 Schritte |

Leiter je Bild: voll → Neuzeichnen mit Korrektur (nach Doppelgänger/Tier-Merkmal nur Helden aufs Blatt) → nur Helden und Dinge → Vignette → am wenigsten schlechtes Bild.

## Empfehlung (Stand der Messung)

| Maßnahme | Aufwand | Wirkung | Status |
|---|---|---|---|
| `TALEA_STORYBOOK_IMAGE_MODEL=runware:400@4` (gilt für Bilderbuch und Kapitelbuch, `storybook-mode-generation.ts:62`) | Umgebungsvariable | ≈ −30 % Bildkosten, ≈ 1,5–2 ¢ weniger je 12-Kapitel-Buch (≈ 4–5 % der Buchkosten, bei Bildkosten von 5–6 ¢) | **umgesetzt** (jetzt Standard im Code); einen echten Lauf auf `test` danach prüfen |
| Zusätzlicher Versuch mit klein 4B Base | – | – | **verworfen**: Mischung zweier Modelle, nicht gewollt |
| Sprite beibehalten, Raster nicht einführen | – | nichts zu gewinnen | – |
| Stil beibehalten | – | – | – |

Nicht tun: Einzelreferenzen, Kanon-Karten, Freisteller, 768 px, 8 Schritte, teure Modelle als Standard.

Für Bilder sind es nur etwa 16 % der Buchkosten (rund 6 von 38 ¢). Selbst ein perfektes Bildmodell spart höchstens ein paar Cent je Buch; der größere Hebel bleibt der Text.

## Grenzen der Messung

- **Lücke der ersten Messung:** „Bestanden“ prüfte Figuren, Identität, Anatomie, Schrift und Referenzblatt, aber nicht, ob das Bild eine echte Szene mit Ort und Handlung zeigt. Das fiel erst an einem echten Buch auf. Seit dem Nachtrag misst der Judge zusätzlich Umgebung (0–3), Aktion (0–3) und „Vignette“ (Figuren vor hellem Wash); Spalte „Szene gut“ im Bericht.

- Der Judge (`gpt-6-luna`) bewertet Identität kaum unterscheidend (fast immer 1,0). Unterschiede in Gesichtstreue zwischen den Strategien sind deshalb nicht aufgelöst, nur Zählfehler, Doppelgänger, Anatomie, Schrift und Referenzblatt-Leck. Entscheidungen wurden zusätzlich an Montagebildern geprüft.
- 20–80 Bilder je Zelle: Unterschiede unter etwa 10 Prozentpunkten sind Rauschen.
- Nur 8 Figuren und 8 Szenen, die ich geschrieben habe, nicht die Bildregie der Pipeline; Produktions-Neuzeichnungen mit Korrekturzeile sind nicht abgebildet.
- Die Notiz vom 29.09. („9B 14/16 gegen 4B 7/16 sauber“) widerspricht dem 4B-Ergebnis hier; damals waren Prompts und Pipeline anders. Deshalb der Gegentest auf `test`, bevor umgestellt wird.
- Qwen-/Muse-/P-Image-Zahlen beruhen auf 1–8 Bildern je Szene.

## Wiederholen

```bash
bun --env-file=.env.local run scripts/image-bench/run.ts --phase screen --dry     # planen und Kosten schätzen
bun --env-file=.env.local run scripts/image-bench/run.ts --models klein4,klein9 --refs sprite --prompts current --scenes s4,s6 --seeds 6
bun scripts/image-bench/across-runs.mjs model     # alle Läufe zusammenziehen, ohne Doppelzählung
bun run scripts/image-bench/compare.ts <lauf> <szene> "klein4|sprite|,klein9|sprite|" 21,22,23   # Vergleichsbild
```

Ergebnisse liegen in `Logs/image-bench/runs/<lauf>/` (report.md, Montagen, Prompts, Bilder).
