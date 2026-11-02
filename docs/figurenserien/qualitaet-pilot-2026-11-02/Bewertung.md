# Figurenwelt: Qualitäts-Pilot vom 2. November 2026

Die separate Qualitätsvariante ist implementiert. Die drei Texte sind gut, die illustrierten Bücher erreichen die Freigabe noch nicht. Einen enormen Gesamtgewinn oder einen gesicherten Aufpreis von nur 3–6 Cent belegt dieser Pilot nicht.

## Ergebnis der drei Geschichten

| Geschichte | Text, redaktionell | Freigegebene Bilder | API-Kosten des Abschlusslaufs |
|---|---:|---:|---:|
| Die Aufräummaschine hat Hunger | 8/10 | 1 von 7 | 0,08537 USD |
| Ein Seehund auf dem Kapitänssitz | 8,5/10 | 3 von 7 | 0,08057 USD |
| Ein Drache passt da durch | 8/10 | 2 von 7 | 0,08802 USD |

Keines der drei illustrierten Bücher hat die vollständige Freigabe erreicht.

Die Textnoten sind meine redaktionelle Einschätzung nach vollständiger Lektüre, keine objektiven Messwerte. Es gab keinen verblindeten Vergleich mit drei parallel erzeugten Standardfassungen. Die Bildzahlen geben die automatische Freigabe nach Einzelprüfung und gemeinsamer Buchprüfung wieder; Kontaktbögen wurden zusätzlich visuell kontrolliert.

- **Tilda, 8/10:** Eigenwillige Stimmen, verständlicher Stolz als Ursache des Fehlversuchs, ein konkretes emotionales Motiv für Bens Teddy. „Er verliert innen“ und der aufgegessene Vorführzettel funktionieren besonders gut. Die Rettung ist stellenweise zu kleinteilig; viele einzelne Satzabsätze erzeugen einen abgehackten Rhythmus. [Text](tilda-tueftel.md) · [Bildversuche](tilda-tueftel-bilder.jpg).
- **Kapitän Blubbert, 8,5/10:** Der Kapitän gibt seinen Vorführplan aus nachvollziehbarem Grund auf. Ben bekommt eigene Beobachtungen und trockene Pointen; die Mutter des Seehunds liefert eine klare Handlungsrichtung. Die Sicherheitsabsprachen nehmen etwas Tempo heraus. In den Bildern werden Figuren verdoppelt oder Gesichtszüge übertragen; zudem widersprechen Noras Schuhe dem Stiefelgag. [Text](kapitaen-blubbert.md) · [Bildversuche](kapitaen-blubbert-bilder.jpg).
- **Funkelflug, 8/10:** Die tatsächliche Stärke des kleinen Drachen löst den Konflikt; die gemeinsame Enttäuschung über das Fliegen trägt die Emotion. Das Lektorat verbessert den Übergang vom Glockenschlag zum Serienausblick. Die mechanische Rettung dauert lange. In den Bildern wechseln Form und Lage der Holzplatte; Ben trägt entgegen dem Text weiterhin seinen Rucksack. [Text](funkelflug.md) · [Bildversuche](funkelflug-bilder.jpg).

Über alle drei Texte fällt dieselbe Grundbewegung auf: Eine Figur möchte beeindrucken, ein kleinerer Gast beobachtet genauer, die Figur gesteht ihre Grenze ein. Innerhalb einer Folge funktioniert das; für Vielfalt über viele Folgen braucht es weiterhin andere Konfliktmuster. Ein stärkerer Prüfer allein behebt diese Ähnlichkeit nicht.

## Was sich tatsächlich verbessert hat

Sol schreibt und überarbeitet mit mittlerem Denkaufwand. Flash prüft den Text mit kompakten, für diese Folge relevanten Vorgaben und maximal zwei belegten Kritikpunkten. Starke Originalzeilen werden erhalten; Änderungen werden erneut geprüft. Die beobachteten lokalen Textverbesserungen sind eher klein als revolutionär.

Bei Bildern sind zwei Varianten, echte zentrale Objektreferenzen, selektive Terra-Vergleiche und eine gemeinsame Konsistenzprüfung hinzugekommen. Der Gewinn liegt bisher vor allem darin, schlechte Bilder zuverlässiger zurückzuhalten. Die Generierung produziert weiterhin echte Fehler: wechselnde Maschinenbauformen, doppelte Teddys, zusätzliche Tiere und vermischte Figurenmerkmale. Mehr Varianten liefern deshalb noch kein zuverlässig vollständiges gutes Buch.

