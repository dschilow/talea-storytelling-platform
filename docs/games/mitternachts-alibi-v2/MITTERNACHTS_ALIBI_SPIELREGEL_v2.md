# Mitternachts-Alibi v2: „Das Geheimtelefon“ (Spielregel und Entwurfsdokument)

Dieses Dokument beschreibt die zweite Fassung vollständig: was sich gegenüber v1 geändert hat und warum, die Regeln, die Sprach- und Bildkonzepte für Kinder, die Stimmenliste für ElevenLabs, die Tests und die Grenzen. Es ist so geschrieben, dass eine andere Person oder KI es kritisch prüfen kann, ohne den Code zu lesen.

## 0. Auf einen Blick

- **Niemand muss lesen können.** Alles Öffentliche spricht Kommissar Tavi. Alles Private flüstert Tavi ins Ohr (**Geheimtelefon**: Handy ans Ohr oder Kopfhörer). Zu allem gibt es ein Bild.
- **Jede Figur hat eine Zahl und einen farbigen Rand.** Tavi nennt Zahlen („Nummer drei“), das Bild leuchtet dabei auf.
- **Akt für Akt statt einer langen Akte.** In jedem Akt geht das Handy einmal reihum. Pro Akt muss man sich nur **einen Ort, die Begleiter (als Gesichter) und ein Bild vom Ort** merken.
- **Die Aussagen spricht die App,** für Täter und Unschuldige mit derselben Satzform. Dadurch verrät keine Betonung etwas, und niemand muss etwas Langes wiedergeben.
- **Dorfkarte statt Tabelle.** Jeder Ort ist eine Karte, die Figuren stehen darin. Tippen auf eine Figur spielt ihre Aussage noch einmal vor.
- **Zeugen-Duell mit Bildern:** Zwei Zeugen zeigen auf drei gleichzeitig auf eines von vier Bildern. Wer nicht dort war, muss raten.
- **Vier Stufen** von „Mini-Detektive ab 5“ bis „Meisterdetektiv“. Jeder Fall ist per Löser auf Lösbarkeit geprüft.
- **Nicht getestet:** echte Kinder, echte Stimmen, echte Gruppen (siehe Abschnitt 13).

## 1. Prüfung von v1: Was für Kinder nicht funktionierte

| # | Befund in v1 | Folge für 6-Jährige | Lösung in v2 |
|---|---|---|---|
| 1 | Die Akte war Text: Orte, „Mit: …“ und ein Satz mit Frage und Antwort pro Zeitpunkt | nicht lesbar | Flüstern plus Bild: Ortskarte, Gesichter, Bild vom Ort |
| 2 | Alle drei Zeitpunkte lagen in einer Akte | zu viel zu merken | ein Akt = ein Handy-Rundgang, das Wichtigste sofort danach wieder gebraucht |
| 3 | Aussagen standen nur in der Tafel (Tabelle, 8 Zeilen × 3 Spalten) | nicht lesbar, unübersichtlich | Tavi spricht jede Aussage, Dorfkarte mit Gesichtern |
| 4 | Private Akten wurden „nie vorgelesen“ | genau die wichtigsten Informationen blieben stumm | Geheimtelefon: leises Flüstern, 40 % Lautstärke, einstellbar |
| 5 | Namen mussten eingetippt werden, Tavi durfte sie nie sagen | Tastatur für Kinder, Sprache blieb vage | Zahl und Figur statt Spielername, Namen freiwillig |
| 6 | Fachwörter: Alibi, Protokoll, Zeugenstand, Kennfarbe | unbekannt | „Wo warst du? Wer hat dich gesehen?“, Dorfkarte, farbiger Rand |
| 7 | Spuren waren Text („Kennfarbe Blau“); die Kennfarbe war nirgends sichtbar | nicht nachprüfbar | Spur als Bild und Satz; Kennfarbe als farbiger Rand um jedes Gesicht; Größe als Balken |
| 8 | Einzelheit als Frage-Antwort-Text („Welche Blume ging zu?“) | schwer zu merken und zu vergleichen | ein Bild mit Geräusch (zum Beispiel Entenfamilie), vier Bilder pro Ort |
| 9 | Kinder-Fall hatte keinen Unschuldigen ohne Zeugen | Täter war sofort eindeutig, kein Rätsel | ab Mini: ein Unschuldiger war ebenfalls allein, die Spuren entscheiden |
| 10 | Fall-Einleitung mit 400 Zeichen | zu lang | 210 bis 240 Zeichen, kürzere Sätze |
| 11 | Viele Lese-Stellen im Spielablauf (Einstellungen, Tafel, Duell-Karte, Fragekarten, Hilfetexte) | Hilfe nur lesbar | Zu jedem Schritt ein ❓-Knopf, der Tavi die Hilfe sprechen lässt; Fragekarten werden vorgelesen |
| 12 | Peeking: Text-Akte war für Nebensitzer lesbar | Kinder gucken | Flüstern als Hauptkanal, „Verdecken“-Knopf, dunkler Bildschirm im Geheimtelefon |

