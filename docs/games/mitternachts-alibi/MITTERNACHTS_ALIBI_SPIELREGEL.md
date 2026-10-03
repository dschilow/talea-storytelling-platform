# Mitternachts-Alibi: Spielregel und Entwurfsdokument (Testversion v1)

Dieses Dokument beschreibt das Spiel vollständig: Regeln, Ablauf, Rätselmodell, Prüfmethode, Teststand, Stimmenplan und offene Fragen. Es ist so geschrieben, dass eine andere Person oder KI es kritisch prüfen kann, ohne den Code zu lesen.

## 1. Kurzbeschreibung

4 bis 8 Personen spielen an **einem Handy**. Jede Person bekommt zufällig eine **Talea-Figur** aus dem Pool (89 Figuren mit Bild, Kurzgeschichte und eigener Stimme). Im Dorf Kicherwald ist in der Nacht etwas gestohlen worden. **Einer der Spieler war der Täter.** Kommissar Tavi (der Erzähler) führt durch den Abend. Alle müssen erzählen, wo sie Abend, Mitternacht und Morgengrauen verbracht haben. Alle sagen die Wahrheit. Nur der Täter muss sich für Mitternacht ein Alibi ausdenken. Das Dorf deckt die Lüge durch Vergleichen der Aussagen auf.

Es ist ein **Logikspiel mit Bluff**, kein Werwolf-Nachbau: Es gibt kein Ausscheiden, keine Rollenfähigkeiten und keine Nacht, in der Augen geschlossen werden. Spannung entsteht aus drei Dingen:

1. Der Täter erfindet sein Alibi **live**, nachdem er die anderen Aussagen gehört hat (er sieht, welche Orte und Begleiter schon belegt sind).
2. Ein **Protokoll (Tafel)** zeigt alle Aussagen nebeneinander. Widersprüche muss die Gruppe selbst finden.
3. Das **Labor** liefert nach jeder Verhörrunde eine Spur zum Täter (Kennfarbe, Größe, Art, Geschlecht der Figur) und blendet unpassende Figuren ab.

Jede Partie ist **garantiert lösbar**: Mit allen Aussagen und Spuren bleibt genau ein Verdächtiger übrig, egal welches Alibi der Täter wählt (Abschnitt 5).

## 2. Material und Ausgangslage

- **Figuren:** 89 eindeutige Talea-Figuren. Jede hat: Name, Bild, Kennfarbe (Blau, Braun, Gelb, Weiß, Rot, Grau, Grün, Lila, Schwarz, Rosa, Orange), Größe (klein, mittel, groß), Art (Mensch, Tier, Zauberwesen), Geschlecht (männlich, weiblich, neutral), eine Kurzgeschichte, eine Macke (Rollenspiel-Tipp) und fünf Sprechzeilen (Vorstellung, Aussage, Leugnen, Geständnis, selbstgefälliges Lachen).
- **Orte:** 8 Orte in Kicherwald: Bäckerei, Bibliothek, Marktplatz, Kräutergarten, Uhrturm, Brücke, Wirtshaus, Schmiede. Pro Partie werden 5 Orte benutzt (bis 6 Spieler) oder 6 Orte (7 bis 8 Spieler). Der Tatort ist immer dabei.
- **Fälle:** 8 Fälle. Jeder legt Beute und Tatort fest: Sternenlaterne (Uhrturm), Geburtstagskuchen des Königs (Bäckerei), goldenes Rezeptbuch (Wirtshaus), Mondstein (Bibliothek), Marktglocke (Marktplatz), Honigtopf des Jahres (Kräutergarten), Glückshufeisen (Schmiede), Spieluhr der Brücke (Brücke). Der Fall ist wählbar oder zufällig.
- **Einzelheiten:** Pro Ort und Zeitpunkt gibt es 2 mögliche Einzelheiten (Frage und Antwort, zum Beispiel „Was knarrte unter den Planken? – Eine lockere Bohle“). Jeder, der an einem Ort war, kennt die Einzelheit. Der Täter kennt nur die Einzelheiten der Orte, an denen er wirklich war.
- **Zeitpunkte:** Abend (19 Uhr), Mitternacht (24 Uhr), Morgengrauen. Die Tatzeit ist immer Mitternacht.

