/**
 * Storybook Pipeline — illustrations with a vision check.
 *
 * Per picture:
 *   1. a reference sprite of ONLY the characters drawn on it (plus the artifact
 *      when visible) — still one collage, never loose portraits;
 *   2. the deterministic prompt from illustration-stage.ts;
 *   3. a cheap vision check (gpt-6-luna reads images) for the defects a parent
 *      notices first: extra hands or fingers, animal ears/tails on humans,
 *      doubled characters, text, the reference sheet painted into the scene;
 *      a second, much cheaper reader (jev.ts) runs alongside and adds what the
 *      first one lets through: a child with a tail or wings, the same figure twice;
 *   4. on a defect one regeneration with a new seed and a named correction;
 *      after bleed (animal features on humans) or a doubled figure the redraw
 *      keeps only the heroes on the sheet (benchmark 2026-10-15: a doubled hero
 *      appears almost only when the creatures' portraits are on the sheet —
 *      scene "child + dragon + cloud": 4/6 clean with heroes only, 0/6 with the
 *      full sheet); the better of the two attempts ships;
 *   5. hard defects (extra limbs, doubles, strangers, features on the wrong
 *      figure) are never printed; soft ones (who holds what, a posed lineup, a
 *      word on a sign) are. When both attempts carry a hard defect, a vignette
 *      without people — the page's key object or place — replaces the blank page.
 *
 * Everything external is injected (image provider, LLM port, sprite builder),
 * so this module runs the same under Encore, in the local harness and in tests.
 */

import { createHash } from "node:crypto";
import { createIdentityReferenceCache, type IdentityReferenceBuilder } from "../image-reference-sprite";
import { mentions } from "./checks";
import { parseJsonObject, type LlmCallResult, type StorybookLlm } from "./llm";
import { assembleFlux3ImagePrompt, assembleImagePrompt, mentionsElement, negativePromptFor, type VisualEntity } from "./illustration-stage";
import { interpretJev, JEV_MODEL, JEV_THRESHOLDS, jevQuestionsFor, parseJevScores, type JevPort, type JevScores } from "./jev";
import type { IllustrationPlan, IllustrationShot, StoryElement } from "./types";

export interface ImageRequest {
  page: number;
  /** Log stage of the provider call when it is no page or cover (a figure portrait). */
  logStage?: string;
  prompt: string;
  negativePrompt: string;
  referenceImages: string[];
  seed: number;
  width: number;
  height: number;
}

export interface ImageResponse {
  /** What gets stored on the story (may be a private bucket URL). */
  url?: string;
  /** A URL the vision checker can fetch, when `url` is not public. */
  viewUrl?: string;
  costUSD?: number;
  /** The provider refused (rate limit, quota, outage) — a smaller sheet or a vignette will not help. */
  refused?: boolean;
  httpStatus?: number;
}

export type ImageProvider = (request: ImageRequest) => Promise<ImageResponse>;

export interface ImageQaReport {
  anatomyDefects: string[];
  animalFeaturesOnHumans: string[];
  duplicates: string[];
  unexpectedCharacters: string[];
  /** A named character doing what the scene gives to someone else. */
  roleSwaps: string[];
  /** A story element worn as clothing, drawn as a person, or missing. Not shape/colour details. */
  elementMisuse: string[];
  /** A feature of one character drawn on another (moustache, crown, cape), or facial hair on a child. */
  featureBleed?: string[];
  /** Expected characters or story elements counted 0 times. */
  missing?: string[];
  /** Figures standing side by side facing the viewer instead of acting (story 774d5a5e page 3). */
  posing?: boolean;
  /** A story THING drawn twice (a doubled pot): worth a redraw, never a reason to leave the page blank. */
  thingDuplicates?: string[];
  /** The second reader's soft findings (same figure twice, fused bodies): a redraw, never a blank page. */
  jevFindings?: string[];
  /** The second reader's raw probabilities, for the log. */
  jev?: JevScores;
  textVisible: boolean;
  /** Where the checker saw writing ("letters on Adrian's T-shirt"): story 26fdd23f lost three pictures to "text visible" and nobody could tell where it was. */
  textSeen?: string;
  referenceSheetVisible: boolean;
  identityMatch: number;
  sceneMatch: number;
  namedCharactersVisible: number;
}

export interface ImageOutcome {
  page: number;
  url?: string;
  prompt: string;
  attempts: number;
  costUSD: number;
  qa?: ImageQaReport;
  severity: number;
  /** passed = clean; flawed = only soft defects, printed; failed = hard defect, never printed. */
  status: "passed" | "flawed" | "failed" | "unverified" | "missing";
  /** The picture is the people-free fallback, not the planned scene. */
  vignette?: boolean;
  /** The least bad picture, printed because every clean attempt failed. */
  salvaged?: boolean;
  /** Every attempt of this page in short form, for the log (story b10f2dad hid why page 7 failed), with the rejected picture. */
  history?: Array<{ kind: string; status: string; severity: number; notes: string[]; url?: string }>;
  /** 0 = full identity sheet, 1 = reduced sheet, 2 = no reference, -1 = no picture. */
  referenceLevel?: number;
  /** Why a delivery step failed — goes into the story metadata and logs. */
  errors?: string[];
}

export interface StorybookImagesResult {
  cover?: ImageOutcome;
  pages: Map<number, ImageOutcome>;
  imagesGenerated: number;
  imageCalls: number;
  imageCostUSD: number;
  qaCalls: LlmCallResult[];
  /** The second reader's calls, kept apart so the ledger shows what it costs. */
  jevCalls?: LlmCallResult[];
  regenerated: number[];
}

export interface GenerateImagesInput {
  illustrations: IllustrationPlan;
  entities: VisualEntity[];
  provider: ImageProvider;
  seed: string;
  llm?: StorybookLlm;
  visionModel?: string;
  buildReference?: IdentityReferenceBuilder;
  concurrency?: number;
  width?: number;
  height?: number;
  /** Final manuscript, independently of the director's interpretation. */
  pageTexts?: Record<number, string>;
  /** A second reader of another family when the first reply is unreadable. */
  fallbackVisionModel?: string;
  /** Jev: a cheap second opinion on tails, doubles and fused bodies; its failure never changes a verdict. */
  jev?: JevPort;
  historical?: boolean;
  /** Per-pipeline art direction, reused for cover, pages, redraws and vignettes. */
  imageStyle?: string;
  actionDirection?: string;
  imagePromptProfile?: "flux3-modern";
  /** Chapter books draw the cover once, with the first batch only. */
  skipCover?: boolean;
  /**
   * Draw rung 3 (heroes and things only) next to the redraw instead of after it. Story 5e583e1e: the slowest of seven
   * pictures walked its rungs one after another, a render plus a vision read each (≈ 15 s a rung, 60 s in all). Same
   * seeds and the same choice as in sequence; when the redraw passes, the spare picture and its vision read are paid
   * and unused.
   */
  parallelRedraw?: boolean;
  /**
   * false: a picture whose only fault is a loosely matched scene (sceneMatch < 0.5) is kept as it is. A redraw renders
   * the same scene prompt again; on FLUX 3 that never fixed the match (story 0ee9af53) and costs a picture plus a check.
   */
  redrawLooseScene?: boolean;
}