Die bestehende Figurenwelt bleibt der Standard. Die neue Variante ist eine ausdrücklich experimentelle Admin-Option und verwendet denselben Folgenfortschritt. Teilweise illustrierte Ergebnisse bleiben lesbar und werden als nicht freigabefähig markiert.

## Flash oder Sonnet als Textprüfer?

Für diesen Versuch ist **Gemini 3.8 Flash die sinnvollere Budgetwahl**. Beim begrenzten Vergleich am selben Tilda-Manuskript kostete eine erfolgreiche Flash-Prüfung **0,003903 USD**, Sonnet 5.5 **0,01989 USD**: rund **80 % weniger**. Das ist ein Einzelvergleich mit den tatsächlich zurückgegebenen Providerkosten, kein allgemeiner Preis- oder Leistungsbenchmark.

Sonnet erfand dabei eine Einschränkung, nach der das Pedal nur vorwärts funktionieren dürfe. Flash wollte in einem frühen Entwicklungslauf einen bewusst vorgesehenen Serienhinweis entfernen. Die Vorgaben wurden daraufhin präzisiert. Das zeigt, warum beide Prüfer Belege und begrenzte Änderungen brauchen. Eine allgemein höhere Trefferquote von Flash ist damit nicht nachgewiesen.

## Kosten und Grenzen

Die drei Abschlussläufe kosteten zusammen **0,25396 USD**, also durchschnittlich **8,47 US-Cent pro Geschichte**, zusätzlich zum Codex-Kontingent. Davon entfielen 0,09763 USD auf Bilder, 0,08237 USD auf Luna, 0,05292 USD auf Terra und 0,02105 USD auf Flash.

Die Entwicklungs- und Vergleichsläufe kosteten weitere **0,07910 USD**. Insgesamt wurden **0,33306 USD**, rund **33,31 US-Cent**, als API-Kosten gemeldet. Diese Gesamtsumme enthält die fehlgeschlagene erste Flash-Antwort und den Sonnet-Vergleich.

Sol-Autorentwürfe und lokale Überarbeitungen liefen überwiegend über das angemeldete Codex-Kontingent. Im ersten Entwicklungslauf nutzten auch Bildprüfer dieses Kontingent; später wurden die vielen kleinen Prüfungen auf die API umgestellt. Kontingentverbrauch ist in den Dollarbeträgen nicht bepreist und keine kostenlose Inferenz. Im Produktionsbetrieb würden diese Modellaufrufe ebenfalls Kosten verursachen.

Die Journale zählen zurückgemeldete Kosten einschließlich abgebrochener, aber bereits abgerechneter Antworten. Bei einer unterbrochenen Verbindung vor der Nutzungsabrechnung kann eine zusätzliche unbekannte Belastung verbleiben. Es wurden keine Produktionsgeschichten oder Datenbankänderungen angelegt. Die drei lokalen Versuche testen keine Mehrfolgenkontinuität und ersetzen keinen kontrollierten A/B-Vergleich. Ein exakter Mehrpreis gegenüber dem Standardverfahren lässt sich daraus nicht berechnen.

## Technische Prüfung und nächster Schritt

207 Tests bestanden, kein Test fehlgeschlagen; der Frontend-Produktionsbuild war erfolgreich. Die projektweiten Typechecks melden bestehende Fehler außerhalb dieser Änderung. Die Encore-Clientgenerierung scheiterte am lokalen Windows-Daemon; der vorhandene Frontendclient importiert den Konfigurationstyp bereits direkt aus dem Backend.

Vor einer allgemeinen Freigabe müssen zentrale Objektdesigns samt Zustand über die Bilder stabil bleiben, komplexe Mehrfigurenaktionen einfacher inszeniert und vermischte Identitäten vermieden werden. Weitere pauschale Wiederholungen desselben Bildprompts rechtfertigt dieser Pilot nicht. Erst danach sind ein gepaarter Standard/Qualitäts-Vergleich und eine vollständig über API abgerechnete Kostenmessung sinnvoll.

[Maschinenlesbare Messwerte](messwerte.json). Die lokalen vollständigen Lesefassungen und Rohantworten liegen unter `output/figurenwelt-quality-final-2026-11-02/`; die dortige `index.html` verlinkt alle drei Geschichten. Das lokale Ausgabeordnerarchiv wird wegen Umfang und temporärer Providerantworten nicht mitgepusht; Texte, Kontaktbögen und aggregierte Messwerte sind hier versioniert.
