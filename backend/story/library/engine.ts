/**
 * Library episode pipeline: Blueprint → Writer → Scorer (→ revision) → Finalizer.
 *
 * One pipeline, the context decides (concept „Geschichten-Modi“): this file
 * builds the series_episode context — rules, bible, canon digest up to the
 * previous episode, then the episode's own plan and the editor's idea. Static
 * parts stand first and travel in the system message (Sol caches only there).
 *
 * Roles follow the measured setup of the other pipelines: Sol writes, Luna
 * plans and directs the pictures, the reader comes from another model family
 * (a model grading its own family's prose grades it generously). Encore-free:
 * the LLM is a port, so a script can run the whole chain.
 */

import {
  CostLedger,
  STORYBOOK_CROSS_FAMILY_CRITIC_MODEL,
  STORYBOOK_DEFAULT_WRITER_MODEL,
  STORYBOOK_SUPPORT_MODEL,
  parseJsonObject,
  type StorybookLlm,
} from "../storybook/llm";
import type { Collectible, EpisodeContent, EpisodeGuest, EpisodeScores, ImageSlot, SeriesBible, SeriesInfo } from "./types";

export const LIBRARY_MODELS = {
  writer: process.env.TALEA_LIBRARY_WRITER_MODEL || STORYBOOK_DEFAULT_WRITER_MODEL,
  support: process.env.TALEA_LIBRARY_SUPPORT_MODEL || STORYBOOK_SUPPORT_MODEL,
  critic: process.env.TALEA_LIBRARY_CRITIC_MODEL || STORYBOOK_CROSS_FAMILY_CRITIC_MODEL,
};

/** Concept: minimum 9 in every dimension, otherwise retry (max 3 writes), then a human revises. */
export const MIN_DIMENSION_SCORE = Number(process.env.TALEA_LIBRARY_MIN_SCORE || 9);
export const MAX_WRITES = 3;

export const SCORE_DIMENSIONS: Array<{ key: string; label: string; question: string }> = [
  { key: "figurenkonsistenz", label: "Figurenkonsistenz", question: "Bleibt jede Figur in Charakter (Sprechweise, Eigenarten), verschwindet keine zwischen Kapiteln?" },
  { key: "plotKohaerenz", label: "Plot-Kohärenz", question: "Folgt die Folge der Episoden-Formel und den Welt-Regeln? Ist jeder Schritt ursächlich (weil …, deshalb …), ohne Zufallslösung?" },
  { key: "sprachqualitaet", label: "Sprachqualität", question: "Kindgerecht, bildhaft, mit Sinneseindrücken, gut vorlesbar? Kurze Sätze, lebendige wörtliche Rede, keine Floskeln?" },
  { key: "emotionaleTiefe", label: "Emotionale Tiefe", question: "Gibt es einen echten Moment von Angst, Mut, Scham oder Freude, den ein Kind mitfühlt?" },
  { key: "altersangemessenheit", label: "Altersangemessenheit", question: "Passt es für 6–8 Jahre, ohne zu belehren und ohne Moral-Rede?" },
  { key: "ende", label: "Ende", question: "Ist der Konflikt der Folge gelöst, ohne Cliffhanger, mit einem warmen Schluss?" },
  { key: "kanonTreue", label: "Kanon-Treue", question: "Werden alle Kanon-Invarianten und bisherigen Kanon-Fakten eingehalten, ohne Spoiler auf spätere Folgen?" },
  { key: "weitererzaehlFaktor", label: "Weitererzähl-Faktor", question: "Gibt es mindestens einen Gag oder Satz, den ein Kind auf dem Schulhof nacherzählt?" },
];

const COLLECTIBLE_FIELDS: Record<string, { name: string; labels: string[] }> = {
  flunker_card: { name: "Flunker-Karte", labels: ["Flunkerei", "Wer hat geflunkert", "Was wörtlich passierte", "Aufgelöst"] },
  monster_profile: { name: "Monster-Steckbrief", labels: ["Name", "Ursprung", "Schwäche", "Fangtrick", "Job in der Pension"] },
};

export interface CanonEntry {
  season: number;
  episode: number;
  title: string;
  summary: string;
  facts: string[];
}

export interface EpisodeTarget {
  season: number;
  episode: number;
  title: string;
  logline: string;
  fields: Record<string, string>;
  clue: string;
  /** The editor's own idea for this episode; wins over the planned logline where they differ. */
  idea?: string | null;
  /** The next planned episode, for the teaser line. */
  next?: { title: string; logline: string } | null;
}

