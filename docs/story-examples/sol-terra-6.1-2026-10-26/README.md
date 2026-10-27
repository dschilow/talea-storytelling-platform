# Talea-Folge: Sol 6.1 gegen Terra 6.1

26. Oktober 2026. Neun neu generierte Folgen, drei identische Aufgaben je Modellvariante.

**Sol Low erzielt hier die höchste Durchschnittsnote.** Terra Mittel verbessert sich gegenüber Terra Low, bleibt im Mittel hinter Sol. Beide Terra-Einstellungen antworten deutlich schneller. Die Empfehlung für die aktuellen Prompts und konkrete Textbelege stehen in der [redaktionellen Einordnung](einordnung.md).

| Variante | Mittel /10 | Sol-Lektorat | Terra-Lektorat | Überarbeitungen | Harte Restfehler | Generierungszeit gesamt |
|---|---:|---:|---:|---:|---:|---:|
| Sol 6.1 Low | 7,87 | 8,00 | 7,73 | 0 | 0 | 520 s |
| Terra 6.1 Low | 6,32 | 6,03 | 6,60 | 0 | 0 | 145 s |
| Terra 6.1 Mittel | 7,03 | 6,87 | 7,20 | 0 | 0 | 158 s |

## Methode

Der produktive Textkern **talea-folge-v1**, One-Shot, unveränderte aktuelle Autorenprompts und Figurenpool. Sol Low ist die bisherige Standardkonfiguration; Terra läuft auf Low und Mittel. Pro Aufgabe exakt derselbe erste System- und Nutzerprompt, Eingabehash, Seed und Pipelinehash (automatisch geprüft). Unterschiedlich sind ausschließlich Autorenmodell und Denkstufe. Seeds legen die Vorgaben fest, garantieren keine deterministische Modellausgabe. Drei Kapitel; Abenteuer und Märchen 600–800 Wörter je Kapitel, Einschlafen 170–260. Der normale Textweg darf bei harten Formfehlern einmal überarbeiten; Bewertungen gelten dieser finalen Pipelineausgabe. Alle neun Texte sind frisch, keine Übernahme früherer Gewinner und keine manuellen Textkorrekturen.

Inferenz ausschließlich über das angemeldete **Codex-Kontingent**; keine API-Schlüssel, keine Bilder und keine Datenbankzugriffe. Kontingentverbrauch ist kein kostenloser Modellbetrieb. Der Transport protokolliert die explizite CLI-Modellwahl und Denkstufe; Ereignislogs belegen erfolgreiche Antworten und gemeldete Tokens. Ein unabhängiger serverseitiger Modellattest liegt nicht vor. Der Texttransport erzwingt das Produktions-Ausgabelimit und natives Provider-JSON nicht. Zeiten enthalten normale Pipeline-Überarbeitung und laufen bei bis zu drei gleichzeitigen Modelltests, daher nur grobe Praxiswerte.

Zwei Modelllektoren, Sol 6.1 und Terra 6.1, jeweils **Mittel**, lesen je Aufgabe die drei anonymisierten Manuskripte in einem frischen Kontext. Modellnamen, Denkstufen, Laufzeiten und Pläne sind darin entfernt. Rotierende, zwischen Lektoren gespiegelte Reihenfolge reduziert Positionsverzerrung. Die feste vorhandene Rubrik: Kausalität/Wunderregel und Hauptfigurenhandlung je 20 %; Ensemble, Stimmen/Dialog, Humor/Wunder, Tempo, Vorlesbarkeit und Gefühl/Auflösung je 10 %. Gewichte werden im Skript berechnet; alle Belegzitate gegen die jeweilige Textfassung geprüft. Unterschiedliche Genreanforderungen stehen im Leserauftrag. Mittelwerte gewichten Aufgaben und Lektoren gleich.

**Grenzen:** Ein Lauf pro Aufgabe und Variante, drei Aufgaben, keine Wiederholungen, keine Kinder oder menschlichen Blindleser. Beide Lektoren gehören derselben Modellfamilie an und beurteilen auch Texte des eigenen Modells. Anonymisierung beseitigt mögliche Stilpräferenz nicht. Kleine Punktabstände sind kein belastbarer allgemeiner Modellvorsprung.

