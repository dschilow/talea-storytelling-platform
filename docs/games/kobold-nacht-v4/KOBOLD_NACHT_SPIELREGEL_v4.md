# Kobold-Nacht v4: Regeln, Test und Balance

Stand: 2. Oktober 2026 · Status: spielbarer Browser-Prototyp (eine HTML-Datei), Regeln per Simulation geprüft, noch nicht mit echten Gruppen getestet, noch nicht in der Talea-App.

Dieses Dokument ersetzt `KOBOLD_NACHT_SPIELREGEL.md` (Stand 1. Oktober) und ist so geschrieben, dass eine andere Person oder KI die Regeln ohne den Prototyp prüfen, kritisieren und neu ausbalancieren kann. Der Quellcode liegt in `kobold-nacht-v4/source/`. Die gesamte Regellogik steht in `engine.js`.

---

## 1. Was beim Test der Testversion herauskam

Getestet wurde `Talea-Kobold-Nacht-Testversion.zip` (Regeln: Schlüsselloch und Spurenleser je 2 Einsätze, 7 bzw. 9 Türgriffe, 1 Kobold bei 4–6 Spielern, falsche Anklage kostet 1, Entzauberte spielen weiter, Murmeln für alle gleich).

**Methode.** Die Regeln wurden als eigene Engine nachgebaut. Dazu spielten Bots mit: Das Dorf berechnet nach jedem Hinweis die Wahrscheinlichkeit für jede mögliche Verteilung der Kobolde (Bayes), vertraut ehrlichen Fähigkeits-Meldungen und zeigt auf den Wahrscheinlichsten. Die Kobolde lügen gezielt (falsche Schlüsselloch-Meldungen, Rahmung Unschuldiger), wählen Opfer mit Gewicht auf wichtige Fähigkeiten und setzen Streiche ein. Zusätzlich gibt es ein „menschliches“ Dorf, das später anklagt, sich weniger abspricht und Hinweisen weniger traut.

**Befunde:**

1. **Zu leicht.** Ein kompetentes Dorf gewann 94–100 % der Partien. Bei 4–6 Spielern war in 40–57 % der Partien schon nach der ersten Nacht Schluss.
2. **Schuld sind die Prüf-Fähigkeiten.** Ohne Schlüsselloch und Spurenleser lag das Dorf bei 76 % (5 Spieler) bzw. 47 % (8 Spieler). Weil alle Fähigkeiten öffentlich sind und die Besitzer meistens ehrlich, vertraut das Dorf ihren Meldungen. Zwei Einsätze pro Fähigkeit kippten alles.
3. **Das Murmeln ist die einzige Hinweisquelle neben den Fähigkeiten.** Ohne Prüf-Fähigkeiten und ohne den Faktor 2 für Kobolde hat das Dorf kaum Chancen (16 % bei 5, 0 % bei 8 Spielern). Der Faktor ist also tragend.
4. **Ein Fehler in den Regeln.** Ein Spurenleser braucht mindestens zwei prüfbare Spieler. Sind viele aufgedeckt, brach die Engine ab. In v4 ist die Fähigkeit dann nicht „verfügbar“ (`blocked(...) === 'nobody'`).
5. **Kleine Runden.** Bei 4 Spielern gewann das Dorf trotz allem 98 %, solange es Schlüsselloch oder Spurenleser gab.
6. **Oberfläche.** In der hellen Darstellung war die „Nacht“ hell und cremefarben. Ein Fehler im Text („Wessen Spruch war das Gemurmelt?“), der Rahmen für das Umdrehen der Karte hatte keine Animation, Frösche waren nur ein Textschild, und die Beratungs-Uhr zeichnete jede Sekunde den ganzen Bildschirm neu (Tippen konnte verloren gehen).

---

## 2. Spielziel und Ablauf

Kobold Kicher klaut nachts Türgriffe in Kicherwald. Er steckt heimlich in einem oder zwei Spielern (die Kobolde). Alle anderen sind das Dorf.

