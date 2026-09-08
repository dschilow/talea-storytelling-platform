# Buchwerkstatt: Stabilitätsprüfung vom 8. September 2026

Der Log `logs.1788855449255.log` zeigt einen Abbruch nach 0,00945015 USD: Der Text hatte 991 statt 480–760 Wörter, ein gewöhnlicher Gegenstand wurde als Katalog-Artefakt markiert und ein Lösungsbeleg war nicht im Text auffindbar. Die geplante Überarbeitung scheiterte an einer überhöhten Budgetvorhersage.

Die alte Rechnung enthielt das Manuskript bereits im Prüfprompt, addierte es nochmals und rechnete zusätzlich `writerTokens * 8` als Eingabe hinzu. Die Vorhersage verwendet jetzt den tatsächlichen aktuellen Prüfprompt genau einmal. Vor jedem bezahlten Folgeaufruf wird dessen tatsächliche Eingabe erneut gegen das verbleibende Budget geprüft. Der Umfang einer noch nicht erzeugten Überarbeitung bleibt eine Vorhersage, keine bekannte Tokenzahl.

Weitere Korrekturen:

- Explizites Gesamtziel und Wortziel pro Seite sowie vollständige Seitenvorlage.
- `artifactVisible` bezeichnet nur das gewählte Katalog-Artefakt. Bei keinem gewählten Artefakt wird dieses reine Bildreferenzkennzeichen auf `false` gesetzt; die Prosa bleibt unverändert.
- Hauptfiguren werden nicht zusätzlich als Nebenfiguren gezählt. Unbekannte Figuren-IDs bleiben ein Fehler.
- Zitatnachweise tolerieren unterschiedliche Anführungszeichen, aber weder veränderte Wörter noch falsche Seiten.
- Humor 3/5 wird nach einer geprüften Überarbeitung als redaktioneller Hinweis behalten. Er verwirft allein keine sonst verständliche Geschichte. Humor 1–2, Verständnisfehler, fehlende Belege und Logikblocker verhindern weiterhin die Freigabe. Das ist eine bewusste Änderung der Freigaberegel, keine Behauptung besserer literarischer Qualität.

## Echte Text-Testläufe

Modelle unverändert: `openai/gpt-5.6-luna` und `google/gemini-3.1-flash-lite`. Keine Bilder und keine Änderungen an Nutzerdaten.

| Fall | Ergebnis | Wörter | Aufrufe | Vom Anbieter gemeldete Textkosten |
|---|---|---:|---:|---:|
| Ausgangsstand, Beispiel ohne Artefakt | Abbruch an der Budgetvorhersage | 1.359 | 3 | 0,00890255 USD |
| Zwischenstand | Abbruch allein wegen Humor 3/5 nach Überarbeitung | — | 5 | 0,01252055 USD |
| Korrigierter Textlauf ohne Artefakt | Freigegeben, Humorhinweis bleibt | 627 | 5 | 0,01215445 USD |
| Synthetischer Artefaktfall, erster Versuch | Hauptfiguren fälschlich als Nebenfiguren eingeordnet | — | 1 | 0,00197325 USD |
| Korrigierter synthetischer Artefaktfall | Freigegeben, Humorhinweis bleibt | 652 | 5 | 0,01217030 USD |

Gesamtkosten dieser fünf Diagnose-Textläufe: **0,04772110 USD**. Die beiden freigegebenen Läufe kosteten jeweils rund **1,22 US-Cent**. Beide hatten eine Überarbeitung und eine erneute Prüfung. Die Ergebnisse und Texte liegen lokal unter `Logs/book-workshop-live-2026-09-08/`.

55 Regressionstests bestehen. Der Backend-Typecheck zeigt dieselben 52 vorhandenen Diagnosen wie der unveränderte Stand, ohne neue Fehler.

Zwei erfolgreiche Textläufe belegen keine allgemeine Ausfallsicherheit oder Kinderbuchqualität. Produktionsdatenbank, Veröffentlichung, Bilder und Serverneustarts wurden in diesen Live-Tests nicht ausgeführt. Es wurde nichts deployed. Der geplante Live-Test mit einem Nutzerexport wurde von der automatischen Freigabeprüfung blockiert; der zweite Fall verwendet daher ausschließlich erfundene Figuren und ein erfundenes Artefakt.