## 2. Deine Ideen und meine Antworten

**„Figur als Bild plus Zahl, die Zahlen können sie alle.“** Ja, umgesetzt. Jede Figur hat eine goldene Nummer (Reihenfolge im Kreis, 1 bis 8) und einen farbigen Rand in ihrer Kennfarbe. Tavi sagt „Nummer drei“, und das Gesicht leuchtet im selben Moment auf. So muss ein Kind nicht merken, „wer die Fee ist“, es sieht es.

**„Die Stimme sagt Plätze, Alibis und mit wem man dort war.“** Ja, aber getrennt nach Privatem und Öffentlichem:

- **Privat (Geheimtelefon):** Wo war ich, wer war bei mir, was habe ich gesehen? Das flüstert Tavi **nur dem, der das Handy am Ohr hat.**
- **Öffentlich:** Was behauptet Nummer drei? Das sagt Tavi laut, für alle gleich.

**„Würde dadurch nichts verraten?“** Wenn man das Private laut sagt, schon. Eine Zahl allein schützt nicht, weil jeder seine eigene Zahl kennt: Sagt Tavi laut „Nummer drei war allein am Tatort“, weiß es der ganze Tisch. Deshalb gilt:

1. Das **Alibi ist das Geheimnis.** Es kommt nur per Flüstern oder auf dem Bildschirm des Spielers an.
2. Alles Laute ist für Täter und Unschuldige **dieselbe Satzform**: „Nummer drei. [Figur]. Im Wirtshaus. Dabei: Nummer fünf.“ Der Täter wählt seinen Ort und seine Begleiter auf dem privaten Bildschirm, die App sagt es dann im selben Ton wie bei allen anderen.
3. **Die Figuren bleiben öffentlich.** Ein geheimes Zuweisen der Figuren lässt sich nicht durchhalten: Beim Aussagen hält jemand das Handy, damit ist jede Figur sofort zugeordnet. Das Geheimnis liegt beim Alibi, nicht bei der Figur.

**Offene Grenze:** Ein Handylautsprecher kann auch bei 40 % Lautstärke von einem Nebensitzer gehört werden. Deshalb: Handy ans Ohr, Kopfhörer, Flüsterlautstärke einstellbar, „Alle anderen schauen weg und halten sich die Ohren zu“.

## 3. Entwurfsprinzipien

1. **Bild und Stimme für alles,** Text nur als Zugabe für Große.
2. **Wenig merken, sofort wieder brauchen.** Pro Akt ein Ort, ein paar Gesichter, ein Bild.
3. **Die App hält das Protokoll.** Kinder müssen keine Aussagen wiedergeben, nur ein Bild wiedererkennen.
4. **Privat leise, öffentlich laut, nie gemischt.** Ein Test prüft, dass Flüsterclips nie laut laufen und private Clips nie Figuren- oder Spielstandsinformationen enthalten (Abschnitt 12).
5. **Alle bleiben im Spiel.** Kein Ausscheiden, keine Rollenkarte, nur die Rolle „Täter“.
6. **Humor aus Figuren und Erzähler,** nicht aus Albernheit: trockener Kommissar, Figuren mit Macken, Auszeichnungen am Ende.

## 4. Material

