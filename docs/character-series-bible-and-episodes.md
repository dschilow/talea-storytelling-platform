# Figurenserien (`character-series-v1`) — Masterplan, Charakter-Bibeln, 5×20 Folgenpläne & Erweiterungs-Leitfaden

Dieses Dokument beschreibt die vollständige Architektur der **persönlichen Figurenserien (`character-series-v1`)** auf dem Qualitätsniveau der **Talea Originals** (*„Bruno, der Flunkerfisch“*, *„Die Monster-Müllabfuhr“*) und dient als verbindlicher Bauplan, damit andere KI-Modelle oder Entwickler nahtlos **neue Serienfiguren, Ensemble-Charaktere und 20-Folgen-Staffeln** ergänzen können.

---

## 1. Kernprinzipien & Warum diese Architektur Kosten senkt und Qualität maximiert

1. **Eine Datei pro Serie (`backend/story/character-series/series/<series-id>.ts`):**
   * Jede Figurenserie besitzt ihre eigene, abgeschlossene Moduldatei mit:
     * **3 wiederkehrenden Ensemble-Begleitern (`ensemble`)** inklusive vollständiger Charakter-Bibel (Herkunft, Sprechweise, Catchphrase, Marotte, Geste, Wunsch, Angst, Geheimnis, Running Gag, englischer Bild-Look und vorgeneriertem FLUX-3-Klein-Porträt).
     * **20 fest vorgeplanten Episoden (`episodes` 1..20)** in 2 Staffeln à 10 Folgen (Folge 1 = Ursprung/Erste Begegnung, Folge 5 = Halbzeit-Höhepunkt, Folge 10 = Staffel-1-Finale, Folge 15 = Staffel-2-Wendepunkt, Folge 20 = Großes Staffelfinale).
   * `backend/story/character-series/episode-plans.ts` ist lediglich der schlanke Index (~95 Zeilen), der alle Serien-Dateien zusammenführt.
2. **Gestaffelte Figuren-Auftritte (`debutEpisode`):**
   * Nicht alle Nebenfiguren sind ab Folge 1 da! Damit die Serie über 20 Folgen spannend bleibt, stoßen die Ensemble-Figuren gestaffelt dazu:
     * **Folge 1 (`origin`):** Nur die **Serien-Hauptfigur + die 1–3 Kinder-Avatare** (mit Pia als Ausnahme bei Kapitän Blubberts Boot).
     * **Folge 2 (`debutEpisode: 2`):** **Ensemble-Figur 1** feiert ihr Debüt mit einer eigenen komischen Einstiegsszene (`debutScene`).
     * **Folge 3 oder 4 (`debutEpisode: 3/4`):** **Ensemble-Figur 2** kommt erstmals dazu.
     * **Folge 7 (`debutEpisode: 7`):** **Ensemble-Figur 3** (die neue Überraschungsfigur!) betritt erstmals die Bühne.
   * `getUnlockedSeriesEnsemble(seriesId, episode)` stellt sicher, dass Figuren mit `debutEpisode > episode` in früheren Folgen **niemals** im Prompt auftauchen oder vorab verraten werden.
   * Zudem wird pro Folge **höchstens 1 Ensemble-Gast (`guestId`)** neben der Hauptfigur und den Avataren aktiv besetzt (Vertrag in `engine.ts`: `guests.length <= 1`).
3. **Verbindliche Integration der 1 bis 3 Kinder-Avatare (`avatarRole` & `classifySeriesAvatars`):**
   * **Anzahl:** Mindestens **1 Avatar**, maximal **3 Avatare** (`validateSeriesAvatarCount`).
   * **Rollenverteilung:** Die Serien-Hauptfigur bleibt der Star und komische Motor der Reihe (hat den Wunsch, den Fehler/Stolz und die schwere persönliche Entscheidung in Kapitel 3). Die **1–3 Kinder-Avatare** sind **unverzichtbare aktive Mitstreiter** (niemals bloße Zuschauer am Rand und niemals Verdränger der Hauptfigur):
     * **Avatar A** liefert die entscheidende Beobachtung / Entdeckung des Hinweises.
     * **Avatar B** (und ggf. **Avatar C**) übernimmt die tatkräftige Handlung / Mechanik / Rettung im Wendepunkt.
   * **Automatische (Wieder-)Einführung bei neuen oder geänderten Avataren (`classifySeriesAvatars` + `avatarSeriesFingerprint`):**
     * Jedes `SeriesEpisodeLog` speichert `avatarFingerprints` (Hash aus Name, Beschreibung, Aussehen/Kleidung).
     * Nimmt ein Avatar **zum ersten Mal** an der Serie teil (`newcomers`), hat er **in der letzten Folge pausiert** (`returningAfterGap`) oder wurde der Avatar **zwischenzeitlich umgestaltet/geändert** (`changed`), verlangt `seriesContext` automatisch seine szenische (Wieder-)Einführung in Kapitel 1!
