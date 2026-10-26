# Test der tatsächlichen Talea-Folge vom 26. Oktober 2026

**Aktuelle Qualitätsprüfung:** Die Rollensteuerung wurde inzwischen mit dem überarbeiteten Pool in fünf Vorher-/Nachher-Paaren getestet, einschließlich zwei zusätzlicher Test-Seeds. Der [neue Testbericht](C:/MyProjects/Talea/talea-storytelling-platform/docs/story-examples/talea-folge-rollen-2026-10-26/README.md) enthält die Ergebnisse und alle Geschichten. Die folgenden älteren Noten betreffen andere Fälle und eine andere Rubrik.

**Späterer Stand:** Die nachfolgend beschriebene Hörprüfungsvariante wurde zurückgenommen. Anschließend wurde auf Wunsch des Nutzers eine gesonderte Rollenwahl für Pool-Hauptfiguren bei `avatarIsHero: false` lokal umgesetzt und mit Testantworten geprüft. Die Storynoten unten bewerten diese neue Rollenwahl nicht. Siehe [Figurenpool-Überarbeitung](C:/MyProjects/Talea/talea-storytelling-platform/exports/character-pool/2026-10-26/AENDERUNGEN.md).

Getestet wurde der Textkern von **`talea-folge-v1`**, auf den die Kachel **Talea-Folge** verweist: `runEpisodeTextEngine`, mit den echten Vorlagen und der Längenvorgabe der Episode-Pipeline. Dieser Bericht ersetzt keine angemeldete Prüfung des gesamten Produktionsablaufs. Bilder, Datenbankänderungen und Avatarentwicklungen wurden nicht ausgeführt.

Der Autor war **gpt-6.1-sol**, die getrennten Modelllektorate waren **gpt-6-luna** und **gpt-6.1-sol**. Die Aufrufe liefen über das angemeldete Codex-Kontingent; es gab keinen bezahlten API-Ersatz und keine Bilderzeugung. Das verbraucht Codex-Kontingent. Die zwei Fälle nutzten fiktive Avatare Nora/Ben und Bo Bücherfuchs als festen Testkandidaten; sie testen nicht die Qualität oder Auswahl des gesamten Live-Pools.

| Fall | Luna / 10 | Sol 6.1 / 10 | Mittel / 10 |
| --- | ---: | ---: | ---: |
| Magie, Ausgang: „Die Siegerin hängt fest“ | 7,25 | 7,90 | 7,58 |
| Magie, Versuch: „Die viel zu lange Siegerbank“ | 6,70 | 7,40 | 7,05 |
| Einschlafen, Ausgang: „Die Decke bis zur Tür“ | 6,95 | 7,70 | 7,33 |
| Einschlafen, Versuch: „Ein Buch im Stiefel“ | 6,80 | 6,85 | 6,83 |

Die Ausgangsläufe liegen im Mittel bei **7,45/10**, der Versuch bei **6,94/10**. Die zusätzliche stille Prüfung auf Wiederholung, räumliche Verständlichkeit und Titelversprechen hat hier **keine Verbesserung** gebracht und wurde aus dem Produktionsprompt wieder entfernt. Es gibt aus diesem Versuch keinen belegten Qualitätsgewinn und keine verbliebene Optimierung des Episode-Produktionsprompts. An der normalen Geschichte-Pipeline bleibt ebenfalls keine Produktionsänderung aus diesen Versuchen bestehen.

[Magie: Ausgangsgeschichte](magie-vorher.md) · [Magie: Versuch](magie-versuch.md) · [Einschlafen: Ausgangsgeschichte](einschlafen-vorher.md) · [Einschlafen: Versuch](einschlafen-versuch.md)

Alle vier Fassungen sind automatisch erzeugt; keine redaktionell umgeschriebene Fassung wurde als Pipelineergebnis ausgegeben. Pro Geschichte wurde ein erfolgreicher Autorenaufruf benötigt. Die Ausgangstexte umfassen 1.193 beziehungsweise 473 Wörter, die Versuchstexte 1.124 beziehungsweise 477 Wörter. Die Episode-Prüfungen meldeten bei allen vier Fassungen keine harten oder weichen Fehler. Die 19 vorhandenen Episode-Tests bestanden auch mit dem Versuch; das allein sagt wenig über literarische Qualität aus.

Die Bewertungsrubrik blieb gleich: Verständlichkeit/Kausalität 20 %, Handlungsmacht 15 %, Figuren/Dialog 15 %, Gefühl 10 %, Humor 10 %, Tempo/Spannung 10 %, Sprache/Vorlesen 10 %, Originalität/Auflösung 10 %. Die Nachkommastellen ergeben sich aus der Gewichtung und drücken keine entsprechende Messgenauigkeit aus. Zwei Fälle mit je einer Ausgabe sind eine kleine Stichprobe; beide Lektorate gehören derselben Modellfamilie an. Es wurden keine Kinder oder menschlichen Testleser befragt. Einige Lektoratsbelege wurden nicht exakt im Text gefunden; Einzelkritik wurde deshalb nicht ungeprüft übernommen.

Stärken der Ausgangstexte sind unterscheidbare Stimmen, anschauliche komische Situationen und ein warmes Ende. Schwächen sind wiederholte Versuche ohne genug neue Entwicklung, einzelne unklare Bewegungen und beim Einschlaftext das nicht eingelöste Tür-Versprechen im Titel. Der Versuch verschob das Geschehen, löste diese Probleme aber nicht zuverlässig. Im Magieversuch erklärt der Helfer die Lösung zu direkt und die Wunderregel bekommt zusätzliche Mechanik.

Die aktuellen Rollen- und Poolfragen sollten gesondert untersucht werden. Die Texte dieses Vergleichs sind kein A/B-Test „Poolfigur als Hauptfigur gegen Avatar als Hauptfigur“. Dass die Ausgangsgeschichten stärker abschneiden, bestätigt oder widerlegt diese Hypothese nicht.

Belege: `Logs/episode-quota/2026-10-26-magic-baseline`, `2026-10-26-bedtime-baseline`, `2026-10-26-magic-listener-pass`, `2026-10-26-bedtime-listener-pass`; zu jedem liegt ein Ordner mit der Endung `-review` vor. Die Manifeste enthalten Pipeline, Modell, Transport und Nullwerte für Bilder/Datenbankaufrufe. Der Testläufer ist `scripts/episode/quota-test.ts`.

Beispiel für einen neuen Kontingentlauf, der erneut Kontingent verbraucht:

```powershell
bun scripts/episode/quota-test.ts --case magic --length short --out Logs/episode-quota/neuer-lauf
```

Der ältere Bericht `docs/story-examples/quality-2026-10-25/README.md` betrifft ausdrücklich die normale Geschichte-Pipeline. Seine Noten gehören nicht zur Talea-Folge.
