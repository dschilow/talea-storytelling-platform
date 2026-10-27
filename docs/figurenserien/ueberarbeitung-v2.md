# Figurenserien: Überarbeitung nach „Der Flug fällt aus“

## Erzählung und persönlicher Serienstand

Die Figurenserie besitzt einen eigenen Text- und Bildweg. „Talea-Folge“ bleibt eine eigenständige Auswahl. Die Serienhauptfigur hat einen eigenen Wunsch, eine Schwäche, Fähigkeiten, feste Begleiter und eine Welt mit Grenzen. Die Avatare lernen sie beim ersten Besuch in einer erklärten Anreise und Begegnung kennen, bevor sie gemeinsam handeln. Die erste Folge erzählt den Ursprung als Handlung.

Alle fünf Welten wurden überarbeitet. Funkelflug bekommt beispielsweise den Drachenberg, Boden- und Flugwege sowie das Rätsel der aufgegebenen Wegewarte; seine Abenteuer bestehen nicht aus immer neuen Gastgeberprüfungen. Die anderen Welten haben eigene Konfliktquellen, Regeln und vier Entwicklungsbögen. Die zwölf Konfliktansätze pro Welt sind Material zum Ausbauen, keine Garantie für vierzig fertige, gleich gute Folgen.

Das Folgenlog bleibt mit wörtlichen Textbelegen abgesichert. Zusätzlich speichert der Server begrenzten wörtlichen Zusammenhang um Ereignisse und das Ende. Nur bei der jüngsten Folge wird dieser ausführlichere Zusammenhang mitgegeben. Es gibt keinen zusätzlichen KI-Aufruf zur Zusammenfassung. Das Lektorat prüft nun auch, ob die neue Folge die gerade abgeschlossene Hauptaufgabe nur mit einem anderen Gegenstand wiederholt. Das Log bildet weiterhin nicht jedes Detail einer langen Reihe ab.

Die überarbeitete Fassung beginnt eine neue persönliche Zeitlinie. Alte Geschichten bleiben in der Bibliothek. Für Fortschritt und Reservierung berücksichtigt der Server ausschließlich die neue Version, getrennt nach Benutzer und Kinderprofil.

## Begrenzte Produktion

- Ein Sol-Schreibaufruf, ein unabhängiges Terra-Lektorat; höchstens eine belegte lokale Korrektur mit Nachprüfung. Keine Kette kompletter Neufassungen.
- Luna übernimmt Bildregie und Avatarentwicklung. Die stärkere Terra-Bildprüfung bleibt erhalten.
- Ein Landschaftsbild pro Kapitel und ein Cover, entsprechend drei bis fünf geplanten Bildern je nach Länge. Für die ganze Geschichte ist eine zusätzliche Bildkorrektur erlaubt; maximal sechs Bildversuche bei vier Kapiteln.
- Keine zusätzlichen Gastporträts, keine zufällige Poolbesetzung, kein Ersatz eines misslungenen Handlungsmoments durch ein Avatarporträt.
- Maximal zwölf LLM-Anfragen einschließlich des einzigen Wiederholungsversuchs nach einer nachweislich kostenlosen leeren Antwort oder Kapazitätsablehnung. Bezahlte fehlerhafte Antworten werden nicht automatisch wiederholt. Andere Pipelines behalten ihren bisherigen Transport.
- Neue LLM-Anfragen stoppen ab 0,08 US-Dollar gemeldeten Kosten; für lange Geschichten ab 0,12. Ein bereits gestarteter, in seiner Ausgabe begrenzter Aufruf kann die Schwelle überschreiten. Bildkosten kommen hinzu. Das ist kein garantierter Gesamtpreis.
- Fehlgeschlagene Bildprüfungen werden mit ihrem Bild und den bereits entstandenen Kosten protokolliert. Ausschließlich geprüfte Illustrationen werden gezeigt. Der geprüfte Text bleibt auch bei fehlenden Bildern lesbar; alle drei Leseransichten zeigen dann einen ausdrücklichen Hinweis. Metadaten trennen diese Textfreigabe vom unvollständigen Bildbestand. Es gibt keinen automatischen neuen Gesamtdurchlauf.

## Bilder und Datenschutz

Eine öffentliche Bruno-Illustration dient als tatsächliche Stilreferenz. Die Bildregie formuliert vollständige Szenenbeschreibungen und benennt die wesentliche sichtbare Handlung getrennt von gestalterischen Einzelheiten. Damit prüft die Bildkontrolle den Sinn des Moments und die Identitäten, ohne jede kleine Abweichung der Komposition als Handlungsausfall zu behandeln.