/** Keep rejected candidates for diagnostics, but never attach them to a reading page. */
export function isPublishable(outcome: Pick<ImageOutcome, "status" | "url"> | undefined): boolean {
  return Boolean(outcome?.url) && (outcome?.status === "passed" || outcome?.status === "flawed");
}

export function publishableImageUrl(outcome: ImageOutcome | undefined): string | undefined {
  return isPublishable(outcome) ? outcome!.url : undefined;
}

function seedFor(seed: string, page: number, attempt: number): number {
  const hex = createHash("sha256").update(`${seed}:${page}:${attempt}`).digest("hex").slice(0, 8);
  return parseInt(hex, 16) % 2_147_483_647;
}

const CAST_SHADOW_LOOK = /\b(shadow|silhouette)\b/i;

/**
 * Things that come in numbers ("hopping sound bubbles", "paper boats") are never "drawn twice":
 * book run flex-quality-1 (2026-10-16) redrew three of six pictures because bubbles were counted.
 */
export function isPluralElement(element: { name: string; noun?: string; look?: string }, scene = ""): boolean {
  const last = String(element.noun || element.name || "").trim().toLowerCase().split(/\s+/).pop() || "";
  if (/(?<![siu])s$/.test(last)) return true;
  if (!/^[a-z]{3,}$/.test(last)) return false;
  // The director names it in the singular ("sound bubble", by its own rule), yet paints and tells it in numbers:
  // the plural stands in the look or in the scene (re-run of the same book 2026-10-16: "sound bubble drawn 6 times" on 6 of 15 pictures).
  return new RegExp(`\\b${last}(?:s|es)\\b`, "i").test(`${element.look || ""} ${scene}`);
}

/** Four or more of a thing is a group, never "a doubled pot". */
const GROUP_OF_THINGS = 4;
function countedIn(note: string): number {
  return Number(note.match(/drawn (\d+) times/i)?.[1] || 0);
}

/**
 * The names the checker is asked to count — and the only ones its reply must count. Book "Die Flotte der Minuten"
 * (2026-10-16): the prompt left out the paper boats (they come in numbers), the parser still demanded a count for
 * them, every reply was "incomplete", and the cover plus 8 of 16 pictures were dropped as unverified without a log line.
 */
export function qaCountNames(expected: Array<Pick<VisualEntity, "name" | "kind">>, elements: Array<{ name: string; look: string; noun?: string }>, scene: string): string[] {
  return [
    ...expected.filter((entity) => entity.kind !== "artifact").map((entity) => entity.name),
    ...elements.filter((element) => !isPluralElement(element, scene)).map((element) => element.name),
  ];
}

export function buildQaPrompt(expected: VisualEntity[], scene: string, hasReference: boolean, elements: Array<{ name: string; look: string; noun?: string }> = [], pageText?: string): string {
  const many = elements.filter((element) => isPluralElement(element, scene));
  const list = expected.map((entity) => `- ${entity.name}: ${entity.kind === "artifact" ? "object" : entity.isHuman ? entity.role === "hero" ? "HUMAN CHILD" : "HUMAN" : entity.species}; ${entity.appearance}`).join("\n") || "- (no named characters)";
  return [
    "You inspect ONE illustration from a children's picture book for defects a parent would notice immediately.",
    `Attachment 1 is the illustration.${hasReference ? " Attachment 2 is a technical identity sheet (reference only, NOT part of the artwork)." : ""}`,
    "Expected named characters:",
    list,
    `Intended scene: ${scene.slice(0, 500)}`,
    ...(pageText ? [`Actual reading page: ${pageText}`, "The illustration depicts ONE moment from the page, not every mentioned person. Reject contradictions in the key action, place or object state; do not require off-panel characters."] : []),
    ...(elements.length ? [`Story elements in this picture: ${elements.map((element) => `${element.name} — ${element.look}`).join("; ")}. Report under elementMisuse ONLY if one is worn as clothing, drawn as a person, or missing entirely — never for shape, size or colour details.`] : []),
    // "Schatto führt Regie": the children's own cast shadows touching the living shadow were counted as its extra arms.
    ...(elements.some((element) => CAST_SHADOW_LOOK.test(`${element.look} ${element.name}`)) ? ["A story element that is a shadow or silhouette lies on a wall or the ground: where the children's own cast shadows touch or cross it, that is not an extra limb — count only the arms that clearly grow from its own shoulders. A shadow drawn as a solid standing body is elementMisuse."] : []),
    "",
    "Inspect the actual pixels, not the prompt's claims. Look for MERGED bodies and extra limbs on EVERY figure, including animals: human hands or sweater sleeves on a natural goat are defects too. Talking does not change anatomy. Count arms from each shoulder to each hand, including behind the body.",
    "Look carefully at every hand, arm, leg, head and ear. Count fingers where visible. Check every face: children never have a moustache or beard, and no character wears another character's moustache, crown, hat, cape, wings or tail.",
    "Compare who does the KEY action with the intended scene, using the reference sheet to tell the characters apart. Ignore small pose or prop differences — a picture book illustration may interpret the moment freely.",
    ...(many.length ? [`${many.map((element) => element.name).join(", ")} come in numbers by nature: never count them and never report them as duplicates.`] : []),
    "First count how often EACH expected character and story element is drawn (a second person with the same face, hair or outfit counts, a second goose counts, a second girl in the same dress counts even with other hair). Exactly 1 is correct; 2 or more is a duplicate; 0 means missing.",
    ...(expected.some((entity) => entity.kind === "character") ? ["posing: true only when the figures stand or sit side by side facing the viewer, like a group photo, instead of doing the scene's action."] : []),
    // Story 26fdd23f: three pictures failed on "text visible" ten times and the log could not say where the writing was.
    "textVisible: true when letters, digits or word-like scribbles are drawn anywhere — a sign, a page, a game board square, a label, a logo or print on clothing. Painted pictures, symbols, dots and patterns are not text, and neither is what the reading page says is written somewhere. textSeen: where and what (e.g. \"scribbled word under a logo on Adrian's shirt\"), empty when there is none.",
    "Return JSON only:",
    JSON.stringify({
      characterCounts: Object.fromEntries(qaCountNames(expected, elements, scene).map((name) => [name, "integer count"])),
      namedCharactersVisible: 0,
      anatomyDefects: [],
      animalFeaturesOnHumans: [],
      featureBleed: [],
      duplicates: [],
      unexpectedCharacters: [],
      roleSwaps: [],
      elementMisuse: [],
      posing: false,
      textVisible: false,
      textSeen: "",
      referenceSheetVisible: false,
      identityMatch: 0.0,
      sceneMatch: 0.0,
    }),
    "identityMatch/sceneMatch: 0-1. Wrong age/species/clothing is low identityMatch. A missing wheel or an uncaught sack in a catch scene is low sceneMatch. Only short observed defects in arrays; empty arrays when clean. Count every expected name, never omit one. Do not invent defects from occluded fingers.",
  ].join("\n");
}