- **Figuren:** 89 Talea-Figuren mit Bild, Kurzgeschichte, Macke, Kennfarbe (11 Farben), Größe (klein, mittel, groß), Art (Mensch, Tier, Zauberwesen) und Geschlecht. Fünf Sprechzeilen je Figur: Vorstellung, Aussage-Schwur, Leugnen, Geständnis, selbstgefälliges Lachen. Dazu je Figur die Macke als Sprechzeile von Tavi.
- **Orte:** 8 Orte mit je einer Ortsfarbe und einem Bild: Bäckerei, Bibliothek, Marktplatz, Kräutergarten, Uhrturm, Brücke, Wirtshaus, Schmiede. Pro Partie 5 Orte (bis 6 Spieler) oder 6 Orte (7 bis 8 Spieler), der Tatort ist immer dabei.
- **Bilder vom Ort:** 4 pro Ort, 32 insgesamt, jedes mit eigenem Geräusch (zum Beispiel Entenfamilie, Maus im Mehlsack, ein Ofen, der Funken sprüht). Jedes Bild kommt nur an einem Ort vor. Wer an einem Ort war, kennt das Bild. Der Täter kennt es nicht.
- **Fälle:** 8 Fälle mit Beute-Bild und festem Tatort: Sternenlaterne (Uhrturm), Geburtstagskuchen (Bäckerei), Rezeptbuch (Wirtshaus), Mondstein (Bibliothek), Marktglocke (Marktplatz), Honigtopf (Garten), Glückshufeisen (Schmiede), Spieluhr (Brücke).
- **Zeitpunkte (Akte):** Abend, Mitternacht, Morgengrauen. Mitternacht ist immer die Tatzeit.

## 5. Ablauf einer Partie

| Schritt | Bild | Stimme | Aktion |
|---|---|---|---|
| Einrichten | große Zahlenknöpfe 4 bis 8, Stufenkarten mit Symbol | ❓ spricht die Hilfe, „Kurz erklärt“ (6 Bildfolgen mit Stimme) | Zahl der Spieler und Stufe wählen, „Los geht’s“ |
| Besetzung | große Karte mit Zahl, Gesicht, farbigem Rand, Balken, Art | Nummer, Figur stellt sich vor, Tavi nennt die Macke | Das Handy geht im Kreis, jeder zieht seine Karte |
| Fall | Beute-Symbol, Tatort-Karte | Tavi erzählt den Fall | goldener Knopf |
| Akt: Anruf | Telefon klingelt, Gesicht und Zahl der Person, die dran ist | „Das Geheimtelefon klingelt für: Nummer vier. Handy ans Ohr!“ | „Ich bin’s“ |
| Akt: Geheimtelefon | Ortskarte, Begleiter, Bild vom Ort | **flüstert:** Akt, Ort, Begleiter oder „allein“, Bild vom Ort | „Nochmal hören“, „Verdecken“, „Fertig“ |
| Akt: Aussage | große Figur mit Zahl, Ortskarte, Begleiter, Dorfkarte | **Tavi laut:** [bei Mitternacht: der Schwur der Figur] Nummer, Figur, Ort, „Dabei: …“ oder „Ganz allein.“ | Das Handy geht weiter |
| Akt: Ende | Dorfkarte des Akts | Tavi kommentiert | weiter zum nächsten Akt |
| Verhör | Dorfkarte mit Tabs für jeden Akt, Fragekarte mit Bild, Uhr als Balken | Tavi liest Fragekarten vor, bei Hilfe-Stufen meldet er Einsprüche | Reden, Zeugen-Duell, Spur anfordern |
| Anklage | große Gesichter mit Zahl | „Drei, zwei, eins, zeigt!“ | alle zeigen gleichzeitig, jemand tippt die Figur mit den meisten Fingern an |
| Enthüllung | Karte dreht sich, Stempel | Trommelwirbel, Geständnis in der Stimme der Figur | |
| Abspann | Dorfkarte der Wahrheit je Akt mit Bildern vom Ort, das falsche Alibi, Auszeichnungen | Tavi und, bei Flucht, das Lachen des Täters | neuer Fall |

**Reihenfolge:** In jedem Akt beginnt eine zufällige Nummer und es geht im Kreis weiter. Der Täter hat also nicht immer den Vorteil, als Letzter zu sprechen.

**Das Alibi des Täters:** Beim Anruf im Akt Mitternacht sieht der Täter statt der Ortskarte seine Lüge-Auswahl: alle Orte als große Bilder (mit Punkten dahinter, wie oft ein Ort in diesem Akt schon genannt wurde) und alle anderen Figuren als Gesichter zum Antippen (Begleiter, freiwillig). Beim Tippen flüstert Tavi den Ort oder die Nummer, damit auch hier niemand lesen muss. Danach spricht die App das Alibi in derselben Satzform wie bei allen.