- **Das Dorf gewinnt**, wenn alle Kobolde entlarvt (entzaubert) sind.
- **Die Kobolde gewinnen**, wenn der letzte Türgriff geklaut ist.

Ein Handy liegt in der Mitte und ist der Spielleiter (Erzähler Tavi). 4–9 Spieler. Niemand scheidet aus.

**Vorbereitung**
1. *Zauberhut.* Jeder bekommt zufällig eine Figur aus dem Talea-Figuren-Pool (88 spielbare Figuren) mit genau einer Fähigkeit. Figur, Fähigkeit und Lieblingsspruch sind öffentlich.
2. *Geheime Karte.* Das Handy geht reihum. Jeder sieht allein, ob er Dorf oder Kobold ist; Kobolde sehen ihren Komplizen. Kobolde behalten ihre Figur und Fähigkeit.

**Eine Runde**
1. *Nacht* (Augen zu, Ohren auf). Das Handy ruft in fester Reihenfolge: Kobolde → Laterne → Honigfalle → Trostpflaster → Schlüsselloch → Spurenleser → Bücherwurm. Wer gerufen wird, schaut kurz und tippt. Jede vorhandene Fähigkeit wird jede Nacht gerufen, auch wenn sie nichts tun kann (Tarnung).
2. *Morgen.* Türgriff −1. Dann in Stufen: Ergebnis des Zaubers → Gemurmel → Streich des Tages → Froschaufgabe.
3. *Beratung.* Timer (3 bzw. 2 Minuten, nur ein Vorschlag). Alle dürfen alles behaupten, nur das Handy lügt nie. Redestein möglich.
4. *Zeigen.* Das Handy zählt „Drei, zwei, eins, zeigt!“. Alle zeigen gleichzeitig auf einen Verdächtigen (oder nach oben = niemand). Das Zählen der Finger passiert am Tisch; jemand tippt das Ergebnis ein.
5. *Entlarven.* Wer die meisten Finger hat, deckt seine Karte auf (Trommelwirbel, Karte dreht sich).
6. *Abend.* Frösche werden wieder normal.

---

## 3. Parameter je Stufe und Spielerzahl

Alles steht in `configFor(level, N)` in `engine.js`.

| | Erste Partie (ab 6) | Volles Spiel (ab 8) | Profi-Nacht (ab 10) |
|---|---|---|---|
| Kobolde | 1 bei ≤ 6, 2 bei ≥ 7 | 1 bei 4, sonst 2 | 1 bei 4, sonst 2 |
| Türgriffe | 6 (4 Sp.), 7 (5–6), 9 (7–9) | wie links | wie links |
| Falsche Anklage kostet | 1 | 2 | 2 |
| Nebel-Streich (Kobolde) | 0 | 1 | 2 |
| Stimme klauen (Kobolde) | 0 | 0 | 1 |
| Beratungszeit | 3 min | 3 min | 2 min |
| Fähigkeits-Pool | 7 (Spurenleser, Honigfalle nur als Auffüller) | 9 | 9 |

Für alle Stufen gleich: Schlüsselloch 1 Einsatz, Spurenleser 1 Einsatz, beide **erst ab Nacht 2**; Trostpflaster 1 Rettung; Honigfalle 1 Falle; Murmel-Gewicht Kobold 2, alle anderen 1.

**Bei 4 Spielern:** kein Schlüsselloch und kein Spurenleser (Pflichtfähigkeit nur Laterne), 6 Türgriffe.

**Verteilung der Fähigkeiten.** Pflicht: Schlüsselloch + Laterne (bei 4 Spielern nur Laterne). Dazu 1 (bei < 6 Spielern) bzw. 2 Taghelfer. Rest zufällig aus dem Pool; jede Fähigkeit höchstens einmal pro Partie, daher maximal 9 Spieler. Für jede Fähigkeit wird zufällig eine Figur mit dieser Fähigkeit gezogen. Die Kobolde werden unabhängig von der Figur zufällig bestimmt.

---

## 4. Nacht und Morgen im Detail

