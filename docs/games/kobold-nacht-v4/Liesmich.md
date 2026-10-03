# Talea · Kobold-Nacht · Testversion v4

Öffne `Kobold-Nacht.html` im Browser (Handy, Tablet oder Computer). Es braucht keinen Server und keine Online-Verbindung. 4 bis 9 Personen spielen an einem Gerät. Allein kannst du den ganzen Ablauf mit den Beispielnamen durchklicken.

## Was beim Test der letzten Version herauskam
Ein cleveres Dorf hat die Testversion in 94 bis 100 % der Partien gewonnen, bei 4 bis 6 Spielern war die Hälfte der Partien nach einer Nacht vorbei. Schuld waren Schlüsselloch und Spurenleser mit je zwei Einsätzen. Die Details stehen in `KOBOLD_NACHT_SPIELREGEL_v4.md`.

## Was in v4 anders ist
- **Regeln:** Schlüsselloch und Spurenleser haben nur einen Einsatz und dürfen erst ab Nacht 2 schauen. Zwei Kobolde ab 5 Spielern (in der Ersten Partie ab 7). Falsche Anklagen kosten im Vollen Spiel und in der Profi-Nacht zwei Türgriffe. Bei 4 Spielern gibt es keine Prüf-Fähigkeiten.
- **Streiche für die Kobolde:** 🌫️ Nebel (blockiert eine Nachtfähigkeit), 🎭 Stimme klauen (nur Profi-Nacht).
- **Lustiger:** Streich des Tages (16 Spaßregeln für die Beratung), Froschaufgaben, die Figur ruft bei falscher Anklage ihren eigenen Lieblingsspruch, Auszeichnungen am Ende.
- **Spannender:** Morgenbericht in Stufen, Zählen 3-2-1 mit Vibration, Entlarvung mit Trommelwirbel und Umdrehen der Karte, „Letzter Tag“-Warnung mit rotem Rahmen, sichtbare Türgriffe.
- **Aussehen:** immer dunkel (Nachtspiel), alle 88 Figuren mit Bild, Frösche werden grün und hüpfen.
- **Verständlich:** 📖 „Alle Regeln“ mit Beispielen und häufigen Fragen, Hilfe zu jedem Schritt, „So geht’s in einer Minute“ beim Start.

## ElevenLabs-Aufnahmen
`Stimmen.json` enthält 266 Aufnahmen mit stabilen Dateinamen und Sprechtext:
- `tavi.*`: Erzähler (89 Zeilen, **ohne Spielernamen**, damit sie vorab aufgenommen werden können)
- `character.<name>.quote`: Lieblingsspruch einer Figur in ihrer Stimme (89)
- `character.<name>.murmur`: derselbe Spruch, verschlafen genuschelt (88). Im Feld `eleven` steht der Text mit Audio-Tag am Anfang.

Gesamt rund 14 700 Zeichen, bei 0,15–0,30 € pro 1 000 Zeichen etwa 2–4,50 € einmalig (Annahme, bitte mit deiner Abrechnung abgleichen). Pro Partie entstehen keine Stimmkosten.

Dateien als MP3, WAV oder OGG erzeugen und im Spiel unter „Stimmen & Audio“ auswählen. Der Dateiname ohne Endung ist die Zuordnung. Unbekannte Namen und Dateien über 12 MB werden übersprungen. Für fehlende Aufnahmen spricht der Browser mit einer Probestimme. Die Aufnahmen bleiben nur für die aktuelle Sitzung im Browser. Geheime Karten und private Ergebnisse werden nie vorgelesen. Es wird kein ElevenLabs-Aufruf gemacht und kein Schlüssel gebraucht.

## Korrektur nach v4
- Buttons verschieben sich beim Überfahren mit der Maus nicht mehr (vorher konnte ein Klick am Rand daneben gehen). Statt der Verschiebung werden sie nur heller.

## Teststand
- Regelbalance per Simulation geprüft (Bots, die wie ein cleveres Dorf rechnen; Details im Regeldokument). Mit echten Gruppen noch nicht getestet.
- 171 Partien über die echte Oberfläche in einem Browser durchgespielt, 4 bis 9 Spieler, alle Stufen: keine Fehler.
- Nicht getestet: echte Sprachausgabe, echte Aufnahmen, Spielen mit mehreren Menschen am Tisch, Lesbarkeit für 6-Jährige.
- Altersangaben und Dauer sind Annahmen. Das Spiel braucht echte Testrunden.

## Quellcode
Im Ordner `source/` liegen die Regel-Engine (`engine.js`) und die Simulation (`bots.js`, `final-sim.js`): `node final-sim.js 4000` zeigt die Gewinnquoten. `build.js` fügt alles zu einer Datei zusammen (braucht `images.json` mit den eingebetteten Bildern, die aus den Figurenbildern erzeugt wird).
