/**
 * Learning mode — how a story teaches, for every pipeline (picture book, chapter book, normal mode).
 *
 * Audit 2026-10-17, without new generations (Logs/storybook-v2-release B4 + B8, Logs/Stories eefd3600 + 69dace41):
 * - Normal mode, what customers get: "math (intermediate). Weave in gently" reached the idea lab and the draft, never
 *   the beat sheet, the scene cards or the validator. "Die Karte der verirrten Füchse" (maths) held no maths beyond
 *   „Sieben. Zwölf. Neunzehn.“; "Der Brunnen der lauten Launen" (geography) became a crank repair; the developments
 *   gave teamwork.
 * - Picture book (Sol, 11 hedgehog and 10 doubling stories): the fact was right and carried the solution, but sat in ONE
 *   dense sentence a page before the end, in grown-up words („Energieverbrauch“, „der Körper fährt herunter“), never came
 *   back, and the listening child was never asked anything. In 9 of 10 doubling stories a magic box did the doubling and
 *   the heroes only counted.
 * - Chapter book: the critic flagged "anything a child is supposed to learn from" as a lesson and the patch struck it.
 *
 * What the rules below ask for is what makes children keep knowledge from a story: it is causally central to the plot,
 * a wrong belief is voiced and visibly fails before the right one, it is said explicitly in children's words with one
 * familiar comparison, it comes back spread over the story and is retold once at the end, and fantasy never blurs what
 * is real. Side facts dilute the core.
 *
 * Pure module: no model calls, no Encore imports — the storybook, book and dev-mode engines all read it.
 */

import type { StoryConfig } from "../generate";
import type { AgeBand } from "./craft";

export type LearningForm = "picturebook" | "chapterbook" | "story";
type Difficulty = "beginner" | "intermediate" | "advanced";
type Assessment = "interactive" | "quiz" | "discussion";

export interface LearningGoal {
  subjects: string[];
  objectives: string[];
  difficulty: Difficulty;
  assessment: Assessment;
}

function clean(value: unknown, max = 160): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

/** The family's learning wish; null when learning mode is off or names no subject. */
export function learningGoal(config: Pick<StoryConfig, "learningMode"> | null | undefined): LearningGoal | null {
  const mode = config?.learningMode;
  if (!mode?.enabled) return null;
  const subjects = (Array.isArray(mode.subjects) ? mode.subjects : []).map((subject) => clean(subject, 40)).filter(Boolean);
  if (!subjects.length) return null;
  return {
    subjects,
    objectives: (Array.isArray(mode.learningObjectives) ? mode.learningObjectives : []).map((objective) => clean(objective)).filter(Boolean).slice(0, 3),
    difficulty: mode.difficulty === "intermediate" || mode.difficulty === "advanced" ? mode.difficulty : "beginner",
    assessment: mode.assessmentType === "quiz" || mode.assessmentType === "discussion" ? mode.assessmentType : "interactive",
  };
}

