/**
 * Chapter book — the narrator's voice ("Buchgefühl").
 *
 * Trigger (2026-10-16, "Der Regen sagt rückwärts", 8 chapters, 6-8): the book
 * had a plan, a running gag, hooks and a laugh per chapter — and still read
 * like a screenplay. Measured on the released text: 4,864 words, 6.4 words per
 * sentence on average, more than half of all words inside quotation marks,
 * not one named feeling or thought in eight chapters, four mottos ("Hör erst
 * hin …") instead of one. The family's benchmark („Zippel, das wirklich wahre
 * Schlossgespenst“, Alex Rühle) does the opposite: a warm, dry narrator who
 * enjoys his heroes and says so, long flowing sentences next to short ones,
 * the boy's thoughts and worries on the page, two or three exact everyday
 * details per scene, and jokes that work when read aloud.
 *
 * Root cause was our own writer prompt. It said "Show feelings through
 * behaviour and dialogue, not by naming them", "short and medium sentences",
 * "no narrator comments" — and gave a picture-book rhythm sample. The writer
 * obeyed. This module replaces those rules with chapter-book rules, gives the
 * writer a chapter-book sample, and measures the released text so that a
 * script-like chapter is rewritten (a patch cannot add a narrator).
 *
 * Nothing here names the benchmark's motifs; the book is named in comments only.
 */

import type { AgeBand } from "../craft";

/**
 * Writer rules that make a chapter read like a book. English for the model; the reader never sees them.
 * Generic by design: nothing here knows the genre, the heroes or any story — only the age band and the
 * language, so the same rules serve every wizard configuration, every avatar and every cast.
 */
export function narratorVoiceRules(band: AgeBand, language: string): string[] {
  const young = band === "3-5";
  const old = band === "9-12";
  const innerMoments = young ? "one or two" : "two or three";
  const rhythm = young
    ? "mostly medium and short sentences, with a longer flowing one now and then that carries a small scene; the youngest listeners need to see every sentence at once."
    : old
      ? "long, flowing sentences that carry a scene or a thought through two or three turns, medium ones for the action, short ones for a bang — and the occasional dry one-liner."
      : "long, flowing sentences that carry a scene or a thought through two or three turns, medium ones for the action, short ones for a bang.";
  return [
    "NARRATOR VOICE (what makes this a book and not a script):",
    `- A narrator tells this — warm, a little dry, fond of the heroes, seeing a bit more than they do. Now and then the narrator says so in half a sentence: a dry aside, an understatement, a "what nobody knew yet", a small exaggeration taken back at once. ${young ? "Once per chapter" : "Once or twice per chapter"} the narrator may turn to the listening child directly — never to explain, never to teach.`,
    `- Inner life: we hear what the heroes think and feel. A thought in their own words, a wish, a worry, a plan forming, a feeling named the way a child of that age names it (a hot face, a stomach that drops, a lump in the throat, "most of all he wanted to …"). At least ${innerMoments} such moments per chapter, each short, then back to the action. Behaviour and dialogue carry the rest — but not every feeling has to be acted out.`,
    `- Rhythm: sentences of every length — ${rhythm} A chapter is roughly half narration (what happens, what it looks and sounds like, what someone thinks) and half dialogue. Never more than four lines of dialogue in a row without a narrating sentence between them; never five sentences of under six words in a row. Paragraphs of two to six sentences; one-sentence paragraphs only for a bang or a punchline.`,
    "- Scene detail: every scene has two or three exact, sensory details a child could draw or hear — the sound a thing makes, how it smells, what it looks like up close — told in passing, inside the action. Details belong to the story's own world (its genre, place and time), never to another.",
    `- Read-aloud test: every joke, misunderstanding, invented word or wordplay must work when a parent reads it aloud at speed in ${language} — pronounceable, understandable by ear, repeatable at the dinner table. Nothing that only works on paper: no letter puzzles, no words spelled or read backwards, no reversed sentences. Explain nothing twice.`,
    "- One motto at most: the whole book may hold one short rule-of-thumb, rhyme or saying (the bible's fixed wording) — never a new one per chapter, never a lesson summed up in a sentence by anyone. No semicolons, no adult abstractions, no narrator question as a chapter ending, no comments on the storytelling itself, no morals. The warmth sits in what happens and in how the narrator looks at it.",
    "- Grown-ups and other big figures in a scene stay people: they talk the way such people really talk to children (distracted, kind, in a hurry, half listening), and the comedy comes from the gap between what they see and what the heroes know.",
  ];
}

