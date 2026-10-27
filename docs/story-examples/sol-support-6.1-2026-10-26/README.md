# Talea-Folge: Sol als Autor, drei Besetzungen der Nebenrollen

26. Oktober 2026. Neun neue Textläufe: **8 Geschichten und 1 Abbruch. Höchste Blindnote über die 2 gemeinsam gelieferten Aufgaben: gpt-6.1-sol, 7,78/10.** Der Schreiber war in allen Stufen Sol 6.1 Low.

| Planer und interne Prüfer | Schreiber / Überarbeitung | Qualität gemeinsame Fälle /10 | Geliefert | Ø Sekunden/Versuch | Ø API-Äquivalent/Versuch, ohne Cache | Ø Aufrufe/Versuch |
|---|---|---:|---:|---:|---:|---:|
| gpt-6.1-sol Low | Sol 6.1 Low | 7,78 | 3/3 | 292 | $0,2346 | 3,0 |
| gpt-6.1-terra Low | Sol 6.1 Low | 7,45 | 3/3 | 207 | $0,2145 | 4,0 |
| gpt-6-luna Low | Sol 6.1 Low | 7,33 | 2/3 | 238 | $0,1445 | 4,3 |

Die praktische Empfehlung und konkrete Textbelege stehen in der [zusätzlichen redaktionellen Einordnung](einordnung.md).

## Bezug zum vorherigen One-Shot

Sol Low allein erreichte im vorigen Versuch 7,87/10, durchschnittlich 173 Sekunden und $0,0956 API-Äquivalent ohne Cache pro Folge bei einem Aufruf. Das sind dieselben drei Leseraufträge, aber andere Texte und ein anderer Blindvergleich; der Wert ist eine Orientierung, kein isolierter Nachweis des Nutzens einer zusätzlichen Pipeline-Stufe. Die drei neuen Rollenpakete untereinander wurden gemeinsam bewertet.

## Wer machte im vorherigen Versuch was?

Die frühere Untersuchung nutzte One-Shot: Das ausgewählte Schreibermodell plante still und schrieb selbst; ein Aufruf pro Geschichte. Es gab keinen separaten Modellplaner und keinen internen Modellprüfer. Die Formprüfung war deterministischer Programmcode. Luna war in unbenutzten Konfigurationsfeldern genannt, wurde aber nicht aufgerufen. Erst die getrennte Schlussbewertung nutzte Sol 6.1 und Terra 6.1 auf Mittel. Die neun damaligen Stufenprotokolle zeigen ausschließlich den jeweiligen Autor.

## Neuer Versuchsaufbau

1. Separater Plan, Figurenbibel und Kapitelstruktur: ausgewähltes Unterstützermodell auf Low, vorhandener Zwei-Schritt-Modus von talea-folge-v1. Eine strukturbezogene Planreparatur ist wie im Original erlaubt.
2. Manuskript: Sol 6.1 Low, unveränderte produktive Autorenprompts. Der Schreiber sieht natürlich den je Variante unterschiedlichen Plan.
3. Interne Textprüfung: ausgewähltes Unterstützermodell auf Low, identischer Prüfauftrag. Höchstens drei konkrete Probleme. Nicht wörtlich belegte Zitate werden gekennzeichnet und nicht zur Überarbeitung verwendet.
4. Nur bei belegten größeren Fehlern: Sol 6.1 Low überarbeitet einmal vollständig. Eine Fassung mit mehr harten Formfehlern wird verworfen. Akzeptierte neue Fassungen werden vom selben Unterstützermodell noch einmal geprüft. Keine Endlosschleife.
5. Separate Schlussbewertung: Sol und Terra auf Mittel, frische Kontexte, anonymisierte A/B/C-Texte und rotierende Reihenfolge. Die internen Urteile verändern diese Noten nicht.

Die interne Lektoratsstufe ist eine **Versuchserweiterung**: Auch der vorhandene Zwei-Schritt-Kern hat von sich aus keinen Modellkritiker. Es wurde keine Produktionskonfiguration umgestellt. Es sind drei Rollenpakete (Planer und Prüfer wechseln zusammen), keine vollständige Kreuzung aller Planer-/Prüferkombinationen. Alle Textüberarbeitungen schreibt weiterhin Sol. Keine Bilder, Bildregie, Audio oder Persistenz; „alles andere“ bezieht sich hier auf die tatsächlich ausgeführten Textrollen.

