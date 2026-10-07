# Spiel-Bilder (Mitternachts-Alibi) per Runware

Erzeugt und bereitet alle Bilder des lebendigen Spielbretts auf. Arbeitsweise nach dem ref2game-Skill: **„KI malt, Code bewegt“**. Jedes Bild ist ein einzelnes Teil im gleichen Stil (`style.mjs`, wortgleich in jedem Auftrag). Licht, Rauch, Funken, Wasser, Wind und jede Bewegung kommen aus dem Code, nicht aus dem Bild.

Schlüssel: `RUNWARE_API_KEY` aus der Umgebung oder aus der `.env.local` im Projektordner. Er wird nie ausgegeben und nie gespeichert. Rohbilder liegen in `.cache/` (nicht eingecheckt). Kosten stehen in `.cache/log.jsonl`.

| Datei | Zweck |
|---|---|
| `runware.mjs` | API-Helfer: `infer` (Erzeugen, Referenzbilder, Inpainting), `removeBg` (Freistellen), `pool` (parallel), drei Versuche bei Überlast |
| `style.mjs` | Stilbibel und je Ort Form, Leitfarbe und Erkennungszeichen (Kinder, die nicht lesen, erkennen die Orte am Bild) |
| `gen-places.mjs` | je Ort ein freistehendes Gebäude für die Karte (freigestellt) und ein Szenenbild für Karten und Ortsbühne |
| `map-layout.py` | Grundriss der Dorfkarte (Plätze = `MAP_POS`, Wegkurven = `live/roads.ts`) als Vorlage |
| `gen-map.mjs` | die gemalte Dorfkarte nach dem Grundriss (Varianten, die beste von Hand wählen) |
| `gen-parts.mjs` | Teile der laufenden Figuren (Mantel zum Einfärben, Bein, Arm), Diebesmantel, Kapuze, Elster im Flug, Vordergrund-Pflanzen |
| `gen-tavi.mjs` | Tavi: Blinzeln und zwei Mundöffnungen je Pose (Bearbeitungsmodell, nur Augen bzw. Mund werden übernommen) |
| `cut-sights.mjs` | die 32 Beobachtungen freistellen (Tiere und Dinge in der Ortsbühne) |
| `process.py` | Aufbereitung: zuschneiden, verkleinern, WebP, Fußpunkte und Gelenke messen, Masken der Karte (Wasser, Baumkronen, Weizen), `live/art.gen.ts` schreiben |

## Typische Abläufe

```bash
bun scripts/game-art/gen-places.mjs --only wirtshaus --kind landmark --force   # ein Gebäude neu
bun scripts/game-art/gen-places.mjs --kind scene                             # fehlende Szenenbilder
python scripts/game-art/process.py                                           # Orte + Teile aufbereiten
python scripts/game-art/map-layout.py && bun scripts/game-art/gen-map.mjs --seeds 21,22
python scripts/game-art/process.py map 22                                    # Variante 22 als Karte übernehmen
bun scripts/game-art/gen-tavi.mjs --only cheer --force && python scripts/game-art/process.py tavi
bun scripts/game-art/cut-sights.mjs && python scripts/game-art/process.py sights
```

Wird die Karte neu gemalt: Platzmitten und Wegkurven danach auf der Karte nachmessen und in `map-layout.py`, `frontend/screens/Game/alibi/content.ts` (`MAP_POS`) und `live/roads.ts` angleichen. Sonst laufen die Figuren neben dem Pflaster.

## Modelle und Fallen

- `bfl:flux@3-image` für alles Gemalte, ca. 2,5 ¢ je Bild. Es kennt **keinen `seed`** und nur feste Bildgrößen (zum Beispiel 1024×1024, 1568×672, 2048×2048). Bei falschen Maßen nennt die Fehlermeldung die erlaubten.
- Freistellen: `runware:112@5` (BiRefNet), gut auch bei hellen Tieren auf hellem Grund.
- Tavi-Varianten: Das Inpainting-Modell `runware:102@1` malt braune Flecken statt geschlossener Augen. Das Bearbeitungsmodell (`bfl:flux@3-image` mit dem ganzen Bild als Referenz und dem Satz „nur das ändern“) liefert deckungsgleiche Ergebnisse. `process.py tavi` misst trotzdem die Verschiebung (Phasenkorrelation) und übernimmt nur die Maske.
- Dekohäuser auf der Karte dürfen keinem Spielort ähneln (Variante 11 hatte Häuser mit Brotlaib-Dach wie die Bäckerei und wurde verworfen).

## Kosten (2026-10-07)

8 Gebäude + 8 Szenen + Wiederholungen ≈ 0,45 $, 9 Figurenteile ≈ 0,20 $, Karte (2 Varianten, 2048 px) 0,10 $, Tavi-Varianten ≈ 0,30 $, 32 Freistellungen ≈ 0,03 $. Gesamt rund 1,10 $.
