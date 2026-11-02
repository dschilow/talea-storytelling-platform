# Sol 6.1: Low und Medium im Figurenwelt-Test

Nachträgliche Auswertung von vier Autorenentwürfen vom 30. Oktober 2026. Pro Folge erhielten beide Stufen denselben Prompt (identischer Prompt-Hash), dasselbe Modell und ein Ausgabelimit von 16.000 Tokens. Es wurden keine neuen API-Aufrufe durchgeführt. Die Texte wurden für die eigene Bewertung anonymisiert; die [Blindnotizen](Blindnotizen.md) entstanden vor dem Nachsehen der Modellstufe.

| Folge | Low | Medium |
|---|---|---|
| Kuchenfahrt | [Text A](blind/1-A.md) | [Text B](blind/1-B.md) |
| Banner | [Text B](blind/2-B.md) | [Text A](blind/2-A.md) |
| Eigene Qualitätsbewertung, Ø über zwei Texte und sieben Kriterien | 7,4/10 | 7,2/10 |
| Gemeldete Denk-Tokens, Ø | 128 | 1.811 |
| Autorenkosten, Ø | $0,0427 | $0,0645 |
| Dauer des Autorenaufrufs, Ø | 86 s | 153 s |

Das sind nur je zwei eng verwandte Texte und subjektive KI-Bewertungen, ohne echte Kinder oder wiederholte Läufe. Die leichte Abweichung der Qualitätsnoten belegt keinen generellen Vorteil für Low. In diesem kleinen Vergleich brachte Medium trotz mehr gemeldeter Denk-Tokens keinen erkennbaren Vorteil bei Verständlichkeit, Logik oder Humor. Beide Bannertexte hatten eine nicht erklärte Stelle beim späteren Rest des Banners.

Die Kosten betreffen nur den Autorenaufruf zu den damals gemeldeten Standardtarifen. Die einzelnen Kosten waren Low $0,03409 und $0,05126, Medium $0,06664 und $0,06240. Unterschiedliches Prompt-Caching beeinflusste den Vergleich: Folge 1 Low hatte einen großen Cache-Treffer, Folge 2 Medium einen teilweisen. Daraus lässt sich kein konstanter Preisaufschlag oder eine Produktionsmarge ableiten. Lektorat, Bilder, Infrastruktur und Steuern fehlen. Im produktiven Beispiel „Der Kompass und die Kuchenrunde“ wurden auf Low 155 Denk-Tokens und 3.446 Ausgabetokens einschließlich Denk-Tokens gemeldet.

Die Figurenwelt-Pipeline fordert aktuell für Sol `low` an. Ihr Ausgabelimit für diese mittlere Geschichte beträgt 7.475 Tokens insgesamt; es begrenzt sichtbaren Text und Denk-Tokens zusammen. Im vorliegenden Beispiel lag die Ausgabe mit 3.446 deutlich darunter. Eine höhere Obergrenze garantiert daher weder mehr Denken noch bessere Geschichten.

OpenAI dokumentiert für Sol die Stufen `low`, `medium`, `high`, `xhigh` und `max`, jedoch keine frei einstellbare Zwischenstufe „low+“. Bei gleichem `low` wählt das Modell den Denkaufwand adaptiv. Separat bietet OpenAI in der Responses API den Modus `pro`; auch er lässt sich mit `low` kombinieren und verwendet laut Dokumentation mehr Modellarbeit. Die gegenwärtige Figurenwelt-Implementierung verwendet OpenRouter Chat Completions und setzt keinen solchen Modus. Ob und wie diese Route Sol Pro unterstützt, wurde hier nicht getestet. Pro ist kein genauer Regler für „ein bisschen mehr“ und sein Preis und Nutzen pro Geschichte müssen gemessen werden. [OpenAI-Dokumentation zu Reasoning-Stufen und -Modus](https://developers.openai.com/api/docs/guides/reasoning)