4. **Admin-Test-Zähler (`characterSeriesEpisodeOverride`):**
   * Admins können im Story-Wizard unter *„Figurenabenteuer entdecken“* (und über das API-Feld `config.characterSeriesEpisodeOverride`) jede beliebige Folge `1..20` direkt anwählen, um gezielt Debüt-Folgen (z. B. Folge 2, 4, 7) oder Staffelfinals (Folge 10, 20) zu testen.
   * `loadSeriesHistory` in `repository.ts` dedupliziert und sortiert nach `log.episode ASC`, sodass auch nach Admin-Tests in beliebiger Reihenfolge die Serien-Historie konsistent bleibt.
   * **Zähler zurücksetzen („4 Folgen erlebt“ nach vielen Tests):** Im selben Admin-Kasten setzt *„Zähler auf 0 setzen“* den Folgen-Zähler der gewählten Serie für das aktive Profil zurück (`POST /story/character-series/reset`, nur Admins). Es wird nichts gelöscht: Tabelle `character_series_resets` (Migration 51) merkt sich pro Nutzer, Profil und Serie den Zeitpunkt der neuesten Seriengeschichte (auch einer, die gerade entsteht). Ältere Geschichten bleiben lesbar in der Bibliothek, zählen aber weder für den Zähler noch für die Fortsetzung (`seriesProgress`, `reserveSeries`); die nächste Geschichte ist wieder Folge 1 und führt Figuren und Avatare neu ein. Der Zeitpunkt wandert nie zurück (`GREATEST`).
5. **Kosten-Optimierung ohne Qualitätsverlust (≈ 5–6 ¢ pro Folge mit Cover + 6 Bildern):**
   * Der 20-Folgen-Plan spart zur Laufzeit einen separaten LLM-Planungs-Call (**0,00 $ Planungskosten**).
   * Sol 6.1 läuft für `character-series-v1` über OpenRouter im **Flex-Tier** (~halber Preis bei gleicher Qualität; automatischer Fallback auf Standard).
   * Alle 15 Ensemble-Figuren besitzen bereits **fertig mit FLUX 3 Klein generierte Porträts** (`frontend/public/library/character-series/characters/<id>.webp` + Eintrag in `character_pool` über Migration 50) – dadurch fallen zur Laufzeit **0,00 $ für Gast-Porträts** an, und die Figuren können direkt auf dem Identity-Sheet der Kapitelbilder mitgezeichnet werden.
   * Gemessen an *„Zwei Kisten, zwanzig Möwen“* (Folge 4, Version 5 mit 1 Bild pro Kapitel): 4,5 ¢ gesamt (Text 2,5 ¢, Lektorat 0,37 ¢, 4 Bildaufrufe + 1 Reparatur 1,37 ¢, Bildprüfungen 0,17 ¢), 6:08 min, davon 211 s für vier nacheinander gezeichnete und geprüfte Bilder.
