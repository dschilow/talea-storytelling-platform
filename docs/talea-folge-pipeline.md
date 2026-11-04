# Talea-Folge (`talea-folge-v1`)

Die Talea Originals („Bruno, der Flunkerfisch“, „Die Monster-Müllabfuhr“) lesen sich voll und lustig, weil eine Reihenbibel sie trägt: ein Wunder mit einer Regel, das eine echte Kindersituation wörtlich nimmt, Figuren mit unverwechselbarer Stimme, Running Gags, eine Folgenformel und drei Kapitel mit je 500–800 Wörtern. Eine normale Geschichte hat keine Bibel. Die Talea-Folge erfindet deshalb pro Geschichte eine und schreibt sie mit dem Handwerk der Originals.

## Umbau am 04.11.2026: wie Figurenabenteuer

Anlass: zwei Prod-Geschichten des Users, „Die Brücke spielt weiter“ (2.057 Wörter, 12,3 ¢) und „Der Kram läuft hinterher“ (1.853 Wörter, 13,6 ¢, ein Bild fehlte, Zauberer Merlin als Junge gemalt). Zu lang, zu teuer, und die Figurenabenteuer machten inzwischen bessere Geschichten und Bilder. Talea-Folge übernimmt deshalb deren Maschinerie; nur die Geschichte bleibt frei erfunden.

| | vorher | jetzt |
| --- | --- | --- |
| Länge (6–8, mittel) | 3 × 600–800 Wörter | 3 × 450–650 Wörter (`seriesBudget`) |
| Neue Figuren bis 8 Jahre | 2 | 1 (das Wunder) |
| Lektorat | Terra, bei schweren Fehlern ganze Geschichte neu | Haiku 5.5 mit dem Lektoratshandwerk der Serie, Sol repariert nur die zitierten Stellen (auch Kapiteltitel), höchstens zwei Runden, nur übernommen, wenn die Nachlese weniger Fehler findet |
| Bildregie | Terra, Kapitelbuch-Regie | Luna, Regie der Serie aus wörtlichen Zitaten (`directFolgePictures`), jedes Kind darf Cover und Seite 1 tragen |
| Bildmodell | FLUX 3 Klein | FLUX.2 klein 9B KV (`SERIES_IMAGE_MODEL`) |
| Bildprüfung | Terra (≈ 0,3 ¢ je Bild) | Luna + Jev, Reparaturleiter und 16-Aufruf-Deckel der Serie |
| Gastporträt | ungeprüft | Luna liest es, einmal neu gezeichnet bei Fehlern (0,01 ¢) |
| Wiederkehrende Gegenstände | – | Referenzplan der Serie |
| Bildstil-Wahl | nur Figurenabenteuer (und für Kunden verworfen) | beide Lanes, `imageStyle` bleibt bei Kunden erhalten |

**Neuzeichnen mit korrigiertem Prompt** (gilt auch für Figurenabenteuer, Vorschlag des Users): Scheitert ein Bild, bekommt Luna das fehlerhafte Bild, das Identitätsblatt, den vollständigen Prompt, die Textstelle und alle Befunde (Prüfung, Jev, Panel-Prüfung). Sie benennt die Ursache im Prompt und schreibt den vollständigen Prompt neu – derselbe Moment, dieselbe handelnde Figur, höchstens eine Figur weniger in einem Dreierbild, nur positive Wörter (FLUX malt, was eine Verneinung nennt; in den ersten Versuchen nannte Luna die feste Code-Zeile „No additional foreground children“ als Ursache der zusätzlichen Kinder). Der Code fügt die Identitätszeile samt Bindung wieder an (Gesicht, Brille und Kleidung bleiben bei ihrer Figur, Anatomie der Menschen, eine durchgehende Szene – ohne sie verlor Nora ihre Brille und die Porträts des Blatts schwebten über der Szene), dazu die Objekt-Referenzen, den Bildstil und die Wortlos-Zeile. Der vereinfachte Ein-Figuren-Rettungsplan erbt nie einen umgeschriebenen Prompt. Vergisst ihr Prompt eine Figur oder passt die Länge nicht, gilt ihre neu geschriebene Szene im Code-Prompt. Das Bild wird frisch gemalt, ohne angehängte Fehlersätze; jede weitere Runde schreibt den neuesten Prompt um. ≈ 0,1–0,2 ¢ je Neuzeichnung; eine unbrauchbare Umschreibung fällt auf die alte Reparatur zurück, `TALEA_SERIES_PROMPT_REWRITE=off` schaltet sie ab.