## Alle Geschichten

| Aufgabe | Variante / Geschichte | Wörter | Sol-Lektorat | Terra-Lektorat | Mittel /10 | Überarbeitet |
|---|---|---:|---:|---:|---:|---|
| Magisches Abenteuer | Sol 6.1 Low: [Der Wald spielt verrückt](magic-sol-low.md) | 1976 | 7,50 | 7,40 | 7,45 | nein |
| Magisches Abenteuer | Terra 6.1 Low: [Die wilde Warteschlange](magic-terra-low.md) | 2545 | 6,70 | 7,10 | 6,90 | nein |
| Magisches Abenteuer | Terra 6.1 Mittel: [Der Hüpfstein-Wettlauf](magic-terra-medium.md) | 2796 | 6,40 | 6,70 | 6,55 | nein |
| Lustiges Märchen | Sol 6.1 Low: [Der Knoten unter dem Frühstück](fairytale-sol-low.md) | 2084 | 8,60 | 7,80 | 8,20 | nein |
| Lustiges Märchen | Terra 6.1 Low: [Die Schnecke sammelt Sieger](fairytale-terra-low.md) | 2592 | 5,50 | 6,00 | 5,75 | nein |
| Lustiges Märchen | Terra 6.1 Mittel: [Die verknotete Nebelhexe](fairytale-terra-medium.md) | 2490 | 7,70 | 7,90 | 7,80 | nein |
| Einschlafgeschichte | Sol 6.1 Low: [Der Teppich unter dem Tisch](bedtime-sol-low.md) | 696 | 7,90 | 8,00 | 7,95 | nein |
| Einschlafgeschichte | Terra 6.1 Low: [Der Weg im Wölkchen](bedtime-terra-low.md) | 713 | 5,90 | 6,70 | 6,30 | nein |
| Einschlafgeschichte | Terra 6.1 Mittel: [Das Rutschblatt](bedtime-terra-medium.md) | 816 | 6,50 | 7,00 | 6,75 | nein |

## Längentreue

| Variante | Kapitel außerhalb des verlangten Wortbudgets | Generierte Ausgabetokens (CLI) |
|---|---:|---:|
| Sol 6.1 Low | 0/9 | 10153 |
| Terra 6.1 Low | 4/9 | 10512 |
| Terra 6.1 Mittel | 7/9 | 11646 |

Die Pipeline prüft Längen tolerant: zu lange Texte werden erst ab 135 % des Gesamtbudgets weich markiert; einzelne Kapitelobergrenzen sind kein hartes Gate. Daher ist „keine harten Restfehler“ keine Bestätigung genauer Längentreue. CLI-Tokens enthalten den Codex-Aufrufrahmen und können versteckte Denkarbeit enthalten; sie sind keine API-Rechnung und keine direkte Prozentangabe des verfügbaren Kontingents.

Zwei kleine Zitierfehler (Großschreibung und ausgelassene Sprecherzuordnung) wurden anhand des Manuskripts berichtigt. Originale und genaue Korrekturen stehen in [zitatkorrekturen.json](zitatkorrekturen.json); Rohlektüren und sämtliche Noten bleiben unverändert.

## Einzelbewertungen

## Magisches Abenteuer · Sol 6.1 Low

[Der Wald spielt verrückt](magic-sol-low.md) · Kapitelwörter: 619 / 642 / 715 · 193 s · 1 Autorenaufruf(e).

**gpt-6.1-sol: 7,50/10.** Gewichtet 7,5/10: Komisch, emotional tragfähig und mit einer starken Hauptfigurenentscheidung; Regelabweichungen schwächen die Auflösung.

