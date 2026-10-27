# Einordnung des Rollenvergleichs

**Sol als Schreiber und Terra für Planung und Prüfung ist hier der praktischste Kompromiss.** Reine Sol-Unterstützung erzielt die etwas höhere gemeinsame Blindnote, braucht aber mehr Zeit. Die Stichprobe ist klein; ein Abstand von 0,33 Punkten über zwei gemeinsam gelieferte Fälle belegt keinen stabilen allgemeinen Qualitätsvorsprung.

Alle Schreib- und Überarbeitungsaufrufe nutzten Sol 6.1 Low. Die Unterstützung wechselte als Paket: Sol Low, Terra Low oder Luna Low. Es wurden keine getrennten Aussagen über „bester Planer“ und „bester Prüfer“ isoliert getestet. Die folgenden Punkte beruhen auf meiner zusätzlichen Lektüre aller acht gelieferten Texte mit bekannter Herkunft, nicht auf einer dritten Blindnote.

| Planer und interne Prüfer | Abenteuer | Märchen | Einschlafen | Mittel gemeinsamer Abenteuer-/Märchenfälle |
|---|---:|---:|---:|---:|
| Sol 6.1 Low | 7,50 | 8,05 | 7,60 | 7,78 |
| Terra 6.1 Low | 7,80 | 7,10 | 7,75 | 7,45 |
| Luna 6 Low | 7,20 | 7,45 | Abbruch | 7,33 |

Sol trägt das stärkste Märchen bei: [Das Kissen im Pferdetrog](fairytale-support-sol.md). Die anfangs eingeführten Körbe, der Gurt und der Keil werden im Finale tatsächlich gebraucht. Die Hexe muss den Siegerknopf trotzdem selbst herausgeben. Die Kinder helfen, ohne ihre Entscheidung zu ersetzen. Allerdings genehmigte der interne Sol-Prüfer alle drei Sol-Fassungen ohne größere Beanstandung. Die unabhängigen Schlusslektüren fanden trotzdem Probleme: etwa das unklare Nebeneinander von Überraschungspunkten und Zielfeld im Abenteuer. Eine interne Freigabe bedeutet also keine fehlerfreie Geschichte.

Terra liefert das bessere Abenteuer und die etwas stärker bewertete Einschlafgeschichte. In [Der Teppich mit Vorsprung](magic-support-terra.md) erkennt der Prüfer echte Unklarheiten bei Besitz, Bewegung und Zielbedingung; Sol erklärt diese in der Überarbeitung deutlicher. Es bleiben Schwächen: Nora erhöht Kichers Punktestand ein zweites Mal, obwohl der erste Versuch die Lage schon verschlimmert hatte. Das Märchen [Die Nebeltreppe](fairytale-support-terra.md) ist schwächer als Sols Märchen, besonders bei den räumlichen Wegen und der sich wiederholenden Eskalation.

Luna ist als Unterstützer sehr günstig, löst aber bei beiden gelieferten Geschichten eine zusätzliche vollständige Sol-Überarbeitung samt Nachprüfung aus. Beim Einschlafauftrag waren zunächst zwei neue Figuren statt der erlaubten einen geplant; die reguläre Reparatur enthielt dann ungültiges JSON. Der erste Plan war also nicht vollständig unlesbar. Der Abbruch entsteht aus der verletzten Vorgabe, der misslungenen Reparatur und dem fehlenden Rückfall auf den ersten Plan. Dieser Codex-Texttransport erzwingt keinen nativen JSON-/Schema-Modus. Daraus folgt keine pauschale Aussage, dass Luna keine Einschlafgeschichten planen könne.

Für den Aufwand müssen Fehlversuche mitgezählt werden. Auf tatsächlich gelieferte Geschichten umgelegt ergeben sich ungefähr **292 Sekunden und $0,2346 API-Äquivalent für Sol**, **207 Sekunden und $0,2145 für Terra**, **357 Sekunden und $0,2168 für Luna**. Luna ist damit in diesem Versuch pro gelieferter Geschichte kaum günstiger als Terra und benötigt mehr Arbeitszeit. Die Dollarwerte sind aus den gemeldeten CLI-Tokens und offiziellen Standardpreisen gerechnet, ohne Cache. Es wurden keine zusätzlichen API-Beträge abgerechnet; verbraucht wurde das Codex-Kontingent.

Meine Empfehlung für eine getrennte Rollenpipeline: **Sol schreibt, Terra plant und prüft**, sofern die etwas niedrigere gemeinsame Pilotnote zugunsten kürzerer Wartezeit akzeptabel ist. Reine Sol-Unterstützung bleibt eine Qualitätsoption. Luna würde ich erst nach Absicherung des strukturierten Planformats erneut testen.

Die bestehende One-Shot-Variante mit Sol bleibt zugleich eine starke Ausgangsbasis: Im vorherigen Versuch erreichte sie 7,87/10 bei etwa 173 Sekunden und $0,0956 CLI-basiertem API-Äquivalent. Dieser ältere Blindvergleich ist nicht direkt mit dem neuen gleichzusetzen. Der aktuelle Versuch liefert jedenfalls keinen belastbaren Nachweis, dass eine aufwendigere Rollenpipeline die zusätzlichen Aufrufe rechtfertigt.

[Vollständiger Versuchsbericht mit allen Geschichten, Kostenquellen und tatsächlichen Modellaufrufen](README.md).
