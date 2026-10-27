# Pipelinevergleich: Ergebnis und Stand der Zusammenführung

Die Modellläufe sind auf Wunsch wegen des knappen Kontingents beendet. Die folgenden Noten stammen aus anonymen Bewertungen durch Sol 6.1 und Luna mit einem gemeinsamen Raster. Sol schrieb die Geschichten, Luna übernahm Planungs- und Prüfrollen. Es wurden keine Bilder erzeugt.

| Auswahlweg | Mittelwert /10 | Ergebnis |
|---|---:|---|
| Talea-Folge | **7,90** | Vollständige Geschichte; beste Bewertung in diesem Test |
| Bilderbuch | 7,40 | Vollständige Geschichte |
| Kapitelbuch | 7,35 | Vollständiger Band: 8 Kapitel, 7.621 Wörter |
| Developer | 7,30 | Vollständiger Text mit internen Qualitätswarnungen |
| Buchwerkstatt | 6,70 | Vollständige Geschichte |
| Geschichte | 6,50 | Vollständiger Text mit internen Qualitätswarnungen |
| Wunder & Witz | — | Planprüfung nach zwei Überarbeitungen abgebrochen; kein fertiger Text |

Je Auswahlweg wurde ein Fall ausgeführt. Kleine Notenunterschiede sind damit keine belastbare Rangfolge. Die Bewertungen sind Modellurteile; beide Prüfer gehören derselben Modellfamilie an. Die genaue Methode, Transportabweichungen und Rohbewertungen stehen im [Vergleichsbericht](README.md).

## Empfohlene gemeinsame Pipeline

Talea-Folge bietet in diesem Vergleich die stärkste Grundlage. Folgende Bausteine sollen zusammenarbeiten:

1. **Figuren und Familienkontext:** Eigener Wunsch, Angst, Stimme und komischer Widerspruch der ausgewählten Hauptfigur; eigenständige Beiträge der Avatare. Erinnerungen und mitgebrachte Artefakte bleiben verbindlich.
2. **Idee und zusammenhängender Entwurf:** Sol plant und schreibt die kurze Geschichte in einem Autorenaufruf. Die Figurenentscheidungen treiben die Handlung.
3. **Formatbudget:** Bilderbuchseiten, Vorlesekapitel und längere Bände bekommen ihren eigenen Platz und Rhythmus. Wiederholungen, Erwachsene und Fristen entstehen aus der Geschichte und werden nicht pauschal erzwungen.
4. **Prüfung am fertigen Text:** Verständnis, Wunderregel ab dem ersten passenden Ereignis, Aufenthaltsorte, Besitz, Wissen und eingelöste Versprechen. Konkrete Befunde brauchen überprüfbare Textbelege.
5. **Begrenzte Überarbeitung:** Derselbe Autor repariert belegte Fehler. Figuren, Grundregel und starke Zeilen bleiben erhalten. Die neue Fassung wird erneut gelesen; ein fehlgeschlagener Reparaturaufruf vernichtet den bisherigen Entwurf nicht.
6. **Kontinuität längerer Bücher:** Das Logbuch entsteht aus den tatsächlich veröffentlichten Kapiteln und bindet die folgenden Schreibabschnitte.

Das verbindet Figurenführung und Stimme der Talea-Folge, Kausalität aus Wunder & Witz, das Seitengefühl des Bilderbuchs, den kleinen verbindlichen Plan und die Verständnisprüfung der Buchwerkstatt, den Kontinuitätsschutz des Kapitelbuchs sowie die Produktfunktionen des normalen Wegs. Die formalen Prüfungen des Developer-Kerns bleiben als technische Absicherung nützlich. Seine langen Schleifen auf eine intern behauptete Zielnote sind kein Beleg für bessere Literatur.

## Implementierter Kandidat und offene Arbeit

Unter `backend/story/unified/` liegen die gemeinsamen Prompts, Textprüfung und begrenzte Reparatur als isolierter Kandidat. Der [gesicherte Erstentwurf „Der Hut voller Sieger“](unified-entwurf.md) stammt aus dem bereits abgeschlossenen Sol-Aufruf. Er wurde lokal aus der gespeicherten Antwort rekonstruiert; dafür gab es **keinen neuen Modellaufruf**.

Die Textprüfung meldete eine mögliche Unstimmigkeit beim ausgesprochenen Auslösesatz der Wunderregel. Der anschließende Autorenaufruf scheiterte mit HTTP 429. Die Überarbeitung und die unabhängige Schlussbewertung fehlen. Der Kandidat hat daher **keine belastbare Abschlussnote und ist nicht als bessere finale Pipeline freigegeben**. Die zusätzlichen Kandidatentests für Bilderbuch und Einschlafgeschichte wurden nicht mehr gestartet. Der Buchadapter ist ebenfalls experimentell und noch nicht angeschlossen.

Die Zusammenführung ist damit vorbereitet, aber noch nicht abgeschlossen. Vor einer gemeinsamen Produktionspipeline fehlen die fertige Reparatur, die Vergleichsbewertung und die Formatprüfungen. Es wurden keine Erzeugungsrouten umgeschaltet. Die automatische Freigabeprüfung lehnte die versuchte breite Standardaktivierung ab, weil sie alle neuen Geschichten und Kapitelbücher beträfe und dafür keine ausdrückliche Aktivierungsfreigabe vorlag. Das Opt-in des isolierten Kandidaten ist standardmäßig aus.

## Lokale Prüfung

36 Tests der Talea-Folge und des gemeinsamen Kandidaten bestanden. Die beiden Kandidatenmodule lassen sich mit Bun bündeln. Der vollständige Projekt-Typecheck meldet bestehende Fehler; die Bundles ersetzen keine vollständige Produktions- oder Datenbankprüfung.

Die bisherigen Testtexte und Bewertungen sind über den [Vergleichsbericht](README.md) erreichbar. Die Rohantworten, Eingaben und Ereignisse bleiben unter `Logs/pipeline-bakeoff/2026-10-26` erhalten. Für eine spätere Fortsetzung können vollständig gespeicherte, exakt passende Antworten wiederverwendet werden. `--offline` sperrt neue Modellaufrufe im Testtransport.
