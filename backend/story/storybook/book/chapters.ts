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
import { foldUmlauts, mentionsName } from "./catalogue";
import type { BookBrief, BookBudget, BookChapter, ChapterCritique, OpenThread } from "./types";
import { interludeShare, overusedWords, repeatedTics, voiceIssues } from "./voice";

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

// "Luna und der Brunnenbrief": „Eine erwachsene Nachbarin ordnete Wäsche“ — every neighbour in a children's book is grown up.
const STILTED_GROWNUP = /\b(?:die|der|eine|ein|einer)?\s*vertraute[nr]?\s+(?:erwachsene[nr]?\s+)?(?:Person|Stimme)\b|\berwachsene[nr]?\s+(?:Bezugs)?[Pp]erson\b|\bBezugsperson\b|\berwachsene[nrs]?\s+(?:Nachbar(?:in)?|Frau|Mann|Dame|Herr)\b/i;

/** The latest state per thing (how many rooms, which knot is tied): a thing named again replaces its earlier entry. */
export function mergeWorldState(
  previous: Array<{ thing: string; now: string; chapter: number }>,
  next: Array<{ thing: string; now: string; chapter: number }>,
  limit = 30,
): Array<{ thing: string; now: string; chapter: number }> {
  const key = (thing: string) => foldUmlauts(thing.toLocaleLowerCase("de-DE")).replace(/[^a-z0-9]+/g, " ").replace(/^(der|die|das|ein|eine) /, "").trim();
  const merged = new Map<string, { thing: string; now: string; chapter: number }>();
  for (const entry of [...previous, ...next]) {
    const id = key(entry.thing);
    if (!id) continue;
    merged.delete(id);
    merged.set(id, entry);
  }
  return [...merged.values()].slice(-limit);
}

/**
 * Quotes that reword a fixed wording go back to its exact text ("Der Kieselgarten auf Reisen", chapter 3: the rhyme
 * came back as „Erst den Gruß sprechen, dann weitergehen; …“ and the next sentence said the lines sounded exactly as at
 * the garden gate — the critic, told to check every quote, let it pass). A quote counts as the wording when it holds at
 * least half of the wording's words (at least four, three letters or more) at about its length; a partial quote with
 * „…“ and a deliberate new verse that shares less stay as they are.
 */
export function restoreFixedWordings(content: string, wordings: Array<{ what: string; text: string }>): { content: string; restored: string[] } {
  let next = String(content || "");
  const restored: string[] = [];
  const significant = (text: string) => words(text).filter((word) => word.length >= 3);
  for (const wording of wordings) {
    const target = String(wording.text || "").trim().replace(/^[„"»«“]+|[“”"«»]+$/g, "").trim();
    const targetWords = significant(target);
    const targetSet = new Set(targetWords);
    if (targetSet.size < 4) continue;
    next = next.replace(/„([^„“”]{8,400})[“”]/g, (match: string, inner: string, offset: number, whole: string) => {
      const said = inner.trim();
      if (said === target || said.replace(/[.!?]$/, "") === target.replace(/[.!?]$/, "") || /…|\.\.\./.test(said)) return match;
      const saidWords = significant(said);
      if (saidWords.length > targetWords.length * 1.5 || saidWords.length < targetWords.length * 0.6) return match;
      const shared = new Set(saidWords.filter((word) => targetSet.has(word))).size;
      if (shared < 4 || shared < targetSet.size * 0.5) return match;
      restored.push(wording.what);
      // German direct speech before its speech tag drops the full stop („… sehen“, sagte er).
      const tagFollows = /^\s*,/.test(whole.slice(offset + match.length));
      return `„${tagFollows ? target.replace(/\.$/, "") : target}“`;
    });
  }
  return { content: next, restored };
}