## 6. Merklast: Was muss man sich merken?

| | v1 | v2 |
|---|---|---|
| Pro Spieler zu merken | 3 Zeitpunkte × (Ort, Begleiter, Frage-Antwort-Satz) | je Akt: 1 Ort, 0 bis 3 Begleiter, 1 Bild vom Ort (Text und Bild werden gleichzeitig gezeigt und geflüstert) |
| Wann gebraucht? | irgendwann im Verhör | die Aussage kommt sofort danach, das Bild erst im Duell (die Auswahl zeigt alle vier Bilder, es reicht Wiedererkennen) |
| Wer hält das Protokoll? | die Spieler (Tafel lesen) | die App; Tippen auf eine Figur spielt ihre Aussage vor |
| Sprache | alles gelesen | alles gesprochen, Text nur ergänzend |

## 7. Zeugen-Duell (mit Bildern)

1. Tavi ruft zwei Figuren auf, die laut Dorfkarte am selben Ort waren („Ich rufe auf: Nummer eins, und Nummer vier. Der Abend. Auf der alten Brücke.“).
2. Das Handy liegt in der Mitte. Es zeigt die beiden Figuren, den Ort und **vier Bilder, nummeriert 1 bis 4**. Tippen auf ein Bild spielt dessen Namen und Geräusch ab (das hilft beim Erinnern und verrät dem Täter nichts).
3. Tavi zählt „Drei, zwei, eins, zeigt!“. Beide zeigen **gleichzeitig mit dem Finger auf ihr Bild** am Handy.
4. Die Gruppe tippt „Ja, gleich“ oder „Nein, verschieden“. Tavi kommentiert.

**Wichtig:** Die App verrät nicht, welches Bild richtig war. Ein Unterschied bedeutet nur: Einer hat sich geirrt oder geraten. Ein sechsjähriges Kind kann etwas vergessen, deshalb ist das Duell ein **Hinweis**, kein Urteil. Das Ergebnis erscheint als Symbol auf der Verhörseite.

## 8. Spuren als Bilder

Das Labor meldet pro Verhörrunde eine wahre Eigenschaft des Diebs. Die letzte Spur ist die entscheidende, die früheren sind Füllspuren (Abschnitt 9).

| Spur | Bild | Wie nachprüfbar |
|---|---|---|
| Kennfarbe | großer Farbpunkt | farbiger Rand um das Gesicht jeder Figur, im ganzen Spiel sichtbar |
| Größe | Balkenleiter (1, 2 oder 3 Balken) | gleiche Balken unter jeder Figur in der Besetzung |
| Art | 🧍 Mensch, 🐾 Tier, ✨ Zauberwesen | Symbol in der Besetzung |
| Geschlecht (nur ab Detektiv) | ♂️ ♀️ ⚪ | Symbol in der Besetzung |

Figuren, auf die eine Spur nicht passt, werden auf der Dorfkarte abgeblendet. Mini und Junior verwenden nur Farbe, Größe und Art, weil die Kinder diese Merkmale direkt am Bild prüfen können.

## 9. Stufen

| | 🐣 Mini | 🔍 Junior | 🕵️ Detektiv | 🎩 Meister |
|---|---|---|---|---|
| Alter (Annahme) | ab 5, mit Hilfe bei den Knöpfen | ab 7 | ab 10 | Erwachsene |
| Akte | 2 (Abend, Mitternacht) | 3 | 3 | 3 |
| Unschuldige ohne Zeugen um Mitternacht („Einzelne“) | 1 | 1 | 1 | 2 (bei 4 Spielern 1) |
| Hilfen: Einspruch ⚡ und „keiner hat sie gesehen“ 👻 | ja | ja | nein | nein |
| Spuren (Arten) | 2 (Farbe, Größe, Art) | 2 (Farbe, Größe, Art) | 2 (plus Geschlecht) | 3 (plus Geschlecht) |
| Anklagen | 2 | 2 | 1 | 1 |
| Verhörzeit pro Runde | 180 s | 180 s | 180 s | 150 s |