**Kobolde.** Wählen gemeinsam ein Opfer. Nicht erlaubt ist nur das Opfer der Vornacht. Ein Kobold darf Opfer sein (falsche Fährte). Entzauberte sind normale Dorfbewohner und dürfen Opfer sein. Danach (Volles Spiel/Profi) optional **ein** Streich pro Nacht:
- 🌫️ **Nebel:** Eine Nachtfähigkeit (Laterne, Honigfalle, Trostpflaster, Schlüsselloch, Spurenleser) wirkt heute nicht. Der Besitzer sieht „Nebel!“ und behält die Fähigkeit (Einsatz wird nicht verbraucht). Alle Besitzer sind wählbar, auch wenn die Fähigkeit schon verbraucht ist, damit die Kobolde daraus nichts schließen können.
- 🎭 **Stimme klauen** (Profi): Morgen murmelt eine gewählte, nicht aufgedeckte Figur, obwohl sie nicht wach war. Die Chronik verrät es am Ende.

**Fähigkeiten**

| Fähigkeit | Eigenschaft | Typ | Wirkung |
|---|---|---|---|
| 🔍 Schlüsselloch | Neugier | 🌙 | ab Nacht 2, einmal: prüft einen Spieler (nicht aufgedeckt, nicht sich selbst): Kobold ja/nein, nur für den Besitzer |
| 🦁 Laterne | Mut | 🌙 | jede Nacht: schützt einen Spieler (auch sich selbst), nicht zweimal denselben hintereinander |
| 💗 Trostpflaster | Empathie | 🌙 | sieht jede Nacht das Opfer, kann einmal retten (auch sich selbst) |
| 🔢 Spurenleser | Logik | 🌙 | ab Nacht 2, einmal: zwei Spieler: Anzahl aktiver Kobolde darunter (0/1/2); Entzauberte zählen 0 |
| 🎨 Honigfalle | Kreativität | 🌙 | einmal: Falle bei einem Spieler. Trifft der Zauber genau dorthin: gestoppt + öffentliche Honigspur (zwei Namen in zufälliger Reihenfolge, genau einer davon ein aktiver Kobold) |
| 🧠 Bücherwurm | Wissen | 🌙 | nur Nacht 1: ein sicherer Dorf-Name (zufällig, nicht er selbst, kein aktiver Kobold) |
| 🔤 Redestein | Wortschatz | ☀️ | einmal: 60 s ungestört reden; sein Finger zählt an diesem Tag doppelt |
| 🤝 Dorfglocke | Teamgeist | ☀️ | entscheidet jeden Gleichstand (nicht, wenn sie Frosch ist) |
| 🧗 Dickkopf | Ausdauer | ☀️ | der erste Froschzauber gegen ihn prallt ab (Name wird genannt) |

Kobolde mit Fähigkeiten sehen echte Ergebnisse und dürfen darüber lügen.

**Auflösung des Zaubers** (erstes zutreffendes): Laterne → Honigfalle (+ Spur) → Trostpflaster → Dickkopf → Frosch. Genutzte Mittel sind verbraucht, auch wenn sie nicht nötig waren. Bei gestopptem Zauber nennt das Handy nur das Mittel, nicht den Geschützten (Ausnahme: Dickkopf).

**Murmeln.** Jeden Morgen genau ein Spruch. Gewichtete Ziehung unter allen nicht aufgedeckten Spielern: aktiver Kobold 2, alle anderen 1. Sonderfall: gestohlene Stimme.

**Frosch.** Bis zum Abend: nicht sprechen, nicht abstimmen, keine Tagesfähigkeit. Quaken und Gesten erlaubt. Der Frosch bekommt eine Froschaufgabe (7 Stück, z. B. „Quake jedes Mal, wenn du glaubst, dass jemand lügt“).

---

## 5. Tag, Zeigen, Entlarvung

