# Kobold-Nacht: vollständige Spielbeschreibung

Stand: 1. Oktober 2026 · Status: Konzept mit spielbarem Browser-Prototyp, noch nicht in der Talea-App umgesetzt.

Dieses Dokument beschreibt das Spiel vollständig: Regeln, Parameter, Auflösungslogik, Figuren-Zuordnung, Designentscheidungen und offene Fragen. Es ist so geschrieben, dass man es ohne den Prototyp analysieren, kritisieren und ausbalancieren kann.

---

## 1. Überblick

| Merkmal | Wert |
|---|---|
| Genre | Soziales Deduktionsspiel (Werwolf-Familie), versteckte Teams |
| Spieler | 4–9 |
| Alter | ab 6 Jahren; Kinder und Erwachsene spielen gemeinsam |
| Dauer | ca. 15–30 Minuten |
| Material | ein Handy oder Tablet mit der Talea-App, das in der Mitte liegt |
| Spielleiter | keiner; die App übernimmt die Rolle des Erzählers und Moderators |
| Erzähler | Tavi (feste ElevenLabs-Stimme aus Talea) |
| Slogan | „Augen zu. Ohren auf.“ |

**Spielidee:** In Kicherwald verschwinden nachts die Türgriffe. Schuld ist Kobold Kicher (eine Figur aus dem Talea-Figuren-Pool, Macke: „sammelt knarrende Türgriffe als Trophäen“, Spruch: „Hihi – ein Trick, ein Klick, ein Glück!“). Kicher ist heimlich in ein oder zwei Spieler geschlüpft. Alle anderen gehören zum Dorf.

**Teams:**
- **Dorf** gewinnt, wenn alle Kobolde entlarvt (gefangen) sind.
- **Kobolde** gewinnen, wenn der letzte Türgriff geklaut ist.

---

## 2. Spielerzahl und Parameter

| Spieler | Kobolde | Türgriffe (Start) | Taghelfer mindestens |
|---|---|---|---|
| 4–5 | 1 | 5 | 1 |
| 6 | 1 | 5 | 2 |
| 7–9 | 2 | 7 | 2 |

- Jede Nacht kostet **1 Türgriff**, unabhängig davon, was sonst passiert.
- Jede **falsche Entlarvung** (Unschuldiger aufgedeckt) kostet **1 Türgriff**.
- Eine Abstimmung ohne Entlarvung kostet nichts.
- Bei 0 Türgriffen gewinnen sofort die Kobolde.

Die Türgriff-Zahlen sind ein erster Wurf und noch nicht mit echten Gruppen getestet.

---

## 3. Vorbereitung

### 3.1 Der Zauberhut (öffentlich)
Die App zieht für jeden Spieler zufällig eine Figur aus dem Talea-Figuren-Pool. Jede Figur hat genau eine **Fähigkeit** (siehe Abschnitt 6). Die Figur stellt sich mit ihrem **Lieblingsspruch** in ihrer eigenen Stimme vor („Mia ist … Drache Fauchi! *Erst qualmt’s, dann klärt’s sich!*“).

- Figur, Fähigkeit und Lieblingsspruch sind **öffentlich**. Alle sehen sie jederzeit im „Dorf“-Bildschirm und können dort Sprüche erneut anhören.
- Die Sprüche sind wichtig für die Murmel-Regel (Abschnitt 5).

**Algorithmus der Fähigkeitsauswahl:**
1. Pflicht: Schlüsselloch und Laterne sind immer im Spiel.
2. Dazu zufällige Taghelfer-Fähigkeiten: mindestens 1 (bei ≥ 6 Spielern mindestens 2).
3. Restliche Plätze zufällig aus dem Fähigkeiten-Pool der Stufe auffüllen.
4. Reicht der Pool der Stufe nicht (Stufe „Erste Partie“ bei 8–9 Spielern), werden die Zusatzfähigkeiten der Stufe ergänzt.
5. Jede Fähigkeit kommt pro Partie **höchstens einmal** vor. Dadurch ist die Spielerzahl auf 9 begrenzt.
6. Für jede gezogene Fähigkeit wird eine zufällige Figur mit genau dieser Fähigkeit gewählt; keine Figur doppelt.

### 3.2 Die geheime Karte (verdeckt)
Das Handy geht reihum. Jeder sieht allein:
- **„Du gehörst zum Dorf“** oder **„Du bist ein Kicherkobold!“** (Kobold-Karte zeigt das Bild von Kobold Kicher),
- bei zwei Kobolden zusätzlich den Namen des Komplizen,
- seine Fähigkeit inklusive Hinweis, dass Kobolde ihre Fähigkeit nutzen und über das Ergebnis lügen dürfen.

Die Kobolde werden **unabhängig von der Figur** zufällig bestimmt. Jede Figur kann Kobold sein, auch „gute“ Figuren wie Oma Herzlich. Ein Kobold behält seine Figur und Fähigkeit.

Danach liegt das Handy in der Mitte.

---

## 4. Ablauf einer Runde

Eine Runde = Nacht → Morgen → Tag → Abend.

### 4.1 Nacht („Augen zu. Ohren auf.“)
Alle schließen die Augen. Die App ruft nacheinander auf. Wer gerufen wird, öffnet die Augen, tippt auf dem Handy und schließt sie wieder. Feste Reihenfolge:

1. **Kobolde**: wählen gemeinsam ein Opfer für den Froschzauber.
   - Nicht erlaubt: ein Kobold, ein gefangener Spieler, das Opfer der vorigen Nacht (egal ob der Zauber damals geklappt hat).
   - Profi-Stufe: danach einmal im Spiel optional „Stimme nachmachen“ (siehe 4.5).
   - Erste Nacht bei 2 Kobolden: Sie sehen sich gegenseitig.