Ein Versuch mit einer beschnittenen Kopfvorlage wurde verworfen: Er löste die starren Posen nicht zuverlässig und konnte Körpermerkmale verlieren. Der zusätzliche Einsatz privater Avatarporträts in der externen Bildregie wurde durch die automatische Freigabe abgelehnt und nicht eingebaut. Dort werden nur die öffentliche erfundene Poolfigur und die öffentliche Originals-Stilvorlage gezeigt; Avatare werden in der Regie über vorhandene Beschreibungen berücksichtigt. Die bereits vorhandene Bildgenerierung und anschließende Identitätsprüfung verwenden ihre üblichen Referenzen.

Die Quellen für die verwendeten Modellparameter und vollständigen Bildbeschreibungen sind die [Runware-Modellreferenz](https://runware.ai/docs/models/bfl-flux-2-klein-9b) und die [FLUX-3-Kompositionsanleitung](https://runware.ai/docs/models/bfl-flux-3-image-klein/guides/multi-reference-composition). Die tatsächliche Modellentscheidung folgt dem lokalen Vergleich derselben Geschichte, nicht dem Namen oder dem Alter des Modells.

## Reproduzierbare Prüfung

`bun scripts/character-series/export.ts` exportiert die verbindlichen Konzepte nach JSON und Markdown. Die früheren Entwürfe und ihr Lektorat dokumentieren Version 1.

`bun scripts/character-series/pilot-v2.ts --dry` erstellt den aktuellen Schreibprompt ohne Modellaufruf. `--run` verwendet die realen Produktionsrollen mit erfundenen Avataren; `--images` schaltet den begrenzten Bildtest zu. Zugangsdaten kommen aus der Umgebung oder mit `--railway` ausschließlich in den Speicher des Prozesses. Keine Produktionsgeschichte oder Avatarentwicklung wird geschrieben. Man kann einen bereits geprüften Testtext und eine Bildregie ausdrücklich wiederverwenden; der Bericht trennt diese Kosten von den neuen Aufrufen.

Die Prüfungen umfassen den Begegnungseinstieg, belegte lokale Änderungen, wörtlichen Kontext, Wiederholungs- und Kostenlimits, Figurenpräsenz in Bildern, Landschaftsformat, Stilanbindung, erhaltene Kosten bei Bildfehlern sowie vier Kapitel bei langen Geschichten. Die vorhandenen Talea-Folge- und Transporttests werden mitgeprüft. Zusätzlich wurden ein echter Erstfolgen-Text, seine Fortsetzung und mehrere Bildvergleiche durchgeführt. Die lokalen Rohprotokolle enthalten die Kosten und Ablehnungen aller Testvarianten; abgelehnte Varianten werden nicht als erfolgreicher Gesamtpilot gezählt.

## Gemessenes Ergebnis

Der letzte Bildtest mit dem Produktionsmodell FLUX.2 klein 9B bestand für drei der vier geplanten Illustrationen. Die nicht bestandene Illustration zu Kapitel 2 bleibt ausgeblendet. Die akzeptierten Bilder, der neue Begegnungseinstieg und die Fortsetzung liegen in `pilot-v2/funkelflug/`; `vergleich.json` verzeichnet die Prüfberichte.

Der separat gemessene geprüfte Text kostete 0,0457465 US-Dollar. Die abschließende Bildregie, ihre Bildprüfungen und fünf Bildversuche kosteten zusammen 0,052547 US-Dollar. Zusammen sind das **0,0982935 US-Dollar**, gegenüber den **0,156457 US-Dollar** der hochgeladenen alten Produktionsgeschichte. Im neuen Vergleich fehlen Avatarentwicklung und Produktionsspeicheroperationen; es war kein einzelner authentifizierter Produktionsdurchlauf. Die früheren Entwicklungsversuche sind ebenfalls nicht Teil dieses Folgekostenvergleichs. Eine allgemeine Preisersparnis von genau 37 Prozent lässt sich daraus nicht garantieren.

Die Fortsetzung „Die Glocke hat Schluckauf“ bestand den Texttest für 0,049657 US-Dollar mit erklärtem Wiederbesuch und beibehaltenem Zustand des Weges. Sie wurde ohne Bilder getestet.

82 automatisierte Prüfungen bestehen, der Frontend-Produktionsbuild und das Backend-Bundle sind erfolgreich. Der gesamte Backend-Typecheck enthält bestehende Fehler anderer Bereiche; die geänderten Serienmodule und der Transport sind davon frei. Die lokale Encore-Clientgenerierung scheitert am Start des Encore-Daemons. Die Zeitliniennummer ist deshalb ausdrücklich eine interne persistierte Konfiguration und kein neuer auswählbarer API-Parameter; der generierte Client wird nicht von Hand verändert.