- *Streich des Tages* (optional, Standard an): 16 Spaßregeln für die Beratung, ohne Einfluss auf die Spielregeln (z. B. Reimtag, Namenstausch, „Das Wort Kobold ist verboten, sagt Kichererbse“).
- *Zeigen:* Handy zählt 3-2-1 mit Ton und Vibration. Frösche zeigen nicht. Ergebnis wird eingegeben: ein Verdächtiger / Gleichstand / alle nach oben.
  - Gleichstand: Dorfglocke wählt; ohne (oder bei Frosch) wird niemand entlarvt.
  - Alle nach oben: niemand entlarvt, kostet nichts.
- *Entlarvung:* Karte schüttelt sich (Trommelwirbel), dreht sich.
  - **Kobold:** wird *entzaubert*. Er zählt ab jetzt zum Dorf, behält Stimme und Fähigkeit, kann aber nicht noch einmal angeklagt werden.
  - **Unschuldig:** grünes Häkchen (kann nicht mehr angeklagt werden), Türgriffe −Kosten der Stufe. Die Figur ruft empört ihren Lieblingsspruch.
- Pro Tag höchstens eine Entlarvung.
- *Letzter Tag:* Bei 1 Türgriff warnt das Handy (Banner, rotes Pulsieren): Heute Nacht ist der letzte Türgriff weg. Ist die Strafe für eine falsche Anklage ≥ den übrigen Türgriffen, verliert eine falsche Anklage sofort.

**Spielende.** Auszeichnungen (10 Titel, jeder Spieler bekommt einen), Beispiel für das Eigenschafts-Update des Avatars (nur Vorschau), Chronik aller Nächte und Tage.

---

## 6. Wo Spannung und Humor herkommen

**Spannung**
- Türgriff-Uhr wird sichtbar (Tür-Symbole), ab 2 Türgriffen rote Türen, ab dem letzten pulsiert der Rahmen.
- Morgenbericht in Stufen mit Spannungspausen (KNARRZ → Zauber → Murmeln).
- Zählen 3-2-1 und „ZEIGT!“; Entlarvung mit Trommelwirbel und Umdrehen; Vibration.
- Falsche Anklagen sind teuer (2 Türgriffe im Vollen Spiel). Das macht jedes „Zeigen“ zu einer Wette.
- Erste Nacht ohne Prüf-Fähigkeiten: mindestens zwei Nächte Rätsel.
- Nebel und Stimme klauen geben den Kobolden Aktionen.

**Humor**
- Tavi spricht die Spieler direkt an („Ich sehe dich blinzeln, Opa.“), nur auf dem Bildschirm; gesprochene Zeilen enthalten keine Namen.
- Frosch-Look (grün getönt, hüpfender Frosch) und Froschaufgaben.
- 16 Tagesstreiche.
- Figuren rufen bei falscher Anklage ihren eigenen Lieblingsspruch.
- Scherztexte bei blockierten Fähigkeiten („Das Schlüsselloch putzt noch seine Brille.“).
- Auszeichnungen wie „Lautester Frosch“, „Frechster Kobold“, „Nebelkind“, „Schlafredner“.

---

## 7. Balance-Ergebnisse (Simulation)

Jeweils 4 000 Partien pro Zelle. „Kompetent“ = Bayes-Dorf mit ehrlicher Absprache. „Menschlich“ = späteres Anklagen (Schwelle 0,35), halbe Absprache, geringeres Vertrauen in Meldungen. „knapp“ = Dorfsieg mit ≤ 2 Türgriffen Rest oder Kobold-Sieg.

Zielbänder: Erste Partie ~85–95 % Dorf, Volles Spiel 65–85 %, Profi 50–75 %; mittlere Dauer 3–5 Nächte; höchstens ~10 % der Partien nach einer Nacht entschieden.

**Testversion (Vergleich):** kompetent 94–100 % Dorf; 1-Nacht-Partien bei 4–6 Spielern 40–57 %; Nächte 1,5–3,3.