/**
 * Chapter-book rhythm sample, written for this pipeline (no book, no pool character, no family member).
 * It shows what the picture-book sample cannot: a narrator with an opinion, a thought on the page, a long
 * sentence that carries a scene, dialogue woven into narration, one exact detail per beat. The writer is
 * told to copy nothing from it; it is handed out for German only, like the picture-book sample before it.
 */
export const STYLE_SAMPLE_BOOK_DE = [
  "Es gibt Nachmittage, an denen nichts passiert, und es gibt Nachmittage, an denen alles auf einmal passiert. Dieser hier fing als der erste an und wurde dann sehr schnell der zweite.",
  "Jonte saß auf der Kellertreppe und zählte die Stufen, obwohl er genau wusste, dass es vierzehn waren. Er zählte sie, weil man beim Zählen nicht nachdenken muss, und nachdenken wollte er gerade nicht. Unten im Keller stand nämlich der Koffer, und der Koffer hatte vorhin geniest.",
  "„Koffer niesen nicht“, hatte Frau Leuchter von nebenan gesagt, ohne von ihrer Zeitung aufzusehen. „Das ist die Heizung.“",
  "Die Heizung war seit März aus. Das hätte Jonte ihr sagen können, aber Erwachsene, das hatte er längst herausgefunden, hören einem am besten zu, wenn man gar nichts sagt.",
  "Also ging er hinunter. Langsam. Stufe für Stufe, und bei der elften blieb er stehen, weil ihm der Bauch kalt wurde und weil er plötzlich fand, dass vierzehn Stufen eigentlich ziemlich viele sind.",
  "Der Koffer stand da, wo er immer stand, zwischen den Einmachgläsern und dem Schlitten. Er sah vollkommen harmlos aus. Braun, verbeult, mit einem Aufkleber von einem Ort, den niemand mehr lesen konnte.",
  "„Hatschi“, sagte der Koffer.",
  "Jonte sagte eine ganze Weile gar nichts. Dann sagte er das, was ihm als Erstes einfiel, und es war nicht sehr klug: „Gesundheit.“",
].join("\n");

// ---------------------------------------------------------------------------
// Measuring the released text
// ---------------------------------------------------------------------------

/** What the prose looks like in numbers. Language-neutral except innerLife (German word lists). */
export interface ProseProfile {
  words: number;
  sentences: number;
  avgSentenceLength: number;
  /** Share of sentences with at most four words. */
  shortSentenceShare: number;
  /** Longest run of consecutive sentences under six words. */
  longestShortRun: number;
  /** Share of words inside quotation marks. */
  dialogueShare: number;
  /** Named feelings and thoughts (German lists); -1 when the language is not German. */
  innerLife: number;
}

const QUOTED = /„[^“]*“|»[^«]*«|"[^"]*"|“[^”]*”/g;

// Feelings as a six-year-old names them, plus the body (a hot face, a cold stomach) and thought verbs.
const FEELING_DE = /(?<!\p{L})(angst|ängstlich|mutig|traurig|froh|fröhlich|glücklich|stolz|wütend|wut|ärger\p{L}*|sauer|aufgeregt|nervös|erschrak\p{L}*|erschrocken|schreck\p{L}*|freute\p{L}*|freude|schämte\p{L}*|peinlich|verlegen|neidisch|eifersüchtig|enttäuscht|erleichtert|einsam|sehnte\p{L}*|vermisste\p{L}*|hoffte\p{L}*|hoffnung|fürchtete\p{L}*|befürchtete\p{L}*|zweifel\p{L}*|unsicher|mulmig|flau|kribbel\p{L}*|kloß|heiß im gesicht|rot im gesicht|herz klopfte|herzklopfen|bauch (?:wurde|war) (?:kalt|schwer|warm|leicht)|magen|zitter\p{L}*|traute sich|erleichtert|begeistert|neugierig|verwirrt|ratlos|unglücklich|gern|lieber|am liebsten)(?!\p{L})/giu;
const THOUGHT_DE = /(?<!\p{L})(dachte\p{L}*|überlegte\p{L}*|fragte sich|fragten sich|wusste\p{L}*|ahnte\p{L}*|wünschte\p{L}*|merkte\p{L}*|spürte\p{L}*|fühlte\p{L}*|verstand\p{L}*|glaubte\p{L}*|fand\p{L}* (?:das|es|ihn|sie)|hätte\p{L}* (?:gern|lieber|am liebsten)|wollte\p{L}* (?:nicht|gerade|lieber|am liebsten)|fiel\p{L}* (?:ihm|ihr|ihnen) ein|kam\p{L}* (?:ihm|ihr|ihnen) (?:komisch|seltsam|vor))(?!\p{L})/giu;