/** Wizard subject ids (Step6LearningMode): labels, the craft of teaching each, and the traits a learned fact grows. */
const SUBJECTS: Record<string, { en: string; de: string; craft: string; traitsDe: string; traitsEn: string }> = {
  math: {
    en: "maths (counting, arithmetic, quantities, shapes, measuring)",
    de: "Mathe (Zählen, Rechnen, Mengen, Formen, Messen)",
    craft: "Maths lives in things: the heroes count, compare, share, measure or calculate with objects on the page, slowly enough that the listening child can count along. Every number and every sum is right. The heroes work it out themselves and say what they expect before it is checked; magic or a grown-up may only confirm the result, never do the thinking.",
    traitsDe: "knowledge.mathematics",
    traitsEn: "knowledge.mathematics",
  },
  science: {
    en: "science (how nature, animals, the body and technology work)",
    de: "Naturwissenschaft (wie Natur, Tiere, Körper und Technik funktionieren)",
    craft: "Science goes observe → guess → try → see → explain. Name the real cause. Animals, plants, weather, materials and the body behave as they do in reality.",
    traitsDe: "die passende Wissens-Unterkategorie: knowledge.biology (Tiere, Pflanzen, Körper), knowledge.physics (Kräfte, Licht, Schall, Wärme, Magnete, Schwimmen und Sinken), knowledge.chemistry (Stoffe, Mischen, Lösen, Schmelzen), knowledge.astronomy (Sonne, Mond, Sterne, Planeten)",
    traitsEn: "the matching knowledge subcategory: knowledge.biology (animals, plants, the body), knowledge.physics (forces, light, sound, heat, magnets, floating and sinking), knowledge.chemistry (materials, mixing, dissolving, melting), knowledge.astronomy (sun, moon, stars, planets)",
  },
  language: {
    en: "language (words, rhymes, letters, listening closely)",
    de: "Sprache (Wörter, Reime, Buchstaben, genaues Zuhören)",
    craft: "Language works by ear: sounds, rhymes, what a word means and how it is used. A new word gets its meaning from the scene and comes back later. Nothing depends on seeing letters or spelling.",
    traitsDe: "vocabulary",
    traitsEn: "vocabulary",
  },
  history: {
    en: "history (how people lived in the past)",
    de: "Geschichte (wie Menschen früher lebten)",
    craft: "History shows how people really lived — through concrete things (food, clothes, tools, light, travel, school) that the heroes use, try or compare with today. No invented historical facts; a journey into the past or a figure from back then may frame it.",
    traitsDe: "knowledge.history",
    traitsEn: "knowledge.history",
  },
  geography: {
    en: "geography (countries, landscapes, weather, maps, compass directions)",
    de: "Erdkunde (Länder, Landschaften, Wetter, Karten, Himmelsrichtungen)",
    craft: "Geography uses real places, landscapes, weather, maps or compass directions; the heroes use the knowledge to find their way or to understand why a place is as it is. Directions, distances and natural facts are right.",
    traitsDe: "knowledge.geography",
    traitsEn: "knowledge.geography",
  },
  social: {
    en: "living together (recognising feelings, sharing, resolving quarrels, consideration)",
    de: "Miteinander (Gefühle erkennen, teilen, Streit lösen, Rücksicht nehmen)",
    craft: "Living together: the knowledge is a skill a child can use (noticing what someone feels, calming down, sharing fairly, making up after a quarrel). The heroes try it, it is hard or goes wrong at first, then it works — shown in what they do, named once in a child's words, never preached.",
    traitsDe: "empathy (Gefühle erkennen und darauf eingehen) oder teamwork (teilen, Streit lösen, gemeinsam handeln)",
    traitsEn: "empathy (noticing and answering feelings) or teamwork (sharing, solving a quarrel, acting together)",
  },
};

const DEPTH: Record<Difficulty, { en: string; de: string }> = {
  beginner: { en: "ONE core idea with its reason („…, weil …“)", de: "ein Kerngedanke mit seinem Grund („…, weil …“)" },
  intermediate: { en: "two or three connected facts, each building on the one before", de: "zwei, drei zusammenhängende Fakten, jeder baut auf dem vorigen auf" },
  advanced: { en: "one principle with cause and effect: the heroes predict what will happen, test it, and use the same rule again in a new situation", de: "ein Prinzip mit Ursache und Wirkung: Die Helden sagen voraus, prüfen es und wenden dieselbe Regel in einer neuen Lage noch einmal an" },
};

export function subjectLabelsDe(goal: LearningGoal): string {
  return goal.subjects.map((subject) => SUBJECTS[subject]?.de || subject).join(", ");
}

function subjectLabelsEn(goal: LearningGoal): string {
  return goal.subjects.map((subject) => SUBJECTS[subject]?.en || subject).join(", ");
}

function objectivesQuoted(goal: LearningGoal, joiner: string): string {
  return goal.objectives.map((objective) => `„${objective}“`).join(joiner);
}

function ageLineEn(band: AgeBand): string {
  if (band === "3-5") return "For three- to five-year-olds: something the child can see, touch or count (numbers up to five, at most ten); the key word said at least three times; no other technical word.";
  if (band === "9-12") return "For nine- to twelve-year-olds: up to two technical words, each explained when it first appears; a surprising true number or comparison is welcome; the reasoning may take two steps.";
  return "For six- to eight-year-olds: at most one technical word, explained in the same breath; numbers up to twenty unless the goal needs more; one surprising true detail is welcome when it serves the core.";
}