/** A count the checker wrote as 1, "1" or "1 time"; undefined when there is none. */
function countValue(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : Number(String(value ?? "").match(/^\s*(\d+)/)?.[1] ?? NaN);
  return Number.isInteger(n) && n >= 0 ? n : undefined;
}

/** 0.9, "0.9" or 90 (percent) → 0.9; undefined when unreadable. */
function unitValue(value: unknown): number | undefined {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n > 1 && n <= 100 ? n / 100 : n <= 1 ? n : undefined;
}

/**
 * Story 2b414c45: the cover and page 4 were drawn, but both checker replies
 * were "incomplete" and the pictures were dropped. The checker names a figure
 * "Rolf" instead of "Räuber Rolf" or writes counts as strings; a count is found
 * by the exact name, case-insensitively or by the distinctive name part.
 */
export function parseQaReport(raw: string, expectedNames?: string[]): ImageQaReport | null {
  const data = parseJsonObject<any>(raw);
  if (!data || (!data.characterCounts && !Number.isFinite(Number(data.namedCharactersVisible)))) return null;
  const given = data.characterCounts && typeof data.characterCounts === "object" && !Array.isArray(data.characterCounts) ? Object.entries(data.characterCounts) : [];
  const byName = (name: string) => given.find(([key]) => key === name) || given.find(([key]) => key.toLowerCase() === name.toLowerCase())
    || given.find(([key]) => mentions(key, name) || mentions(name, key));
  // The checker writes the keys in the order it was given them; a German name it translated ("Die Stundendiebin" →
  // "Hour Thief") is the unmatched key in the unmatched name's place — paired only when the numbers agree.
  const unmatchedNames = (expectedNames || []).filter((name) => !byName(name));
  const unmatchedKeys = given.filter(([key]) => !(expectedNames || []).some((name) => byName(name)?.[0] === key));
  const countFor = (name: string): number | undefined => {
    const exact = byName(name) || (unmatchedNames.length === unmatchedKeys.length ? unmatchedKeys[unmatchedNames.indexOf(name)] : undefined);
    return exact ? countValue(exact[1]) : undefined;
  };
  if (expectedNames && (
    expectedNames.some((name) => countFor(name) === undefined) ||
    ![data.identityMatch, data.sceneMatch].every((n) => unitValue(n) !== undefined)
  )) return null;
  if (expectedNames) data.characterCounts = Object.fromEntries(expectedNames.map((name) => [name, countFor(name)]));
  data.identityMatch = unitValue(data.identityMatch) ?? data.identityMatch;
  data.sceneMatch = unitValue(data.sceneMatch) ?? data.sceneMatch;
  const list = (value: unknown) => (Array.isArray(value) ? value.map((item) => String(item ?? "").trim()).filter((item) => item && !/^(e\.g\.|ONLY:)/i.test(item)).slice(0, 6) : []);
  const unit = (value: unknown) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.5;
  };
  // Counts are the reliable signal: a model that lists no duplicate in prose
  // still writes "Johann": 2 when asked to count.
  const counts = data.characterCounts && typeof data.characterCounts === "object" ? data.characterCounts : {};
  const counted = Object.entries(counts).map(([name, value]) => [name, Math.round(Number(value) || 0)] as const);
  const countedDuplicates = counted.filter(([, count]) => count >= 2).map(([name, count]) => `${name} drawn ${count} times`);
  const duplicates = [...list(data.duplicates), ...countedDuplicates].slice(0, 6);
  const countedVisible = counted.filter(([, count]) => count >= 1).length;
  const missing = counted.filter(([, count]) => count === 0).map(([name]) => name).slice(0, 6);
  return {
    anatomyDefects: list(data.anatomyDefects),
    animalFeaturesOnHumans: list(data.animalFeaturesOnHumans),
    duplicates,
    unexpectedCharacters: list(data.unexpectedCharacters),
    roleSwaps: list(data.roleSwaps),
    elementMisuse: list(data.elementMisuse),
    featureBleed: list(data.featureBleed),
    missing,
    posing: data.posing === true,
    textVisible: data.textVisible === true,
    ...(data.textVisible === true && String(data.textSeen ?? "").trim() ? { textSeen: String(data.textSeen).trim().slice(0, 160) } : {}),
    referenceSheetVisible: data.referenceSheetVisible === true,
    identityMatch: unit(data.identityMatch),
    sceneMatch: unit(data.sceneMatch),
    namedCharactersVisible: counted.length > 0 ? countedVisible : Math.max(0, Math.round(Number(data.namedCharactersVisible) || 0)),
  };
}

/**
 * Hard: what a child sees at once and a parent would not accept — never printed.
 * Soft: the picture tells the page a little differently — printed rather than
 * leaving a picture book page blank (story 774d5a5e lost three of seven
 * pictures, two of them to role swaps and a missing arrow alone).
 */