function tokens(text: string): string[] {
  return String(text || "").match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || [];
}

function sentencesOf(text: string): string[] {
  return String(text || "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?…]["“”»«]?)\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => tokens(sentence).length > 0);
}

export function proseProfile(content: string, options: { german?: boolean } = {}): ProseProfile {
  const text = String(content || "");
  const all = tokens(text);
  const sentences = sentencesOf(text);
  const lengths = sentences.map((sentence) => tokens(sentence).length);
  let run = 0;
  let longestShortRun = 0;
  for (const length of lengths) {
    run = length < 6 ? run + 1 : 0;
    longestShortRun = Math.max(longestShortRun, run);
  }
  const quotedWords = (text.match(QUOTED) || []).reduce((sum, quote) => sum + tokens(quote).length, 0);
  let innerLife = -1;
  if (options.german !== false) {
    const feelings = (text.match(FEELING_DE) || []).length;
    const thoughts = (text.match(THOUGHT_DE) || []).length;
    innerLife = feelings + thoughts;
  }
  return {
    words: all.length,
    sentences: sentences.length,
    avgSentenceLength: sentences.length ? Math.round((all.length / sentences.length) * 10) / 10 : 0,
    shortSentenceShare: lengths.length ? Math.round((lengths.filter((length) => length <= 4).length / lengths.length) * 100) / 100 : 0,
    longestShortRun,
    dialogueShare: all.length ? Math.round((Math.min(quotedWords, all.length) / all.length) * 100) / 100 : 0,
    innerLife,
  };
}

export interface VoiceIssue {
  code: "staccato" | "dialogue_heavy" | "no_inner_life";
  message: string;
}

/**
 * Thresholds from the measured book ("Der Regen sagt rückwärts": 6.4 words per sentence, dialogue over half, inner
 * life 0) against read-aloud chapter books (9-13 words per sentence, dialogue a third to a half, a feeling or
 * thought every 60-100 words). A chapter trips "staccato" only when both the average and the short-sentence share
 * say so — a tense scene may be short on purpose.
 */
export function voiceIssues(content: string, options: { german?: boolean; minWords?: number } = {}): VoiceIssue[] {
  const profile = proseProfile(content, options);
  const minWords = options.minWords ?? 250;
  if (profile.words < minWords) return [];
  const issues: VoiceIssue[] = [];
  if (profile.avgSentenceLength < 8 && (profile.shortSentenceShare >= 0.3 || profile.longestShortRun >= 6)) {
    issues.push({
      code: "staccato",
      message: `liest sich wie ein Drehbuch: im Schnitt ${profile.avgSentenceLength} Wörter pro Satz, ${Math.round(profile.shortSentenceShare * 100)} % der Sätze haben höchstens vier Wörter. Erzähl es wie ein Buch — mit einer Erzählstimme, längeren fließenden Sätzen neben kurzen, Gedanken und Gefühlen der Helden und genauen Details der Szene.`,
    });
  }
  if (profile.dialogueShare > 0.6) {
    issues.push({
      code: "dialogue_heavy",
      message: `besteht zu ${Math.round(profile.dialogueShare * 100)} % aus wörtlicher Rede. Etwa die Hälfte eines Kapitels erzählt: was passiert, wie es aussieht und klingt, was die Helden dabei denken.`,
    });
  }
  if (profile.innerLife === 0) {
    issues.push({
      code: "no_inner_life",
      message: "nennt an keiner Stelle, was ein Held denkt oder fühlt. Zwei, drei kurze Momente Innenleben pro Kapitel (ein Gedanke, ein Wunsch, ein mulmiger Bauch) machen aus der Szene eine Geschichte.",
    });
  }
  return issues;
}

/** Codes a patch cannot fix: they are rewrite reasons, never patch notes. */
export const VOICE_REWRITE_CODES = new Set<string>(["staccato", "dialogue_heavy", "no_inner_life"]);

/** A chapter is rewritten for its voice when the text itself is script-like, or when two softer signs come together. */
export function voiceRewriteNeeded(issues: Array<{ code: string }>, criticVoice: number | null | undefined): boolean {
  const codes = new Set(issues.map((issue) => issue.code));
  if (codes.has("staccato")) return true;
  if (codes.has("dialogue_heavy") && codes.has("no_inner_life")) return true;
  if (typeof criticVoice === "number" && criticVoice > 0 && criticVoice <= VOICE_REWRITE_MAX_SCORE && codes.size > 0) return true;
  return false;
}

/** The critic's voice score at or under which a chapter with any measured voice issue is rewritten. */
export const VOICE_REWRITE_MAX_SCORE = 5;
