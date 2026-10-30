# Kinderbuch-Modellvergleich: Qualität und Kosten

30. Oktober 2026. Vier Autoren auf angefordertem `low`, je zwei neue Geschichten aus der Blubbert-Figurenserie für 6–8 Jahre. Jede Variante erhielt pro Folge denselben System- und Nutzerprompt mit Nora und Ben. Folge 2 verwendet für alle dieselbe vorherige Beispielgeschichte als Familienverlauf. Bewertet wurden zunächst die unüberarbeiteten Autorenfassungen.

Gemini 4 Carbon war über den Projektzugang nicht verfügbar: OpenRouter meldete für `google/gemini-4-carbon` eine ungültige Modellkennung. Als zusätzliche, ausdrücklich andere Variante lief Gemini 4 Argon. Google beschreibt den Zugang zu Carbon als zunächst begrenzt auf ausgewählte Partner: [Ankündigung vom 28. Oktober 2026](https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-carbon/).

## Die beiden ursprünglichen Geschichten

Beide Geschichten sind für ein Vorlesepublikum von sechs Jahren aus meiner Sicht schwer nachzuerzählen; auch viele Achtjährige dürften bei den räumlichen Abläufen und Nebenaufträgen Hilfe brauchen. Das ist eine Einschätzung, kein Test mit Kindern.

- **Der Kompass fährt im Kreis:** Das eigentliche Ziel ist, Sitzbretter rechtzeitig zum Schöpfhaus zu liefern, damit Kinder sitzen können. Dazu kommen Steinlager, zwei Buchten, Sandzunge, Ortsplättchen, Leinen und der Kompass. Wie die Orte zueinander liegen und warum das Plättchen plötzlich hilft, verlangt viel Mitdenken. Der Kapitän und die wiederkehrende Boje sind dagegen lustig und anschaulich.
- **Das Banner wird kleiner:** Hier stört das Banner erst beim Trocknen der Schulbögen; später sollen Stoffstreifen als Trageschlaufen für die Rahmen dienen. Das Problem ist grundsätzlich sichtbar, wird aber durch Trockenständer, verklemmtes Bein, Lagertür, Karren und klebende Papierbögen sehr technisch. Das Auftragsbuch, Torzeichen und der Weitertransport eröffnen nebenbei eine weitere Handlung. Die Lösung verlangt viel räumliches Vorstellen.

In den Logs schrieb Sol, anschließend prüfte Claude Haiku 5.5 die Texte. Diese Prüfung hat die Verständlichkeitsprobleme hier nicht zuverlässig erkannt. Die Logs allein belegen nicht, dass `low` die Ursache war: Der vorgegebene Folgenplan, der Schreibauftrag und die Prüfregeln beeinflussen das Ergebnis ebenfalls. Für den Vergleich wurden diese Vorgaben lokal überarbeitet: klarere Ziele und Folgen, weniger schwer vorstellbare Abläufe und eine Prüfung, ob ein Kind die Handlung nacherzählen könnte. Das Lektorat bleibt eine Modellprüfung und ist nicht fehlerfrei.

## Qualität

Eigene Blindlektüre, jeweils Mittelwert aus zwei Geschichten. 10 ist die höchste Note. Die Werte sind Einschätzungen für Vorlesegeschichten, keine Messungen mit Kindern.

| Autor, low | Verständlichkeit | Ziel und Problem | Logik | Humor | Spannung und Tempo | Figuren und Dialog | Sprache und Vorlesen | Gefühl und Ende | Mittel |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| GPT-6.1 Sol | 8 | 8 | 7 | 7,5 | 7,5 | 7 | 8 | 8 | 7,6 |
| Claude Opus 5.5 | 7,5 | 8,5 | 7,5 | 7,5 | 7 | 8 | 7,5 | 8 | 7,7 |
| Claude Sonnet 5.5 | 6,5 | 8 | 4 | 6 | 6 | 6,5 | 6,5 | 6,5 | 6,3 |
| Gemini 4 Argon | 5,5 | 8 | 5 | 5,5 | 6,5 | 6,5 | 5,5 | 6,5 | 6,1 |

Die Modelle unterscheiden sich in diesem kleinen Test vor allem darin, ob sie die Handlung einfach sichtbar machen oder komplizierte Bewegungen und Fachbegriffe anhäufen. Alle vier erhielten den gleichen bereits verbesserten Episodenplan; die Noten messen daher die konkrete Kombination aus Modell, Prompt und Aufgabe.