6. **Bilder (`SERIES_POLICY` Version 6, `backend/story/character-series/pictures.ts`):**
   * **Zwei Bilder pro Kapitel** (Cover + 6 bei drei Kapiteln, je 0,25 ¢ mit FLUX 3 Klein): Jedes Kapitel wird an Absatzgrenzen in zwei Leseabschnitte geteilt (Talea-Folge-Mechanik aus `episode/pictures.ts`). Die Bildregie (Luna) wählt pro Abschnitt den lustigsten, **auf einen Blick lesbaren** Moment; das Bild steht direkt nach dem Absatz, den es zeigt. Der Autor nennt dafür pro Kapitel zwei `LACHER`, je einen pro Kapitelhälfte.
   * **Besetzung:** Serienfigur auf Cover, im ersten Bild und in mindestens der Hälfte der Bilder; jeder Avatar in mindestens einem Bild; das Cover zeigt die Serienfigur **mit den Kindern**; der Gast der Folge (z. B. Pia) steht in mindestens einem Bild; das geplante `keyVisual` der Folge ist der Cover-Vorschlag. Verfehlt der erste Plan das, gibt es eine Reparatur; danach sind diese Regeln nur noch Wünsche, damit keine Geschichte daran scheitert.
   * **Alle Bilder werden gleichzeitig gezeichnet und geprüft** (`imageConcurrency`), höchstens zwei Reparaturen pro Folge (`imageRetries`), nur für harte Fehler (Identität, Hände, fehlende oder doppelte Figur, Widerspruch zur Geschichte), Kapitel vor Cover.
   * Zeigt ein Bild die richtigen Figuren unversehrt in einem **Nachbarmoment derselben Szene** (Prüffeld `storyConsistent`), wird es als `flawed` gedruckt statt verworfen – in Folge 4 fehlte Kapitel 3 deshalb ganz.
   * Erwartung: ≈ 1,75 ¢ Bilder + ≈ 0,25 ¢ Prüfungen (+ bis zu 0,8 ¢ für zwei Reparaturen); die Bildphase dauert trotz 7 statt 4 Bildern kürzer, weil nichts mehr aufeinander wartet.
7. **Text-Regeln aus Folge 4 (`authoring.ts`, `engine.ts`):**
   * Running Gag und Geste des Gasts gehen an den Autor (Pias „In drei Sekunden rutscht die Kiste – RUMMS!“ kam in Folge 4 nie an).
   * Die Wendepunkte der zwei vorigen Folgen stehen als „nicht wiederholen“ im Bauplan: Folge 4 löste ihre Krise wie Folge 2 mit einem geopferten Lieblingsstück als Unterlage (Mantel statt Banner). Ein solches Opfer ist nur noch erlaubt, wenn der Bauplan es verlangt; sonst gibt die Hauptfigur Angeberei, Ideen-Ruhm, Stolz oder ihren sturen Plan auf.
   * Den Serienhinweis früh pflanzen: zwischen Wendepunkt und Schlusspointe höchstens ≈ 150 Wörter, keine Erklärung in indirekter Rede. Was Titel oder Prämisse versprechen (z. B. zwanzig Möwen), handelt mindestens zweimal sichtbar und lustig.
   * Das Serienlektorat (Terra) prüft zusätzlich, wer welche Idee hatte, wer was getan hat und wem was gehört. Eine falsche Zuschreibung („Und meine Idee …“ für die Idee des anderen Kindes) ist `major` und wird lokal korrigiert; Running Gags wie „Eine Idee des Kapitäns“ sind ausgenommen.
8. **Bibliothek „Meine Geschichten“ (`frontend/screens/Story/TaleaStoriesScreen.tsx`, `frontend/screens/Story/library/`):**
   * Aufbau wie bei den Talea Originals: oben ein Billboard mit der nächsten ungelesenen Geschichte (bei einer Serie immer die erste ungelesene Folge, nie die neueste; ist alles gelesen, lädt es zur nächsten Folge ein), darunter **„Eure Serien“** (eine Reihe pro Figurenserie: Porträt, Folgen in Lesereihenfolge, am Ende die Kachel „Folge N · Wie geht es weiter?“; die Reihe öffnet an der ersten ungelesenen Folge) und **„Eigene Geschichten“** (alle frei erfundenen Geschichten – Talea-Folge, Standard, Bilderbuch, Kapitelbuch – als ruhiges Cover-Raster, zwölf auf einmal; die Welt steht über dem Titel statt als eigenes Regal). Noch nicht getroffene Figuren stehen als „Neue Figuren kennenlernen“ darunter; ohne Serie erklärt eine Einladung die Idee. Suche und Filter zeigen eine Trefferliste über alles, Serienfolgen dort mit „Kapitän Blubbert · Folge 3“.
   * Die Zuordnung ist reine Logik in `library/storyShelves.ts` (getestet): eine Geschichte gehört zur Serie, wenn `config.storybookEngine = "character-series-v1"`; die Liste `/stories` liefert dafür schlank `metadata.characterSeries = { id, episode }` (`metadata-visibility.ts`, nie das Folgenlog). Nach einem Admin-Reset zählen nur die neuesten `episodeCount` fertigen Folgen; ältere stehen auf der Serienseite unter „Frühere Folgen“.
   * Serienseite `/stories/series/:seriesId` (`CharacterSeriesScreen.tsx`): Hero mit Porträt, alle Folgen, „Folge N erstellen“, „Mit dabei“ (Avatare und getroffene Figuren mit Profil) und für Admins der Zähler-Reset. Sie liest denselben Speicher-Cache wie die Bibliothek (`library/useStoryLibrary.ts`) und öffnet daher sofort.
   * „Folge N erstellen“ öffnet den Wizard mit `/story?series=<id>&avatars=<ids>&tags=<welt>`: Serie, die Avatare der letzten Folge und ihre Welt sind schon gewählt.

