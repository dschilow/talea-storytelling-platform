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
    // 2026-10-16 ("Die Türlaunische"): the examples given here ("a hot face, a stomach that drops") came back seven times in one
    // book, with the same nudge of the elbow three times. The rule now asks for variety and names no image.
    `- Inner life: we hear what the heroes think and feel. A thought in their own words, a wish, a worry, a plan forming, a feeling named the way a child of that age names it — in the body, in a comparison from the story's own world, or in a plain word. At least ${innerMoments} such moments per chapter, each short, then back to the action. Every feeling gets its own picture: no body image (what the face, the stomach, the throat does) and no gesture between the heroes (a nudge, a lean, a squeeze of the hand) is used more than once in the whole book. Behaviour and dialogue carry the rest — but not every feeling has to be acted out.`,
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

/**
 * The critic's voice score from which a measured issue is disputed (2026-10-16, "Die Türlaunische": four chapters were
 * rewritten as script-like for 6.5 ct while the critic had rated their voice 8-9; the rewrites changed the prose
 * profile hardly at all). Staccato alone against such a score is no longer a rewrite; two measured signs still are.
 */
export const VOICE_DISPUTE_MIN_SCORE = 8;

/** True when the critic's voice score contradicts the measured issues strongly enough to skip the rewrite. */
export function voiceRewriteDisputed(issues: Array<{ code: string }>, criticVoice: number | null | undefined): boolean {
  if (typeof criticVoice !== "number" || criticVoice < VOICE_DISPUTE_MIN_SCORE) return false;
  const codes = new Set(issues.map((issue) => issue.code));
  // One measured sign against a confident second reader: no rewrite. Two signs together still win.
  return codes.size <= 1;
}

// ---------------------------------------------------------------------------
// Tics, overused words and scenes without the heroes (2026-10-16, "Die Türlaunische")
// ---------------------------------------------------------------------------

/**
 * Body images and gestures a writer reaches for again and again: a feeling in the stomach seven times, a hot face
 * twice, "pressed his lips together, but the laugh came out anyway" twice almost word for word, a nudge with the
 * elbow three times — in one book. The first is a feeling, the third is a tic. German lists; other languages measure nothing.
 */
const TIC_PATTERNS_DE: Array<{ key: string; label: string; pattern: RegExp }> = [
  { key: "bauch", label: "ein Gefühl im Bauch", pattern: /\bim bauch\b|\bbauch (wurde|war|zog|kribbelte|machte|eng)\b|\b(knoten|ziehen|kribbeln|flattern) (im|in seinem|in ihrem) bauch\b|\bbauchgefühl\b/giu },
  { key: "gesicht", label: "ein heißes oder rotes Gesicht", pattern: /\b(heiß|heiss|warm|rot) (im|ins) gesicht\b|\bgesicht (wurde|war) (heiß|heiss|rot|warm)\b|\bheißes gesicht\b|\bwurde (ihm|ihr) heiß\b/giu },
  { key: "lippen", label: "zusammengepresste Lippen", pattern: /\bpresste (die|seine|ihre) lippen (zusammen|aufeinander)\b|\bbiss sich auf die lippe\b/giu },
  { key: "ellbogen", label: "ein Stupsen mit dem Ellbogen", pattern: /\bell(en)?bogen\b/giu },
  { key: "kloss", label: "ein Kloß im Hals", pattern: /\bklo(ß|ss) im hals\b/giu },
  { key: "herz", label: "ein klopfendes oder hüpfendes Herz", pattern: /\bherz (klopfte|hüpfte|pochte|machte einen (sprung|satz)|schlug (schneller|bis zum hals|wie wild))\b|\bherzklopfen\b/giu },
  { key: "schulter", label: "eine Schulter zum Anlehnen", pattern: /\b(lehnte|legte) (sich |den kopf |die schulter |kurz )?(an|gegen) (seine|ihre|die) schulter\b|\bschulter an schulter\b/giu },
  { key: "atem", label: "ein angehaltener oder ausgestoßener Atem", pattern: /\bhielt (den|die) (atem|luft) an\b|\batmete (hörbar |tief |laut |erleichtert )?(aus|ein)\b/giu },
  { key: "hand", label: "eine Hand, die gedrückt oder gegriffen wird", pattern: /\b(griff|nahm) (nach )?(seine|ihre|die) hand\b|\bdrückte (seine|ihre|die) hand\b|\bhand in hand\b/giu },
  // "Der Kieselgarten auf Reisen": a figure laughing at the joke in five chapters, Rotkäppchen three times over her basket.
  // The child laughs; a figure who laughs along is a laugh track.
  { key: "lachen", label: "eine Figur, die über den Witz lacht", pattern: /\bmusste(n)? (\p{L}+ )?(lachen|kichern|grinsen)\b|\bhätte(n)? (beinahe|fast) (los)?gelacht\b|\b(ihr|sein|das) lachen( \p{L}+){0,3} (hätte|konnte|kam|platzte|steckte|verstecken|unterdrücken|verkneifen)\b/giu },
];