export interface EpisodeBrief {
  series: SeriesInfo;
  bible: SeriesBible;
  target: EpisodeTarget;
  /** Approved episodes before this one, oldest first. */
  canon: CanonEntry[];
}

export interface Blueprint {
  title: string;
  summary: string;
  focusCharacter: string;
  chapters: Array<{ title: string; beats: string[]; laugh: string; ending: string }>;
  schoolyardLine: string;
  feelingMoment: string;
  clue: string;
  runningGags: string[];
  guests: Array<{ id: string; name: string; role: string; visualProfileEn: string }>;
  teaser: string;
}

export interface EpisodeDraft {
  content: EpisodeContent;
  scores: EpisodeScores;
  writes: number;
  blueprint: Blueprint;
}

export class LibraryPipelineError extends Error {}

/* ── Context ────────────────────────────────────────────────────────────── */

function seasonArcFor(brief: EpisodeBrief) {
  return brief.bible.seasonArcs.find((arc) => arc.season === brief.target.season) ?? null;
}

function isFinale(brief: EpisodeBrief): boolean {
  const arc = seasonArcFor(brief);
  if (!arc?.clues.length) return false;
  return brief.target.episode >= Math.max(...arc.clues.map((clue) => clue.episode));
}

/** Everything that stays the same for every call about this episode: rules, bible, canon. */
export function buildSeriesContext(brief: EpisodeBrief): string {
  const { series, bible } = brief;
  const arc = seasonArcFor(brief);
  const finale = isFinale(brief);
  const cast = bible.characters.filter(character => character.id !== "sockenkoenig" || brief.target.episode >= 7).map((character) => {
    const personality = character.id === "sockenkoenig" && !finale
      ? "Eine Gestalt aus Mamas alter Erzählung. Nur Gerüchte, Spuren und Schatten; Ursprung, Absicht und Auflösung bleiben unbekannt."
      : character.personality;
    return `- ${character.name} (id: ${character.id}; ${character.role}${character.ageYears ? `, ${character.ageYears} Jahre` : ""}): ${personality} Sprechweise: ${character.speechStyle}`;
  });
  const clues = arc ? arc.clues.filter((clue) => clue.episode <= brief.target.episode) : [];
  const canon = brief.canon.length
    ? brief.canon.map((entry) => `S${entry.season}E${entry.episode} „${entry.title}“: ${entry.summary}\n  Fakten: ${entry.facts.join(" | ") || "–"}`).join("\n")
    : "Noch keine. Dies ist die erste Folge der Reihe.";
  return [
    `SERIES: ${series.title} — ${series.logline}`,
    `Genre: ${series.genre}. Audience: children aged ${series.ageBand}, read aloud and first self-reading.`,
    "",
    "WORLD (German):",
    `Ort: ${bible.world.setting}`,
    `Ton: ${bible.world.tone}`,
    "Welt-Regeln:",
    ...bible.world.rules.map((rule) => `- ${rule}`),
    "",
    "CAST (only these characters plus at most two guests of this episode):",
    ...cast,
    "",
    "RUNNING GAGS:",
    ...bible.runningGags.map((gag) => `- ${gag}`),
    `CATCHPHRASES (keep them word for word): ${bible.catchphrases.map((phrase) => `„${phrase}“`).join(", ")}`,
    "",
    "FLEXIBLE EPISODE TOOLS (vary their order and emphasis; never mechanically repeat the previous episode's sequence; preserve the core magic and a complete resolution):",
    ...bible.episodeFormula.map((beat, index) => `${index + 1}. ${beat}`),
    "",
    "CANON INVARIANTS (no story may change these):",
    ...bible.canonInvariants.map((rule) => `- ${rule}`),
    `FORBIDDEN TOPICS: ${bible.forbiddenTopics.join(", ")}.`,
    "",
    arc ? `SEASON ${arc.season} „${arc.title}“ — mystery running in the background: ${arc.mystery}` : "No season mystery for this season yet.",
    clues.length ? `Season clues so far (each episode plants exactly its own clue, casually):\n${clues.map((clue) => `- E${clue.episode}: ${clue.clue}`).join("\n")}` : "",
    finale && arc ? `This is the season finale. Resolution: ${arc.resolution}` : "The solution of the mystery is NOT revealed and NOT hinted beyond this episode's own clue.",
    "",
    "CANON SO FAR (approved episodes, never contradict them):",
    canon,
  ].filter((line) => line !== undefined).join("\n");
}