2. **Laterne 🦁**: schützt einen Spieler (auch sich selbst), aber nicht denselben wie in der vorigen Nacht.
3. **Honigfalle 🎨**: stellt einmal im Spiel eine Falle vor ein Haus oder überspringt („Heute keine Falle“).
4. **Trostpflaster 💗**: sieht das Opfer der Kobolde und kann es einmal im Spiel retten (auch sich selbst).
5. **Schlüsselloch 🔍**: prüft einen anderen, nicht gefangenen Spieler und sieht privat „Kobold“ oder „Kein Kobold“.
6. **Spurenleser 🔢**: wählt zwei andere, nicht gefangene Spieler und sieht privat die Anzahl Kobolde darunter (0, 1 oder 2), nicht aber, welcher.
7. **Bücherwurm 🧠**: sieht in der **ersten Nacht** privat einen Namen, der sicher zum Dorf gehört (zufälliger Dorfspieler außer ihm selbst).

**Tarn-Regel:** Gerufen werden nur Fähigkeiten, die in der Partie vorkommen. Diese werden aber **jede Nacht** gerufen, auch wenn sie verbraucht sind (Honigfalle, Trostpflaster), nur in Nacht 1 wirken (Bücherwurm) oder ihr Besitzer gefangen ist. Dann tippt der Gerufene nur „Fertig“. So verrät der Ablauf nichts.

Kobolde mit Fähigkeiten nutzen diese ganz normal und sehen echte Ergebnisse (z. B. sieht ein Kobold-Schlüsselloch die Wahrheit, darf aber lügen).

### 4.2 Auflösung der Nacht (Reihenfolge der Prüfung)
Opfer V sei das Ziel der Kobolde. Es wird in dieser Priorität geprüft, das Erste, das greift, zählt:

1. Laterne schützt V → Zauber gestoppt („Laterne“).
2. Honigfalle steht bei V → Zauber gestoppt („Honig“) und **Honigspur**: Die App nennt öffentlich zwei Namen in zufälliger Reihenfolge: einen zufälligen aktiven Kobold und einen zufälligen anderen Dorfspieler (nicht V, nicht gefangen). „Einer von beiden ist ein Kobold.“
3. Trostpflaster hat gerettet → Zauber gestoppt („Trostpflaster“).
4. V hat Dickkopf und ihn noch nicht verbraucht → Zauber prallt ab, Dickkopf verbraucht („Dickkopf“, Name wird genannt).
5. Sonst: V wird **Frosch**.

Weitere Effekte:
- Eine aufgestellte Honigfalle ist danach verbraucht, auch wenn sie nicht ausgelöst wurde.
- Das Trostpflaster ist verbraucht, sobald es „Retten“ wählt, auch wenn Laterne oder Falle ohnehin geschützt hätten.
- Bei gestopptem Zauber nennt die App nur das Mittel (Laterne / Falle / Trostpflaster), **nicht** wer geschützt wurde. Ausnahme Dickkopf: Hier wird der Name genannt, da die Fähigkeit passiv und öffentlich ist.
- Türgriffe − 1.
- Murmel-Ereignis bestimmen (Abschnitt 5).
- Bei 0 Türgriffen: Spielende, Kobolde gewinnen.

### 4.3 Morgen
Die App berichtet öffentlich:
1. „KNARRZ!“ Ein Türgriff fehlt, Anzahl übrig.
2. Ergebnis des Zaubers: Frosch (mit Name), gestoppt (mit Mittel), Honigspur (zwei Namen) oder Dickkopf (mit Name).
3. **„Ohren auf!“** Die App spielt einen Lieblingsspruch, der im Schlaf gemurmelt wurde. Nur der Spruch wird gezeigt bzw. abgespielt, **nicht** der Name. Die Spieler müssen selbst zuordnen, wem er gehört.

**Frosch:** bis zum Abend nicht sprechen, nicht abstimmen, keine Tagesfähigkeit nutzen. Quaken und Zeichensprache sind ausdrücklich erlaubt (auch auf Leute zeigen). Nachtfähigkeiten sind nicht betroffen, weil der Frosch-Zustand erst am Morgen beginnt und am Abend endet.

### 4.4 Tag
1. **Beraten:** Timer (Standard 3 Minuten, Profi 2 Minuten). Der Timer ist ein Vorschlag; man kann jederzeit zum Zeigen übergehen. Alle dürfen lügen; nur die App lügt nie.
2. **Redestein 🔤** (falls vorhanden, nicht Frosch, nicht gefangen, nicht verbraucht): einmal im Spiel 60 Sekunden ungestört reden; an diesem Tag zählt sein Finger beim Zeigen doppelt.
3. **Zeigen:** Die App zählt „Drei, zwei, eins, ZEIGT!“. Alle (außer Fröschen und Gefangenen) zeigen gleichzeitig auf einen Mitspieler oder nach oben (= niemanden verdächtigen). Das Zählen passiert am Tisch, nicht in der App.
   - **Ein Spieler hat die meisten Finger** → wird in der App angetippt → Entlarvung.
   - **Die meisten zeigen nach oben** → heute keine Entlarvung, keine Kosten.
   - **Gleichstand** → die **Dorfglocke 🤝** wählt unter den Gleichstand-Kandidaten. Gibt es keine Dorfglocke, oder ist sie Frosch oder gefangen → keine Entlarvung.