### Erste Partie
| Spieler | Dorf (kompetent) | Dorf (menschlich) | Nächte | nach 1 Nacht vorbei | knapp |
|---|---|---|---|---|---|
| 4 | 81 % | 95 % | 3,2 | 16 % | 46 % |
| 5 | 96 % | 98 % | 2,6 | 9 % | 13 % |
| 6 | 82 % | 90 % | 3,6 | 0 % | 33 % |
| 7 | 89 % | 96 % | 4,5 | 0 % | 27 % |
| 8 | 83 % | 89 % | 4,7 | 0 % | 34 % |
| 9 | 70 % | 85 % | 5,8 | 0 % | 51 % |

### Volles Spiel
| Spieler | Dorf (kompetent) | Dorf (menschlich) | Nächte | nach 1 Nacht vorbei | knapp |
|---|---|---|---|---|---|
| 4 | 74 % | 85 % | 3,2 | 15 % | 53 % |
| 5 | 72 % | 65 % | 3,3 | 0 % | 64 % |
| 6 | 75 % | 70 % | 3,4 | 0 % | 64 % |
| 7 | 86 % | 87 % | 3,9 | 0 % | 34 % |
| 8 | 77 % | 80 % | 4,4 | 0 % | 42 % |
| 9 | 67 % | 74 % | 5,2 | 0 % | 48 % |

### Profi-Nacht
| Spieler | Dorf (kompetent) | Dorf (menschlich) | Nächte | nach 1 Nacht vorbei | knapp |
|---|---|---|---|---|---|
| 4 | 65 % | 78 % | 3,6 | 11 % | 67 % |
| 5 | 60 % | 50 % | 3,5 | 0 % | 81 % |
| 6 | 60 % | 52 % | 3,6 | 0 % | 81 % |
| 7 | 78 % | 77 % | 4,2 | 0 % | 49 % |
| 8 | 68 % | 70 % | 4,7 | 0 % | 55 % |
| 9 | 60 % | 61 % | 5,4 | 0 % | 59 % |

**Welche Stellschrauben was bewirken** (Einzelmessungen am Vorläufer der Konfiguration, 5/7/9 Spieler):
- Falsche Anklage kostet 2 statt 1: Dorf −7 bis −12 Prozentpunkte, knappe Partien +9 bis +29 Punkte. Stärkster Spannungshebel.
- Murmel-Faktor 3 statt 2: Dorf +2 bis +14 Punkte (am meisten bei 9 Spielern). Faktor 1 (wirkungslos): Dorf −2 bis −39 Punkte (am meisten bei 9 Spielern).
- 2 statt 1 Kobold bei 5 Spielern: Dorf −11 Punkte, Nächte +1,3.
- Nebel: nur ±2 Punkte im Bot-Test. Der Wert liegt in Spielgefühl und Bluff, nicht in Prozenten.
- Prüfen ab Nacht 2: Partien nach einer Nacht von 40–57 % auf 0–15 %.

**Grenzen der Simulation.** Die Bots sprechen nicht. Menschen bluffen besser und vertrauen schlechter als das Modell, Kinder sind schwächer im Schlussfolgern, die Kobold-Bots lügen einfach. Die Zahlen sind eine Obergrenze für das Dorf und eine Richtung, keine Vorhersage. Sie ersetzen keine Testrunden mit Familien.

---

## 8. UI-Test

Der Prototyp wurde in einem echten Browser (headless Chromium) getestet:
- 171 vollständige Partien über die echte Oberfläche per Zufallsentscheidungen (4–9 Spieler, alle drei Stufen, Schnellmodus): keine Fehler, keine Hänger, alle seltenen Pfade erreicht (Nebel, Stimme klauen, Spurenleser-Ergebnis, Gleichstand, Entlarvung).
- Echtzeit-Test mit Touch-Eingabe: Morgenbericht ca. 20 s in vier Stufen, Uhr zählt korrekt, Pause hält, Zählen 2,8 s, Regeln lassen sich öffnen und mit Escape schließen.
- Bildschirmfotos aller Phasen bei 340, 400 und 1100 px Breite.
- Tippen während einer Umblendung geht nicht mehr verloren (Neuzeichnen wird verschoben, solange ein Finger drückt).