- **major:** „Kicher musste danach noch zweimal werfen.“ – Kicher hat bereits zweimal geworfen. Zwei weitere Würfe widersprechen drei Zapfen pro Person und neun Gesamtwürfen. Vorschlag: Wurffolge und Punktestand so überarbeiten, dass Kichers entscheidende Wahl innerhalb seiner drei Würfe liegt.
- **major:** „Sofort sprang der Hut zurück auf seinen Kopf.“ – Die Magie erzwingt plötzlich Kopfbedeckung; später hüpfen Schuhe auch ohne unmittelbar folgenden Wurf. Beides erweitert die Regeln unangekündigt. Vorschlag: Die Folgen aus den ausgesprochenen Zusatzregeln entwickeln oder die betreffenden Bedingungen vorher verständlich festlegen.

Starker Moment: „Dann schob Kicher den Zapfen zu Ben.“ – Kicher verzichtet handelnd auf eine rettende Zusatzregel und vertraut den Kindern den entscheidenden Versuch an.

Nicht belegte Zitate: 0; Zitate über 25 Wörter: 0.

**gpt-6.1-terra: 7,40/10.** Ein lebhaftes, gefühlvolles Spielabenteuer mit starkem Kobold; die entscheidende Wurfregel braucht mehr Klarheit.

- **major:** „Ben warf. Seine Schuhe machten ihren kleinen Satz. Der Zapfen landete auf dem Hut und rollte los.“ – Ben wirft für Kicher, während der Eimer versetzt wurde; der Ausgang wirkt regeltechnisch beliebig. Vorschlag: Vorher vereinbaren, wie Stellvertreterwürfe und der neue Eimerstand für alle zählen.
- **minor:** „Sofort sprang der Hut zurück auf seinen Kopf.“ – Dass sich das Spiel nicht einpacken lässt, geht über die erklärte Wunderregel hinaus. Vorschlag: Diese Wirkung früh ankündigen oder den Packversuch ohne zusätzliche Magie scheitern lassen.

Starker Moment: „„Ich mag das sogar. Aber wenn ich verliere, spielt ihr vielleicht nicht noch mal.““ – Hinter Kichers Schummeln wird sein Wunsch nach Gesellschaft unmittelbar verständlich.

Nicht belegte Zitate: 0; Zitate über 25 Wörter: 0.

Deterministische Resthinweise: {"hard":[],"soft":[]}.

## Magisches Abenteuer · Terra 6.1 Low

[Die wilde Warteschlange](magic-terra-low.md) · Kapitelwörter: 747 / 879 / 919 · 64 s · 1 Autorenaufruf(e).

**gpt-6.1-sol: 6,70/10.** Gewichtet 6,7/10: Einprägsame Wunderidee und wirksame Figurenwünsche; unklare Buchführung und ein gedehnter Mittelteil kosten Spannung.

- **major:** „Gibst du deinen Zug ab, verschwindet sie.“ – Zunächst verschwindet nur Noras Zuwachs. Später beseitigt einmaliges Abgeben mehrere Zuwächse; Ben besitzt zudem keinen erklärten Schwanzanteil. Vorschlag: Festlegen und durchgehend zeigen, ob Zugabgabe alle eigenen Zuwächse oder jeweils nur einen entfernt.
- **major:** „Nora legte ihn zu ihren übrigen Zapfen.“ – Kichers Zapfentreffer wird ohne Regelgrund Nora zugerechnet. Die folgende Punktebilanz übergeht außerdem den angekündigten Gewinn aller Zapfen. Vorschlag: Treffer, Gewinner und Zapfenübertragung eindeutig verbinden und den daraus folgenden Spielstand konsequent fortführen.

Starker Moment: „„Und ich wach“, sagte Muck.“ – Mucks knapper Einwurf macht die Kosten von Kichers Starrsinn persönlich und komisch zugleich.

Nicht belegte Zitate: 0; Zitate über 25 Wörter: 0.

**gpt-6.1-terra: 7,10/10.** Eine einfallsreiche Warteschlange und eine überzeugende Entscheidung tragen die Geschichte; zwei Wertungen brauchen klarere Regeln.