interface Units {
  unit: string;
  early: string;
  middle: string;
  aha: string;
  key: string;
  last: string;
  /** "on the last page" / "in the last chapter". */
  lastAt: string;
}

function unitsFor(form: LearningForm, count?: number): Units {
  if (form === "picturebook") {
    return {
      unit: "page",
      early: "Page 1-2",
      middle: "The middle pages",
      aha: count && count > 2 ? `at the latest on page ${count - 1}` : "at the latest on the second-to-last page",
      key: "The solution page",
      last: "the last page",
      lastAt: "on the last page",
    };
  }
  if (form === "chapterbook") {
    return {
      unit: "chapter",
      early: "Chapters 1-2",
      middle: "The middle chapters, step by step (each step adds one piece)",
      aha: "at the latest in the chapter before the climax",
      key: "The climax",
      last: "the last chapter",
      lastAt: "in the last chapter",
    };
  }
  return {
    unit: "chapter",
    early: "The first chapter",
    middle: "The middle chapters",
    aha: count && count > 2 ? `at the latest in chapter ${count - 1}` : "at the latest in the second-to-last chapter",
    key: "The solution",
    last: "the last chapter",
    lastAt: "in the last chapter",
  };
}

function assessmentLineEn(assessment: Assessment, units: Units): string {
  if (assessment === "quiz") return `Learning style quiz: the very last lines of ${units.last} are one short, playful question from a character to the listening child about the knowledge (after the closing picture); the answer was said clearly in the story. Nothing comes after the question.`;
  if (assessment === "discussion") return `Learning style conversation: ${units.lastAt} a character wonders aloud about an open question that grows out of the knowledge — one without a single right answer — so the child and the grown-up reading can keep talking about it.`;
  return `Learning style join in: give the listening child one moment to take part — guessing before the answer comes (the question at a ${units.unit} end), counting along, or a small move to copy (look, feel, clap, compare). No quiz at the end.`;
}

/**
 * The learning block for a writer or planner, in English (the story itself stays in the family language).
 * `units` is the page or chapter count when known. Empty when learning mode is off.
 */
export function learningWriterLinesEn(config: Pick<StoryConfig, "learningMode"> | null | undefined, options: { form: LearningForm; band: AgeBand; units?: number }): string[] {
  const goal = learningGoal(config);
  if (!goal) return [];
  const units = unitsFor(options.form, options.units);
  const where = options.form === "picturebook" ? " (header line WISSEN)" : options.form === "chapterbook" ? " (bible.learning.core)" : "";
  const lines = [
    `LEARNING MODE (mandatory — the family chose this story so the child learns something true; it weighs as much as the genre): ${subjectLabelsEn(goal)}.`,
    goal.objectives.length
      ? `- Learning goal in the family's words: ${objectivesQuoted(goal, " and ")}. After listening, the child can explain it in a sentence of their own.`
      : `- No goal typed: choose ONE concrete, true piece of knowledge from this subject that fits a ${options.band}-year-old and this story — a "why", "how" or "how many" a child can retell, never a vague theme.`,
    `- Depth: ${DEPTH[goal.difficulty].en}. Nothing beside it: extra facts dilute the core.`,
    `- THE KNOWLEDGE CORE: decide it before you write, in one or two sentences, exactly as the child should say it afterwards${where}. It is true in the real world, as in a good non-fiction book for children: simplified only by leaving things out, never by saying something false — no myth, no magic explanation, every number right.`,
    "- THE LEARNING ARC — the knowledge runs through the story; one sentence before the end is not enough:",
    `  1. ${units.early}: the thing to learn appears as something concrete the child can picture, together with a question or a wrong belief — best voiced by a character who is ridiculously sure of it (a mistake many children make too).`,
    `  2. ${units.middle}: the heroes find out by doing — watching closely, trying, comparing, counting, measuring. The wrong idea visibly fails first. A character asks the central question aloud at the end of a ${units.unit}, and the answer comes later, so the listening child gets a moment to guess.`,
    `  3. The aha, ${units.aha}: a hero says the knowledge in one to three short sentences of dialogue — what and why — in children's words, with ONE comparison from a child's everyday life. The key word of the goal is said and explained in the same breath.`,
    `  4. ${units.key}: the heroes' plan works BECAUSE of the knowledge, so the child feels why it matters.`,
    `  5. Echo ${units.lastAt}: someone says it once more, short and new — a hero explains it to someone who was not there, or the stubborn character proudly repeats it in its own funny words — and the key word is heard again (a child remembers the word it heard twice). In a magical world half a sentence shows that it is just as true in ours.`,
    "- Teach through the story, never as a lecture: the knowledge comes from characters and from what happens, not from the narrator; at most three explaining sentences in a row, then something happens again. Show it before you name it. No grown-up abstractions (energy, process, system, reserves, metabolism …) unless the same sentence turns them into a picture a child knows.",
    "- Facts and fantasy stay apart: magic, talking animals and invented things may frame the story, but never change or explain the real knowledge. A talking animal still eats, sleeps and behaves like the real animal; a magic thing may hold or show things, but the heroes do the thinking and the counting.",
    ...goal.subjects.map((subject) => SUBJECTS[subject]?.craft).filter((craft): craft is string => Boolean(craft)).map((craft) => `- ${craft}`),
    `- ${ageLineEn(options.band)}`,
    `- ${assessmentLineEn(goal.assessment, units)}`,
    "- A character explaining a fact is wanted here and is no lesson; the ban on morals and life lessons still holds.",
  ];
  return lines;
}