/** Wordings keep their first version (the plan's or the first chapter's); a thing named again does not replace it. */
export function mergeWordings(
  previous: Array<{ what: string; text: string }>,
  next: Array<{ what: string; text: string }>,
  limit = 14,
): Array<{ what: string; text: string }> {
  const key = (value: string) => foldUmlauts(value.toLocaleLowerCase("de-DE")).replace(/[^a-z0-9]+/g, " ").trim();
  const merged = new Map<string, { what: string; text: string }>();
  for (const entry of [...previous, ...next]) {
    const id = key(entry.what);
    if (id && !merged.has(id)) merged.set(id, entry);
  }
  return [...merged.values()].slice(-limit);
}

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
  // "Der Kieselgarten auf Reisen": „Und fasst meine Steine nicht achtlos an.“ stood alone — a quote without its start.
  for (const paragraph of brokenQuoteParagraphs(chapter.content).slice(0, 2)) {
    at(`die wörtliche Rede in „${paragraph.slice(0, 90)}${paragraph.length > 90 ? " …" : ""}“ ist unvollständig (Anführungszeichen ohne Gegenstück). Stelle den Satz mit Sprecher vollständig her oder streiche den Rest.`, "broken_quote", "hard");
  }
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
  // "Sieben Zimmer und ein Nieser": the writer, told never to invent family, wrote "die vertraute erwachsene Person".
  const stilted = chapter.content.match(STILTED_GROWNUP);
  if (stilted) at(`nennt einen Erwachsenen „${stilted[0]}“. Lass ihn aus dem Bild oder nenne ihn natürlich aus Kindersicht („aus der Küche rief jemand“).`, "stilted_grownup", "soft");
  for (const hit of repeatedPhrases(chapter, input.earlier, input.names)) {
    at(`die Formulierung „${hit.phrase}“ stand schon in Kapitel ${hit.chapter} — variiere sie.`, "repeated_phrase", "soft");
  }
  // 2026-10-16: the prose itself — a script-like chapter is rewritten by the writer (engine.ts), never patched.
  const german = String(input.brief.config.language || "de").toLowerCase().startsWith("de");
  for (const issue of voiceIssues(chapter.content, { german, minWords: Math.round(budget.wordsPerChapterMin * 0.5) })) at(issue.message, issue.code, "soft");
  // 2026-10-16 ("Die Türlaunische"): the same stomach seven times, one handle 47 times, and scenes without the heroes
  // that must stay short (voice.ts). Tics and overused words go to the patch; a long interlude only to the log.
  for (const tic of repeatedTics(chapter.content, input.earlier.map((other) => other.content), { german })) {
    at(`wiederholt ${tic.label} (${tic.total}-mal im Buch bisher, ${tic.here}-mal in diesem Kapitel) — jedes Gefühl bekommt sein eigenes Bild: ersetze die Wiederholung hier durch ein anderes Bild aus der Szene oder streiche sie.`, "repeated_tic", "soft");
  }
  for (const hit of overusedWords(chapter.content, input.names, { german })) {
    at(`das Wort „${hit.word}“ steht ${hit.count}-mal im Kapitel — ein Motiv, das jeden Absatz trägt, nutzt sich ab: an zwei, drei Stellen umschreiben oder weglassen, ohne die Handlung zu ändern.`, "motif_overuse", "soft");
  }
  const interlude = interludeShare(chapter.content, input.brief.heroes.map((hero) => hero.name), mentionsName);
  if (interlude.share > 0.25) at(`Szenen ohne die Helden machen ${Math.round(interlude.share * 100)} % des Kapitels aus — höchstens etwa 15 %: Die Zwischenszene bleibt kurz, und das Kapitel kehrt früher zu den Helden zurück.`, "interlude_long", "soft");
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
  /** Ids of open questions the last batch still leaves unanswered. */
  unanswered?: string[];
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
      voice: entry.voice === undefined || entry.voice === null || entry.voice === "" ? null : score(entry.voice),
      // A lesson the critic quotes but the text does not contain is a guess, like a laugh.
      lesson: (() => { const quoted = quote(entry.lesson); return quoted && quoteInText(quoted, chapter.content) ? quoted : null; })(),
      progress: entry.progress !== false && !/^(false|nein|no)$/i.test(String(entry.progress)),
      missingPlants: (Array.isArray(entry.missingPlants) ? entry.missingPlants : []).map((id: unknown) => String(id).trim().toUpperCase()).filter(Boolean).slice(0, 4),
      ...(Object.keys(unmatched).length ? { unmatched } : {}),
      // 2026-10-16 (plot engine): is anything working against the heroes here; did the heroes invent another chant.
      opponentPresent: typeof entry.opponentPresent === "boolean" ? entry.opponentPresent : /^(true|ja|yes)$/i.test(String(entry.opponentPresent)) ? true : /^(false|nein|no)$/i.test(String(entry.opponentPresent)) ? false : null,
      newChant: (() => { const quoted = quote(entry.newChant); return quoted && quoteInText(quoted, chapter.content) ? quoted : null; })(),
      // 2026-10-19: an easy way the text leaves open counts only with its sentence from the text.
      shortcut: (() => {
        const raw = entry.shortcut;
        if (!raw || typeof raw !== "object") return null;
        const quoted = quote(raw.quote);
        const problem = String(raw.problem ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
        return quoted && problem && !/^(null|none|keine?s?)$/i.test(problem) && quoteInText(quoted, chapter.content) ? { quote: quoted, problem } : null;
      })(),
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
    unanswered: (Array.isArray(parsed.unanswered) ? parsed.unanswered : [])
      .map((id: unknown) => String(id ?? "").trim().toUpperCase())
      .filter((id: string) => /^F\d+$/.test(id))
      .slice(0, 8),
  };
}