- **major:** „„Ben“, sagte Kicher schließlich, „du darfst meinen Zug haben.““ – Kicher hat mehrfach den Auslösesatz gesagt; unklar bleibt, warum eine Zugabgabe seine ganze Schlangenlänge beseitigt. Vorschlag: Festlegen, ob eine Abgabe alle eigenen Ansagen oder jeweils nur eine ausgleicht.
- **major:** „„Wer einen Türgriff in die Kanne wirft, bekommt alle Zapfen.““ – Nora erhält alle Zapfen, obwohl Kicher den Türgriff und einen Zapfen wirft; die Wertung wirkt willkürlich. Vorschlag: Die Zusatzregel so formulieren, dass Noras Gewinn aus dem missglückten Wurf folgt.

Starker Moment: „„Wenn ich meinen Zug abgebe, bekomme ich vielleicht keinen mehr“, sagte Kicher.“ – Kichers Wahl kostet ihn gefühlt etwas und verbindet Spielregel mit seiner Angst.

Nicht belegte Zitate: 0; Zitate über 25 Wörter: 0.

Deterministische Resthinweise: {"hard":[],"soft":[]}.

## Magisches Abenteuer · Terra 6.1 Mittel

[Der Hüpfstein-Wettlauf](magic-terra-medium.md) · Kapitelwörter: 890 / 1030 / 876 · 66 s · 1 Autorenaufruf(e).

**gpt-6.1-sol: 6,40/10.** Gewichtet 6,4/10: Lebendige Situationskomik und ein guter Preis-Moment; unstete Mechanik und ausgedehnte Nachspiele schwächen den Bogen.

- **major:** „Bitte leise weiterspielen.“ – Der Schluss behandelt einen Wortbestandteil als Hüpfwort. Frühere Formen wie „weiterspielt“ lösen keinen Sprung aus. Vorschlag: Muck ausdrücklich „Weiter“ sagen lassen oder die Auslösung durch Wortbestandteile früh festlegen und konsequent anwenden.
- **major:** „Am anderen Ende hing der Korb der Waldhüterin.“ – Die Verbindung des Korbs mit dem Faden wurde nicht hergestellt. Damit entsteht die zentrale Verwicklung durch nachträgliche Behauptung. Vorschlag: Vor Kichers Sprung zeigen, wie der Faden durch den Korbhenkel gerät und beim Hüpfen gespannt wird.

Starker Moment: „Kicher zog ihn heraus und hielt ihn Ben hin.“ – Der zuvor stolz vorgeführte Lieblingsgriff wird zum freiwilligen Preis; Kichers Veränderung bekommt einen konkreten Wert.

Nicht belegte Zitate: 0; Zitate über 25 Wörter: 0.

**gpt-6.1-terra: 6,70/10.** Ein freundliches Spielabenteuer mit schöner Entwicklung für Kicher und Ben, aber unklarer Schlussmagie und Längen.

- **major:** „Plopp.

Muck saß mitsamt Türgriff auf dem ersten Stein.“ – Muck sagt das Hüpfwort nicht; sein Sprung widerspricht der zuvor erklärten Regel. Vorschlag: Muck das Wort sagen lassen oder eine entsprechende Wirkung vorher einführen.
- **major:** „Direkt hinter ihm lag Kichers offener Beutel.“ – Kichers zuvor mitgetragener Beutel liegt plötzlich voraus; der anschließende Zwischenfall wirkt unvorbereitet. Vorschlag: Zeigen, wann und wie der Beutel zum vierten Stein gelangt.

Starker Moment: „Kicher ließ einen Zapfen nach dem anderen auf den Stein fallen. Sechs Stück. Dann schob er sie zu Ben.“ – Die kleine Handlung macht Kichers Entscheidung gegen seinen Siegeszwang sichtbar.

Nicht belegte Zitate: 0; Zitate über 25 Wörter: 0.

Deterministische Resthinweise: {"hard":[],"soft":["Chapter 1: unclear „Er“ — „Ben stand neben Nora am zweiten Stein. Er hielt den Holzfrosch am Kopf.“. Repeat the name."]}.

## Lustiges Märchen · Sol 6.1 Low

[Der Knoten unter dem Frühstück](fairytale-sol-low.md) · Kapitelwörter: 666 / 687 / 731 · 215 s · 1 Autorenaufruf(e).

