# Kapitelbuch: Buchgefühl statt Drehbuch (2026-10-16)

Anlass war „Der Regen sagt rückwärts“ (chapter-book-v1, 8 Kapitel, 6–8 Jahre, Story c13c5a4c). Plan, Running Gag, Hooks und ein Lacher pro Kapitel waren da – und trotzdem las sich das Buch wie ein Drehbuch. Der Maßstab der Familie ist „Zippel, das wirklich wahre Schlossgespenst“ (Alex Rühle, dtv): ein warmer, trockener Erzähler, Gedanken und Gefühle des Kindes auf der Seite, lange und kurze Sätze im Wechsel, genaue Alltagsdetails, Witze, die beim Vorlesen funktionieren.

## Befund am veröffentlichten Text

| Messgröße | „Der Regen sagt rückwärts“ | Vorlese-Kapitelbücher |
| --- | --- | --- |
| Wörter pro Kapitel | ~600 | 900–1.500 |
| Wörter pro Satz (Schnitt) | 6,4 | 9–13 |
| Anteil wörtliche Rede | über die Hälfte | ein Drittel bis die Hälfte |
| benannte Gefühle/Gedanken | 0 in 8 Kapiteln | alle 60–100 Wörter eines |
| Merksprüche | 4 | höchstens 1 |

Dazu kamen Planfehler, die das Plan-Review (8,7/10) durchgewinkt hatte: eine Nachbarin kannte den Ausweg von Anfang an, der einzige Rückschlag war ein Gewitter, der Einsatz (ein Konzert) wurde im letzten Kapitel stillschweigend fallen gelassen, der Wortwitz (rückwärts gelesene Sätze) ist beim Vorlesen nicht zu hören. In den Bildern fehlten zwei Nebenfiguren komplett (0 von 13 Bildern), weil die Helden alle drei Plätze füllten. Das PDF sah nach Ausdruck aus (Sans-Serif, Metadaten auf dem Cover, „Erstellt mit Talea“ auf jeder Seite, fast leere Seiten vor Bildern).

## Ursache

Der Writer-Prompt hat den Drehbuchstil selbst verlangt: „Show feelings through behaviour and dialogue, not by naming them“, „short and medium sentences“, „no narrator comments“, dazu die Bilderbuch-Stilprobe mit Vier-Wort-Sätzen. Das Wortbudget (550–700) ließ keinen Platz für einen Erzähler. Der Kritiker bewertete Lacher, Hook und Spannung, aber nie die Erzählstimme.

## Änderungen (alle konfigurationsneutral: Altersband, Sprache, Genre/Form, Heldenzahl und Cast kommen aus dem Wizard)

- `book/voice.ts` (neu): Erzählstimme-Regeln für den Writer nach Altersband und Sprache (Erzähler mit Haltung, Innenleben, Rhythmus, Szenendetail, Vorlese-Test, höchstens ein Merkspruch); eine Kapitelbuch-Stilprobe für Deutsch (eigens geschrieben, keine Figur aus Pool oder Familie); `proseProfile`/`voiceIssues` messen den freigegebenen Text (Satzlänge, Kurzsatz-Anteil, Dialoganteil, Innenleben – Letzteres nur für Deutsch).
- `book/prompts.ts`: Writer-Prompt ohne die Drehbuch-Regeln, mit NARRATOR VOICE und der neuen Stilprobe; Plan-Regeln für gehaltene Einsätze, Rückschlag aus Heldenentscheidung, keine größere Figur, die es lösen könnte, Witz nur per Ohr, ein Jemand mit Wollen und Angst, höchstens ein sprechendes Ding neben dem Wunder, Zeit wie im Buch, Pool-Figuren mit ihrer bekannten Geschichte; neues Kapitelfeld `feeling`; Plan-Review mit fünf neuen Checks (`nobodyBiggerSolves`, `stakesKept`, `setbackByHero`, `worksByEar`, `someoneWants`), Caps und „immer high“-Schwächen; Kritiker mit `voice` (0–10) und `lesson` (Zitat); Patch darf einen ausgesprochenen Merksatz streichen.
- `book/budget.ts`: Wörter pro Kapitel 3–5: 380–520, 6–8: 850–1.100, 9–12: 1.150–1.500.
- `book/chapters.ts`, `book/engine.ts`: Prosa-Checks im `checkChapter`; ein drehbuchartiges Kapitel ist ein Rewrite-Grund (`script-like`), nie eine Patch-Notiz (ein Patch behält 85 % der Wörter); ein Rewrite für die Stimme wird nur übernommen, wenn er messbar buchartiger ist; Kurve mit `voice` und `prose` im Log.
- `book/plan.ts`, `book/types.ts`: Caps für die neuen Checks, Typen für `feeling`, `voice`, `lesson`, `prose`.
- `book/illustrations.ts`: Jede handelnde Figur eines Kapitels kommt in mindestens ein Bild des Kapitels; das Wunder in mindestens jedes zweite Bild; Bilder zeigen Handlung mit den Dingen aus dem Absatz, nie Posen.
- `frontend/utils/pdfExport.ts`: Serifenschrift, Kapitelzahl plus Titel mit Luft, Cover nur mit Titel, Untertitel und „Eine Geschichte für …“, Seitenzahlen allein in der Fußzeile, Kolophon-Seite am Ende, Bilder schrumpfen in den Restplatz statt eine fast leere Seite zu erzeugen; Beschriftungen nach Sprache (de, en, fr, es, it, nl).

## Offen / zu messen

- Blind-Paare alter gegen neuer Prompt auf denselben Wizard-Konfigurationen (wie bei heart-and-wit am 2026-10-15), insbesondere Raum/Abenteuer/Tiere, bei denen Zusatzregeln schon einmal Tempo gekostet haben.
- Die Schwellen in `voiceIssues` (8 Wörter pro Satz, 30 % Kurzsätze, 60 % Dialog) stammen aus einem Buch und den Vergleichswerten; nach zehn Büchern nachjustieren.
- Für nicht-lateinische Sprachen (ru) trägt das PDF weiterhin keine passende Schrift.