**Messung 04.11.2026** (sechs produktionsgleiche Piloten, 4 × Talea-Folge, 2 × Figurenabenteuer mit demselben Text): 16 von 36 umgeschriebenen Neuzeichnungen bestanden (alte Reparatur ≈ 3 von 14, nur Szene umgeschrieben 2 von 14), 16 von 20 durchgefallenen Bildern gerettet, 39 von 42 Bildern gedruckt; 7,6–7,7 ¢ pro Geschichte (11,7 ¢, wenn Flex den Text abbricht und Sol im Standardtarif schreibt). Weiter scheitern: ein Wunder, das Größe oder Material ändert (wachsende Korkkrone wird Goldkrone, schrumpfender Kuchen bleibt groß), und ein zusätzliches Kind auf einem vollen Dreier-Cover (die Produktion setzt dann ein Kapitelbild als Cover). Zwei Nebenfunde: Der Prüfer verlangte den Bootsnamen „Seegras“ am Bug (vier vergeudete Neuzeichnungen) – jetzt ist ein Gegenstand ohne Schrift ausdrücklich richtig; ein neuer grüner Troll mit roter Weste wurde als bekannter Film-Oger gemalt – neue Figuren bekommen jetzt ein eigenes Aussehen, das keine bekannte Film-, Spiel- oder Buchfigur hat. `scripts/character-series/pilot-v2.ts` gibt seit dem 04.11. das Bildmodell weiter; vorher baute es den FLUX-3-Regionsprompt, Serienpiloten waren also nicht produktionsgleich.

Neue Schreibregeln: Das Wunder ist die einzige Magie und gibt keiner Figur Körperteile dazu oder weg (FLUX kann wechselnde Arme nicht zählen: „Das Fernrohr mit den Greifarmen“ verlor 5 von 7 Bildern); ein Running Gag statt zwei; eine Eigenheit wird gezeigt, bevor ein Witz sie braucht; nach der Auflösung höchstens ≈ 150 Wörter; „Child reader first“ aus der Serie.

Piloten mit fiktiven Avataren (`scripts/episode/pilot.ts`, Produktionsweg ohne DB), eigene Lesung:

| Geschichte | Wörter | Kosten | Bilder | Text |
| --- | --- | --- | --- | --- |
| Märchen „Der Drache passt nicht“ | 1.520 | 6,7 ¢ | 6/7 | ≈ 8 |
| Abenteuer „Das Fernrohr mit den Greifarmen“ (vor Porträtprüfung und Körperteil-Regel) | 1.492 | 8,6 ¢ | 2/7 | ≈ 7,5 |
| Abenteuer „Die Beere im Höhlenbogen“ | 1.529 | 8,7 ¢ | 5/7 | ≈ 7 |
| Magie „Der aufgeblasene Flüsterhelfer“ | 1.549 | 7,3 ¢ | 4/7 (jedes Kapitel bebildert) | ≈ 7,5 |

Offene Bildfehler: FLUX malt eine Tier-Poolfigur doppelt (zweiter Bär), Kleidung wandert (Bens Warnweste an einer Nebenfigur), ein wachsendes Wunder bleibt im Bild so groß wie sein Porträt, Orte voller Schilder (Fundbüro) scheitern an Jevs Schrift-Erkennung. Pool-Porträts bleiben eine Fehlerquelle (Hexe Kräuterweis wird jung gemalt, weil ihr Porträt jung ist).