4. **Entlarvung:** Trommelwirbel, die App deckt die geheime Karte auf.
   - **Kobold:** gefangen („Käfig“). Ab jetzt: schweigt, stimmt nicht ab, nutzt keine Fähigkeit, murmelt nicht, kann nicht Ziel der Kobolde sein. Seine Nachtfähigkeit wird aus Tarngründen weiter gerufen.
   - **Unschuldig:** bekommt das grüne Häkchen (öffentlich bewiesene Vertrauensperson), aber **Türgriffe − 1**.
5. Siegprüfung.

Pro Tag gibt es höchstens eine Entlarvung.

### 4.5 Abend
Alle Frösche werden wieder normal. Die nächste Nacht beginnt.

### 4.6 Spielende und Chronik
Sieg des Dorfs: alle Kobolde gefangen. Sieg der Kobolde: 0 Türgriffe (nach einer Nacht oder nach einer falschen Entlarvung).

Danach deckt die App alle Karten auf und zeigt die **Chronik**: für jede Nacht, wen die Kobolde verhexen wollten, wen die Laterne schützte, wo die Falle stand, ob das Trostpflaster rettete, was Schlüsselloch, Spurenleser und Bücherwurm sahen, wie der Zauber ausging und wer wirklich gemurmelt hat (bzw. ob die Stimme nachgemacht war). Dazu jede Tagesentscheidung.

---

## 5. Die Murmel-Regel („Ohren auf“): Kernmechanik

Nachts sind nur zwei Gruppen wach:
- alle **aktiven Kobolde**,
- alle Besitzer einer **Nachtfähigkeit 🌙** (Schlüsselloch, Laterne, Honigfalle, Trostpflaster, Spurenleser, Bücherwurm), auch wenn diese verbraucht ist.

Besitzer einer **Tagfähigkeit ☀️** (Redestein, Dorfglocke, Dickkopf) schlafen immer.

**Daraus folgt die zentrale Schlussregel:** Murmelt ein ☀️-Taghelfer, ist er ein Kobold. Murmelt ein 🌙-Nachthelfer, kann er Kobold oder einfach wach gewesen sein.

**Ziehung des Murmelnden** (jeden Morgen genau einer):
- Kandidaten: aktive Kobolde mit **Gewicht 2**, nicht gefangene Dorf-Nachthelfer mit **Gewicht 1**. Ein Kobold mit Nachtfähigkeit zählt nur als Kobold (Gewicht 2).
- Gefangene Kobolde murmeln nicht.
- Begründung im Spiel: „Kobolde sind aufgeregt und murmeln doppelt so oft.“

**Profi-Stufe „Stimme nachmachen“:** Einmal im Spiel dürfen die Kobolde nach der Opferwahl einen beliebigen nicht gefangenen Spieler wählen. Am nächsten Morgen murmelt dann dessen Spruch, egal ob er wach war. Damit können Kobolde einen Taghelfer fälschlich belasten. Die App sagt am Morgen nicht, ob nachgemacht wurde; die Chronik verrät es am Ende.

**Folgen für die Strategie:**
- Ein Kobold mit Nachtfähigkeit ist gut getarnt, einer mit Tagfähigkeit lebt gefährlich.
- Bei wenigen Nachthelfern zeigt das Murmeln häufiger direkt auf einen Kobold.

---

## 6. Die neun Fähigkeiten

Jede Fähigkeit gehört zu einer der neun Talea-Persönlichkeitseigenschaften.

| Fähigkeit | Eigenschaft | Typ | Häufigkeit | Wirkung |
|---|---|---|---|---|
| 🔍 Schlüsselloch | Neugier | 🌙 Nacht | jede Nacht | Prüft einen anderen Spieler privat: Kobold ja/nein. Immer im Spiel. |
| 🦁 Laterne | Mut | 🌙 Nacht | jede Nacht | Schützt einen Spieler (auch sich selbst) vor dem Froschzauber; nicht zweimal hintereinander denselben. Immer im Spiel. |
| 💗 Trostpflaster | Empathie | 🌙 Nacht | sieht jede Nacht das Opfer, rettet einmal pro Spiel | Kann das Opfer der Kobolde retten, auch sich selbst. |
| 🔢 Spurenleser | Logik | 🌙 Nacht | jede Nacht | Wählt zwei andere Spieler, erfährt die Anzahl der Kobolde darunter (0/1/2). |
| 🎨 Honigfalle | Kreativität | 🌙 Nacht | einmal pro Spiel | Falle vor ein Haus. Trifft der Zauber genau dorthin: Zauber gestoppt plus öffentliche Honigspur zu zwei Namen, einer davon ein Kobold. |
| 🧠 Bücherwurm | Wissen | 🌙 Nacht | nur Nacht 1 | Erfährt privat einen Namen, der sicher zum Dorf gehört. |
| 🔤 Redestein | Wortschatz | ☀️ Tag | einmal pro Spiel | 60 Sekunden ungestört reden; an diesem Tag zählt sein Finger beim Zeigen doppelt. |
| 🤝 Dorfglocke | Teamgeist | ☀️ Tag | bei jedem Gleichstand | Entscheidet zwischen den Gleichstand-Kandidaten, wer entlarvt wird. |
| 🧗 Dickkopf | Ausdauer | ☀️ Tag (passiv) | einmal | Der erste Froschzauber gegen ihn prallt ab (öffentlich mit Name). |

Alle Fähigkeiten sind öffentlich bekannt. Geheim ist nur das Team.

---

## 7. Stufen