function targetBlock(brief: EpisodeBrief): string {
  const { target, series } = brief;
  const fields = Object.entries(target.fields).map(([key, value]) => `- ${key}: ${value}`);
  return [
    `THIS EPISODE: Season ${target.season}, episode ${target.episode}: „${target.title}“`,
    target.logline ? `Planned logline: ${target.logline}` : "No logline planned yet — invent one that fits the formula.",
    fields.length ? `Planned details:\n${fields.join("\n")}` : "",
    target.clue ? `Season clue of this episode (plant it casually, never explain it): ${target.clue}` : "This episode has no season clue.",
    target.idea ? `EDITOR'S IDEA (has priority over the planned logline where they differ; invariants still hold): ${target.idea}` : "",
    target.next ? `Next episode (for the teaser only): „${target.next.title}“ — ${target.next.logline}` : "Next episode: not planned yet — the teaser stays vague and curious.",
    `Teaser line starts with „${series.teaserPrefix}:“.`,
  ].filter(Boolean).join("\n");
}

const WRITING_RULES_DE = [
  "Schreibregeln (Deutsch):",
  "- Für 6–8 Jahre zum Vorlesen und ersten Selbstlesen: klare Sätze (meist 5–12 Wörter, abwechslungsreich), viel wörtliche Rede, Lautmalerei erwünscht (RUMMS, Schnüff, Plopp).",
  "- Absätze mit 2–4 Sätzen, damit sich die Geschichte flüssig vorlesen lässt. Ein einzelner Satz als eigener Absatz nur für Lautmalerei, Pointen oder einen Spannungsmoment (höchstens 6 pro Kapitel).",
  "- Dritte Person, nah an der Hauptfigur der Folge. Präteritum. Deutsche Anführungszeichen „…“.",
  "- Lustig zuerst, spannend als zweites, nie belehrend: keine Moral-Rede, kein „Und was lernen wir daraus“. Gefühle zeigen sich in Taten, Körper und Dialog.",
  "- Keine Verletzungen, niemand wird bestraft oder gedemütigt. Komik entsteht aus Missverständnissen, Wörtlich-Nehmen, Slapstick, Timing.",
  "- Jede Folge muss auch für ein Kind funktionieren, das die Reihe nicht kennt: Jede Figur wird beim ersten Auftritt mit einem halben Satz Handlung oder Aussehen eingeführt, ohne Info-Block.",
  "- Konkret und sinnlich: Gerüche, Geräusche, Dinge zum Anfassen. Jeder Schritt der Handlung folgt aus dem vorigen; die Lösung kommt aus dem Mut oder Wissen der Figuren, nie aus Zufall.",
  "- Pflicht in jeder Folge: mindestens ein Running Gag der Reihe, mindestens ein Satz zum Nacherzählen auf dem Schulhof, ein echter Gefühlsmoment (Angst, Scham oder Stolz), der Staffel-Hinweis beiläufig, am Ende das Sammelobjekt der Folge im Text.",
  "- Kapitel 1 und 2 enden mit einem kleinen Haken, Kapitel 3 löst den Konflikt der Folge vollständig. Kein Cliffhanger. Der Teaser steht NICHT im Text.",
  "- Länge: genau 3 Kapitel, je 450–650 Wörter, zusammen 1.400–1.900 Wörter.",
  "- Vermeide Füllwörter und Tics: kein „plötzlich“ mehr als zweimal, kein „Bauch kribbelte“, keine Erzählerfragen am Kapitelende.",
].join("\n");

/* ── Stage 1: blueprint ─────────────────────────────────────────────────── */