---

## 2. Die 15 Ensemble-Charaktere (im `character_pool` & in den Serien)

Alle 15 Figuren sind mit `drawPortrait` (`bfl:flux@3-image-klein`, 768×768, weißer Hintergrund) generiert, unter `frontend/public/library/character-series/characters/<id>.webp` abgelegt und über `backend/story/migrations/50_seed_series_ensemble_characters.up.sql` in `character_pool` eingetragen (damit sie auch in normalen Geschichten mitspielen können):

| Serie | ID (`id` / `poolId`) | Name & Spezies | Debüt | Wie die Figur tickt & spricht (`nature` / `voice` / `catchphrase`) |
|---|---|---|---|---|
| **1. Die Nebelfee** | `milo-postmaus` (`char_series_milo_postmaus`) | **Milo** (Feldmaus) | Folge 2 | Diensteifrige Postmaus mit riesigem Stempelkissen; erfindet Postparagrafen gegen Unsicherheit im Nebel. *„Ohne Stempel liegt das Ding im Prinzip noch gar nicht da!“* |
| **1. Die Nebelfee** | `riko-rabe` (`char_series_riko_rabe`) | **Riko** (Rabe) | Folge 4 | Trockener Wachvogel im Bootsschuppen-Giebel; sammelt Glänzendes „rein dienstlich“, tauscht sofort gegen alles, was klappert. *„Nicht geklaut – nur vorübergehend vor dem Verlieren gerettet!“* |
| **1. Die Nebelfee** | `borste-dachs` (`char_series_borste_dachs`) | **Borste** (Dachs) | Folge 7 | Kurzsichtiger alter Stegzimmermann; grüßt aus der Ferne Zaunpfähle, erschnüffelt aus der Nähe aber jedes Holz und jedes Harz. *„Gucken kann jeder. Riech mal lieber dran!“* |
| **2. Funkelflug** | `mucks` (`char_series_mucks_murmeltier`) | **Mucks** (Murmeltier) | Folge 2 | Wachsamer Tunnelhüter unter der Wegewarte in blauer Strickmütze; hört am Echo jeden hohlen Stollen. *„Pfiff! Wer oben trampelt, kriegt unten Staub in die Suppe!“* |
| **2. Funkelflug** | `oma-schuppe` (`char_series_oma_schuppe`) | **Oma Schuppe** (Drache) | Folge 4 | Große, warmherzige Drachengärtnerin mit runder Brille; ihr Landewind fegt Mützen weg, passt selbst durch keinen engen Spalt. *„Große Flügel machen viel Wind, aber kleine Pfoten finden den Weg.“* |
| **2. Funkelflug** | `zirbel-gams` (`char_series_zirbel_gams`) | **Zirbel** (Berggams) | Folge 7 | Übermütige junge Klettergams mit schiefem linken Hörnchen, das regelmäßig an Seilen oder Körben hängenbleibt. *„Erst springen, dann gucken – klappt fast immer!“* |
| **3. Graf Griesgram** | `johann` (`char_series_johann_hausmeister`) | **Johann** (Mensch) | Folge 2 | Unerschütterlicher Hausmeister mit Taschenuhr; besteht auf seinem freien Nachmittag, lässt aber zufällig das richtige Schlüsselchen liegen. *„Das fiele theoretisch in meine Zuständigkeit – heute habe ich allerdings frei.“* |
| **3. Graf Griesgram** | `ada` (`char_series_ada_schach`) | **Ada** (Mensch) | Folge 4 | Schlagfertige Nachbarin und Schachspielerin; hebelt jede Hausregel des Grafen mit seiner eigenen Logik aus. *„Schachmatt für Ihre Ausrede, lieber Graf!“* |
| **3. Graf Griesgram** | `pepe-brieftraegerhund` (`char_series_pepe_posthund`) | **Pepe** (Dackel-Mix) | Folge 7 | Stummer, beharrlicher Posthund in gelb-blauer Weste; tauscht Briefe gegen Fußmatten und sitzt unerbittlich auf Paragrafen. *„Wuff-hm!“* |
| **4. Kapitän Blubbert** | `pia-bootsbauerin` (`char_series_pia_bootsbauerin`) | **Pia** (Mensch) | Folge 1 | Praktische, trockene Bootsbauerin; hat die „Seegras“ gebaut und sagt Blubberts Pannen auf die Sekunde voraus. *„Schöne Rede, Kapitän. Und jetzt die Leine fest!“* |
| **4. Kapitän Blubbert** | `lotta-moewe` (`char_series_lotta_moewe`) | **Lotta** (Hafenmöwe) | Folge 3 | Stumme, pfiffige Möwe; landet auf Blubberts Mütze und tippt mit dem Schnabel genau auf übersehene Hinweise. *„Krääh!“* |
| **4. Kapitän Blubbert** | `kalli-hafenmeister` (`char_series_kalli_hafenmeister`) | **Kalli Krabbe** (Mensch) | Folge 7 | Winziger alter Hafen- und Leuchtfeuerwart im riesigen gelben Südwester; hält sein Fernrohr erst falsch herum und verwechselt Backbord/Steuerbord. *„Immer scharf links – äh, das andere Links!“* |
| **5. Tilda Tüftel** | `mina-mosaik` (`char_series_mina_mosaik`) | **Mina** (Mensch) | Folge 2 | Begeisterte Muster- und Farbgestalterin; verschönert Hebel manchmal über das Scharnier hinweg, rettet aber durch klare Farbcodes. *„Wenn es aussieht wie ein Eimer Schrauben, fasst es keiner richtig an!“* |
| **5. Tilda Tüftel** | `kuno-knopf` (`char_series_kuno_knopf`) | **Kuno** (Mensch) | Folge 4 | Trockener Sammler winziger Knöpfe, Federn und Splinte in Blechdosen; ergänzt Tildas große Maschinen um das entscheidende Kleinteil. *„Je größer die Maschine, desto kleiner das Teil, das am Ende fehlt.“* |
| **5. Tilda Tüftel** | `rostig-werkstattgans` (`char_series_rostig_gans`) | **Rostig** (Werkstattgans) | Folge 7 | Stumme, stolze weiße Gans mit kleiner Lederbrille auf dem Kopf; sammelt Messingmuttern in einer Ölkanne und zieht an roten Prüfschnüren. *„Honk-klack!“* |

