# Wunder-Testgeschichten · 19. Oktober 2026

Diese Texte wurden mit der tatsächlichen neuen Pipeline und fiktiven Avataren erzeugt. Die Kapitel wurden für diese Ablage nicht nachträglich von Hand umgeschrieben. Die Grundkonzepte und das Referenzmanuskript sind eigene redaktionelle Beispiele.

| Geschichte | Konfiguration | Umfang | Ergebnis |
| --- | --- | ---: | --- |
| [Tschüss, die Party fängt an!](tschuess-die-party-faengt-an.md) | 6–8, kurz, Alltag ohne Magie, viel Humor | 1.134 Wörter | Vollständige Vorlage auf Nora und Ben adaptiert; Sol 6.1 schreibt, Gemini liest; Entwurf angenommen. |
| [Bitte nicht an den Regenbogen lehnen](bitte-nicht-an-den-regenbogen-lehnen.md) | 6–8, kurz, Magie, viel Humor | 1.163 Wörter | Sol 6.1 schreibt, Gemini liest; Entwurf angenommen. |
| [Bitte nicht durch die Wäsche!](bitte-nicht-durch-die-waesche.md) | 6–8, mittel, Magie, viel Humor | 2.035 Wörter | Plan aus Codex, Manuskript über OpenRouter; nach verschärftem Lektorat von 2.122 Wörtern gezielt gestrafft. Ein weiterer Straffungshinweis bleibt offen. |
| [Die Decke sagt noch etwas](die-decke-sagt-noch-etwas.md) | 3–5, kurz, leise Einschlafgeschichte | 492 Wörter | Über Codex erzeugt und überarbeitet; letzte Prüfung mit Gemini über OpenRouter. |
| [Bitte den Regenbogen rückwärts](bitte-den-regenbogen-rueckwaerts.md) | 6–8, mittel, weiterer Lauf derselben Konfiguration | 2.034 Wörter | Vollständiger OpenRouter-Lauf mit Plan, Lektorat und Überarbeitung; ein weicher Verständlichkeitshinweis bleibt. |

Meine redaktionelle Einschätzung: **Die Party** ist die überzeugendste Demonstration der Vorlagen-Adaption. Der zentrale Konflikt entsteht aus Noras Planung und Bens Wunsch, mitzubestimmen. Die Gäste dürfen eigene Wünsche äußern, und der Schluss greift den Anfang komisch wieder auf. Einige Nebenfiguren sprechen noch ähnlich trocken.

**Die Regenbogengeschichten** besitzen einen sofortigen Einstieg, visuelle Komik und brauchbare Dialoge. Die kurze Fassung ist straffer. Die längere hat schöne ruhige Momente und das Unterhosenmotiv, erklärt ihre Mechanik aber recht ausführlich. Nach der Überarbeitung fand das Lektorat noch eine repetitive Reparaturfolge in Kapitel 3. Der Bogen bleibt eher ein Hofabenteuer als die große Eskalation der Schwerkraft-Geschichte. Die Texte sind deshalb ein Fortschritt zum Weiterprüfen, kein Beweis, dass dieses literarische Ziel schon bei jeder Generierung erreicht wird.

**Die Decke** erfüllt einen anderen Zweck: wiederkehrende leise Laute und ein körperlich spürbares, geborgenes Ende. Sie zeigt, dass die neue Pipeline einen ruhigen Wizard-Wunsch nicht mit künstlichem Zeitdruck und lauten Witzen überschreibt.

## Was die Tests tatsächlich zeigen

- 83 automatisierte Tests bestanden, einschließlich der vorhandenen Bild- und Freigaberegressionen; 328 Assertions.
- Frontend-Produktionsbuild bestanden. Browserprüfung der echten Auswahlkomponente bei 320/390/1280 Pixeln, Tastatur, reduzierter Bewegung und Dunkelmodus bestanden.
- Die kurzen vollständigen OpenRouter-Textläufe benötigten hier ungefähr vier Minuten und jeweils rund 0,09–0,10 US-Dollar. Das sind einzelne Messungen ohne Bilder, keine Preis- oder Zeitgarantie.
- Die lange Fassung und die Einschlafgeschichte verwenden gespeicherte Codex-Schritte. Die Kosten ihrer Wiederaufnahme sind deshalb **keine** vollständigen API-Preise der Pipeline.
- Der erste Schattentheater-Plan wurde wegen unzureichender Abenteuerwirkung abgewiesen. Ein Drachenpilot blieb vor seiner letzten Prüfung am erschöpften Codex-Kontingent stehen. Er wird nicht als bestandener Test gezählt. Die Vorlagenauswahl wurde anschließend nach Spannung eingeschränkt.
- Ein anfänglich unkritisches Gemini-Lektorat übersah die Wiederholungen der langen Regenbogengeschichte. Nach dem konkreteren Prüfauftrag fand es die Passage und löste eine Überarbeitung aus. Auch dieses Ergebnis bleibt eine Modellbewertung.
- Es gab keinen verblindeten Vergleich gegen die bisherige Talea-Pipeline und keinen Lesertest mit Kindern. Ein automatisches „besser als die Schwerkraft-Geschichte“ wäre unbelegt.

Alle Rohaufträge, Antworten und fehlgeschlagenen Versuche bleiben lokal unter `Logs/wonder-story/` erhalten. `bun scripts/wonder-story/report.ts` zählt tatsächliche neue API-Aufrufe und erfolgreiche Codex-Aufrufe getrennt; wiederverwendete Antworten werden nicht doppelt berechnet.

Abschlussstand: **20 erfolgreiche Sol-6.1-Aufrufe über das Codex-Kontingent** (519.727 Eingabe- und 43.396 Ausgabetokens laut CLI, einschließlich des CLI-Kontexts). Nach Erreichen der Kontingentgrenze ergänzten **22 OpenRouter-Aufrufe für zusammen 0,514942 US-Dollar** die Versuche und Wiederaufnahmen. Für alle 22 liegt eine Anbieter-Kostenangabe vor. Fünf verschiedene fertige Manuskripte wurden abgelegt; die zusätzliche Überarbeitung von „Bitte nicht durch die Wäsche!“ zählt nicht als sechste Geschichte. Das Codex-Kontingent ist keine kostenlose API-Nutzung.

Die [Pipeline-Dokumentation](../../wonder-story-pipeline.md) erklärt Auswahl, Funktionsweise, eigene Vorlagen, lokale Codex-Tests, Kostenbegrenzung und technische Grenzen. Noch kein Deployment; die Bild- und Avataranbindung wurde nicht mit einem kostenpflichtigen Produktionslauf getestet.