| Stufe | Für wen | Fähigkeiten-Pool | Beratung | Besonderheit |
|---|---|---|---|---|
| Erste Partie | ab 6, erste Runde | Schlüsselloch, Laterne, Trostpflaster, Bücherwurm, Redestein, Dorfglocke, Dickkopf. Spurenleser und Honigfalle nur, wenn bei 8–9 Spielern nötig | 3 Min | weniger zu merken |
| Volles Spiel | ab 8 | alle neun | 3 Min | — |
| Profi-Nacht | ab 10 und Erwachsene | alle neun | 2 Min | Kobolde dürfen einmal eine Stimme nachmachen |

---

## 8. Sonderfälle

- **Lügen:** Alle dürfen alles behaupten. Die App lügt nie.
- **Kobold hat das Schlüsselloch:** Dann gibt es kein echtes Schlüsselloch in der Partie (jede Fähigkeit nur einmal). Der Kobold kann beliebige „Ergebnisse“ erfinden. Spurenleser, Honigfalle und Murmeln werden dann wichtiger.
- **Kobold hat den Bücherwurm:** Er sieht trotzdem einen echten Dorfnamen, darf aber etwas anderes behaupten.
- **Kobold hat die Dorfglocke:** Er entscheidet Gleichstände, kann also einen Komplizen schützen oder einen Unschuldigen opfern.
- **Mehrere Schutzwirkungen gleichzeitig:** Es zählt die Priorität Laterne → Honigfalle → Trostpflaster → Dickkopf. Verbraucht werden trotzdem die aktiv eingesetzten Mittel.
- **Frosch zeigt mit Gesten:** erlaubt; nur Abstimmen und Sprechen sind verboten.
- **Gefangener Kobold mit Nachtfähigkeit:** wird weiter gerufen, tippt nur „Fertig“, murmelt nicht.
- **Weniger als 4 Spieler:** nicht vorgesehen. Für kleine Familien sind KI-Nachbarn aus dem Figuren-Pool geplant (nicht spezifiziert, nicht im Prototyp).

---

## 9. Figuren-Pool und Fähigkeiten-Zuordnung

Quelle: `Logs/talea-characters-2026-08-10T08-13-38-438Z.json` (128 Einträge, 89 eindeutige Namen, alle mit Bild). Kobold Kicher ist keine spielbare Figur, sondern das Gesicht der Kobold-Karte. Es bleiben 88 spielbare Figuren.

**Zuordnungsregel:** Fähigkeit aus dem `archetype` der Figur, mit manuellen Ausnahmen. Bösewichte (`role: antagonist`) wurden bewusst gemischt und teils gegen ihr Image besetzt (z. B. Der Leiser-Mann als Redestein, Tante Sorgenfalt als Laterne).

Archetyp-Tabelle:

| Fähigkeit | Archetypen |
|---|---|
| Schlüsselloch | observer, cosmic_visitor, explorer, investigator, clever_animal, animal_trickster, adventurer, ethereal_guide |
| Laterne | guardian, hero, hero_helper, loyal_animal, sea_keeper, friendly_dragon |
| Trostpflaster | caregiver, helpful_elder, magical_helper, aquatic_guide, dream_weaver, innocent |
| Spurenleser | craftsman, inventor, merchant, time_mystical, patient_guide, forest_guide |
| Honigfalle | artist, trickster_witch, magical_trickster, magical_sprite, playful_helper |
| Bücherwurm | mentor, magical_mentor, scholarly_mentor, knowledge_keeper, animal_mentor |
| Redestein | messenger, neutral |
| Dorfglocke | helpful_villager, helper, ruler, royal |
| Dickkopf | creature, creature_obstacle, elemental, misunderstood_grump, guardian_challenge |

Verteilung im Pool: Schlüsselloch 14, Spurenleser 11, Laterne 10, Dorfglocke 10, Bücherwurm 10, Redestein 9, Trostpflaster 9, Dickkopf 8, Honigfalle 7.

Vollständige Liste (Figur · Fähigkeit · Lieblingsspruch · Macke):