function ticCountsDe(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const tic of TIC_PATTERNS_DE) {
    const n = (String(text || "").match(tic.pattern) || []).length;
    if (n) counts.set(tic.key, n);
  }
  return counts;
}

export interface RepeatedTic {
  key: string;
  label: string;
  /** Occurrences in this chapter. */
  here: number;
  /** Occurrences in the whole book up to and including this chapter. */
  total: number;
}

/**
 * Tics of this chapter that the book already leans on: a body image or gesture that stands at least three times in
 * the book so far (this chapter included), or twice in this chapter alone. Reported once per image per chapter.
 */
export function repeatedTics(content: string, earlier: string[], options: { german?: boolean } = {}): RepeatedTic[] {
  if (options.german === false) return [];
  const here = ticCountsDe(content);
  if (!here.size) return [];
  const before = ticCountsDe(earlier.join("\n"));
  const out: RepeatedTic[] = [];
  for (const tic of TIC_PATTERNS_DE) {
    const now = here.get(tic.key) || 0;
    if (!now) continue;
    const total = now + (before.get(tic.key) || 0);
    if (total >= 3 || now >= 2) out.push({ key: tic.key, label: tic.label, here: now, total });
  }
  return out;
}

// German function words a noun heuristic must not count (capitalised at a sentence start they look like nouns).
const CAPITALISED_STOPWORDS_DE = new Set(["dann", "aber", "doch", "jetzt", "nein", "also", "wenn", "weil", "oder", "denn", "noch", "nicht", "schon", "auch", "nur", "sogar", "erst", "dort", "hier", "dahinter", "davor", "dabei", "damit", "danach", "zuerst", "diesmal", "manchmal", "irgendwo", "nichts", "alles", "etwas", "jemand", "niemand", "endlich", "vielleicht", "bestimmt", "sofort", "plötzlich", "langsam", "leise", "immer", "wieder", "gleich", "heute", "morgen", "gestern", "unten", "oben", "draußen", "drinnen", "hinten", "vorn", "vorne", "links", "rechts", "einmal", "zweimal", "dreimal", "kein", "keine", "keiner", "einen", "einem", "einer", "eines", "seine", "ihre", "sein", "ihr", "dieser", "diese", "dieses", "jeder", "jede", "jedes", "beide", "mein", "dein", "unser", "euer", "welche", "welcher", "warum", "wohin", "woher", "wann", "wer", "was", "wie", "wo", "ganz", "sehr", "fast", "kaum", "gern", "gerne", "lieber", "mehr", "weniger", "eben", "halt", "bitte", "danke", "genau", "richtig", "falsch", "natürlich", "trotzdem", "außerdem", "deshalb", "darum", "sonst", "statt", "während", "bevor", "nachdem", "sobald", "solange", "obwohl", "seit", "bis", "über", "unter", "hinter", "neben", "zwischen", "gegen", "durch", "ohne", "für", "mit", "nach", "aus", "bei", "von", "zu", "um", "am", "im", "ins", "ans", "beim", "vom", "zum", "zur", "der", "die", "das", "den", "dem", "des", "ein", "eine", "und", "ja", "nun", "na", "ach", "oh", "hm", "stimmt", "schnell", "still", "weit", "nah", "hoch", "tief", "kurz", "lang", "neu", "alt", "gut", "böse", "groß", "klein", "warm", "kalt", "hell", "dunkel", "laut", "leer", "voll", "da", "so", "es", "er", "sie", "wir", "ihm", "ihn", "uns", "euch", "ihnen", "sich", "man", "wird", "war", "waren", "wurde", "wurden", "hatte", "hatten", "hat", "ist", "sind", "kam", "kamen", "ging", "gingen", "sagte", "sagten", "fragte", "rief", "riefen", "machte", "stand", "standen", "blieb", "blieben", "lag", "lagen", "saß", "saßen", "sah", "sahen", "hörte", "hörten", "nahm", "gab", "lief", "liefen", "kling", "klang", "tack", "ting", "plopp"]);