**gpt-6.1-sol: 8,60/10.** Gewichtet 8,6/10: Ein starkes, geschlossenes Märchen mit einprägsamer Wunderregel, eigenwilliger Hexe und verdientem, überraschend komischem Ende.

- **minor:** „Mit Abstand zwischen den Zähnen.“ – Bens Siegerspruch hat keinen klaren Bezug zum Ergebnis. Die unverständliche Pointe unterbricht den emotionalen Abschluss. Vorschlag: Einen kurzen, konkret auf Kamm, Steine oder Loch bezogenen Kommentar einsetzen.
- **minor:** „gegen den Hutrand ihres Umhangkragens“ – Hutrand und Umhangkragen ergeben kein klar vorstellbares Kleidungsstück; die Körperkomik wird beim Vorlesen undeutlich. Vorschlag: Ein eindeutig benanntes Kleidungsdetail verwenden und die Bewegung daran ausrichten.

Starker Moment: „Einen Augenblick blieb ihre Faust geschlossen. Dann legte sie Ben den ersten Stein hinein.“ – Die Hexe überwindet ihren Gewinnzwang durch eine konkrete Handlung, die zugleich sichtbar den Zauber verändert.

Nicht belegte Zitate: 0; Zitate über 25 Wörter: 0.

**gpt-6.1-terra: 7,80/10.** Starkes, komisches Märchen mit klarer Wunderregel und einer überzeugend ausgespielten Entscheidung.

- **minor:** „Beim Versuch, würdevoll auszusehen, stieß sie sich selbst mit dem Knie gegen den Hutrand ihres Umhangkragens.“ – Das schwer vorstellbare Kleidungsdetail unterbricht eine ansonsten gut sichtbare komische Bewegung. Vorschlag: Den Kragen oder einen eindeutig eingeführten Hut als Trefferziel wählen.
- **minor:** „Mit Abstand zwischen den Zähnen.“ – Der Wortwitz nach der wichtigen Gewinnanerkennung bleibt ohne sichtbare Zahnlücke etwas unvermittelt. Vorschlag: Eine Zahnlücke vorbereiten oder Ben auf einen bereits sichtbaren Kammwitz zurückkommen lassen.

Starker Moment: „Einen Augenblick blieb ihre Faust geschlossen. Dann legte sie Ben den ersten Stein hinein.“ – Eine kleine Handlung zeigt den inneren Widerstand der Hexe und ihre entscheidende Wahl.

Nicht belegte Zitate: 0; Zitate über 25 Wörter: 0.

Deterministische Resthinweise: {"hard":[],"soft":[]}.

## Lustiges Märchen · Terra 6.1 Low

[Die Schnecke sammelt Sieger](fairytale-terra-low.md) · Kapitelwörter: 765 / 908 / 919 · 58 s · 1 Autorenaufruf(e).

**gpt-6.1-sol: 5,50/10.** Gewichtet 5,5/10: Einfallsreiche Einzelkomik und gute Kinderbeiträge, aber eine unsichere Wunderregel und ausgedehnte Umwege schwächen das Märchen.

- **major:** „Noch nicht auf meinem Platz“ – Schleimunds eigener Rätselplatz wird spät zum zusätzlichen Transportziel. Frühere Rückfahrten und die neue Zielbedingung ergeben keine verlässliche Wunderregel. Vorschlag: Ein einziges Burgziel festlegen und Rückfahrten konsequent an den jeweiligen Ausgangsplatz binden.
- **major:** „Ich gebe auf“ – Die Hexe löst den letzten Transport selbst aus, obwohl sie im Burghof bleiben will. Wiederholungsfahrten ersetzen ihre zielgerichtete Zuspitzung. Vorschlag: Die Hexe aus ihrem Gewinnzwang einen folgenreichen Fehler begehen lassen; eine frühere Burgfahrt dafür streichen.

Starker Moment: „Nora wartete. Ben wartete ebenfalls. Schleimund schob den Salatnapf ein Stück zur Seite, damit die Bank mehr Platz hatte.“ – Geduld und eine kleine fürsorgliche Bewegung geben der beschämten Hexe Raum für ihr Eingeständnis.