| Figur | Fähigkeit | Lieblingsspruch | Macke |
|---|---|---|---|
| Amir Sternfinder | 🔍 Schlüsselloch | „Warte kurz – da ist ein Muster.“ | verbindet beim Denken unsichtbare Sterne mit dem Zeigefinger |
| Astra | 🔍 Schlüsselloch | „Seht ihr? Jeder Stern erzählt eine Geschichte...“ | funkelt heller wenn sie sich freut |
| Astronautin Nova | 🔍 Schlüsselloch | „Helm zu, Herz auf, los!“ | zählt vor jeder Entscheidung leise von drei herunter |
| Der Geräusche-Fresser | 🔍 Schlüsselloch | „Pssst. Jetzt ist es still. Viel zu still, nicht wahr?“ | schmatzt hörbar, nachdem er ein Geräusch geschluckt hat |
| Detektiv Schnüffel | 🔍 Schlüsselloch | „Der kleinste Hinweis spricht am lautesten.“ | putzt nach jedem Aha-Moment seine Lupe |
| Die Nebelfee | 🔍 Schlüsselloch | „Nicht alles, was verborgen ist, will gefunden werden...“ | wird durchsichtiger wenn sie nervös ist |
| Eichhörnchen Flitz | 🔍 Schlüsselloch | „Zack, hoch, weg – Flitz regelt das!“ | jongliert Eicheln, wenn es plant |
| Hirtenjunge Peter | 🔍 Schlüsselloch | „Meine Schafe haben es mir erzählt! Die wissen alles!“ | hat immer einen Grashalm im Mund |
| Juna Windwärts | 🔍 Schlüsselloch | „Ein Hindernis ist noch lange kein Ende.“ | dreht ihr Kompassrad einmal im Kreis, bevor sie eine Route wählt |
| Kapitän Blubbert | 🔍 Schlüsselloch | „Volle Fahrt durchs Abenteuer!“ | prüft den Wind mit einem Stück Seetang |
| Luna | 🔍 Schlüsselloch | „Miau... ich wusste es natürlich schon die ganze Zeit.“ | putzt sich betont gelangweilt eine Pfote, wenn sie nachdenkt |
| Mia Neugier | 🔍 Schlüsselloch | „Warte, ich hab da noch eine Frage!“ | notiert Entdeckungen auf ihre Ärmelmanschette |
| Räuber Raubauke | 🔍 Schlüsselloch | „Erst klauen, dann schauen!“ | wirft beim Reden eine Münze in die Luft |
| Schattenjunge Finn | 🔍 Schlüsselloch | „Ich kenn dich nicht mehr. Du hast dich verändert.“ | sein Schatten bewegt sich eine halbe Sekunde später als er selbst |
| Feuerwehrfrau Fanni | 🦁 Laterne | „Wasser marsch, Ruhe auch!“ | prüft reflexartig jeden Raum auf Fluchtwege |
| Frau Wellenreiter | 🦁 Laterne | „Das Meer lehrt Geduld – und wer geduldig ist, findet den Weg.“ | schaut immer kurz zum Horizont bevor sie antwortet |
| Funkelflug | 🦁 Laterne | „Hups! Das sollte eigentlich nicht brennen...“ | niest kleine Feuerfunken wenn er aufgeregt ist |
| Lumi Nachtlicht | 🦁 Laterne | „Ein kleines Licht reicht für den nächsten Schritt.“ | leuchtet bei Nervosität in kleinen goldenen Pulsen |
| Polizist Peter | 🦁 Laterne | „Sicherheit zuerst, dann der Rest.“ | notiert Uhrzeiten sekundengenau |
| Prinz Alexander | 🦁 Laterne | „Auf ins Abenteuer – wer kommt mit?“ | legt die Hand ans Schwert wenn er sich auf etwas konzentriert |
| Prinzessin Rosalinde | 🦁 Laterne | „Stärke kommt nicht vom Schwert, sondern vom Herzen.“ | steckt sich eine Blume ins Haar bevor es ernst wird |
| Ritter Rostfrei | 🦁 Laterne | „Helm hoch, Herz höher!“ | poliert nervös eine Stelle am Brustpanzer |
| Silberhorn der Hirsch | 🦁 Laterne | „Der Wald vergisst nie, wer ihm Gutes tut.“ | senkt das Geweih zum Gruß wenn er jemandem vertraut |
| Tante Sorgenfalt | 🦁 Laterne | „Pass auf. Pass auf. Pass auf.“ | zupft sich beim Sprechen immer an einem Tuch in der Hand |
| Bauerntochter Greta | 💗 Trostpflaster | „Schau mal, die Blumen haben mir den Weg gezeigt!“ | pflückt immer Blumen und verschenkt sie an alle |
| Fee Rosalie | 💗 Trostpflaster | „Ein Flügelschlag, und Mut wird gross!“ | ordnet ihre Zauberstaebe nach Farben |
| Hexe Kräuterweis | 💗 Trostpflaster | „Jede Wurzel kennt ein Gegenmittel.“ | riecht vor jeder Entscheidung an einem Kräuterbuendel |
| Magd Elsa | 💗 Trostpflaster | „Ich schaffe das schon... ich schaffe das immer.“ | summt leise vor sich hin wenn sie arbeitet |
| Morpheus | 💗 Trostpflaster | „Psst... schließ die Augen. Ich zeige dir etwas Schönes.“ | kleine Traumwölkchen schweben um ihn herum |
| Oma Herzlich | 💗 Trostpflaster | „Setz dich erst, dann wird alles leichter.“ | traegt immer ein Bonbonpapier als Glückszeichen |
| Samu Sanftpfote | 💗 Trostpflaster | „Stark geht auch ganz leise.“ | reibt bei Anspannung langsam beide hellen Pfoten aneinander |
| Weise Frau Margarethe | 💗 Trostpflaster | „Gegen jedes Leid ist ein Kraut gewachsen.“ | reibt getrocknete Kräuter zwischen den Fingern während sie spricht |
| Yara Wellenklang | 💗 Trostpflaster | „Hör hin – das Wasser zeigt den Weg.“ | zupft vor Entscheidungen drei Töne auf ihrer Muschelharfe |
| Bäcker Wilhelm | 🔢 Spurenleser | „Ohne Frühstück kein Abenteuer – hier, nimm ein Brötchen!“ | schnuppert an allem als ob es frisches Brot wäre |
| Der Zeitweber | 🔢 Spurenleser | „Die Zeit fließt nicht – sie tanzt.“ | seine Augen flackern wie Sanduhren wenn er nachdenkt |
| Der Zu-Ordentliche | 🔢 Spurenleser | „Nicht so. Richtig. So ist das richtig.“ | richtet im Gehen automatisch alles aus, sogar fremde Schuhe |
| Die Stundendiebin | 🔢 Spurenleser | „Eine Minute nur. Du merkst es gar nicht.“ | tickt leise wie eine Taschenuhr, wenn sie nervös wird |
| Kuno Knopf | 🔢 Spurenleser | „Ein guter Flicken darf gesehen werden.“ | prüft beim Nachdenken alle Knöpfe an seiner Mütze |
| Müller Hans | 🔢 Spurenleser | „Harte Arbeit lohnt sich immer – irgendwann.“ | klopft Mehlstaub von den Händen bevor er spricht |
| Räuber Rolf | 🔢 Spurenleser | „Her mit dem Gold! Äh... ich meine... das ist eine Weggebühr!“ | schielt nervös nach links und rechts bevor er spricht |
| Rika Rindenlauf | 🔢 Spurenleser | „Der Wald warnt leise, aber nie zu spät.“ | streicht mit dem Daumen über eine Kerbe im Wanderstab |
| Schmied Konrad | 🔢 Spurenleser | „Was im Feuer geschmiedet wird, hält ewig!“ | hämmert unbewusst mit der Faust auf den Tisch wenn er redet |
| Theo Zeitsam | 🔢 Spurenleser | „Langsam sieht man mehr – meistens.“ | blickt auf seine stehen gebliebene Uhr und nickt zufrieden |
| Tilda Tüftel | 🔢 Spurenleser | „Wenn es noch nicht klappt, fehlt nur eine Idee!“ | steckt beim Nachdenken einen Bleistift quer durch ihre Locken |
| Die Nebelhexe | 🎨 Honigfalle | „Hihihi! Das war doch nur ein kleiner Trick... oder?“ | kichert hinter vorgehaltener Hand bevor sie einen Zauber spricht |
| Hexe Griselda | 🎨 Honigfalle | „Knusper, knusper... ach, das war eine Andere. Ich bin VIEL schlimmer!“ | rührt ständig in einem unsichtbaren Kessel |
| Krummfinger der Sammler | 🎨 Honigfalle | „Meins. Jetzt meins. Immer meins.“ | zählt beim Sprechen nebenbei unsichtbare Münzen auf dem Tisch |
| Magierin Luna | 🎨 Honigfalle | „Der Kristall zeigt mir... oh, das ist unerwartet.“ | ihr Kristallstab leuchtet heller wenn sie aufgeregt ist |
| Mina Mosaik | 🎨 Honigfalle | „Aus anders wird zusammen.“ | legt vor einer Antwort drei Mosaiksteine nebeneinander |
| Pip | 🎨 Honigfalle | „Nüsse! Äh, ich meine... natürlich helfe ich!“ | hüpft aufgeregt von einem Fuß auf den anderen |
| Silberfunke | 🎨 Honigfalle | „Glitzer, Funkel, Sternenstaub – wer mich findet, dem hilft der Traum!“ | hinterlässt überall eine Spur aus silbernem Glitzerstaub |
| Bo Bücherfuchs | 🧠 Bücherwurm | „Eine gute Frage braucht kein Lesezeichen.“ | ordnet beim Sprechen die Lesezeichen in seiner Tasche neu |
| Die Alte Eiche | 🧠 Bücherwurm | „Die Wurzeln wissen mehr als die Blätter ahnen.“ | raschelt leise mit den Blättern bevor sie spricht |
| Die Besserwisserin Klotilde | 🧠 Bücherwurm | „Eigentlich... müsstest du das wissen.“ | hustet jedes Mal leise, bevor sie jemanden korrigiert |
| Gelehrter Professor Theodor | 🧠 Bücherwurm | „Moment! Ich habe hier irgendwo eine Notiz dazu... äh... war es dieses Buch?“ | hat immer Tintenflecken an den Fingern und merkt es nie |
| Herr Seitenflug | 🧠 Bücherwurm | „Ah! Dazu habe ich ein Buch! Moment... es war hier irgendwo...“ | kramt in seinen vielen Westentaschen nach dem richtigen Lesezeichen |
| Lehrerin Lämpel | 🧠 Bücherwurm | „Fragen sind der Anfang von Mut.“ | zeichnet kleine Gluehbirnen neben gute Ideen |
| Professor Lichtweis | 🧠 Bücherwurm | „Faszinierend! Das muss ich sofort aufschreiben!“ | schiebt ständig seine runde Brille hoch, die immer wieder herunterrutscht |
| Schwarzmagier Vardun | 🧠 Bücherwurm | „Schatten gehorchen nur den Entschlossenen.“ | lässt Schattenfinger über seine Schulter gleiten |
| Zauberer Merlin | 🧠 Bücherwurm | „Magie liegt nicht im Zauberstab – sie liegt in dir.“ | lässt kleine Funken aus der Stabspitze sprühen wenn er schmunzelt |
| Zauberer Sternenschweif | 🧠 Bücherwurm | „Magie folgt dem, der klar fuehlt.“ | zeichnet Sternbahnen mit dem Zauberstab in die Luft |
| Bäcker Bruno | 🔤 Redestein | „Frisch aus dem Ofen, frisch fürs Herz!“ | klopft dreimal auf den Teig, bevor er backt |
| Der Leiser-Mann | 🔤 Redestein | „Leise. Niemand soll das hoeren.“ | sein Husten klingt wie 'pssst' |
| Der Mutlosmacher | 🔤 Redestein | „Kannste eh nicht. Lass nur.“ | seufzt vor jedem Satz hörbar aus |
| Flüstertante Flora | 🔤 Redestein | „Pssst. Das sagen wir niemandem, ja?“ | legt beim Sprechen immer einen Finger an die eigenen Lippen |
| Frau Müller | 🔤 Redestein | „Wer genau hinhört, dem flüstert der Wind die Antwort zu.“ | streicht sich nachdenklich über ihren grünen Schal |
| Frosch Quak | 🔤 Redestein | „Quak drauf los, dann klappt das schon!“ | trommelt mit den Zehen kleine Quak-Beats |
| Händler Gustav | 🔤 Redestein | „Nur heute, nur für euch – ein Sonderpreis! Na gut, ZWEI Sonderpreise!“ | reibt sich die Hände wenn er einen guten Deal wittert |
| Noch-Einmal-Nick | 🔤 Redestein | „Nur noch einmal. Nur dies eine Mal noch.“ | rollt beim Sprechen immer eine Münze über die Fingerknoechel |
| Postbote Papierschiff | 🔤 Redestein | „Jede Nachricht findet ihren Hafen.“ | faltet vor langen Wegen ein Mini-Papierschiff |
| Bäcker Braun | 🤝 Dorfglocke | „Kommt, probiert mal! Frisch aus dem Ofen!“ | wischt sich ständig die mehlbestäubten Hände an der Schürze ab |
| Diener Johann | 🤝 Dorfglocke | „Wie Ihr wünscht... obwohl... nein, natürlich wie Ihr wünscht.“ | verbeugt sich reflexartig bei jeder Anrede |
| Frau Gleichgleich | 🤝 Dorfglocke | „Genau gleich. Immer genau gleich, bitte.“ | klopft vor jedem Satz dreimal auf ihre Armlehne |
| König Friedrich | 🤝 Dorfglocke | „Ordnung ist das Fundament eines jeden Reiches!“ | klopft ungeduldig mit dem Siegelring auf den Thron |
| König Karl der Weise | 🤝 Dorfglocke | „Ein kluger Schritt spart hundert hektische.“ | zeichnet beim Denken kleine Schachzuege in die Luft |
| König Wilhelm | 🤝 Dorfglocke | „Ein König dient seinem Volk – nicht umgekehrt.“ | streicht sich durch den weißen Bart wenn er nachdenkt |
| Königin Isabella | 🤝 Dorfglocke | „Mit Klugheit und Güte lässt sich jeder Streit lösen.“ | legt beruhigend die Hand auf die Schulter des Gegenübers |
| Räuberhauptmann Rotbart | 🤝 Dorfglocke | „Kein Schatz ohne Preis!“ | kämmt seinen roten Bart vor jeder Aktion |
| Stiefmutter Brunhilde | 🤝 Dorfglocke | „Schönheit vergeht – aber Macht bleibt!“ | betrachtet sich in jeder spiegelnden Oberfläche |
| Wirtin Martha | 🤝 Dorfglocke | „Setzt euch hin, esst was Warmes – dann sieht die Welt gleich anders aus!“ | trocknet ständig ein Glas ab, auch wenn es schon sauber ist |
| Bruchkind Brenno | 🧗 Dickkopf | „Dann ist es eben kaputt. So ist das.“ | hält im Stehen ständig eine Hand offen, als wuerde er etwas fallen lassen wollen |
| Brumm der Steinwächter | 🧗 Dickkopf | „BRUMM. Nicht. Weiter. Gehen.“ | kleine Steinchen fallen von ihm ab wenn er überrascht ist |
| Der Letzte Wehmüter | 🧗 Dickkopf | „Ich bin der Letzte. Ich bleibe hier.“ | summt ohne es zu merken alte Lieder, die er kaum noch kennt |
| Drache Fauchi | 🧗 Dickkopf | „Erst qualmt’s, dann klärt’s sich!“ | pustet kleine Rauchkringel beim Nachdenken |
| Graf Griesgram | 🧗 Dickkopf | „Ruhe! Ich brauche absolute... na gut, EINE Frage noch.“ | dreht sich weg um sein Lächeln zu verstecken |
| Graumund der Gleichgültige | 🧗 Dickkopf | „Mir doch egal. Macht ihr nur.“ | zieht überall wo er steht die Farbe aus dem Boden |
| Troll Grummel | 🧗 Dickkopf | „Erst knurren, dann helfen.“ | sammelt glatte Steine und sortiert sie nach Größe |
| Wolke Wuschel | 🧗 Dickkopf | „Gefühle ziehen weiter, genau wie Wolken.“ | wechselt bei starken Gefühlen unabsichtlich die Wetterfarbe |