export function qaSeverityParts(
  report: ImageQaReport | undefined,
  expectedCharacters: number,
  options: { heroNames?: string[]; cover?: boolean } = {}
): { hard: number; soft: number } {
  if (!report) return { hard: 999, soft: 0 };
  let hard = 0;
  let soft = 0;
  hard += report.anatomyDefects.length * 10;
  hard += report.animalFeaturesOnHumans.length * 10;
  hard += report.duplicates.length * 10;
  soft += (report.thingDuplicates?.length || 0) * 10;
  hard += (report.featureBleed?.length || 0) * 10;
  // Story 2db50859 page 7: a second Elsa with other hair was only an
  // "unexpected girl" (5) and shipped. A stranger in the scene is a redraw.
  hard += Math.min(report.unexpectedCharacters.length, 2) * 10;
  if (report.referenceSheetVisible) hard += 12;
  if (report.identityMatch < 0.6) hard += 10;
  if (report.namedCharactersVisible > expectedCharacters) hard += 6;
  // A wrong key action is worth a redraw, but it does not make the page unreadable.
  soft += report.roleSwaps.length * 10;
  soft += (report.elementMisuse?.length || 0) * 10;
  soft += (report.jevFindings?.length || 0) * 10;
  // Story 2db50859: Adrian missing on the cover and page 1, Alexander on page 3.
  // Only visible figures belong to the manifest, so each one is required; a
  // cover without one of its heroes is never printed.
  for (const name of (report.missing || []).slice(0, 2)) {
    if (options.cover && options.heroNames?.includes(name)) hard += 10;
    else soft += 10;
  }
  if (report.posing) soft += 10;
  // User rule 2026-10-08: no writing in any generated picture. Run v2-img B1 printed two pages with scribbled tablets at 6.
  if (report.textVisible) soft += 10;
  if (!report.missing?.length && expectedCharacters > 0 && report.namedCharactersVisible < expectedCharacters) soft += 3;
  if (report.sceneMatch < 0.5) soft += 10;
  return { hard, soft };
}

/** 0 = clean. Anything >= 10 is a defect worth one regeneration. */
export function qaSeverity(report: ImageQaReport | undefined, expectedCharacters: number, heroNames: string[] = [], cover = false): number {
  const { hard, soft } = qaSeverityParts(report, expectedCharacters, { heroNames, cover });
  return hard + soft;
}

export function qaStatus(report: ImageQaReport | undefined, parts: { hard: number; soft: number }): ImageOutcome["status"] {
  if (!report) return "unverified";
  if (parts.hard + parts.soft < 10) return "passed";
  // User rule 2026-10-08: no writing in any picture. As a mere flaw it shipped after the redraw
  // (book 6950cb7e chapter 6: a sign reading "FRAU GLEICHGLEICH DAY DAY LNACE").
  if (report.textVisible) return "failed";
  return parts.hard < 10 ? "flawed" : "failed";
}

/**
 * Findings about things that are not in the picture are noise: story 774d5a5e
 * page 5 had no story element, yet "the painted arrow is not visible" counted
 * as element misuse and the picture was dropped.
 */
export function scopeQaReport(report: ImageQaReport, onStageNames: string[], elements: StoryElement[], scene = ""): ImageQaReport {
  const aboutElement = (note: string) => elements.some((element) => mentionsElement(note, element));
  const aboutCharacter = (note: string) => onStageNames.some((name) => mentions(note, name));
  // "Schwebetopf appears twice" is a doubled THING, "Adrian drawn 2 times" a doubled person.
  const thingNames = elements.filter((element) => !element.figure);
  const aboutThing = (note: string, things: StoryElement[]) => !aboutCharacter(note) && things.some((element) => mentionsElement(note, element));
  // Several bubbles or boats are the story, not a defect.
  const single = thingNames.filter((element) => !isPluralElement(element, scene));
  return {
    ...report,
    duplicates: report.duplicates.filter((note) => !aboutThing(note, thingNames)),
    thingDuplicates: report.duplicates.filter((note) => aboutThing(note, single) && countedIn(note) < GROUP_OF_THINGS),
    elementMisuse: (report.elementMisuse || []).filter(aboutElement),
    roleSwaps: report.roleSwaps.filter(aboutCharacter),
  };
}

/**
 * What the heroes-only picture (rung 3) can mend: too many bodies — a double, a stranger, a figure lost in the crowd,
 * merged limbs, a feature on the wrong figure. Writing, a pose or a wrong action come back without the crowd too: in
 * story 26fdd23f the spare heroes-only picture drawn next to every redraw (parallelRedraw) was paid for five pictures
 * and printed for none — twice the redraw passed anyway, three times the spare failed like everything before it.
 */
export function crowdTrouble(qa: ImageQaReport | undefined): boolean {
  if (!qa) return false;
  return Boolean(qa.duplicates.length || qa.unexpectedCharacters.length || qa.missing?.length || qa.anatomyDefects.length
    || qa.animalFeaturesOnHumans.length || qa.featureBleed?.length || qa.jevFindings?.length);
}

/**
 * Last rung of the ladder: a picture with a doubled thing, a feature on the
 * wrong figure or a slightly off scene still beats a blank page; a body
 * defect, a stranger, a doubled person, animal traits on a child or the
 * reference sheet in the picture does not.
 */
export function salvageable(report: ImageQaReport | undefined): boolean {
  if (!report) return false;
  return !report.anatomyDefects.length
    && !report.animalFeaturesOnHumans.length
    && !report.unexpectedCharacters.length
    && !report.duplicates.length
    && !report.referenceSheetVisible
    && !report.textVisible
    // "Die Flotte der Minuten" chapter 6: Adrian wore Brumm's green beard on the raft and was printed as the least bad
    // picture. A creature in sleeves can stay; a child with a beard is what a parent sees first.
    && !(report.featureBleed || []).some((note) => /\b(beard|moustache|mustache|bart|schnurrbart)\b/i.test(note));
}

/**
 * A redraw instruction in positive words only. Story 31a7a59d / run fix4-0929-a:
 * quoting the checker ("Theo has the troll's shaggy orange beard") put exactly
 * that into the next picture — a diffusion model draws what it reads.
 */
/**
 * What every redraw adds after its named correction. It used to say "Simple clear composition; separate
 * silhouettes, one pose per figure" and swapped the scene for the director's 35-word simpleScene. Benchmark
 * 2026-10-15 (3-figure scenes, FLUX.2 klein 4B, same cost): that redraw gave 0 % good scenes — environment
 * 1.1/3, action 0.75/3, 83 % figures on a pale wash with no place (the plain, posed pictures of book 29ae501d);
 * the full scene plus this sentence gave 92 % good scenes (environment 3.0, action 2.6) and more clean pictures.
 */
export const REDRAW_KEEPS_SCENE = "Each figure is its own separate body, drawn exactly once, with the full place around them and the described action in progress.";

