/**
 * Chapter book — parsing and checking written chapters.
 *
 * Deterministic and free: markers, word counts, technical leftovers, a
 * "to be continued" the bedtime book must not end on, invented hero looks,
 * blocked terms, a narrator question at the end, and phrases a writer repeats
 * across chapters (a tic is invisible inside one picture book and loud over
 * twelve evenings).
 */

import { containsBlockedTerm, countWords, inventedHeroLooks, splitSentences } from "../checks";
import { cleanProse, ensureParagraphs, normalizeGermanQuotes } from "../parsing";
import { parseJsonObject } from "../llm";
import type { CheckIssue } from "../types";
import { mentionsName } from "./catalogue";
import type { BookBrief, BookBudget, BookChapter, ChapterCritique } from "./types";

const CHAPTER_MARKER = /^\s*(?:[#*_>\s]*)(?:KAPITEL|CHAPTER|CHAPITRE|CAPÍTULO|CAPITOLO|HOOFDSTUK|ГЛАВА)\s+(\d+)\s*[:：.\-–—]?\s*(.*?)\s*[*_#]*\s*$/i;
const LEFTOVER_LINE = /^\s*[*_#\s]*(?:RÜCKBLICK|FAKTEN|RECAP|FACTS|TITEL|BESCHREIBUNG)\s*[:：].*$/gim;
const TO_BE_CONTINUED = /[^.!?„“]*\b(?:fortsetzung folgt|to be continued|wird fortgesetzt|geht(?:'s| es) (?:im nächsten|morgen) (?:band|buch) weiter)\b[^.!?“]*[.!?…]*“?/gi;

function cleanTitle(value: string): string {
  return String(value || "").replace(/^[„"'*_\s]+|[“"'*_\s]+$/g, "").trim().slice(0, 90);
}

/** Chapters in marker order; numbers come from the markers. */
export function parseChapters(raw: string, options: { german?: boolean } = {}): BookChapter[] {
  const lines = String(raw || "").replace(/\r\n/g, "\n").split("\n");
  const blocks: Array<{ order: number; title: string; lines: string[] }> = [];
  for (const line of lines) {
    const marker = line.match(CHAPTER_MARKER);
    if (marker) {
      blocks.push({ order: Number(marker[1]), title: cleanTitle(marker[2]), lines: [] });
      continue;
    }
    if (blocks.length) blocks[blocks.length - 1].lines.push(line);
  }
  const seen = new Set<number>();
  return blocks
    .filter((block) => {
      if (seen.has(block.order)) return false;
      seen.add(block.order);
      return true;
    })
    .map((block) => {
      let content = cleanChapterText(block.lines.join("\n"));
      if (options.german) content = speechTagCommas(ensureParagraphs(normalizeGermanQuotes(content)));
      return { order: block.order, title: block.title || `Kapitel ${block.order}`, content, recap: "" };
    })
    .filter((chapter) => chapter.content.length > 0);
}

// A speech tag after a quote: a weak past form (sagte, fragte, flüsterte …) or a common strong one.
const SPEECH_TAG = String.raw`(?=(?:\p{Ll}+te|rief|schrie|sprach|bat|befahl|log|riet)\b)`;

/**
 * German comma after direct speech followed by its speech tag, which the writer drops now and then
 * („Welche Reise?“ fragte Alexander → „Welche Reise?“, fragte Alexander; „Hier.“ sagte er → „Hier“, sagte er).
 */
export function speechTagCommas(text: string): string {
  return text
    .replace(new RegExp(String.raw`([?!])“[ \t]+${SPEECH_TAG}`, "gu"), "$1“, ")
    .replace(new RegExp(String.raw`([^.?!…\s])\.“[ \t]+${SPEECH_TAG}`, "gu"), "$1“, ");
}

/** Removes markdown, logbook lines a model may add, and any "to be continued". */
export function cleanChapterText(text: string): string {
  return cleanProse(String(text || "").replace(LEFTOVER_LINE, "").replace(TO_BE_CONTINUED, "").replace(/^\s*[-–—_*]{3,}\s*$/gm, ""))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function words(text: string): string[] {
  return (String(text || "").toLocaleLowerCase("de-DE").match(/[\p{L}\p{N}]+/gu) || []);
}

/** Six-word phrases of `chapter` that already stood in an earlier chapter (names excluded). */
export function repeatedPhrases(chapter: BookChapter, earlier: BookChapter[], names: string[], size = 6): Array<{ phrase: string; chapter: number }> {
  const nameTokens = new Set(names.flatMap((name) => words(name)));
  const grams = (text: string) => {
    const tokens = words(text);
    const out = new Set<string>();
    for (let i = 0; i + size <= tokens.length; i += 1) {
      const gram = tokens.slice(i, i + size);
      if (gram.filter((token) => nameTokens.has(token)).length >= 2) continue;
      out.add(gram.join(" "));
    }
    return out;
  };
  const mine = grams(chapter.content);
  const hits: Array<{ phrase: string; chapter: number }> = [];
  for (const other of earlier) {
    for (const gram of grams(other.content)) {
      if (mine.has(gram) && !hits.some((hit) => hit.phrase.includes(gram.split(" ").slice(1).join(" ")))) hits.push({ phrase: gram, chapter: other.order });
    }
  }
  return hits.slice(0, 3);
}

const MORAL_ENDINGS = [
  /(sie|er|wir|alle) (lernten|lernte|hatten gelernt),? dass/i,
  /wahre (magie|freundschaft|stärke)/i,
  /und die moral/i,
  /(war|alles war) (alles )?nur ein traum/i,
  /they learned that/i,
];

const TIME_OPENING = /^(am|an diesem|an jenem|in (der|dieser|jener)|früh am|spät am|gegen|als (die sonne|der mond|es (dunkel|hell|abend|morgen))|die sonne|der nächste|the next|that (morning|evening|night)|in the (morning|evening))\b[^.!?]{0,40}\b(morgen|vormittag|mittag|nachmittag|abend|nacht|tag|frühstück|sonne|mond|morning|evening|night|day)\b/i;

/**
 * How a chapter opens, when it opens by formula: the time of day, or everyone present
 * listed in the first sentence (Gurkenberg: "Am nächsten Morgen saßen A, B, C und D …" again and again).
 */
export function formulaicOpening(content: string, names: string[]): "time" | "roll-call" | null {
  const first = splitSentences(content.trim().split(/\n+/)[0] || "")[0] || "";
  if (TIME_OPENING.test(first.trim())) return "time";
  const present = names.filter((name) => mentionsName(first, name)).length;
  return present >= 3 ? "roll-call" : null;
}

export function checkChapter(chapter: BookChapter, input: { brief: BookBrief; budget: BookBudget; earlier: BookChapter[]; names: string[] }): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const { budget } = input;
  const count = countWords(chapter.content);
  const at = (message: string, code: string, severity: CheckIssue["severity"]) => issues.push({ code, severity, message: `Kapitel ${chapter.order}: ${message}`, page: chapter.order });
  if (count < budget.wordsPerChapterMin * 0.7) at(`nur ${count} Wörter, gebraucht ${budget.wordsPerChapterMin}–${budget.wordsPerChapterMax}.`, "chapter_short", "hard");
  else if (count > budget.wordsPerChapterMax * 1.5) at(`${count} Wörter, höchstens ${budget.wordsPerChapterMax} — kürzen, ohne Handlung zu verlieren.`, "chapter_long", "soft");
  if (/\[object Object\]|\{\{|\}\}|\bundefined\b|\bNaN\b|\bSEITE\s+\d+|\bKAPITEL\s+\d+/.test(chapter.content)) at("technische Reste im Text.", "serialization_artifact", "hard");
  // Looks: the pictures show the heroes; the text must not contradict them.
  for (const issue of inventedHeroLooks([{ order: chapter.order, title: chapter.title, content: chapter.content }], input.brief.heroes)) {
    issues.push({ ...issue, message: issue.message.replace(/^Seite (\d+)/, "Kapitel $1") });
  }
  const blocked = containsBlockedTerm(chapter.content, input.brief.blockedTerms);
  if (blocked) at(`der gesperrte Begriff „${blocked}“ steht im Text.`, "blocked_term", "hard");
  const lastSentence = splitSentences(chapter.content.trim().split(/\n+/).pop() || "").pop() || "";
  if (/\?\s*$/.test(lastSentence) && !/[„"»«“”]/.test(lastSentence)) at(`endet mit einer Erzählerfrage („${lastSentence.slice(0, 80)}“) statt mit einem Ereignis.`, "narrator_question", "soft");
  if (chapter.order === budget.chapters && MORAL_ENDINGS.some((pattern) => pattern.test(chapter.content.slice(-700)))) at("das Ende spricht eine Lehre aus — es muss ein Bild oder eine Pointe sein.", "moral_ending", "hard");
  // One opening by formula is fine; the same formula in one of the two chapters before is a tic.
  const opening = formulaicOpening(chapter.content, input.names);
  if (opening && input.earlier.slice(-2).some((other) => formulaicOpening(other.content, input.names) === opening)) {
    at(opening === "time"
      ? "beginnt wie ein Kapitel kurz davor mit der Tageszeit — steig mit einer Handlung, einem Satz wörtlicher Rede oder einem überraschenden Detail ein."
      : "zählt im ersten Satz wieder die ganze Gruppe auf — steig mit einer Handlung oder einem Satz wörtlicher Rede ein und bring die Figuren nach und nach ins Bild.",
    "formulaic_opening", "soft");
  }
  for (const hit of repeatedPhrases(chapter, input.earlier, input.names)) {
    at(`die Formulierung „${hit.phrase}“ stand schon in Kapitel ${hit.chapter} — variiere sie.`, "repeated_phrase", "soft");
  }
  return issues;
}

function quote(value: unknown): string | null {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text || /^(null|none|keine?|nichts|—|-)$/i.test(text) || text.length < 6) return null;
  return text.slice(0, 300);
}

function score(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(10, Math.round(n * 10) / 10)) : 0;
}

/** A quote counts only when it is (nearly) in the text: critics paraphrase, and a paraphrase proves nothing. */
export function quoteInText(quoted: string | null, content: string): boolean {
  if (!quoted) return false;
  const haystack = ` ${words(content).join(" ")} `;
  const needle = words(quoted);
  if (needle.length < 3) return false;
  // Any five consecutive words of the quote (all of it when shorter): critics join two
  // sentences or drop a word, and a near-verbatim quote still proves the laugh exists.
  const size = Math.min(5, needle.length);
  for (let i = 0; i + size <= needle.length; i += 1) {
    if (haystack.includes(` ${needle.slice(i, i + size).join(" ")} `)) return true;
  }
  return false;
}

export interface ChapterCritiqueResult {
  chapters: ChapterCritique[];
  mustFix: Array<{ chapter: number; quote: string; problem: string }>;
  languageErrors: Array<{ chapter: number; quote: string; correction: string }>;
}

export function parseChapterCritique(raw: string, chapters: BookChapter[]): ChapterCritiqueResult | null {
  const parsed = parseJsonObject<any>(raw);
  if (!parsed || !Array.isArray(parsed.chapters)) return null;
  const orders = new Set(chapters.map((chapter) => chapter.order));
  const clamp = (value: unknown) => {
    const n = Math.round(Number(value));
    return orders.has(n) ? n : chapters[0]?.order ?? 1;
  };
  const critiques: ChapterCritique[] = chapters.map((chapter) => {
    const entry = parsed.chapters.find((item: any) => Math.round(Number(item?.n)) === chapter.order) || {};
    const laugh = quote(entry.laugh);
    const hook = quote(entry.hook);
    // A quote the text does not contain is a guess, not a laugh.
    const laughFound = Boolean(laugh && quoteInText(laugh, chapter.content));
    const hookFound = Boolean(hook && quoteInText(hook, chapter.content));
    const unmatched = {
      ...(laugh && !laughFound ? { laugh } : {}),
      ...(hook && !hookFound ? { hook } : {}),
    };
    return {
      n: chapter.order,
      laugh: laughFound ? laugh : null,
      hook: hookFound ? hook : null,
      suspense: score(entry.suspense),
      humor: score(entry.humor),
      progress: entry.progress !== false && !/^(false|nein|no)$/i.test(String(entry.progress)),
      missingPlants: (Array.isArray(entry.missingPlants) ? entry.missingPlants : []).map((id: unknown) => String(id).trim().toUpperCase()).filter(Boolean).slice(0, 4),
      ...(Object.keys(unmatched).length ? { unmatched } : {}),
    };
  });
  return {
    chapters: critiques,
    mustFix: (Array.isArray(parsed.mustFix) ? parsed.mustFix : [])
      .map((note: any) => ({ chapter: clamp(note?.chapter), quote: String(note?.quote ?? "").trim().slice(0, 200), problem: String(note?.problem ?? "").trim().slice(0, 400) }))
      .filter((note: { problem: string }) => note.problem)
      .slice(0, 6),
    languageErrors: (Array.isArray(parsed.languageErrors) ? parsed.languageErrors : [])
      .map((error: any) => ({ chapter: clamp(error?.chapter), quote: String(error?.quote ?? "").trim().slice(0, 200), correction: String(error?.correction ?? "").trim().slice(0, 200) }))
      .filter((error: { quote: string; correction: string }) => error.quote && error.correction)
      .slice(0, 10),
  };
}

/** A patched chapter keeps at least 80 % of its words and grows by two or three sentences at most. */
export function acceptableChapterPatch(before: string, after: string): boolean {
  const original = words(before);
  const patched = words(after);
  if (patched.length === 0 || patched.length - original.length > 60 || patched.length < original.length * 0.85) return false;
  const kept = new Set(patched);
  return original.filter((word) => kept.has(word)).length >= original.length * 0.8;
}

/** The patch returns only changed chapters; unknown numbers or a rewritten chapter are rejected. */
export function mergeChapterPatch(raw: string, chapters: BookChapter[], german: boolean): BookChapter[] {
  const changed = parseChapters(raw, { german });
  if (!changed.length || changed.some((entry) => !chapters.some((chapter) => chapter.order === entry.order))) return chapters;
  return chapters.map((chapter) => {
    const next = changed.find((entry) => entry.order === chapter.order);
    return next && acceptableChapterPatch(chapter.content, next.content) ? { ...chapter, content: next.content } : chapter;
  });
}