---

## 3. Opus-5.5-Gegenprüfung & Qualitäts-Score (0–10)

Alle 5 Serien-Dateien (100 Episoden + 15 Figuren) wurden durch **Claude Opus 5.5 (`claude-opus-5.5`)** auf Logik, Einhaltung der Weltregeln, Ein-Gast-Beschränkung (`guests.length <= 1`), Debüt-Reihenfolge, Slapstick-Eskalation und aktive 1–3-Avatar-Rollen geprüft und anschließend vollständig überarbeitet:

| Serie | Datei | Score vor Review | Behobene Kernpunkte aus dem Opus-5.5-Lektorat | Score nach Überarbeitung |
|---|---|---|---|---|
| **1. Die Nebelfee** | `series/nebelfee.ts` | 6,5 / 10 | Multi-Gast-Kollisionen in E10/E18/E20 aufgelöst; Weltregel-Bruch in E14 („Topf hört in Stereo“ statt hüpfender Wolke) & E16 (Spiegelsplitter-Reflexion statt grundlosem Schimmer) behoben; Maren in E19 unbenannt („M.“); zweigeteilte `avatarRole` in allen 20 Folgen ergänzt. | **9,5 / 10** |
| **2. Funkelflug** | `series/funkelflug.ts` | 6,9 / 10 | E1/E2 Glockenkeil-Kausalität verbunden; unwillkürlicher Funken-Nieser in E9/E18 durch Ausrichten der Schnauze regelkonform gelöst; Mucks hat in E13 mit seinem Frost-Einwand recht; Brücken-Geografie (Moosrinne vs. Nebelschlucht) vereinheitlicht; `avatarRole` in allen 20 Folgen. | **9,5 / 10** |
| **3. Graf Griesgram** | `series/graf-griesgram.ts` | 6,4 / 10 | Zeitlinie (10 Jahre) zwischen E3, E9, E14 und E15 synchronisiert; teilbarer Doppelpokal (Holzapfel E9 + Pokalfuß E17 = E19) konsistent verknüpft; Pepes Briefdepot unter der Flurkommode in E7 eingelöst; E16 Hut-Tausch durch Pepe statt Johann; `avatarRole` in allen 20 Folgen. | **9,5 / 10** |
| **4. Kapitän Blubbert** | `series/kapitaen-blubbert.ts` | 7,0 / 10 | Kalli-Vorgriff in E6 entfernt; Pias Abwesenheit in Lotta-/Kalli-Folgen begründet; E19 Kompassring-Verkantung statt Magnet-Widerspruch; E18 Avatar A übernimmt die Pinne, während Blubbert und Avatar B am Bug peilen; `avatarRole` in allen 20 Folgen. | **9,6 / 10** |
| **5. Tilda Tüftel** | `series/tilda-tueftel.ts` | 6,4 / 10 | E9 Typenschild-Logik („erbaut von Meister Artur, Klammer für Enkelin Tilda“); E8 „Ton-Walze“ als „Farbton-Walze“ missverstanden; E12 Tildas große Rutschkupplung rettet Kunos zu kleine Bremse; E10/E12/E13 drei Schubladenfächer für die 3 Pläne der „Bach-Drehbühne“; `avatarRole` in allen 20 Folgen. | **9,5 / 10** |