**Hilfen (Mini, Junior):** Nach der letzten Aussage meldet Tavi Widersprüche („Moment mal! Nummer eins, und Nummer vier, erzählen nicht dasselbe.“) und Figuren, die um Mitternacht niemand gesehen hat. Beide Hinweise erscheinen auch als Symbole auf der Dorfkarte.

**Beobachtung aus der Simulation:** In Mini und Junior steht der Täter **immer** in den Hilfen (in jeder Partie des UI-Tests mit Hilfen, mit Zufallsspielern), entweder als „keiner hat ihn gesehen“ oder in einem Einspruch. Der Unschuldige, der ebenfalls allein war, steht mit ihm in der Liste. Die Spuren entscheiden dann zwischen den beiden. Das ist für Kinder gewollt: Es gibt immer einen Weg zum Erfolg, und die Spannung liegt in der Frage „Wer von beiden?“.

## 10. Das Rätselmodell und die Lösbarkeit

Das Modell stammt aus v1 und gilt unverändert, nur mit 2 oder 3 Akten.

- N Spieler, 2 oder 3 Akte, 5 bis 6 Orte. Zu jedem Akt ist jeder an genau einem Ort. Wer am selben Ort ist, sieht sich gegenseitig.
- **Mitternacht:** Der Täter ist allein am Tatort. Alle Unschuldigen sind an anderen Orten, in Gruppen von 2 bis 3, plus die „Einzelnen“ der Stufe.
- **Aussagen:** Jeder gibt je Akt `{Ort, Begleiter-Liste}` an. Unschuldige sagen die Wahrheit. Der Täter sagt für Abend und Morgengrauen die Wahrheit und wählt für Mitternacht irgendeinen Ort außer dem Tatort und irgendeine Begleiterliste.
- **Löser:** Für jeden Spieler k wird geprüft, ob k als Täter alle anderen Aussagen widerspruchsfrei erklärt. Prüfregeln: k passt zu den gezeigten Spuren; jede Begleiterliste (ohne k) entspricht genau den anderen am selben Ort; wer k nennt, nennt ihn zusammen mit allen am selben Ort; um Mitternacht nennt niemand k, und niemand sonst gibt den Tatort an.
- **Spuren wählen:** Nachdem alle Aussagen vorliegen (also nach der Entscheidung des Täters), wählt `pickSpuren` die kleinste Menge wahrer Spuren, die genau einen Kandidaten übrig lässt. Füllspuren kommen zuerst, die entscheidende zuletzt.
- **Garantie:** `generate` würfelt Besetzung und Täter und verlangt, dass im schlimmsten Fall (Täter und alle Einzelnen bleiben Kandidaten) eine Spurenmenge der erlaubten Größe nur den Täter trifft. Sonst wird neu gewürfelt.

**Bester Täter-Zug (Simulation):** „allein an einem leeren Ort, ohne Begleiter“. Dann bleiben aus den Aussagen im Mittel 2 Kandidaten (Meister: 3), und eine Spur reicht. Wer andere Spieler als Begleiter nennt, widerspricht den echten Aussagen und wird sofort entlarvt.

## 11. Stimmen für ElevenLabs

### Prinzip: ein Baukasten aus kurzen Clips

Alles Gesprochene steht in `Stimmen.json` (896 Einträge, 56 463 Zeichen). Die Sätze setzt das Spiel aus kurzen Bausteinen zusammen:

```
[Schwur der Figur]  Nummer vier.  Bäcker Braun.  Auf der alten Brücke.  Dabei:  Nummer eins.  Notiert.
```

- Pro Baustein eine Datei, kurze Pause (140 ms) dazwischen. Das klingt wie eine Funkdurchsage und passt zum Kommissar.
- **Keine Spielernamen** in irgendeinem Clip. Figurennamen und Zahlen sind eigene Clips.
- Für Aufzählungen gibt es **Komma-Varianten** („Nummer eins,“), damit die Betonung nicht nach jedem Wort abfällt.
- Für das Geheimtelefon gibt es **Flüster-Varianten** (Tag `[whispers]`) aller Bausteine, die dort vorkommen: Akte, Orte („Du warst im Wirtshaus.“), Zahlen, Bilder vom Ort, „Bei dir waren:“ und die Täter-Hinweise.

### Katalog