Nicht belegte Zitate: 0; Zitate über 25 Wörter: 0.

**gpt-6.1-terra: 6,00/10.** Einfallsreiches Märchen mit lebendigem Ensemble, dessen lange Umwege und späte Regelergänzung die Wirkung schwächen.

- **major:** „Noch nicht auf meinem Platz“ – Der neue Zielort verändert spät die zuvor verständliche Fahrregel und überrascht ohne Vorbereitung. Vorschlag: Schleimunds eigenen Platz früh erwähnen und die Fahrt dorthin eindeutig in die Regel aufnehmen.
- **major:** „Die Bank fuhr zurück. Doch die Hexe sprang vorher ab und blieb am Brunnen stehen.“ – Wiederholte Fahrten und das anschließende Torproblem schieben den Konflikt der Hexe in den Hintergrund. Vorschlag: Eine Fahrt und die Torrettung kürzen; die Hexe früher vor ihre Verlustangst stellen.

Starker Moment: „Ich habe verloren. Und jetzt?“ – Die knappe Frage macht die gefürchtete Niederlage zum offenen Anfang weiterer Begegnungen.

Nicht belegte Zitate: 0; Zitate über 25 Wörter: 0.

Deterministische Resthinweise: {"hard":[],"soft":[]}.

## Lustiges Märchen · Terra 6.1 Mittel

[Die verknotete Nebelhexe](fairytale-terra-medium.md) · Kapitelwörter: 742 / 928 / 820 · 63 s · 1 Autorenaufruf(e).

**gpt-6.1-sol: 7,70/10.** Gewichtet 7,7/10: Ein gutes, komisches Märchen mit klarer Zauberfolge und handelnder Hauptfigur; die Mitte könnte deutlich knapper sein.

- **major:** „Bis du deine Niederlage zugibst, bleibt er.“ – Die Lösung steht früh fest. Weitere Rätsel und Transportversuche entwickeln die innere Entscheidung weniger als die äußere Unordnung. Vorschlag: Einen Umweg streichen und früher zeigen, weshalb das Eingeständnis für die Hexe den ersehnten Spielpartner gefährdet.
- **minor:** „Die Kelle gehört der Schlossküche. Ich habe sie mir für meinen Rätselwettstreit geliehen.“ – Die Hexe verspricht fremdes Eigentum als Gewinn. Bens anschließendes Zurückgeben wirkt dadurch eher notwendig als überraschend großzügig. Vorschlag: Ein eigenes Pfand der Hexe einsetzen oder einen ausdrücklich erlaubten, zeitlich begrenzten Gewinn vereinbaren.

Starker Moment: „Ihre Finger hielten den Umhang so fest, dass die bunten Flicken Falten bekamen.“ – Die Handbewegung macht den Preis des folgenden Eingeständnisses sichtbar, ohne ihn auszuerklären.

Nicht belegte Zitate: 0; Zitate über 25 Wörter: 0.

**gpt-6.1-terra: 7,90/10.** Lebendiges Märchen mit sichtbarer Eskalation, eigenwilliger Hexe und warmem, gut vorbereitetem Schluss.

- **minor:** „Wer bis zwölf mein schwerstes Rätsel löst, gewinnt die Kelle“ – Das erste gestellte Rätsel gilt zunächst als schwerstes; später bezeichnet die Hexe ein anderes so. Vorschlag: Das erste Rätsel als Auftakt kennzeichnen und den Anspruch auf die Kelle entsprechend klären.
- **minor:** „Ein Loch.“ – Ben löst auch das schwerste Rätsel sofort; die besondere Schwierigkeit ist kaum spürbar. Vorschlag: Vor der Antwort einen kurzen eigenen Denkversuch oder einen sichtbaren Hinweis einbauen.

Starker Moment: „„Ben hat mein schwerstes Rätsel gelöst“, sagte sie. „Und ich habe verloren.““ – Die öffentliche Anerkennung verbindet die innere Entscheidung der Hexe unmittelbar mit der Auflösung.

