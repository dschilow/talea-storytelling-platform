# Talea · Mitternachts-Alibi · Testversion v1

Öffne `Mitternachts-Alibi.html` im Browser (Handy, Tablet oder Computer). Es braucht keinen Server und keine Online-Verbindung. 4 bis 8 Personen spielen an einem Gerät. Allein kannst du den ganzen Ablauf mit den Beispielnamen durchklicken.

## Worum es geht
In Kicherwald ist in der Nacht etwas gestohlen worden. Einer von euch war es. Jeder bekommt zufällig eine Talea-Figur mit eigener Kurzgeschichte und eigener Stimme. Kommissar Tavi führt durch den Abend. Jeder liest geheim, wo er am Abend, um Mitternacht und im Morgengrauen war und wer dabei war. Alle sagen die Wahrheit. Nur der Täter erfindet sein Mitternachts-Alibi, erst im Zeugenstand, nachdem er die anderen gehört hat. Im Kreuzverhör vergleicht ihr die Aussagen, macht Zeugen-Duelle und holt Spuren vom Labor. Am Ende zeigen alle gleichzeitig auf den Täter, die Karte dreht sich, die Figur gesteht in ihrer Stimme.

Jeder Fall ist vorab auf Lösbarkeit geprüft: Mit allen Aussagen und Spuren bleibt immer genau ein Verdächtiger übrig, egal welches Alibi der Täter wählt.

## Stufen
- **Kinder-Fall** (ab 7): Das Protokoll markiert Widersprüche und Personen ohne Zeugen. Zwei Spuren, zwei Anklagen.
- **Detektiv** (ab 10): Auch ein Unschuldiger hat um Mitternacht keinen Zeugen. Keine Markierungen. Zwei Spuren, eine Anklage.
- **Meisterdetektiv** (Erwachsene): Zwei Unschuldige ohne Zeugen, drei Spuren, kürzere Verhöre, eine Anklage.

Für die erste Runde empfiehlt das Spiel den Kinder-Fall, auch für Erwachsene.

## ElevenLabs-Aufnahmen
`Stimmen.json` enthält 519 Aufnahmen mit stabilen Dateinamen, Sprechtext, Audio-Tag und Stimmbeschreibung:
- `kom.*`: Kommissar Tavi, der Erzähler (74 Zeilen, **ohne Spielernamen**, damit sie vorab aufgenommen werden können)
- `character.<name>.intro`, `.stmt`, `.deny`, `.confess`, `.smug`: je 89 Zeilen in der Stimme der Figur (Vorstellung, Aussage, Leugnen, Geständnis, selbstgefälliges Lachen)

Gesamt 44 323 Zeichen, bei 0,15–0,30 € pro 1 000 Zeichen etwa 6,60–13,30 € einmalig (Annahme, bitte mit deiner Abrechnung abgleichen). Günstiger Start: nur `kom.*` und `intro` (16 682 Zeichen). Pro Partie entstehen keine Stimmkosten.
`Effekte.json` enthält 14 Prompts für Klänge (Stempel, Hammer, Trommelwirbel, Fanfare und weitere). Im Spiel laufen als Platzhalter synthetische Effekte.

Dateien als MP3, WAV oder OGG erzeugen und im Spiel unter „Stimmen & Audio“ auswählen. Der Dateiname ohne Endung ist die Zuordnung. Für fehlende Aufnahmen spricht der Browser mit einer Probestimme oder das Spiel bleibt stumm. Die Aufnahmen bleiben nur für die aktuelle Sitzung im Browser. Geheime Akten und private Ergebnisse werden nie vorgelesen. Es wird kein ElevenLabs-Aufruf gemacht und kein Schlüssel gebraucht.

## Teststand
- Lösbarkeit per Simulation geprüft: 3 000 Welten pro Stufe und Spielerzahl (4 bis 8), 6 Täter-Strategien, **0 unlösbare Fälle**. Die Einzelheiten stehen in `MITTERNACHTS_ALIBI_SPIELREGEL.md`.
- 100 Partien über die echte Oberfläche in einem Browser durchgespielt (alle Stufen, 4 bis 8 Spieler, Zufalls-Klicker): keine Fehler, kein Hänger, bei jeder Anklage ist der Täter eindeutig bestimmbar.
- Oberfläche bei 340 und 400 Pixel Breite geprüft.
- Nicht getestet: echte Sprachausgabe, echte Aufnahmen, Spielen mit mehreren Menschen am Tisch, Lesbarkeit für 7-Jährige, Spieldauer (Schätzung 20 bis 30 Minuten).
- Altersangaben und Dauer sind Annahmen. Das Spiel braucht echte Testrunden.

## Quellcode
Im Ordner `source/` liegen die Regel-Engine (`engine.js`), die Inhalte (`content.js`, `text/b1.js` bis `b6.js`), die Oberfläche (`ui.js`, `style.css`) und die Tests (`test-gen.js`, `test-strat.js`): `node test-gen.js` prüft die Lösbarkeit, `node test-strat.js` vergleicht Täter-Strategien. `node build.js` fügt alles zu einer Datei zusammen und schreibt sie nach `source/out/` (die 89 eingebetteten Figurenbilder liegen in `images.json`).
