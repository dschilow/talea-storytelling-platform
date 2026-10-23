# Talea-Folge (`talea-folge-v1`)

Die Talea Originals („Bruno, der Flunkerfisch“, „Die Monster-Müllabfuhr“) lesen sich voll und lustig, weil eine Reihenbibel sie trägt: ein Wunder mit einer Regel, das eine echte Kindersituation wörtlich nimmt, Figuren mit unverwechselbarer Stimme, Running Gags, eine Folgenformel und drei Kapitel mit je 500–800 Wörtern. Eine normale Geschichte hat keine Bibel. Die Talea-Folge erfindet deshalb pro Geschichte eine und schreibt sie mit dem Handwerk der Originals.

## Ablauf

1. **Bibel und Kapitelplan** (ein Aufruf, Sol 6.1, Denkstufe niedrig, JSON). Der Planer bekommt die Methode der Originals (Kindersituation → ein Wunder mit einer Regel → der bequeme Ausweg macht es schlimmer → Beinahe-Entdeckung → stiller Moment → Mut vor anderen → Auflösung, die alles Angelegte einlöst → Schlussgag). Dazu kommen vier per Seed gezogene Kindersituationen, drei genrepassende Orte, die Helden, Pool-Figuren, Artefakte, Wünsche, Lernziel und die Geschichten, die die Familie schon kennt. Bei Strukturfehlern gibt es eine Reparatur.
2. **Die Geschichte** (ein Aufruf, Sol 6.1, Denkstufe niedrig). Der Schreiber bekommt die Schreibregeln der Originals und zwei echte Originals-Kapitel als Stilvorlage. Er darf daraus nichts übernehmen: keine Namen, Figuren, Gags oder Sprüche.
3. **Deterministische Prüfung**: Kapitelzahl, Länge, Namen aus der Stilvorlage, gesperrte Begriffe, mitgebrachtes Artefakt, Erzählerfrage am Kapitelende. Nur harte Fehler lösen genau eine gezielte Überarbeitung aus.
4. Danach übernimmt die Bilderbuch-Hülle (`storybook-mode-generation.ts`): Bildregie, ein Bild pro Kapitel plus Titelbild, Avatar-Entwicklung, Artefakt-Freischaltung, Pool-Rotation.

Code: `backend/story/episode/` (Encore-frei, LLM als Port), Tests `backend/story/episode/episode.test.ts`.

## Messung am 23.10.2026

24 Geschichten, nur Text, Sol und Luna direkt über die OpenAI-API (Testskript `scripts/episode/run.ts`), zusammen 2,02 $. Alle Bewertungen hat Claude selbst gelesen, auf derselben Skala wie das Lektorat der Originals.

| | Note (0–10) | Text-Kosten | Dauer |
| --- | --- | --- | --- |
| Heutige Standard-Lane (Dev-Engine, Kimi K2.6), Proben vom 15.10. | ≈ 4 | ≈ 9,5 ¢ (Audit Juli) | 2–4 min |
| Talea-Folge, Sol plant und schreibt | ≈ 7–8 (Schnitt ≈ 7,3) | 8,5–9,3 ¢ | ≈ 3 min |
| Talea-Folge, Luna plant, Sol schreibt | ≈ 6,5–7 | ≈ 4 ¢ | ≈ 2 min |
| Originals, von der Pipeline geschrieben | ≈ 7–7,5 | 2–7 ¢ | |
| Originals, von Claude geschrieben | ≈ 8,5 | | |

Was die Prompts in vier Runden gelernt haben:
- Steht „eine Flunkerei“ in der Liste der Kindersituationen, wählt Sol jedes Mal die Bruno-Prämisse. Diese und die Monster-Prämisse gelten jetzt als vergeben.
- Sol hat Lieblingsmotive: alles allein schaffen, um Hilfe bitten, ein Fest mit Sitzkissen und Vorhang, eine Organisatorin mit Bleistift hinter dem Ohr, „Erst …, dann …“-Sprüche. Gegenmittel sind gezogene Situationen und Orte, ein Fest-Verbot und eine Liste abgenutzter Requisiten.
- Eigenschaften der Helden werden sonst zum Thema („Adrian tanzt“ ergab dreimal einen Tanzauftritt). Jetzt färben sie nur, wie die Helden handeln.
- Konkrete Beispiele in den Regeln landen wörtlich im Text („heiße Ohren“ stand in jeder Geschichte).
- Eine höhere Denkstufe beim Plan brachte nichts und kostete 3 ¢ mehr.
- Flex (halber Preis) war bei OpenAI für Sol in allen Testläufen ausgebucht. Der Produktionsport fällt dann ohnehin auf den Standardtarif zurück.

Beste Beispiele: `Logs/episode/r4-magic` („Da knurrt ein Nebelkissen!“), `p-fairy-sol` („Revanche auf vier Heuhufen“), `r2-fairy` („Der Frosch passt nicht“), `v-learn` (Lernmodus Reibung).

## Schalter

- Wizard (nur Admins): Schritt „Art“, Kachel „Talea-Folge“ → `storybookMode: true`, `storybookEngine: "talea-folge-v1"`.
- `TALEA_EPISODE_WRITER_MODEL` ersetzt Sol als Schreiber, `TALEA_EPISODE_PLANNER_MODEL` als Planer (`openai/gpt-6-luna` ist die günstige Variante).
- Kunden bekommen weiterhin die Standard-Lane: `stripAdminOnlyStoryOptions` entfernt alle Lane-Felder. Eine Umstellung der Standard-Lane auf die Talea-Folge ist nicht gebaut und braucht eine Entscheidung.

## Offen

- Bilder dieser Lane sind nicht live getestet. Die Bilderbuch-Hülle ist erprobt, hier gibt es aber nur 3 Kapitel mit je etwa 600 Wörtern und einem Bild.
- 3–5 Jahre ist schwächer (≈ 5,5–6): Die Methode ist für Kleine zu viel Maschinerie.
- Gegen Sols Tics hilft keine Regel vollständig (Sitzkissen, „Erst …, dann …“).