Zwei weitere KI-Lektorate lasen dieselben Texte anonymisiert in unterschiedlicher Reihenfolge. Als Gesamtmittel über beide Geschichten und alle acht Kategorien ergaben sich:

| Autor, low | Eigene Blindlektüre | GPT-6.1 Terra als Lektorat | Gemini 3.8 Flash als Lektorat |
|---|---:|---:|---:|
| Sol | 7,6 | 8,3 | 8,1 |
| Opus | 7,7 | 8,2 | 8,7 |
| Sonnet | 6,3 | 6,9 | 7,1 |
| Argon | 6,1 | 6,8 | 8,0 |

Das Gemini-Lektorat gab Argon in beiden Geschichten in allen Kategorien eine 8. Es lieferte gültige Zahlen und konkrete Textbefunde, aber keine Begründung je Kategorie im angeforderten Format. Diese Einschätzung deshalb nicht unkritisch als präzisen Gleichstand behandeln. Terra gehört zur selben Anbieterfamilie wie Sol, Gemini Flash zur selben wie Argon; Anonymisierung beseitigt mögliche Stilpräferenzen nicht. Einzelne angebliche Zitate von Terra waren nicht wortwörtlich und wurden nicht als Belege übernommen. Es gab keine Kinder- oder menschlichen Blindleser und keine Wiederholungen; kleine Unterschiede sind nicht belastbar.

## Texte und konkrete Befunde

- **Sol:** [Kuchenfahrt](blind/1-A.md), [Banner](blind/2-D.md). Die Boje mit dem aufgemalten Schnurrbart macht das Kreisen anschaulich; Pinne wird direkt erklärt. Im Banner ist „Ich habe alles im Griff.“ – „Von innen“ eine verständliche Pointe. Schwächen: Das Geburtstagkind bleibt etwas fern; der Text zeigt einen Schnitt durch das B in BLUBBERT, ohne zu erklären, warum später von ENTDECKER nur ENT übrig ist.
- **Opus:** [Kuchenfahrt](blind/1-B.md), [Banner](blind/2-A.md). Lotte und ihr Bergkuchen machen das Ziel persönlich. Die Ziege und das versehentliche Anbinden des Kapitäns erzeugen unterschiedliche Komik; im Banner halten zwei Figuren das Dach, während zwei andere die Rahmen tragen. Schwäche: In der Kuchenfahrt wird die gemeinsame Kompasshandlung erst sehr spät als Regel erkennbar.
- **Sonnet:** [Kuchenfahrt](blind/1-D.md), [Banner](blind/2-C.md). Mia und das selbst gespritzte Kuchenherz sind ein schönes persönliches Detail. Die zuvor festgemachte Boje wird am Ende aber plötzlich mitgeschleppt, ohne dass eine Verbindung gezeigt wurde. Im Banner wird „mitten durch das ENT“ geschnitten, später soll ENT dennoch stehen geblieben sein; die Rettung der Rahmen unter dem Banner wird umständlich.
- **Argon:** [Kuchenfahrt](blind/1-C.md), [Banner](blind/2-B.md). Der Kuchenauftrag ist verständlich, die Fahrt arbeitet aber mit vielen Begriffen wie Bilge, Backbord und Kiel. Im Banner entscheidet sich Ben ausdrücklich für einen blauen Drachen; am Ende steigen ein roter und ein gelber auf. Die Textprüfung im anschließenden Kostenlauf bemerkte diesen Fehler und ließ ihn reparieren.

## Kosten der Geschichte mit Bildern

Für jede bereits bewertete Banner-Geschichte wurde die restliche Produktionskette mit Textprüfung, Bildplanung, Bildprüfung und bis zu sieben gewünschten Bildern (sechs Szenen und ein Cover) separat ausgeführt. Der Autorentext wurde dabei wiederverwendet. Die Spalte „Autor“ stammt aus genau diesem vorherigen, auf Standard-Tarif gemessenen Autorenaufruf; die übrigen Posten stammen aus dem anschließenden Bild- und Lektoratslauf. Avatar-Entwicklung wurde im Pilot nicht ausgeführt: angesetzt ist der Durchschnitt der beiden gelieferten Produktionslogs, 0,00066 US-Dollar.

| Autor, low | Autor | Textlektorat und Reparatur | Bildplanung und -prüfung | Bilder | Avatar, geschätzt | Summe | Geprüfte Bilder |
|---|---:|---:|---:|---:|---:|---:|---:|
| Sol | $0,03293 | $0,00239 | $0,00985 | $0,01183 | $0,00066 | **$0,05766** | 7/7 |
| Sonnet | $0,08633 | $0,00424 | $0,01221 | $0,01846 | $0,00066 | **$0,12190** | 7/7 |
| Argon | $0,05126 | $0,01551 | $0,01418 | $0,01859 | $0,00066 | **mindestens $0,10020** | 6/7 |
| Opus | $0,22396 | $0,03748 | $0,01561 | $0,01859 | $0,00066 | **mindestens $0,29631** | 5/7 |