## Ablauf

Standard ist der **One-Shot** (ein Aufruf, Sol 6.1, Denkstufe niedrig). Sol bekommt die Methode der Originals (Kindersituation → ein Wunder mit einer Regel → der bequeme Ausweg macht es schlimmer → Beinahe-Entdeckung → stiller Moment → Mut vor anderen → Auflösung, die alles Angelegte einlöst → Schlussgag), die Schreibregeln und zwei echte Originals-Kapitel als Stilvorlage. Aus der Stilvorlage darf er nichts übernehmen. Dazu kommen vier per Seed gezogene Kindersituationen, drei genrepassende Orte, die Helden, Pool-Figuren, Artefakte, Wünsche, Lernziel und die Geschichten, die die Familie schon kennt. Sol plant still und schreibt vor die Kapitel nur einen kurzen Kopf: `IDEE`, `REGEL`, je Figur eine `FIGUR`-Zeile (Pool-ID oder Aussehen auf Englisch für die Bilder), `FUNDSTÜCK`, beim Lernmodus `WISSEN`, dann `TITEL` und `BESCHREIBUNG`.

Mit `TALEA_EPISODE_MODE=two-step` läuft die ältere Variante: erst Bibel und Kapitelplan als JSON (ein Aufruf, bei Strukturfehlern eine Reparatur), dann die Geschichte (ein Aufruf).

Danach in beiden Modi:
1. **Namen**: Bekommt eine neue Figur trotz Verbot einen Namen aus den Originals („Bruno“), wird sie überall umbenannt, statt die Geschichte für etwa 5 ¢ neu schreiben zu lassen. Namen von Helden und Pool-Figuren bleiben immer: Ein Kind namens Ella ist kein Kopierfehler.
2. **Deterministische Prüfung**: Kapitelzahl, Länge, Wörter aus der Stilvorlage, gesperrte Begriffe, mitgebrachtes Artefakt, Erzählerfrage am Kapitelende; weich: ein „Er“ nach zwei möglichen Figuren (oder nach einer Figur und „ihm/ihn“) und Kapiteltitel, die etwas zählen („Drei schlechte Einfälle“). Nur harte Fehler lösen genau eine Überarbeitung aus.
3. Die Bilderbuch-Hülle (`storybook-mode-generation.ts`) übernimmt Avatar-Entwicklung, Artefakt-Freischaltung und Pool-Rotation. Die Bilder laufen seit 2026-10-26 über die Maschinerie des Kapitelbuchs (`episode/pictures.ts`): jedes Kapitel wird an Absatzgrenzen in zwei Lesestücke geschnitten (`TALEA_EPISODE_PICTURES`, 1–3, Standard 2), die Bildregie nennt je Bild den Absatz, den es zeigt, und das Bild steht im Reader und im PDF direkt danach (`chapters.images`, `image_url` bleibt das erste Bild). `enforceCastPresence` stellt jede Figur, die in einem Kapitel handelt, in mindestens ein Bild dieses Kapitels (ein Held weicht nie); wer trotzdem in keinem Bild steht, steht im Log unter `figuresWithoutPicture`. Das Titelbild muss sich von allen Seitenbildern unterscheiden; scheitert es, springt ein sauberes Bild der ersten Hälfte ein, nie das letzte.

Code: `backend/story/episode/` (Encore-frei, LLM als Port), Tests `backend/story/episode/episode.test.ts`.

## Messung am 23.10.2026

32 Geschichten, nur Text, Sol und Luna direkt über die OpenAI-API, Gemini und der Flex-Test über OpenRouter (Testskript `scripts/episode/run.ts`), zusammen 2,25 $, dazu eine Prod-Story mit Bildern. Alle Bewertungen hat Claude selbst gelesen, auf derselben Skala wie das Lektorat der Originals.