/**
 * Open questions after a chapter: answered ones leave, new ones get the next free id. The oldest
 * stay when the list is full — they are the ones in danger of being forgotten.
 */
export function mergeOpenThreads(
  previous: OpenThread[],
  opened: Array<{ chapter: number; question: string }>,
  answered: string[],
  limit = 8,
): OpenThread[] {
  const closed = new Set(answered.map((id) => String(id).trim().toUpperCase()));
  const kept = previous.filter((thread) => !closed.has(thread.id));
  const key = (value: string) => foldUmlauts(value.toLocaleLowerCase("de-DE")).replace(/[^a-z0-9]+/g, " ").trim();
  const seen = new Set(kept.map((thread) => key(thread.question)));
  let next = previous.reduce((max, thread) => Math.max(max, Number(thread.id.slice(1)) || 0), 0);
  for (const entry of opened) {
    const id = key(entry.question);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    kept.push({ id: `F${++next}`, chapter: entry.chapter, question: entry.question });
  }
  return kept.slice(0, limit);
}

/** A patched chapter keeps at least 80 % of its words and grows by two or three sentences at most. */
export function acceptableChapterPatch(before: string, after: string): boolean {
  const original = words(before);
  const patched = words(after);
  if (patched.length === 0 || patched.length - original.length > 60 || patched.length < original.length * 0.85) return false;
  const kept = new Set(patched);
  return original.filter((word) => kept.has(word)).length >= original.length * 0.8;
}

/**
 * Sentences a patch ADDED that say again what the chapter already says. "Die Flotte der Minuten", chapter 1: the cold
 * reader missed the goal, the patch added it once more next to the author's own lines („Alexander hielt die Stoffbahn
 * hoch …" right after „Alexander hielt neben ihm eine Stoffbahn hoch …"). An added sentence goes when it shares at least
 * four word stems and 60 % of the shorter sentence with an author's sentence that is still there; an author's sentence
 * the patch reworded is gone from the text, so its new wording stays.
 */
