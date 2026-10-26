# Talea-Folge: geprüfte Rollenoptimierung · 26. Oktober 2026

Der tatsächliche Textkern **talea-folge-v1** wurde mit dem überarbeiteten Figurenpool geprüft. Über fünf gepaarte Fälle bewerten Luna und Sol 6.1 die Ausgangsfassungen im Mittel mit **7,07/10**, die Fassung mit verankertem Figurenwunsch mit **7,70/10**. Das ist ein Befund dieser kleinen Stichprobe, keine Garantie für jede Geschichte.

Der Autor war in allen Läufen **gpt-6.1-sol, effort=low**. Die Lektoren liefen in frischen, getrennten Kontexten. Verwendet wurde das vom Nutzer gewünschte Codex-Kontingent. **Keine Bilder, keine Produktivdatenbank, keine manuell umgeschriebenen Ergebnisgeschichten.**

## Konkrete Änderung

Wenn die Avatare Begleiter sind, wird der im Figurenprofil gelieferte Wunsch der ausgewählten Hauptfigur ausdrücklich als Handlungsmotor eingesetzt. Die Tages-Kindersituation darf ihn zuspitzen, aber nicht durch eine beliebige Lektion oder eine neu erfundene Bindung an einen Gegenstand ersetzen. Das betrifft `backend/story/episode/cast-focus.ts` und gilt im One-shot wie im Plan-/Autorenmodus.

Anlass war die ursprüngliche Hexengeschichte: Statt des Wunsches nach einem würdigen Rätselgegner stand ein alter Umhang im Mittelpunkt. Mit der Änderung wird der neue Konflikt durch das Rätselduell und den Aufbruch ihres Gegners verursacht. Die Figur hat dadurch einen erkennbaren eigenen Antrieb.

Die Produktionskette bekommt dafür keinen weiteren Modellaufruf und keine höhere Denkstufe. Die übrige Rollensteuerung lässt die Avatare mit eigenen entscheidenden Beiträgen mitwirken. Die Änderung ist lokal umgesetzt, noch nicht veröffentlicht.

## Ergebnisse

| Fall | Luna: vorher → nachher | Sol 6.1: vorher → nachher | Mittel |
| --- | ---: | ---: | ---: |
| Erstvergleich: Kobold | 7,20 → 8,00 | 8,20 → 8,00 | **7,70 → 8,00** |
| Erstvergleich: Hexe | 7,10 → 7,80 | 7,40 → 8,40 | **7,25 → 8,10** |
| Erstvergleich: Nachtgeschichte | 6,20 → 8,00 | 7,40 → 7,10 | **6,80 → 7,55** |
| Nachprüfung: Kobold | 5,60 → 7,50 | 8,40 → 7,50 | **7,00 → 7,50** |
| Nachprüfung: Nachtgeschichte | 6,50 → 6,80 | 6,70 → 7,90 | **6,60 → 7,35** |
| Gesamt, alle fünf Paare | | | **7,07 → 7,70** |

Erstvergleich: **7,25 → 7,88** über 3 Paare.
Nachprüfung: **6,80 → 7,42** über 2 Paare.

Die Nachprüfung verwendet zwei neue Seeds nach dem Formulieren der Änderung. Der Seed steuert die Auswahl der Tagesvorgaben; er macht die Modellantworten nicht deterministisch. Innerhalb jedes Paares blieben Profile, Wünsche, Altersband, Längenvorgabe, Seed und Effort gleich. Die zweite Ausgangsgruppe wurde mit dem vorigen Prompt rekonstruiert; diese Rekonstruktion wurde gegen einen gespeicherten Erstprompt auf exakte Gleichheit geprüft.

## Geschichten zum Nachlesen

- Erstvergleich, Kobold: [vorher](ersttest-imp-vorher.md) · [nachher](ersttest-imp-nachher.md)
- Erstvergleich, Hexe: [vorher](ersttest-witch-vorher.md) · [nachher](ersttest-witch-nachher.md)
- Erstvergleich, Nachtgeschichte: [vorher](ersttest-sleep-vorher.md) · [nachher](ersttest-sleep-nachher.md)
- Nachprüfung, Kobold: [vorher](nachpruefung-imp-vorher.md) · [nachher](nachpruefung-imp-nachher.md)
- Nachprüfung, Nachtgeschichte: [vorher](nachpruefung-sleep-vorher.md) · [nachher](nachpruefung-sleep-nachher.md)
- [Avatar-Hauptrollen als Kontrollfall](kontrolle-avatar.md)

