# Der Weg macht Kringel: Text- und Bildprüfung

27. Oktober 2026. Grundlage: die vollständig gelesene Nutzer-PDF mit 16 Seiten und sieben Illustrationen sowie der zugehörige JSON-Logexport. Seitenangaben beziehen sich auf die PDF-Seite einschließlich Cover, nicht auf die gedruckte Seitenzahl. Die Bewertung ist eine redaktionelle Sichtprüfung durch Codex, keine verblindete Messung.

## Text: 8/10

Die Geschichte trägt: Alexanders Ungeduld verursacht die Umwege, Adrian hilft mit konkreten Einfällen, und das Ende belohnt eine veränderte Wahrnehmung. Dass die Honigglocke nach unten aufgeht, ist ein gutes Bilderbuchmotiv. Die sieben Tassen werden vorher eingeführt. Der Blatthut, der Kürbis als Fahrgast und der letzte Satz bilden einen gelungenen komischen Bogen. Schlurfos Bemerkung über den verpassten ersten Stern gibt der Figur eine leise, eigene Seite.

Am meisten stört der Vorleserhythmus. Alexander beziehungsweise Alexanders kommt im extrahierten Kapiteltext 84-mal vor. Die Zahl allein ist kein Qualitätskriterium; auffällig sind direkte Häufungen wie auf PDF-Seite 11: „Alexander schaute auf die Schuhe. Dann hob Alexander einen Fuß. Ganz langsam setzte Alexander ihn wieder ab.“ Eine kleine Glättung reicht: „Alexander schaute auf seine Schuhe. Dann hob er einen Fuß und setzte ihn ganz langsam wieder ab.“ Namen bleiben dort nötig, wo zwei mögliche Handelnde tatsächlich Verwechslungen erzeugen.

Auf derselben Seite erklärt der Rückblick auf Erdbeere, Brett und Schmetterling die Erkenntnis zusätzlich, obwohl Alexanders langsamer Schritt sie bereits zeigt. Hier darf die Handlung mehr tragen. Die Aussage „Ich will trotzdem rennen“ sollte bleiben: Sie macht den inneren Konflikt verständlich, ohne ihn zu predigen.

Bei den Requisiten fehlt ein kleiner Übergang: Das abgelegte Kohlblatt taucht später auf dem Schubkarrenrand auf. Ein kurzer sichtbarer Ortswechsel würde die Kontinuität sichern. Die räumliche Reichweite des Weges unter dem Brett könnte vor dem Versuch beiläufig erkennbar werden.

Die Schubkarrenlösung ist dagegen kein Logikfehler: Adrian geht langsam, und der Ansatz funktioniert, bis Alexander wieder losspringt. Eine Geschichte über Selbstbeherrschung darf ihre Regel früh verraten. Das Problem ist, sie einzuhalten. Deshalb wird die Überarbeitung nicht darauf getrimmt, künstlich weitere Hindernisse oder neue Regeln einzuführen.

## Bilder: 6,5/10 insgesamt

Der Stil allein verdient etwa 8,5/10: warme Gouachewirkung, freundliche Gesichter, gute Farben und ein wiedererkennbarer moderner Bilderbuchcharakter. Der gewünschte Talea-Originals-Stil bleibt bestehen. Die Texttreue liegt deutlich darunter, ungefähr bei 5/10.

| PDF-Seite | Befund |
|---|---|
| 1, 3, 5, 7, 15 | Schlurfo wird zum aufrechten oder zusammengerollten Mooswesen. Im Text und im ursprünglichen englischen Aussehensprofil ist sein Körper der Gartenweg selbst. Das ist der größte durchgehende Fehler. |
| 7 | Alexander trägt plötzlich kurze statt langer Hosen. |
| 12 | Die Kinder ducken sich, aber das entscheidende Kohlblatt über ihnen fehlt. Die Illustration verliert den konkreten Handlungsmoment. |
| 15 | Die Tassen stehen im Blumentopf statt unter der nach unten geöffneten Blüte. Schlurfo sitzt ebenfalls im Topf. Das zentrale Schlussmotiv ist räumlich falsch. |

Die Bild-QA hat trotzdem alle sieben Buchbilder im ersten Versuch akzeptiert. Das ist keine fehlerfreie Bildserie, sondern ein nachweisbarer blinder Fleck der Prüfung: Wiedererkennung einer falschen Referenzfigur wurde mit Texttreue verwechselt. Auch Szenenwerte von 0,60 und 0,75 blieben ohne konkrete Fehlermeldung folgenlos.

## Umgesetzte Änderungen

Die Schreibanweisung erlaubt nun natürliche Pronomen bei gleichbleibendem Handelnden und verlangt Namen bei tatsächlichem Wechsel oder Mehrdeutigkeit. Sie betont sichtbare Ursachen, Requisitenkontinuität und den Verzicht auf zusätzliche Erklärungen nach einer bereits gezeigten Erkenntnis.

Das bereits aktivierte Produktionslektorat wurde im Ein-Aufruf-Modus bisher nicht ausgeführt. Jetzt liest Terra 6.1 auch diese vollständigen Manuskripte. Maximal drei Befunde benötigen konkrete Textbelege; ein wesentlicher Befund kann eine begrenzte Überarbeitung durch Sol 6.1 auslösen. Erst eine zweite erfolgreiche Prüfung übernimmt die neue Fassung. Unbelegte Kritik, ungültige Antworten und nicht behobene Probleme führen nicht zu einem erfolgreichen Prüfstatus. Sol bleibt der Autor, Terra übernimmt das Lektorat; die Flex-Einstellung wird weitergereicht.