export function correctionFor(report: ImageQaReport, elementNames: string[] = []): string {
  const fixes: string[] = [];
  if (report.anatomyDefects.length) fixes.push("Every figure is one separate, complete body with natural anatomy.");
  if (report.animalFeaturesOnHumans.length || report.featureBleed?.length) fixes.push("Each figure looks exactly like its own place on the identity sheet; the children look like ordinary human kids in their own clothes.");
  if (report.duplicates.length || report.unexpectedCharacters.length || report.jevFindings?.some((finding) => /twice/.test(finding))) fixes.push("The listed figures are the only figures in the picture, each exactly once.");
  if (report.jevFindings?.some((finding) => /fused/.test(finding))) fixes.push("Every figure is one separate, complete body; the figures stand apart so no two bodies merge.");
  if (report.jevFindings?.some((finding) => /mixes features/.test(finding))) fixes.push("Every figure keeps only its own hair, face, ears and clothes from its own place on the identity sheet: creatures never wear a child's hair or clothes, children never get animal or pointed ears.");
  if (report.jevFindings?.some((finding) => /same garment/.test(finding))) fixes.push("Every garment belongs to exactly one figure: a vest, jacket or hat is worn by one person only, and each figure wears its own outfit from the identity sheet.");
  if (report.missing?.length) fixes.push(`${report.missing.slice(0, 3).join(" and ")} clearly visible in the foreground.`);
  const misused = elementNames.filter((name) => report.elementMisuse?.some((note) => note.toLowerCase().includes(name.toLowerCase())));
  if (misused.length) fixes.push(`${misused.join(" and ")} shown as its own separate figure or thing.`);
  if (report.referenceSheetVisible) fixes.push("One single full-bleed scene.");
  if (report.roleSwaps.length || report.sceneMatch < 0.5) fixes.push("Freeze the single described action at its stated location; keep each prop with its named owner.");
  if (report.posing) fixes.push("Everyone is busy with the action and turned toward it.");
  if (report.textVisible) fixes.push("A wordless picture: every sign, page, tablet and surface is plain and unmarked or shows a small painted symbol.");
  if (report.identityMatch < 0.6) fixes.push("Match each named figure's age, species, face and outfit to its own reference.");
  return fixes.join(" ");
}

async function mapWithLimit<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, run));
  return results;
}