| | Note (0–10) | Text-Kosten | Dauer |
| --- | --- | --- | --- |
| Heutige Standard-Lane (Dev-Engine, Kimi K2.6), Proben vom 15.10. | ≈ 4 | ≈ 9,5 ¢ (Audit Juli) | 2–4 min |
| **Talea-Folge One-Shot über OpenRouter-Flex** (Standard seit 23.10. abends) | **≈ 7,5–8** | **≈ 2,7 ¢** | **≈ 2 min** |
| Talea-Folge One-Shot im Standardtarif (Prod-Story 13c3a7d3, OpenRouter, ohne Cache) | ≈ 7 | 6,0 ¢ Text, 7,9 ¢ mit Bildern | ≈ 3 min |
| Talea-Folge One-Shot, OpenAI direkt (Tests) | ≈ 7,5–8 | 4,0–4,8 ¢ | ≈ 2 min |
| One-Shot mit Luna als Schreiberin | ≈ 5,5 (wirre Mechanik, blasse Witze) | 0,2 ¢ | 30 s |
| One-Shot mit Gemini 3.8 Flash | ≈ 6 (macht die Helden zu Brüdern, erfindet eine Brille, „Schnauze halten“) | 2,1 ¢ | 42 s |
| Talea-Folge zwei Schritte, Sol plant und schreibt | ≈ 7–8 (Schnitt ≈ 7,3) | 8,5–9,3 ¢ | ≈ 3 min |
| Talea-Folge zwei Schritte, Luna plant, Sol schreibt | ≈ 6,5–7 | ≈ 4 ¢ | ≈ 2 min |
| Originals, von der Pipeline geschrieben | ≈ 7–7,5 | 2–7 ¢ | |
| Originals, von Claude geschrieben | ≈ 8,5 | | |

Was die Prompts in vier Runden gelernt haben:
- Steht „eine Flunkerei“ in der Liste der Kindersituationen, wählt Sol jedes Mal die Bruno-Prämisse. Diese und die Monster-Prämisse gelten jetzt als vergeben.
- Sol hat Lieblingsmotive: alles allein schaffen, um Hilfe bitten, ein Fest mit Sitzkissen und Vorhang, eine Organisatorin mit Bleistift hinter dem Ohr, „Erst …, dann …“-Sprüche. Gegenmittel sind gezogene Situationen und Orte, ein Fest-Verbot und eine Liste abgenutzter Requisiten.
- Eigenschaften der Helden werden sonst zum Thema („Adrian tanzt“ ergab dreimal einen Tanzauftritt). Jetzt färben sie nur, wie die Helden handeln.
- Konkrete Beispiele in den Regeln landen wörtlich im Text („heiße Ohren“ stand in jeder Geschichte).
- Eine höhere Denkstufe beim Plan brachte nichts und kostete 3 ¢ mehr.
- Der JSON-Plan kostete so viel wie die Geschichte selbst (≈ 4.000 Ausgabe-Tokens), bei kurzen Geschichten mehr. Der One-Shot plant still und war beim Lesen gleich gut, bei halbem Preis.
- Flex über OpenRouter wurde für Sol tatsächlich bedient (`service_tier: flex`), halber Preis, gleiche Dauer. Bei OpenAI direkt war Flex am selben Tag ausgebucht (429). Lehnt OpenRouter Flex ab, wiederholt der Produktionsport den Aufruf im Standardtarif.
- Prod-Story „Dreizehn Pferde zum Frühstück“ (≈ 7/10): Der Titel versprach 13 Pferde, es kamen 6. Das Auslösewort „später“ wurde nie genannt, und ein Schild erklärte die Magie. Seitdem: Der Titel hält sein Versprechen, eine Figur nennt die Regel samt genauem Auslöser direkt nach dem ersten Effekt (das Kind weiß dann mehr als die Figuren), keine Erklär-Schilder. Probe danach („Drei Gänse auf der Treppe“): ≈ 8.
- Bilder: Bei 4 Figuren pro Bild plus zusätzlichen Requisiten brauchte dieselbe Story 10 Bilder für 4 Plätze, 2 blieben „flawed“. Jetzt höchstens 3 Figuren pro Bild, wie im Bilderbuch gemessen.
- Der System-Prompt (Regeln, Stilvorlage, Methode, ≈ 5.000 Tokens) ist für alle Familien einer Altersstufe gleich. Die familienabhängigen Teile (Namensliste, Helden) stehen im User-Prompt, damit der Anbieter-Cache greifen kann.
- Flex (halber Preis) war bei OpenAI für Sol in allen Testläufen ausgebucht. Der Produktionsport fällt dann ohnehin auf den Standardtarif zurück.