## 3. Ablauf einer Partie

1. **Einrichten.** Namen eintragen (4 bis 8), Stufe wählen, Fall wählen oder Zufall. Mit „Besetzung auslosen“ geht es los.
2. **Besetzung.** Das Handy zeigt reihum jedem Spieler seine Figur. Die Figur stellt sich in ihrer Stimme vor. Alle Figuren sind öffentlich (auch die Kurzgeschichten stehen im Besetzungs-Overlay).
3. **Der Fall.** Kommissar Tavi erzählt, was verschwunden ist und wo. Er nennt keine Namen (Abschnitt 8).
4. **Akten (privat).** Das Handy geht reihum. Jeder liest allein seinen eigenen Abend: für alle drei Zeitpunkte **Ort, Begleiter und eine Einzelheit**. Der Täter liest, dass er um Mitternacht allein am Tatort war. Dann Handy weitergeben.
5. **Aussagen.** In zufälliger Reihenfolge tritt jeder in den „Zeugenstand“ (Handy wird hingehalten, Figur spricht ihre Aussage-Zeile). Alle Unschuldigen geben ihre wahre Aussage ab (per Tippen bestätigt). **Der Täter wählt erst jetzt**, an welchem Ort er um Mitternacht gewesen sein will und wer dabei war (oder niemand). Er hat vorher die Aussagen derer gehört, die vor ihm dran waren, und sieht auf seinem Bildschirm pro Ort, wie oft er schon genannt wurde („2 genannt“ oder „niemand“). Abend und Morgengrauen sagt er wahr aus. Jede Aussage landet im Protokoll.
6. **Kreuzverhör.** Es gibt so viele Verhörrunden wie Spuren (2 oder 3), jede mit Timer (180 Sekunden, Meister 150). Die Gruppe diskutiert am Protokoll. In jeder Runde zeigt das Handy eine Fragekarte (10 Stück, neue Karte auf Wunsch) und ein **Zeugen-Duell**: Zwei Personen, die laut Protokoll am selben Ort waren, antworten auf Kommando „drei“ **gleichzeitig** auf eine Frage zur Einzelheit des Ortes. Am Ende jeder Runde fordert die Gruppe eine **Spur** vom Labor an.
7. **Anklage.** Frühestens nach der ersten Spur darf die Gruppe vorzeitig anklagen („Jetzt anklagen“), spätestens nach der letzten Spur. Das Handy zählt „3, 2, 1, Zeigt!“. Alle zeigen gleichzeitig auf eine Person. Jemand tippt die Person mit den meisten Fingern an. Bei Gleichstand wird noch einmal gezeigt.
8. **Enthüllung.** Die Karte der angeklagten Person dreht sich (Trommelwirbel). „Überführt“ (Stempel rot) oder „Unschuldig“ (Stempel grün). Der Täter gesteht in der Stimme seiner Figur, ein Unschuldiger leugnet in seiner.
9. **Zweite Anklage** (nur Kinder-Fall): Wenn die erste falsch war, gibt es eine zweite.
10. **Abspann.** Rekonstruktion: Für jeden Zeitpunkt, wo wirklich wer war, mit Einzelheit, am Ende „Das falsche Alibi“ des Täters. Auszeichnungen für alle (Beispiele: Scharfer Blick, Meisterdieb, Tapferer Unschuldiger). Dazu eine **Eigenschaften-Vorschau** (siehe Abschnitt 9).

**Sieg:** Das Dorf gewinnt, wenn es den Täter anklagt. Der Täter gewinnt, wenn er nicht angeklagt wird (nach der letzten erlaubten Anklage).

## 4. Stufen