**Nicht getestet:** echte Sprachausgabe (im Test ohne Stimmen), echte ElevenLabs-Aufnahmen, Spielen auf einem echten Handy, mehrere Menschen am Tisch, Lesbarkeit für 6-Jährige.

---

## 9. Offene Fragen und Risiken

1. **Balance mit Menschen.** Vor allem die Erste Partie bei 5 Spielern (96 % im Bot-Test) ist sehr leicht. Mit einem Kobold und zwei Prüf-Fähigkeiten ist dort nach Nacht 2 oft alles klar.
2. **Der Murmel-Faktor ist tragend.** Wenn Gruppen das Murmeln ignorieren, wird das Spiel deutlich schwerer. Soll das Murmeln im Spiel stärker betont werden (Wiederholungs-Anzeige „Wer hat schon einmal gemurmelt?“)?
3. **Kobold-Bots sind zu einfach.** Menschliche Kobolde können falsche Meldungen geschickter einsetzen. Mögliche Lücke: Das Schlüsselloch als Kobold ist stark.
4. **Nebel trifft öffentliche Fähigkeiten.** Weil Fähigkeiten öffentlich sind, wissen die Kobolde, wen sie vernebeln müssen. Das ist gewollt, ändert aber die Rolle der Informationsfähigkeiten.
5. **Spielzeit.** 4–6 Nächte bei 8–9 Spielern bedeuten 30 Minuten und mehr. Für Kinder zu lang?
6. **Kleine Runden.** Bei 4 Spielern gibt es keine Prüf-Fähigkeiten. Das ist so getestet; der Reiz ist dort das Murmeln und das Bluffen.
7. **Verschiedene Eingabe der Finger.** Das Zählen der Finger geschieht am Tisch. Bei Streit gibt es keine Schiedsrichter-Funktion.
8. **KI-Nachbarn** für Familien mit 2–3 Personen sind nicht gebaut. Die Bot-Logik (`bots.js`) wäre eine Grundlage dafür.
9. **Blinzeln.** Es gibt keine technische Absicherung gegen Schummeln bei geschlossenen Augen.
10. **Figuren-Daten.** 128 Einträge, 89 verschiedene Namen (Dopplungen bereinigen). 18 Figuren haben Art „any“. Bei „Kobold Kicher“ ist keine eigene Stimme festgelegt.

---

## 10. Stimmen und Kosten

`Stimmen.json` enthält 266 Aufnahmen. Alle Tavi-Zeilen sind **namenlos**. Namen stehen nur auf dem Bildschirm.
- 89 Tavi-Zeilen (Nacht, Morgen, Frosch, Entlarvung, Sieg/Niederlage, Streiche, Froschaufgaben)
- 89 Lieblingssprüche (Figuren-Stimmen, inklusive Kobold Kicher)
- 88 Murmel-Varianten (derselbe Spruch, `eleven`-Feld mit Audio-Tag `[sleepily, mumbling]`)

Gesamt rund 14 700 Zeichen. Bei 0,15–0,30 € pro 1 000 Zeichen ergibt das etwa 2–4,50 € einmalig. Pro Partie entstehen keine Stimmkosten. Annahme, bitte mit der eigenen ElevenLabs-Abrechnung abgleichen. Fehlen Aufnahmen, spricht der Browser mit einer Probestimme.

---

## 11. Dateien

```
kobold-nacht-v4/
  Kobold-Nacht.html        das Spiel (eine Datei, 1,1 MB, Bilder eingebettet)
  Stimmen.json             Katalog der Aufnahmen
  Liesmich.md              Kurzanleitung
  Talea-Kobold-Nacht-v4.zip
  source/
    engine.js              alle Regeln, ohne Oberfläche
    content.js             Texte, Streiche, Froschaufgaben, Auszeichnungen
    ui.js, style.css       Oberfläche
    bots.js, final-sim.js  Simulation (node final-sim.js 4000)
    build.js               fügt alles zu einer Datei zusammen
    chars.json             bereinigte Figurendaten (ohne Bilder)
```