Der Avatar-Kontrollfall wurde einmal erzeugt; nach der Änderung sind System- und Nutzerprompt dieser Einstellung exakt identisch. Er wird nicht als zusätzliches unabhängiges A/B-Paar in die Gesamtnote eingerechnet.

## Kriterien

Die Rubrik wurde vor den Ausgangsläufen festgelegt: Kausalität/Regel und Handlungsmacht je 20 %, Ensemble, Stimmen/Dialog, Humor/Wunder, Tempo, Vorlesesprache und Gefühl/Auflösung je 10 %. Die frühere 7,45/10 aus dem ersten Talea-Folge-Test beruht auf anderen Fällen und einer anderen Rubrik; sie ist kein Vergleichswert für diese Tabelle.

| Kriterium | Vorher | Nachher |
| --- | ---: | ---: |
| Verständlichkeit und Wunderregel | 6,50 | 7,50 |
| Handlungsmacht der Hauptfigur | 7,00 | 7,60 |
| Beiträge der Avatare | 7,30 | 7,90 |
| Stimmen und Dialog | 7,50 | 7,80 |
| Humor und Wunder | 7,80 | 8,10 |
| Tempo und Entwicklung | 6,50 | 7,10 |
| Vorlesesprache | 7,50 | 7,90 |
| Gefühl und Auflösung | 7,10 | 8,00 |

7 der zehn gewichteten Einzelnoten stiegen, 3 fielen. Bei der zusätzlich gefragten freien Präferenz entfielen 8 Stimmen auf die neue, 2 auf die alte Fassung und 0 auf Gleichstand. Freie Präferenz und gewichtete Note können auseinandergehen; beide sind deshalb getrennt erfasst.

## Grenzen und verbleibende Schwächen

Fünf Paare und zwei Modelle derselben Familie sind keine statistische Absicherung und kein Test mit Kindern. Beide Verfahren sind subjektive Modelllektüren. Einzelne neue Fassungen können schwächer abschneiden, auch wenn der Durchschnitt steigt. Die Autorenantworten variieren trotz gleicher Vorgaben.

Die Prüfung fand 3 nicht exakt belegte Zitate. Außerdem waren einzelne Detailvorwürfe ungenau, etwa die Behauptung, der Käfer bekomme im ursprünglichen Hexentext das ganze Tor geschenkt. Solche Aussagen wurden nicht blind in Änderungen umgesetzt.

Wiederholte Befreiungsversuche, eine gelegentlich aufgesetzt wirkende Erwachsenenbegegnung und die Hand-/Gegenstandslogik bei viel Slapstick bleiben redaktionelle Prüfpunkte. Formale Fehlerfreiheit allein ist kein Beleg für eine gute Vorlesegeschichte. Langfristige Abwechslung über viele Familiengeschichten wurde hier nicht gemessen.

## Technischer Nachweis

Es gibt 10 vollständige Generierungen in den bewerteten Paaren plus die Avatar-Kontrolle. Die einzelnen Wortzahlen, Autorenaufrufe und Prüfmeldungen stehen in ergebnisse.json. Manifeste, Quellen-Snapshots, tatsächliche Modellrequests, A/B-Zuordnung, Rohlektüren und Zitatprüfung liegen unter Logs/episode-role-quality/2026-10-26/.

Ein Sol-Lektorat erhielt zunächst HTTP 429 und wurde nach einer Pause mit demselben Auftrag wiederholt. Eine begonnene Nachprüfung traf später das Codex-Kontingentlimit; nach dem Nutzerwunsch „weiter“ und wieder verfügbarer regulärer Nutzung wurde sie fortgesetzt. Es wurden weder zusätzliche Credits gekauft noch Reset-Gutschriften eingesetzt oder andere Modelle untergeschoben. Fehlgeschlagene Transporte wurden nicht literarisch bewertet.

Die Anwendung samt Datenbank, Bildern, Speicherung und Avatarentwicklungen wurde nicht als angemeldeter Live-Ablauf geprüft. Die gesonderte Importkorrektur muss vor dem Einspielen des Figurenexports bereitgestellt sein, damit bestehende Figuren-Origins erhalten bleiben.

Die lokalen Regressionstests für Episode, Storybook, Figurenimport und Origins sind separat in Logs/episode-role-quality/2026-10-26/unit-tests.log dokumentiert. Der vollständige Anwendungsbuild ist wegen der zuvor festgestellten Sandbox-Verzeichnissperren nicht bestätigt; die berührten Laufzeitdateien wurden syntaktisch geprüft.
