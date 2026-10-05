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

## Aussagen macht der Spieler selbst (seit 2026-10-05)

Tavi liest die öffentlichen Aussagen nicht mehr automatisch vor. Ablauf pro Spieler und Akt:

1. Geheimtelefon (`whisper`): Tavi flüstert Ort, Begleiter und Beobachtung. Der Dieb sieht um Mitternacht stattdessen sein Alibi-Formular (`LieScreen`).
2. **Eigene Aussage (`claim`)**: Jeder Unschuldige wählt Ort und Begleiter selbst aus, mit derselben Auswahl wie der Dieb (`ClaimPicker`). Prüfung gegen die geflüsterte Wahrheit: bei Abweichung wackelt die Karte, Hinweis „Karte ansehen“, nach drei Fehlversuchen füllt Tavi die richtige Aussage ein. So bleibt „Unschuldige sagen die Wahrheit“ erhalten, und beide Rollen haben ähnlich viele Handgriffe.
3. Öffentliche Karte (`announce`): zeigt die gewählte Aussage still. Tavi bittet nur: „Sag es der Runde mit deinen eigenen Worten“ (`kom.ann.say.1–3`). Der Knopf „Tavi spricht für mich“ liest sie auf Wunsch vor, ebenso das Antippen einer Figur auf der Dorfkarte.

Neue Clips (Stimmen.json): `kom.ann.say.1–3`, `w.claim.1`, `w.claim.wrong`, `w.claim.help`; `kom.tour.3` ergänzt. `kom.ann.end.*` wird nicht mehr gesprochen.

## Bilder

Erzeugt über Runware mit `bfl:flux@3-image` (Kosten etwa 1,70 $ für 78 Bilder): Titelbilder (Krimi, Quiz), 8 Orte, 32 Erinnerungsbilder, 8 Beuten, 3 Akt-Szenen, 6 Posen von Kommissar Tavi (freigestellt, auf Basis des Tavi-Navigationsbilds als Referenz), 8 Spiel-Icons, 6 Quiz-Kategorien, 3 Medaillen, Serien-Flamme und das Navigations-Icon `game/nav/spiel.webp`.

## Stimmen und Klänge (ElevenLabs, erzeugt am 2026-10-03)

Alle 896 Sprach-Clips und die Klänge liegen unter `frontend/public/game/alibi/voices/` (`<id>.mp3` + `manifest.json`). Das Spiel spielt sie automatisch ab; fehlt eine ID im Manifest, spricht die Browser-Stimme, fehlt ein Klang, läuft der eingebaute Synthese-Klang. Speicherort umstellbar: Dateien in einen Bucket legen und `VITE_ALIBI_VOICE_BASE=https://…/` setzen (mit Schrägstrich am Ende).

**Erzeugen** (Werkzeuge in `scripts/game-voices/`, Details dort in der README):

| Schritt | Befehl |
|---|---|
| Plan und Zeichenzahl ansehen | `bun scripts/game-voices/generate.mjs --prio 3 --dry` |
| Sprache erzeugen (wiederaufnehmbar) | `bun scripts/game-voices/generate.mjs --prio 3` |
| Geräusche und Ambiente | `bun scripts/game-voices/sfx.mjs` |
| Nur neu schneiden/normalisieren (kostenlos) | `bun scripts/game-voices/generate.mjs --prio 3 --remaster` |
| Stand prüfen | `bun scripts/game-voices/verify.mjs --loudness` |

- **Tavi** (alle Ansagen, Namen, Zahlen, Orte, Flüstern, Macken) spricht mit der Audio-Doku-Stimme (`8tJgFGd1nr7H5KLTvjjt`, wie `FIXED_SPEAKER_VOICES` im Backend). Flüster-Clips bekommen `[whispers]`.
- **Figuren**: 89 Figuren auf 48 Stimmen des ElevenLabs-Kontos verteilt (`casting.mjs`), höchstens zwei Figuren pro Stimme, die sich in Alter, Tempo und Typ unterscheiden; dazu kommen pro Figur Charakter-Tags (zum Beispiel `[cackling, theatrical, giggly]`) und ein typisches Geräusch (`[giggles]`, `[grunts]`, …). Je Zeilenart eigene Stimmung: Vorstellung, Schwur (stmt), empört (deny), kleinlaut mit Seufzer (confess), selbstzufrieden (smug).
- Modell `eleven_v4`, Fallback `eleven_v3`. Schlüssel: Umgebung `ELEVENLABS_API_KEY`, sonst `.env.local`, sonst zur Laufzeit aus den Railway-Variablen (`railway variables --kv`); er wird nie ausgegeben oder gespeichert.
- Nachbearbeitung mit ffmpeg: Stille vorn/hinten abgeschnitten, −19 LUFS für Sprache, −23 für Geräusche, −34 für Ambiente, Spitzen ≤ −2 dBFS, Mono, 64 kbit/s.
- Im Spiel (`alibi/audio.ts`): Clips werden drei Schritte vorab geladen (keine Lücken), Geräusche vorab gecacht, Ambiente-Schleife je Akt (Abend, Mitternacht, Morgengrauen) leise im Hintergrund, mit Ein-/Ausblendung, pausiert im Hintergrund-Tab und beim Stummschalten.

## Tests (2026-10-03)

- Komplette Partien über die echte React-Oberfläche (Playwright, Vorschau-Gerüst ohne Login): Mini 4 und 5, Junior 6 und 7, Detektiv 4 und 6, Meister 8; Breiten 360, 390, 400 und 1280 px; Hell und Dunkel; einmal ohne Schnellmodus mit simulierter Sprachausgabe. Keine Fehler, kein Hänger, kein seitliches Scrollen.
- Quiz: Lobby, Fragen, Serien-Bonus, Ergebnis, Antwortübersicht in Hell und Dunkel, mobil und Desktop.
- Produktions-Build und TypeScript: keine neuen Fehler (die 118 vorhandenen TS-Fehler stammen aus anderen Dateien).
- Nicht getestet: echte Geräte (iOS/Android), echte Stimmen, echtes Backend mit Login.