| Art | Anzahl | Zeichen | Stimme | Beispiel |
|---|---|---|---|---|
| Erzähler (`kom.*`) | 144 | 10 947 | Kommissar Tavi | „Jetzt ist es Zeit für die Anklage …“ |
| Zahlen (`num.`, `numc.`, je auch `w.`) | 32 | 396 | Tavi (laut und flüsternd) | „Nummer vier.“ / „Nummer vier,“ |
| Akte und Orte (laut und flüsternd) | 22 | 412 | Tavi | „Im Wirtshaus.“ / „Du warst im Wirtshaus.“ |
| Bilder vom Ort (laut und flüsternd) | 64 | 1 420 | Tavi | „Eine Entenfamilie.“ |
| Flüster-Hinweise (`w.*`) | 11 | 571 | Tavi, geflüstert | „Psst. Du warst es …“ |
| Figurennamen (`name.*`) | 89 | 1 448 | Tavi | „Bäcker Braun.“ |
| Macken (`character.*.quirk`) | 89 | 4 594 | Tavi, trocken | „Wischt sich ständig die mehlbestäubten Hände ab.“ |
| Figurenzeilen (`character.*.intro/stmt/deny/confess/smug`) | 445 | 36 675 | je Figur eine eigene Stimme (`voiceDesign` im Katalog) | „Ich erzähle es, wie man Beute aufteilt …“ |

Jeder Eintrag hat `filename`, `voice`, `kind`, `prio`, `text`, `eleven` (Text mit Audio-Tag am Anfang), `note`, bei Figuren `voiceDesign` und bei Flüsterclips `whisper: true`.

### Stufenplan und Kosten (Annahme 0,15 bis 0,30 € je 1 000 Zeichen)

| Paket | Inhalt | Clips | Zeichen | Kosten | Wirkung |
|---|---|---|---|---|---|
| **1: Kern** | Erzähler, Zahlen, Orte, Akte, Bilder, Flüstern, Figurennamen | 346 | 13 256 | 2,0 bis 4,0 € | komplett sprachgeführtes Spiel, Figurenzeilen mit Browserstimme |
| **2: Auftritt** | dazu Vorstellung und Schwur jeder Figur, Fall-Auflösungen | +194 | +16 133 | zusammen 4,4 bis 8,8 € | die Figuren sprechen bei Besetzung und Aussage selbst |
| **3: Zugaben** | dazu Leugnen, Geständnis, Lachen und Macken | +356 | +27 074 | zusammen 8,5 bis 16,9 € | volles Hörspiel |

Zusätzlich 56 Effekt-Prompts (`Effekte.json`) für ElevenLabs Sound Effects: 24 Spielklänge und Ambiente plus 32 Geräusche zu den Bildern vom Ort. Der Preis dafür hängt vom Tarif und ist hier nicht eingerechnet.

### Produktionshinweise

1. **Eine Erzählerstimme** festlegen und alle Tavi-Clips in einer Sitzung erzeugen, damit Zahlen, Orte und Sätze gleich klingen. Pegel angleichen (Normalisieren auf denselben Lautheitswert).
2. **Flüstern:** Alle `w.`-Clips mit demselben Erzähler und `[whispers]`, nah am Mikrofon. Im Spiel laufen sie zusätzlich leise (einstellbar).
3. **Komma-Clips** wirklich mit Komma lassen, damit die Betonung offen bleibt.
4. **Kurze Clips ohne Anlaufzeit:** Stille am Anfang und Ende abschneiden, sonst klingen die Sätze zerhackt.
5. **Geräusche zu den Bildern** (`fx.sight.<id>`) sind wirkungsvoll fürs Merken: Ein Kind merkt sich „Quak“ leichter als einen Satz.

### Einbinden

Die Dateien werden im Spiel unter „Stimmen & Audio“ ausgewählt. Der Dateiname ohne Endung ist die Zuordnung: `num.3.mp3`, `w.num.3.mp3`, `fx.stamp.mp3`, `fx.sight.enten.mp3`, `amb.evening.mp3`. Effekte ersetzen die eingebauten Klänge, Ambiente läuft leise im Hintergrund der Akte. Fehlende Clips spricht der Browser (mit Standardstimme).

## 12. Tests und Ergebnisse