export interface OverusedWord {
  word: string;
  count: number;
}

/**
 * Nouns a chapter leans on too hard ("Die Türlaunische": one handle 47 times, one silver wave 46 times in 7,700 words).
 * German only: nouns are capitalised, and a capitalised word inside a sentence is a noun often enough. Names and the
 * sound words of the book's own refrains are skipped. Threshold: about one mention per 90 words, at least seven.
 */
export function overusedWords(content: string, names: string[], options: { german?: boolean; perWords?: number; min?: number } = {}): OverusedWord[] {
  if (options.german === false) return [];
  const text = String(content || "");
  const total = tokens(text).length;
  if (total < 300) return [];
  const nameTokens = new Set(names.flatMap((name) => tokens(name)).map((token) => token.toLocaleLowerCase("de-DE")));
  const counts = new Map<string, number>();
  const pattern = /(^|[^.!?…“"»\n]\s|[,;:–—(]\s*)([A-ZÄÖÜ][\p{Ll}]{3,})/gmu;
  for (const match of text.matchAll(pattern)) {
    const word = match[2];
    const key = word.toLocaleLowerCase("de-DE");
    if (nameTokens.has(key) || CAPITALISED_STOPWORDS_DE.has(key)) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }
  const limit = Math.max(options.min ?? 7, Math.round(total / (options.perWords ?? 90)));
  return [...counts.entries()]
    .filter(([, count]) => count >= limit)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word, count]) => ({ word, count }));
}

const INTERLUDE_OPENER_DE = /^[„"]?(unterdessen|währenddessen|derweil|inzwischen|indessen|in der zwischenzeit|zur (selben|gleichen) (zeit|stunde)|um (dieselbe|die gleiche) zeit|zu (dieser|derselben) (zeit|stunde)|weit (weg|entfernt|draußen)|ganz woanders|am anderen ende|nicht weit (davon|entfernt)|zur gleichen minute)\b/iu;

export interface InterludeProfile {
  /** Share of the chapter's words in scenes without the heroes. */
  share: number;
  /** Number of such passages. */
  passages: number;
  /** The chapter opens without the heroes for at least three paragraphs (a cold open). */
  coldOpen: boolean;
}

/**
 * Scenes without the heroes, measured: a paragraph that opens with a time cue ("Unterdessen …") starts one, the
 * next paragraph that names a hero ends it; an opening run of three or more paragraphs without a hero is a cold open.
 * Approximate on purpose — a paragraph about the heroes that uses only pronouns counts until a name falls.
 */
export function interludeShare(content: string, heroNames: string[], mentionsHero: (paragraph: string, name: string) => boolean = (paragraph, name) => paragraph.toLocaleLowerCase("de-DE").includes(name.toLocaleLowerCase("de-DE"))): InterludeProfile {
  const paragraphs = String(content || "").split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const total = tokens(content).length;
  if (!paragraphs.length || !total) return { share: 0, passages: 0, coldOpen: false };
  const namesHero = (paragraph: string) => heroNames.some((name) => mentionsHero(paragraph, name));
  let words = 0;
  let passages = 0;
  let inside = false;
  let leading = 0;
  while (leading < paragraphs.length && !namesHero(paragraphs[leading])) leading += 1;
  const coldOpen = leading >= 3 && leading < paragraphs.length;
  for (const [index, paragraph] of paragraphs.entries()) {
    if (coldOpen && index < leading) {
      words += tokens(paragraph).length;
      if (index === 0) passages += 1;
      continue;
    }
    if (INTERLUDE_OPENER_DE.test(paragraph)) {
      inside = true;
      passages += 1;
    } else if (inside && namesHero(paragraph)) {
      inside = false;
    }
    if (inside) words += tokens(paragraph).length;
  }
  return { share: Math.round((Math.min(words, total) / total) * 100) / 100, passages, coldOpen };
}

/** Codes that the log keeps but no patch is asked to fix (a patch keeps 85 % of the words; it cannot shorten a scene). */
export const LOG_ONLY_CODES = new Set<string>(["interlude_long"]);