Lebendige Wege und andere als Gelände definierte Figuren erhalten eine passende Referenzansicht. Ihr Körper bleibt die zusammenhängende Boden- oder Wasserfläche; ein Gesicht sitzt einmal in dieser Fläche. Die Auswertung eines Referenzbildes darf diese kanonische Körperform nicht mehr durch eine Beschreibung als stehendes Maskottchen ersetzen.

Die Bildregie beschreibt tragende Objekte und räumliche Beziehungen ausdrücklich. Die QA erhält eigene Felder für konkrete Szenenfehler und positive Korrekturanweisungen. Ein fehlendes Objekt über einer duckenden Figur, ein falscher Auffangort oder ein verdeckter Fallweg löst damit auch bei hohen allgemeinen Bildwerten eine gezielte Wiederholung aus. Kleine genaue Requisitenmengen werden geprüft, wenn ihre Anzahl zum Schlussmotiv gehört; dekorative Blätter und beliebige Gruppen bleiben davon ausgenommen. Die bestehende begrenzte Wiederholungsstrategie bleibt bestehen.

## Echter FLUX-3-Pilot nach der Änderung

Ein neues Schlurfo-Referenzbild, drei Szenen und eine räumlich präzisierte Wiederholung der Honigglocke wurden mit `bfl:flux@3-image-klein` generiert. Für die Szenen wurde jeweils eine einzige Referenzcollage mit beiden Kindern und Schlurfo übergeben. Porträt: 768 × 768; Szenen: 1024 × 1024; 16 Schritte. Regie und Sichtprüfung erfolgten in der Codex-Sitzung ohne zusätzliche Modell-API-Kosten.

| Aufruf | Anbieterpreis USD | Dauer einschließlich Download |
|---|---:|---:|
| Schlurfo-Referenz | 0,0012 | 3,011 s |
| Cover | 0,0025 | 7,105 s |
| Brett | 0,0025 | 5,364 s |
| Honigglocke, erster Versuch | 0,0025 | 5,013 s |
| Honigglocke, präzisierte Anordnung | 0,0025 | 5,282 s |
| Gesamt | **0,0112** | **25,775 s summierte Aufrufdauer** |

Im neuen Referenzbild sowie in Cover und Brettszene liegt das Gesicht im Weg; das Moosmaskottchen ist verschwunden. Alexander behält seine lange Hose. Die erste Honigglocke hatte noch zwei Weggesichter und einen Tropfen über dem Topf statt über den äußeren Tassen. Die präzisierte Szene korrigiert beides: Der Stiel ragt über den Topfrand hinaus, und der Tropfen fällt über den Tassen. Es sind aber weiterhin neun statt sieben Tassen sichtbar. Auch die ausdrücklich geforderten Wegschleifen werden in den Tests nicht vollständig umgesetzt. Diese Bilder sind deshalb keine pauschal bestandene Serie.

Das ist ein gezielter, nicht verblindeter Pilot mit manuell formulierter Regie, keine vollständige erneute Produktionsgenerierung und keine Ausführung der produktiven Terra-Bild-QA. Neue Referenz und Prompt wurden gemeinsam geändert. Daraus lässt sich weder eine isolierte Modellverbesserung noch eine belastbare Produktionsfehlerquote ableiten. Die vorhandene PDF und gespeicherte Geschichte wurden nicht überschrieben.

Die lokalen Rohdaten, Prompts, Referenzen und Bilder liegen unter `Logs/story-review/der-weg-macht-kringel-dd2f3935/`; `comparison.jpg` zeigt drei Originale über den neuen Versuchen. Der Ordner ist Git-ignoriert. Das optionale Wiederholungsskript ist `scripts/image-bench/kringel-regression.ts` mit den Phasen `portrait`, `scenes`, `spatial`. Es benötigt `RUNWARE_API_KEY` und lokal vorhandene Referenz-JPGs oder zwei ausdrücklich freigegebene Test-Avatar-IDs in `KRINGEL_AVATAR_IDS`; keine Zugangsdaten sind im Skript gespeichert.

## Messwerte der ursprünglichen Geschichte und Validierung

Der Export meldet 1.945 Wörter, drei Kapitel, sechs Kapitelbilder und ein Cover, 133,966 Sekunden Gesamtdauer sowie 0,088962 USD Gesamtkosten. Darin enthalten: 0,0199 USD Bildgenerierung für acht Aufrufe einschließlich Gastporträt und 0,017521 USD Bildprüfung. Die Bildprüfungskosten sind Teil der gemeldeten Text-/LLM-Kosten von 0,069062 USD und dürfen nicht nochmals zum Gesamtpreis addiert werden. Alle sieben Buchbilder erhielten `passed`, ohne Wiederholung; der Text blieb `unverified`.

Validiert mit 381 bestandenen Tests in 15 Dateien zu Folgen, Lektorat, Gastporträts, Bilderbuchgenerierung, Bildprüfung, Collagen und Bildmodelloptionen. Der vollständige Backend-Typecheck meldet weiterhin 76 Fehler außerhalb der geänderten Dateien und ist deshalb nicht grün. Die Änderungen ergänzen keine API-Schnittstelle und benötigen keine Datenmigration.