Die Summe ist eine Zusammensetzung gemessener Teilkosten und einer kleinen Avatar-Schätzung, keine Rechnung aus einem einzigen durchgängigen Produktionslauf. Der Bildlauf von Opus und Argon lieferte trotz weiterer Bildversuche nicht alle sieben Bilder; für ein vollständiges Ergebnis könnten weitere Kosten entstehen. Das ist eine Beobachtung dieser Bildläufe und kein Beweis, dass das jeweilige Schreibmodell schlechtere Bilder verursacht. Beim Opus-Lauf wurde eine optionale Textreparatur bezahlt, ihre Änderung aber wegen eines nicht exakt passenden Textausschnitts nicht übernommen. Bei Sonnet und Argon überarbeitete das Lektorat die Texte; die obigen Qualitätsnoten beziehen sich weiterhin auf die Originalentwürfe.

Die Werte enthalten die erfassten Text-, Bild- und Modellkosten, nicht Hosting, Speicherung, Steuern, Zahlungsgebühren oder optionale Audioerzeugung. Sie sind keine garantierten Produktionspreise. Schreibaufrufe wurden hier ohne Flex-Tarif gemessen; der anschließende Lauf nutzte Flex als Voreinstellung, Bildplanung und Bildprüfung verlangten jedoch ausdrücklich den Standardtarif. Caching, Auslastung und Neuversuche verändern die Rechnung. In den zwei tatsächlich gelieferten Sol-Produktionslogs kosteten Text, Prüfung, Avatarentwicklung und Bilder zusammen $0,04742 und $0,05584.

Bei 1.000 vergleichbaren Geschichten wären die in der Tabelle errechneten Teilkosten etwa $58 für Sol, $122 für Sonnet, mindestens $100 für Argon und mindestens $296 für Opus. Die beiden letzten Zahlen enthalten noch keine Ersatzbilder. Nicht als Umsatzmarge oder verlässliche Prognose verstehen.

Der aktuelle Serienmodus stoppt weitere KI-Aufrufe bei einem gemeldeten LLM-Aufwand von $0,08 für mittlere Geschichten. Die gemessenen Sonnet- und Opus-Autorenaufrufe auf Standard lagen bereits darüber. Im Produktions-Flex-Tarif können andere Kosten entstehen; der wiederverwendete Autor wurde beim Pilot nicht auf dessen Budget angerechnet. Ein Modellwechsel wäre daher nicht ohne erneuten echten Budget- und Tariftest produktionsreif. Darüber hinaus lag Opus in beiden Low-Proben mit 8.516 und 9.839 Ausgabetokens einschließlich Denk-Tokens über dem aktuellen Produktionslimit von 7.475; bei gleichem Verlauf würden die Ausgaben abgeschnitten.

## Schlussfolgerung

Für eine preisbewusste Standardgeschichte ist **GPT-6.1 Sol auf low** bei den hier getesteten Aufgaben die sinnvollste Wahl. Es war in der eigenen Blindlektüre knapp hinter Opus, beim Terra-Lektorat knapp davor und im konkreten vollständigen Sol-Bildlauf günstiger. Das verbesserte Verständnislektorat bleibt wichtig: Selbst die bessere Sol-Fassung hatte eine ungeklärte Bannerkontinuität.

Vor der Umstellung auf den reinen Low-Vergleich liefen bereits zwei Sol-Aufrufe auf medium. Sie kosteten als Autorenaufrufe im Mittel $0,0645 statt $0,0360 bei den beiden Low-Aufrufen. Die Medium-Texte erhielten keinen gleichwertigen vollständigen Blindvergleich; ein Qualitätsvorsprung oder dessen Fehlen lässt sich daraus nicht belegen.

Für den gesamten hier dokumentierten Vergleich sind bisher mindestens $2,56 an vom Anbieter gemeldeten Kosten angefallen, einschließlich der ersten, teilweise unvollständigen Medium-Vergleichsrunde, der acht Low-Autorentexte, der Lektorate und der vier Bildläufe. Ein abgebrochener weiterer Lektoratsaufruf könnte zusätzliche Kosten verursacht haben, die in den lokalen Ergebnissen nicht ausgewiesen sind.