export async function generateStorybookImages(input: GenerateImagesInput): Promise<StorybookImagesResult> {
  const buildImagePrompt = input.imagePromptProfile === "flux3-modern" ? assembleFlux3ImagePrompt : assembleImagePrompt;
  const buildReference = input.buildReference || createIdentityReferenceCache();
  const byId = new Map(input.entities.map((entity) => [entity.id, entity]));
  const artifact = input.entities.find((entity) => entity.kind === "artifact");
  const qaCalls: LlmCallResult[] = [];
  const jevCalls: LlmCallResult[] = [];
  const regenerated: number[] = [];
  let imageCalls = 0;
  let imageCostUSD = 0;
  // Story c6df0e94: Runware answered 429 to all 29 requests; the ladder and the
  // vignette fired them within one second. After three refusals without a
  // single picture the book stops asking.
  let delivered = 0;
  let refused = 0;
  const providerDown = () => refused >= 3 && delivered === 0;

  const shots: IllustrationShot[] = input.skipCover ? [...input.illustrations.pages] : [input.illustrations.cover, ...input.illustrations.pages];

  // Heroes first: when a sheet must shrink, the avatars keep their identity.
  const rank = (entity: VisualEntity) => (entity.role === "hero" ? 0 : entity.kind === "artifact" ? 2 : 1);
  const width = input.width ?? 1024;
  const height = input.height ?? 1024;

  /**
   * One vision read. An unreadable report gets exactly one more read — story
   * 774d5a5e page 2 threw away its redraw because the report was incomplete,
   * not because the picture was bad. A checker that fails outright is not
   * retried here; the LLM port has its own retry.
   */
  const inspect = async (stage: string, user: string, imageInputs: string[], expectedNames: string[], errors: string[], label: string): Promise<ImageQaReport | undefined> => {
    if (!input.llm || !input.visionModel) return undefined;
    for (const suffix of ["", "-retry"]) {
      try {
        const call = await input.llm({
          stage: `${stage}${suffix}`,
          role: "support",
          // The same model repeated the same unreadable reply for the cover and
          // page 4 of story 2b414c45; the second read goes to the other family.
          model: suffix && input.fallbackVisionModel ? input.fallbackVisionModel : input.visionModel,
          system: "You are a meticulous picture-book illustration checker. Answer with JSON only.",
          user,
          json: true,
          // "low": without any thinking the checker missed two Johanns and two
          // Rosalindes (story 655ef79b). A little counting costs ~$0.0002.
          maxTokens: 3000,
          effort: "low",
          imageInputs,
          timeoutMs: 60_000,
        });
        qaCalls.push(call);
        const qa = parseQaReport(call.text, expectedNames.length ? expectedNames : undefined);
        if (qa) return qa;
      } catch (err) {
        console.warn(`[storybook/images] vision check failed (${label}):`, (err as Error)?.message || err);
        errors.push(`${label}: image QA unavailable`);
        return undefined;
      }
    }
    errors.push(`${label}: incomplete image QA report`);
    return undefined;
  };

  /**
   * The second reader, run next to the first. A failure (alpha API, download, timeout)
   * is logged and costs nothing but the second opinion.
   */
  const secondOpinion = async (imageUrl: string, drawn: VisualEntity[], label: string): Promise<JevScores | undefined> => {
    if (!input.jev || drawn.length === 0) return undefined;
    try {
      const reply = await input.jev({ imageUrl, questions: jevQuestionsFor(drawn) });
      jevCalls.push({
        text: JSON.stringify(reply.answers),
        modelUsed: JEV_MODEL,
        usage: { prompt: reply.inputTokens, completion: 0, total: reply.inputTokens, costUSD: reply.costUSD },
        durationMs: reply.durationMs,
      });
      return parseJevScores(reply.answers) ?? undefined;
    } catch (err) {
      console.warn(`[storybook/images] second reader failed (${label}):`, (err as Error)?.message || err);
      return undefined;
    }
  };

  /** The second reader's findings added to the checker's report; a hybrid it shares with the checker is not counted twice. */
  const withSecondOpinion = (qa: ImageQaReport, scores: JevScores | undefined): ImageQaReport => {
    if (!scores) return qa;
    const found = interpretJev(scores);
    return {
      ...qa,
      animalFeaturesOnHumans: qa.animalFeaturesOnHumans.length ? qa.animalFeaturesOnHumans : found.hybrid,
      jevFindings: found.soft,
      textVisible: qa.textVisible || found.text,
      jev: scores,
    };
  };

  const renderShot = async (shot: IllustrationShot): Promise<ImageOutcome> => {
    const cover = shot.page === 0;
    const allElements = input.illustrations.storyElements || [];
    const fullOnStage = shot.onStage.map((id) => byId.get(id)).filter((entity): entity is VisualEntity => Boolean(entity));
    const fullElements = allElements.filter((element) => shot.elements?.includes(element.name));
    const fullDrawn = [...fullOnStage, ...(shot.artifactVisible && artifact ? [artifact] : [])];

    /** One composition to draw: the full shot, or the reduced one (heroes only) after two failures. */
    interface Plan {
      kind: "full" | "reduced";
      onStage: VisualEntity[];
      drawn: VisualEntity[];
      elements: StoryElement[];
      sceneOf: (attemptNo: number) => string;
      ladder: VisualEntity[][];
      qaScene: string;
    }

    // A page must never stay blank. Story 0039344e lost three of eight
    // pictures because the only attempt path was "full sheet or nothing".
    // Ladder: full sheet → the two most important identities → no reference.
    const ladderFor = (sheetEntities: VisualEntity[]): VisualEntity[][] => {
      const steps: VisualEntity[][] = [sheetEntities];
      if (sheetEntities.length > 2) {
        const keep = new Set([...sheetEntities].sort((a, b) => rank(a) - rank(b)).slice(0, 2).map((entity) => entity.id));
        steps.push(sheetEntities.filter((entity) => keep.has(entity.id)));
      }
      if (sheetEntities.length > 0) steps.push([]);
      return steps;
    };
    // The sheet follows the picture from left to right (the director lists
    // onStage that way), so "first on the sheet" is also the figure on the left.
    const withReferences = fullDrawn.filter((entity) => entity.referenceUrl);
    // Story fix-0929-a: with the dragon on the sheet, Mina got its wings on five
    // of eight pictures — and again on every redraw; in fix3-0929-b the witch's
    // hat and robe landed on Amir. After such a bleed the redraw keeps only the
    // heroes on the sheet; everyone else comes from the text look.
    const heroSheet = withReferences.filter((entity) => entity.role === "hero" || entity.kind === "artifact");
    const canSplitSheet = heroSheet.length > 0 && heroSheet.length < withReferences.length;

    const fullPlan: Plan = {
      kind: "full",
      onStage: fullOnStage,
      drawn: fullDrawn,
      elements: fullElements,
      // The redraw keeps the full scene (place, light, action); the director's simpleScene dropped the place (see REDRAW_KEEPS_SCENE).
      sceneOf: () => shot.scene,
      ladder: ladderFor(withReferences),
      qaScene: shot.scene,
    };

    /**
     * Story b10f2dad: the last page (all figures gathered) failed twice with a
     * doubled pot and the dragon in a sweater, and the page stayed blank. The
     * reduced plan draws only the heroes and the things, in a scene without
     * the sentences about everybody else.
     */
    const reducedPlan = (): Plan | null => {
      const heroes = fullOnStage.filter((entity) => entity.role === "hero");
      const keep = heroes.length ? heroes : fullOnStage.slice(0, 1);
      if (keep.length === 0 || keep.length >= fullOnStage.length && fullElements.every((element) => !element.figure)) return null;
      const dropped = fullOnStage.filter((entity) => !keep.includes(entity));
      const droppedFigures = fullElements.filter((element) => element.figure);
      const trim = (text: string) => {
        const kept = text.split(/(?<=[.!?])\s+/).filter((sentence) => !dropped.some((entity) => mentions(sentence, entity.name)) && !droppedFigures.some((element) => mentionsElement(sentence, element)));
        return kept.length ? kept.join(" ") : text;
      };
      const base = trim(shot.scene);
      const things = fullElements.filter((element) => !element.figure);
      const drawn = [...keep, ...(shot.artifactVisible && artifact ? [artifact] : [])];
      return {
        kind: "reduced",
        onStage: keep,
        drawn,
        elements: things,
        sceneOf: () => base,
        ladder: ladderFor(drawn.filter((entity) => entity.referenceUrl)),
        qaScene: base,
      };
    };

    let costUSD = 0;
    const errors: string[] = [];
    const history: NonNullable<ImageOutcome["history"]> = [];
    const addCost = (response: ImageResponse) => {
      const cost = Number.isFinite(response.costUSD) ? Number(response.costUSD) : 0;
      costUSD += cost;
      imageCostUSD = Number((imageCostUSD + cost).toFixed(6));
    };

    // Per delivery, not per picture: the redraw and the heroes-only attempt may run at the same time.
    const deliver = async (plan: Plan, attemptNo: number, extra: string, startLevel: number, ladder: VisualEntity[][]) => {
      let lastPrompt = shot.scene;
      let refusedNow = false;
      for (let level = startLevel; level < ladder.length; level += 1) {
        if (providerDown()) {
          errors.push("image provider unavailable; no further requests");
          refusedNow = true;
          break;
        }
        const sheet = ladder[level];
        let references: string[] = [];
        if (sheet.length > 0) {
          try {
            references = (await buildReference(sheet.map((entity) => ({ imageUrl: entity.referenceUrl!, displayName: entity.name, kind: entity.kind, ...(entity.marks?.length ? { marks: entity.marks } : {}) })))).urls;
          } catch (err) {
            errors.push(`sheet ${sheet.map((entity) => entity.name).join("+")}: ${(err as Error)?.message || err}`);
            continue;
          }
        }
        const prompt = buildImagePrompt({ scene: plan.sceneOf(attemptNo), onStage: plan.drawn, spriteOrder: sheet, elements: plan.elements, correction: extra || undefined, style: input.imageStyle, actionDirection: input.actionDirection });
        lastPrompt = prompt;
        imageCalls += 1;
        try {
          const response = await input.provider({
            page: shot.page,
            prompt,
            negativePrompt: negativePromptFor(plan.drawn, sheet.length > 1, input.historical),
            referenceImages: references,
            seed: seedFor(input.seed, shot.page, attemptNo * 10 + level),
            width,
            height,
          });
          addCost(response);
          if (response.url) {
            delivered += 1;
            return { response, references, prompt, level, refused: false };
          }
          if (response.refused) {
            refused += 1;
            refusedNow = true;
            errors.push(`level ${level}: provider refused (HTTP ${response.httpStatus ?? "?"})`);
            // A rate limit is not a reference problem: descending the ladder only adds requests.
            break;
          }
          errors.push(`level ${level}: provider returned no image`);
        } catch (err) {
          errors.push(`level ${level} (${references.length ? `${sheet.length} identities` : "no reference"}): ${(err as Error)?.message || err}`);
        }
        console.warn(`[storybook/images] page ${shot.page}: ${errors[errors.length - 1]}`);
      }
      return { response: {} as ImageResponse, references: [] as string[], prompt: lastPrompt, level: -1, refused: refusedNow };
    };

    type Attempt = ImageOutcome & { level: number; plan?: Plan["kind"]; refused?: boolean; looseScene?: boolean };

    const note = (kind: string, outcome: Attempt) => {
      const parts = qaSeverityParts(outcome.qa, 0);
      history.push({
        kind,
        status: outcome.status,
        severity: outcome.severity,
        notes: outcome.qa
          ? [
              ...outcome.qa.anatomyDefects, ...outcome.qa.animalFeaturesOnHumans, ...outcome.qa.duplicates, ...(outcome.qa.thingDuplicates || []), ...(outcome.qa.jevFindings || []), ...(outcome.qa.featureBleed || []), ...outcome.qa.roleSwaps, ...outcome.qa.unexpectedCharacters, ...outcome.qa.missing?.map((name) => `${name} missing`) || [],
              // The flags too: without them a redraw for writing or a pose left no reason in the log.
              ...(outcome.qa.textVisible ? [outcome.qa.jev && outcome.qa.jev.text >= JEV_THRESHOLDS.text ? `text visible [jev ${Math.round(outcome.qa.jev.text * 100)}%]` : `text visible${outcome.qa.textSeen ? `: ${outcome.qa.textSeen}` : ""}`] : []),
              ...(outcome.qa.referenceSheetVisible ? ["reference sheet visible"] : []),
              ...(outcome.qa.posing ? ["posing"] : []),
              ...(outcome.qa.identityMatch < 0.6 ? [`identity ${outcome.qa.identityMatch}`] : []),
              ...(outcome.qa.sceneMatch < 0.5 ? [`scene ${outcome.qa.sceneMatch}`] : []),
              ...(outcome.qa.elementMisuse || []),
            ].slice(0, 6)
          : [outcome.status],
        ...(parts.hard >= 999 ? {} : {}),
        // The rejected picture stays in the bucket; with its address an audit can look at it.
        ...(outcome.url ? { url: outcome.url } : {}),
      });
    };

    const attempt = async (plan: Plan, attemptNo: number, extra: string, startLevel: number, ladder = plan.ladder): Promise<Attempt> => {
      const got = await deliver(plan, attemptNo, extra, startLevel, ladder);
      const url = got.response.url;
      if (!url) return { page: shot.page, prompt: got.prompt, attempts: attemptNo, costUSD, severity: 999, status: "missing", level: -1, plan: plan.kind, refused: got.refused };
      // Exactly the names the prompt asks to count (see qaCountNames): a demanded count the prompt never asked for made every reply "incomplete".
      const expectedNames = qaCountNames(plan.onStage, plan.elements, plan.qaScene);
      const [raw, scores] = await Promise.all([
        inspect(
          `image-qa-${cover ? "cover" : `p${shot.page}`}-${attemptNo}`,
          buildQaPrompt(plan.drawn, plan.qaScene, got.references.length > 0, plan.elements, input.pageTexts?.[shot.page]),
          [got.response.viewUrl || url, ...got.references.slice(0, 1)],
          expectedNames,
          errors,
          `attempt ${attemptNo}`
        ),
        secondOpinion(got.response.viewUrl || url, plan.drawn, `${cover ? "cover" : `page ${shot.page}`} attempt ${attemptNo}`),
      ]);
      const checked = raw ? scopeQaReport(raw, plan.onStage.map((entity) => entity.name), plan.elements, plan.qaScene) : undefined;
      const qa = checked ? withSecondOpinion(checked, scores) : undefined;
      const heroNames = plan.onStage.filter((entity) => entity.role === "hero").map((entity) => entity.name);
      const parts = qaSeverityParts(qa, expectedNames.length, { heroNames, cover });
      const sceneless = qa && qa.sceneMatch < 0.5 ? qaSeverityParts({ ...qa, sceneMatch: 1 }, expectedNames.length, { heroNames, cover }) : undefined;
      const looseScene = Boolean(sceneless && sceneless.hard + sceneless.soft < 10);
      return { page: shot.page, url, prompt: got.prompt, attempts: attemptNo, costUSD, qa, severity: parts.hard + parts.soft, status: qaStatus(qa, parts), level: got.level, plan: plan.kind, looseScene };
    };

    /**
     * The people-free picture (never the cover): the page's key object or
     * place. Nothing that can grow a third hand or a second Adrian. Printed
     * unless it shows a person or a body defect: a calm picture of the thing
     * the page is about is better than a blank page (story b10f2dad page 7).
     */
    const vignette = async (attemptNo: number, allowBorrowed = false, refusedBefore = false): Promise<Attempt | null> => {
      const scene = shot.vignette || (allowBorrowed ? shot.fallbackVignette : undefined);
      if (cover || !scene || refusedBefore || providerDown()) return null;
      // Things only: a creature in a vignette is a figure without a reference.
      const shown = allElements.filter((element) => !element.figure && mentionsElement(scene, element)).slice(0, 2);
      const prompt = buildImagePrompt({ scene, onStage: [], spriteOrder: [], elements: shown, vignette: true, style: input.imageStyle });
      imageCalls += 1;
      let response: ImageResponse = {};
      try {
        response = await input.provider({
          page: shot.page,
          prompt,
          negativePrompt: `${negativePromptFor([], false, input.historical)}, person, people, child, boy, girl, human figure, face, hands`,
          referenceImages: [],
          seed: seedFor(input.seed, shot.page, 90 + attemptNo),
          width,
          height,
        });
        addCost(response);
        if (response.url) delivered += 1;
        else if (response.refused) refused += 1;
      } catch (err) {
        errors.push(`vignette: ${(err as Error)?.message || err}`);
      }
      if (!response.url) return null;
      const counted = qaCountNames([], shown, scene);
      const raw = await inspect(`image-qa-p${shot.page}-vignette`, buildQaPrompt([], scene, false, shown), [response.viewUrl || response.url], counted, errors, "vignette");
      const qa = raw ? scopeQaReport(raw, [], shown, scene) : undefined;
      const parts = qaSeverityParts(qa, counted.length);
      // Anything a person could be counted as makes it useless.
      const personSeen = Boolean(qa && (qa.unexpectedCharacters.length || qa.anatomyDefects.length));
      const status = personSeen ? "failed" : qaStatus(qa, parts);
      return { page: shot.page, url: response.url, prompt, attempts: attemptNo, costUSD, qa, severity: parts.hard + parts.soft, status, vignette: true, level: 2 };
    };

    const finish = (outcome: Attempt, attempts: number): ImageOutcome => {
      const { level, plan: _plan, refused: _refused, looseScene: _looseScene, ...rest } = outcome;
      return { ...rest, attempts, costUSD, referenceLevel: level, errors: errors.length ? errors : undefined, history };
    };

    // Printable first, then the fewer defects.
    const better = (a: Attempt, b: Attempt) =>
      Boolean(a.url) && (isPublishable(a) !== isPublishable(b) ? isPublishable(a) : a.severity < b.severity);

    if (shot.planningErrors?.length) {
      // An unresolved composition never buys a portrait scene; a people-free vignette cannot go wrong that way.
      errors.push(...shot.planningErrors);
      const fallback = await vignette(1, true);
      if (fallback) {
        note("vignette", fallback);
        return finish(fallback, 1);
      }
      return { page: shot.page, prompt: shot.scene, attempts: 0, costUSD, severity: 999, status: "unverified", errors, history };
    }

    const candidates: Attempt[] = [];
    const first = await attempt(fullPlan, 1, "", 0);
    note("full", first);
    if (first.url) candidates.push(first);
    if (!first.url) {
      // Nothing arrived even without a reference: the vignette is the only picture left.
      const fallback = await vignette(2, true, first.refused);
      if (fallback) note("vignette", fallback);
      return fallback && isPublishable(fallback) ? finish(fallback, 2) : finish(first, fallback ? 2 : 1);
    }
    // A broken checker is not evidence that a new image would help.
    if (!first.qa || first.severity < 10) return finish(first, 1);
    if (input.redrawLooseScene === false && first.looseScene) return finish(first, 1);
    regenerated.push(shot.page);

    // Redraw 1: one more full attempt with a named correction and a simpler composition.
    // A mixed figure or a borrowed garment is bleed between the portraits on the sheet too (book "Die hüpfenden Geräusche").
    const bled = Boolean(first.qa.animalFeaturesOnHumans.length || first.qa.featureBleed?.length || first.qa.jevFindings?.some((finding) => /mixes features|same garment/.test(finding)));
    // Benchmark 2026-10-15: a doubled figure is nearly always induced by the other portraits on the sheet.
    const doubled = Boolean(first.qa.duplicates.length || first.qa.jevFindings?.some((finding) => /twice|double|duplicate|same figure/i.test(finding)));
    let startLevel = Math.max(0, first.level);
    let redrawLadder = fullPlan.ladder;
    if ((bled || doubled) && canSplitSheet) {
      redrawLadder = ladderFor(heroSheet);
      startLevel = 0;
    }
    const correction = correctionFor(first.qa, fullElements.map((element) => element.name));
    // Rung 3: only the heroes and the things (drops the crowd that tangles the picture). With parallelRedraw it is
    // drawn next to the redraw, so a failed redraw costs no further round — but only when the crowd is the trouble.
    const reduced = reducedPlan();
    const [second, early] = await Promise.all([
      attempt(fullPlan, 2, `${correction} ${REDRAW_KEEPS_SCENE}`, startLevel, redrawLadder),
      reduced && input.parallelRedraw && crowdTrouble(first.qa) && !providerDown() ? attempt(reduced, 3, REDRAW_KEEPS_SCENE, 0) : undefined,
    ]);
    if (second.url) candidates.push(second);
    let best = better(second, first) ? second : first;
    if (isPublishable(best)) {
      // Paid and not needed: logged before the redraw, so the delivered picture stays the last entry.
      if (early) note("reduced-unused", early);
      note("redraw", second);
      return finish(best, 2);
    }
    note("redraw", second);

    let attempts = 2;
    let last = second;
    // Writing in both pictures has a source the crowd is not (a printed shirt on the sheet, a board with squares in
    // the scene): story 26fdd23f paid a third picture for the cover and two pages, and all three showed it again.
    const writingTwice = Boolean(first.qa?.textVisible && second.qa?.textVisible && !crowdTrouble(first.qa) && !crowdTrouble(second.qa));
    if (reduced && (early || (!second.refused && !providerDown() && !writingTwice))) {
      attempts = 3;
      const third = early ?? await attempt(reduced, 3, REDRAW_KEEPS_SCENE, 0);
      last = third;
      note("reduced", third);
      if (third.url) candidates.push(third);
      if (better(third, best)) best = third;
      if (isPublishable(best)) return finish(best, attempts);
    }

    // Rung 4: the people-free picture.
    const fallback = await vignette(attempts + 1, false, Boolean(last.refused));
    if (fallback) {
      attempts += 1;
      note("vignette", fallback);
      if (isPublishable(fallback)) return finish(fallback, attempts);
      if (fallback.url) candidates.push(fallback);
    }

    // Rung 5: the least bad picture, if it has no body defect, no stranger and no doubled figure.
    const salvage = candidates.filter((candidate) => salvageable(candidate.qa)).sort((a, b) => a.severity - b.severity)[0];
    if (salvage) {
      errors.push(`salvaged ${salvage.plan === "reduced" ? "reduced" : salvage.vignette ? "vignette" : "full"} picture with severity ${salvage.severity}`);
      return finish({ ...salvage, status: "flawed", salvaged: true }, attempts);
    }
    return finish(best, attempts);
  };

  const outcomes = await mapWithLimit(shots, input.concurrency ?? 4, renderShot);
  const pages = new Map<number, ImageOutcome>();
  let cover: ImageOutcome | undefined;
  for (const outcome of outcomes) {
    if (outcome.page === 0) cover = outcome;
    else pages.set(outcome.page, outcome);
  }
  const imagesGenerated = outcomes.filter((outcome) => outcome.url).length;
  return { cover, pages, imagesGenerated, imageCalls, imageCostUSD, qaCalls, jevCalls, regenerated };
}
