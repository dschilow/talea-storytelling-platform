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
