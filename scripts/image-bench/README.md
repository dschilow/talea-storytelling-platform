# Bild-Benchmark (Modell × Referenz × Prompt × Stil)

Findet das beste und billigste Bild-Setup für Bilderbuch und Kapitelbuch. Alles läuft gegen Runware (Bilder) und
OpenRouter (Judge), Schlüssel stehen in `.env.local`. Jede Anfrage wird in `Logs/image-bench/cache/` zwischengespeichert
(gleiche Anfrage = kostenlos), jeder bezahlte Aufruf zählt gegen `--budget` (Standard 1,50 $).

```bash
bun scripts/image-bench/catalog.mjs --max-price 0.012          # welche Modelle können Referenzen und kosten ≈ so viel wie klein?
bun --env-file=.env.local run scripts/image-bench/roster-sheet.ts --canon --cutout   # Kontaktbogen der Testfiguren

bun --env-file=.env.local run scripts/image-bench/run.ts --phase probe                # 1 Bild je Modell: akzeptiert es meine Parameter?
bun --env-file=.env.local run scripts/image-bench/run.ts --phase screen --dry         # planen + Kosten schätzen
bun --env-file=.env.local run scripts/image-bench/run.ts --phase screen --budget 0.8  # Modelle gegeneinander
bun --env-file=.env.local run scripts/image-bench/run.ts --phase refs                 # wie kommen die Figuren ins Modell?
bun --env-file=.env.local run scripts/image-bench/run.ts --phase prompts              # Prompt-Varianten
bun --env-file=.env.local run scripts/image-bench/run.ts --phase styles               # Stil-Varianten

# beliebig kreuzen
bun --env-file=.env.local run scripts/image-bench/run.ts --models klein9,klein4 --refs sprite,multi --prompts current,compact --styles watercolor,flat-ink --scenes s4,s6 --seeds 3 --name mein-test

bun --env-file=.env.local run scripts/image-bench/run.ts --rejudge <lauf>   # Judge neu laufen lassen (Bilder bleiben)
bun --env-file=.env.local run scripts/image-bench/run.ts --rank <lauf>      # Ranking neu (mehr --rounds)
bun --env-file=.env.local run scripts/image-bench/run.ts --report <lauf>    # report.md + Montagen neu schreiben
```

Ergebnis je Lauf in `Logs/image-bench/runs/<name>/`: `report.md` (Tabelle), `montage-<szene>.jpg` (Raster mit Beschriftung, grün = bestanden,
rot = durchgefallen), `prompts/` (voller Prompt je Variante und Szene), `images/`, `results.jsonl`, `ranks.json`.

## Achsen

| Achse | Werte | Datei |
|---|---|---|
| Modell | `klein9` (heute), `klein4`, `klein9kv`, `klein4base`, `klein9base`, `pedit`, `muse`, `qwenedit`, `qwenedit2511`, `boogu`, `kandinsky`, `flux2dev` | `lib/models.ts` |
| Referenz | `none`, `sprite` (heute), `sprite768`, `grid`, `multi`, `canon-sprite`, `canon-multi`, `cutout-sprite`, `cutout-multi` | `lib/refs.ts` |
| Prompt | `current` (= `assembleImagePrompt`, produktiv), `compact`, `nolooks`; bei `multi` automatisch „image 1, image 2 …“ | `lib/prompts.ts` |
| Stil | `watercolor` (heute), `gouache`, `flat-ink`, `cutpaper`, `soft3d`, `pencil-wash` | `lib/prompts.ts` |
| Szene | 7 Szenen mit 1–4 Figuren (Kinder, Tier, Fabelwesen, Hexe) | `lib/prompts.ts` |

Modelle über 0,0125 $ pro Aufruf werden übersprungen (`--allow-expensive` erzwingt sie).

## Was gemessen wird

1. **Bestanden** (aus Zahlen abgeleitet, nicht vom Judge entschieden): jede Figur genau einmal, Identität ≥ 2/3, Kleidung ≥ 2/3,
   Anatomie ≥ 1/2, keine auffälligen Fremdfiguren, kein Referenzblatt im Bild, keine Schrift, Artefakte ≥ 2/3.
2. **Rang**: Der Judge sieht 3–8 anonymisierte Kandidaten derselben Szene/Seed und muss sie sortieren (Identität vor Sauberkeit vor Schönheit).
   Mehrere Runden, neu gemischt. Trennt auch dann, wenn alle „bestanden“ haben.
3. **¢/gutes Bild** = Ø Kosten ÷ Bestehensquote. Das ist die Zahl, die zählt: ein billiges Modell mit 40 % Ausschuss ist teurer als ein
   doppelt so teures mit 95 %.

Der Judge (`openai/gpt-6-luna`, low) ist nicht unfehlbar — er war zuerst bei Hintergrundpassanten zu streng und bei leichten Szenen zu milde.
Vor jeder Entscheidung die `montage-*.jpg` selbst ansehen.

Runware rechnet FLUX.2 klein nach Rechenzeit ab (siehe Memory „runware-klein-time-billing“): die Kosten schwanken je Aufruf. Immer über viele Bilder mitteln.

## Figurenserie: gepaarter FLUX-3-Promptvergleich

`series-prompt-ab.ts` vergleicht **Erstversuche**, ohne automatische Neuzeichnung. Der bisherige Prompt und der
Prüfauftrag werden durch die echte `generateSeriesImages`-Funktion mit kostenlosen Test-Ports erzeugt.
Die alternativen Captions in `lib/series-caption.ts` sind **nur Experimente**, kein Produktionsstandard.