Gleiche drei Leseraufträge, Familien, Figurenpool, Seeds, Kapitelbudgets und erste Planerprompts wie untereinander und dieselben Testfälle wie im vorherigen Versuch: Abenteuer, Märchen, Einschlafen. Die neue Architektur unterscheidet sich vom alten One-Shot; die Rollenpakete untereinander sind der kontrollierte Vergleich. Alle Ausgaben sind frisch. Die Rollenzuordnung jedes tatsächlichen Modellaufrufs und die Eingabe-/Quellhashes werden geprüft. Der vollständige Testcode ist mit den Läufen archiviert.

Bewertungsrubrik: Kausalität/Wunderregel und Hauptfigurenhandlung je 20 %, Ensemble, Stimmen, Humor/Wunder, Tempo, Vorlesbarkeit und Gefühl/Auflösung je 10 %. Die gemeinsame Qualitätsnote vergleicht ausschließlich magic und fairytale: Diese 2 Aufgaben wurden von allen drei Paketen geliefert. Beide Lektoren und diese Aufgaben zählen gleich. Die Einschlafgeschichten von Sol und Terra werden zusätzlich separat bewertet. Der fehlgeschlagene Luna-Fall erhält keine literarische Nullnote, sondern zählt bei Lieferquote, Zeit und Kosten. Pro Aufgabe nur ein Lauf: ein beschreibender Pilot, keine statistische Absicherung. Beide Lektoren gehören zur selben Modellfamilie.

## Kosten richtig lesen

**Zusätzliche API-Rechnung dieses Versuchs: $0.** Alle Aufrufe laufen über das angemeldete Codex-Kontingent. Das Abonnement beziehungsweise dessen Verbrauch ist damit nicht kostenlos; ein genauer Geldbetrag oder Prozentsatz pro Lauf wird von diesem Transport nicht geliefert.

Die Tabellen zeigen ein **rechnerisches API-Äquivalent der gemeldeten CLI-Tokens**, Standardtarif, USD, ohne Cacheabschläge. Formel je Aufruf: (Inputtokens × Inputpreis + Ausgabetokens × Ausgabepreis) / 1.000.000. Die CLI-Eingabe enthält Codex-Rahmeninstruktionen; Ausgabe kann Denktokens enthalten. Das ist keine gemessene Rechnung der nativen Talea-API und keine verlässliche Produktionskostenschätzung. Zusätzlich ist in ergebnisse.json ein Äquivalent mit den gemeldeten Cache-Treffern gespeichert. Cache-Schreibkosten, regionale Aufschläge und Flex-Rabatte sind nicht eingerechnet.