**Lösbarkeit der Fälle** (`node test-gen.js 3000`): 3 000 Welten je Zeile × 4 Stufen × 4 bis 8 Spieler × 6 Täter-Strategien: **0 unlösbare Fälle.**

| Stufe | Täter schon aus den Aussagen eindeutig | Ø Kandidaten nur aus Aussagen | Spuren nötig (0, 1, 2) |
|---|---|---|---|
| Mini, 4 bis 8 Spieler | 71 bis 76 % | 1,24 bis 1,29 | 71 bis 76 %, 24 bis 29 %, 0 % |
| Junior | 69 bis 77 % | 1,23 bis 1,31 | 69 bis 77 %, 23 bis 31 %, 0 % |
| Detektiv | 71 bis 76 % | 1,24 bis 1,29 | 71 bis 76 %, 24 bis 29 %, 0 % |
| Meister (5 bis 8) | 68 bis 72 % | 1,46 bis 1,50 | 68 bis 72 %, 27 bis 32 %, ≈ 1 % |
| Meister, 4 Spieler | 71 % | 1,29 | 71 %, 29 %, 0 % (nur ein Einzelner möglich) |

(Die Werte mischen alle sechs Täter-Strategien. Bei der besten Strategie „allein am leeren Ort“ sind es immer 2 Kandidaten, im Meister 3.)

**Wie oft entscheidet schon die erste Spur?** (`node test-strat.js`) Mini und Junior 24 %, Detektiv 14 %, Meister 4 % (beste Täter-Strategie). In den übrigen Fällen entscheidet erst die letzte Spur.

**Oberfläche** (`drive-ma2.js`, Playwright mit Chromium, Zufallsspieler): rund 280 Partien über alle Stufen, 4 bis 8 Spieler, Breiten 340, 360 und 400 px. Geprüft in jeder Partie:

- keine Konsolen- und Skriptfehler, kein Hänger,
- der Täter ist bei der Anklage eindeutig bestimmbar (nach allen Spuren),
- jedes Zeugen-Duell nimmt zwei Figuren, die laut Dorfkarte am selben Ort waren,
- in Mini und Junior steht der Täter immer in den Hilfen,
- **kein Clip fehlt:** jede gesprochene Zeile hat einen Eintrag in `Stimmen.json`,
- **Privates bleibt leise:** Alles im Geheimtelefon läuft mit Flüsterlautstärke; Flüsterclips werden nie laut abgespielt; im Flüster-Kanal kommen nie Figurenzeilen, Figurennamen, Aussagen, Duell- oder Spurtexte vor,
- jeder besuchte Schritt spricht etwas,
- kein horizontales Scrollen bei 340 px,
- Abdeckung: In 40 Partien (Stufe Mini) wurden 298 von 534 Figurenclips (Zeilen und Macken), 80 von 89 Namen und alle 32 Flüsterbilder gesprochen. Ungenutzt blieben nur Hilfe-, Tour- und Timer-Sprüche (der Zufallsspieler klickt sie nicht an) sowie die Zeilen der dritten Akte (Mini hat nur zwei). Ein Clip, der nirgends vorkam, wurde entfernt.

Zusätzlich: ein Lauf mit simulierter Sprachausgabe (echter, nicht beschleunigter Pfad mit Glockenzählen, Countdown, Hervorhebungen) ohne Fehler, und ein Import-Test mit erzeugten Audiodateien (Sprechclips, Flüsterclips, Effekte, Ambiente werden erkannt, Unbekanntes wird übersprungen).

**Geschätzte reine Sprechzeit pro Partie** (Rechnung mit 14,5 Zeichen je Sekunde und 0,14 s Pause je Clip, ohne Glockenzählen, Countdown, Diskussion und Handyübergabe; ein Duell je Partie):

| Stufe, Spieler | Sprechzeit | davon Akte |
|---|---|---|
| Mini, 4 | 7,0 min | 3,8 |
| Mini, 5 | 8,4 min | 4,6 |
| Mini, 6 | 9,0 min | 5,1 |
| Mini, 8 | 11,1 min | 6,5 |
| Junior, 5 | 10,0 min | 6,5 |
| Junior, 6 | 11,5 min | 7,4 |
| Junior, 8 | 14,1 min | 9,5 |
| Detektiv, 6 | 11,0 min | 7,4 |
| Meister, 6 | 11,3 min | 7,6 |

