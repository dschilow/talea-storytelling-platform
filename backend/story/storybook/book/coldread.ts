/**
 * Chapter book — the cold reader.
 *
 * Book "Sieben Zimmer und ein Nieser" (2026-10-15): two outside reviews asked who
 * Kuno was, how the heroes belonged together and why the cloud was there. The plan
 * knew all of it, the text never said it, and every check before read the text WITH
 * the plan. The cold reader gets only the released text and answers what a parent
 * reading it aloud for the first time would ask. Every answer the text cannot back
 * with a sentence becomes a patch note for the chapter where it belongs.
 */

import { mentionsName } from "./catalogue";
import { quoteInText } from "./chapters";
import { parseJsonObject } from "../llm";
import type { BookBrief, BookChapter, BookPlan } from "./types";

export interface ColdReadQuestion {
  id: string;
  question: string;
}

/** Orientation questions for the batch with chapter 1; one question per companion who first appears in this batch. */
export function coldReadQuestions(input: { heroes: string[]; relation: string | null; orientation: boolean; newcomers: string[] }): ColdReadQuestion[] {
  const questions: ColdReadQuestion[] = [];
  if (input.orientation) {
    // "Whose home" only with a stated relation: otherwise the patch would invent whose room it is.
    questions.push({ id: "place", question: input.relation ? "Where does the story take place (whose home, which room or place)?" : "Where does the story take place (which room or place)?" });
    // Without a stated relation there is nothing the text may say — asking would make the patch invent one.
    if (input.relation && input.heroes.length > 1) questions.push({ id: "together", question: `How do ${input.heroes.join(" and ")} belong together?` });
    questions.push({ id: "goal", question: "What do the heroes want to achieve, and by when?" });
  }
  // "Der Kieselgarten auf Reisen": "why is the troll with the heroes?" has no answer for a troll who guards his own
  // bridge — the patch made him introduce himself twice. The question asks what the figure is doing there.
  for (const name of input.newcomers) questions.push({ id: `cast:${name}`, question: `Who or what is ${name}, and why is ${name} there when the heroes meet ${name}?` });
  return questions;
}

export function buildColdReadPrompt(brief: BookBrief, chapters: BookChapter[], questions: ColdReadQuestion[]): { system: string; user: string } {
  return {
    system: `You are a parent reading this children's chapter book aloud for the first time to a ${brief.band}-year-old. You know NOTHING about these characters except what the chapters below say — no earlier books, no profiles. Answer every question only from the text. "clear" is true only if the text answers EVERY part of the question; if any part is missing or only guessable, "clear" is false. For every answer copy the one sentence from the text that says it, verbatim. Answer in ${brief.languageLabel}, JSON only.`,
    user: [
      "CHAPTERS:",
      ...chapters.map((chapter) => `KAPITEL ${chapter.order}: ${chapter.title}\n${chapter.content}`),
      "",
      "QUESTIONS:",
      ...questions.map((entry) => `- ${entry.id}: ${entry.question}`),
      "",
      JSON.stringify({ answers: questions.map((entry) => ({ id: entry.id, clear: true, answer: "… or null", quote: "the sentence from the text, or null" })) }),
    ].join("\n"),
  };
}

/** The questions the text does not answer: no answer, or a quote that is not in the chapters. */
export function unansweredQuestions(raw: string, chapters: BookChapter[], questions: ColdReadQuestion[]): string[] {
  const parsed = parseJsonObject<any>(raw);
  if (!parsed || !Array.isArray(parsed.answers)) return [];
  const text = chapters.map((chapter) => chapter.content).join("\n");
  const missing: string[] = [];
  for (const question of questions) {
    const entry = parsed.answers.find((answer: any) => String(answer?.id ?? "").trim() === question.id);
    const answer = String(entry?.answer ?? "").trim();
    const quote = String(entry?.quote ?? "").trim();
    const empty = !answer || /^(null|none|unklar|unknown|nicht|keine?)\b/i.test(answer);
    // Sieben Zimmer probe: "Kuno is a figure with a button cap; why he is there is not said" came with a valid quote.
    const unclear = entry?.clear === false || /^(false|nein|no)$/i.test(String(entry?.clear)) || /nicht (klar|gesagt|erklärt|erwähnt)|unklar|bleibt offen|not (clear|said|stated)/i.test(answer);
    if (empty || unclear || !quote || /^null$/i.test(quote) || !quoteInText(quote, text)) missing.push(question.id);
  }
  return missing;
}

/** Patch notes in German for the unanswered questions — each for the chapter where the information belongs. */
export function coldReadNotes(missing: string[], input: { chapters: BookChapter[]; plan: BookPlan; heroes: string[]; relation: string | null }): string[] {
  const firstChapter = input.chapters[0]?.order ?? 1;
  const notes: string[] = [];
  for (const id of missing) {
    if (id === "place") notes.push(`Kapitel ${firstChapter}: Ein Kind ohne Vorwissen erfährt nicht, wo die Geschichte spielt. Flicht den Ort früh in einen vorhandenen Satz ein („im langen Flur ihres Hauses am Dorfrand“), nie als eigener Satz wie „Ihr Haus lag in einem Dorf.“`);
    else if (id === "together" && input.relation) notes.push(`Kapitel ${firstChapter}: Es wird nicht gesagt, dass ${input.heroes.join(" und ")} ${input.relation} sind. Sag es früh und beiläufig in einem Satz — nichts anderes über die Familie erfinden.`);
    else if (id === "goal") notes.push(`Kapitel ${firstChapter}: Ein Kind ohne Vorwissen erfährt nicht, was die Helden heute wollen und bis wann. Sag es früh in einem Satz oder einer Zeile wörtlicher Rede.`);
    else if (id.startsWith("cast:")) {
      const name = id.slice(5);
      const first = input.chapters.find((chapter) => mentionsName(chapter.content, name))?.order ?? firstChapter;
      const intro = input.plan.bible.characters.find((character) => mentionsName(character.name, name))?.introduction;
      notes.push(`Kapitel ${first}: Beim ersten Auftritt von ${name} erfährt ein Kind nicht, wer oder was ${name} ist und warum ${name} da ist. Ergänze dort ein bis zwei Sätze, die in der Handlung stehen — als Reaktion der Helden oder wörtliche Rede, nicht als Erzähler-Satz wie „X war ein …“${intro ? ` (gemeint ist: ${intro})` : ""}. Stellt sich ${name} dort schon vor, schärfe genau diesen Satz, statt eine zweite Vorstellung zu schreiben.`);
    }
  }
  return notes;
}