Beste Beispiele: `Logs/episode/r4-magic` („Da knurrt ein Nebelkissen!“), `p-fairy-sol` („Revanche auf vier Heuhufen“), `r2-fairy` („Der Frosch passt nicht“), `v-learn` (Lernmodus Reibung).

## Schalter

- Wizard (für alle): erste Seite „Was möchtet ihr erleben?“, Karte „Eigene Geschichte“ → `storybookMode: true`, `storybookEngine: "talea-folge-v1"` (Admins können darunter eine Test-Pipeline wählen).
- `TALEA_EPISODE_FLEX=off` schickt den Schreiber in den Standardtarif (Standard ist Flex), `TALEA_EPISODE_MODE=two-step` statt One-Shot, `TALEA_EPISODE_WRITER_MODEL` ersetzt Sol als Schreiber, `TALEA_EPISODE_PLANNER_MODEL` den Planer im Zwei-Schritt-Modus.
- Testskript: `--mode one-shot|two-step`, `--writer`, `--planner`, `--hero-file`, `--learning`, `--dry`, `--via-openrouter` (OpenAI-Modelle über OpenRouter wie in Produktion), `--flex`.
- Kunden (seit 28.10.2026): „Eigene Geschichte“ läuft auf der Talea-Folge, „Figurenabenteuer“ auf der Figurenserie (`backend/story/customer-story-lane.ts`); alle anderen Lane-Felder werden entfernt. Anfragen ohne Lane (Tavi, ältere Apps) folgen `TALEA_CUSTOMER_STORY_ENGINE` (`talea-folge-v1`, sonst Standard-Pipeline).

## Offen

- Die Bilder mit Absatz-Pin und zwei Bildern je Kapitel (2026-10-26) sind per Test, aber nicht live geprüft. Auslöser war die Prod-Story „Der Riese hinterm Teig“ (35c175bb): Bildregie wählte richtige Absätze (22, 58), gespeichert wurde nur eine URL je Kapitel, das PDF druckte die Bilder an den Kapitelanfang, Magd Elsa (handelt in allen drei Kapiteln) stand in keinem der vier Bilder, das Titelbild war eine Kopie des letzten Kapitelbilds. Die App auf dem Handy zeigt weiter nur das erste Bild je Kapitel.
- Länge Alter 6–8: 600–800 Wörter je Kapitel (vorher 500–700; der Schreiber landete bei 505/503/579 auf dem Boden des Bereichs). Mittel also 1.800–2.400 Wörter statt 1.500–2.100.
- Kosten: „Der Riese hinterm Teig“ zahlte 5,9 ¢ statt 2,7 ¢ für den Text, weil der Flex-Aufruf nach 1,9 s abgelehnt wurde. Der Port versucht Flex jetzt nach 4 s noch einmal (nur bei 429/5xx ohne Abrechnung), erst dann Standard; jede abgelehnte Anfrage steht als Stufe `llm-attempt-failed` mit Grund im Story-Log.
- 3–5 Jahre ist schwächer (≈ 5,5–6): Die Methode ist für Kleine zu viel Maschinerie.
- Gegen Sols Tics hilft keine Regel vollständig (Sitzkissen, „Erst …, dann …“).