async function blueprintStage(brief: EpisodeBrief, llm: StorybookLlm, ledger: CostLedger): Promise<Blueprint> {
  const system = [
    "You are the head writer of a professional German children's series. You plan one episode as a beat sheet. Answer with ONE JSON object.",
    "",
    buildSeriesContext(brief),
    "",
    WRITING_RULES_DE,
  ].join("\n");
  const user = [
    targetBlock(brief),
    "",
    "Plan the episode. JSON fields:",
    `{"title": "2–6 words, German", "summary": "2 sentences for the episode card: the situation and the funny problem, never the ending",`,
    ` "focusCharacter": "id of the main character of this episode",`,
    ` "chapters": [{"title": "German, 1–4 words", "beats": ["formula beats of this chapter as concrete events, in order"], "laugh": "the planned gag of this chapter, concrete", "ending": "how the chapter ends (1–2: small hook, 3: warm resolution)"}] (exactly 3),`,
    ` "schoolyardLine": "the sentence kids will retell, word for word", "feelingMoment": "who feels what, when, and why it matters",`,
    ` "clue": "how and where the season clue appears (or empty)", "runningGags": ["which running gags appear where"],`,
    ` "guests": [{"id": "kebab-case", "name": "German", "role": "German, one line", "visualProfileEn": "English look, concrete colours and shapes"}] (0–2 figures that exist only in this episode),`,
    ` "teaser": "one German line for the next episode, starting with the teaser prefix"}`,
    "Make it surprising: the literal or physical consequence must be visual and escalate step by step. The solution must come from a character's courage or knowledge.",
  ].join("\n");
  const result = await llm({ stage: "library-blueprint", role: "support", model: LIBRARY_MODELS.support, system, user, json: true, maxTokens: 6000, effort: "low", timeoutMs: 180_000 });
  ledger.recordCall("library-blueprint", result, "support");
  const parsed = parseJsonObject<Blueprint>(result.text);
  if (!parsed || !Array.isArray(parsed.chapters) || parsed.chapters.length < 3) throw new LibraryPipelineError("Blueprint unusable (no 3 chapters).");
  parsed.chapters = parsed.chapters.slice(0, 3);
  parsed.guests = Array.isArray(parsed.guests) ? parsed.guests.slice(0, 2) : [];
  parsed.runningGags = Array.isArray(parsed.runningGags) ? parsed.runningGags : [];
  return parsed;
}

function blueprintText(blueprint: Blueprint): string {
  return [
    `TITLE: ${blueprint.title}`,
    `FOCUS: ${blueprint.focusCharacter}`,
    ...blueprint.chapters.map((chapter, index) =>
      `CHAPTER ${index + 1} „${chapter.title}“\n  Beats: ${chapter.beats.join(" → ")}\n  Gag: ${chapter.laugh}\n  Ending: ${chapter.ending}`),
    `Schoolyard line: ${blueprint.schoolyardLine}`,
    `Feeling moment: ${blueprint.feelingMoment}`,
    `Season clue: ${blueprint.clue || "–"}`,
    `Running gags: ${blueprint.runningGags.join(" | ")}`,
    blueprint.guests.length ? `Guests: ${blueprint.guests.map((guest) => `${guest.name} (${guest.role})`).join("; ")}` : "Guests: none",
  ].join("\n");
}

/* ── Stage 2: writer ────────────────────────────────────────────────────── */

export interface ParsedChapter {
  title: string;
  text: string;
}

