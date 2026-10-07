# Mitternachts-Alibi und Quiz in der Talea-App

Stand: 2026-10-05. Navigationspunkt „Spiel“ (vorher „Quiz“), Route `/spiel`. `/quiz` (Links aus dem Lernpfad) öffnet dieselbe Seite direkt im Quiz-Tab.

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

## Spielablauf ab Version 3 (2026-10-05)

| Phase | Was passiert | Code |
|---|---|---|
| Fall | Tavi erzählt den Fall, danach eine **Gruppen-Aufgabe** für alle (`kom.gag.<fall>`) | `CastScreens.tsx` |
| Akte | Geheimtelefon → **eigene Aussage** (Ort, Begleiter, **Beobachtung**) → öffentliche Karte | `ActScreens.tsx` |
| Ermittlung | **Fluchtuhr**: `Labor-Spuren + 2` Züge bis zum Morgengrauen. Je Zug: Zeugen-Duell (Gruppe wählt das Paar), **Siegelprobe** (1× pro Fall) oder Laborspur. Reden kostet nichts. Bei 0 Zügen geht es automatisch zur Anklage. | `RoundScreens.tsx` |
| Anklage, Enthüllung | wie bisher, zwei Versuche je nach Stufe | `FinaleScreens.tsx` |
| **Tathergang** | Geschichte mit Kamerafahrten über die Dorfkarte: Abend-Szene mit Zeugen, die Tat (Geräusch je Fall), „zur selben Zeit“, das falsche Alibi fliegt auf (echte Zeugen melden sich in ihrer Stimme), wie der Dieb erwischt wurde, das Versteck | `StoryScreen.tsx`, `controller.buildStory` |
| **Abschluss** | Beute als drehende 3D-Medaille (WebGL, sonst Bild) oder Steckbrief, Elster-Feder, Rang, **Epilog mit Cliffhanger** und Knopf „Nächster Fall“ | `FinaleScreens.tsx`, `Vault.tsx`, `Loot3D.tsx` |

**Aussagen:** Tavi liest sie nicht mehr automatisch vor („Sag es der Runde mit deinen eigenen Worten“, Knopf „Tavi spricht für mich“). Um Mitternacht kommt der **Macken-Moment**: Die Figur soll es so sagen, wie sie es tun würde. Unschuldige werden gegen die geflüsterte Wahrheit geprüft (nach drei Fehlversuchen füllt Tavi ein), der Dieb rät seine Beobachtung.

**Siegel:** Jede Aussage enthält eine versiegelte Beobachtung (`Claim.sight`). Im Duell bricht Tavi beide Siegel und vergleicht automatisch (die Gruppe zeigt vorher trotzdem gleichzeitig). Die Siegelprobe vergleicht eine Mitternachts-Aussage mit der Dorfchronik (Wahrheit am behaupteten Ort): Unschuldige bestehen immer, der Dieb nur mit Glück (1 zu 4).

**Dorfkarte (`VillageMap.tsx`):** CSS-3D-Diorama auf einer gemalten Karte (`public/game/alibi/map/village.webp`, Lage der Orte in `content.ts` `MAP_POS`): geneigtes Brett, aufgestellte Ortsmedaillons und Figuren mit Schatten, Himmel und Licht je Akt (Abendrot, Mond, Morgensonne), Laternenschein, Figuren wandern beim Aktwechsel, neue Aussagen fallen mit Staubwolke ein, Widersprüche als rote Linien (nur Stufen mit Hinweisen), Fußspuren und Kamera im Tathergang.

**Sammlung (`vault.ts`, localStorage `talea.alibi.vault.v1`):** Beutestücke je Fall, Steckbriefe entkommener Diebe, Rang nach gelösten Fällen, Elster-Akte (eine Feder je gelöstem Fall). Sind alle acht Beutestücke gesammelt, wird die Elster Ella enttarnt (Finale mit Nest-Bild). Die Fälle bilden eine Kette (`CASE_CHAIN`), jeder Epilog leitet in den nächsten.

**Neue Inhalte:** 6 Bilder (Karte, Siegel, Feder, Taschenuhr, Asservatenschrank, Tathergang-Buch, Lupe) und Elster und Nest; 171 neue Sprach-Clips (Tathergang, Ermittlung, Siegel, Beute, 8 Gruppen-Aufgaben, 8 Tat-Erzählungen, 8 Epiloge, Elster-Finale, Zeugen-Zeile für alle 89 Figuren) und 18 neue Geräusche (Siegelbruch, Schleichen, Uhr, Beute, Feder, Steckbrief, Hahn, Rückspulen, Plumps, Staunen, je Fall ein Tat-Geräusch).

## Knöpfe und Icons (seit 2026-10-05)

Keine Emojis mehr in der Spieloberfläche: 81 eigene Icons (`public/game/alibi/ui/*.webp`, freigestellt, 160–256 px, zusammen 0,7 MB) mit FLUX.2 klein (`runware:400@2`, 4 Schritte, 512 px, je etwa 0,08 Cent) im gleichen Stil: Knopf-Symbole, Kopfleiste, Akt-Symbole, 6 Rang-Abzeichen, 11 Auszeichnungen, Stufen, Fragekarten, Spur-Symbole (Art, Geschlecht), Startkarten-Merkmale, Quiz. Verwendung über `GameIcon` (`ui/primitives.tsx`, Namen als Typ `GameIconName`); `GoldButton`/`GhostButton` nehmen den Namen direkt (`icon="magnifier"`).

