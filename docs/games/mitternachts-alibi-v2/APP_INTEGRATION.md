# Mitternachts-Alibi und Quiz in der Talea-App

Stand: 2026-10-03. Navigationspunkt „Spiel“ (vorher „Quiz“), Route `/spiel`. `/quiz` (Links aus dem Lernpfad) öffnet dieselbe Seite direkt im Quiz-Tab.

## Aufbau

| Teil | Ort |
|---|---|
| Seite mit zwei Tabs | `frontend/screens/Game/GameHubScreen.tsx` |
| Krimispiel: Startkarte, Vollbild-Bühne | `screens/Game/alibi/AlibiLauncher.tsx`, `AlibiStage.tsx` |
| Regel-Engine (TS-Port, gleiche Logik wie geprüfter Prototyp) | `screens/Game/alibi/engine.ts` |
| Spielablauf (Zustandsmaschine) | `screens/Game/alibi/controller.ts` |
| Stimme, Flüstern, Untertitel, Klänge | `screens/Game/alibi/audio.ts` |
| Texte und Sprechliste | `screens/Game/alibi/content.ts`, `data/content-data.ts`, `data/characters.ts` |
| Bildschirme | `screens/Game/alibi/ui/*.tsx` |
| Quiz (Logik aus dem alten `CommunityQuizScreen`) | `screens/Game/quiz/QuizArena.tsx`, `quizDeck.ts` |
| Bilder | `frontend/public/game/**` (78 WEBP, 2,4 MB, nicht im PWA-Precache) |

Die Figuren kommen live aus dem Charakter-Pool (`GET /story/character-pool`, Bild-URL aus dem Pool). Die Spieltexte je Figur liegen in `data/characters.ts` und werden über den normalisierten Namen zugeordnet (alle 89 Figuren des Pools haben Texte).

## Bilder

Erzeugt über Runware mit `bfl:flux@3-image` (Kosten etwa 1,70 $ für 78 Bilder): Titelbilder (Krimi, Quiz), 8 Orte, 32 Erinnerungsbilder, 8 Beuten, 3 Akt-Szenen, 6 Posen von Kommissar Tavi (freigestellt, auf Basis des Tavi-Navigationsbilds als Referenz), 8 Spiel-Icons, 6 Quiz-Kategorien, 3 Medaillen, Serien-Flamme und das Navigations-Icon `game/nav/spiel.webp`.

## Stimmen (nächster Schritt: ElevenLabs)

Das Spiel spricht heute mit der Browser-Stimme. Vorproduzierte Aufnahmen werden automatisch benutzt, sobald sie vorliegen:

1. Clips nach `Stimmen.json` erzeugen (gleiche IDs wie im Spiel, zum Beispiel `num.3`, `w.place.garten`, `character.astra.intro`).
2. Als `<id>.mp3` ablegen unter `frontend/public/game/alibi/voices/` **oder** in einem Bucket. Dann `VITE_ALIBI_VOICE_BASE=https://…/` setzen (mit Schrägstrich am Ende).
3. Dort eine `manifest.json` ablegen: `{ "ids": ["kom.welcome", "num.1", …] }`. Nur gelistete IDs werden als Datei geladen, alle anderen spricht weiter der Browser.
4. Klänge (`fx.stamp`, `fx.bell`, `fx.sight.enten` …) und Ambiente (`amb.evening`, `amb.midnight`, `amb.dawn`) laufen über denselben Mechanismus und ersetzen die eingebauten Synthese-Klänge.

## Tests (2026-10-03)

- Komplette Partien über die echte React-Oberfläche (Playwright, Vorschau-Gerüst ohne Login): Mini 4 und 5, Junior 6 und 7, Detektiv 4 und 6, Meister 8; Breiten 360, 390, 400 und 1280 px; Hell und Dunkel; einmal ohne Schnellmodus mit simulierter Sprachausgabe. Keine Fehler, kein Hänger, kein seitliches Scrollen.
- Quiz: Lobby, Fragen, Serien-Bonus, Ergebnis, Antwortübersicht in Hell und Dunkel, mobil und Desktop.
- Produktions-Build und TypeScript: keine neuen Fehler (die 118 vorhandenen TS-Fehler stammen aus anderen Dateien).
- Nicht getestet: echte Geräte (iOS/Android), echte Stimmen, echtes Backend mit Login.
