# Talea · Mitternachts-Alibi · Testversion v2 („Das Geheimtelefon“)

Öffne `Mitternachts-Alibi.html` im Browser (Handy, Tablet oder Computer). Es braucht keinen Server und keine Online-Verbindung. 4 bis 8 Personen spielen an einem Gerät. Allein kannst du den ganzen Ablauf mit den Beispielstufen durchklicken.

## Worum es geht
In Kicherwald ist in der Nacht etwas gestohlen worden. Einer von euch war es. Jeder bekommt zufällig eine Talea-Figur mit Zahl, farbigem Rand und eigener Stimme. In jedem Akt (Abend, Mitternacht, Morgengrauen) klingelt das **Geheimtelefon**: Wer dran ist, hält das Handy ans Ohr, und Kommissar Tavi flüstert, wo er war, wer bei ihm war und was er dort gesehen hat. Dann sagt Tavi laut, was die Figur behauptet. Alle sagen die Wahrheit, nur der Dieb erfindet sein Alibi für Mitternacht. Im Verhör vergleicht ihr die Dorfkarte, macht Zeugen-Duelle mit Bildern und holt Spuren vom Labor. Am Ende zeigen alle gleichzeitig auf den Dieb.

**Niemand muss lesen können.** Alles Öffentliche spricht Tavi, alles Private wird geflüstert, und zu allem gibt es ein Bild. Dafür ist die Stimme wichtig: Ohne Aufnahmen spricht der Browser mit einer Probestimme, die schlechter klingt.

## Was in v2 anders ist
- Zahl und Gesicht statt Text, Dorfkarte statt Tabelle, ein Bild (mit Geräusch) vom Ort statt Frage-Antwort-Text.
- Akt für Akt statt einer langen Akte: Pro Akt merkt man sich nur einen Ort, ein paar Gesichter und ein Bild.
- Vier Stufen: 🐣 Mini-Detektive (ab 5), 🔍 Junior-Detektive (ab 7), 🕵️ Detektiv (ab 10), 🎩 Meisterdetektiv.
- Das Geheimtelefon, ein ❓-Knopf mit gesprochener Hilfe auf jedem Schritt und „Kurz erklärt, mit Stimme“ (6 Bilder).
- Die Altersangaben sind Annahmen. Mit Kindern wurde nichts getestet.

Die genaue Prüfung von v1 und die Begründungen stehen in `MITTERNACHTS_ALIBI_SPIELREGEL_v2.md`.

## Hinweis zum Geheimtelefon
Das Handy flüstert mit etwa 40 % Lautstärke (unter „Stimmen & Audio“ einstellbar). Handy ans Ohr halten oder Kopfhörer benutzen. Ein Browser kann nicht auf den Ohrlautsprecher umschalten, ganz sicher ist also nur der Kopfhörer.

## ElevenLabs-Aufnahmen
`Stimmen.json` enthält 896 Aufnahmen mit stabilen Dateinamen, Sprechtext, Audio-Tag und Stimmbeschreibung. Die Sätze setzt das Spiel aus kurzen Clips zusammen (zum Beispiel „Nummer vier.“ + „Bäcker Braun.“ + „Auf der alten Brücke.“ + „Dabei:“ + „Nummer eins.“). Darum kommen **keine Spielernamen** in den Clips vor.

Drei Pakete (Annahme: 0,15 bis 0,30 € je 1 000 Zeichen):

| Paket | Inhalt | Zeichen | Kosten |
|---|---|---|---|
| 1 Kern | Tavi, Zahlen, Orte, Akte, Bilder, Flüstern, Figurennamen | 13 256 | 2,0 bis 4,0 € |
| 2 Auftritt | dazu Vorstellung und Schwur jeder Figur | 29 389 | 4,4 bis 8,8 € |
| 3 Zugaben | dazu Leugnen, Geständnis, Lachen, Macken | 56 463 | 8,5 bis 16,9 € |

Im Katalog steht bei jedem Eintrag `prio` (1, 2 oder 3). Das Spiel läuft schon mit Paket 1 komplett sprachgeführt, die Figurenzeilen sprechen dann mit der Browserstimme. `Effekte.json` enthält 56 Prompts für Klänge (Spielklänge, Ambiente und ein Geräusch für jedes der 32 Bilder). Preis nicht eingerechnet.

**Einbinden:** Dateien als MP3, WAV oder OGG erzeugen und im Spiel unter „Stimmen & Audio“ auswählen. Der Dateiname ohne Endung ist die Zuordnung (`num.3.mp3`, `w.num.3.mp3`, `fx.stamp.mp3`, `fx.sight.enten.mp3`, `amb.evening.mp3`). Unbekannte Namen und Dateien über 12 MB werden übersprungen. Die Aufnahmen bleiben nur für die aktuelle Sitzung im Browser. Es wird kein ElevenLabs-Aufruf gemacht und kein Schlüssel gebraucht.

## Teststand
- Lösbarkeit per Simulation: 3 000 Welten je Stufe und Spielerzahl, 6 Täter-Strategien, **0 unlösbare Fälle**.
- Rund 280 Partien über die echte Oberfläche durchgespielt (alle Stufen, 4 bis 8 Spieler, 340 bis 400 px Breite): keine Fehler, keine Hänger, der Täter war immer eindeutig bestimmbar, kein Sprechclip fehlte, und das Flüstern lief nie laut.
- `DREHBUCH_Beispielpartie.md` zeigt jeden gesprochenen und geflüsterten Satz einer ganzen Partie in Reihenfolge.
- **Nicht getestet:** echte Kinder, echte Stimmen, Spielen mit mehreren Menschen am Tisch, Spieldauer (Schätzung: Mini 15 bis 25 Minuten).

## Quellcode
Im Ordner `source/` liegen die Regel-Engine (`engine.js`), die Inhalte und die gesamte Sprechliste (`content.js`), die Oberfläche (`ui.js`, `style.css`), die Figurentexte (`text/`) und die Tests. `node build.js` fügt alles zu einer Datei zusammen und schreibt sie nach `source/out/`. `node test-gen.js` und `node test-strat.js` prüfen die Rätsel. `drive-ma2.js` spielt Partien über die Oberfläche (braucht Playwright).