---

## 10. Inspiration: verwandte Spiele

| Spiel | Besonderheit | Übernommen / bewusst nicht übernommen |
|---|---|---|
| Die Werwölfe von Düsterwald | Nacht/Tag, Augen zu, Erzähler; Gefressene scheiden aus | Rhythmus und „Augen zu“ übernommen. Ausscheiden ersetzt durch Frosch-Tag. |
| Blood on the Clocktower | Jeder hat eine eigene Fähigkeit; Tote spielen weiter | Jeder hat eine Fähigkeit; niemand scheidet (bis zur Entlarvung) aus. Später denkbar: Tarn-Fähigkeiten für Kobolde. |
| Avalon / The Resistance | Niemand stirbt; „Dame vom See“ wandert | Kein Ausscheiden. Erweiterungsidee: wandernde „goldene Lupe“. |
| One Night Ultimate Werewolf | Eine Nacht, App-Erzähler, Karten werden vertauscht | App-Erzähler übernommen. Vertauschen für Kinder zu verwirrend. |
| Wer war’s? (Ravensburger, Kinderspiel des Jahres 2008) | Sprechendes Gerät führt Kinder kooperativ | Beleg, dass ein sprechender Spielleiter mit Kindern funktioniert. |
| Mafia de Cuba | Kiste geht reihum, heimliche Rollenwahl | Handy-Weitergeben als Ritual. |