---

## 4. Schritt-für-Schritt-Anleitung für andere KI-Modelle: Neue Serienfigur + 20 Folgen hinzufügen

Wenn ein anderes Modell oder ein Entwickler eine **neue Serienfigur (z. B. Serie Nr. 6)** hinzufügen soll, sind exakt diese **5 Schritte** auszuführen:

### Schritt 1: Hauptfigur im `character_pool` prüfen & Serienbibel in `series-bibles.json` + `narrative.ts` anlegen
1. Die Hauptfigur muss in `character_pool` (`is_active = TRUE`) mit einem gültigen `image_url` existieren.
2. In `backend/story/character-series/series-bibles.json` einen neuen Eintrag `{ id, characterId, characterName, title, description, genres, bible }` ergänzen.
3. In `backend/story/character-series/narrative.ts` unter `SERIES_NARRATIVES['<neue-id>']` das Welt-Versprechen (`promise`, `lead`, `voice`, `world`, `rules`, `origin`, `arcs`) eintragen und `ensemble` sowie `episodes` aus `./series/<neue-id>` verknüpfen.

### Schritt 2: Eigene Serien-Datei `backend/story/character-series/series/<neue-id>.ts` erstellen
Erstelle eine neue Datei nach dem Interface `SeriesPlanFile` aus `../episode-plans`:
* **`ensemble` (genau 3 Figuren mit gestaffeltem Debüt):**
  * Figur 1: `debutEpisode: 2`
  * Figur 2: `debutEpisode: 4` (oder `3`)
  * Figur 3: `debutEpisode: 7`
  * Jede Figur braucht: `id`, `poolId` (`char_series_<name>`), `seriesId`, `name`, `debutEpisode`, `debutScene`, `species`, `speciesCategory`, `gender`, `ageCategory`, `sizeCategory`, `role`, `archetype`, `comicRole`, `nature`, `origin`, `voice`, `catchphrase`, `catchphraseContext`, `speechStyle`, `quirk`, `gesture`, `want`, `fear`, `secret`, `runningGag`, `introLine`, `look` (Englisch, konkrete Farben/Formen, keine Hintergrund-Wörter!), `signatureVisual`, `colorPalette`, `canonSettings`, `imageUrl: '/library/character-series/characters/<id>.webp'`.