| | Kinder-Fall | Detektiv | Meisterdetektiv |
|---|---|---|---|
| Empfohlenes Alter | ab 7 | ab 10 | Erwachsene |
| Unschuldige ohne Zeugen um Mitternacht | 0 | 1 | 2 |
| Spuren | 2 | 2 | 3 |
| Markierungen im Protokoll (Widersprüche, „ohne Zeugen“) | ja | nein | nein |
| Anklagen | 2 | 1 | 1 |
| Verhörzeit pro Runde | 180 s | 180 s | 150 s |

Ein **Einzelner** ist ein Unschuldiger, der um Mitternacht wirklich allein an einem anderen Ort war. Er hat deshalb keinen Zeugen und ist so verdächtig wie der Täter. Das ist die Schwierigkeit für Detektiv und Meister: Der Täter versteckt sich unter den Einzelnen. Die Anzahl ist so begrenzt, dass die Spuren ihn am Ende immer herausheben. Bei 4 Spielern passt im Meister-Fall nur ein Einzelner (sonst bliebe ein einzelner Rest ohne Gruppe), deshalb gleicht er dort dem Detektiv-Fall.

## 5. Das Rätselmodell und die Garantie der Lösbarkeit

### 5.1 Welt
- N Spieler, 3 Zeitpunkte, P Orte (5 oder 6).
- Zu jedem Zeitpunkt ist jeder an genau einem Ort. Wer am selben Ort ist, sieht sich gegenseitig.
- **Mitternacht:** Der Täter ist allein am Tatort. Alle Unschuldigen sind an anderen Orten, in Gruppen von 2 bis 3, plus die Einzelnen der Stufe (Gruppe der Größe 1).
- **Abend und Morgengrauen:** zufällige Gruppen der Größe 1 bis 3 (Wahrscheinlichkeiten 18 %, 50 %, 32 %) auf beliebigen Orten, auch dem Tatort.

### 5.2 Aussagen
Jeder gibt für jeden Zeitpunkt `{Ort, Begleiter-Liste}` an. Unschuldige sagen die Wahrheit. Der Täter sagt für Abend und Morgengrauen die Wahrheit und wählt für Mitternacht **irgendeinen** Ort außer dem Tatort und **irgendeine** Begleiter-Liste.

### 5.3 Löser: „Wenn X es war, passt dann alles?“
Für jeden Verdächtigen k wird geprüft, ob k als Täter alle abgegebenen Aussagen der anderen **widerspruchsfrei** erklärt. Die Regeln dafür:
1. k passt zu allen bisher gezeigten Spuren.
2. Für jeden Zeitpunkt und jede andere Person s gilt: Die Begleiter-Liste von s (ohne k) ist **genau** die Menge der Anderen mit gleichem Ort in deren Aussagen.
3. Wenn jemand k als Begleiter nennt, dann alle Nennungen am gleichen Ort, und alle anderen am gleichen Ort nennen k ebenfalls. Zu Mitternacht darf niemand k nennen (k war allein).
4. Zu Mitternacht darf niemand sonst den Tatort angeben.

Alle Verdächtigen, für die das aufgeht, sind **Kandidaten**. Zwei Stellen nutzt das Spiel: das Protokoll (Markierungen im Kinder-Fall) und die Auswahl der Spuren.

### 5.4 Spuren so wählen, dass es eindeutig wird
Nachdem alle Aussagen abgegeben sind (also **nach** der Entscheidung des Täters), wählt `pickSpuren` höchstens n Spuren (n = 2 oder 3) aus den vier wahren Eigenschaften des Täters (Kennfarbe, Größe, Art, Geschlecht), sodass nur noch der Täter als Kandidat bleibt. Darum ist das Alibi des Täters nie „zu gut“: Die Spuren reparieren es nachträglich. Reihenfolge der Spuren:
- Die **kleinste entscheidende Menge** wird bestimmt.
- Zuerst kommen **Füllspuren** (wahr, aber nicht entscheidend), die entscheidende Spur kommt **zuletzt**. So bleibt es bis zum Schluss spannend. Gemessen: Im Detektiv-Fall entscheidet die erste Spur in 13,7 % der Fälle, im Meister-Fall in 3,9 %.