Eigene Elemente, die es so in keinem der Vorbilder gibt: Zauberhut-Ziehung mit Figurenstimme, Murmel-Regel, öffentliche Figuren mit geheimen Teams, Frosch-Tag statt Ausscheiden, Türgriff-Uhr als gemeinsamer Zeitdruck, Chronik am Ende.

---

## 11. Designentscheidungen und Begründungen

1. **Keine Eliminierung durch die Nacht:** Bei Werwolf mit Kindern ist das frühe Ausscheiden der häufigste Frustgrund. Der Druck entsteht stattdessen über die Türgriff-Uhr. Der Frosch nimmt nur für einen Tag Stimme und Abstimmung.
2. **Öffentliche Fähigkeiten:** Kinder müssen nicht bluffen, welche Rolle sie haben; die Diskussion dreht sich um Ergebnisse („Was hast du gesehen?“). Kobolde mit Informationsfähigkeiten können trotzdem lügen.
3. **Jede Fähigkeit nur einmal:** Macht jede Partie anders und schafft Unsicherheit, ob eine Informationsquelle echt ist.
4. **Murmel-Regel:** gibt jeden Morgen einen Hinweis, der für Kinder leicht und für Erwachsene probabilistisch interessant ist. Verbindet das Spiel mit Talea-Stimmen.
5. **Falsche Entlarvung kostet Zeit:** belohnt vorsichtiges Abwägen, bestraft Raten aber nicht mit Ausscheiden.
6. **App lügt nie:** klare Vertrauensbasis, alle Täuschung kommt von Spielern.
7. **Tarnrufe:** verhindern, dass man aus dem Ablauf (Länge, ausgelassene Rufe) auf Spielzustände schließt.