Mit Diskussion, Timer (bis 3 min je Runde) und Übergaben rechne ich bei Mini mit 15 bis 25 Minuten, bei 8 Spielern und drei Akten mit 30 bis 40 Minuten. Das ist **geschätzt, nicht gemessen.**

## 13. Grenzen (ehrlich)

- **Nicht mit echten Kindern getestet.** Ob Fünf- bis Sechsjährige die Knöpfe finden (goldener Knopf mit Symbol), die Stimme verstehen und die Zeugen-Duelle spielen, ist offen. „Mini ab 5“ ist eine Annahme.
- **Keine echten Stimmen getestet.** Wie sich zusammengesetzte Clips mit ElevenLabs anhören (Pausen, Betonung), ist ungeprüft. Die Browserstimme als Ersatz klingt deutlich schlechter.
- **Flüstern auf dem Handylautsprecher:** Es gibt keine Möglichkeit, im Browser auf den Ohrlautsprecher umzuschalten. Mit Kopfhörern ist es sicher, ohne nur „leise genug“.
- **Mogeln:** Ein Kind kann spähen oder „Nochmal hören“ nutzen, um sich Dinge zu merken. Wir verbieten das nicht, die Wirkung ist klein.
- **Farbenblinde Kinder** erkennen den farbigen Rand schlechter. Größe und Art sind als Symbol unabhängig davon prüfbar, die Farbspur nicht.
- **Emojis** sehen je nach Gerät anders aus. Eigene Illustrationen für die 8 Orte, die 32 Bilder und die 8 Beuten wären die nächste Verbesserung (Bildgenerator in Talea).
- **Täter in Mini und Junior ist immer auffindbar** (Hilfen). Das ist gewollt, nimmt aber dem Täter die Gewinnchance, wenn die Gruppe die Spuren richtig liest. Detektiv und Meister sind die Stufen mit echtem Verstecken.
- **Spielzeit** mit 8 Spielern und 3 Akten ist lang.
- **Mindestens 4 Spieler.** Für zwei oder drei Personen bräuchte es KI-Mitspieler (nicht gebaut).
- **Sprache:** nur Deutsch.

## 14. Offene Fragen

1. Reicht der **goldene Knopf mit Symbol** als Bedienung für 5-Jährige, oder braucht es einen Erwachsenen als „Handy-Wärter“?
2. Soll der Täter in Mini eine **kleine Gewinnchance** behalten, zum Beispiel durch verzögerte Hilfen (Einspruch erst nach der ersten Spur)?
3. **Wie viele Figuren-Eigenschaften** darf es als Spur geben? Mini nutzt Farbe, Größe, Art.
4. Brauchen wir ein **Notfall-Handyprotokoll** („Handy fällt aus, Partie unterbrochen“)? Der Spielstand wird nicht gespeichert.
5. Soll das Spiel später **echte Eigenschafts-Updates** an Talea schicken? Im Abspann steht aktuell nur ein Beispiel (Basiseigenschaft +1 mit Begründung), und nichts wird gespeichert.

## 15. Dateien

- `Mitternachts-Alibi.html`: das ganze Spiel in einer Datei (Bilder, Texte, Engine eingebettet), läuft ohne Server.
- `Stimmen.json`, `Effekte.json`: Aufnahme-Listen für ElevenLabs.
- `DREHBUCH_Beispielpartie.md`: jeder gesprochene und geflüsterte Satz einer ganzen Beispielpartie in Reihenfolge.
- `source/engine.js`: Regel-Engine ohne Oberfläche (Welt, Aussagen, Löser, Spuren, Täter-Strategien).
- `source/content.js`: Fälle, Orte, Bilder vom Ort, Erzählertexte, Flüstertexte und die gesamte Sprechliste (`clips`).
- `source/ui.js`, `source/style.css`: Oberfläche.
- `source/text/b1.js` bis `b6.js`: Texte der 89 Figuren. `source/chars-ma.json`: Figurendaten. `source/images.json`: Figurenbilder.
- `source/build.js`: baut HTML, `Stimmen.json` und `Effekte.json` (`node build.js`).
- `source/test-gen.js`, `source/test-strat.js`, `source/drive-ma2.js`, `source/test-import.js`: Lösbarkeit, Täter-Strategien, UI-Zufallsspieler, Import-Test.