export function dropEchoedSentences(before: string, after: string): string {
  const sentencesOf = (text: string) => text.match(/[^.!?…]+(?:[.!?…]+[“”"»«]*|$)/g) || [];
  const stems = (sentence: string) => new Set(words(sentence).filter((word) => word.length >= 4).map((word) => word.slice(0, 5)));
  // Short lines of dialogue carry few long words: "Luna und der Brunnenbrief", chapter 1 — the laugh patch added
  // „Ich sehe jedenfalls niemanden.“ next to the author's „Ich sehe niemanden.“ Here every word of three letters counts.
  const shortWords = (sentence: string) => new Set(words(sentence).filter((word) => word.length >= 3));
  const overlap = (mine: Set<string>, other: Set<string>) => {
    let shared = 0;
    for (const item of mine) if (other.has(item)) shared += 1;
    return { shared, ratio: shared / Math.max(1, Math.min(mine.size, other.size)) };
  };
  const original = sentencesOf(before).map((sentence) => sentence.trim()).filter(Boolean);
  const originalSet = new Set(original);
  const kept = original.filter((sentence) => after.includes(sentence));
  const stillThere = kept.map(stems);
  const stillThereShort = kept.map(shortWords);
  // A sentence the patch reworded is gone from the text; its new wording is never an echo, however much it resembles others.
  const removedShort = original.filter((sentence) => !after.includes(sentence)).map(shortWords);
  const echoes = (sentence: string) => {
    const rewording = removedShort.some((other) => overlap(shortWords(sentence), other).ratio >= 0.5);
    if (rewording) return false;
    const mine = stems(sentence);
    if (mine.size >= 4 && stillThere.some((other) => {
      const { shared, ratio } = overlap(mine, other);
      return shared >= 4 && ratio >= 0.6;
    })) return true;
    const short = shortWords(sentence);
    return short.size >= 3 && stillThereShort.some((other) => other.size >= 3 && (() => {
      const { shared, ratio } = overlap(short, other);
      return shared >= 3 && ratio >= 0.75;
    })());
  };
  return after
    .split(/\n\s*\n/)
    .map((paragraph) => {
      const parts = sentencesOf(paragraph);
      const keep = parts.filter((part) => originalSet.has(part.trim()) || !echoes(part.trim()));
      const filtered = keep.join("").trim();
      if (keep.length === parts.length || quoteBalance(filtered) === quoteBalance(paragraph)) return filtered;
      // "Der Kieselgarten auf Reisen", chapter 2: the patch let the troll introduce himself a second time in one quote;
      // its first two sentences went as echoes and „Und fasst meine Steine nicht achtlos an.“ stayed without its opening
      // and its speaker. A quote is never cut: an added paragraph that mostly repeats goes whole, any other stays whole.
      const added = !parts.some((part) => originalSet.has(part.trim()));
      return added && keep.length * 2 <= parts.length ? "" : paragraph.trim();
    })
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Opening minus closing quotation marks: zero when every quote of the text is complete. German „…“ (closed by “ or ”);
 * without a „ the curly pair is English “…” — so a German line left with only its closing “ counts as open. Guillemets
 * pair in either direction (»…« or «…»), straight quotes by parity.
 */
export function quoteBalance(text: string): number {
  const value = String(text || "");
  const count = (pattern: RegExp) => (value.match(pattern) || []).length;
  const curly = value.includes("„") ? count(/„/g) - count(/[“”]/g) : count(/“/g) - count(/”/g);
  return curly + (count(/»/g) - count(/«/g)) + (count(/"/g) % 2);
}

/** Paragraphs whose direct speech opens without closing or closes without opening (a patch cut, a lost line). */
export function brokenQuoteParagraphs(content: string): string[] {
  return String(content || "").split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter((paragraph) => paragraph && quoteBalance(paragraph) !== 0);
}

/** The patch returns only changed chapters; unknown numbers or a rewritten chapter are rejected. */
export function mergeChapterPatch(raw: string, chapters: BookChapter[], german: boolean): BookChapter[] {
  const changed = parseChapters(raw, { german });
  if (!changed.length || changed.some((entry) => !chapters.some((chapter) => chapter.order === entry.order))) return chapters;
  return chapters.map((chapter) => {
    const next = changed.find((entry) => entry.order === chapter.order);
    return next && acceptableChapterPatch(chapter.content, next.content) ? { ...chapter, content: dropEchoedSentences(chapter.content, next.content) } : chapter;
  });
}