---

## 12. Technische Umsetzung (geplant)

- **Prototyp:** eine HTML-Seite mit kompletter Spiel-Engine als Zustandsautomat (Phasen: setup → draw → board → pass → nightIntro → night → morning → day → vote → reveal → evening → … → end). Browser-Sprachausgabe statt ElevenLabs. 2.700 Bot-Partien liefen ohne Absturz und ohne Endlosschleife; über die Balance mit echten Spielern sagen sie nichts.
- **App:** Engine im Frontend, Clips vorproduziert (ElevenLabs): Tavi als Erzähler, je Figur drei Clips (Vorstellung, Spruch, Geständnis), Geräusche (Knarren, Quaken, Trommelwirbel, Eule, Fanfare). Pro Partie keine neuen Stimmkosten; einmalig grob 2–4 € für ~12.000 Zeichen (Annahme 0,15–0,30 € pro 1.000 Zeichen).
- **Daten:** neues Feld „Fähigkeit“ pro Figur im Figuren-Pool; Dopplungen im Pool bereinigen.
- **Belohnung:** am Ende ein kleines Eigenschafts-Update für den Talea-Avatar des Kindes, immer mit Beschreibung, über `backend/avatar/updatePersonality.ts`.

---

## 13. Offene Fragen und bekannte Schwachstellen (zur Analyse)

1. **Balance der Türgriffe:** 5 bzw. 7 sind ungetestet. Bei 1 Kobold und vielen Informationsfähigkeiten könnte das Dorf zu stark sein.
2. **Stärke des Murmelns:** Bei Spielen mit wenigen Nachthelfern und einem Kobold mit Tagfähigkeit kann der Kobold schon am ersten Morgen eindeutig enttarnt werden (Wahrscheinlichkeit grob 2/(2 + Anzahl Dorf-Nachthelfer)). Ist das zu stark?
3. **Honigspur:** nennt immer einen echten Kobold. Zusammen mit Schlüsselloch oder Spurenleser kann das sehr schnell entscheiden.
4. **Kobold-Seite hat wenig aktive Werkzeuge:** nur Opferwahl und (Profi) Stimme nachmachen. Brauchen die Kobolde mehr Spielraum, z. B. Tarn-Fähigkeiten zum Behaupten?
5. **Ein Kobold mit Dorfglocke** kann Gleichstände entscheiden. Zu stark oder gewollte Spannung?
6. **Gefangene Kobolde** schweigen bis zum Ende. Widerspricht leicht dem Grundsatz „niemand fliegt raus“. Alternative gesucht?
7. **Kinder und geschlossene Augen:** Blinzeln ist bei Kindern wahrscheinlich. Reicht das soziale Versprechen, oder braucht es eine Mechanik (z. B. alle legen die Hand auf den Tisch)?
8. **3 Spieler / kleine Familien:** KI-Nachbarn sind nur angedeutet. Wie müssten KI-Mitspieler handeln, damit sie nicht zu leicht oder zu schwer zu durchschauen sind?
9. **Spielerzahl 9 als Obergrenze** wegen „jede Fähigkeit einmal“. Braucht es eine zehnte Fähigkeit oder erlaubte Dopplungen?
10. **Zugänglichkeit:** Kann ein 6-jähriges Kind die Murmel-Regel und das Zeigen ohne Hilfe nachvollziehen?

---

## 14. Beispielablauf (5 Spieler, Stufe „Erste Partie“)

- Zauberhut: Papa = Detektiv Schnüffel (Schlüsselloch), Mama = Ritter Rostfrei (Laterne), Mia = Oma Herzlich (Trostpflaster), Ben = Troll Grummel (Dickkopf), Oma = König Friedrich (Dorfglocke).
- Geheim: Ben ist Kobold.
- Nacht 1: Kobold Ben wählt Mama. Laterne Mama schützt Papa. Trostpflaster Mia sieht „Mama soll verhext werden“ und rettet nicht. Schlüsselloch Papa prüft Oma: kein Kobold.
- Auflösung: Mama wird Frosch. Türgriffe 5 → 4. Murmeln: Kandidaten Ben (Gewicht 2), Papa, Mama, Mia (je 1) → gezogen Ben → „Erst knurren, dann helfen.“
- Morgen: „Mama ist ein Frosch!“ und der Spruch. Die Familie erkennt Troll Grummel. Troll Grummel ist Dickkopf, also ☀️ Taghelfer, also Kobold.
- Tag: Alle zeigen auf Ben. Entlarvung: Kobold. Dorf gewinnt mit 4 Türgriffen.
- Chronik zeigt alle Nachtaktionen.