### 5.5 Garantie bei der Fallerzeugung
`generate` würfelt Besetzung, Täter und Welt und prüft per `resolvable`: Im schlimmsten Fall (der Täter und alle Einzelnen bleiben als Kandidaten) gibt es eine Spurenmenge der Größe ≤ n, die genau einen von ihnen trifft. Sonst wird neu gewürfelt (höchstens 400 Versuche, im Test im Schnitt 1,0). Dadurch ist jede Partie für **jedes** Täter-Alibi lösbar, nicht nur für das beste.

## 6. Prüfergebnisse

Alle Tests laufen per Skript (`node test-gen.js`, `node test-strat.js`). Zufallsstart, 3 000 Welten pro Zeile.

**Lösbarkeit (test-gen.js).** 3 000 Welten × 3 Stufen × 4 bis 8 Spieler × 6 Täter-Strategien: **0 unlösbare Fälle**.

| Stufe / Spieler | Täter schon aus Aussagen eindeutig | Ø Kandidaten nur aus Aussagen | Spuren nötig (0/1/2/3) |
|---|---|---|---|
| Kinder 4 bis 8 | 100 % | 1,00 | 100 / 0 / 0 / 0 % |
| Detektiv 4 bis 8 | 71 bis 76 % | 1,24 bis 1,29 | 71 bis 76 / 24 bis 29 / 0 / 0 % |
| Meister 4 | 71 % | 1,29 | 71 / 29 / 0 / 0 % |
| Meister 5 bis 8 | 68 bis 72 % | 1,46 bis 1,50 | 68 bis 72 / 27 bis 32 / ≈1 / 0 % |

**Beste Täter-Strategie (test-strat.js):** „allein an einem leeren Ort, ohne Begleiter“. Im Detektiv-Fall bleiben dann im Mittel 2,0 Kandidaten (Täter plus der Einzelne), im Meister-Fall 3,0, und es ist je **eine Spur** nötig. Alle Strategien, die andere Spieler als Begleiter nennen („mit der Gruppe“, „mit einem“, „einen Einzelnen framen“), widersprechen den echten Aussagen und werden **immer** sofort entlarvt. Das ist gewollt: Wer lügt, soll sich vorher überlegen, welche Namen er riskiert.

**Oberfläche (drive-ma.js).** Zufalls-Spieler klicken eine komplette Partie über die echte Oberfläche (Playwright, Chromium). 100 Partien über alle Stufen und 4 bis 8 Spieler: keine hängenden Zustände, keine Konsolenfehler, bei jeder Anklage der Täter eindeutig (nach allen Spuren). Zusätzlich: 340 px Breite ohne horizontales Scrollen, Hover-Zittern behoben (Buttons verschieben sich nicht mehr).

## 7. Dramaturgie und Spielgefühl (Absichten, nicht gemessen)

- **Handy-Rundgang mit Geheimnis:** Jeder liest allein seine Akte, das Handy zeigt vorher einen „Weitergeben“-Bildschirm.
- **Zeugenstand:** Jede Person tritt vor, ihre Figur spricht eine Zeile. Das ist der „Hörspiel-Moment“.
- **Der Täter entscheidet live.** Er wählt erst, wenn er an der Reihe ist, und er hört vorher die anderen. Das macht das Spiel für den Täter spannend und lässt ihn aktiv bluffen statt nur zu schweigen.
- **Zeugen-Duell:** Zwei Personen antworten auf Kommando gleichzeitig auf dieselbe Frage. Wer wirklich da war, antwortet gleich. Der Täter muss raten. Das soll der lustigste Moment werden.
- **Labor-Spuren** als dosierte Hilfe, damit niemand ratlos bleibt.
- **Enthüllung** mit Trommelwirbel, Kartendrehen, Stempel und gesprochenem Geständnis.
- **Rollenspiel-Tipp** (Macke der Figur) hilft, in die Figur zu kommen, verrät aber nichts über die Schuld.
- Ton: trocken, warm, nicht albern. Kommissar Tavi sagt nie Namen.

## 8. Stimmen und ElevenLabs (Plan, nicht live getestet)