Nicht belegte Zitate: 0; Zitate über 25 Wörter: 0.

Deterministische Resthinweise: {"hard":[],"soft":[]}.

## Einschlafgeschichte · Sol 6.1 Low

[Der Teppich unter dem Tisch](bedtime-sol-low.md) · Kapitelwörter: 213 / 242 / 241 · 112 s · 1 Autorenaufruf(e).

**gpt-6.1-sol: 7,90/10.** Gut bis stark; gewichteter Wert 7,9. Das einfache Wunder verbindet Figurenkonflikt, Situationskomik und einen ruhigen Abschluss.

- **minor:** „Zum Schluss wickelte er eine um das Lesezeichen.“ – Die zusätzliche Schlafmützenposse unterbricht Bens endlich begonnene Erklärung und verzögert den Ruheplatz. Vorschlag: Die Posse kürzen oder vor Noras Aufforderung zum Weitererzählen platzieren.
- **minor:** „Der Hut wartet draußen.“ – Der Hausschuh steht bereits neben dem Buch; das abschließende Draußen lässt seinen Bezug offen. Vorschlag: Den Schlussgag an die sichtbare Position des wartenden Hausschuhs binden.

Starker Moment: „Nora wollte schon aufstehen. Dann legte sie beide Hände auf ihre Knie.“ – Eine kleine, gut sichtbare Handlung macht Noras Entscheidung zum Zuhören fühlbar, bevor sie sie ausspricht.

Nicht belegte Zitate: 0; Zitate über 25 Wörter: 0.

**gpt-6.1-terra: 8,00/10.** Stark: Das überschaubare Wunder verbindet die Platzsuche mit Bens Mitentscheidung und einem geborgenen Schluss.

- **minor:** „Ben legte den Hausschuh daneben.“ – Der Hausschuh befand sich zuletzt an Bos Pfote; sein Weg zur Buche bleibt unklar. Vorschlag: Zeigen, wie Bo ihn auszieht und mitnimmt.

Starker Moment: „Ben betrachtete die vier Holzbeine. „Der möchte auch vorgelesen bekommen.““ – Bens trockene Stimme macht aus der misslungenen Platzsuche einen freundlichen Gag.

Nicht belegte Zitate: 0; Zitate über 25 Wörter: 0.

Deterministische Resthinweise: {"hard":[],"soft":[]}.

## Einschlafgeschichte · Terra 6.1 Low

[Der Weg im Wölkchen](bedtime-terra-low.md) · Kapitelwörter: 217 / 250 / 246 · 23 s · 1 Autorenaufruf(e).

**gpt-6.1-sol: 5,90/10.** Brauchbar mit deutlichen Schwächen; gewichteter Wert 5,9. Sanfte Atmosphäre und Käferbilder bleiben stärker als Wunderlogik und Figurenentscheidung.

- **major:** „Da schwebte das Wölkchen mitten in den Farn.“ – Die Wolke führt ungefragt zum richtigen Bereich. Dadurch verliert Bens Wegkenntnis entscheidende Wirkung. Vorschlag: Ben den Weg weisen lassen und die Wolke erst infolge einer vorbereiteten Regel mitziehen lassen.
- **major:** „Im Wölkchen fuhren die Käfer noch immer in ihrer Nussschale.“ – Das angekündigte Zuviel an Bildern wird weder klar erklärt noch durch Noras Entscheidung sichtbar aufgelöst. Vorschlag: Früh festlegen, wie Bilder sich sammeln und wieder verschwinden; Noras Zuhören die Entlastung auslösen lassen.

Starker Moment: „Ben breitete die Decke aus. Nora legte ihre gesammelten Blätter an den Rand.“ – Beide tragen mit vorbereiteten Gegenständen zum gemeinsamen Ruheplatz bei; die Geborgenheit entsteht durch Handlungen.

Nicht belegte Zitate: 0; Zitate über 25 Wörter: 0.

**gpt-6.1-terra: 6,70/10.** Sanft und gut vorlesbar; die Folge der Wölkchenbilder und ihre Beruhigung bleiben unscharf.