```powershell
# Ohne --run: nur Anfragen vorbereiten, keine bezahlten Aufrufe.
bun scripts\image-bench\series-prompt-ab.ts --fixture "<fixture.json>" --out "Logs\image-bench\<lauf>"

bun --env-file=.env.local scripts\image-bench\series-prompt-ab.ts --fixture "<fixture.json>" --out "Logs\image-bench\<lauf>" --variants "production,caption,multi,flux2kv" --seeds "5201,5202" --run --budget 1.50

# Isoliert den Einfluss der Positionsbindung; ungeprüfte Bilder erhalten ausdrücklich keine Freigabe.
bun --env-file=.env.local scripts\image-bench\series-prompt-ab.ts --fixture "<fixture.json>" --out "Logs\image-bench\<lauf>" --variants "caption-free,multi-free" --seeds "5201,5202" --run --generate-only --budget 1.50
```

Das Fixture ist ein JSON-Array mit `id`, `referenceProvenance`, `shot` (originaler `IllustrationShot` einschließlich
`visualBeat` und optionaler `boxes`), `entities` (je `VisualEntity` plus lokalem Porträtpfad `file`) und `source`
(Textbeleg der Szene). `--only "id1,id2"` begrenzt die Fälle. Die Variante `existing` liest stattdessen ein
lokales `existingImage`. Fehlende Originalporträts müssen unter `referenceProvenance` als Einschränkung stehen;
andere Testporträts sind kein identischer Produktions-Replay.

| Variante | Caption | Referenzen | Positionsbindung |
|---|---|---|---|
| `production` | Unveränderte Produktionsanfrage | Ein Identitätsbogen | Wie Produktion |
| `caption` | Zusammenhängende Szenencaption, beschreibende Regionen | Derselbe Bogen | Ja |
| `multi` | Dieselbe Caption-Methode | Einzelporträts | Ja |
| `caption-free` / `multi-free` | Dieselbe Caption-Methode | Bogen / Einzelporträts | Nein |
| `flux2kv` | Unveränderter FLUX-2-Produktionsprompt | Derselbe Bogen | Nein |

Die Prüfung verwendet standardmäßig den konfigurierten Produktionsprüfer (seit der Modellentscheidung am
30.10.2026 GPT-6 Luna) und die unveränderten Produktionskriterien, auf Standard statt Flex.
`--judge-model google/gemini-3.8-flash` wählt den bisherigen Prüfer ausdrücklich.
Transportfehler, explizite Provider-Sperren und echte Bildurteile werden getrennt erfasst. Ein
`SAFETY`-/`PROHIBITED_CONTENT`-Block wird **nicht** erneut geschickt oder an einen Ersatzprüfer weitergereicht.
`--generate-only` schaltet ausschließlich die Prüfung dieses lokalen Experiments aus; es schreibt keine Bilder
in Geschichten und verändert keine Freigaberegel.

`charges.jsonl` reserviert vor jeder Anfrage konservativ Budget; bei gemeldeten Kosten wird die Reservierung
ersetzt. Fehlt eine Kostenangabe, bleibt sie bestehen. Der Cache verhindert identische Neukäufe, auch nach
einem Neustart. Es gibt keine verdeckten API-Retries. Geänderte Anfragen mit derselben Test-ID verlangen ein neues
Ausgabeverzeichnis; bei mehreren Verzeichnissen muss deren Gesamtbudget zusätzlich zusammengezählt werden.
Ergebnisse: einzelne Resultat-JSONs, Bilder, Anfragen mit Referenz-Hashes und `summary.json`.
Die Zusammenfassung enthält alle gespeicherten Testfälle des Verzeichnisses, auch nach mehreren Teilläufen.
Unbekannte Gebühren stehen als `null`, nicht als kostenloser Aufruf. `--run --cache-only` verarbeitet ausschließlich
vorhandene API-Antworten; ein fehlender Cache-Eintrag löst keinen neuen API-Aufruf aus.

Für den Prüfervergleich gibt es `--judge-model google/gemini-3.8-flash|google/gemini-3.5-flash-lite|openai/gpt-6-luna`
und `--judge-effort production|low|medium|high`. Standard ist die Produktionsprüftiefe: immer `medium`,
unabhängig von der Figurenanzahl. Explizites `low` oder `high` dient nur Experimenten. Je Modell/Prüfvariante ein eigenes Ausgabeverzeichnis
verwenden. Der Modellname und die vollständige Prüfanfrage gehen in Ergebnis beziehungsweise Cache-Schlüssel ein;
unbekannte Prüfmodelle werden wegen des kalkulierten Kostenlimits abgelehnt.

`production` bezeichnet in diesem historischen **FLUX-3**-Vergleich weiterhin den FLUX-3-Prompt. Für neue
Proben mit dem Figurenserien-Standard **FLUX 2 9B KV** ausdrücklich `--variants flux2kv` wählen. Mit
`--variants existing` und `existingImage` im Fixture werden nur die vorhandenen Bilder gelesen, keine neuen gekauft.

Messung und Grenzen des ersten Vergleichs: [Kosten- und Bildaudit vom 29.10.2026](../../docs/character-series-cost-audit-2026-10-29.md#flux-vergleich-mit-fünf-weiteren-geschichten).