Das Spiel funktioniert ohne Aufnahmen (Browser-Sprachausgabe als Platzhalter oder stumm). Mit Aufnahmen entsteht der professionelle Hörspiel-Eindruck.

**Prinzip:** alles ist **vorproduziert**. Darum steht kein Spielername in einem gesprochenen Text. Namen stehen nur auf dem Bildschirm. So braucht man keinen Live-Aufruf, keinen API-Schlüssel und keine Wartezeit.

**Inventar (`Stimmen.json`, 519 Einträge, 44 323 Zeichen):**

| Typ | Anzahl | Zeichen | Zweck |
|---|---|---|---|
| `kom.*` Kommissar Tavi | 74 | 7 648 | Erzähler: Fall, Akten, Verhör, Spuren, Anklage, Auflösung |
| `character.<slug>.intro` | 89 | 9 034 | Vorstellung bei der Besetzung |
| `character.<slug>.stmt` | 89 | 5 161 | Zeile im Zeugenstand |
| `character.<slug>.deny` | 89 | 7 020 | Leugnen, wenn unschuldig angeklagt |
| `character.<slug>.confess` | 89 | 8 716 | Geständnis, wenn überführt |
| `character.<slug>.smug` | 89 | 6 744 | selbstgefälliges Lachen, wenn der Täter entkommt |

Jeder Eintrag hat: `filename`, `voice`, `voiceDesign` (englischer Stimmbeschreibungs-Prompt für ElevenLabs Voice Design), `text` (Sprechtext), `eleven` (Text mit Audio-Tag am Anfang, zum Beispiel `[indignant]`) und `note`. Die Audio-Tags sind pro Typ festgelegt: Vorstellung `[confident, in character]`, Aussage `[calm, matter-of-fact]`, Leugnen `[indignant]`, Geständnis `[quietly, resigned]`, Lachen `[smug, quietly laughing]`.

**Effekte (`Effekte.json`):** 14 Prompts für Klänge (Stempel, Schreibmaschine, Hammer, Klingel, Ticken, Spannungs-Akkord, Trommelwirbel, Fanfare, Trauerposaune, Papier und weitere). Im Spiel gibt es als Platzhalter synthetische Effekte per WebAudio.

**Kosten (Annahme, bitte mit der eigenen ElevenLabs-Abrechnung abgleichen):** 44 323 Zeichen bei 0,15 bis 0,30 € pro 1 000 Zeichen sind etwa **6,60 bis 13,30 €** einmalig, plus Effekte. Pro Partie entstehen keine Kosten. Ein günstiger Start: zuerst nur `kom.*` und `intro` (16 682 Zeichen, etwa 2,50 bis 5 €), die anderen Typen später.

**Einbindung:** Dateien erzeugen (MP3, WAV oder OGG), im Spiel unter „Stimmen & Audio“ auswählen. Der Dateiname ohne Endung ist die Zuordnung. Fehlende Dateien: Browser-Stimme oder stumm. Dateien bleiben nur für die aktuelle Sitzung im Browser. Geheime Akten und private Ergebnisse werden **nie** vorgelesen.

## 9. Anbindung an das Talea-Eigenschaftensystem (Beispiel)

Im Abspann zeigt das Spiel pro Spieler ein **Beispiel**, welches Eigenschafts-Update der Avatar bekommen könnte, mit Begründung. Es wird nichts gespeichert. Die Vorschau folgt den Talea-Regeln: Es gibt nur die 9 Basiseigenschaften, jedes Update trägt eine Begründung, Unterkategorien gäbe es nur, wenn die KI sie ausdrücklich zurückmeldet.

| Rolle und Ausgang | Eigenschaft | Begründung (Beispiel) |
|---|---|---|
| Täter, entkommen | Kreativität 🎨 +1 | hat ein Alibi erfunden, das bis zum Schluss gehalten hat |
| Täter, überführt | Mut 🦁 +1 | hat sich dem Verhör gestellt und die Wahrheit gestanden |
| Unschuldiger, Täter gefunden | Logik 🔢 +1 | hat mit den anderen Widersprüche aufgedeckt und den Täter gefunden |
| Unschuldiger, Täter entkommen | Ausdauer 🧗 +1 | hat bis zum Schluss mitgerätselt, auch als es schwer wurde |