/** "KAPITEL 1: Titel" blocks → chapters with paragraphs separated by one blank line. */
export function parseChapters(raw: string): ParsedChapter[] {
  const text = String(raw || "").replace(/\r\n/g, "\n");
  const pattern = /^\s*(?:#+\s*)?KAPITEL\s+(\d+)\s*[:.–-]\s*(.+?)\s*$/gim;
  const marks: Array<{ index: number; end: number; title: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) marks.push({ index: match.index, end: pattern.lastIndex, title: match[2].replace(/[*_#]/g, "").trim() });
  return marks.map((mark, index) => {
    const body = text.slice(mark.end, marks[index + 1]?.index ?? text.length);
    const paragraphs = body
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " ").trim())
      .filter((paragraph) => paragraph && !/^(TEASER|TITEL)\s*:/i.test(paragraph));
    return { title: mark.title, text: paragraphs.join("\n\n") };
  }).filter((chapter) => chapter.text.length > 0);
}

export function countWords(text: string): number {
  return String(text || "").split(/\s+/).filter(Boolean).length;
}

async function writeStage(
  brief: EpisodeBrief,
  blueprint: Blueprint,
  llm: StorybookLlm,
  ledger: CostLedger,
  revision?: { previous: ParsedChapter[]; notes: string[] },
): Promise<ParsedChapter[]> {
  const system = [
    "Du bist Autorin einer erfolgreichen deutschen Kinderbuchreihe. Du schreibst eine Folge druckreif, in der Stimme der Reihe.",
    "",
    buildSeriesContext(brief),
    "",
    WRITING_RULES_DE,
    "",
    "Ausgabeformat (nur das, sonst nichts):",
    "KAPITEL 1: <Titel>",
    "<Absätze, getrennt durch eine Leerzeile>",
    "",
    "KAPITEL 2: <Titel>",
    "…",
    "",
    "KAPITEL 3: <Titel>",
    "…",
  ].join("\n");
  const user = revision
    ? [
        targetBlock(brief),
        "",
        "BEAT SHEET:",
        blueprintText(blueprint),
        "",
        "Die Lektorin hat die Fassung unten gelesen. Überarbeite die GANZE Folge so, dass jeder Punkt gelöst ist. Behalte, was gut ist (Gags, Sprüche, Szenen), ändere gezielt:",
        ...revision.notes.map((note) => `- ${note}`),
        "",
        "BISHERIGE FASSUNG:",
        revision.previous.map((chapter, index) => `KAPITEL ${index + 1}: ${chapter.title}\n${chapter.text}`).join("\n\n"),
      ].join("\n")
    : [targetBlock(brief), "", "BEAT SHEET:", blueprintText(blueprint), "", "Schreib jetzt die Folge."].join("\n");
  const result = await llm({ stage: revision ? "library-revision" : "library-write", role: "writer", model: LIBRARY_MODELS.writer, system, user, json: false, maxTokens: 14000, effort: "low", timeoutMs: 300_000 });
  ledger.recordCall(revision ? "library-revision" : "library-write", result, "writer");
  const chapters = parseChapters(result.text);
  if (chapters.length < 3) throw new LibraryPipelineError(`Writer returned ${chapters.length} chapters instead of 3.`);
  return chapters.slice(0, 3);
}

/* ── Stage 3: scorer ────────────────────────────────────────────────────── */

async function scoreStage(brief: EpisodeBrief, chapters: ParsedChapter[], llm: StorybookLlm, ledger: CostLedger): Promise<EpisodeScores> {
  const system = [
    "You are the demanding editor of a top German children's book publisher. You read one episode of a series and score it honestly. Answer with ONE JSON object.",
    "Calibration: 10 = could be printed unchanged in the best series on the market; 9 = excellent, at most one tiny polish; 7–8 = good but generic or with a real flaw; 5–6 = clear problems; below 5 = broken.",
    "A score of 9 or 10 needs a reason you can quote from the text. Logic gaps (who is where, why something works), chance solutions, characters out of character, moralising, a missing season clue or a broken invariant cap the related dimension at 7.",
    "The teaser line for the next episode and the collectible card are stored separately and shown after the text: never ask for the teaser inside the text and never mark the ending down for its absence.",
    "mustFix lists only real problems of THIS text; praise goes to notes.",
    "",
    buildSeriesContext(brief),
  ].join("\n");
  const dimensions = SCORE_DIMENSIONS.map((dimension) => `"${dimension.key}": {"score": 0-10, "why": "German, with a short quote"}  // ${dimension.label}: ${dimension.question}`).join(",\n  ");
  const user = [
    targetBlock(brief),
    "",
    "EPISODE TEXT:",
    chapters.map((chapter, index) => `KAPITEL ${index + 1}: ${chapter.title}\n${chapter.text}`).join("\n\n"),
    "",
    "JSON:",
    `{"canonChecks": [{"quote": "German sentence from the text that touches an earlier canon fact or invariant (who owns what, where things are, what happened before, how the magic works)", "fact": "the canon fact or invariant it touches", "agrees": true}] (check EVERY such sentence before scoring),`,
    ` "dimensions": {\n  ${dimensions}\n},`,
    ` "mustFix": ["German: concrete problem with a quote → what exactly has to change"] (empty only if every dimension is 9 or 10),`,
    ` "notes": ["German: what is especially good and must be kept"]}`,
  ].join("\n");
  const result = await llm({ stage: "library-score", role: "critic", model: LIBRARY_MODELS.critic, system, user, json: true, maxTokens: 7000, effort: "low", temperature: 0.2, timeoutMs: 180_000 });
  ledger.recordCall("library-score", result, "critic");
  const parsed = parseJsonObject<{
    canonChecks?: Array<{ quote?: string; fact?: string; agrees?: boolean }>;
    dimensions?: Record<string, { score?: number; why?: string }>;
    mustFix?: string[];
    notes?: string[];
  }>(result.text);
  if (!parsed?.dimensions) throw new LibraryPipelineError("Scorer returned no dimensions.");
  // The reader rated canon 10 while a sentence contradicted episode 1 (live run 2026-10-20):
  // a listed contradiction caps the dimension no matter what number came with it.
  const contradictions = (parsed.canonChecks || []).filter((check) => check && check.agrees === false && check.quote);
  if (contradictions.length) {
    const entry = parsed.dimensions.kanonTreue || {};
    parsed.dimensions.kanonTreue = { score: Math.min(7, Number(entry.score) || 7), why: entry.why || "Widerspruch zum Kanon" };
  }
  const scores: Record<string, number> = {};
  const reasons: string[] = contradictions.map((check) => `Kanon-Widerspruch: „${check.quote}“ widerspricht „${check.fact}“ → so ändern, dass es zum Kanon passt.`);
  for (const dimension of SCORE_DIMENSIONS) {
    const entry = parsed.dimensions[dimension.key];
    const score = Math.max(0, Math.min(10, Number(entry?.score) || 0));
    scores[dimension.key] = score;
    if (score < MIN_DIMENSION_SCORE && entry?.why) reasons.push(`${dimension.label} (${score}): ${entry.why}`);
  }
  const mustFix = [...(Array.isArray(parsed.mustFix) ? parsed.mustFix : []), ...reasons].filter(Boolean).slice(0, 12);
  return {
    dimensions: scores,
    notes: Array.isArray(parsed.notes) ? parsed.notes.slice(0, 8) : [],
    mustFix,
    passed: Object.values(scores).every((score) => score >= MIN_DIMENSION_SCORE),
  };
}

function lowest(scores: EpisodeScores): number {
  return Math.min(...Object.values(scores.dimensions));
}

/* ── Stage 4: finalizer (facts, collectible, picture direction) ─────────── */

interface FinalizerOutput {
  summary?: string;
  canonFactsAdded?: string[];
  collectibleFields?: Array<{ label: string; value: string }>;
  guests?: Array<{ id: string; name: string; role?: string; visualProfileEn: string }>;
  cover?: { sceneEn: string; characterIds: string[]; boxes?: Record<string, number[]>; outfits?: Record<string, string> };
  pictures?: Array<{ chapter: number; afterParagraph: number; sceneEn: string; characterIds: string[]; boxes?: Record<string, number[]>; outfits?: Record<string, string> }>;
}

function validBox(value: unknown): value is number[] {
  return Array.isArray(value) && value.length === 4 && value.every((n) => Number.isFinite(Number(n)) && Number(n) >= 0 && Number(n) <= 1000) &&
    Number(value[0]) < Number(value[2]) && Number(value[1]) < Number(value[3]);
}

/** Keeps only ids that exist, boxes that are well-formed, at most four figures. */
export function sanitizeSlot(slot: { sceneEn?: string; characterIds?: string[]; boxes?: Record<string, number[]>; outfits?: Record<string, string> }, knownIds: Set<string>): ImageSlot | null {
  const sceneEn = String(slot.sceneEn || "").trim();
  if (!sceneEn) return null;
  const characterIds = Array.from(new Set((slot.characterIds || []).filter((id) => knownIds.has(id)))).slice(0, 4);
  const boxes: Record<string, number[]> = {};
  for (const id of characterIds) if (validBox(slot.boxes?.[id])) boxes[id] = slot.boxes![id].map(Number);
  const outfits: Record<string, string> = {};
  for (const id of characterIds) if (slot.outfits?.[id]) outfits[id] = String(slot.outfits[id]);
  return { sceneEn, characterIds, ...(Object.keys(boxes).length ? { boxes } : {}), ...(Object.keys(outfits).length ? { outfits } : {}) };
}

async function finalizeStage(
  brief: EpisodeBrief,
  blueprint: Blueprint,
  chapters: ParsedChapter[],
  llm: StorybookLlm,
  ledger: CostLedger,
): Promise<{ content: EpisodeContent }> {
  const type = COLLECTIBLE_FIELDS[brief.series.collectibleType];
  const castLines = brief.bible.characters.map((character) => `- ${character.id}: ${character.name} — ${character.visualProfileEn}`);
  const numbered = chapters.map((chapter, chapterIndex) => {
    const paragraphs = chapter.text.split(/\n\n/);
    return `CHAPTER ${chapterIndex + 1} „${chapter.title}“ (${paragraphs.length} paragraphs)\n${paragraphs.map((paragraph, index) => `[${index}] ${paragraph}`).join("\n")}`;
  }).join("\n\n");
  const system = [
    "You prepare a finished episode of a German children's series for print: canon facts, the collectible card and the art direction. Answer with ONE JSON object.",
    "",
    "ART DIRECTION RULES:",
    "- Every picture is a moment of the plot, caught mid-action like a film still: characters look at each other or at what happens, bodies in side or three-quarter view. Nobody poses or looks at the viewer.",
    "- One cover (the most inviting moment, never the ending) and exactly TWO pictures per chapter, showing two distinct action beats, roughly in the first and second half (never its first two or last two paragraphs). afterParagraph = the 0-based paragraph index whose moment the picture shows; the picture follows that paragraph. Space the two pictures apart and match each to the action at that paragraph.",
    "- sceneEn: English, at most 70 words: place and light first, then who does what and where they look. Name figures ONLY as [id] tokens, e.g. [ella]. Describe looks only through the tokens (the art team has reference pictures).",
    "- 1–4 figures per picture (characterIds = their ids, each must appear in sceneEn). Only figures that are physically present in that moment.",
    "- boxes: for every figure, where it stands as [top, left, bottom, right] on a 0–1000 scale of the landscape picture (3:2). A standing child is about 600–750 tall, adults about 750–900; keep figures apart, feet near the bottom, nobody cut in half.",
    "- outfits: only when the text dresses a figure differently than usual (pyjamas at night), English.",
    "- Pictures are wordless: no signs, posters, labels, open books or notes with writing; such objects are shown blank or from behind.",
    "- The episode's magical or literal event must be unmistakable in the cover and in the picture of the chapter where it happens: describe exactly what is unusual and visible (a pencil standing on its tip writing by itself with little motion lines, a dog as big as a pony filling the hallway), never as a concept.",
    "- Sizes stay true: a cat or a small creature is about 250–400 tall in the boxes, a fish tank about 250–350, a child 600–750, an adult 750–900; a vehicle may fill half the picture.",
    "- If a character's home or fixed object is fully in the picture (Bruno's round tank), that character is listed in characterIds, so it looks the same as in every other picture.",
    "- Big things stay where they can be: a vehicle is only drawn outdoors or seen through a window, never inside a room. If only a part reaches into the scene (a truck's trunk through the window), describe that part and do NOT list the vehicle.",
    "",
    "SERIES CAST (id: name — look):",
    ...castLines,
  ].join("\n");
  const user = [
    `Series: ${brief.series.title}. Episode S${brief.target.season}E${brief.target.episode} „${blueprint.title}“.`,
    blueprint.guests.length ? `Guests planned: ${blueprint.guests.map((guest) => `${guest.id}: ${guest.name} — ${guest.visualProfileEn}`).join("; ")}` : "",
    "",
    numbered,
    "",
    "JSON:",
    `{"summary": "German, 2 sentences for the episode card: situation and funny problem, never the ending",`,
    ` "canonFactsAdded": ["German facts this episode establishes that later episodes must respect (places, objects, nicknames, who knows what, running counts like notebook entry numbers)"] (5–10),`,
    type
      ? ` "collectibleFields": [${type.labels.map((label) => `{"label": "${label}", "value": "German, short"}`).join(", ")}],`
      : ` "collectibleFields": [{"label": "German", "value": "German"}] (3–5),`,
    ` "guests": [{"id": "kebab-case", "name": "German", "role": "German, one line", "visualProfileEn": "English look"}] (figures of this episode that are not in the series cast and appear in a picture),`,
    ` "cover": {"sceneEn": "...", "characterIds": ["..."], "boxes": {"id": [t,l,b,r]}},`,
    ` "pictures": [{"chapter": 1, "afterParagraph": 7, "sceneEn": "...", "characterIds": ["..."], "boxes": {"id": [t,l,b,r]}, "outfits": {}}] (exactly 6, two per chapter with distinct afterParagraph indexes)}`,
  ].filter(Boolean).join("\n");
  const result = await llm({ stage: "library-finalize", role: "support", model: LIBRARY_MODELS.support, system, user, json: true, maxTokens: 7000, effort: "low", timeoutMs: 180_000 });
  ledger.recordCall("library-finalize", result, "support");
  const parsed = parseJsonObject<FinalizerOutput>(result.text) ?? {};

  const castIds = new Set(brief.bible.characters.map((character) => character.id));
  const guests: EpisodeGuest[] = (parsed.guests?.length ? parsed.guests : blueprint.guests)
    .filter((guest) => guest?.id && guest.visualProfileEn && !castIds.has(guest.id))
    .slice(0, 3)
    .map((guest) => ({ id: String(guest.id).toLowerCase().replace(/[^a-z0-9-]/g, "-"), name: String(guest.name || guest.id), role: guest.role, visualProfileEn: String(guest.visualProfileEn) }));
  const known = new Set([...castIds, ...guests.map((guest) => guest.id)]);

  const contentChapters = chapters.map((chapter, index) => {
    const paragraphs = chapter.text.split(/\n\n/).length;
    const images = (parsed.pictures || []).filter((entry) => Number(entry.chapter) === index + 1).slice(0, 2).flatMap((picture) => {
      const slot = sanitizeSlot(picture, known);
      if (!slot) return [];
      const wanted = Number.isFinite(Number(picture.afterParagraph)) ? Number(picture.afterParagraph) : Math.floor(paragraphs / 2);
      const afterParagraph = Math.max(0, Math.max(Math.min(2, paragraphs - 1), Math.min(paragraphs - 3, wanted)));
      return [{ ...slot, afterParagraph }];
    }).sort((a, b) => a.afterParagraph - b.afterParagraph);
    if (images.length !== 2 || images[0].afterParagraph === images[1].afterParagraph) {
      throw new Error(`Kapitel ${index + 1}: Zwei verschiedene, passend platzierte Bildbriefings erforderlich.`);
    }
    return { title: chapter.title, text: chapter.text, ...(images.length ? { image: images[0], images } : {}) };
  });
  const cover = (parsed.cover && sanitizeSlot(parsed.cover, known)) || contentChapters[0]?.image || { sceneEn: blueprint.summary, characterIds: [] };

  const number = brief.canon.length + 1;
  const collectible: Collectible = {
    type: brief.series.collectibleType,
    title: `${type?.name ?? "Sammelkarte"} Nr. ${number}`,
    fields: (parsed.collectibleFields || []).filter((field) => field?.label && field?.value).map((field) => ({ label: String(field.label), value: String(field.value) })),
  };

  return {
    content: {
      title: String(blueprint.title || brief.target.title).trim(),
      summary: String(parsed.summary || blueprint.summary || "").trim(),
      cover: { ...cover, afterParagraph: undefined },
      guests,
      chapters: contentChapters,
      collectible,
      teaser: String(blueprint.teaser || "").trim(),
      canonFactsAdded: (parsed.canonFactsAdded || []).map(String).filter(Boolean).slice(0, 12),
    },
  };
}

/* ── The chain ──────────────────────────────────────────────────────────── */

export async function generateEpisodeText(
  brief: EpisodeBrief,
  llm: StorybookLlm,
  ledger: CostLedger,
  onStep: (step: string) => Promise<void> | void = () => {},
): Promise<EpisodeDraft> {
  await onStep("blueprint");
  const blueprint = await blueprintStage(brief, llm, ledger);

  await onStep("write");
  let chapters = await writeStage(brief, blueprint, llm, ledger);
  let writes = 1;
  await onStep("score");
  let scores = await scoreStage(brief, chapters, llm, ledger);
  let best = { chapters, scores };

  while (!scores.passed && writes < MAX_WRITES) {
    await onStep(`revision-${writes}`);
    chapters = await writeStage(brief, blueprint, llm, ledger, { previous: best.chapters, notes: best.scores.mustFix.length ? best.scores.mustFix : best.scores.notes });
    writes += 1;
    await onStep("score");
    scores = await scoreStage(brief, chapters, llm, ledger);
    // A revision that reads worse is not kept: the editor compares versions, not only the last one.
    if (lowest(scores) >= lowest(best.scores)) best = { chapters, scores };
  }

  await onStep("finalize");
  const { content } = await finalizeStage(brief, blueprint, best.chapters, llm, ledger);
  return { content, scores: best.scores, writes, blueprint };
}