* **`episodes` (genau 20 Episoden, `episode: 1..20`, `season: 1` für 1–10, `season: 2` für 11–20):**
  * **Wichtige Regeln für jede Episode (aus dem Opus-5.5-Review):**
    1. **Ein-Gast-Regel (`guestId`):** Pro Episode darf **höchstens eine** Ensemble-Figur (`guestId: '<id>'` oder `null`) vorkommen. Erwähne in `hook`, `slapstick`, `suspense` und `keyVisual` niemals zwei oder drei Ensemble-Gäste gleichzeitig!
    2. **Debüt-Schutz:** Eine Ensemble-Figur darf in keiner Episode `1 .. (debutEpisode - 1)` namentlich erwähnt werden (auch nicht in `clue`!). Bei ihrem ersten Auftritt `guestDebut: true` setzen.
    3. **Stumme Tiere beachten:** Wenn ein Tier laut Weltregel nicht spricht (wie Möwe Lotta, Hund Pepe, Gans Rostig), muss `joke` ein gesprochener Satz der **Hauptfigur** oder eines **Avatars** sein – niemals wörtliche Rede des Tieres!
    4. **Keine benannten Einmal-Nebenfiguren:** Einmalige Dorfbewohner bleiben im Plan unbenannt (*„der alte Uhrmacher“*, *„die ehemalige Wegwartin“*), damit der Writer keine zweite `FIGUR: ... | neu`-Zeile anlegt.
    5. **Konkrete `avatarRole` (Pflichtfeld!):** Immer zweiteilig formulieren: *„Avatar A entdeckt/beobachtet [konkretes Detail]; Avatar B führt [konkrete Handlung/Mechanik] aus.“* So funktionieren 1, 2 oder 3 Avatare als unverzichtbare Mitstreiter, während die Serienfigur den komischen Fehler und die emotionale Wahl behält.

### Schritt 3: Neue Serie in `backend/story/character-series/episode-plans.ts` registrieren
Importiere `<NEUE>_SERIES` in `backend/story/character-series/episode-plans.ts` und füge sie in `SERIES_PLAN_FILES` ein.

### Schritt 4: FLUX 3 Klein Referenzporträts generieren & in `character_pool` speichern
1. Porträts generieren (Speicherort: `frontend/public/library/character-series/characters/<id>.webp`, Kosten: ~0,12–0,25 ¢ pro Porträt):
   ```bash
   bun --env-file=.env.local -e "
   import fs from 'node:fs';
   import path from 'node:path';
   import { SERIES_ENSEMBLE_BIBLES } from './backend/story/character-series/episode-plans.ts';
   import { createRunwareCaller, drawPortrait, ORIGINALS_IMAGE_STYLE } from './backend/story/library/images.ts';
   const call = createRunwareCaller(process.env.RUNWARE_API_KEY!);
   const outDir = path.join(process.cwd(), 'frontend', 'public', 'library', 'character-series', 'characters');
   for (const char of SERIES_ENSEMBLE_BIBLES) {
     const p = path.join(outDir, char.id + '.webp');
     if (fs.existsSync(p)) continue;
     const drawn = await drawPortrait({ id: char.id, name: char.name, visualProfileEn: char.look }, ORIGINALS_IMAGE_STYLE, call, 42);
     fs.writeFileSync(p, Buffer.from(await (await fetch(drawn.imageUrl)).arrayBuffer()));
   }
   "
   ```
2. Neue SQL-Migration in `backend/story/migrations/<next>_seed_<name>.up.sql` anlegen (analog zu `50_seed_series_ensemble_characters.up.sql`), damit die neuen Figuren auch im allgemeinen `character_pool` verfügbar sind.

### Schritt 5: Gegenprüfung mit Opus 5.5 & Unit-Tests ausführen
1. Alle Episodenpläne durch einen `claude-opus-5.5` Review-Subagenten auf Logik, Weltregeln, Ein-Gast-Grenze, Debüt-Reihenfolge und `avatarRole` prüfen lassen (Zielscore ≥ 9,5/10).
2. Unit-Tests ausführen:
   ```bash
   cd backend && bun test story/character-series/
   ```
   Der Test `all 5 series have 20 pre-planned episodes, staggered 3-character ensembles, avatarRoles and generated FLUX 3 portraits` in `core.test.ts` prüft automatisch jede registrierte Serie in `series-bibles.json` auf Vollständigkeit aller 20 Episoden, `avatarRole`, Debüt-Ordnung und vorhandene `.webp`-Porträts!