Knopf-Stil (`game.css`): `.alibi-gold` (geprägtes Gold mit Kante, Icon in Edelstein-Fassung `.alibi-jewel`), `.alibi-btn` (dunkler Lack mit Goldrand), `.alibi-medal-btn` (runde Medaillons der Kopfleiste), `.alibi-press` (Knopf sinkt beim Drücken auf seine Kante).

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


## Lebendiges Spielbrett (v4, 2026-10-07)

Umgesetzt nach dem ref2game-Skill („KI malt, Code bewegt“). Code in `frontend/screens/Game/alibi/live/`:

| Datei | Was |
|---|---|
| `ticker.ts` | ein gemeinsamer Animationstakt (läuft nur, wenn jemand zuhört und die Seite sichtbar ist) |
| `ground.ts`, `LivingGround.tsx` | Kartenboden als WebGL2-Shader: Wasser fließt, Bäume und Weizen im Wind mit Böen, Licht je Akt, Lichtinseln an den Orten, Glühwürmchen fliehen vor dem Finger, Wellenringe; pausiert außerhalb des Bildes, senkt die Auflösung auf langsamen Geräten; ohne WebGL2 das stille Bild |
| `roads.ts` | Wegenetz (Dijkstra über die gemessenen Wegkurven) |
| `figure.ts`, `Walker.tsx`, `walkers.ts` | Figuren mit Gelenken: Porträt als Kopf, Mantel in der Kennfarbe, Zwei-Knochen-Beine, Arme; Gangphase aus der Strecke, Füße verankert (gemessenes Gleiten 0), Gehen/Rennen/Schleichen, Gesten (Greifen, Jubeln, Zittern); Laufzustand je Partie außerhalb von React, darum laufen Figuren beim Akt-Wechsel und im Tathergang über die Wege |
| `Landmark.tsx`, `landmarks.ts` | Gebäude als Aufsteller (stehen mit der Bildunterkante auf dem Boden; 3D-Aufsteller werden nach Tiefe sortiert, Stehplätze darum vor der Vorderkante), Fensterlicht je Akt, Rauch, Dampf, Funken, Glockenringe |
| `BoardLife.tsx` | Elster (Flügel als Gelenk, antippen: sie schreckt auf), Fledermäuse nachts, Vögel am Abend, unregelmäßige Abstände |
| `TaviSprite.tsx`, `lips.ts`, `SpeakingFace.tsx` | Tavi blinzelt, atmet, bewegt den Mund nach der Lautstärke der Aufnahme (`voices/lips.json`, keine WebAudio-Umleitung); sprechende Figuren wippen im Takt |
| `fx.ts`, `FxLayer.tsx`, `Juice.tsx` | Partikel, Wackeln, Blitz, Trefferpause, Randpuls; Juice-Tabelle: jedes Spielereignis (`controller.onEvent`) antwortet sofort, kurz und lang |
| `PlaceStage.tsx`, `live.css` | Ortsbühne im Geheimtelefon: Szene mit Parallaxe, Ortseffekte, die Beobachtung als lebendes Tier oder Ding |
| `StandFigure.tsx` | große Einzelfigur (Enthüllung mit fallender Kapuze) und Kapuzengestalt, die um Mitternacht durchs Bild schleicht |
| `AttractBoard.tsx` | selbstlaufende Vorschau auf der Startseite (Abend, Mitternacht mit Dieb, Morgengrauen) |

Werkstatt (nur Entwicklung, nicht im Build): `frontend/alibi-lab.html?stop=round&n=8&long=1` spielt eine Partie mit Testfiguren bis zur genannten Stelle; `?scene=cycle` zeigt den Zyklusbogen der Figur, `?scene=attract` die Vorschau. Prüfung: `node scripts/game-qa/alibi-qa.mjs` (alle Phasen auf Handy und Desktop, Konsole, Überlauf, Fußgleiten, lebender Boden), Trailer: `node scripts/game-qa/trailer.mjs`. Bilder: `scripts/game-art/README.md`.

### Geheimtelefon über die Hörmuschel (2026-10-07)

`frontend/screens/Game/alibi/earpiece.ts`, Einstellung auf dem Startbildschirm (`ui/PhoneControls.tsx`), Steuerung über `director.privacy(on)`:

- **iPhone (Safari ab iOS 16.4):** Modus „Wie telefonieren“. Beim Annehmen des Geheimtelefons schaltet die Seite die Audiositzung auf `play-and-record` und öffnet eine stumme Mikrofonspur (`enabled = false`, nie gelesen). iOS legt den Ton dann auf die Hörmuschel. Gibt es `HTMLMediaElement.setSinkId` und eine Ausgabe namens „Receiver/Hörer“, wird jedes Audio-Element gezielt geleitet (Geheimes an die Hörmuschel, Öffentliches an den Lautsprecher), und die Sitzung bleibt bis zum Ende der Akte offen. Sonst wird sie nach jeder Aussage wieder geschlossen (`playback`, 450 ms Umschaltzeit), damit Öffentliches laut kommt. Lehnt jemand das Mikrofon ab: automatisch Flüstern.
- **Android und alle anderen:** Browser können dort keinen Ton auf die Hörmuschel legen (kein `setSinkId` auf Android, Plattformgrenze). Modus „Leise flüstern“: Geheimes mit eigener Lautstärke (Standard 0,22, Lauter/Leiser am Geheimtelefon), Hintergrundklang pausiert.
- Die Hörmuschel auch unter Android ginge nur in einer nativen App (Android `AudioManager` im Kommunikationsmodus). Die Expo-App unter `mobile/` enthält das Spiel bisher nicht.
- Getestet: Flüstermodus und ein simuliertes iPhone (Playwright mit gefälschtem `navigator.audioSession` und Test-Mikrofon). Ein echtes iPhone wurde nicht getestet.