Offizielle Standardpreise, am 26.10.2026 geprüft, je 1 Mio. Tokens: [Sol: $2 Input / $0,10 gecacht / $10 Output](https://developers.openai.com/api/docs/models/gpt-6.1-sol), [Terra: $1 / $0,05 / $5](https://developers.openai.com/api/docs/models/gpt-6.1-terra), [Luna: $0,10 / $0,01 / $0,50](https://developers.openai.com/api/docs/models/gpt-6-luna).

Herstellung aller neun Versuche einschließlich des Abbruchs: 34 Aufrufe, rechnerisch $1,7811 ohne Cache. Die sechs externen Blindbewertungen kommen separat hinzu: $0,3981 ohne Cache. Sie sind in den Pro-Folge-Herstellungskosten und -zeiten oben nicht enthalten. Tatsächlich zusätzliche API-Rechnung für beide Gruppen zusammen: $0.

Zeit ist gemessene Gesamtlaufzeit je Folge inklusive Planung, interner Prüfung und aller tatsächlich nötigen Reparaturen. Bis zu drei Rollenpakete laufen gleichzeitig; daher Praxisbeobachtung statt isoliertem Geschwindigkeitsbenchmark. Modellzeit je Rolle folgt unten. Eine längere Laufzeit kann auch durch zusätzliche Schreiberüberarbeitungen entstehen.

## Alle neun Versuche

| Aufgabe | Planer/Prüfer | Geschichte | Wörter | Sol-Lektor | Terra-Lektor | Mittel /10 | Sekunden | API-Äquivalent ohne Cache | Aufrufe |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| Magisches Abenteuer | gpt-6.1-sol | [Die Zusatzregel hat Schluckauf](magic-support-sol.md) | 1982 | 7,60 | 7,40 | 7,50 | 301 | $0,2459 | 3 |
| Magisches Abenteuer | gpt-6.1-terra | [Der Teppich mit Vorsprung](magic-support-terra.md) | 2117 | 7,80 | 7,80 | 7,80 | 294 | $0,2982 | 5 |
| Magisches Abenteuer | gpt-6-luna | [Der Schnurrbart-Spieltest](magic-support-luna.md) | 2112 | 7,00 | 7,40 | 7,20 | 291 | $0,2073 | 5 |
| Lustiges Märchen | gpt-6.1-sol | [Das Kissen im Pferdetrog](fairytale-support-sol.md) | 2107 | 8,20 | 7,90 | 8,05 | 371 | $0,2557 | 3 |
| Lustiges Märchen | gpt-6.1-terra | [Die Nebeltreppe](fairytale-support-terra.md) | 2120 | 7,00 | 7,20 | 7,10 | 205 | $0,1670 | 3 |
| Lustiges Märchen | gpt-6-luna | [Der Rätsel-Moorfrosch](fairytale-support-luna.md) | 2146 | 7,10 | 7,80 | 7,45 | 359 | $0,2190 | 6 |
| Einschlafgeschichte | gpt-6.1-sol | [Das Kissen hört mit](bedtime-support-sol.md) | 710 | 7,40 | 7,80 | 7,60 | 204 | $0,2024 | 3 |
| Einschlafgeschichte | gpt-6.1-terra | [Das Kissenmoos](bedtime-support-terra.md) | 715 | 7,70 | 7,80 | 7,75 | 121 | $0,1783 | 4 |
| Einschlafgeschichte | gpt-6-luna | **Abbruch nach Planreparatur** | — | — | — | — | ≈63 | $0,0073 | 2 |

## Aufwand pro tatsächlich gelieferter Geschichte

Hier werden die Kosten und Arbeitszeiten aller drei Versuche durch die Zahl gelieferter Geschichten geteilt. Fehlversuche zählen also mit; beim Luna-Abbruch ist die Zeit aus den beiden Modellaufrufen rekonstruiert. Das ist kein isolierter Latenzwert eines einzelnen erfolgreichen Laufs.

| Planer/Prüfer | Geliefert | Arbeitssekunden je gelieferter Geschichte | API-Äquivalent je gelieferter Geschichte ohne Cache |
|---|---:|---:|---:|
| gpt-6.1-sol | 3/3 | 292 | $0,2346 |
| gpt-6.1-terra | 3/3 | 207 | $0,2145 |
| gpt-6-luna | 2/3 | 357 | $0,2168 |

## Wo Zeit und Geldäquivalent entstehen

| Unterstützung | Rolle | Ø Sekunden/Versuch | Ø API-Äquivalent/Versuch ohne Cache | Aufrufe insgesamt |
|---|---|---:|---:|---:|
| gpt-6.1-sol | planner | 150,6 | $0,0945 | 3 |
| gpt-6.1-sol | writer | 121,0 | $0,0883 | 3 |
| gpt-6.1-sol | critic | 20,5 | $0,0518 | 3 |
| gpt-6.1-terra | planner | 49,7 | $0,0562 | 4 |
| gpt-6.1-terra | writer | 142,1 | $0,1215 | 4 |
| gpt-6.1-terra | critic | 14,8 | $0,0369 | 4 |
| gpt-6-luna | planner | 63,7 | $0,0064 | 5 |
| gpt-6-luna | writer | 156,3 | $0,1348 | 4 |
| gpt-6-luna | critic | 17,4 | $0,0033 | 4 |

| Unterstützung | Planreparaturen | Akzeptierte Lektoratsüberarbeitungen | Nicht wörtlich belegte interne Hinweise | Kapitel außerhalb Budget |
|---|---:|---:|---:|---:|
| gpt-6.1-sol | 0 | 0/3 | 0 | 0/9 |
| gpt-6.1-terra | 1 | 1/3 | 0 | 0/9 |
| gpt-6-luna | 2 | 2/2 | 1 | 0/6 |

## Einzelbewertungen und tatsächliche Aufrufe

### Magisches Abenteuer · gpt-6.1-sol

[Die Zusatzregel hat Schluckauf](magic-support-sol.md) · 660 / 650 / 672 Wörter je Kapitel.

**gpt-6.1-sol: 7,60/10.** Gewichtet 7,6/10: Einfallsreich und emotional vorbereitet, mit unnötigen Umwegen und einem unscharfen zweiten Wertungssystem.

- **major:** „Für jede besonders lustige Bewegung gab es außerdem einen Überraschungspunkt.“ – Ein zweites Wertungssystem erscheint unvermittelt. Warum Kicher darüber zurückliegt, obwohl allein das Zielfeld entscheidet, bleibt unscharf. Vorschlag: Überraschungspunkte mit dem Vorankommen verbinden oder streichen; Kichers drohende Niederlage unmittelbar an den Spielsteinen zeigen.
- **major:** „Ist das noch ein Probesitz?“ – Das wiederholte Verbergen vor Rike beansprucht Raum, ohne die Lösung oder Kichers Entscheidung wesentlich weiterzuentwickeln. Vorschlag: Rikes Nachfragen bündeln und die frei werdende Passage für einen kürzeren, klareren Weg zum letzten Zug nutzen.

Belegzitate außerhalb der Quelle: 0; über 25 Wörter: 0.

**gpt-6.1-terra: 7,40/10.** Einfallsreich und gefühlvoll, mit starkem Hauptfigurenbogen; die Spielmechanik und Länge kosten Klarheit.

- **major:** „Für jede besonders lustige Bewegung gab es außerdem einen Überraschungspunkt.“ – Überraschungspunkte und Feldfortschritt konkurrieren um Aufmerksamkeit, ohne klar miteinander verbunden zu sein. Vorschlag: Den Unterschied zwischen Punkten und dem Weg zum Sieg früh und knapp zeigen.
- **major:** „Ich könnte die äußere Schleife über die innere legen“ – Weitere Umbaupläne verzögern die Lösung, obwohl Ben kurz vor dem Ziel steht. Vorschlag: Einen Umweg streichen und Bens Entdeckung früher zum entscheidenden Konflikt führen.

Belegzitate außerhalb der Quelle: 0; über 25 Wörter: 0.

Interne Überarbeitung: keine belegten größeren Fehler gemeldet. Die abschließende interne Eigenprüfung fließt nicht als Qualitätsnote in die Rangliste ein.

| Stufe | Tatsächliche Modellwahl | Sekunden | Input / Output | API-Äquivalent ohne Cache |
|---|---|---:|---:|---:|
| episode-plan | gpt-6.1-sol | 119,6 | 27829 / 4131 | $0,0970 |
| episode-write | gpt-6.1-sol | 159,3 | 29229 / 3724 | $0,0957 |
| episode-internal-review | gpt-6.1-sol | 22,4 | 25466 / 227 | $0,0532 |

### Magisches Abenteuer · gpt-6.1-terra

[Der Teppich mit Vorsprung](magic-support-terra.md) · 647 / 725 / 745 Wörter je Kapitel.

**gpt-6.1-sol: 7,80/10.** Gewichtet 7,8/10: Die stärkste Verbindung aus Wunderidee, Situationskomik und entscheidender Wahl; die Punktevergabe braucht Überarbeitung.

- **major:** „Sie drückte dem Kobold einen Punktzapfen in die Hand.“ – Nora hat zu diesem Zeitpunkt keinen eigenen Punkt gewonnen. Die zusätzliche Wertung entsteht ohne erklärte Grundlage. Vorschlag: Nora vorher einen Punkt gewinnen lassen oder eine ausdrücklich erlaubte Vergabe aus dem Vorrat etablieren.
- **major:** „Den gebe ich Kicher“ – Nora vergrößert erneut bewusst den Vorsprung, obwohl ihr erster Beschleunigungsversuch gerade das Gegenteil bewirkt hat. Vorschlag: Den vierten Punkt durch Kichers eigene Entscheidung entstehen lassen oder Nora einen nachvollziehbaren neuen Versuch unternehmen lassen.

Belegzitate außerhalb der Quelle: 0; über 25 Wörter: 0.

**gpt-6.1-terra: 7,80/10.** Das rundeste Zusammenspiel von Wunderregel, Eskalation und Kichers Entscheidung, mit einem gut vorbereiteten Schlussgag.

- **major:** „Vielleicht steigt er damit endlich vom Teppich.“ – Noras weiterer Punkt erhöht das Problem trotz ihrer erkannten Fehlentscheidung; ihre Absicht bleibt dünn. Vorschlag: Zeigen, warum sie diesmal erwartet, Kicher werde tatsächlich absteigen.
- **minor:** „Kicher tippte nachdenklich mit zwei Fingern an seinen Hut. Diesmal kicherte der Kobold nicht.“ – Der stille Moment erklärt seine Bedeutung etwas stark, statt länger bei Motte zu bleiben. Vorschlag: Kichers Reaktion knapper halten und der beobachteten Ruhe mehr Raum geben.

Belegzitate außerhalb der Quelle: 0; über 25 Wörter: 0.

Interne Überarbeitung: akzeptiert. Die abschließende interne Eigenprüfung fließt nicht als Qualitätsnote in die Rangliste ein.

| Stufe | Tatsächliche Modellwahl | Sekunden | Input / Output | API-Äquivalent ohne Cache |
|---|---|---:|---:|---:|
| episode-plan | gpt-6.1-terra | 44,8 | 27767 / 3263 | $0,0441 |
| episode-write | gpt-6.1-sol | 155,9 | 29134 / 3572 | $0,0940 |
| episode-internal-review | gpt-6.1-terra | 14,0 | 27583 / 338 | $0,0293 |
| episode-editorial-revision | gpt-6.1-sol | 69,7 | 32902 / 3829 | $0,1041 |
| episode-internal-recheck | gpt-6.1-terra | 9,7 | 25576 / 245 | $0,0268 |

### Magisches Abenteuer · gpt-6-luna

[Der Schnurrbart-Spieltest](magic-support-luna.md) · 667 / 687 / 758 Wörter je Kapitel.

**gpt-6.1-sol: 7,00/10.** Gewichtet 7,0/10: Bildhaft und stellenweise sehr komisch, aber mit verwischter Wunderregel und abgeschwächtem Figurenwandel.

- **major:** „Er zupft, wenn wir drängeln“ – Neben dem konkreten Ruf erscheint ein weiterer Auslöser. Später wird trotzdem allein die Wortregel als Erklärung zusammengefasst. Vorschlag: Die Drängelreaktion streichen oder früh als gleichberechtigten, eindeutig beobachtbaren Bestandteil der Regel etablieren.
- **major:** „Wer freiwillig zuletzt dran ist, gewinnt den Spielrichter-Punkt.“ – Kicher rettet sich erneut durch eine Zusatzwertung. Sein Verzicht auf Kontrolle bleibt dadurch an einen eigenen Gewinn gebunden. Vorschlag: Kicher Ben ohne Ersatzbelohnung vorlassen; die erneute gemeinsame Spielrunde als emotionalen Gewinn tragen lassen.

Belegzitate außerhalb der Quelle: 0; über 25 Wörter: 0.

**gpt-6.1-terra: 7,40/10.** Ein lebendiger Spieltest mit klarer Zusammenarbeit; der Schlussgag bleibt hinter den stärksten Bildern zurück.

- **major:** „Er zupft, wenn wir drängeln“ – Neben dem klaren Auslöser entsteht eine zweite, kaum überprüfte Verhaltensregel. Vorschlag: Das Zupfen als konkrete Reaktion zeigen oder seine Bedingung später einlösen.
- **minor:** „Ich rede dann schneller, damit keiner merkt, dass ich nervös bin.“ – Kicher erklärt sein Verhalten geradeheraus, statt seine Nervosität wirken zu lassen. Vorschlag: Seine Angst durch stockende Worte und den festgehaltenen Beutel vermitteln.

Belegzitate außerhalb der Quelle: 0; über 25 Wörter: 0.

Interne Überarbeitung: akzeptiert. Die abschließende interne Eigenprüfung fließt nicht als Qualitätsnote in die Rangliste ein.

| Stufe | Tatsächliche Modellwahl | Sekunden | Input / Output | API-Äquivalent ohne Cache |
|---|---|---:|---:|---:|
| episode-plan | gpt-6-luna | 46,5 | 23406 / 3045 | $0,0039 |
| episode-write | gpt-6.1-sol | 154,0 | 28505 / 3767 | $0,0947 |
| episode-internal-review | gpt-6-luna | 14,3 | 23405 / 394 | $0,0025 |
| episode-editorial-revision | gpt-6.1-sol | 62,8 | 32386 / 3901 | $0,1038 |
| episode-internal-recheck | gpt-6-luna | 12,9 | 22945 / 323 | $0,0025 |

### Lustiges Märchen · gpt-6.1-sol

[Das Kissen im Pferdetrog](fairytale-support-sol.md) · 685 / 695 / 727 Wörter je Kapitel.

**gpt-6.1-sol: 8,20/10.** Gewichtet 8,2: ein starkes Figurenmärchen mit anschaulichem Wunder, eigenwilligem Gegenüber und verdientem, freundlich überraschendem Ende.

- **minor:** „Auf ihrem Zifferblatt wiesen zwei goldene Hände die Zeit.“ – Das Rätsel benötigt eigens eingeführte Hände, weil deutsche Uhren gewöhnlich Zeiger haben; Bens Leistung wird dadurch künstlicher. Vorschlag: Ein im Deutschen selbstverständlich verständliches Rätsel wählen, dessen Lösung ebenfalls sichtbar vorbereitet werden kann.
- **minor:** „„Diese Partie war vielleicht bloß eine Übung.““ – Nach Bens Bekenntnis wiederholt die Hexe ihre bekannte Ausflucht; der emotionale Fortschritt stockt kurz. Vorschlag: Eine Verweigerung kürzen und den verbleibenden Widerstand stärker als Angst vor dem Abschied zeigen.

Belegzitate außerhalb der Quelle: 0; über 25 Wörter: 0.

**gpt-6.1-terra: 7,90/10.** Eine komische, gut geführte Partie mit klarer Wunderregel und einer glaubwürdigen Entscheidung der Hexe.

- **minor:** „„Was wird größer, wenn man etwas wegnimmt?““ – Das zusätzliche Rätsel verzögert die Anerkennung, obwohl Ben die Partie bereits gewonnen hat. Vorschlag: Das Rätsel früher einlösen oder den Moment nach Bens zweitem Punkt straffen.
- **minor:** „„Du darfst eine meiner Quasten als Polster haben.““ – Der Schlussgag gehört vor allem Poff; die titelgebende Lage im Trog bleibt recht beiläufig. Vorschlag: Den Pferdetrog stärker in Poffs letzte Pointe einbeziehen.

Belegzitate außerhalb der Quelle: 0; über 25 Wörter: 0.

Interne Überarbeitung: keine belegten größeren Fehler gemeldet. Die abschließende interne Eigenprüfung fließt nicht als Qualitätsnote in die Rangliste ein.

| Stufe | Tatsächliche Modellwahl | Sekunden | Input / Output | API-Äquivalent ohne Cache |
|---|---|---:|---:|---:|
| episode-plan | gpt-6.1-sol | 205,0 | 25625 / 5170 | $0,1029 |
| episode-write | gpt-6.1-sol | 148,3 | 30152 / 3857 | $0,0989 |
| episode-internal-review | gpt-6.1-sol | 18,1 | 25676 / 249 | $0,0538 |

### Lustiges Märchen · gpt-6.1-terra

[Die Nebeltreppe](fairytale-support-terra.md) · 686 / 692 / 742 Wörter je Kapitel.

**gpt-6.1-sol: 7,00/10.** Gewichtet 7,0: einfallsreich und komisch, mit wirksamen Kinderbeiträgen; Hauptfigurenführung und räumliche Klarheit bleiben schwächer.

- **major:** „„Jetzt darf die Treppe weg“, sagte Nora.“ – Die Kinder haben die praktische Krise bereits gelöst; die Hauptfigur muss anschließend vor allem zustimmen. Vorschlag: Der Hexe vor der Rettung eine eigene Entscheidung geben, die ihren Siegeswunsch spürbar herausfordert.
- **major:** „Die unteren Stufen endeten inzwischen über dem Schilf.“ – Die zuvor entstehende Treppe bietet plötzlich keinen Abstieg; ihre räumliche Funktionsweise bleibt schwer vorstellbar. Vorschlag: Früh zeigen, ob ältere Stufen mitsteigen oder verschwinden, und diese Bewegung konsequent beibehalten.

Belegzitate außerhalb der Quelle: 0; über 25 Wörter: 0.

**gpt-6.1-terra: 7,20/10.** Ein lebhaftes Märchen mit eigenwilliger Hexe und gut vorbereiteter Lösung, aber zu viel räumlicher Betriebsamkeit.

- **major:** „Die unteren Stufen endeten inzwischen über dem Schilf.“ – Die Höhe und der rollende Kessel erzeugen für eine Einschlafgeschichte unnötige Gefahr. Vorschlag: Den Tisch bodennah festsetzen und die Zuspitzung aus der blockierten Partie entwickeln.
- **minor:** „Ben hob Quapp aus dem Kessel.“ – Quapp war zuvor aus dem Kessel geklettert; sein erneuter Aufenthalt bleibt unerklärt. Vorschlag: Zeigen, wie Quapp zurück in den Kessel gelangt, oder ihn von der Stufe holen lassen.

Belegzitate außerhalb der Quelle: 0; über 25 Wörter: 0.

Interne Überarbeitung: keine belegten größeren Fehler gemeldet. Die abschließende interne Eigenprüfung fließt nicht als Qualitätsnote in die Rangliste ein.

| Stufe | Tatsächliche Modellwahl | Sekunden | Input / Output | API-Äquivalent ohne Cache |
|---|---|---:|---:|---:|
| episode-plan | gpt-6.1-terra | 41,6 | 25563 / 3373 | $0,0424 |
| episode-write | gpt-6.1-sol | 152,4 | 28901 / 3829 | $0,0961 |
| episode-internal-review | gpt-6.1-terra | 11,2 | 27860 / 131 | $0,0285 |

### Lustiges Märchen · gpt-6-luna

[Der Rätsel-Moorfrosch](fairytale-support-luna.md) · 693 / 690 / 763 Wörter je Kapitel.

**gpt-6.1-sol: 7,10/10.** Gewichtet 7,1: lebendige Stimmen und ein berührender Abschluss; die Eskalation benötigt zu viele mechanische Hilfskonstruktionen.

- **major:** „„Ich habe klebrige Füße“, erklärte Quakbert. „Beim Schleichen knittert der Umhang.““ – Ein belangloses Stoffknittern begründet keinen nötigen Sprung; die zusätzliche Rettungsaufgabe wirkt konstruiert. Vorschlag: Quakbert ohne Zusatzhüpfer wegklettern lassen oder ein früh vorbereitetes, tatsächlich hinderliches Hindernis verwenden.
- **major:** „Ein einziger mächtiger Sprung traf den weichen Polsterrand.“ – Gerade die kürzeste Antwort erzeugt die größte Blasenwirkung; die zuvor zentrale Silbenzahl erklärt die Eskalation kaum. Vorschlag: Die besondere Wirkung des Polsterrands vorher zeigen oder die Luftmenge nachvollziehbar durch mehrere Sprünge steigern.

Belegzitate außerhalb der Quelle: 0; über 25 Wörter: 0.

**gpt-6.1-terra: 7,80/10.** Ein einfallsreiches Märchen, dessen Wunderregel und Hexenentscheidung eng zusammenhängen; die Höhe stört die ruhige Vorlesestimmung.

- **major:** „Das Polster hob sich über die Schilfspitzen.“ – Die Höhe und das anschließende Kippen bringen Unruhe und mögliche Gefahr in die Einschlafgeschichte. Vorschlag: Das Polster auf dem Wasser treiben lassen und die Pflanzinsel durch sanftes Anstoßen bedrohen.
- **minor:** „„Offen ratlose Rätselsteller lösen den Zauber““ – Die abstrakte Formulierung erschwert den Einstieg in eine sonst verständliche Regel. Vorschlag: Quakbert direkt sagen lassen, dass ein fragender Mensch seine Unwissenheit laut gestehen muss.

Belegzitate außerhalb der Quelle: 0; über 25 Wörter: 0.

Interne Überarbeitung: akzeptiert. Die abschließende interne Eigenprüfung fließt nicht als Qualitätsnote in die Rangliste ein.

| Stufe | Tatsächliche Modellwahl | Sekunden | Input / Output | API-Äquivalent ohne Cache |
|---|---|---:|---:|---:|
| episode-plan | gpt-6-luna | 34,3 | 22860 / 3464 | $0,0040 |
| episode-plan-repair | gpt-6-luna | 47,7 | 23067 / 3268 | $0,0039 |
| episode-write | gpt-6.1-sol | 153,3 | 29109 / 4001 | $0,0982 |
| episode-internal-review | gpt-6-luna | 15,2 | 23655 / 311 | $0,0025 |
| episode-editorial-revision | gpt-6.1-sol | 98,7 | 33130 / 4156 | $0,1078 |
| episode-internal-recheck | gpt-6-luna | 9,7 | 23214 / 273 | $0,0025 |

### Einschlafgeschichte · gpt-6.1-sol

[Das Kissen hört mit](bedtime-support-sol.md) · 231 / 233 / 246 Wörter je Kapitel.

**gpt-6.1-sol: 7,40/10.** Eine warme, komische Vorlesegeschichte mit überzeugendem Beziehungsmoment, aber wiederholten Versuchen und lückenhafter räumlicher Zauberführung.

- **major:** „Bo ordnete seine Lesezeichen. „Dafür suche ich das passende Fach. Sitzmöbel.““ – Nach der erklärten Sprecherregel müsste Poff zu Bo wechseln; solche ausgelassenen Wechsel erschweren das räumliche Mitverfolgen. Vorschlag: Poffs Wechsel konsequent sichtbar machen und überflüssige Sprecherwechsel kürzen.
- **major:** „Nora zeigte auf ein Bilderbuch. Noch ein Parkplatz.“ – Nach Korb und Decke wiederholt das Buch denselben Versuch; Bens versprochener Anfang wartet lange. Vorschlag: Einen Parkversuch streichen und früher zum Flüsterversuch oder zur Schwanzepisode übergehen.

Belegzitate außerhalb der Quelle: 0; über 25 Wörter: 0.

**gpt-6.1-terra: 7,80/10.** Eine sanfte, einfallsreiche Vorlesegeschichte mit einem lebendigen Wunder und einem gemeinsamen Spiel.

- **minor:** „Noch ein Parkplatz.“ – Das Bild für Noras nächsten Versuch bleibt ohne Zusammenhang zunächst schwer verständlich. Vorschlag: Direkt beschreiben, wo Nora Poff absetzen möchte.

Belegzitate außerhalb der Quelle: 0; über 25 Wörter: 0.

Interne Überarbeitung: keine belegten größeren Fehler gemeldet. Die abschließende interne Eigenprüfung fließt nicht als Qualitätsnote in die Rangliste ein.

| Stufe | Tatsächliche Modellwahl | Sekunden | Input / Output | API-Äquivalent ohne Cache |
|---|---|---:|---:|---:|
| episode-plan | gpt-6.1-sol | 127,1 | 25303 / 3312 | $0,0837 |
| episode-write | gpt-6.1-sol | 55,6 | 28240 / 1385 | $0,0703 |
| episode-internal-review | gpt-6.1-sol | 21,1 | 23180 / 195 | $0,0483 |

### Einschlafgeschichte · gpt-6.1-terra

[Das Kissenmoos](bedtime-support-terra.md) · 236 / 242 / 237 Wörter je Kapitel.

**gpt-6.1-sol: 7,70/10.** Eine starke, ruhige Geschichte mit klarer Wunderregel, konkretem Kinderkonflikt und vorbereitetem Schlusswitz; einzelne Wiederholungen wirken konstruiert.

- **major:** „„Wir verstecken sie hinter Bos Tasche. Ich bestimme!““ – Nora kennt den Auslöser bereits; warum sie beim Verstecken ausdrücklich weitere Kissen erzeugt, bleibt dünn motiviert. Vorschlag: Ihren Wunsch nach dem letzten Wort unmittelbar aus Bens widersprechendem Platzvorschlag entstehen lassen.
- **minor:** „„Ich habe auch eine Frage. Im Regal ohne Schild. Ich wusste nicht, wohin damit.““ – Die zusätzliche Regalfrage verlangt Aufmerksamkeit, ohne die Platzwahl oder den Kissenzauber wesentlich voranzubringen. Vorschlag: Bos Frage unmittelbar auf das gemeinsame Aussuchen beziehen und daraus das neue Fach entwickeln.

Belegzitate außerhalb der Quelle: 0; über 25 Wörter: 0.

**gpt-6.1-terra: 7,80/10.** Eine warme, gut vorlesbare Geschichte mit verständlichem Wunder und einer überzeugenden kleinen Entscheidung.

- **minor:** „„Ich habe auch eine Frage. Im Regal ohne Schild. Ich wusste nicht, wohin damit.““ – Bos Anliegen wird umständlich eingeführt und bremst den Weg zum Geschichtenplatz. Vorschlag: Seine Frage früher und konkreter zeigen.

Belegzitate außerhalb der Quelle: 0; über 25 Wörter: 0.

Interne Überarbeitung: keine belegten größeren Fehler gemeldet. Die abschließende interne Eigenprüfung fließt nicht als Qualitätsnote in die Rangliste ein.

| Stufe | Tatsächliche Modellwahl | Sekunden | Input / Output | API-Äquivalent ohne Cache |
|---|---|---:|---:|---:|
| episode-plan | gpt-6.1-terra | 37,0 | 25239 / 2942 | $0,0399 |
| episode-plan-repair | gpt-6.1-terra | 25,6 | 27861 / 2834 | $0,0420 |
| episode-write | gpt-6.1-sol | 48,4 | 28251 / 1372 | $0,0702 |
| episode-internal-review | gpt-6.1-terra | 9,6 | 25354 / 154 | $0,0261 |

### Einschlafgeschichte · gpt-6-luna: fehlgeschlagen

Keine Geschichte und keine literarische Nullnote. Error: [talea-folge-v1] plan has 0 chapters instead of 3. Der erste Plan enthielt zwei neue Figuren, obwohl für 3–5 Jahre nur eine erlaubt ist. Die reguläre Reparatur lieferte ungültiges JSON; dadurch blieb kein auswertbarer Kapitelplan. Ein zusätzlicher Neustart wurde nicht zur Erfolgsauswahl verwendet. In diesem CLI-Transport ist natives JSON/Schema nicht erzwungen; ein nativer API-JSON-Modus könnte diesen konkreten Fehler verhindern. Die Kosten beider Planaufrufe zählen mit. Die ≈63 Sekunden sind aus ihren gemessenen Modellzeiten rekonstruiert.

| Stufe | Tatsächliche Modellwahl | Sekunden | Input / Output | API-Äquivalent ohne Cache |
|---|---|---:|---:|---:|
| episode-plan | gpt-6-luna | 30,6 | 22538 / 2554 | $0,0035 |
| episode-plan-repair | gpt-6-luna | 32,0 | 25128 / 2577 | $0,0038 |

## Reproduktion

`bun scripts/episode/model-comparison.ts --support-study --stage generate --variant support-sol` (bzw. support-terra, support-luna). Danach `--support-study --stage check`, je Lektor `--support-study --stage review --judge gpt-6.1-sol` bzw. gpt-6.1-terra, abschließend `--support-study --stage report`. Rohantworten, ursprüngliche Pläne, Manuskripte vor der Lektoratsstufe, Prüfhinweise, Request-/Ereignisprotokolle und Zeiten: Logs/episode-support-comparison/2026-10-26.