Offene Frage: Soll das Spiel später ein echtes Update an die Talea-API schicken? Dann braucht es Anmeldung der Spieler und einen Missbrauchsschutz (Punkte nur bei zusammenhängenden Partien).

## 10. Bekannte Grenzen (ehrlich)

- **Nicht mit echten Gruppen getestet.** Alle Aussagen zur Spannung und zum Spaß sind Absicht und Erfahrung aus ähnlichen Spielen, keine Messung. Besonders offen: ob der Kinder-Fall wirklich für 7-Jährige lesbar ist und wie lang eine Partie dauert (Schätzung 20 bis 30 Minuten).
- **Keine echten Stimmen** getestet. Die Sprechtexte sind kurz (alle höchstens 170 Zeichen) und namenlos, aber wie sie mit ElevenLabs klingen, ist ungeprüft.
- **Logik braucht Lesen und Merken.** Das Protokoll hilft (Tafel mit Orten und Begleitern), aber 8 Spieler mit 3 Zeitpunkten sind viel Information. Das Spiel ist anspruchsvoller als Kobold-Nacht.
- **Täter-Strategie „allein an leerem Ort“** ist die stärkste, und im Meister-Fall hilft sie ihm deutlich (3 Kandidaten). Das kann sich im echten Spiel als zu stark oder zu schwach herausstellen. Der Regler dafür sind die Anzahl der Einzelnen und die Spuren.
- **Sprache:** nur Deutsch. Die Figurentexte sind auf Deutsch geschrieben. Eine zweite Sprache bräuchte neue Texte und Stimmen.
- **Ein Handy:** Das Weiterreichen ist Absicht, aber bei 8 Spielern dauert der Akten-Rundgang spürbar.

## 11. Offene Fragen für die Prüfung

1. Ist **ein** Täter bei 8 Spielern genug Spannung, oder wäre ein zweiter Täter (mit gegenseitigen Alibis) interessanter?
2. Soll die Anklage eine **Strafe** haben (zum Beispiel verliert die Gruppe eine Spur bei falscher Anklage im Kinder-Fall)?
3. Reicht das Zeugen-Duell als Bluff-Moment, oder braucht es einen zweiten „Schock“ (zum Beispiel eine Tavi-Überraschung, die eine Einzelheit verrät)?
4. Wie viele Figuren-Eigenschaften (Kennfarbe, Größe, Art, Geschlecht) dürfen als Spur dienen, ohne dass Kinder an ihren Figuren zweifeln?
5. Soll die Stimme der Figur beim Geständnis anders klingen (zum Beispiel leiser)? Im Plan ist das über den Audio-Tag `[quietly, resigned]` abgedeckt.

## 12. Dateien

- `Mitternachts-Alibi.html`: das ganze Spiel in einer Datei (Bilder und Texte eingebettet), läuft ohne Server.
- `Stimmen.json`, `Effekte.json`: Aufnahme-Listen für ElevenLabs.
- `source/engine.js`: Regel-Engine ohne Oberfläche (Welt, Aussagen, Löser, Spuren, Täter-Strategien).
- `source/content.js`: Fälle, Orte, Einzelheiten, Erzählertexte, Spuren-Sätze, Fragekarten.
- `source/ui.js`, `source/style.css`: Oberfläche.
- `source/text/b1.js` bis `b6.js`: Texte der 89 Figuren. `source/chars-ma.json`: Figurendaten. `source/prep-chars.js`: Aufbereitung aus dem Figuren-Export.
- `source/build.js`: baut die HTML-Datei, `Stimmen.json` und `Effekte.json` nach `source/out/` (`node build.js`). `source/images.json` enthält die 89 Figurenbilder als base64-webp (240 px).
- `source/test-gen.js`, `source/test-strat.js`: Lösbarkeits- und Strategietests (`node test-gen.js`, `node test-strat.js`).