- **major:** „Das Wölkchen schwebte ihnen nach, ohne ein neues Bild zu zeigen.“ – Die Bilderfülle beruhigt sich ohne erkennbare Handlung oder erklärte Wirkung. Vorschlag: Zeigen, wie das Ende der Wegvorschläge das Wölkchen beruhigt.
- **minor:** „Dann nehmen wir den Weg um den Baum?“ – Die vielen ähnlichen Vorschläge bremsen den Weg zur gemütlichen Mulde. Vorschlag: Einen Vorschlag streichen und die verbleibenden Versuche stärker unterscheiden.

Starker Moment: „Nora hielt den Mund geschlossen. Ben schob die Blätter auseinander und ging vor.“ – Zuhören und Mitentscheiden werden durch einfache Handlungen sichtbar.

Nicht belegte Zitate: 0; Zitate über 25 Wörter: 0.

Deterministische Resthinweise: {"hard":[],"soft":[]}.

## Einschlafgeschichte · Terra 6.1 Mittel

[Das Rutschblatt](bedtime-terra-medium.md) · Kapitelwörter: 234 / 274 / 308 · 29 s · 1 Autorenaufruf(e).

**gpt-6.1-sol: 6,50/10.** Brauchbar mit deutlichen Schwächen; gewichteter Wert 6,5. Ein warmer Auswahlkonflikt trägt mehr als die wiederholten Schuhkapriolen.

- **major:** „Bei ‚Rutsch‘ hüpft alles auf der Bank nach rechts“ – Die Regel umfasst sprachlich auch sitzende Kinder, tatsächlich hüpfen vor allem ausgewählte Gegenstände. Vorschlag: Die Regel auf lose Gegenstände begrenzen und deren Bewegungen durchgehend nachvollziehbar halten.
- **major:** „Diesmal passe ich auf. Kein Rutsch!“ – Nach mehreren gleichen Versehen wirkt Noras erneuter Auslöser konstruiert; die Geschichte tritt auf der Stelle. Vorschlag: Einen Wiederholungsversuch streichen und früher zu Bens eigener Idee oder Noras bewusster Entscheidung wechseln.

Starker Moment: „„Heute suchst du“, sagte Nora.“ – Nora gibt ihren Vorrang auf und setzt das Wunder anschließend konkret für Bens Wunsch ein.

Nicht belegte Zitate: 0; Zitate über 25 Wörter: 0.

**gpt-6.1-terra: 7,00/10.** Gut und verspielt, mit einer klaren Versöhnung; die Reichweite der Regel braucht Präzision.

- **major:** „Bei ‚Rutsch‘ hüpft alles auf der Bank nach rechts“ – Später hüpfen Bücher und Schuhe, während sitzende Figuren offenbar bleiben; das verwischt die Regel. Vorschlag: Die Regel auf bewegliche Gegenstände begrenzen und die Beispiele daran ausrichten.
- **minor:** „Nun nur nicht rutsch …“ – Weitere versehentliche Auslöser verlängern denselben Gag und verzögern die ruhige Vorleseszene. Vorschlag: Einen Fehlversuch streichen und früher zu Bens Wunsch übergehen.

Starker Moment: „Das Hasenbuch hüpfte direkt in Bens Hände.“ – Noras versöhnliche Wahl und die Wunderregel treffen in einer konkreten Bewegung zusammen.

Nicht belegte Zitate: 0; Zitate über 25 Wörter: 0.

Deterministische Resthinweise: {"hard":[],"soft":[]}.

## Reproduktion

Für jede Variante: `bun scripts/episode/model-comparison.ts --stage generate --variant sol-low` (bzw. `terra-low`, `terra-medium`). Danach `--stage check`, `--stage review --judge gpt-6.1-sol` und `--stage review --judge gpt-6.1-terra`, zuletzt `--stage report`. Vollständige gespeicherte Ergebnisse werden fortgesetzt; rohe Antworten, Prompt- und Quellkopien, Modellereignisse, Zuordnung und Einzelnoten liegen in `Logs/episode-model-comparison/2026-10-26`.