/** The learning wish as ONE line in a list of family wishes (editors, plan review); the writer gets the full block. */
export function learningSummaryEn(config: Pick<StoryConfig, "learningMode"> | null | undefined, form: LearningForm = "picturebook"): string | null {
  const goal = learningGoal(config);
  if (!goal) return null;
  const units = unitsFor(form);
  const style = goal.assessment === "quiz"
    ? `a character asks the listening child one playful question about it at the very end of ${units.last}`
    : goal.assessment === "discussion"
      ? `a character wonders aloud about an open question on the topic ${units.lastAt}`
      : "the listening child gets a moment to guess, count along or copy something";
  return `Learning mode (mandatory): ${subjectLabelsEn(goal)}${goal.objectives.length ? `; goal in the family's words: ${objectivesQuoted(goal, " and ")}` : ""}; depth: ${DEPTH[goal.difficulty].en}. The knowledge is true and runs through the story — a question or wrong belief early, tested by the heroes, explained by a character in children's words with one everyday comparison, the key to the solution, echoed at the end — never a lecture; ${style}.`;
}

/**
 * The same wish in German, short — for the German prompts, the editor's read and the patch. The patch must know
 * what a missing learning goal looks like; the critic must know what to check.
 */
export function learningLinesDe(config: Pick<StoryConfig, "learningMode"> | null | undefined): string[] {
  const goal = learningGoal(config);
  if (!goal) return [];
  const lines = [
    `Lernmodus (Pflicht): ${subjectLabelsDe(goal)}.${goal.objectives.length ? ` Lernziel: ${objectivesQuoted(goal, " und ")} — nach dem Vorlesen kann das Kind es in einem eigenen Satz erklären.` : " Ein konkretes, wahres Wissen aus diesem Fach, das ein Kind nacherzählen kann."} Umfang: ${DEPTH[goal.difficulty].de}.`,
    "So lehrt die Geschichte: Das Wissen ist sachlich richtig (kein Mythos, kein Zauber erklärt Echtes, jede Zahl stimmt) und zieht sich durch die Handlung — früh als sichtbare Beobachtung mit einer Frage oder einem Irrtum, in der Mitte von den Helden ausprobiert, spätestens vor der Lösung von einer Figur in ein bis drei kurzen Sätzen in Kinderworten mit einem Vergleich aus der Kinderwelt erklärt (das Fachwort gleich mit). Dann trägt es die Lösung und klingt am Ende in einem kurzen Satz einer Figur noch einmal an, mit dem Schlüsselwort. Nie als Vortrag des Erzählers; keine Erwachsenenwörter wie Energie, Prozess oder Reserven ohne ein Bild für Kinder.",
  ];
  if (goal.assessment === "quiz") lines.push("Lernart Quiz: Ganz am Schluss stellt eine Figur dem zuhörenden Kind eine kurze, spielerische Frage zum Wissen; die Antwort steht klar in der Geschichte.");
  else if (goal.assessment === "discussion") lines.push("Lernart Gespräch: Am Ende wundert sich eine Figur laut über eine offene Frage zum Thema, über die Kind und Eltern weiterreden können.");
  else lines.push("Lernart Mitmachen: Ein Moment, in dem das zuhörende Kind mitraten, mitzählen oder etwas nachmachen kann — kein Quiz am Ende.");
  return lines;
}

const CONTENT_WORD = /[\p{L}]{5,}/gu;

/** Content words cut to six letters: "Winterschlaf", "Winterschlafs" and "winterlich" meet; a guard, not a parser. */
function stems(text: string): string[] {
  return [...new Set((String(text || "").toLocaleLowerCase("de-DE").match(CONTENT_WORD) || []).map((word) => word.slice(0, 6)))];
}

/**
 * Does this sentence carry the knowledge (its key word, or two content words of its core)? Guards the chapter book's
 * lesson filter, and finds the book sentences that show what was learned.
 */
export function mentionsKnowledge(sentence: string, core: string, term = ""): boolean {
  const lower = String(sentence || "").toLocaleLowerCase("de-DE");
  const key = clean(term, 60).toLocaleLowerCase("de-DE");
  if (key.length >= 4 && lower.includes(key.slice(0, Math.max(4, key.length - 2)))) return true;
  const words = new Set(stems(core));
  return stems(sentence).filter((stem) => words.has(stem)).length >= 2;
}

/** Up to `max` sentences of a text that carry the knowledge — evidence for the development read of a long book. */
export function knowledgeSentences(text: string, core: string, term = "", max = 2): string[] {
  return String(text || "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?…“])\s+/)
    .filter((sentence) => sentence.length >= 20 && mentionsKnowledge(sentence, core, term))
    .slice(0, max)
    .map((sentence) => clean(sentence, 240).replace(/^[„"]|[“"]$/g, ""));
}

// ---------------------------------------------------------------------------
// The writer's knowledge core (picture book header line)
// ---------------------------------------------------------------------------

const CORE_LINE = /^\s*[*_#\s]*WISSEN\s*[:：]\s*(.+?)\s*[*_]*\s*$/im;

/** The WISSEN header the one-shot writer commits to; null when absent or empty. */
export function parseLearningCore(raw: string): string | null {
  const value = clean(String(raw || "").match(CORE_LINE)?.[1] || "", 400).replace(/^[„"']|[“"']$/g, "").trim();
  return value && !/^(keins?|keine|null|—|-)$/i.test(value) ? value : null;
}

// ---------------------------------------------------------------------------
// The editor's learning read (storybook ledger)
// ---------------------------------------------------------------------------

export interface LearningLedger {
  /** What a child can say as knowledge after listening, from the text; null when missing or only claimed. */
  fact: string | null;
  /** The page where a character explains it. */
  explainedOn: number | null;
  correct: boolean;
  /** The factual error with a short quote. */
  error: string | null;
  /** The solution works because of the knowledge. */
  keyToSolution: boolean;
  /** Every page the knowledge appears on (question, wrong belief, test, explanation, echo). */
  pages: number[];
  /** Grown-up words in the explanation without a picture a child knows. */
  adultWords: string[];
  /**
   * The one word of the goal the child should know afterwards ("Winterschlaf"). The read names it; the code counts it
   * ("Schnecken auf der Festtafel", Sol 2026-10-14, taught hibernation well and never said „Winterschlaf“).
   */
  keyWord: string | null;
}

export const LEARNING_LEDGER_RULES_DE = [
  "- learning (Lernmodus): fact = das Wissen, das ein Kind nach dem Hören sagen kann — aus dem Text, als Kindersatz (null, wenn es fehlt oder nur behauptet wird); explainedOn = Seite, auf der eine Figur es erklärt; correct = false bei einem Sachfehler, einem Mythos oder einer Zauber-Erklärung für etwas Echtes, sonst true; error = der Fehler mit kurzem Zitat, sonst null; keyToSolution = true, wenn der Plan der Helden wegen dieses Wissens klappt; pages = alle Seiten, auf denen das Wissen vorkommt (als Frage, Irrtum, Versuch, Erklärung oder Echo); adultWords = Erwachsenenwörter in der Erklärung, die kein Bild für Kinder bekommen (sonst leer); keyWord = das eine Wort aus dem Lernziel, das das Kind danach kennen soll (meist das Fachwort, in der Grundform), auch wenn es im Text fehlt.",
  "Obergrenzen im Lernmodus: Lernwissen fehlt → höchstens 6.5; Sachfehler → höchstens 5.5; Wissen trägt die Lösung nicht oder steht nur auf einer Seite → höchstens 7.",
];

export const LEARNING_LEDGER_SHAPE = {
  fact: "das Wissen als Kindersatz, aus dem Text — oder null",
  explainedOn: 6,
  correct: true,
  error: "Sachfehler mit Zitat — oder null",
  keyToSolution: true,
  pages: [2, 4, 6, 7],
  adultWords: [],
  keyWord: "das Schlüsselwort des Lernziels",
};

function missing(value: unknown): string | null {
  const text = clean(value, 300);
  if (!text || /^(null|none|keine?|kein\b|nicht\b|nie\b|nein\b|no\b|not\b|never\b|nichts|false|unklar|fehlt|[—–-]+$)/i.test(text)) return null;
  return text;
}

export function sanitizeLearningLedger(raw: any, pageCount: number): LearningLedger | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const page = (value: unknown) => {
    const n = Math.round(Number(value));
    return Number.isFinite(n) && n >= 1 && n <= pageCount ? n : null;
  };
  const pages = (Array.isArray(raw.pages) ? raw.pages : []).map(page).filter((n: number | null): n is number => n !== null);
  return {
    fact: missing(raw.fact),
    explainedOn: page(raw.explainedOn),
    // Only an explicit false is a factual error: a missing field must not cap a story.
    correct: raw.correct !== false,
    error: missing(raw.error),
    keyToSolution: raw.keyToSolution !== false,
    pages: [...new Set<number>(pages)].sort((a, b) => a - b),
    adultWords: (Array.isArray(raw.adultWords) ? raw.adultWords : []).map((word: unknown) => clean(word, 40)).filter(Boolean).slice(0, 6),
    // One word, never a phrase: anything longer cannot be counted fairly.
    keyWord: /^[\p{L}-]{3,30}$/u.test(clean(raw.keyWord, 40)) ? clean(raw.keyWord, 40) : null,
  };
}

/** How often the key word (or a form of it: „Winterschlafs“, „verdoppelt“) is heard in the text. */
export function countKeyWord(text: string, keyWord: string | null | undefined): number {
  const word = clean(keyWord, 40).toLocaleLowerCase("de-DE");
  if (word.length < 3) return 0;
  const stem = word.length >= 7 ? word.slice(0, word.length - 2) : word;
  return String(text || "").toLocaleLowerCase("de-DE").split(stem).length - 1;
}

/** The caps in LEARNING_LEDGER_RULES_DE, enforced. */
export function learningScoreCap(ledger: LearningLedger | undefined): number {
  if (!ledger) return 10;
  if (!ledger.fact) return 6.5;
  let cap = 10;
  if (!ledger.correct) cap = Math.min(cap, 5.5);
  if (!ledger.keyToSolution || ledger.pages.length <= 1) cap = Math.min(cap, 7);
  return cap;
}

/**
 * The learning read as edit notes for the patch — problems and where, never wording to paste in. Each note asks for
 * one or two sentences, which is what a patch may add to a page.
 */
export function learningLedgerNotes(ledger: LearningLedger | undefined, goal: LearningGoal | null, pageCount: number, story?: { text: string; band?: AgeBand }): string[] {
  if (!goal || !ledger) return [];
  const what = goal.objectives.length ? objectivesQuoted(goal, " und ") : `das Wissen zum Lernthema (${subjectLabelsDe(goal)})`;
  const solutionPage = Math.max(1, pageCount - 1);
  if (!ledger.fact) {
    return [`Lernziel fehlt: Ein Kind kann nach dem Hören nicht erklären: ${what}. Eine Figur erklärt es auf Seite ${solutionPage}, wo die Lösung entsteht, in ein, zwei kurzen Sätzen wörtlicher Rede (zusammen höchstens 25 Wörter) — sachlich richtig, in Kinderworten, mit einem Vergleich aus der Kinderwelt.`];
  }
  const notes: string[] = [];
  if (!ledger.correct) notes.push(`Sachfehler beim Lernwissen${ledger.error ? `: ${ledger.error}` : ""}. Korrigiere genau diese Stelle, sodass sie stimmt.`);
  if (ledger.adultWords.length) notes.push(`${ledger.explainedOn ? `Seite ${ledger.explainedOn}: ` : ""}Die Erklärung nutzt Erwachsenenwörter (${ledger.adultWords.slice(0, 4).join(", ")}). Sag dasselbe mit einem Bild aus der Kinderwelt.`);
  if (!ledger.keyToSolution) notes.push(`Das Lernwissen trägt die Lösung nicht: Zeig auf Seite ${solutionPage} in einem Satz, dass der Plan der Helden genau deshalb klappt.`);
  const first = ledger.pages[0] ?? ledger.explainedOn;
  if (ledger.pages.length <= 1) {
    notes.push(`Das Lernwissen steht nur auf Seite ${first ?? solutionPage}. Lass es früher in einem Satz als Frage oder Beobachtung anklingen${first && first > 2 ? ` (Seite ${Math.max(1, first - 3)} oder ${Math.max(1, first - 2)})` : ""}.`);
  }
  // The key word, counted in the text: a child keeps the word it heard at least twice (three times under six).
  const heard = story && ledger.keyWord ? countKeyWord(story.text, ledger.keyWord) : null;
  const needed = story?.band === "3-5" ? 3 : 2;
  const wordMissing = heard !== null && heard < needed;
  const echoMissing = !ledger.pages.includes(pageCount) && ledger.explainedOn !== pageCount;
  if (wordMissing && heard === 0 && echoMissing && ledger.explainedOn) {
    notes.push(`Seite ${ledger.explainedOn}: Das Wort „${ledger.keyWord}“ fällt in der ganzen Geschichte nie. Lass es in der Erklärung fallen — ein Wort in einem vorhandenen Satz wörtlicher Rede genügt.`);
  }
  if (echoMissing) {
    notes.push(`Seite ${pageCount}: Das Lernwissen klingt am Ende nicht mehr an. Eine Figur sagt es in einem kurzen Satz wörtlicher Rede noch einmal, neu und knapp${wordMissing ? `, mit dem Wort „${ledger.keyWord}“` : ""} — nie als Erzählersatz wie „Seitdem wusste …“.`);
  } else if (wordMissing) {
    notes.push(`Das Wort „${ledger.keyWord}“ fällt ${heard === 0 ? "nie" : "nur einmal"}. Lass es dort fallen, wo das Wissen erklärt wird, und auf Seite ${pageCount} noch einmal — ein Wort in einem vorhandenen Satz wörtlicher Rede genügt.`);
  }
  return notes;
}

// ---------------------------------------------------------------------------
// Avatar development: the learned fact grows the right trait, and says so
// ---------------------------------------------------------------------------

/** For the German development prompt (storybook, chapter book). */
export function learningDevelopmentLinesDe(goal: LearningGoal | null, core?: string | null): string[] {
  if (!goal) return [];
  const traits = goal.subjects
    .map((subject) => (SUBJECTS[subject] ? `${SUBJECTS[subject].de.split(" (")[0]} → ${SUBJECTS[subject].traitsDe}` : null))
    .filter((line): line is string => Boolean(line));
  return [
    "LERNMODUS — diese Geschichte sollte Wissen vermitteln:",
    `- Fach: ${subjectLabelsDe(goal)}${goal.objectives.length ? `; Lernziel der Familie: ${objectivesQuoted(goal, " und ")}` : ""}${core ? `; Kernwissen laut Autor: „${clean(core, 300)}“` : ""}.`,
    `- Zeigt und erklärt der TEXT dieses Wissen wirklich, bekommt jede Hauptfigur, die es entdeckt, ausprobiert oder erklärt, die passende Eigenschaft${traits.length ? ` (${traits.join("; ")})` : ""} mit change 2 — 3, wenn das Wissen die Lösung trug.`,
    "- Diese Begründung nennt das Wissen selbst in einem Kindersatz, damit Kind und Eltern es wiedererkennen („Hat herausgefunden, dass …“, „Weiß jetzt, warum …: …“) — nicht nur, was die Figur tat.",
    "- Kommt das Wissen im Text nicht vor oder ist es falsch, gibt es dafür nichts.",
  ];
}

/** For the English development prompt (normal mode). */
export function learningDevelopmentLinesEn(goal: LearningGoal | null): string[] {
  if (!goal) return [];
  const traits = goal.subjects
    .map((subject) => (SUBJECTS[subject] ? `${subject} → ${SUBJECTS[subject].traitsEn}` : null))
    .filter((line): line is string => Boolean(line));
  return [
    `LEARNING MODE — this story was meant to teach ${subjectLabelsEn(goal)}${goal.objectives.length ? `; the family's goal: ${objectivesQuoted(goal, " and ")}` : ""}.`,
    `- When the TEXT really shows and explains this knowledge, every main avatar who discovers, tests or explains it gets the matching trait${traits.length ? ` (${traits.join("; ")})` : ""} with change 2 (3 when the knowledge carried the solution).`,
    "- That description names the knowledge itself in one child's sentence, so child and parents recognise it („Hat herausgefunden, dass …“, „Weiß jetzt, warum …: …“) — not only what the avatar did.",
    "- When the knowledge is missing from the text or wrong, it earns nothing.",
  ];
}

// ---------------------------------------------------------------------------
// Normal mode (dev engine): planning anchor and validator check
// ---------------------------------------------------------------------------

/** Two lines that travel with the locked idea into logline, beat sheet and scene cards. */
export function learningPlanAnchorEn(config: Pick<StoryConfig, "learningMode"> | null | undefined): string[] {
  const goal = learningGoal(config);
  if (!goal) return [];
  return [
    `- LEARNING GOAL (binding, the family's learning mode — plan it, it must not get lost after the idea): ${subjectLabelsEn(goal)}${goal.objectives.length ? `; goal: ${objectivesQuoted(goal, " and ")}` : ""}; depth: ${DEPTH[goal.difficulty].en}.`,
    "- Carry it through the plan: the hook shows the thing to learn and a wrong belief about it; the middle lets the children test it (the wrong idea fails); a child discovers and says the knowledge in children's words; the final choice works because of it; the closing image lets someone say it once more. The children find it out — a helper may ask or complicate, never explain it.",
  ];
}

export function learningValidatorLinesEn(config: Pick<StoryConfig, "learningMode"> | null | undefined): string[] {
  const goal = learningGoal(config);
  if (!goal) return [];
  return [
    `LEARNING MODE CHECK (mandatory — the family asked for ${subjectLabelsEn(goal)}${goal.objectives.length ? `, goal ${objectivesQuoted(goal, " and ")}` : ""}):`,
    "- After listening, can a child explain the knowledge in one sentence of their own? It must be said explicitly by a character in children's words (what and why), not only hinted at or named.",
    "- It must be factually right (no myth, no magic explanation for something real, every number right), carry the solution, and appear in more than one place (an early question or wrong belief, the explanation, an echo at the end).",
    "- Missing or only claimed: max 7.5 and a mustFixBefore95 entry saying where it belongs. A factual error: max 6.9, plus an errors entry and a mustFixBefore95 entry with the correction. Explained only once, only in grown-up words (energy, process, reserves …), or not the key to the solution: max 8.4 and a mustFixBefore95 entry.",
    "- A character restating the learned FACT in dialogue is the requested learning echo, not a moral — the caps for moral endings do not apply to it.",
  ];
}
