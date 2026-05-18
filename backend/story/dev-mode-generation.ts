/**
 * Developer Mode Story Generation
 *
 * Developer quality lane used for A/B testing prompt quality. Bypasses the
 * full Story Pipeline v2 (no memories, Story DNA, artifacts, images, TTS,
 * or personality mutation) but keeps a focused, inspectable prompt surface:
 * selected avatars, their visual/personality grounding, and a slim pool cast.
 *
 * Fields fed into the prompt:
 *   - length (chapter count derived) + ageGroup
 *   - genre + setting
 *   - selected avatar appearance + personality traits
 *   - a small supporting character pool
 *   - learningMode subjects (if enabled)
 *   - language
 *   - customPrompt (the raw user wish text, no profile context merged in)
 *
 * Generation is intentionally multi-call, but cost-optimized:
 *   1. support model: emotional engine + story blueprint
 *   2. support model: dramaturgy / quality check
 *   3. selected wizard model: final story draft
 *   3b. selected wizard model: targeted chapter-level repair when local gates fail
 *   4. support model: hard market-quality validation (no prose rewrite)
 *
 * No images are generated in this mode (chapters render text-only in the reader).
 * No personality / memory mutation happens after generation — the caller
 * (`backend/story/generate.ts`) is responsible for skipping that block.
 */

import { secret } from "encore.dev/config";
import { generateWithGemini, isGeminiConfigured } from "./gemini-generation";
import { callAnthropicCompletion } from "./pipeline/llm-client";
import { callOpenRouterChatCompletion, normalizeOpenRouterModel } from "./openrouter-generation";
import { isOpenRouterFamilyModel, resolveConfiguredStoryModel } from "./pipeline/model-routing";
import type { StoryConfig, AIProvider } from "./generate";
import { buildStoryExperienceContext, describeEmotionalFlavors, describeSpecialIngredients } from "./story-experience";
import { publishWithTimeout } from "../helpers/pubsubTimeout";
import { logTopic } from "../log/logger";
import { storyDB } from "./db";

const openAIKey = secret("OpenAIKey");

const DEFAULT_GEMINI_MODEL = "gemini-3-flash-preview";
const DEV_MODE_SUPPORT_MODEL = "google/gemini-3.1-flash-lite";
// v11 — "whole-story-first": draft a continuous narrative as prose paragraphs,
// then split into display chapters with a cheap support-model call. This
// stops episodic chapter writing and protects the red thread.
const DEV_MODE_PIPELINE_ID = "whole-story-first-v11";
const DEV_MODE_MIN_DIALOG_PCT = 25;
const DEV_MODE_TARGET_DIALOG_PCT = 32;
// Writer-side target. Was 50% (caused filler chatter and compliance prose).
// New range matches real children's-book dialogue density (25–40%).
const DEV_MODE_PROMPT_DIALOG_PCT = 35;
const DEV_MODE_MIN_CHAPTER_DIALOG_PCT = 18;
const DEV_MODE_MIN_PARAGRAPHS = 4;
const DEV_MODE_MAX_PARAGRAPHS = 8;
const DEV_MODE_MAX_REPAIR_ATTEMPTS = 1;
const DEV_MODE_BLUEPRINT_TARGET_SCORE = 8.8;
const DEV_MODE_BLUEPRINT_HARD_FLOOR_SCORE = 8.0;
const DEV_MODE_MAX_BLUEPRINT_REPAIR_ATTEMPTS = 1;
const DEV_MODE_CHAPTER_REPAIR_LIMIT_PER_PASS = 2;
const DEV_MODE_POST_POLISH_DIALOG_REPAIR_LIMIT = 1;
const DEV_MODE_BROAD_FAILURE_CHAPTER_COUNT = 4;
const DEV_MODE_SECOND_PASS_REPAIR_CHAPTER_LIMIT = 1;
const DEV_MODE_CHAPTER_DIALOG_LINE_TARGET = 10;
const DEV_MODE_CHAPTER_SPEAKER_TURN_TARGET = 4;
const DEV_MODE_MIN_MARKET_QUALITY_SCORE = 9.0;
const DEV_MODE_TARGET_MARKET_QUALITY_SCORE = 9.5;
const DEV_MODE_MIN_RELEASE_DIMENSION_SCORE = 8.0;
const DEV_MODE_MAX_VALIDATION_POLISH_ATTEMPTS = 1;
const DEV_MODE_MIN_SUPPORTING_CAST = 0;
const DEV_MODE_MAX_SUPPORTING_CAST = 2;
const DEV_MODE_MAX_IDEA_POOL_CANDIDATES = 8;
const DEV_MODE_LINE_PUNCHUP_MAX_REPLACEMENTS = 8;
const DEV_MODE_LINE_PUNCHUP_MIN_LINE_CHARS = 30;
const DEV_MODE_VALIDATOR_QUALITY_REPAIR_LIMIT = 1;

const NOVELTY_MIN_FAMILY_PREFIX_LENGTH = 6;

interface DevModeChapter {
  title: string;
  content: string;
  order: number;
}

interface DevModeRawStory {
  title: string;
  description: string;
  chapters: DevModeChapter[];
}

type DevModePipelineStage =
  | "idea-candidates"
  | "idea-selection"
  | "blueprint"
  | "blueprint-repair"
  | "dramaturgy-check"
  | "story-draft"
  | "whole-story-draft"
  | "story-splitter"
  | "chapter-repair"
  | "story-polish"
  | "line-punchup"
  | "final-validation";

interface DevModeStageLog {
  stage: DevModePipelineStage;
  systemPrompt: string;
  userPrompt: string;
  rawContent?: string;
  parsed?: any;
  parseError?: string;
  usage?: { prompt: number; completion: number; total: number };
  modelUsed?: string;
  modelRole?: "support" | "selected-story";
  durationMs?: number;
  error?: string;
}

export interface DevModeGeneratedStory {
  title: string;
  description: string;
  coverImageUrl?: string;
  chapters: Array<{
    id: string;
    title: string;
    content: string;
    order: number;
    imageUrl?: string;
    imagePrompt?: string;
    imageModel?: string;
  }>;
  avatarDevelopments: never[];
  metadata: {
    tokensUsed: {
      prompt: number;
      completion: number;
      total: number;
      inputCostUSD?: number;
      outputCostUSD?: number;
      totalCostUSD?: number;
      modelUsed: string;
    };
    model: string;
    supportModel?: string;
    storyModel?: string;
    imagesGenerated: number;
    developerMode: true;
    devModePipeline?: typeof DEV_MODE_PIPELINE_ID | "whole-story-continuity-v10" | "adaptive-chapter-repair-v5" | "adaptive-chapter-repair-v4" | "adaptive-chapter-repair-v2" | "four-stage-cost-optimized";
    devModeStages?: Array<{
      stage: DevModePipelineStage;
      usage?: { prompt: number; completion: number; total: number };
      modelUsed?: string;
      modelRole?: "support" | "selected-story";
      durationMs?: number;
      score?: number;
    }>;
    localQualityDiagnostics?: DevModeStoryDiagnostics;
    storyPolishApplied?: boolean;
    chapterRepairApplied?: boolean;
    qualityScore?: number;
    rawQualityScore?: number;
    localGateScore?: number;
    qualityGatePassed?: boolean;
    qualityGateFailureReason?: string;
    returnedWithQualityGateWarnings?: boolean;
    literaryValidation?: any;
    repairSelfReflections?: any[];
    noveltySeed?: string;
    noveltyRecentStoryCount?: number;
    noveltyHardAvoidMotifCount?: number;
    noveltyKeyMomentLens?: string;
    ideaCandidateCount?: number;
    selectedIdeaTitle?: string;
    selectedSupportingCast?: string[];
  };
}

/**
 * Subset of avatar fields the dev mode injects into the prompt. We deliberately
 * keep the shape minimal — only what the model can actually use as character
 * grounding (appearance + personality). No memories, no inventory, no skills.
 */
export interface DevModeAvatar {
  id?: string;
  name: string;
  age?: number | null;
  description?: string;
  /** Avatar visual profile (canonical appearance). Free-form JSON. */
  visualProfile?: any;
  /** Avatar personality traits (9 base values, optionally with subcategories). Free-form JSON. */
  personalityTraits?: any;
}

/**
 * Pool character info for prompt injection. Mirrors the standard pipeline's
 * enhanced character sheets closely enough for vivid voice, motive, triggers,
 * quirks, and visual identity without pulling in the full pipeline graph.
 */
export interface DevModePoolCharacter {
  id: string;
  name: string;
  role?: string;
  archetype?: string;
  species?: string | null;
  ageCategory?: string | null;
  dominantPersonality?: string | null;
  secondaryTraits?: string[];
  emotionalNature?: any;
  emotionalTriggers?: string[];
  /** One-line visual hook. */
  physicalDescription?: string | null;
  colorPalette?: string[];
  /** Compact personality words used as fallback when V2 fields are sparse. */
  personalityKeywords?: string[];
  catchphrase?: string | null;
  catchphraseContext?: string | null;
  speechStyle?: string[];
  quirk?: string | null;
  backstory?: string | null;
  maxScreenTime?: number | null;
  availableChapters?: number[];
  canonSettings?: string[];
  recentUsageCount?: number;
  totalUsageCount?: number;
  recentUserUsageCount?: number;
  lastUsedAt?: Date | string | null;
}

export interface DevModeGenerationInput {
  config: StoryConfig;
  userId?: string;
  storyId?: string;
  /** Full hero avatars (the user's chosen avatars). */
  avatars: DevModeAvatar[];
  /** Auto-cast supporting characters picked from character_pool. */
  poolCharacters?: DevModePoolCharacter[];
  primaryProfileAge?: number | null;
  noveltyBrief?: DevModeNoveltyBrief;
  selectedIdea?: DevModeSelectedIdea;
}

interface DevModeRecentStoryFingerprint {
  id: string;
  title: string;
  description: string;
  motifKeywords: string[];
}

interface DevModeNoveltyBrief {
  seed: string;
  shelfPromise: string;
  creativeLane: string;
  emotionalEngine: string;
  wonderMechanic: string;
  keyMomentLens: string;
  titleEnergy: string;
  hardAvoidMotifs: string[];
  recentStories: DevModeRecentStoryFingerprint[];
}

interface DevModeIdeaCandidate {
  id: string;
  title: string;
  oneLineHook: string;
  centralObjectOrPlace: string;
  wonderRule: string;
  emotionalEngine: string;
  coreConflict: string;
  whyKidWantsThis: string;
  whyDifferentFromRecent: string;
  recommendedSupportingCast: string[];
}

interface DevModeSelectedIdea extends DevModeIdeaCandidate {
  chosenReason: string;
  selectedSupportingCast: string[];
  selectionScores?: {
    shelfAppeal?: number;
    novelty?: number;
    emotionalPotential?: number;
    childCuriosity?: number;
    poolCastFit?: number;
  };
}

interface DevModeIdeaNoveltyAudit {
  id: string;
  closestRecentTitle: string;
  closestRecentOverlap: number;
  hardAvoidMatches: string[];
  recommendation: "prefer" | "acceptable" | "penalize" | "reject";
}

const NOVELTY_STOPWORDS = new Set([
  // German articles and possessives (all cases)
  "aber", "alle", "alles", "auch", "auf", "aus", "beim", "dem", "den", "der", "des", "die", "dies",
  "diese", "dieser", "diesem", "diesen", "ein", "eine", "einer", "eines", "einem", "einen",
  "kein", "keine", "keiner", "keines", "keinem", "keinen",
  "mein", "meine", "meiner", "meines", "meinem", "meinen",
  "dein", "deine", "deiner", "deines", "deinem", "deinen",
  "sein", "seine", "seiner", "seines", "seinem", "seinen",
  "ihr", "ihre", "ihrer", "ihres", "ihrem", "ihren",
  "unser", "unsere", "unserer", "unseres", "unserem", "unseren",
  "euer", "eure", "eurer", "eures", "eurem", "euren",
  // German prepositions
  "fuer", "für", "mit", "nicht", "oder", "und", "vom", "von", "wie", "zur", "zum", "ins", "im", "am",
  "an", "ab", "bei", "nach", "vor", "ueber", "über", "unter", "durch", "gegen", "ohne", "bis",
  "neben", "hinter", "zwischen", "trotz", "wegen", "waehrend", "während",
  // German verbs / auxiliaries / common forms
  "hat", "hatte", "haben", "habt", "habe", "habst",
  "ist", "sind", "bist", "seid", "war", "waren", "wars", "warst",
  "wird", "werden", "werde", "wirst", "wurde", "wurden", "wurdest", "wurdet",
  "soll", "sollte", "sollen", "sollst", "sollt", "sollten",
  "muss", "müssen", "muessen", "musst", "musste", "mussten",
  "kann", "können", "koennen", "kannst", "konnt", "konnte", "konnten",
  "darf", "dürfen", "duerfen", "darfst", "durfte", "durften",
  "mag", "moegen", "mögen", "magst", "mochte", "mochten",
  "macht", "machen", "machte", "machten", "machst",
  "kommt", "kommen", "kommst", "kam", "kamen",
  "geht", "gehen", "gehst", "ging", "gingen",
  "sieht", "sehen", "siehst", "sah", "sahen",
  "sagt", "sagte", "sagen", "sagten", "sagst",
  "ruft", "rufen", "rief", "riefen", "rufst",
  "fragt", "fragen", "fragte", "fragten", "fragst",
  "wartet", "warten", "wartete", "warteten", "wartest",
  "denkt", "denken", "dachte", "dachten",
  "weiß", "weiss", "wissen", "wusste", "wussten",
  "nimmt", "nehmen", "nahm", "nahmen",
  "gibt", "geben", "gab", "gaben",
  "laeuft", "läuft", "laufen", "lief", "liefen",
  "steht", "stehen", "stand", "standen",
  "liegt", "liegen", "lag", "lagen",
  "sitzt", "sitzen", "sass", "saß", "sassen", "saßen",
  "schaut", "schauen", "schaute", "schauten",
  "lacht", "lachen", "lachte", "lachten",
  "spielt", "spielen", "spielte", "spielten",
  "findet", "finden", "fand", "fanden",
  "bleibt", "bleiben", "blieb", "blieben",
  // German conjunctions / adverbs
  "als", "wenn", "weil", "dass", "denn", "doch", "dann", "schon", "noch", "immer", "wieder",
  "weiter", "jetzt", "dort", "hier", "heute", "morgen", "abend", "nacht",
  // Common content stopwords that aren't story-distinguishing
  "grosse", "große", "grossen", "großen", "klein", "kleine", "kleiner", "kleinen", "kleines", "kleinem",
  "abenteuer", "bruder", "schwester", "familie", "freund", "freunde",
  "zauber", "magie", "fantasie", "geheimnis", "geheimnisse", "wunder", "ploetzlich", "plötzlich",
  "geschichte", "kapitel", "kinder", "jungen", "maedchen", "mädchen", "junge",
  // English stopwords
  "the", "and", "with", "from", "into", "that", "this", "when", "where", "story", "chapter",
]);

const NOVELTY_SHELF_PROMISES = [
  "A child sees the title and immediately asks: what is THAT doing there?",
  "The premise combines one ordinary child-world detail with one impossible rule.",
  "The story feels like a discoverable book on a library display, not a generic fantasy quest.",
  "The hook is concrete enough to draw as a cover and odd enough to remember after bedtime.",
  "The adventure starts with a tiny wrongness in daily life, then opens into wonder.",
  "The title promises a specific object, place, or problem a child can retell in one sentence.",
];

const NOVELTY_CREATIVE_LANES = [
  "domestic magic: bedroom, kitchen, hallway, laundry, lost-and-found, pocket, lunchbox",
  "social comedy: a rule at school, a club, a birthday, a queue, a contest, a secret job",
  "miniature world: under a floorboard, inside a drawer, behind wallpaper, in a garden crack",
  "living object: a stubborn tool, polite machine, jealous map, forgetful backpack, overhelpful umbrella",
  "place with a rule: library after closing, stairwell with seasons, market stall that trades odd things",
  "nature with a twist: puddle weather, migrating shadows, seed that remembers, cloud with stage fright",
  "craft/building problem: something must be repaired, swapped, carried, hidden, shared, or returned",
  "comic mystery: a harmless but puzzling disappearance with clues children can notice",
];

const NOVELTY_EMOTIONAL_ENGINES = [
  "wanting to keep something private but learning what should be shared",
  "feeling too small for a responsibility and finding one exact useful action",
  "wanting a shortcut and discovering why the slow careful way matters",
  "being embarrassed by a quirk that later solves a concrete problem",
  "wanting everyone to notice you and learning to notice someone else first",
  "being afraid of change and making one small brave experiment",
  "thinking a mistake ruined everything until the mistake becomes a tool",
  "arguing about who is right, then needing both wrong ideas together",
];

const NOVELTY_WONDER_MECHANICS = [
  "a trade has a surprising cost",
  "an object obeys a literal childlike misunderstanding",
  "a place changes only when nobody is watching directly",
  "a helper can only help badly until the child gives a precise instruction",
  "the problem grows whenever adults explain it too neatly",
  "the solution must be performed, not announced",
  "the apparent monster is following a rule nobody has asked about yet",
  "the smallest repeated detail becomes the final key",
];

const NOVELTY_TITLE_ENERGY = [
  "specific noun + impossible adjective",
  "ordinary place + secret job",
  "funny problem statement",
  "name + concrete object + ticking consequence",
  "mystery title with one tactile image",
  "series-like title: clear, warm, and collectible",
];

const NOVELTY_KEY_MOMENT_LENSES = [
  "Wonder + Mystery: odd encounter -> pattern clue -> false explanation -> rule reveal -> earned solution",
  "Adventure + Relationship: threshold crossing -> capability test -> value clash -> risk for someone else -> transformed return",
  "Domestic Comedy + Craft: ridiculous requirement -> wrong tool -> escalated mess -> precise instruction -> practical payoff",
  "Miniature World + Empathy: hidden place -> misunderstood helper -> costly mistake -> act of noticing -> restored role",
  "Social Comedy + Courage: awkward rule -> public mistake -> wrong fix -> honest small action -> group reframe",
  "Object Magic + Responsibility: tempting shortcut -> literal misunderstanding -> consequence cascade -> patient repair -> shared ownership",
  "Nature Twist + Change: tiny wrongness -> scale reveal -> failed control -> brave experiment -> new seasonal ritual",
  "Comic Mystery + Teamwork: missing thing -> suspect pattern -> wrong accusation -> combined clues -> surprising but fair culprit",
];

const ANCHOR_CONTAMINATION_MOTIFS = [
  "Glöckchen",
  "Gloeckchen",
  "Geräusche-Fresser",
  "Geraeusche-Fresser",
  "lautlose Stadt",
  "müdes Kissen",
  "muedes Kissen",
  "gestohlene Geräusche",
  "gestohlene Geraeusche",
];

function deriveChapterCount(length: StoryConfig["length"]): number {
  switch (length) {
    case "short":
      return 3;
    case "long":
      return 8;
    case "medium":
    default:
      return 5;
  }
}

function localizedLanguageName(language?: string): string {
  switch (language) {
    case "en":
      return "English";
    case "fr":
      return "French (français)";
    case "es":
      return "Spanish (español)";
    case "it":
      return "Italian (italiano)";
    case "nl":
      return "Dutch (Nederlands)";
    case "ru":
      return "Russian (русский)";
    case "de":
    default:
      return "German (Deutsch)";
  }
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickNovelty<T>(items: T[], seed: number, offset: number): T {
  return items[(seed + offset * 9973) % items.length];
}

function normalizeNoveltyText(value: string): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMotifKeywords(text: string, limit = 8): string[] {
  const words = normalizeNoveltyText(text)
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 5 && !NOVELTY_STOPWORDS.has(word));
  return [...new Set(words)].slice(0, limit);
}

function buildNoveltyMotifRegexes(normalizedMotif: string): RegExp[] {
  const motif = normalizeNoveltyText(normalizedMotif);
  if (!motif) return [];
  const escapedExact = motif.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const exact = new RegExp(`\\b${escapedExact}\\b`, "gi");
  if (motif.includes(" ")) return [exact];

  let stem = motif;
  let stemmed = false;
  for (const suffix of ["ungen", "chen", "lein", "ung", "ern", "en", "er", "e", "s"]) {
    if (stem.endsWith(suffix) && stem.length - suffix.length >= 5) {
      stem = stem.slice(0, -suffix.length);
      stemmed = true;
      break;
    }
  }

  if (stemmed && stem.length < NOVELTY_MIN_FAMILY_PREFIX_LENGTH) stem = motif;

  const prefix = stem.length >= NOVELTY_MIN_FAMILY_PREFIX_LENGTH
    ? stem
    : motif.slice(0, Math.min(motif.length, NOVELTY_MIN_FAMILY_PREFIX_LENGTH));
  if (prefix.length < NOVELTY_MIN_FAMILY_PREFIX_LENGTH) return [exact];
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const family = new RegExp(`\\b${escapedPrefix}[a-z0-9-]{0,14}\\b`, "gi");
  return [exact, family];
}

function noveltyMotifHitCount(normalizedText: string, normalizedMotif: string): number {
  const text = normalizeNoveltyText(normalizedText);
  const hits = new Set<string>();
  for (const regex of buildNoveltyMotifRegexes(normalizedMotif)) {
    regex.lastIndex = 0;
    for (const match of text.matchAll(regex)) {
      hits.add(`${match.index ?? 0}:${match[0]}`);
    }
  }
  return hits.size;
}

function noveltyMotifMatches(normalizedText: string, normalizedMotif: string): boolean {
  return noveltyMotifHitCount(normalizedText, normalizedMotif) > 0;
}

function characterNameMotifAliases(name: string): string[] {
  const normalized = normalizeNoveltyText(name);
  if (!normalized) return [];
  const parts = normalized
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 4 && !NOVELTY_STOPWORDS.has(part));
  return [...new Set([normalized, ...parts])];
}

function currentCharacterNameMotifs(input: DevModeGenerationInput): Set<string> {
  const aliases = new Set<string>();
  for (const avatar of input.avatars || []) {
    for (const alias of characterNameMotifAliases(avatar.name || "")) aliases.add(alias);
  }
  for (const character of input.poolCharacters || []) {
    for (const alias of characterNameMotifAliases(character.name || "")) aliases.add(alias);
  }
  for (const name of input.selectedIdea?.selectedSupportingCast || []) {
    for (const alias of characterNameMotifAliases(name || "")) aliases.add(alias);
  }
  return aliases;
}

function isCurrentCharacterNameMotif(motif: string, input: DevModeGenerationInput): boolean {
  const normalized = normalizeNoveltyText(motif);
  if (!normalized) return false;
  return currentCharacterNameMotifs(input).has(normalized);
}

function noveltyJaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection += 1;
  }
  return intersection / Math.max(1, new Set([...setA, ...setB]).size);
}

function promptExplicitlyRequestsRepeatedSoundPremise(config: StoryConfig): boolean {
  const text = normalizeNoveltyText([
    config.customPrompt,
    config.genre,
    config.setting,
  ].filter(Boolean).join(" "));
  return /\b(gloeckchen|glocke|bell|sound|sounds|klang|klaenge|geraeusch|geraeusche|stille|lautlos)\b/.test(text);
}

async function loadRecentDevModeStoryFingerprints(input: DevModeGenerationInput): Promise<DevModeRecentStoryFingerprint[]> {
  if (!input.userId) return [];
  try {
    const currentStoryId = input.storyId || "";
    const rows = await storyDB.queryAll<{
      id: string;
      title: string | null;
      description: string | null;
    }>`
      SELECT id, title, description
      FROM stories
      WHERE user_id = ${input.userId}
        AND (${currentStoryId} = '' OR id <> ${currentStoryId})
        AND status = 'complete'
      ORDER BY updated_at DESC
      LIMIT 20
    `;

    return rows
      .map((row) => {
        const title = String(row.title || "").trim();
        const description = String(row.description || "").trim();
        return {
          id: row.id,
          title,
          description,
          motifKeywords: extractMotifKeywords(`${title} ${description}`, 8),
        };
      })
      .filter((story) => story.title.length > 0 || story.description.length > 0);
  } catch (error) {
    console.warn("[dev-mode-generation] Failed to load recent story fingerprints; continuing without recent-story novelty context", error);
    return [];
  }
}

function buildDevModeNoveltyBrief(input: DevModeGenerationInput, recentStories: DevModeRecentStoryFingerprint[]): DevModeNoveltyBrief {
  const seedText = [
    input.storyId || crypto.randomUUID(),
    input.config.genre,
    input.config.setting,
    input.config.length,
    input.config.ageGroup,
    input.config.customPrompt,
    (input.avatars || []).map((avatar) => avatar.name).join(","),
    Date.now().toString(36),
  ].filter(Boolean).join("|");
  const seed = hashString(seedText);
  const repeatedSoundRequested = promptExplicitlyRequestsRepeatedSoundPremise(input.config);
  const recentMotifs = recentStories
    .flatMap((story) => story.motifKeywords)
    .filter((keyword) => keyword.length >= 6)
    .filter((keyword) => !isCurrentCharacterNameMotif(keyword, input))
    .slice(0, 30);
  const hardAvoidMotifs = [
    ...new Set([
      ...recentMotifs,
      ...(repeatedSoundRequested ? [] : ANCHOR_CONTAMINATION_MOTIFS),
    ]),
  ].slice(0, 42);

  return {
    seed: seed.toString(36),
    shelfPromise: pickNovelty(NOVELTY_SHELF_PROMISES, seed, 1),
    creativeLane: pickNovelty(NOVELTY_CREATIVE_LANES, seed, 2),
    emotionalEngine: pickNovelty(NOVELTY_EMOTIONAL_ENGINES, seed, 3),
    wonderMechanic: pickNovelty(NOVELTY_WONDER_MECHANICS, seed, 4),
    keyMomentLens: pickNovelty(NOVELTY_KEY_MOMENT_LENSES, seed, 5),
    titleEnergy: pickNovelty(NOVELTY_TITLE_ENERGY, seed, 6),
    hardAvoidMotifs,
    recentStories: recentStories.slice(0, 8),
  };
}

function buildNoveltyPromptBlock(input: DevModeGenerationInput): string {
  const brief = input.noveltyBrief;
  if (!brief) return "";
  const recentLines = brief.recentStories.length > 0
    ? brief.recentStories.map((story, index) => {
        const motifs = story.motifKeywords.length > 0 ? ` motifs: ${story.motifKeywords.slice(0, 6).join(", ")}` : "";
        return `${index + 1}. ${story.title || "(untitled)"}${motifs}`;
      })
    : ["No recent finished stories were available; still avoid the style-anchor concepts and generic fairy-tale defaults."];
  const hardAvoid = brief.hardAvoidMotifs.slice(0, 18);
  return [
    "NOVELTY / LIBRARY-SHELF BRIEF:",
    `- Novelty seed: ${brief.seed}. Use it to choose a fresh direction; do not mention it in the story.`,
    `- Shelf promise: ${brief.shelfPromise}`,
    `- Creative lane for THIS story only: ${brief.creativeLane}.`,
    `- Emotional engine for THIS story only: ${brief.emotionalEngine}.`,
    `- Wonder mechanic for THIS story only: ${brief.wonderMechanic}.`,
    `- Key-moment lens for THIS story only: ${brief.keyMomentLens}.`,
    `- Title energy: ${brief.titleEnergy}.`,
    "- Before writing the blueprint, silently invent 5 premise candidates and reject any that resemble the recent stories below. Use the most specific, cover-worthy candidate.",
    "- The premise, title, central object/place, antagonist/problem, magic rule, and ending image must be different from the recent list.",
    "- Do not reuse sample/style-anchor objects as story content. Style examples are punctuation/register only, never plot material.",
    "- Treat hard-avoid motifs as word families: if 'spiegel' is forbidden, also avoid spiegelt, Spiegelung, Spiegelwasser, etc.",
    hardAvoid.length > 0 ? `- Hard-avoid motifs unless the user's prompt explicitly requires them: ${hardAvoid.join(", ")}.` : null,
    "Recent stories to avoid:",
    ...recentLines,
  ].filter((line): line is string => Boolean(line)).join("\n");
}

/**
 * Compact, human-readable summary of an avatar's visualProfile. The full
 * visualProfile JSON is too verbose and noisy for a single-shot prompt —
 * we extract the most useful canonical traits.
 */
function compactText(value: any, depth = 0): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => compactText(item, depth + 1))
      .filter(Boolean)
      .slice(0, 8)
      .join(", ");
  }
  if (typeof value !== "object" || depth > 2) return "";

  const preferredKeys = [
    "description",
    "summary",
    "text",
    "tone",
    "color",
    "style",
    "type",
    "length",
    "texture",
    "shape",
    "outfit",
    "top",
    "bottom",
    "shoes",
    "features",
    "distinctiveFeatures",
    "otherFeatures",
  ];

  const preferred = preferredKeys
    .map((key) => compactText(value[key], depth + 1))
    .filter(Boolean);
  if (preferred.length > 0) return preferred.slice(0, 5).join(", ");

  return Object.entries(value)
    .map(([key, nested]) => {
      const nestedText = compactText(nested, depth + 1);
      return nestedText ? `${key}: ${nestedText}` : "";
    })
    .filter(Boolean)
    .slice(0, 5)
    .join(", ");
}

function summarizeVisualProfile(vp: any): string {
  if (!vp || typeof vp !== "object") return "";
  const parts: string[] = [];

  const pick = (label: string, ...keys: string[]) => {
    for (const key of keys) {
      const text = compactText(vp[key]);
      if (text.length === 0 || text === "[object Object]") continue;
      parts.push(`${label}: ${text}`);
      return;
    }
  };

  pick("Age", "ageDescription", "age", "ageApprox", "ageNumeric");
  pick("Gender", "gender");
  pick("Species", "species", "speciesCategory", "characterType");
  pick("Skin", "skinTone", "skin");
  pick("Hair", "hair", "hairDescription", "hairColor");
  pick("Eyes", "eyes", "eyeColor", "eyeDescription");
  pick("Build", "build", "body", "physicalBuild", "height", "heightCm");
  pick("Clothing", "outfit", "clothing", "clothingDescription", "clothingCanonical");
  pick("Notable features", "distinctiveFeatures", "uniqueFeatures", "marks", "face");

  if (parts.length === 0) {
    const fallback = compactText(vp);
    if (fallback.length > 0 && fallback !== "[object Object]") {
      parts.push(fallback);
    }
  }

  return parts.join("; ");
}

/**
 * Render the 9 base personality traits as a compact line.
 * Subcategories (knowledge.history etc.) get a separate sublist if present.
 * Traits with value 0 are omitted to keep the prompt focused.
 */
function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function traitBand(value: number): string {
  if (value <= 5) return "barely developed";
  if (value < 20) return "low";
  if (value < 45) return "reserved";
  if (value < 70) return "medium";
  if (value < 90) return "strong";
  return "very strong";
}

const STORY_TRAIT_KEYS = ["knowledge", "creativity", "vocabulary", "courage", "curiosity", "teamwork", "empathy", "persistence", "logic"] as const;
type StoryTraitKey = typeof STORY_TRAIT_KEYS[number];

const STORY_TRAIT_LABEL_EN: Record<StoryTraitKey, string> = {
  knowledge: "knowledge",
  creativity: "creativity",
  vocabulary: "vocabulary",
  courage: "courage",
  curiosity: "curiosity",
  teamwork: "teamwork",
  empathy: "empathy",
  persistence: "persistence",
  logic: "logic",
};

function readTraitValue(pt: any, key: StoryTraitKey): number {
  const node = pt && typeof pt === "object" ? pt[key] : undefined;
  const rawValue = typeof node === "number" ? node : (node && typeof node === "object" ? Number(node.value ?? 0) : 0);
  return clampNumber(rawValue, 0, 100);
}

function summarizeDramaturgicTraitProfile(name: string, pt: any): string[] {
  if (!pt || typeof pt !== "object") return [];

  const values = Object.fromEntries(
    STORY_TRAIT_KEYS.map((key) => [key, readTraitValue(pt, key)])
  ) as Record<StoryTraitKey, number>;

  const topTraits = STORY_TRAIT_KEYS
    .slice()
    .sort((a, b) => values[b] - values[a])
    .filter((key) => values[key] >= 20)
    .slice(0, 3)
    .map((key) => STORY_TRAIT_LABEL_EN[key]);

  const strengths: string[] = [];
  const friction: string[] = [];

  if (values.knowledge >= 70) strengths.push("uses concrete facts and memory in action");
  else if (values.knowledge >= 20) strengths.push("knows a few useful concrete things");
  else friction.push("does not solve problems by knowing lots of facts");

  if (values.curiosity >= 70) strengths.push("asks many questions and follows clues quickly");
  else if (values.curiosity < 20) friction.push("needs a visible reason before investigating");

  if (values.empathy >= 70) strengths.push("notices when someone feels left out or hurt");
  else if (values.empathy < 20) friction.push("may need to see feelings through actions before understanding them");

  if (values.courage < 20) friction.push("hesitates before danger; bravery must be small and earned");
  else if (values.courage >= 70) strengths.push("can step forward when others freeze");

  if (values.teamwork < 20) friction.push("may act alone or forget to coordinate at first");
  else if (values.teamwork >= 70) strengths.push("naturally coordinates with others");

  if (values.persistence < 20) friction.push("may want to stop after a failed attempt");
  else if (values.persistence >= 70) strengths.push("keeps trying after setbacks");

  if (values.logic < 20) friction.push("should not suddenly solve everything with adult logic");
  else if (values.logic >= 70) strengths.push("spots cause-and-effect patterns");

  if (values.creativity >= 70) strengths.push("finds playful unconventional uses for objects");
  else if (values.creativity < 20) friction.push("creative solutions should come from concrete help, not sudden genius");

  if (values.vocabulary >= 70) strengths.push("has expressive language and precise words");
  else if (values.vocabulary < 20) friction.push("speaks simply; voice should be concrete, not literary");

  const fallbackStrength =
    strengths.length > 0
      ? strengths.slice(0, 4)
      : ["can still grow through one small, visible, believable choice"];
  const role = topTraits.length > 0
    ? `${name} is driven most by ${topTraits.join(", ")}.`
    : `${name} starts with very little developed confidence; make the arc small, concrete, and earned.`;

  return [
    `Story role from traits: ${role}`,
    `Active strengths to show: ${fallbackStrength.slice(0, 4).join("; ")}.`,
    `Starting friction to dramatize: ${friction.slice(0, 5).join("; ") || "needs one concrete mistake before growth"}.`,
    "Growth permission: low values are starting friction, not a ban. The character may make one small improved choice if the scene earns it.",
  ];
}

function summarizePersonalityTraits(pt: any): { baseLine: string; subLines: string[] } {
  if (!pt || typeof pt !== "object") return { baseLine: "", subLines: [] };

  const LABEL_EN: Record<string, string> = {
    knowledge: "Knowledge",
    creativity: "Creativity",
    vocabulary: "Vocabulary",
    courage: "Courage",
    curiosity: "Curiosity",
    teamwork: "Teamwork",
    empathy: "Empathy",
    persistence: "Persistence",
    logic: "Logic",
  };

  const baseParts: string[] = [];
  const subLines: string[] = [];

  for (const key of STORY_TRAIT_KEYS) {
    const node = pt[key];
    const rawValue = typeof node === "number" ? node : (node && typeof node === "object" ? Number(node.value ?? 0) : 0);
    const value = clampNumber(rawValue, 0, 100);
    baseParts.push(`${LABEL_EN[key]}: ${traitBand(value)}`);

    const subs = node && typeof node === "object" ? node.subcategories : undefined;
    if (subs && typeof subs === "object") {
      const subParts: string[] = [];
      for (const [subKey, subVal] of Object.entries(subs)) {
        const v = typeof subVal === "number" ? subVal : Number((subVal as any)?.value ?? subVal ?? 0);
        if (Number.isFinite(v) && v > 0) {
          subParts.push(`${subKey} ${Math.round(clampNumber(v, 0, 1000))}`);
        }
      }
      if (subParts.length > 0) {
        subLines.push(`  ${LABEL_EN[key]} detail: ${subParts.join(", ")}`);
      }
    }
  }

  return { baseLine: baseParts.join(", "), subLines };
}

function buildAvatarBlock(avatars: DevModeAvatar[]): string {
  if (!avatars || avatars.length === 0) return "";
  const lines: string[] = ["MAIN CHARACTERS (use them as described — appearance and character must stay consistent throughout the whole story):"];

  avatars.forEach((avatar, idx) => {
    const heading = avatar.age != null
      ? `${idx + 1}. ${avatar.name} (${avatar.age} years old)`
      : `${idx + 1}. ${avatar.name}`;
    lines.push(heading);

    if (avatar.description && avatar.description.trim().length > 0) {
      lines.push(`   Short description: ${avatar.description.trim()}`);
    }

    const visual = summarizeVisualProfile(avatar.visualProfile);
    if (visual.length > 0) {
      lines.push(`   Appearance: ${visual}`);
    }

    const { baseLine, subLines } = summarizePersonalityTraits(avatar.personalityTraits);
    if (baseLine.length > 0) {
      lines.push(`   Trait signals (interpreted for drama, not raw score limits): ${baseLine}`);
      const dramaturgicProfile = summarizeDramaturgicTraitProfile(avatar.name, avatar.personalityTraits);
      for (const profileLine of dramaturgicProfile) {
        lines.push(`   ${profileLine}`);
      }
      for (const sub of subLines) lines.push(sub);
    }
  });

  return lines.join("\n");
}

function sanitizePoolPromptText(text?: string | null): string | null {
  const raw = String(text || "").trim();
  if (!raw) return null;

  return raw
    .replace(
      /(?:^|[\s;,.])Besiegt\s+durch\s*:[^.;\n]*(?:[.;]|$)/gi,
      " Weakness hint: the character reacts to shared, calm attention. "
    )
    .replace(
      /(?:^|[\s;,.])Defeated\s+by\s*:[^.;\n]*(?:[.;]|$)/gi,
      " Weakness hint: the character reacts to shared, calm attention. "
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}

function buildPoolBlock(pool?: DevModePoolCharacter[]): string {
  if (!pool || pool.length === 0) return "";
  const lines: string[] = [
    "SUPPORTING-CHARACTER POOL (pick naturally fitting figures from this list; not all must appear, but prefer them over freely invented side characters — they have memorable personalities). When the story uses them, translate their data into the target output language while keeping their identity and quirks intact:",
  ];
  pool.forEach((c, idx) => {
    const heading = `${idx + 1}. ${c.name}${c.role ? ` (${c.role})` : ""}${c.archetype ? ` — ${c.archetype}` : ""}`;
    lines.push(heading);
    const meta: string[] = [];
    if (c.species) meta.push(`Species: ${c.species}`);
    if (c.ageCategory) meta.push(`Age category: ${c.ageCategory}`);
    if (meta.length > 0) lines.push(`   ${meta.join(" · ")}`);
    const physicalDescription = sanitizePoolPromptText(c.physicalDescription);
    if (physicalDescription) lines.push(`   Appearance: ${physicalDescription}`);
    if (c.colorPalette && c.colorPalette.length > 0) {
      lines.push(`   Visual palette: ${c.colorPalette.slice(0, 4).join(", ")}`);
    }
    const personality = poolCharacterPersonalityLine(c, 6);
    if (personality.length > 0) {
      lines.push(`   Character core: ${personality.join(", ")}`);
    }
    const triggers = poolCharacterTriggers(c, 4);
    if (triggers.length > 0) {
      lines.push(`   Emotional triggers: ${triggers.join(", ")}`);
    }
    if (c.catchphrase) lines.push(`   Catchphrase (translate into the target language while preserving meaning): "${c.catchphrase}"`);
    if (c.catchphraseContext) lines.push(`   Catchphrase context: ${compactExcerpt(c.catchphraseContext, 140)}`);
    if (c.speechStyle && c.speechStyle.length > 0) {
      lines.push(`   Speech style: ${c.speechStyle.join(", ")}`);
    }
    if (c.quirk) lines.push(`   Quirk: ${c.quirk}`);
    const backstory = sanitizePoolPromptText(c.backstory);
    if (backstory) lines.push(`   Backstory: ${backstory}`);
    if (typeof c.maxScreenTime === "number") {
      lines.push(`   Screen-time guardrail: max about ${c.maxScreenTime}% of the story focus; make them vivid, not scene-stealing.`);
    }
  });
  return lines.join("\n");
}

function normalizePoolName(name: string): string {
  return String(name || "").trim().toLowerCase();
}

function compactStringList(values: unknown, limit = 4): string[] {
  if (!Array.isArray(values)) return [];
  const result: string[] = [];
  for (const value of values) {
    const text = String(value || "").trim();
    if (!text || result.includes(text)) continue;
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function asPlainObject(value: unknown): Record<string, any> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value === "string" && value.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function poolCharacterDominant(character: DevModePoolCharacter): string | undefined {
  const emotionalNature = asPlainObject(character.emotionalNature);
  return compactExcerpt(String(
    character.dominantPersonality ||
    emotionalNature.dominant ||
    character.personalityKeywords?.[0] ||
    ""
  ).trim(), 60) || undefined;
}

function poolCharacterSecondaryTraits(character: DevModePoolCharacter, limit = 4): string[] {
  const emotionalNature = asPlainObject(character.emotionalNature);
  const explicit = compactStringList(character.secondaryTraits, limit);
  if (explicit.length > 0) return explicit;
  const emotional = compactStringList(emotionalNature.secondary, limit);
  if (emotional.length > 0) return emotional;
  return compactStringList((character.personalityKeywords || []).slice(1), limit);
}

function poolCharacterTriggers(character: DevModePoolCharacter, limit = 4): string[] {
  const emotionalNature = asPlainObject(character.emotionalNature);
  const explicit = compactStringList(character.emotionalTriggers, limit);
  if (explicit.length > 0) return explicit;
  return compactStringList(emotionalNature.triggers, limit);
}

function poolCharacterPersonalityLine(character: DevModePoolCharacter, limit = 6): string[] {
  const dominant = poolCharacterDominant(character);
  return [dominant, ...poolCharacterSecondaryTraits(character, limit)].filter((value): value is string => Boolean(value)).slice(0, limit);
}

function looksLikeVividStorySpecies(species?: string | null): boolean {
  return /animal|magical|myth|dragon|fairy|fee|witch|hexe|kobold|goblin|squirrel|eichhoernchen|eichhörnchen|frog|frosch|fox|fuchs|sprite|spirit|geist|creature|guardian|waechter|wächter/i.test(String(species || ""));
}

function buildIdeaAvatarBlock(avatars: DevModeAvatar[]): string {
  if (!avatars || avatars.length === 0) return "MAIN CHARACTERS: free choice.";
  const lines: string[] = ["MAIN CHARACTERS FOR IDEA LAB:"];
  avatars.forEach((avatar, index) => {
    const heading = avatar.age != null
      ? `${index + 1}. ${avatar.name} (${avatar.age} years old)`
      : `${index + 1}. ${avatar.name}`;
    lines.push(heading);
    const dramaturgicProfile = summarizeDramaturgicTraitProfile(avatar.name, avatar.personalityTraits).slice(0, 3);
    for (const profileLine of dramaturgicProfile) {
      lines.push(`   ${profileLine}`);
    }
    if (avatar.description && avatar.description.trim()) {
      lines.push(`   Short description: ${compactExcerpt(avatar.description.trim(), 180)}`);
    }
  });
  return lines.join("\n");
}

function buildPoolIdeaCastingBlock(pool?: DevModePoolCharacter[]): string {
  if (!pool || pool.length === 0) {
    return "AVAILABLE SUPPORTING CAST: none preselected. Do not force extra characters into every idea.";
  }
  const lines: string[] = [
    `AVAILABLE SUPPORTING CAST CANDIDATES FOR IDEA LAB (recommend 0-${DEV_MODE_MAX_SUPPORTING_CAST} names only when they truly improve the premise; most strong short stories use 0-1):`,
  ];
  pool.forEach((character, index) => {
    const parts = [
      character.role || null,
      character.archetype || null,
      character.species || null,
      character.ageCategory || null,
    ].filter((part): part is string => Boolean(part));
    lines.push(`${index + 1}. ${character.name}${parts.length > 0 ? ` - ${parts.join(", ")}` : ""}`);
    const traits = poolCharacterPersonalityLine(character, 4);
    if (traits.length > 0) {
      lines.push(`   Core: ${traits.join(", ")}`);
    }
    const triggers = poolCharacterTriggers(character, 2);
    if (triggers.length > 0) {
      lines.push(`   Reacts strongly to: ${triggers.join(", ")}`);
    }
    if (character.quirk) {
      lines.push(`   Quirk: ${compactExcerpt(character.quirk, 120)}`);
    }
    if (character.speechStyle && character.speechStyle.length > 0) {
      lines.push(`   Voice: ${character.speechStyle.slice(0, 3).join(", ")}`);
    }
    if (character.catchphrase) {
      lines.push(`   Catchphrase: ${compactExcerpt(character.catchphrase, 100)}`);
    }
  });
  return lines.join("\n");
}

function countIdeaCandidates(config: StoryConfig): number {
  if (config.length === "long") return 8;
  if (config.length === "medium") return 6;
  return 5;
}

function resolvePoolNames(names: unknown, pool?: DevModePoolCharacter[]): string[] {
  if (!Array.isArray(names) || !pool || pool.length === 0) return [];
  const byName = new Map(pool.map((character) => [normalizePoolName(character.name), character.name]));
  const resolved: string[] = [];
  for (const raw of names) {
    const key = normalizePoolName(String(raw || ""));
    const match = byName.get(key);
    if (!match || resolved.includes(match)) continue;
    resolved.push(match);
  }
  return resolved.slice(0, DEV_MODE_MAX_SUPPORTING_CAST);
}

function normalizeIdeaCandidates(parsed: any, pool?: DevModePoolCharacter[]): DevModeIdeaCandidate[] {
  const rawCandidates = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.candidates)
      ? parsed.candidates
      : [];

  return rawCandidates
    .map((candidate: any, index: number): DevModeIdeaCandidate | null => {
      const title = compactExcerpt(String(candidate?.title || "").trim(), 120);
      const oneLineHook = compactExcerpt(String(candidate?.oneLineHook || candidate?.hook || "").trim(), 220);
      const centralObjectOrPlace = compactExcerpt(String(candidate?.centralObjectOrPlace || "").trim(), 120);
      const wonderRule = compactExcerpt(String(candidate?.wonderRule || "").trim(), 180);
      const emotionalEngine = compactExcerpt(String(candidate?.emotionalEngine || "").trim(), 180);
      const coreConflict = compactExcerpt(String(candidate?.coreConflict || candidate?.conflict || "").trim(), 180);
      const whyKidWantsThis = compactExcerpt(String(candidate?.whyKidWantsThis || "").trim(), 180);
      const whyDifferentFromRecent = compactExcerpt(String(candidate?.whyDifferentFromRecent || "").trim(), 180);
      if (!title || !oneLineHook || !centralObjectOrPlace || !wonderRule || !coreConflict) return null;
      return {
        id: String(candidate?.id || `idea_${index + 1}`),
        title,
        oneLineHook,
        centralObjectOrPlace,
        wonderRule,
        emotionalEngine,
        coreConflict,
        whyKidWantsThis,
        whyDifferentFromRecent,
        recommendedSupportingCast: resolvePoolNames(
          candidate?.recommendedSupportingCast || candidate?.selectedSupportingCast || [],
          pool
        ),
      };
    })
    .filter((candidate: DevModeIdeaCandidate | null): candidate is DevModeIdeaCandidate => Boolean(candidate));
}

function auditIdeaCandidateNovelty(candidate: DevModeIdeaCandidate, input: DevModeGenerationInput): DevModeIdeaNoveltyAudit {
  const brief = input.noveltyBrief;
  const candidateText = [
    candidate.title,
    candidate.oneLineHook,
    candidate.centralObjectOrPlace,
    candidate.wonderRule,
    candidate.emotionalEngine,
    candidate.coreConflict,
  ].filter(Boolean).join(" ");
  const candidateKeywords = extractMotifKeywords(candidateText, 14);
  const normalizedCandidateText = normalizeNoveltyText(candidateText);
  const explicitSoundRequest = promptExplicitlyRequestsRepeatedSoundPremise(input.config);

  let closestRecentTitle = "";
  let closestRecentOverlap = 0;
  for (const recent of brief?.recentStories || []) {
    const recentKeywords = recent.motifKeywords.length > 0
      ? recent.motifKeywords
      : extractMotifKeywords(`${recent.title} ${recent.description}`, 12);
    const score = noveltyJaccard(candidateKeywords, recentKeywords);
    if (score > closestRecentOverlap) {
      closestRecentOverlap = score;
      closestRecentTitle = recent.title;
    }
  }

  const hardAvoidMatches: string[] = [];
  for (const motif of brief?.hardAvoidMotifs || []) {
    const normalizedMotif = normalizeNoveltyText(motif);
    if (normalizedMotif.length < 6 || NOVELTY_STOPWORDS.has(normalizedMotif)) continue;
    if (isCurrentCharacterNameMotif(normalizedMotif, input)) continue;
    if (explicitSoundRequest && /gloeckchen|glocke|bell|sound|klang|geraeusch|stille|lautlos/.test(normalizedMotif)) continue;
    if (noveltyMotifMatches(normalizedCandidateText, normalizedMotif)) hardAvoidMatches.push(motif);
  }

  const recommendation: DevModeIdeaNoveltyAudit["recommendation"] =
    hardAvoidMatches.length > 0 || closestRecentOverlap >= 0.45
      ? "reject"
      : closestRecentOverlap >= 0.34
        ? "penalize"
        : closestRecentOverlap <= 0.12
          ? "prefer"
          : "acceptable";

  return {
    id: candidate.id,
    closestRecentTitle,
    closestRecentOverlap: Math.round(closestRecentOverlap * 100) / 100,
    hardAvoidMatches: hardAvoidMatches.slice(0, 4),
    recommendation,
  };
}

function auditIdeaCandidatesNovelty(candidates: DevModeIdeaCandidate[], input: DevModeGenerationInput): DevModeIdeaNoveltyAudit[] {
  return candidates.map((candidate) => auditIdeaCandidateNovelty(candidate, input));
}

function fallbackSelectedIdea(candidates: DevModeIdeaCandidate[], pool?: DevModePoolCharacter[]): DevModeSelectedIdea | undefined {
  if (candidates.length === 0) return undefined;
  const ranked = candidates
    .map((candidate) => {
      let score = 0;
      score += candidate.whyKidWantsThis.length > 0 ? 4 : 0;
      score += candidate.whyDifferentFromRecent.length > 0 ? 3 : 0;
      score += candidate.recommendedSupportingCast.length > 0 ? 0.6 : 0;
      score -= Math.max(0, candidate.recommendedSupportingCast.length - 1) * 0.4;
      score += candidate.centralObjectOrPlace.length > 16 ? 1 : 0;
      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score);
  const winner = ranked[0]?.candidate;
  if (!winner) return undefined;
  const selectedSupportingCast = resolvePoolNames(winner.recommendedSupportingCast, pool);
  return {
    ...winner,
    chosenReason: "Fallback selection: strongest shelf signal, freshness, and usable supporting cast from available pool.",
    selectedSupportingCast,
    selectionScores: {
      shelfAppeal: 8.4,
      novelty: 8.4,
      emotionalPotential: 8.2,
      childCuriosity: 8.3,
      poolCastFit: selectedSupportingCast.length > 0 ? 8.4 : 8.0,
    },
  };
}

function fallbackNoveltySafeSelectedIdea(
  candidates: DevModeIdeaCandidate[],
  input: DevModeGenerationInput,
  pool?: DevModePoolCharacter[]
): DevModeSelectedIdea | undefined {
  if (candidates.length === 0) return undefined;
  const auditById = new Map(auditIdeaCandidatesNovelty(candidates, input).map((audit) => [audit.id, audit]));
  const ranked = candidates
    .map((candidate) => {
      const audit = auditById.get(candidate.id);
      let score = 0;
      score += candidate.whyKidWantsThis.length > 0 ? 4 : 0;
      score += candidate.whyDifferentFromRecent.length > 0 ? 3 : 0;
      score += candidate.recommendedSupportingCast.length > 0 ? 0.6 : 0;
      score -= Math.max(0, candidate.recommendedSupportingCast.length - 1) * 0.4;
      score += candidate.centralObjectOrPlace.length > 16 ? 1 : 0;
      if (audit?.recommendation === "prefer") score += 2.5;
      if (audit?.recommendation === "acceptable") score += 1;
      if (audit?.recommendation === "penalize") score -= 3;
      if (audit?.recommendation === "reject") score -= 100;
      score -= (audit?.closestRecentOverlap || 0) * 8;
      return { candidate, audit, score };
    })
    .sort((a, b) => b.score - a.score);
  const winner = ranked[0]?.candidate;
  if (!winner) return fallbackSelectedIdea(candidates, pool);
  const winnerAudit = auditById.get(winner.id);
  const selectedSupportingCast = resolvePoolNames(winner.recommendedSupportingCast, pool);
  return {
    ...winner,
    chosenReason: [
      "Server novelty fallback: strongest candidate after penalizing recent-story overlap and hard-avoid motifs.",
      winnerAudit?.closestRecentTitle ? `Closest recent story: ${winnerAudit.closestRecentTitle} (${Math.round(winnerAudit.closestRecentOverlap * 100)}% motif overlap).` : "No close recent-story overlap detected.",
    ].join(" "),
    selectedSupportingCast,
    selectionScores: {
      shelfAppeal: 8.2,
      novelty: winnerAudit?.recommendation === "prefer" ? 9 : winnerAudit?.recommendation === "acceptable" ? 8.4 : 7.4,
      emotionalPotential: 8.2,
      childCuriosity: 8.2,
      poolCastFit: selectedSupportingCast.length > 0 ? 8.3 : 8.0,
    },
  };
}

function enforceSelectedIdeaNovelty(
  selectedIdea: DevModeSelectedIdea | undefined,
  candidates: DevModeIdeaCandidate[],
  input: DevModeGenerationInput,
  pool?: DevModePoolCharacter[]
): DevModeSelectedIdea | undefined {
  if (!selectedIdea) return fallbackNoveltySafeSelectedIdea(candidates, input, pool);
  const audit = auditIdeaCandidateNovelty(selectedIdea, input);
  if (audit.recommendation !== "reject") return selectedIdea;
  const fallback = fallbackNoveltySafeSelectedIdea(candidates, input, pool);
  if (!fallback) return selectedIdea;
  return {
    ...fallback,
    chosenReason: [
      `Server novelty override: model selected "${selectedIdea.title}", but the novelty audit marked it reject.`,
      audit.closestRecentTitle
        ? `Closest recent story: ${audit.closestRecentTitle} (${Math.round(audit.closestRecentOverlap * 100)}% motif overlap).`
        : "Rejected by hard-avoid motif overlap.",
      fallback.chosenReason,
    ].filter(Boolean).join(" "),
  };
}

function normalizeIdeaSelection(
  parsed: any,
  candidates: DevModeIdeaCandidate[],
  pool?: DevModePoolCharacter[]
): DevModeSelectedIdea | undefined {
  if (candidates.length === 0) return undefined;

  const candidateById = new Map(candidates.map((candidate) => [String(candidate.id), candidate]));
  const candidateByTitle = new Map(candidates.map((candidate) => [normalizePoolName(candidate.title), candidate]));
  const selectedIdeaRaw = parsed?.selectedIdea;
  const selectedId = String(
    parsed?.chosenIdeaId ||
    parsed?.selectedIdeaId ||
    selectedIdeaRaw?.id ||
    ""
  ).trim();
  const selectedTitle = normalizePoolName(String(parsed?.chosenTitle || selectedIdeaRaw?.title || ""));
  const baseIdea =
    candidateById.get(selectedId) ||
    candidateByTitle.get(selectedTitle) ||
    fallbackSelectedIdea(candidates, pool);

  if (!baseIdea) return undefined;

  const selectedSupportingCast = resolvePoolNames(
    parsed?.selectedSupportingCast ||
    selectedIdeaRaw?.recommendedSupportingCast ||
    (baseIdea as DevModeIdeaCandidate).recommendedSupportingCast ||
    [],
    pool
  );

  return {
    ...(baseIdea as DevModeIdeaCandidate),
    chosenReason: compactExcerpt(
      String(parsed?.chosenReason || parsed?.whyThisWins || selectedIdeaRaw?.whyThisWins || "").trim() ||
      "Chosen for the strongest shelf appeal, child curiosity, emotional payoff, and story-fit with the available supporting cast.",
      220
    ),
    selectedSupportingCast,
    selectionScores: parsed?.selectionScores && typeof parsed.selectionScores === "object"
      ? {
          shelfAppeal: Number(parsed.selectionScores.shelfAppeal) || undefined,
          novelty: Number(parsed.selectionScores.novelty) || undefined,
          emotionalPotential: Number(parsed.selectionScores.emotionalPotential) || undefined,
          childCuriosity: Number(parsed.selectionScores.childCuriosity) || undefined,
          poolCastFit: Number(parsed.selectionScores.poolCastFit) || undefined,
        }
      : undefined,
  };
}

function poolCharacterFitText(character: DevModePoolCharacter): string {
  return [
    character.name,
    character.role,
    character.archetype,
    character.species,
    character.ageCategory,
    poolCharacterDominant(character),
    ...poolCharacterSecondaryTraits(character, 6),
    ...poolCharacterTriggers(character, 6),
    character.physicalDescription,
    ...(character.colorPalette || []),
    ...(character.personalityKeywords || []),
    character.catchphrase,
    character.catchphraseContext,
    ...(character.speechStyle || []),
    character.quirk,
    character.backstory,
    ...(character.canonSettings || []),
  ].filter(Boolean).join(" ");
}

function selectedIdeaFitText(selectedIdea: DevModeSelectedIdea, config: StoryConfig): string {
  return [
    selectedIdea.title,
    selectedIdea.oneLineHook,
    selectedIdea.centralObjectOrPlace,
    selectedIdea.wonderRule,
    selectedIdea.emotionalEngine,
    selectedIdea.coreConflict,
    selectedIdea.whyKidWantsThis,
    config.genre,
    config.setting,
    config.customPrompt,
    ...(config.emotionalFlavors || []),
    ...(config.specialIngredients || []),
  ].filter(Boolean).join(" ");
}

function scorePoolCharacterForSelectedIdea(
  character: DevModePoolCharacter,
  selectedIdea: DevModeSelectedIdea,
  input: DevModeGenerationInput
): number {
  const requestedCastNames = selectedIdea.selectedSupportingCast?.length
    ? selectedIdea.selectedSupportingCast
    : selectedIdea.recommendedSupportingCast || [];
  const recommendedNames = new Set(requestedCastNames.map(normalizePoolName));
  const isRecommended = recommendedNames.has(normalizePoolName(character.name));
  const ideaKeywords = extractMotifKeywords(selectedIdeaFitText(selectedIdea, input.config), 18);
  const characterKeywords = extractMotifKeywords(poolCharacterFitText(character), 18);
  let score = isRecommended ? 34 : 0;
  score += noveltyJaccard(ideaKeywords, characterKeywords) * 44;

  const setting = String(input.config.setting || "").toLowerCase();
  const genre = String(input.config.genre || "").toLowerCase();
  const roleArchetype = `${character.role || ""} ${character.archetype || ""}`.toLowerCase();
  const species = String(character.species || "").toLowerCase();
  const canon = (character.canonSettings || []).map((value) => value.toLowerCase());
  if (setting && canon.some((value) => value === setting || value.includes(setting) || setting.includes(value))) score += 16;
  if (genre.includes("fairy") || genre.includes("maerchen") || genre.includes("märchen")) {
    if (species === "animal" || species === "magical_creature" || species === "mythical" || looksLikeVividStorySpecies(species)) score += 8;
    if (/helper|guide|witch|trickster|villain|guardian|mentor/.test(roleArchetype)) score += 7;
  } else if (genre.includes("adventure") || genre.includes("abenteuer")) {
    if (/helper|guide|scout|messenger|trickster|guardian/.test(roleArchetype)) score += 7;
  }

  if (poolCharacterPersonalityLine(character, 6).length >= 2) score += 4;
  if (poolCharacterTriggers(character, 4).length > 0) score += 3;
  if ((character.speechStyle || []).length > 0) score += 3;
  if (character.quirk) score += 3;
  if (character.catchphrase) score += 2;
  if (character.catchphraseContext) score += 1;

  // Recency is deliberately soft: a recently used character may still win
  // when the story fit is clearly stronger than fresher alternatives.
  const recent = character.recentUsageCount || 0;
  const userRecent = character.recentUserUsageCount || 0;
  const total = character.totalUsageCount || 0;
  score -= Math.min(7, recent * 1.4);
  score -= Math.min(9, userRecent * 4);
  score -= Math.min(5, total * 0.12);
  const lastUsedDays = daysSince(character.lastUsedAt);
  if (typeof lastUsedDays === "number") {
    if (lastUsedDays < 2) score -= 4;
    else if (lastUsedDays < 7) score -= 2;
    else if (lastUsedDays < 21) score -= 1;
  }

  return score;
}

function finalizeSelectedIdeaCast(
  input: DevModeGenerationInput,
  selectedIdea: DevModeSelectedIdea,
  pool?: DevModePoolCharacter[]
): { selectedIdea: DevModeSelectedIdea; poolCharacters?: DevModePoolCharacter[] } {
  if (!pool || pool.length === 0) return { selectedIdea, poolCharacters: pool };

  const minCount = Math.min(DEV_MODE_MIN_SUPPORTING_CAST, pool.length);
  const maxCount = Math.min(DEV_MODE_MAX_SUPPORTING_CAST, pool.length);
  const recommendedCount = (selectedIdea.selectedSupportingCast || selectedIdea.recommendedSupportingCast || []).length;
  const targetCount = Math.max(minCount, Math.min(maxCount, recommendedCount || minCount));
  const scored = pool
    .map((character) => ({ character, score: scorePoolCharacterForSelectedIdea(character, selectedIdea, input) }))
    .sort((a, b) => b.score - a.score);

  const picked: DevModePoolCharacter[] = [];
  const seenArchetypes = new Set<string>();
  const pick = (allowDuplicateArchetypes: boolean) => {
    for (const candidate of scored) {
      if (picked.length >= targetCount) break;
      if (picked.includes(candidate.character)) continue;
      const archetype = normalizePoolName(candidate.character.archetype || "");
      if (!allowDuplicateArchetypes && archetype && seenArchetypes.has(archetype)) continue;
      picked.push(candidate.character);
      if (archetype) seenArchetypes.add(archetype);
    }
  };
  pick(false);
  pick(true);

  const finalPool = picked.slice(0, targetCount);
  const finalNames = finalPool.map((character) => character.name);
  console.log("[dev-mode-generation] Final story-fit supporting cast", {
    selectedIdea: selectedIdea.title,
    targetCount,
    selectedSupportingCast: finalNames,
    topCandidates: scored.slice(0, 8).map((candidate) => ({
      name: candidate.character.name,
      score: Math.round(candidate.score * 10) / 10,
      recent: candidate.character.recentUsageCount || 0,
      userRecent: candidate.character.recentUserUsageCount || 0,
    })),
  });

  return {
    selectedIdea: {
      ...selectedIdea,
      selectedSupportingCast: finalNames,
      recommendedSupportingCast: finalNames,
      chosenReason: finalNames.length > 0
        ? `${selectedIdea.chosenReason} Final supporting cast chosen after premise selection for story fit; recent usage only acted as a soft tie-breaker.`
        : `${selectedIdea.chosenReason} No supporting cast was forced after premise selection; main-avatar agency and pacing ranked higher than pool usage.`,
    },
    poolCharacters: finalPool,
  };
}

function buildSelectedIdeaPromptBlock(input: DevModeGenerationInput): string {
  const selectedIdea = input.selectedIdea;
  if (!selectedIdea) return "";
  return [
    "LOCKED WINNING IDEA (expand this idea; do not replace it with a different premise):",
    `- Title direction: ${selectedIdea.title}`,
    `- One-line hook: ${selectedIdea.oneLineHook}`,
    `- Central object/place: ${selectedIdea.centralObjectOrPlace}`,
    `- Wonder rule: ${selectedIdea.wonderRule}`,
    `- Emotional engine: ${selectedIdea.emotionalEngine}`,
    `- Core conflict: ${selectedIdea.coreConflict}`,
    `- Why a child wants this book: ${selectedIdea.whyKidWantsThis}`,
    `- Why different from recent stories: ${selectedIdea.whyDifferentFromRecent}`,
    selectedIdea.selectedSupportingCast.length > 0
      ? `- Supporting cast chosen from pool for this idea: ${selectedIdea.selectedSupportingCast.join(", ")}. They must appear with one plot-necessary function each, then leave room for the main avatars.`
      : "- No pool character is mandatory for this idea; keep extra cast lean.",
    `- Selection reason: ${selectedIdea.chosenReason}`,
  ].join("\n");
}

// --- Voice Bible ----------------------------------------------------------
// Renders a single-line "voice tic" rule per main character + selected pool
// cast member. The goal is to prevent voice-blur (validator-flagged failure
// mode) by giving each speaker concrete rhythm, vocabulary, and signature
// gesture cues instead of generic personality summaries.

function voiceForAvatar(avatar: DevModeAvatar): string {
  const pt = avatar.personalityTraits;
  const values: Partial<Record<StoryTraitKey, number>> = {};
  for (const key of STORY_TRAIT_KEYS) values[key] = readTraitValue(pt, key);
  const v = values as Record<StoryTraitKey, number>;
  const profileText = normalizeNoveltyText([
    avatar.name,
    avatar.description,
    summarizeVisualProfile(avatar.visualProfile),
  ].filter(Boolean).join(" "));
  const age = Number(avatar.age ?? 0);

  // Compute dominant trait (handle the 0-only baseline by falling back to a
  // gentle observer voice instead of inventing personality).
  const sorted = STORY_TRAIT_KEYS.slice().sort((a, b) => v[b] - v[a]);
  const top = sorted[0];
  const topVal = v[top] ?? 0;
  if (topVal < 5) {
    return `${avatar.name}: warm observer; short sentences, asks simple "und dann?" questions, reacts with one concrete action per scene (no abstract opinions).`;
  }

  const fragments: string[] = [];
  if (/zahnluecke|zahnlucke|zahnluecken|pfeif|tanzen|tanzt/.test(profileText)) {
    fragments.push(`younger, body-first voice: short warm questions, tiny foot/dance beats, occasionally a quiet whistle through the tooth gap (NOT every line); empathy through action, not slogans`);
  }
  if (/schlau|gedaechtnis|gedachtnis|merkt|schnell|ohren|abstehend/.test(profileText)) {
    fragments.push(`older, pattern-noticing voice: counts and compares, dry sachlich humor, shows uncertainty through small physical tells (ears flush, notebook held tighter, sentence breaks); avoid fixed memory-openers as a default reflex`);
  }
  if (age > 0 && age <= 6) {
    fragments.push(`speaks in very short concrete child sentences; one feeling or question per line`);
  } else if (age >= 8) {
    fragments.push(`can use slightly longer observation lines, but still childlike and never adult-explanatory`);
  }
  if (v.logic >= 45 || v.persistence >= 45) {
    fragments.push(`uses short corrections and rules ("X gehört zu Y. Immer."), counts on fingers, prefers list-numbers ("Erstens... Zweitens...")`);
  }
  if (v.creativity >= 45) {
    fragments.push(`compares things to toys/props ("wie ein kleiner Mond", "wie ein Spielzeugauto"), grins before speaking`);
  }
  if (v.curiosity >= 45) {
    fragments.push(`asks concrete why/how questions tied to visible clues; avoid repeating the same opener more than once in the whole story`);
  }
  if (v.empathy >= 45) {
    fragments.push(`reads the other person's body before acting; shows empathy through one concrete gesture (hand on shoulder, stepping closer, lowering voice) instead of a fixed catchphrase`);
  }
  if (v.courage >= 45) {
    fragments.push(`takes a small physical step forward when others freeze; quiet decisive action rather than slogans`);
  }
  if (v.vocabulary >= 70) {
    fragments.push(`expressive precise words, but still child-concrete (no adult abstractions)`);
  }
  if (v.vocabulary > 0 && v.vocabulary < 30) {
    fragments.push(`speaks simply; short clear words; no literary metaphors`);
  }

  const tic = fragments.slice(0, 3).join("; ") || `concrete, age-appropriate phrasing; no adult abstractions`;
  return `${avatar.name}: ${tic}.`;
}

function voiceForPoolCharacter(character: DevModePoolCharacter): string {
  const bits: string[] = [];
  if (character.catchphrase) {
    bits.push(`signature line „${compactExcerpt(character.catchphrase, 80)}"`);
  }
  if (Array.isArray(character.speechStyle) && character.speechStyle.length > 0) {
    bits.push(`speech style: ${character.speechStyle.slice(0, 3).join(", ")}`);
  }
  if (character.quirk) {
    bits.push(`physical/verbal quirk: ${compactExcerpt(character.quirk, 80)}`);
  }
  const triggers = poolCharacterTriggers(character, 2);
  if (triggers.length > 0) {
    bits.push(`reacts strongly to: ${triggers.join(", ")}`);
  }
  if (bits.length === 0) {
    const dominant = poolCharacterDominant(character);
    if (dominant) bits.push(`dominant trait colors the voice: ${dominant}`);
  }
  const line = bits.length > 0 ? bits.join("; ") : "concrete voice, no narrator-style explanations";
  return `${character.name}: ${line}.`;
}

function buildVoiceBibleBlock(input: DevModeGenerationInput): string | null {
  const lines: string[] = [];
  for (const avatar of input.avatars || []) {
    if (!avatar?.name) continue;
    lines.push(`- ${voiceForAvatar(avatar)}`);
  }
  const selectedCast = input.selectedIdea?.selectedSupportingCast || [];
  const poolByName = new Map(
    (input.poolCharacters || []).map((character) => [normalizePoolName(character.name), character])
  );
  for (const name of selectedCast) {
    const character = poolByName.get(normalizePoolName(name));
    if (!character) continue;
    lines.push(`- ${voiceForPoolCharacter(character)}`);
  }
  if (lines.length === 0) return null;
  return [
    "VOICE BIBLE (binding \u2014 every quoted line must sound unmistakably like the named character):",
    ...lines,
    "- A reader should often identify the speaker WITHOUT tags. If two characters could say a line interchangeably, rewrite one of them.",
    "- CATCHPHRASE RULE: any fixed signature line for a character (e.g. \"Du bist traurig, oder?\", \"Ich hab mir gemerkt...\", \"Warte, ich hab da noch eine Frage!\") may appear AT MOST ONCE in the whole story. Prefer showing the character\u2019s voice through fresh, varied phrasings, gestures, and concrete actions \u2014 not by repeating catchphrases.",
    "- Voice should come from rhythm, vocabulary, body, and reaction style \u2014 not from formulaic openers. Two lines starting with the same fixed phrase = rewrite one.",
  ].join("\n");
}

// --- Writer voice anchor --------------------------------------------------
// Inlines a tiny imitation target so the draft model writes toward
// Donaldson rhythm + Nordqvist subtext. Existing validator anchors mention
// these books only at validation time — too late to influence prose.

function buildWriterVoiceAnchorBlock(input: DevModeGenerationInput): string | null {
  const code = languageCodeFromName(localizedLanguageName(input.config.language));
  if (code === "de") {
    return [
      "WRITER VOICE BENCHMARK (craft target — do not copy, continue, or imitate any existing book):",
      "- Top read-aloud craft: short musical beats, recurring refrain, no wasted words, and a central trick/rule that keeps paying off.",
      "- Top character-comedy craft: two unmistakably different voices; comedy from action and props, not narrator commentary; warmth shown through small gestures, not stated.",
      "- Use these as quality criteria only. The story must remain the user's original premise with original wording.",
      "- Allowed and encouraged: one surprising simile per chapter from a child's world (toy, animal, food, weather). Never delete a strong simile during repair.",
    ].join("\n");
  }
  if (code === "en") {
    return [
      "WRITER VOICE BENCHMARK (craft target — do not copy, continue, or imitate any existing book):",
      "- Top read-aloud craft: short musical beats, recurring refrain, no wasted words, and a central trick/rule that keeps paying off.",
      "- Top character-comedy craft: two unmistakably different voices; comedy from action and props; warmth in small gestures.",
      "- Use these as quality criteria only. The story must remain the user's original premise with original wording.",
      "- Allowed and encouraged: one surprising simile per chapter from a child's world (toy, animal, food, weather). Never delete a strong simile during repair.",
    ].join("\n");
  }
  return null;
}

function buildReleaseCraftContract(input: DevModeGenerationInput): string {
  const languageName = localizedLanguageName(input.config.language);
  return [
    "RELEASE-QUALITY CRAFT CONTRACT (9.0+ target, benchmark principles only):",
    `- Output is in ${languageName}, but quality must compare to real shelf books: a child-retellable premise, musical read-aloud rhythm, distinct voices, escalating try-fail-try, and an earned final reversal/payoff.`,
    "- Every recurrence changes meaning. If a refrain, prop, sound, or rule repeats at the same emotional level, rewrite it so it tests, blocks, reveals, jokes, or pays off.",
    "- Each chapter result must force the next chapter by therefore/but causality. No episode may be movable without breaking the plot.",
    "- The final choice must be child-small but emotionally exact: giving up control, sharing a private thing, waiting, admitting a mistake, or noticing what a helper cannot say.",
    "- Pool characters may complicate, pressure, reveal, or create comedy; they must not explain the lesson or steal the decisive action from the main avatars.",
    "- The ending image should be closed, funny/tender, and slightly larger than the problem — not a moral sentence and not a marketing cliffhanger.",
  ].join("\n");
}

function buildWholeStoryContinuityContract(chapterCount: number): string {
  return [
    "WHOLE-STORY CONTINUITY CONTRACT:",
    `- Write ONE continuous story arc that is displayed as exactly ${chapterCount} chapters. Chapters are scene/beat breaks for the reader, not standalone mini-stories.`,
    "- The prose must still read smoothly if all chapter titles were removed. Do not restart, recap, or neatly resolve the tension at every chapter boundary.",
    "- Each chapter inherits pressure from the previous one, changes the problem once, and leaves a concrete pull that makes the next chapter necessary.",
    "- Use therefore/but causality across chapter boundaries; avoid episodic 'and then another thing happened' structure.",
    "- Chapter titles should label the next turn or image, not make each chapter feel like a separate book.",
  ].join("\n");
}

function buildSelectedCastIntegrationContract(input: DevModeGenerationInput, strict = false): string | null {
  const castNames = input.selectedIdea?.selectedSupportingCast || [];
  if (castNames.length === 0) return null;

  const poolByName = new Map((input.poolCharacters || []).map((character) => [normalizePoolName(character.name), character]));
  const lines: string[] = [
    strict ? "LOCKED CAST REPAIR CONTRACT:" : "LOCKED CAST INTEGRATION CONTRACT:",
    `- Selected supporting cast: ${castNames.join(", ")}. Each must change the plot, not merely appear or explain.`,
    "- For every selected cast figure, include: one visible action only they would do, one line/gesture in their voice, and one causal effect on the problem or solution.",
    "- Failure condition: if the story still works after deleting that figure, rewrite the beat until the figure is plot-necessary.",
    "- Cast budget: give each supporting figure a compact scene job. Do not let helpers form a parade, take over the finale, or explain the lesson.",
    castNames.length > 1
      ? "- With two supporting figures, split functions clearly: one may complicate or reveal; one may help with a tool/action. The main avatars must still make the decisive choice."
      : "- The supporting figure may nudge the problem, but the main avatars must make the decisive choice.",
  ];

  for (const name of castNames) {
    const character = poolByName.get(normalizePoolName(name));
    if (!character) continue;
    const traits = poolCharacterPersonalityLine(character, 3);
    const triggers = poolCharacterTriggers(character, 2);
    const details = [
      traits.length > 0 ? `core=${traits.join("/")}` : null,
      character.quirk ? `quirk=${compactExcerpt(character.quirk, 90)}` : null,
      character.catchphrase ? `catchphrase=${compactExcerpt(character.catchphrase, 70)}` : null,
      triggers.length > 0 ? `trigger=${triggers.join("/")}` : null,
    ].filter(Boolean).join("; ");
    if (details) lines.push(`- ${name}: use their specific data on-page (${details}).`);
  }

  return lines.join("\n");
}

function buildSilentPreWriteSelfReviewContract(
  input: DevModeGenerationInput,
  chapterCount: number,
  mode: "draft" | "compact-draft" | "polish" | "chapter-repair"
): string {
  const bounds = getChapterLengthBounds(input.config);
  const paragraphBounds = getParagraphBounds(input.config);
  const modeLabel = mode === "chapter-repair"
    ? "SILENT CHAPTER-REPAIR SELF-REVIEW BEFORE WRITING"
    : mode === "polish"
      ? "SILENT REPAIR/POLISH SELF-REVIEW BEFORE WRITING"
      : "SILENT PRE-WRITE SELF-REVIEW";

  return [
    `${modeLabel} (mandatory; do not output this review):`,
    "- Before writing prose, privately check the plan against the quality gates; do not reveal reasoning, notes, or checklist text.",
    `- Shape: exactly ${chapterCount} chapter(s); each chapter must fit ${bounds.min}-${bounds.max} characters and ${paragraphBounds.min}-${paragraphBounds.max} paragraphs.`,
    `- Budget: ${storyWordBudgetGuidance(input.config, chapterCount)}`,
    `- Dialogue: target ${DEV_MODE_PROMPT_DIALOG_PCT}% dialogue overall; every repaired/written chapter must clear ${DEV_MODE_MIN_CHAPTER_DIALOG_PCT}% without filler chatter.`,
    "- Continuity: write one continuous story split into display chapters; no chapter may feel like a reset, recap, or separate mini-story.",
    "- Causality: every chapter segment needs inherited pressure -> obstacle -> irreversible change -> concrete pull; no loose 'and then' sequence.",
    "- Voice: each quoted line must sound like that character and do at least two jobs: action, relationship, tension, humor, or subtext.",
    "- Cast: selected supporting characters must be plot-necessary; each needs a unique action/line/gesture that changes the problem or solution.",
    "- Agency: adults/helpers may offer pressure, tools, or comic complications; the main avatars must notice the key clue and perform the decisive action.",
    "- Payoff: finale/repaired chapter must use a planted detail, not a new convenient solution or explained moral.",
    "- If any check fails, revise internally before emitting JSON. The final answer must contain only the requested JSON schema.",
  ].join("\n");
}

function wizardLevelLabel(value: number | undefined, kind: "suspense" | "humor"): string {
  const level = Math.max(0, Math.min(3, Number(value ?? 1)));
  if (kind === "suspense") {
    return ["very gentle", "light", "clear", "strong but age-safe"][level] || "light";
  }
  return ["minimal", "light", "playful", "high but story-driven"][level] || "light";
}

function ageComprehensionGuidance(ageGroup: StoryConfig["ageGroup"]): string {
  switch (ageGroup) {
    case "3-5":
      return "very clear cause/effect, one visible problem at a time, concrete feelings, short sentences, safe tension, strong repetition";
    case "6-8":
      return "clear chapter logic, playful dialogue, mild suspense, concrete clues, no adult abstractions, emotions shown through action";
    case "9-12":
      return "richer motives, sharper choices, layered clues, stronger causality, still age-clear and not cynical";
    case "13+":
      return "more nuance and interior tension allowed, but still accessible and emotionally concrete";
    default:
      return "age-clear, concrete, emotionally readable";
  }
}

function complexityGuidance(complexity: StoryConfig["complexity"]): string {
  switch (complexity) {
    case "simple":
      return "simple: one central problem, few roles, visible choices, no nested subplot";
    case "complex":
      return "complex: layered but still child-readable; every subplot beat must pay off clearly";
    case "medium":
    default:
      return "medium: one main plot with a small emotional counter-thread";
  }
}

function stylePresetGuidance(stylePreset?: StoryConfig["stylePreset"]): string {
  switch (stylePreset) {
    case "rhymed_playful": return "rhymed/playful: rhythmic read-aloud language, small rhymes or refrain, bouncy comic timing";
    case "gentle_minimal": return "gentle/minimal: quiet, precise, warm, no overloaded spectacle";
    case "wild_imaginative": return "wild/imaginative: surprising images, lively motion, playful impossibility with clear rules";
    case "philosophical_warm": return "philosophical/warm: simple wonder and meaning through concrete action, never abstract lecture";
    case "mischief_empowering": return "mischief/empowering: cheeky initiative, funny mistakes, children solve through agency";
    case "adventure_epic": return "adventure/epic: brave choices, bigger stakes, triumphant but age-safe turns";
    case "quirky_dark_sweet": return "quirky dark-sweet: funny-uncanny edges, warmth underneath, no real horror";
    case "cozy_friendly": return "cozy/friendly: safe warmth, gentle conflict, comfort and togetherness";
    case "classic_fantasy": return "classic fantasy: timeless wonder, symbolic objects, clear magic rules";
    case "whimsical_logic": return "whimsical logic: absurd premise obeys a clear playful rule";
    case "mythic_allegory": return "mythic allegory: symbolic but concrete, no explained moral";
    case "road_fantasy": return "road fantasy: journey structure, each place changes the problem";
    case "imaginative_meta": return "imaginative/meta: playful self-aware wonder without breaking emotional immersion";
    case "pastoral_heart": return "pastoral heart: nature, home, care, quiet courage";
    case "bedtime_soothing": return "bedtime soothing: low threat, soft rhythm, calming closure";
    default: return "use a fitting children's-book style derived from genre, age, tone, and wishes";
  }
}

function hookGuidance(hooks?: StoryConfig["hooks"]): string | null {
  if (!hooks || hooks.length === 0) return null;
  const labels: Record<string, string> = {
    secret_door: "secret door / threshold discovery",
    riddle_puzzle: "riddle or puzzle clue",
    lost_map: "lost map / missing guide structure",
    mysterious_guide: "mysterious guide with a clear story function",
    time_glitch: "time glitch or surprising rule change",
    friend_turns_foe: "friend seems opposed, with an earned reason",
    foe_turns_friend: "foe can change, but gradually through action",
    moral_choice: "concrete moral choice shown through action, not sermon",
  };
  return hooks.map((hook) => labels[hook] || hook).join("; ");
}

function buildWizardCreativeBrief(config: StoryConfig, chapterCount: number, compact = false): string {
  const experience = buildStoryExperienceContext(config);
  const lines: string[] = [
    compact ? "WIZARD BRIEF:" : "WIZARD CREATIVE BRIEF (binding; use for premise, blueprint, and prose):",
    `- Genre promise: ${config.genre}; setting promise: ${config.setting}. Translate both into concrete scenes, rules, props, and payoffs.`,
    `- Length: ${config.length}, exactly ${chapterCount} chapters. ${chapterLengthGuidance(config)}`,
    `- Age comprehension (${config.ageGroup}): ${ageComprehensionGuidance(config.ageGroup)}.`,
    `- Complexity: ${complexityGuidance(config.complexity)}.`,
  ];

  if (experience.soul) {
    lines.push(`- Story soul: ${experience.soul.label} — ${experience.soul.storyPromise}`);
  }
  if (experience.emotionalFlavors.length > 0) {
    lines.push(`- Desired feeling(s): ${describeEmotionalFlavors(experience).replace(/\n/g, " | ")}`);
  }
  if (experience.tempo) {
    lines.push(`- Story tempo: ${experience.tempo.label} — ${experience.tempo.description}`);
  } else if (config.pacing) {
    lines.push(`- Pacing: ${config.pacing}.`);
  }
  if (experience.specialIngredients.length > 0) {
    lines.push(`- Special ingredient(s): ${describeSpecialIngredients(experience).replace(/\n/g, " | ")}`);
  }

  lines.push(`- Tone/style: tone=${config.tone || "warm"}; style=${stylePresetGuidance(config.stylePreset)}.`);
  lines.push(`- Suspense: ${wizardLevelLabel(config.suspenseLevel, "suspense")}; humor: ${wizardLevelLabel(config.humorLevel, "humor")}. Keep both appropriate for ${config.ageGroup}.`);
  lines.push(
    config.allowRhymes
      ? "- Rhyme wish: include rhythmic read-aloud language and a recurring rhyme/refrain or short rhyming couplets. Do not force clumsy rhyme in every sentence; story clarity wins."
      : "- Rhyme wish: no forced rhyming; rhythmic repetition is allowed only if it improves read-aloud pull."
  );
  if (config.pov) {
    lines.push(config.pov === "ich" ? "- POV: first-person voice if it does not break the requested story shape." : "- POV: close third-person/personale narration.");
  }
  const hooks = hookGuidance(config.hooks);
  if (hooks) lines.push(`- Requested hook(s): ${hooks}.`);
  if (config.hasTwist) {
    lines.push("- Surprise wish: include an earned surprise/twist. Plant it early; do not make it random or confusing.");
  }
  if (config.learningMode?.enabled && config.learningMode.subjects?.length) {
    const objectives = config.learningMode.learningObjectives?.length
      ? ` Objectives: ${config.learningMode.learningObjectives.join(", ")}.`
      : "";
    lines.push(`- Learning mode: ${config.learningMode.subjects.join(", ")} (${config.learningMode.difficulty}). Weave in gently through action/dialogue, never as a lesson block.${objectives}`);
  }
  if (config.parentalGuidance?.trim()) {
    lines.push(`- Parent/safety guidance: ${compactExcerpt(config.parentalGuidance, compact ? 260 : 520)}`);
  }
  if (config.customPrompt?.trim()) {
    lines.push(`- Reader's explicit wish: ${compactExcerpt(config.customPrompt, compact ? 260 : 520)}. Treat this as binding unless it conflicts with safety, age, or quality.`);
  }

  return lines.join("\n");
}

function buildPrompts(input: DevModeGenerationInput): { systemPrompt: string; userPrompt: string; chapterCount: number } {
  const { config, avatars, poolCharacters, primaryProfileAge } = input;
  const chapterCount = deriveChapterCount(config.length);
  const languageName = localizedLanguageName(config.language);
  const code = languageCodeFromName(languageName);

  const systemPrompt = [
    "You are an experienced children's-book author.",
    "Write a very good, gripping, age-appropriate children's story.",
    `OUTPUT LANGUAGE: the title, description, and chapter content must be in ${languageName}. The instructions are in English; do NOT translate the instructions into your output.`,
    targetLanguageStyleAnchor(code),
    "Respond with a valid JSON object ONLY, matching this schema:",
    "{",
    '  "title": string,',
    '  "description": string,',
    '  "chapters": [ { "title": string, "content": string, "order": number } ]',
    "}",
    "JSON output rules:",
    "- No Markdown, no code fences (``` ... ```), no explanations before or after the JSON.",
    "- No comments (// ...), no trailing commas.",
    '- All property names in double quotes.',
    `- For dialogue inside the story content use ONLY the target-language typographic quotation marks (German „…", French «…», English "…"). No bare ASCII " inside story strings.`,
    `- The character " may appear in string values ONLY as \\" (escaped). Prefer the typographic variants above.`,
    "- Line breaks inside chapter content must be escaped as \\n, never real newlines.",
    "- The JSON must parse cleanly with JSON.parse.",
  ].join("\n");

  // Build avatar block with full visual profile + personality traits.
  // If the caller didn't supply enriched avatars, fall back to a minimal name list.
  let avatarBlock = buildAvatarBlock(avatars || []);
  if (!avatarBlock) {
    const names = (avatars || []).map((a) => a.name).filter(Boolean);
    avatarBlock =
      names.length > 0
        ? `MAIN CHARACTERS: ${names
            .map((n, i) =>
              i === 0 && typeof primaryProfileAge === "number" ? `${n} (${primaryProfileAge} years old)` : n
            )
            .join(", ")}`
        : "MAIN CHARACTERS: free choice.";
  }

  const poolBlock = buildPoolBlock(poolCharacters);

  const learningLine =
    config.learningMode?.enabled && config.learningMode.subjects?.length
      ? `Learning goal (weave in gently, never preach): ${config.learningMode.subjects.join(", ")}.`
      : null;

  const customLine = config.customPrompt?.trim()
    ? `Reader's extra wish: ${config.customPrompt.trim()}`
    : null;

  const userPrompt = [
    `Write one continuous children's story that will be displayed as ${chapterCount} chapters.`,
    `Age group: ${config.ageGroup}.`,
    `Genre: ${config.genre}.`,
    `Setting: ${config.setting}.`,
    buildWizardCreativeBrief(config, chapterCount),
    "",
    buildNoveltyPromptBlock(input) || null,
    buildSelectedIdeaPromptBlock(input) || null,
    "",
    avatarBlock,
    poolBlock || null,
    "",
    learningLine,
    customLine,
    buildWholeStoryContinuityContract(chapterCount),
    "Each chapter needs a clear scene turn, but must NOT feel complete on its own; unresolved pressure should carry into the next chapter.",
    `"order" starts at 1 and counts up. Exactly ${chapterCount} chapters.`,
    `"description" is a 1–2 sentence blurb.`,
    `FINAL REMINDER: title, description and all chapter content MUST be in ${languageName}.`,
  ]
    .filter((line): line is string => line !== null && line !== undefined)
    .join("\n");

  return { systemPrompt, userPrompt, chapterCount };
}

interface DevModeStoryContextOptions {
  includeNoveltyBrief?: boolean;
  includeSelectedIdea?: boolean;
}

function buildDevStoryContext(input: DevModeGenerationInput, chapterCount: number, options: DevModeStoryContextOptions = {}): string {
  const { config, avatars, poolCharacters, primaryProfileAge } = input;
  const languageName = localizedLanguageName(config.language);
  const includeNoveltyBrief = options.includeNoveltyBrief !== false;
  const includeSelectedIdea = options.includeSelectedIdea !== false;

  let avatarBlock = buildAvatarBlock(avatars || []);
  if (!avatarBlock) {
    const names = (avatars || []).map((a) => a.name).filter(Boolean);
    avatarBlock =
      names.length > 0
        ? `MAIN CHARACTERS: ${names
            .map((n, i) =>
              i === 0 && typeof primaryProfileAge === "number" ? `${n} (${primaryProfileAge} years old)` : n
            )
            .join(", ")}`
        : "MAIN CHARACTERS: free choice.";
  }

  const poolBlock = buildPoolBlock(poolCharacters);
  const learningLine =
    config.learningMode?.enabled && config.learningMode.subjects?.length
      ? `Learning goal (weave in gently, never preach): ${config.learningMode.subjects.join(", ")}.`
      : null;
  const customLine = config.customPrompt?.trim()
    ? `Reader's extra wish (keep their phrasing's intent; output stays in target language): ${config.customPrompt.trim()}`
    : null;

  return [
    `Output language: ${languageName}.`,
    `Age group: ${config.ageGroup}.`,
    `Chapter count: exactly ${chapterCount}.`,
    `Genre: ${config.genre}.`,
    `Setting: ${config.setting}.`,
    buildWizardCreativeBrief(config, chapterCount),
    "",
    genreCraftGuidance(config.genre),
    settingCraftGuidance(config.setting),
    includeNoveltyBrief ? buildNoveltyPromptBlock(input) : null,
    includeSelectedIdea ? buildSelectedIdeaPromptBlock(input) : null,
    "",
    avatarBlock,
    poolBlock || null,
    learningLine,
    customLine,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

function buildEmotionAndVoicePromptContext(
  input: DevModeGenerationInput,
  chapterCount: number,
  options: DevModeStoryContextOptions = {}
): string {
  return [
    buildDevStoryContext(input, chapterCount, options),
    "",
    "QUALITY GOAL:",
    "- Don't just resolve an adventure — transform a feeling a child recognizes.",
    "- After reading, the story should stay in mind as a place, a character, and a final image.",
    "- The story needs reading pull: kids should want to know what's around the next corner, in the next chapter, or on the next re-read.",
    "- Build recognizability in: a short refrain, a funny saying, a recurring gesture, or a visible object/action that gains new meaning each time.",
    "- Each chapter ends on a turn, not an explanation. The last paragraph must trigger anticipation, worry, wonder, or a quiet giggle.",
    "- Every main character must make one small mistake that comes from their character and later leads to a better action.",
    "- The antagonist must not be pure mechanic. They need a wound, a wrong belief, funny-unsettling behavior, and a new place at the end.",
    "",
    buildReleaseCraftContract(input),
    "",
    buildWholeStoryContinuityContract(chapterCount),
  ].join("\n");
}

function buildIdeaCandidatePrompts(input: DevModeGenerationInput, chapterCount: number): { systemPrompt: string; userPrompt: string } {
  const candidateCount = countIdeaCandidates(input.config);
  const languageName = localizedLanguageName(input.config.language);
  const systemPrompt = qualitySystemPrompt(
    languageName,
    [
      "Schema:",
      "{",
      '  "candidates": [',
      '    {',
      '      "id": string,',
      '      "title": string,',
      '      "oneLineHook": string,',
      '      "centralObjectOrPlace": string,',
      '      "wonderRule": string,',
      '      "emotionalEngine": string,',
      '      "coreConflict": string,',
      '      "whyKidWantsThis": string,',
      '      "whyDifferentFromRecent": string,',
      '      "recommendedSupportingCast": string[]',
      "    }",
      "  ]",
      "}",
    ].join("\n")
  );

  const userPrompt = [
    `IDEA LAB CALL: Generate exactly ${candidateCount} short children's-book premises before any blueprint writing.`,
    "Do NOT write story prose. Do NOT write chapters. Generate only premise candidates strong enough to deserve a full story.",
    "Every candidate must feel like a real book a child would pull from a library shelf: concrete, visual, memorable, emotionally playable, and different from the recent stories.",
    "No generic fantasy quests. No recycled sound/bell/silence premises unless the user explicitly asked for them.",
    "Hard-avoid motifs are word families, not exact words. If a motif like 'spiegel' is in the novelty brief, do not use spiegelt, Spiegelung, Spiegelwasser, mirror-rule, or a title/chapter built around that idea.",
    "Use the available supporting cast only when the fit is real. If a pool character does not fit a candidate naturally, leave them out of that candidate.",
    `Recommended supporting cast names must come ONLY from the provided pool list. Recommend 0-${DEV_MODE_MAX_SUPPORTING_CAST} names; choose zero if the premise is stronger with only the main avatars.`,
    "Never recommend a cast member just to use the pool. A pool figure must create a turn, complication, joke, clue, or payoff that the main avatars could not create alone.",
    "At least half the candidates should differ strongly in object/place/problem structure, not just surface wording.",
    "",
    `Target output language later: ${languageName}. Candidate fields may stay in English for speed, except titles may already be in the target language if they sound stronger that way.`,
    `Plan for exactly ${chapterCount} later chapters, but do not outline them here.`,
    "Every premise candidate must satisfy the wizard creative brief; do not propose ideas that ignore age, length, genre, feeling, rhyme, twist, or explicit wishes.",
    "",
    buildWizardCreativeBrief(input.config, chapterCount),
    "",
    buildNoveltyPromptBlock(input) || null,
    "",
    buildIdeaAvatarBlock(input.avatars || []),
    "",
    buildPoolIdeaCastingBlock(input.poolCharacters),
    "",
    `Genre: ${input.config.genre}.`,
    `Setting: ${input.config.setting}.`,
    `Age group: ${input.config.ageGroup}.`,
  ].filter((line): line is string => Boolean(line)).join("\n");

  return { systemPrompt, userPrompt };
}

function buildIdeaSelectionPrompts(
  input: DevModeGenerationInput,
  chapterCount: number,
  candidates: DevModeIdeaCandidate[]
): { systemPrompt: string; userPrompt: string } {
  const languageName = localizedLanguageName(input.config.language);
  const noveltyAudits = auditIdeaCandidatesNovelty(candidates, input);
  const auditById = new Map(noveltyAudits.map((audit) => [audit.id, audit]));
  const selectableCandidates = candidates.filter((candidate) => auditById.get(candidate.id)?.recommendation !== "reject");
  const candidatesForSelection = selectableCandidates.length > 0 ? selectableCandidates : candidates;
  const allCandidatesRejected = selectableCandidates.length === 0 && candidates.length > 0;
  const rejectedCount = allCandidatesRejected ? candidates.length : candidates.length - candidatesForSelection.length;
  const systemPrompt = qualitySystemPrompt(
    languageName,
    [
      "Schema:",
      "{",
      '  "chosenIdeaId": string,',
      '  "chosenReason": string,',
      '  "selectedSupportingCast": string[],',
      '  "selectionScores": {',
      '    "shelfAppeal": number,',
      '    "novelty": number,',
      '    "emotionalPotential": number,',
      '    "childCuriosity": number,',
      '    "poolCastFit": number',
      "  },",
      '  "selectedIdea": {',
      '    "id": string,',
      '    "title": string,',
      '    "oneLineHook": string,',
      '    "centralObjectOrPlace": string,',
      '    "wonderRule": string,',
      '    "emotionalEngine": string,',
      '    "coreConflict": string,',
      '    "whyKidWantsThis": string,',
      '    "whyDifferentFromRecent": string,',
      '    "recommendedSupportingCast": string[]',
      "  }",
      "}",
    ].join("\n")
  );

  const userPrompt = [
    "IDEA LAB SELECTION CALL: Choose the single best premise candidate for a real children's book.",
    "Pick the candidate with the strongest combination of shelf appeal, child curiosity, emotional payoff, novelty, and usable supporting cast fit.",
    "Do not reward generic safety. A merely clean candidate should lose to a memorable one.",
    `If a candidate recommends supporting cast, keep 0-${DEV_MODE_MAX_SUPPORTING_CAST} names that truly improve this story. Decorative, adult-explainer, or mismatched pool characters should be dropped.`,
    "Prefer one vivid supporting figure over two functional helpers. Zero supporting figures is a valid high-quality choice when it protects voice, pacing, and child agency.",
    "A recently used character may still win if the fit is clearly stronger than fresher alternatives; freshness is a tie-breaker, not a ban.",
    "The winner must be a premise that can plausibly reach 9/10 quality after blueprint + draft, not just a cute image.",
    "Use the server novelty precheck as binding eligibility: choose only from SELECTABLE CANDIDATES. Rejected candidates are shown only for audit transparency.",
    allCandidatesRejected
      ? "All candidates were marked reject by server novelty audit; choose the least-overlapping candidate and explain why."
      : rejectedCount > 0
      ? `${rejectedCount} candidate(s) were removed from the selectable list by server novelty audit; do not choose them.`
      : "No candidate was removed by server novelty audit.",
    "",
    `Target output language later: ${languageName}.`,
    `Future chapter count: exactly ${chapterCount}.`,
    "The chosen premise must best satisfy the wizard creative brief, not just novelty or cuteness.",
    "",
    buildWizardCreativeBrief(input.config, chapterCount),
    "",
    buildNoveltyPromptBlock(input) || null,
    "",
    "SERVER NOVELTY PRECHECK:",
    promptJson(noveltyAudits),
    "",
    "SELECTABLE CANDIDATES:",
    promptJson(candidatesForSelection),
  ].filter((line): line is string => Boolean(line)).join("\n");

  return { systemPrompt, userPrompt };
}

function buildLeanRepairPromptContext(input: DevModeGenerationInput, chapterCount: number): string {
  const languageName = localizedLanguageName(input.config.language);
  const heroNames = (input.avatars || []).map((avatar) => avatar.name).filter(Boolean);
  const poolNames = (input.poolCharacters || []).map((character) => character.name).filter(Boolean);
  return [
    `Output language: ${languageName}.`,
    `Age group: ${input.config.ageGroup}. Chapter count: exactly ${chapterCount}.`,
    `Genre: ${input.config.genre}. Setting: ${input.config.setting}.`,
    buildWizardCreativeBrief(input.config, chapterCount, true),
    heroNames.length > 0 ? `Main characters: ${heroNames.join(", ")}.` : "Main characters: preserve the existing story's main characters.",
    poolNames.length > 0 ? `Supporting cast already available: ${poolNames.join(", ")}.` : null,
    "Repair context is intentionally compact to reduce cost. Preserve continuity from the compact story map and the target chapter only.",
    "Voice contract: use the named voice/cast notes from the full prompt; do not force generic careful/lively/helper templates if they do not fit the actual characters.",
    "Quality goal: shorter, cleaner scenes with more action-bearing dialogue; no new subplot, no rewritten story world.",
  ].filter((line): line is string => Boolean(line)).join("\n");
}

function genreCraftGuidance(genre?: string): string {
  const normalized = String(genre || "").toLowerCase();
  if (normalized.includes("fairy") || normalized.includes("maerchen") || normalized.includes("märchen")) {
    return [
      "GENRE CRAFT — FAIRY TALE:",
      "- Use fairy-tale conventions deliberately: a threshold, a clear magic rule, symbolic objects, a simple but deep truth.",
      "- No generic fantasy quest. The wonder must be child-concrete and visible in scenes.",
      "- The solution must NOT be explained as moral; it must emerge from action, characters, and details planted earlier.",
    ].join("\n");
  }
  if (normalized.includes("adventure") || normalized.includes("abenteuer")) {
    return [
      "GENRE CRAFT — ADVENTURE:",
      "- Each chapter needs a visible goal, an obstacle, and a small consequence.",
      "- Danger stays age-appropriate, but decisions must have felt consequences.",
    ].join("\n");
  }
  return [
    "GENRE CRAFT:",
    "- Translate the genre into concrete scenes, rules, props, and turns.",
    "- Avoid empty genre labels and interchangeable stock motifs.",
  ].join("\n");
}

function settingCraftGuidance(setting?: string): string {
  const normalized = String(setting || "").toLowerCase();
  if (!normalized || normalized === "fantasy") {
    return [
      "SETTING CRAFT:",
      "- If the setting is generic, invent a specific place with recognizable details.",
      "- The place must influence the plot, not just decorate it.",
    ].join("\n");
  }
  return [
    "SETTING CRAFT:",
    "- Make the place sensory and concrete: light, sounds, smell, texture, paths, rules.",
    "- Use the place actively in the finale.",
  ].join("\n");
}

function chapterLengthGuidance(config: StoryConfig): string {
  if (config.length === "medium") return "Each chapter approx. 850-1,100 target characters, with hard bounds 800-1,250. Whole story target: 900-1,200 words total.";
  if (config.length === "short") return "Each chapter approx. 650–1,150 characters of target-language prose; one compact scene, not a mini-chapter.";
  if (config.length === "long") return "Each chapter approx. 1,300–2,200 characters of target-language prose.";
  return "Each chapter approx. 1,100–1,350 target characters, with hard bounds 950–1,450.";
}

function storyWordBudgetGuidance(config: StoryConfig, chapterCount: number): string {
  if (config.length === "short") {
    return `Whole-story word budget: about 550-850 words total across ${chapterCount} compact chapters.`;
  }
  if (config.length === "long") {
    return `Whole-story word budget: about 1,400-2,200 words total across ${chapterCount} chapters.`;
  }
  return `Whole-story word budget: 900-1,200 words total across ${chapterCount} chapters; aim around 180-240 words per chapter.`;
}

function getStoryWordBounds(config: StoryConfig): { min: number; max: number; targetMin: number; targetMax: number } {
  if (config.length === "short") return { min: 500, max: 900, targetMin: 550, targetMax: 850 };
  if (config.length === "long") return { min: 1200, max: 2400, targetMin: 1400, targetMax: 2200 };
  return { min: 800, max: 1250, targetMin: 900, targetMax: 1200 };
}

function languageCodeFromName(languageName: string): string {
  const lower = languageName.toLowerCase();
  if (lower.includes("german") || lower.includes("deutsch")) return "de";
  if (lower.includes("french") || lower.includes("français")) return "fr";
  if (lower.includes("spanish") || lower.includes("español")) return "es";
  if (lower.includes("italian") || lower.includes("italiano")) return "it";
  if (lower.includes("dutch") || lower.includes("nederlands")) return "nl";
  if (lower.includes("russian") || lower.includes("русский")) return "ru";
  return "en";
}

/**
 * A 1-2 line micro-anchor in the target output language so the model has a
 * concrete stylistic seed. Keeps the output authentic to the target locale
 * without leaking instructions in that language.
 */
function targetLanguageStyleAnchor(languageCode: string): string {
  switch (languageCode) {
    case "de":
      return 'Output-language style contract (German): warm, concrete, sensory, light humor; use German typographic dialogue marks „…“. This is punctuation/register guidance only, not a story premise.';
    case "fr":
      return 'Output-language style contract (French): warm, concrete, sensory; use French guillemets « … ». This is punctuation/register guidance only, not a story premise.';
    case "es":
      return 'Output-language style contract (Spanish): warm, concrete, sensory; use angle quotes «…». This is punctuation/register guidance only, not a story premise.';
    case "it":
      return 'Output-language style contract (Italian): warm, concrete, sensory; use angle quotes «…». This is punctuation/register guidance only, not a story premise.';
    case "nl":
      return 'Output-language style contract (Dutch): warm, concrete, sensory, light humor. This is register guidance only, not a story premise.';
    case "ru":
      return 'Output-language style contract (Russian): warm, concrete, sensory; use guillemets «…». This is punctuation/register guidance only, not a story premise.';
    default:
      return 'Output-language style contract (English): warm, concrete, sensory, light humor; use standard dialogue quotes. This is punctuation/register guidance only, not a story premise.';
  }
}

function qualitySystemPrompt(languageName: string, outputSchema: string): string {
  const code = languageCodeFromName(languageName);
  const dialogueQuoteRule = code === "en"
    ? 'Dialogue inside English story text may use standard double quotes ("…") and must be escaped correctly inside JSON values.'
    : 'Dialogue inside story text uses the target language\'s typographic quotation marks (German „…“, French «…», Spanish/Italian/Russian «…») — NOT plain ASCII double quotes inside story values.';
  return [
    "You are an award-winning children's-book author and dramaturg, writing age-appropriate read-aloud and read-yourself stories.",
    "Your goal is true children's-book quality: warm, gripping, clear, visual, emotional, humorous, with characters children recognize and love.",
    "Do not copy, continue, or imitate any existing book or named author's surface style; use benchmark craft principles only.",
    "",
    `OUTPUT LANGUAGE (CRITICAL):`,
    `- The final prose, all dialogue, all titles, all descriptions MUST be in ${languageName}.`,
    `- These instructions are written in English for clarity; do NOT translate the instructions into your output. Only the story content goes into ${languageName}.`,
    `- If you accidentally produce any sentence in English instead of ${languageName}, that is a failure of the task.`,
    targetLanguageStyleAnchor(code),
    "",
    "WRITING STANDARD:",
    "- Write scenes, not summaries.",
    "- Open scenes with action, dialogue, small gestures, sensory detail, and decisions.",
    "- Every main character acts visibly and owns a role.",
    "- Show feelings through behavior, body, gaze, voice, decisions — rarely name them directly.",
    "- No moralizing, no stock fantasy, no resolution through mere belief.",
    "- Low personality values mean friction / room to grow, not unlikability.",
    "- High personality values must surface as active strengths in the action.",
    "",
    "LANGUAGE & FORM (in the target output language):",
    "- Age-appropriate: clear sentences, clear images, no nested adult phrasing.",
    `- Dialogue overshoot target: write toward ${DEV_MODE_PROMPT_DIALOG_PCT}% dialogue in the final story; the hard floor is ${DEV_MODE_MIN_DIALOG_PCT}%, so do not aim merely at the floor.`,
    "- At least two concrete sensory impressions per chapter.",
    "- At least one humorous moment per chapter from situation or character (mandatory, not optional).",
    "- Dialogue must do multiple jobs: drive action, show relationship, distinguish voice, carry subtext.",
    "- The ending must leave an image, not just close a problem.",
    "",
    "READING PULL:",
    "- Write so children still hold a concrete question in their head after each chapter.",
    "- Use a recognizable mini-gesture, a prop, a refrain, or a sound/visual motif that recurs and changes.",
    "- Chapter endings must crack a small door open: new danger, new question, new decision, or a funny aftershock.",
    "- Main tension must resolve, but a small friendly spark may show this world holds more stories.",
    "- No cheap cliffhangers, no 'to be continued' marketing, no abandoned main conflict.",
    "",
    "FORBIDDEN PATTERNS (in any language — do not paraphrase these either):",
    "- 'They learned that …' / 'Sie lernten, dass …'",
    "- 'The greatest gift was friendship.' / 'Das größte Geschenk war Freundschaft.'",
    "- 'With courage and togetherness they made it.' / 'Mit Mut und Zusammenhalt schafften sie es.'",
    "- 'True magic lies in the heart.' / 'Wahre Magie liegt im Herzen.'",
    "- 'It was all just a dream.' / 'Es war alles nur ein Traum.'",
    "- Antagonist converted in one sentence.",
    "- Side character merely explains the solution.",
    "- Broken placeholders like [object Object].",
    "",
    "JSON OUTPUT:",
    "Respond with a valid JSON object ONLY.",
    "No Markdown, no code fences, no comments, no trailing commas.",
    "All property names in double quotes.",
    dialogueQuoteRule,
    "Escape line breaks inside JSON string values as \\n.",
    "",
    outputSchema,
  ].join("\n");
}

function buildBlueprintPrompts(
  input: DevModeGenerationInput,
  chapterCount: number,
  options: { compactRetry?: boolean; retryReason?: string } = {}
): { systemPrompt: string; userPrompt: string } {
  const languageName = localizedLanguageName(input.config.language);
  const systemPrompt = qualitySystemPrompt(
    languageName,
    [
      "Schema:",
      "{",
      '  "premise": string,',
      '  "storySpine": { "childWish": string, "triggerMistake": string, "magicRule": string, "escalation": string, "falseSolution": string, "smallSacrifice": string, "finalImage": string },',
      '  "noveltySignature": { "oneLineShelfPitch": string, "whyDifferentFromRecent": string, "rejectedFamiliarPremises": string[] },',
      '  "keyMoments": [ { "order": number, "emotionalExperience": string, "sceneFunction": string, "irreversibleChange": string } ],',
      '  "causalChain": string[],',
      '  "emotionalEngine": {',
      '    "storyPromise": string,',
      '    "childRelatableNeed": string,',
      '    "relationshipDynamic": string,',
      '    "antagonistHumanity": string,',
      '    "endingImage": string',
      "  },",
      '  "readerMagnet": {',
      '    "refrainLine": string,',
      '    "iconicMotif": string,',
      '    "callbackLadder": string[],',
      '    "activeUseByChapter": string[],',
      '    "rereadRewards": string[],',
      '    "nextStorySpark": string',
      "  },",
      '  "payoffEngine": { "personalObject": string, "whyItMatters": string, "whatItCostsToShare": string, "wrongAttempt": string, "finalChoice": string },',
      '  "antagonistChangeLadder": { "wantsToPossess": string, "confusion": string, "relapse": string, "decision": string, "newRole": string },',
      '  "humorCallbackPlan": { "recurringGag": string, "escalationByChapter": string[] },',
      '  "coreMagicRule": string,',
      '  "characterArcs": [ { "name": string, "startingFriction": string, "strength": string, "finalContribution": string } ],',
      '  "supportingCastUse": [ { "name": string, "storyFunction": string, "mustDo": string } ],',
      '  "plantsAndPayoffs": [ { "plant": string, "payoff": string } ],',
      '  "sceneOwnership": [ { "order": number, "driver": string, "changedState": string } ],',
      '  "chapterPlan": [ { "order": number, "title": string, "goal": string, "hook": string, "sceneBeats": string[], "obstacle": string, "conflict": string, "wrongAction": string, "turn": string, "irreversibleChange": string, "endingTension": string, "chapterEndHook": string, "kidQuestion": string, "humorMoment": string, "emotionalBeat": string, "characterActions": object, "preparedDetail": string, "laterPayoff": string, "dialogueFunction": string, "callbackToUse": string } ],',
      '  "forbiddenShortcuts": string[]',
      "}",
    ].join("\n")
  );
  const userPrompt = [
    options.compactRetry
      ? `CALL 1 RETRY: Produce a SHORTER valid JSON blueprint. Previous blueprint was unusable/truncated (${compactExcerpt(options.retryReason || "unknown parse error", 160)}).`
      : "CALL 1: Produce a story blueprint with an integrated emotional engine. Do NOT write the actual story prose yet.",
    "This support call must prepare the later story: emotional core, character roles, a clear magic rule, a try-fail-try chain, finale built from earlier-planted details.",
    "Blueprint values may stay in English — only the final story prose (Call 3) must be in the target output language.",
    "BLUEPRINT OUTPUT BUDGET (hard): valid compact JSON under 7,000 characters. One short phrase/sentence per string. sceneBeats max 4 short beats. Arrays max chapterCount items unless schema explicitly needs fewer. No prose samples, no explanations.",
    "Novelty is a hard requirement: the blueprint must feel like a different book from the user's recent stories, with a new central object/place/problem and a title a child would want to pull from a shelf.",
    "Treat the locked winning idea as binding. Expand it; do not invent a replacement premise.",
    "First create a 7-point storySpine: child wish -> concrete trigger/mistake -> magic rule -> escalation -> false solution -> small concrete sacrifice -> final image. If the spine is weak, the later draft will be rejected.",
    "Populate noveltySignature honestly: include the shelf pitch, why this is different from recent stories, and the familiar premise candidates you rejected.",
    "Plan from key moments before logistics: create 5-8 vivid emotional moments that define the story, with at least one irreversible turn where a choice changes the child/world/relationship.",
    "Write causalChain as therefore/but links: each chapter result must cause or complicate the next chapter. Avoid a loose 'and then they went somewhere else' sequence.",
    "",
    buildEmotionAndVoicePromptContext(input, chapterCount),
    "",
    `Plan exactly ${chapterCount} chapters.`,
    "Every chapterPlan item is a concrete scene card, not an abstract beat list. Required: goal, obstacle, wrongAction, turn, irreversibleChange, ending pull, humorMoment, emotionalBeat, characterActions for every main character, preparedDetail, laterPayoff, and dialogueFunction.",
    "Every chapter needs ownership: one concrete character actively drives it, and at the end something has irreversibly changed.",
    input.selectedIdea?.selectedSupportingCast?.length
      ? `Selected pool cast that MUST appear in supportingCastUse with real jobs: ${input.selectedIdea.selectedSupportingCast.join(", ")}.`
      : null,
    "Plan the read-on pull explicitly: refrain / leitmotif, chapter-end hooks, a callback ladder, small reread details.",
    "The refrain/leitmotif must be an active tool, not a label: add one concrete activeUseByChapter entry per chapter where it creates a clue, test, choice, obstacle, joke, or payoff.",
    "Plan the emotional price explicitly: which concrete object, habit, sound, promise, or comfort must a child choose to risk or share in the finale, why it matters, and what choice makes the payoff earned.",
    "Plan the antagonist's change as a ladder, not a switch: wants to possess -> confusion -> small relapse -> active decision -> new role/task.",
    "Plan one recurring humor callback that escalates across chapters and pays off in the finale; it must come from character behavior or a prop, not narrator commentary.",
    "Protect protagonist agency: supporting/adult figures may complicate, reveal pressure, or lend a tool, but the main avatars must notice the key clue and choose the final action.",
    "Keep cast lean. If a supporting figure does not change the causal chain, remove them from the plan instead of giving them a cameo.",
    "The pull must come from real curiosity: kids want to know what the thing means, why the character reacts this way, or which rule shows up next.",
    "The final sentence of the whole story must be closed AND curiosity-inducing: main problem resolved, but the world feels bigger.",
    "Make sure antagonist hints aren't smuggled into the solution as a spoiler shortcut.",
    "The emotional engine must be concrete enough that the final story writer can translate it directly into scene, dialogue, and closing image.",
  ].join("\n");
  return { systemPrompt, userPrompt };
}

function buildCritiquePrompts(
  input: DevModeGenerationInput,
  chapterCount: number,
  blueprint: any
): { systemPrompt: string; userPrompt: string } {
  const languageName = localizedLanguageName(input.config.language);
  const systemPrompt = qualitySystemPrompt(
    languageName,
    [
      "Schema:",
      "{",
      '  "score": number,',
      '  "marketGap": string,',
      '  "strengths": string[],',
      '  "mustFix": string[],',
      '  "missingEmotionalPayoff": string[],',
      '  "voiceRisks": string[],',
      '  "readOnRisks": string[],',
      '  "addictiveReadingFixes": string[],',
      '  "draftInstructions": string[],',
      '  "chapterRisks": [ { "order": number, "risk": string, "fix": string } ],',
      '  "revisedBlueprintPatch": object',
      "}",
    ].join("\n")
  );
  const userPrompt = [
    "CALL 2: Critique this blueprint like a strict children's-book dramaturg and editor.",
    "Find everything that would push the final story below 9.5/10 against real children's books: weak tension, missing emotional core, characters without an active role, identical voices, telling not showing, generic motifs, missing sensory detail, unearned turn, no irreversible key moment, or weak causality.",
    "Treat repetition as a major market failure. If the blueprint resembles recent stories or repeats hard-avoid motifs available in context, cap score at 7.0 and patch the premise direction.",
    input.selectedIdea?.selectedSupportingCast?.length
      ? `If the patch would drop any locked pool-cast figure (${input.selectedIdea.selectedSupportingCast.join(", ")}), restore them with a real story function.`
      : null,
    "Inspect read-on pull specifically: is there a recognizable motif? Does every chapter end on a real question or decision? Are there enough comic or puzzling details kids want to re-listen to?",
    "A blueprint without clear chapter-end hooks, refrain/callback, irreversible key moment, or a child-curiosity engine may score at most 8.4.",
    "Then return revisedBlueprintPatch with ONLY fields that must change. Do NOT copy the whole blueprint back. The server will merge your patch into the original blueprint.",
    "Patch the highest-impact fields only: readerMagnet, payoffEngine, antagonistChangeLadder, humorCallbackPlan, characterArcs, plantsAndPayoffs, sceneOwnership, and specific chapterPlan entries.",
    "Use draftInstructions for concrete writer-facing fixes: dialogue shape, read-on pull, voice contrast, setup/payoff, chapter-end hooks. Keep them short and actionable.",
    "Score harshly. A technically clean blueprint is not automatically market-quality.",
    "Critique values stay in English; only the final story prose (Call 3) is in the target output language.",
    "",
    "CONTEXT:",
    buildEmotionAndVoicePromptContext(input, chapterCount, { includeNoveltyBrief: false }),
    "",
    "BLUEPRINT:",
    promptJson(blueprint),
  ].join("\n");
  return { systemPrompt, userPrompt };
}

function buildBlueprintRepairPrompts(
  input: DevModeGenerationInput,
  chapterCount: number,
  blueprint: any,
  critique: any,
  repairAttempt: number
): { systemPrompt: string; userPrompt: string } {
  const languageName = localizedLanguageName(input.config.language);
  const systemPrompt = qualitySystemPrompt(
    languageName,
    [
      "Schema:",
      "{",
      '  "revisedBlueprintPatch": object,',
      '  "repairNotes": string[],',
      '  "expectedScoreAfterRepair": number',
      "}",
    ].join("\n")
  );
  const userPrompt = [
    `CALL 2R.${repairAttempt}: Repair the blueprint before any expensive prose draft.`,
    "Do NOT write story prose. Return only a compact patch object that the server can merge into the existing blueprint.",
    `The blueprint judge score is below the ${DEV_MODE_BLUEPRINT_TARGET_SCORE}/10 target, so repair the story spine and scene cards before any expensive prose draft.`,
    "",
    "REPAIR PRIORITIES:",
    "- Strengthen the 7-point storySpine: child wish, concrete trigger/mistake, magic rule, escalation, false solution, small sacrifice, final image.",
    "- Convert abstract chapter beats into concrete scene cards with goal, obstacle, wrongAction, turn, irreversibleChange, pull, humor, emotional beat, character actions, plant, payoff, and dialogue function.",
    "- Make every chapter result cause or complicate the next chapter.",
    "- Prepare the finale through details from chapters 1-3. No new final solution.",
    "- Keep selected supporting cast plot-necessary; do not solve by mentor explanation.",
    "- Preserve the locked winning idea. Do not replace the premise.",
    "",
    "CONTEXT:",
    buildEmotionAndVoicePromptContext(input, chapterCount, { includeNoveltyBrief: false }),
    "",
    "CURRENT BLUEPRINT:",
    promptJson(blueprint),
    "",
    "STRICT JUDGE CRITIQUE TO FIX:",
    promptJson(compactCritiqueForDraft(critique)),
  ].join("\n");
  return { systemPrompt, userPrompt };
}

function mergeArrayByOrderOrName(base: any[], revision: any[]): any[] {
  if (!Array.isArray(base)) return Array.isArray(revision) ? revision : [];
  if (!Array.isArray(revision) || revision.length === 0) return base;

  return base.map((baseItem, index) => {
    if (!baseItem || typeof baseItem !== "object") return revision[index] ?? baseItem;
    const match = revision.find((candidate) => {
      if (!candidate || typeof candidate !== "object") return false;
      if (baseItem.order != null && candidate.order != null) return Number(baseItem.order) === Number(candidate.order);
      if (baseItem.name && candidate.name) return String(baseItem.name).toLowerCase() === String(candidate.name).toLowerCase();
      return false;
    }) || revision[index];
    if (!match || typeof match !== "object") return baseItem;
    return mergeBlueprintObjects(baseItem, match);
  });
}

function mergeBlueprintObjects(base: any, revision: any): any {
  if (!revision || typeof revision !== "object") return base;
  if (!base || typeof base !== "object") return revision;
  if (Array.isArray(base) || Array.isArray(revision)) {
    return mergeArrayByOrderOrName(Array.isArray(base) ? base : [], Array.isArray(revision) ? revision : []);
  }

  const merged: Record<string, any> = { ...base };
  for (const [key, value] of Object.entries(revision)) {
    if (value === undefined || value === null || value === "") continue;
    const baseValue = merged[key];
    if (Array.isArray(baseValue) || Array.isArray(value)) {
      merged[key] = mergeArrayByOrderOrName(Array.isArray(baseValue) ? baseValue : [], Array.isArray(value) ? value : []);
    } else if (baseValue && typeof baseValue === "object" && value && typeof value === "object") {
      merged[key] = mergeBlueprintObjects(baseValue, value);
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

function getReviewedBlueprint(blueprint: any, critique: any): any {
  return mergeBlueprintObjects(blueprint || {}, critique?.revisedBlueprintPatch || critique?.revisedBlueprint || {});
}

// ---------------------------------------------------------------------------
// WHOLE-STORY-FIRST PIPELINE (v11)
//
// Replaces the old "model emits chapters[] directly" approach. The story
// model writes ONE continuous narrative as flat paragraphs[]. A cheap
// support-model call then splits the prose into display chapters with titles
// at natural scene breaks. This stops the model from packing 5 mini-endings,
// preserves the red thread, and keeps targeted chapter repair as a fallback.
//
// Output of the writer (whole-story-draft):
//   { "title": string, "description": string, "paragraphs": string[] }
//
// Output of the splitter (story-splitter):
//   { "chapters": [ { "order": number, "title": string,
//                     "paragraphStartIndex": number,
//                     "paragraphEndIndex": number } ] }
// ---------------------------------------------------------------------------

function buildWholeStoryDraftPrompts(
  input: DevModeGenerationInput,
  chapterCount: number,
  blueprint: any,
  critique: any
): { systemPrompt: string; userPrompt: string } {
  const languageName = localizedLanguageName(input.config.language);
  const wordBounds = getStoryWordBounds(input.config);
  const totalBounds = getChapterLengthBounds(input.config);
  const maxSentenceChars = maxSentenceCharsForAge(input.config.ageGroup);
  const totalMinChars = totalBounds.min * chapterCount;
  const totalMaxChars = totalBounds.max * chapterCount;
  const revisedBlueprint = getReviewedBlueprint(blueprint, critique);
  const compactBlueprint = compactReviewedBlueprintForDraft(revisedBlueprint, chapterCount);
  const heroNames = (input.avatars || []).map((a) => a.name).filter(Boolean);
  const heroA = heroNames[0] || "Main character A";
  const heroB = heroNames[1] || "Main character B";

  const systemPrompt = qualitySystemPrompt(
    languageName,
    [
      "Whole-story draft schema (NO chapters here \u2014 a separate step splits the prose):",
      "{",
      '  "title": string,',
      '  "description": string,',
      '  "paragraphs": string[]   // ONE flat array; the entire story as continuous prose, in reading order',
      "}",
      "IMPORTANT: Do NOT output a chapters array. Do NOT insert chapter headings, scene breaks, dividers, or labels into the paragraphs.",
      "Each paragraph is one paragraph of story prose. The reader should be able to read the paragraphs straight through as ONE continuous narrative.",
    ].join("\n")
  );

  const userPrompt = [
    `WHOLE STORY DRAFT \u2014 write ONE continuous children's story in ${languageName}.`,
    "Do NOT split it into chapters. Do NOT write chapter headings, numbers, or scene labels.",
    "Internally use the blueprint's beats as private dramaturgy; on the page the prose flows as one arc.",
    "",
    "CORE WRITER CONTRACT (only the rules that matter \u2014 do not over-comply, write like a real children's-book author):",
    "1. Write one continuous story, not 5 mini-stories. Every paragraph must grow out of the previous one.",
    "2. Each repetition (refrain, prop, sound, rule) must shift in meaning. Never repeat for decoration.",
    "3. The MAIN avatars must spot the crucial clue and perform the decisive action. Helpers may complicate, pressure, or hint \u2014 they may NEVER explain the solution.",
    "4. The final action must come from a detail that was planted earlier in the story.",
    "5. The ending is an IMAGE, not a moral. No \"Sie lernten...\" / \"They learned...\" sentences.",
    "6. One clear magic/wonder rule. Test it on-page at least twice before the finale; the finale uses it.",
    "7. Somewhere in the middle, something becomes irreversible (object lost, voice gone, path closed, secret revealed) so the children can't simply turn back.",
    "",
    "STRUCTURAL ARC (use silently as dramaturgy, do NOT label these on the page):",
    "- Child wants something specific, quickly.",
    "- First wrong attempt -> visible consequence.",
    "- Helper or world complicates it; the problem grows.",
    "- Irreversible middle: a personal stake appears.",
    "- Children observe a pattern only they can see.",
    "- They make one small, concrete, emotional decision.",
    "- The world changes visibly in response.",
    "- Closing image: the new order, warm, concrete, slightly larger than the problem.",
    "",
    buildVoiceBibleBlock(input),
    "",
    buildWriterVoiceAnchorBlock(input),
    "",
    buildEmotionAndVoicePromptContext(input, chapterCount, { includeNoveltyBrief: false }),
    "",
    "SELECTED IDEA AND CAST:",
    buildSelectedIdeaPromptBlock(input),
    buildSelectedCastIntegrationContract(input),
    "",
    "LENGTH & RHYTHM:",
    `- Target ${wordBounds.targetMin}-${wordBounds.targetMax} words for the whole story (hard min ${wordBounds.min}, hard max ${wordBounds.max}).`,
    `- Roughly ${totalMinChars}-${totalMaxChars} characters of prose across the whole story.`,
    `- Output the prose as flat paragraphs (around ${chapterCount * 5}-${chapterCount * 7} paragraphs total for the whole story \u2014 the splitter will group them into ${chapterCount} chapters later).`,
    `- Each paragraph \u2264 380 characters. Split long beats into separate paragraphs instead of cramming.`,
    `- Every 4\u20136 paragraphs must contain a natural scene-turn (open question, new visible detail, decision, small surprise, comic aftershock, direction change). These turns are NOT chapter headings, but they must be strong enough that an editor could later cut a chapter right after them.`,
    `- No sentence may exceed ${maxSentenceChars} characters. Use child-readable beats.`,
    `- Dialogue 25\u201340% of the prose. Do NOT force a quota \u2014 every quoted line must carry action, relationship, humor, tension, or subtext. Never add filler chatter to reach a number.`,
    `- ${heroA} and ${heroB} must sound unmistakably different (rhythm, vocabulary, gestures, first reactions). A reader should often identify the speaker without tags.`,
    "",
    "BANNED:",
    "- chapter headings, chapter numbers, scene labels, dividers (\"---\", \"***\"), or recap sentences",
    "- mini-conclusions or moral closures inside the prose",
    "- formulaic catchphrase repetition (each character may use a signature line at MOST once in the whole story; max 2 formulaic feeling/memory openers total across all characters)",
    "- supporting / helper figures EXPLAINING the magic rule, the lesson, or the solution. Helpers may pressure, misinterpret, ask a sharp question, hand over a tool, or miss a clue \u2014 the MAIN avatars must perform the decisive insight and action.",
    "- the finale repeating the exact mechanism/payoff of an earlier chapter; the finale must escalate or transform what was tried before",
    "- multiple competing magic rules \u2014 keep ONE clear rule, and test it on-page at least twice before the finale",
    "- AI-tics: \"Not X. Not Y. Just Z.\" chains, narrator commentary, explained jokes",
    "",
    "COMPACT REVIEWED BLUEPRINT (use the beats privately as dramaturgy, do NOT echo them):",
    promptJson(compactBlueprint),
    "",
    "CRITIQUE TO RESOLVE:",
    promptJson(compactCritiqueForDraft(critique)),
    "",
    `FINAL REMINDER: output ONE JSON object with title, description, paragraphs[]. No chapters array. No headings in the prose. All story text in ${languageName}.`,
  ].filter(Boolean).join("\n");

  return { systemPrompt, userPrompt };
}

interface DevModeWholeStoryDraft {
  title: string;
  description: string;
  paragraphs: string[];
}

function parseWholeStoryDraft(content: string): DevModeWholeStoryDraft {
  let parsed: any;
  try {
    parsed = tryParseJson(content);
  } catch (err) {
    throw new Error(
      `Whole-story draft returned unparseable JSON: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Whole-story draft returned malformed JSON.");
  }
  const title = String(parsed.title || "").trim();
  const description = String(parsed.description || "").trim();
  if (!title) throw new Error("Whole-story draft missing title.");

  // Accept either paragraphs[] (preferred) or a single body/content string.
  let paragraphs: string[] = [];
  if (Array.isArray(parsed.paragraphs)) {
    paragraphs = parsed.paragraphs.map((p: any) => String(p || "").trim()).filter(Boolean);
  } else if (typeof parsed.body === "string") {
    paragraphs = splitParagraphs(parsed.body).map((p) => p.trim()).filter(Boolean);
  } else if (typeof parsed.content === "string") {
    paragraphs = splitParagraphs(parsed.content).map((p) => p.trim()).filter(Boolean);
  } else if (Array.isArray(parsed.chapters)) {
    // Defensive fallback: model ignored the schema and emitted chapters. Flatten.
    for (const ch of parsed.chapters) {
      const chParagraphs = Array.isArray(ch?.paragraphs)
        ? ch.paragraphs.map((p: any) => String(p || "").trim()).filter(Boolean)
        : splitParagraphs(String(ch?.content || "")).map((p) => p.trim()).filter(Boolean);
      paragraphs.push(...chParagraphs);
    }
  }

  // Strip any chapter heading lines the model snuck in.
  paragraphs = paragraphs
    .map((p) => p.replace(/^(?:kapitel|chapter)\s*\d+[.:\s\-\u2013\u2014]*/i, "").trim())
    .filter((p) => p.length > 0 && !/^(?:[-*_=]{3,}|kapitel\s*\d+|chapter\s*\d+)\s*$/i.test(p));

  if (paragraphs.length === 0) throw new Error("Whole-story draft produced no paragraphs.");
  return { title, description, paragraphs };
}

function buildStorySplitterPrompts(
  draft: DevModeWholeStoryDraft,
  chapterCount: number,
  languageName: string
): { systemPrompt: string; userPrompt: string } {
  const numbered = draft.paragraphs.map((p, idx) => `[${idx}] ${p}`).join("\n\n");
  const systemPrompt = [
    "You are a children's-book editor splitting a finished continuous story into display chapters.",
    "You do NOT rewrite prose. You decide chapter boundaries and write short, concrete chapter titles.",
    "Return JSON ONLY in this exact schema:",
    "{",
    '  "splitQuality": "strong" | "medium" | "weak",',
    '  "weakBoundaries": number[],   // 1-based chapter indices whose ENDING paragraph does NOT pull strongly into the next chapter (empty if all strong)',
    '  "chapters": [',
    '    { "order": number, "title": string, "paragraphStartIndex": number, "paragraphEndIndex": number }',
    "  ]",
    "}",
    "Indices refer to the numbered paragraphs in the user message. paragraphEndIndex is INCLUSIVE.",
    "Chapters must cover every paragraph exactly once, in order, with no overlaps and no gaps.",
    `Produce EXACTLY ${chapterCount} chapters.`,
  ].join("\n");

  const userPrompt = [
    `Split this finished children's story into exactly ${chapterCount} chapters. Language: ${languageName}.`,
    "",
    "Rules:",
    "- Set chapter boundaries ONLY at natural scene/beat changes (new goal, new place, new pressure, new decision, new visible detail).",
    "- PREFER cutting RIGHT AFTER a paragraph that ends with an open question, a new physical clue, a decision, or a surprise. AVOID cutting after a calm, closed, summarising paragraph.",
    "- Do NOT change the prose. Do NOT add summaries, recaps, or new sentences.",
    "- Chapters 1 to N-1 must NOT feel like they finish a mini-story; they must leave a concrete pull (a question, a missing piece, a decision in mid-air) into the next chapter.",
    "- Only the final chapter is allowed to close calmly.",
    "- Chapter titles: 2\u20136 words, concrete and image-based. NO moral. NO spoiler of the finale. NO generic titles like \"Die L\u00f6sung\" or \"Das Ende\".",
    "- A title should label the next image or turn of the scene, not the lesson.",
    `- Distribute paragraphs as evenly as you can WITHOUT killing a strong turn: the longest chapter\u2019s character count must be \u2264 1.6\u00d7 the shortest chapter\u2019s character count whenever a natural break allows it.`,
    "",
    "AFTER planning the boundaries, self-judge the result honestly:",
    `- splitQuality = \"strong\" only if every non-final chapter ends on a real pull AND the longest/shortest ratio is \u2264 1.6.`,
    "- splitQuality = \"medium\" if at most one boundary is soft.",
    "- splitQuality = \"weak\" if two or more non-final chapters end on closure, or the balance ratio is > 1.8.",
    "- List the 1-based chapter index of every non-final chapter whose ending pull is weak in weakBoundaries.",
    "",
    `TITLE OF STORY: ${draft.title}`,
    draft.description ? `STORY DESCRIPTION: ${draft.description}` : "",
    "",
    "PARAGRAPHS (numbered):",
    numbered,
    "",
    `Return JSON only. Exactly ${chapterCount} chapters covering paragraphs 0..${draft.paragraphs.length - 1} inclusive with no gaps.`,
  ].filter(Boolean).join("\n");

  return { systemPrompt, userPrompt };
}

function deterministicSplit(paragraphCount: number, chapterCount: number): Array<{ start: number; end: number }> {
  const chunks: Array<{ start: number; end: number }> = [];
  const base = Math.floor(paragraphCount / chapterCount);
  const rem = paragraphCount % chapterCount;
  let cursor = 0;
  for (let i = 0; i < chapterCount; i += 1) {
    const size = base + (i < rem ? 1 : 0);
    const start = cursor;
    const end = Math.min(paragraphCount - 1, cursor + Math.max(1, size) - 1);
    chunks.push({ start, end });
    cursor = end + 1;
  }
  // Guarantee last chunk reaches the end.
  if (chunks.length > 0) chunks[chunks.length - 1].end = paragraphCount - 1;
  return chunks;
}

// Computes the balance ratio (max chunk chars / min chunk chars) for a plan
// against the raw paragraph text. A ratio of 1.0 means perfectly even, larger
// values mean increasingly unbalanced chapters.
function computePlanBalanceRatio(
  draft: DevModeWholeStoryDraft,
  plan: Array<{ start: number; end: number }>
): number {
  const chars = plan.map((slice) =>
    draft.paragraphs.slice(slice.start, slice.end + 1).reduce((sum, p) => sum + p.length, 0)
  );
  const min = Math.min(...chars);
  const max = Math.max(...chars);
  if (min <= 0) return Number.POSITIVE_INFINITY;
  return max / min;
}

// Deterministic balanced split that minimises char-count variance across
// chapters. Used when the LLM splitter returns an unbalanced plan (ratio > 1.6)
// and we cannot trust the model boundaries.
function balancedDeterministicSplit(
  draft: DevModeWholeStoryDraft,
  chapterCount: number
): Array<{ start: number; end: number }> {
  const paragraphCount = draft.paragraphs.length;
  if (chapterCount <= 1 || paragraphCount <= chapterCount) {
    return deterministicSplit(paragraphCount, chapterCount);
  }
  const totalChars = draft.paragraphs.reduce((sum, p) => sum + p.length, 0);
  const targetPerChapter = totalChars / chapterCount;
  const plan: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  let accumulated = 0;
  for (let i = 0; i < chapterCount - 1; i += 1) {
    const remainingChapters = chapterCount - i;
    const maxAdvance = paragraphCount - cursor - (remainingChapters - 1);
    let chunkChars = 0;
    let end = cursor;
    for (let j = 0; j < maxAdvance; j += 1) {
      chunkChars += draft.paragraphs[cursor + j].length;
      end = cursor + j;
      const projectedTotal = accumulated + chunkChars;
      const projectedTarget = targetPerChapter * (i + 1);
      if (projectedTotal >= projectedTarget && j >= 0) break;
    }
    plan.push({ start: cursor, end });
    accumulated += chunkChars;
    cursor = end + 1;
  }
  plan.push({ start: cursor, end: paragraphCount - 1 });
  return plan;
}

function applySplitterPlanToDraft(
  draft: DevModeWholeStoryDraft,
  chapterCount: number,
  splitterParsed: any
): DevModeRawStory & { splitQuality?: "strong" | "medium" | "weak"; balanceRatio?: number } {
  const paragraphCount = draft.paragraphs.length;
  let plan: Array<{ start: number; end: number; title?: string }> = [];

  const rawChapters = Array.isArray(splitterParsed?.chapters) ? splitterParsed.chapters : [];
  if (rawChapters.length === chapterCount) {
    const candidate: Array<{ start: number; end: number; title?: string }> = [];
    let ok = true;
    let expectedStart = 0;
    for (const ch of rawChapters) {
      const start = Number(ch?.paragraphStartIndex ?? ch?.startIndex ?? ch?.start);
      const end = Number(ch?.paragraphEndIndex ?? ch?.endIndex ?? ch?.end);
      if (!Number.isInteger(start) || !Number.isInteger(end) || start !== expectedStart || end < start || end >= paragraphCount) {
        ok = false;
        break;
      }
      candidate.push({ start, end, title: String(ch?.title || "").trim() || undefined });
      expectedStart = end + 1;
    }
    if (ok && expectedStart === paragraphCount) {
      plan = candidate;
    }
  }

  if (plan.length === 0) {
    console.warn("[dev-mode-generation] Splitter plan invalid; using deterministic balanced split", {
      paragraphCount,
      chapterCount,
      received: rawChapters.length,
    });
    plan = balancedDeterministicSplit(draft, chapterCount).map((p) => ({ ...p }));
    // Best-effort: re-use any usable titles in order.
    rawChapters.forEach((ch: any, idx: number) => {
      const t = String(ch?.title || "").trim();
      if (t && plan[idx]) plan[idx].title = t;
    });
  }

  // Enforce balance ratio: if LLM plan is too lopsided, fall back to a balanced
  // deterministic split (keeping any usable titles).
  const llmRatio = computePlanBalanceRatio(draft, plan);
  if (llmRatio > 1.6) {
    console.warn("[dev-mode-generation] Splitter plan unbalanced; using balanced deterministic split", {
      llmRatio: Number(llmRatio.toFixed(2)),
      threshold: 1.6,
    });
    const balanced = balancedDeterministicSplit(draft, chapterCount);
    plan = balanced.map((slice, idx) => ({ ...slice, title: plan[idx]?.title }));
  }

  const balanceRatio = computePlanBalanceRatio(draft, plan);
  let splitQuality: "strong" | "medium" | "weak" | undefined;
  const reportedQuality = String(splitterParsed?.splitQuality || "").toLowerCase();
  if (reportedQuality === "strong" || reportedQuality === "medium" || reportedQuality === "weak") {
    splitQuality = reportedQuality as "strong" | "medium" | "weak";
  }
  // Downgrade reported quality if balance is bad.
  if (balanceRatio > 1.8) splitQuality = "weak";
  else if (splitQuality === "strong" && balanceRatio > 1.6) splitQuality = "medium";

  const chapters: DevModeChapter[] = plan.map((slice, idx) => {
    const paragraphs = draft.paragraphs.slice(slice.start, slice.end + 1);
    const content = paragraphsToContent(paragraphs);
    const title = slice.title && slice.title.length > 0 ? slice.title : `Kapitel ${idx + 1}`;
    return { title, content, order: idx + 1 };
  });

  return {
    title: draft.title,
    description: draft.description,
    chapters,
    splitQuality,
    balanceRatio,
  };
}

function buildStoryDraftPrompts(
  input: DevModeGenerationInput,
  chapterCount: number,
  blueprint: any,
  critique: any
): { systemPrompt: string; userPrompt: string } {
  const languageName = localizedLanguageName(input.config.language);
  const bounds = getChapterLengthBounds(input.config);
  const draftTargetMaxChars = getChapterDraftTargetMaxChars(input.config);
  const paragraphBudget = getParagraphBudgetGuidance(input.config);
  const paragraphBounds = getParagraphBounds(input.config);
  const maxSentenceChars = maxSentenceCharsForAge(input.config.ageGroup);
  const dialogueLineTarget = input.config.length === "short"
    ? Math.max(5, DEV_MODE_CHAPTER_DIALOG_LINE_TARGET - 4)
    : input.config.length === "medium"
      ? Math.max(7, DEV_MODE_CHAPTER_DIALOG_LINE_TARGET - 2)
      : DEV_MODE_CHAPTER_DIALOG_LINE_TARGET;
  const totalDraftTargetMaxChars = draftTargetMaxChars * chapterCount;
  const systemPrompt = qualitySystemPrompt(
    languageName,
    [
      "Final story schema:",
      "{",
      '  "title": string,',
      '  "description": string,',
      '  "chapters": [',
      '    { "order": number, "title": string, "paragraphs": string[] }',
      "  ]",
      "}",
      "IMPORTANT: Use paragraphs[] for chapter prose. Each array item is exactly one paragraph. Do not output content unless you cannot represent paragraphs[]; the server prefers paragraphs[].",
    ].join("\n")
  );
  const revisedBlueprint = getReviewedBlueprint(blueprint, critique);
  const compactBlueprint = compactReviewedBlueprintForDraft(revisedBlueprint, chapterCount);
  const heroNames = (input.avatars || []).map((a) => a.name).filter(Boolean);
  const heroA = heroNames[0] || "Main character A";
  const heroB = heroNames[1] || "Main character B";
  const userPrompt = [
    `CALL 3: Now write the final story as real scenes, not a summary. Output the title, description, and chapter content in ${languageName}.`,
    "This is the ONLY call allowed to write the actual story prose. Use the compact reviewed blueprint, critique, and voice rules directly in the first draft.",
    "Actively use the blueprint's central rule, emotional engine, payoff object, antagonist ladder, humor callback, plants/payoffs, scene ownership, reader magnet, and every chapter plan. Do not replace the selected premise.",
    input.selectedIdea?.selectedSupportingCast?.length
      ? `Selected pool-cast figures ${input.selectedIdea.selectedSupportingCast.join(", ")} must appear on-page with meaningful action. Do not demote them to decorative cameos.`
      : null,
    buildSelectedCastIntegrationContract(input),
    "",
    "SILENT PRE-DRAFT CHECKLIST (do not output):",
    buildSilentPreWriteSelfReviewContract(input, chapterCount, "draft"),
    `- Give ${heroA} and ${heroB} different speaking rhythms, gestures, and first reactions in every scene; a reader should often identify the speaker without tags.`,
    "- Plant 3 small concrete details in chapters 1-2; the finale must use at least one of them.",
    "- Each chapter segment follows inherited pressure -> conflict -> turn/yes-but -> pull. Do not make chapters self-contained episodes.",
    "- Every chapter has a child-giggle moment from character action, misunderstanding, prop, or wordplay.",
    "- Keep dialogue double-duty: every quoted line must move action, relationship, tension, subtext, or humor.",
    "- TITLE-PROMISE CONTRACT: the title's central image/word MUST surface and be redeemed in the prose (not only as decoration). Plant it early, deliver it in the climax.",
    "- AGENCY CONTRACT: the main avatars must find the crucial clue, make the decisive choice, and perform the final action. Helpers can pressure or assist, never solve by advice.",
    "- CAST BUDGET: if pool characters are selected, give each one compact job. Do not let adult/helper figures arrive one after another as repair modules.",
    "",
    buildVoiceBibleBlock(input),
    "",
    buildWriterVoiceAnchorBlock(input),
    "",
    buildEmotionAndVoicePromptContext(input, chapterCount, { includeNoveltyBrief: false }),
    "",
    "DIALOGUE-FIRST SCENE PLANNING (MANDATORY, SILENT):",
    "Before writing each chapter segment, silently plan the inherited pressure, conflict, wrong move/turn, and at least 3 concrete speaker exchanges. Do not output this plan; use it so dialogue drives the continuous story instead of decorating narration.",
    "Every chapter segment needs at least one line where a character decides, refuses, misunderstands, jokes, or changes direction.",
    `Dialogue overshoot is intentional: aim for ${DEV_MODE_PROMPT_DIALOG_PCT}% dialogue because drafts usually measure lower after server diagnostics. Replace narrator explanation with action-bearing speaker turns instead of adding filler chatter.`,
    `Chapter shape contract: ${paragraphBudget.targetCount} compact paragraphs; at least 3 paragraphs contain direct speech; at least 3 short speaker exchanges; no paragraph may become an explanation block.`,
    "",
    "DRAMATURGY RULES:",
    `- Exactly ${chapterCount} chapters.`,
    `- ${chapterLengthGuidance(input.config)}`,
    `- ${storyWordBudgetGuidance(input.config, chapterCount)}`,
    `- Aim each chapter for ${bounds.min}-${draftTargetMaxChars} characters. Do not write to the upper edge; the repair gate fails over ${bounds.max}.`,
    `- Whole-story prose target: about ${bounds.min * chapterCount}-${totalDraftTargetMaxChars} characters across all chapters. If the story wants more room, cut scope instead of expanding prose.`,
    `- Use ${paragraphBudget.targetCount} compact paragraphs per chapter. Keep each paragraph around ${paragraphBudget.maxChars} characters; if a paragraph grows longer, split the beat or cut explanation.`,
    `- No sentence may exceed ${maxSentenceChars} characters; ages ${input.config.ageGroup} need short cause/effect beats.`,
    input.config.length === "short"
      ? "- SHORT MODE IS BINDING: one central beat per chapter, no scenic padding, no extra explanatory paragraph after the turn. If a detail is pretty but not causal, cut it."
      : input.config.length === "medium"
        ? "- MEDIUM MODE IS BINDING: compact chapter-book pacing, not long-form prose. Prefer one strong image over two decorative images."
        : null,
    "- Models often undercount prose length; write visibly shorter than the upper edge so the server's real character count still passes.",
    `- ${paragraphBounds.min}–${paragraphBounds.max} paragraphs per chapter. Output them as a paragraphs[] array. This is a hard gate, not a suggestion.`,
    `- Overall dialogue share: writer target ${DEV_MODE_PROMPT_DIALOG_PCT}%, soft diagnostic target ${DEV_MODE_TARGET_DIALOG_PCT}%, hard floor ${DEV_MODE_MIN_DIALOG_PCT}%. Each chapter at least ${DEV_MODE_MIN_CHAPTER_DIALOG_PCT}% dialogue.`,
    `- Every chapter should include about ${dialogueLineTarget}+ short dialogue lines and at least ${DEV_MODE_CHAPTER_SPEAKER_TURN_TARGET} speaker turns. In short mode, use short exchanges, not extra paragraphs.`,
    "- Chapter 1: strong hook in the first 2 sentences, concrete problem, different reactions from the main characters, open ending.",
    "- Chapter 2: world becomes concrete, trail/encounter, side or antagonist character shows a quirk, problem grows.",
    "- Chapter 3: a wrong attempt or wrong choice coming from character, real consequence, no lucky accident saves them.",
    "- Chapter 4: understand the deeper rule, combine different strengths, an emotional moment, prepare the finale.",
    "- Chapter 5: concrete action, prepared solution, emotional aftertaste, strong closing image, no explained moral.",
    "- Key moments must land as visible scenes, not summary labels. At least one moment must make the old situation impossible to return to.",
    "- Causality must be therefore/but logic: each chapter segment changes the problem in a way that forces the next chapter.",
    "- Do not duplicate the finale across chapters 4 and 5: chapter 4 reaches the crisis/realization; chapter 5 performs the final choice and payoff once.",
    "- A side/helper character may reveal a clue, but the children must perform the decisive action themselves.",
    "- If an adult/helper explains what the children should learn, rewrite that beat as child action, failed attempt, or a concrete prop payoff.",
    "- Every main character must make at least one mini-decision that wouldn't happen without them.",
    "- The antagonist must show a recognizable behavior across at least three chapters and gain a new place at the end.",
    "- HUMOR (MANDATORY): EVERY chapter needs at least one humorous moment coming from character or situation — no narrator jokes. Good kinds: absurd comparisons, small mishaps, a dry remark from a side character, a wordplay, a loving teasing moment between the main characters. No 'explained joke', no adult irony.",
    "",
    "READ-ON / PULL RULES:",
    "- Chapter 1 must show a concrete, memorable problem in the first 2 sentences.",
    "- Every chapter ends on a pull: open question, looming consequence, new rule, unexpected gesture, or a funny moment that lingers.",
    "- If readerMagnet has a refrainLine or activeUseByChapter, each chapter must use it as action: clue, test, choice, obstacle, joke, or payoff. A repeated sentence alone is not enough.",
    "- Make the blueprint's readerMagnet visible on the page: refrain/leitmotif/callback must not stay theoretical — it must happen in the prose.",
    "- Plant at least 3 small setups that get a payoff later. Kids should be able to say in retrospect: ah, that's why that mattered.",
    "- The finale must be closed, but a small friendly spark may show this world holds more stories.",
    "- No cheap cliffhangers, no 'to be continued'.",
    "",
    "EMOTIONAL PAYOFF CONTRACT:",
    "- Use payoffEngine. If a personal object, comfort, habit, or sound matters, make its value visible before the finale.",
    "- The final solution must cost a character something small but concrete: giving up control, sharing a cherished sound/object, waiting instead of rushing, or opening something they wanted to keep safe.",
    "- The payoff must come from a planted detail, not a new solution introduced in the final chapter.",
    "",
    "ANTAGONIST CHANGE LADDER:",
    "- Use antagonistChangeLadder. The antagonist must not flip from threat to friend in one beat.",
    "- Show at least: wanting to possess, confusion when sharing works, one small pull toward old behavior, active decision, and new role/task.",
    "",
    "HUMOR CALLBACK CONTRACT:",
    "- Use humorCallbackPlan. Build one child-friendly recurring gag/prop/action that changes slightly each chapter and pays off near the end.",
    "- Humor must be playable aloud for ages 6-8: concrete, quick, character-driven.",
    "",
    "VOICE / READ-ALOUD RULES:",
    "- Make voices distinguishable. Use each main character's interpreted Story trait profile from the context block to decide pace, lexicon, risk tolerance, mistakes, and growth.",
    "- Dialogue must do at least two things at once: action, relationship, subtext, or humor.",
    "- Do not treat dialogue as decoration. Use dialogue for decisions, reversals, jokes, danger, and relationship shifts.",
    "- Show emotion, don't name it.",
    "- Strengthen repeatable, child-quotable details.",
    "- Make the antagonist human and funny-uncanny, do not convert them quickly.",
    "- Let the ending resonate emotionally and give the antagonist a new place.",
    "- Avoid AI patterns: no 'Not X. Not Y. Just Z.' chains.",
    "",
    "COMPACT REVIEWED BLUEPRINT INCLUDING EMOTIONAL ENGINE:",
    promptJson(compactBlueprint),
    "",
    "CRITIQUE YOU MUST RESOLVE:",
    promptJson(compactCritiqueForDraft(critique)),
    "",
    `FINAL REMINDER: title, description and ALL chapter content must be written in ${languageName}. The instructions above were in English for clarity; do NOT echo any English into the story.`,
  ].join("\n");
  return { systemPrompt, userPrompt };
}

function compactReviewedBlueprintForDraft(reviewedBlueprint: any, chapterCount: number): any {
  const chapterPlan = Array.isArray(reviewedBlueprint?.chapterPlan)
    ? reviewedBlueprint.chapterPlan
        .slice(0, chapterCount)
        .map((plan: any, index: number) => ({
          order: Number(plan?.order || index + 1),
          title: plan?.title,
          goal: compactExcerpt(plan?.goal || "", 160),
          hook: compactExcerpt(plan?.hook || "", 180),
          sceneBeats: Array.isArray(plan?.sceneBeats)
            ? plan.sceneBeats.slice(0, 5).map((beat: any) => compactExcerpt(beat, 140))
            : [],
          obstacle: compactExcerpt(plan?.obstacle || "", 160),
          conflict: compactExcerpt(plan?.conflict || "", 180),
          wrongAction: compactExcerpt(plan?.wrongAction || "", 160),
          turn: compactExcerpt(plan?.turn || "", 180),
          irreversibleChange: compactExcerpt(plan?.irreversibleChange || "", 180),
          chapterEndHook: compactExcerpt(plan?.chapterEndHook || plan?.endingTension || "", 180),
          humorMoment: compactExcerpt(plan?.humorMoment || "", 160),
          emotionalBeat: compactExcerpt(plan?.emotionalBeat || "", 160),
          characterActions: plan?.characterActions,
          preparedDetail: compactExcerpt(plan?.preparedDetail || "", 160),
          laterPayoff: compactExcerpt(plan?.laterPayoff || "", 160),
          dialogueFunction: compactExcerpt(plan?.dialogueFunction || "", 160),
          callbackToUse: compactExcerpt(plan?.callbackToUse || "", 140),
        }))
    : [];

  return {
    premise: compactExcerpt(reviewedBlueprint?.premise || "", 320),
    storySpine: reviewedBlueprint?.storySpine,
    noveltySignature: reviewedBlueprint?.noveltySignature,
    keyMoments: Array.isArray(reviewedBlueprint?.keyMoments)
      ? reviewedBlueprint.keyMoments.slice(0, 8)
      : undefined,
    causalChain: Array.isArray(reviewedBlueprint?.causalChain)
      ? reviewedBlueprint.causalChain.slice(0, Math.max(5, chapterCount))
      : undefined,
    coreMagicRule: compactExcerpt(reviewedBlueprint?.coreMagicRule || "", 260),
    emotionalEngine: reviewedBlueprint?.emotionalEngine,
    readerMagnet: reviewedBlueprint?.readerMagnet,
    payoffEngine: reviewedBlueprint?.payoffEngine,
    antagonistChangeLadder: reviewedBlueprint?.antagonistChangeLadder,
    humorCallbackPlan: reviewedBlueprint?.humorCallbackPlan,
    characterArcs: Array.isArray(reviewedBlueprint?.characterArcs)
      ? reviewedBlueprint.characterArcs.map((arc: any) => ({
          name: arc?.name,
          startingFriction: compactExcerpt(arc?.startingFriction || "", 160),
          strength: compactExcerpt(arc?.strength || "", 160),
          finalContribution: compactExcerpt(arc?.finalContribution || "", 160),
        }))
      : [],
    supportingCastUse: Array.isArray(reviewedBlueprint?.supportingCastUse)
      ? reviewedBlueprint.supportingCastUse.map((cast: any) => ({
          name: cast?.name,
          storyFunction: compactExcerpt(cast?.storyFunction || "", 160),
          mustDo: compactExcerpt(cast?.mustDo || "", 160),
        }))
      : [],
    plantsAndPayoffs: Array.isArray(reviewedBlueprint?.plantsAndPayoffs)
      ? reviewedBlueprint.plantsAndPayoffs.slice(0, 8).map((item: any) => ({
          plant: compactExcerpt(item?.plant || "", 150),
          payoff: compactExcerpt(item?.payoff || "", 150),
        }))
      : [],
    chapterPlan,
  };
}

function buildCompactStoryDraftPrompts(
  input: DevModeGenerationInput,
  chapterCount: number,
  blueprint: any,
  critique: any,
  reason?: string
): { systemPrompt: string; userPrompt: string } {
  const languageName = localizedLanguageName(input.config.language);
  const code = languageCodeFromName(languageName);
  const bounds = getChapterLengthBounds(input.config);
  const targetMaxChars = getChapterDraftTargetMaxChars(input.config);
  const paragraphBudget = getParagraphBudgetGuidance(input.config);
  const paragraphBounds = getParagraphBounds(input.config);
  const maxSentenceChars = maxSentenceCharsForAge(input.config.ageGroup);
  const reviewedBlueprint = getReviewedBlueprint(blueprint, critique);
  const compactBlueprint = compactReviewedBlueprintForDraft(reviewedBlueprint, chapterCount);

  const systemPrompt = [
    "You are a children's-book author. Return compact, valid JSON only.",
    `OUTPUT LANGUAGE: title, description, chapter titles and all chapter paragraphs must be in ${languageName}.`,
    targetLanguageStyleAnchor(code),
    "OpenRouter compatibility rules:",
    "- Do NOT output analysis, self-reflection, markdown, code fences, or any text before/after JSON.",
    "- Do NOT think step-by-step in the visible answer. Spend the visible output budget on the JSON story.",
    "- Start with { and end with }. Keep keys exactly as requested.",
    "- Use paragraphs[] arrays; each item is one paragraph.",
    code === "en"
      ? 'Dialogue may use standard English quotation marks, escaped correctly inside JSON.'
      : "Dialogue inside story text must use typographic quotation marks like „…“ or «…», not bare ASCII quotes.",
    "Schema:",
    "{",
    '  "title": string,',
    '  "description": string,',
    '  "chapters": [ { "order": number, "title": string, "paragraphs": string[] } ]',
    "}",
  ].join("\n");

  const userPrompt = [
    reason
      ? `RECOVERY / COMPATIBILITY DRAFT: The previous full story-draft failed or was truncated (${reason}). Write the complete story now with a smaller, stricter output.`
      : "COMPATIBILITY DRAFT: This OpenRouter model is sensitive to long JSON/story prompts. Write the complete story with a smaller, stricter output.",
    `Exactly ${chapterCount} chapters. Output ONLY JSON.`,
    "No visible planning. No preface. No apology. No validator comments.",
    buildSilentPreWriteSelfReviewContract(input, chapterCount, "compact-draft"),
    "- TITLE-PROMISE CONTRACT: the title's central image/word MUST surface and be redeemed in the prose.",
    "- AGENCY CONTRACT: main avatars notice the key clue and perform the decisive action; helpers never solve by explaining.",
    "",
    buildVoiceBibleBlock(input),
    "",
    buildWriterVoiceAnchorBlock(input),
    "",
    buildDevStoryContext(input, chapterCount, { includeNoveltyBrief: false }),
    buildWholeStoryContinuityContract(chapterCount),
    "",
    "HARD OUTPUT SHAPE:",
    `- Each chapter: ${bounds.min}-${targetMaxChars} characters of prose; do not exceed ${bounds.max}.`,
    `- ${storyWordBudgetGuidance(input.config, chapterCount)}`,
    input.config.length === "short"
      ? "- SHORT MODE: write the short version, not a compressed long story. One scene turn per chapter. Cut setup explanations."
      : input.config.length === "medium"
        ? "- MEDIUM MODE: compact and brisk. Do not drift into long chapter-book pacing."
        : null,
    `- ${paragraphBounds.min}-${paragraphBounds.max} paragraphs per chapter; aim for ${paragraphBudget.targetCount} compact paragraphs.`,
    `- Keep each paragraph around ${paragraphBudget.maxChars} characters. If unsure, cut rather than explain.`,
    `- No sentence may exceed ${maxSentenceChars} characters; split long clauses into child-readable beats.`,
    `- Overall dialogue: writer target ${DEV_MODE_PROMPT_DIALOG_PCT}%, soft diagnostic target ${DEV_MODE_TARGET_DIALOG_PCT}%, hard floor ${DEV_MODE_MIN_DIALOG_PCT}%. Each chapter at least ${DEV_MODE_MIN_CHAPTER_DIALOG_PCT}%.`,
    `- Use at least ${DEV_MODE_CHAPTER_SPEAKER_TURN_TARGET} speaker turns per chapter when natural.`,
    "- Keep sentences child-readable for ages 6-8: concrete, warm, funny, sensory.",
    "- Every chapter segment must inherit pressure, hit an obstacle, change the problem, and pull into the next segment.",
    "- Recurring refrain/motif must do plot work in every chapter; never repeat it as decoration only.",
    "- Every chapter needs at least one child-giggle moment from action, misunderstanding, prop, or character voice.",
    "- Finale must use planted details; no moral-summary ending like 'Sie lernten...'.",
    "- Keep supporting cast lean; one vivid helper is stronger than a parade of explainers.",
    "",
    "COMPACT REVIEWED BLUEPRINT TO FOLLOW:",
    promptJson(compactBlueprint),
    "",
    "CRITIQUE POINTS TO RESOLVE:",
    promptJson(compactCritiqueForDraft(critique)),
    "",
    `FINAL REMINDER: all story text must be in ${languageName}; return one JSON object only.`,
  ].join("\n");

  return { systemPrompt, userPrompt };
}

function buildStoryPolishPrompts(
  input: DevModeGenerationInput,
  chapterCount: number,
  story: DevModeRawStory,
  diagnostics: DevModeStoryDiagnostics,
  blueprint: any,
  critique: any
): { systemPrompt: string; userPrompt: string } {
  const languageName = localizedLanguageName(input.config.language);
  const bounds = getChapterLengthBounds(input.config);
  const targetMaxChars = getChapterRepairTargetMaxChars(input.config);
  const paragraphBudget = getParagraphBudgetGuidance(input.config);
  const paragraphBounds = getParagraphBounds(input.config);
  const maxSentenceChars = maxSentenceCharsForAge(input.config.ageGroup);
  const totalRepairTargetMaxChars = targetMaxChars * chapterCount;
  const overlongChapterCount = diagnostics.chapterDiagnostics.filter((chapter) => chapter.chars > bounds.max).length;
  const broadCompressionMode = overlongChapterCount >= Math.min(3, chapterCount) || diagnostics.dialogPct < DEV_MODE_MIN_DIALOG_PCT;
  const systemPrompt = qualitySystemPrompt(
    languageName,
    [
      "Final story schema:",
      "{",
      '  "title": string,',
      '  "description": string,',
      '  "chapters": [',
      '    { "order": number, "title": string, "paragraphs": string[] }',
      "  ]",
      "}",
      "IMPORTANT: Use paragraphs[] for chapter prose. Each array item is exactly one paragraph.",
    ].join("\n")
  );
  const reviewedBlueprint = getReviewedBlueprint(blueprint, critique);
  const compactBlueprint = compactReviewedBlueprintForDraft(reviewedBlueprint, chapterCount);

  const userPrompt = [
    `CALL 3B: STRICT GATE REPAIR + CHILDREN'S BOOK POLISH. The repaired prose must stay in ${languageName}.`,
    "You repair an existing children's story. Do not invent a different plot, but you MUST satisfy all hard gates below.",
    "If local diagnostics and your literary preference conflict, local diagnostics win. This is a mechanical repair pass first, a style polish second.",
    broadCompressionMode
      ? "BROAD COMPRESSION MODE: this is not line editing. Rewrite every chapter compactly from the current story map; each overlong chapter must become visibly shorter before any stylistic addition is allowed."
      : null,
    "",
    buildLeanRepairPromptContext(input, chapterCount),
    buildSelectedCastIntegrationContract(input, true),
    buildSilentPreWriteSelfReviewContract(input, chapterCount, "polish"),
    buildVoiceBibleBlock(input),
    buildWriterVoiceAnchorBlock(input),
    buildReleaseCraftContract(input),
    buildWholeStoryContinuityContract(chapterCount),
    "",
    "HARD GATES:",
    `- Exactly ${chapterCount} chapters.`,
    `- Each chapter must stay within ${bounds.min}-${bounds.max} characters of target-language prose.`,
    `- Aim each chapter for ${bounds.min}-${targetMaxChars} characters so the server count has margin.`,
    `- ${storyWordBudgetGuidance(input.config, chapterCount)}`,
    `- Whole repaired story target: about ${bounds.min * chapterCount}-${totalRepairTargetMaxChars} characters across all chapters; current story has ${diagnostics.totalChars}.`,
    `- Each chapter must have ${paragraphBounds.min}-${paragraphBounds.max} paragraphs. If there are too many paragraphs, cut or merge them.`,
    `- Aim for ${paragraphBudget.targetCount} compact paragraphs; keep each paragraph around ${paragraphBudget.maxChars} characters.`,
    `- No sentence may exceed ${maxSentenceChars} characters; split long clauses into child-readable beats.`,
    input.config.length === "short"
      ? "- SHORT REPAIR: cut 25-40% before polishing. Keep only hook, conflict, turn, and pull."
      : input.config.length === "medium"
        ? "- MEDIUM REPAIR: cut decorative second images and repeated reactions before adding any line."
        : null,
    `- Overall dialogue share must be at least ${DEV_MODE_MIN_DIALOG_PCT}%; repair toward ${DEV_MODE_PROMPT_DIALOG_PCT}% so the measured result safely clears the floor.`,
    `- Every chapter must have at least ${DEV_MODE_MIN_CHAPTER_DIALOG_PCT}% dialogue.`,
    `- Target market-quality score: ${DEV_MODE_TARGET_MARKET_QUALITY_SCORE}/10; anything below ${DEV_MODE_MIN_MARKET_QUALITY_SCORE}/10 needs another concrete fix, not score inflation.`,
    "- No new main figures, no new subplot, no explained moral, no summary sentence at chapter endings.",
    "- JSON must be valid and match the schema exactly.",
    "",
    "REPAIR METHOD:",
    broadCompressionMode
      ? "- First reduce scope and sentence count. Keep hook, conflict, turn, payoff. Delete decorative second images, repeated reactions, and recap sentences even if they sound nice."
      : null,
    "- If a chapter is too long: cut explanatory narration first, not the core scene.",
    "- If a chapter has too many paragraphs: combine adjacent beats into fewer paragraphs.",
    "- If dialogue is low: convert explanation into short character-specific dialogue that carries action, relationship, humor, or tension.",
    "- Do NOT add filler chatter. Every dialogue line must change action, relationship, tension, or comic timing.",
    "- Keep the same title idea, central conflict, recurring motif, and closing image.",
    "- Strengthen chapter endings with concrete danger, decision, question, new rule, or funny aftershock.",
    "- Preserve child agency: replace helper/adult explanations with child noticing, child choice, and a concrete action.",
    "- If the ending sounds like a lesson sentence, trade it for an image, joke, or small unfinished motion from the story world.",
    "",
    "DIALOGUE VOICE CONTRACT:",
    "- Use the named VOICE BIBLE above. Do not force generic 'careful/lively/trickster/whispering' templates if they do not match the actual characters.",
    "- Each quoted line needs at least two jobs: action, relationship, tension, subtext, or humor.",
    "- If two main avatars could swap a line without anyone noticing, rewrite the line using their age, body detail, memory habit, question style, or visible gesture.",
    "",
    "PAYOFF CONTRACT:",
    "- Preserve prepared payoffs from the blueprint. The finale must come from planted details, not a new solution.",
    "- If a personal object is used in the solution, make the character choose to give it up consciously, not by accident.",
    "- The antagonist gets a new way to exist or a task, not instant friendship as a moral shortcut.",
    "- The wonder rule must be tested on-page at least twice before the finale and must matter in the final action.",
    "- The finale must NOT repeat the same mechanism/payoff as an earlier chapter. If chapter N-1 already paid off the rule the same way, escalate, transform, or invert it for the finale (new cost, new audience, new object, new emotional weight).",
    "- Supporting/helper figures may pressure, misinterpret, ask, or hand over an object \\u2014 they must NOT explain the magic rule or the lesson. The MAIN avatars must spot the crucial clue and perform the decisive action on-page.",
    "- Each character may use a signature catchphrase / formulaic opener at MOST ONCE in the whole story. Across all characters, no more than 2 such formulaic openers total. Replace extra ones with body language, action, or a fresh concrete line.",
    "",
    "LOCAL DIAGNOSTICS:",
    promptJson(compactDiagnosticsForPrompt(diagnostics)),
    "",
    "COMPACT REVIEWED BLUEPRINT TO PRESERVE:",
    promptJson(compactBlueprint),
    "",
    "CRITIQUE FROM DRAMATURGY CHECK:",
    promptJson(compactCritiqueForDraft(critique)),
    "",
    "CURRENT STORY TO POLISH:",
    promptJson(story),
    "",
    `FINAL REMINDER: title, description and ALL chapter content must remain in ${languageName}.`,
  ].join("\n");
  return { systemPrompt, userPrompt };
}

// --- Line-Level Punchup ---------------------------------------------------
// Replaces the full-story polish pass with a surgical one: the model returns
// only the 5-8 weakest lines + stronger replacements. The server applies
// exact-string-replace per chapter and falls back to the original story if
// deterministic diagnostics get worse.
//
// Rationale: the previous full-story polish pass routinely flattened iconic
// similes ("als müsse sie stillstehen wie ein Zinnsoldat" -> deleted) while
// chasing dialog%/length gates. Surgical punchup preserves the draft's
// strongest writing AND still upgrades weak lines.

interface LinePunchupReplacement {
  chapterOrder: number;
  find: string;
  replaceWith: string;
  reason?: string;
}

function buildLinePunchupPrompts(
  input: DevModeGenerationInput,
  chapterCount: number,
  story: DevModeRawStory,
  diagnostics: DevModeStoryDiagnostics,
  blueprint: any,
  critique: any
): { systemPrompt: string; userPrompt: string } {
  const languageName = localizedLanguageName(input.config.language);
  const reviewedBlueprint = getReviewedBlueprint(blueprint, critique);
  const compactBlueprint = compactReviewedBlueprintForDraft(reviewedBlueprint, chapterCount);

  const systemPrompt = qualitySystemPrompt(
    languageName,
    [
      "Line-punchup schema:",
      "{",
      '  "lineReplacements": [',
      '    {',
      '      "chapterOrder": number,',
      '      "find": string,',
      '      "replaceWith": string,',
      '      "reason": string',
      "    }",
      "  ],",
      '  "punchupNotes": string[]',
      "}",
      "IMPORTANT: 'find' must be an EXACT substring of the chapter's prose (one full sentence, dialogue line, or short paragraph excerpt). The server runs literal string.replace on it.",
    ].join("\n")
  );

  const heroNames = (input.avatars || []).map((a) => a.name).filter(Boolean);

  const userPrompt = [
    `CALL 3C: SURGICAL LINE-LEVEL PUNCHUP. Output language: ${languageName}.`,
    "Do NOT rewrite the story. Do NOT touch the plot, the magic rule, the characters, the refrain, or the chapter structure.",
    `Identify the ${DEV_MODE_LINE_PUNCHUP_MAX_REPLACEMENTS} weakest sentences across the whole story and supply stronger replacements that fit seamlessly in their place.`,
    "What counts as a 'weak' sentence to replace:",
    "- generic narrator description that could be in any children's book ('Es war schön.', 'Sie waren glücklich.')",
    "- a moral-summary or explained-emotion sentence",
    "- a long sentence that loses its punch (split or compress it)",
    "- a dialogue line that does only one job (decorate); replace with a line that adds action, subtext, or comic timing",
    "- a flat opening line of a chapter that doesn't set up the central image",
    "- a flat closing line of a chapter that doesn't pull the reader forward",
    "",
    "STRICT REPLACEMENT RULES:",
    "- 'find' must be an EXACT contiguous substring from a single chapter's prose. Copy it character-for-character including punctuation and dialogue marks („...\").",
    "- Replacement should be roughly the SAME LENGTH as the original (±40 characters). Do not grow chapter length.",
    "- Replacement must use age-appropriate, concrete, sensory language. No adult abstractions, no moralizing.",
    "- Replacement must keep the same speaker if it is a dialogue line.",
    "- Replacement may add ONE small simile from a child's world (toy, animal, food, weather) per chapter, but never replace an existing iconic simile with a blander one.",
    "- NEVER touch the refrain or any line that appears identically in multiple chapters (those are leitmotifs).",
    `- NEVER change main character names: ${heroNames.join(", ") || "(none specified)"}. NEVER change pool character names.`,
    "- ALWAYS keep typographic quotation marks where the original used them.",
    "- DO NOT introduce new characters, settings, or plot beats.",
    `- Maximum ${DEV_MODE_LINE_PUNCHUP_MAX_REPLACEMENTS} replacements across the whole story.`,
    "- Prefer 1-2 replacements per chapter, not all in one chapter.",
    "",
    "PRIORITY HINTS FROM DIAGNOSTICS:",
    promptJson(compactDiagnosticsForPrompt(diagnostics)),
    "",
    buildVoiceBibleBlock(input),
    "",
    buildWriterVoiceAnchorBlock(input),
    "",
    "TITLE-PROMISE: if the title's central word/image is missing from the prose, AT LEAST ONE replacement must reintroduce it cleanly (in dialogue or refrain, never as forced exposition).",
    "",
    buildLeanRepairPromptContext(input, chapterCount),
    "",
    "COMPACT BLUEPRINT (for reference only — do not invent new beats):",
    promptJson(compactBlueprint),
    "",
    "CURRENT STORY (replace exact substrings only — do not return the rewritten story):",
    promptJson(story),
    "",
    `FINAL REMINDER: respond with the schema above and nothing else. All 'replaceWith' strings must be in ${languageName} and use typographic quotation marks for dialogue.`,
  ].join("\n");

  return { systemPrompt, userPrompt };
}

function parseLinePunchupResult(content: string): LinePunchupReplacement[] {
  const parsed = tryParseJson(content);
  const list = parsed?.lineReplacements;
  if (!Array.isArray(list)) return [];
  const out: LinePunchupReplacement[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const order = Number(item.chapterOrder ?? item.order);
    const find = typeof item.find === "string" ? item.find.trim() : "";
    const replaceWith = typeof item.replaceWith === "string" ? item.replaceWith.trim() : "";
    if (!Number.isFinite(order) || order < 1) continue;
    if (find.length < DEV_MODE_LINE_PUNCHUP_MIN_LINE_CHARS) continue;
    if (replaceWith.length < DEV_MODE_LINE_PUNCHUP_MIN_LINE_CHARS) continue;
    if (find === replaceWith) continue;
    out.push({
      chapterOrder: order,
      find,
      replaceWith,
      reason: typeof item.reason === "string" ? item.reason : undefined,
    });
    if (out.length >= DEV_MODE_LINE_PUNCHUP_MAX_REPLACEMENTS) break;
  }
  return out;
}

interface LinePunchupApplyResult {
  story: DevModeRawStory;
  appliedCount: number;
  droppedCount: number;
  appliedReplacements: LinePunchupReplacement[];
  droppedReplacements: Array<LinePunchupReplacement & { reason: string }>;
}

function applyLinePunchupResult(
  story: DevModeRawStory,
  replacements: LinePunchupReplacement[]
): LinePunchupApplyResult {
  const chaptersByOrder = new Map(story.chapters.map((chapter) => [Number(chapter.order), { ...chapter }]));
  const appliedReplacements: LinePunchupReplacement[] = [];
  const droppedReplacements: Array<LinePunchupReplacement & { reason: string }> = [];

  for (const replacement of replacements) {
    const chapter = chaptersByOrder.get(Number(replacement.chapterOrder));
    if (!chapter) {
      droppedReplacements.push({ ...replacement, reason: "chapter-order-not-found" });
      continue;
    }
    if (!chapter.content.includes(replacement.find)) {
      droppedReplacements.push({ ...replacement, reason: "find-string-not-in-chapter" });
      continue;
    }
    // Length sanity check: must stay within ±60 chars to keep length gates happy.
    const lengthDelta = replacement.replaceWith.length - replacement.find.length;
    if (Math.abs(lengthDelta) > 60) {
      droppedReplacements.push({ ...replacement, reason: `length-delta-too-big (${lengthDelta})` });
      continue;
    }
    chapter.content = chapter.content.replace(replacement.find, replacement.replaceWith);
    chaptersByOrder.set(Number(replacement.chapterOrder), chapter);
    appliedReplacements.push(replacement);
  }

  const newChapters = story.chapters
    .map((chapter) => chaptersByOrder.get(Number(chapter.order)) || chapter)
    .sort((a, b) => a.order - b.order);

  return {
    story: { ...story, chapters: newChapters },
    appliedCount: appliedReplacements.length,
    droppedCount: droppedReplacements.length,
    appliedReplacements,
    droppedReplacements,
  };
}

function selectChapterDiagnosticsForRepair(
  diagnostics: DevModeStoryDiagnostics,
  story: DevModeRawStory,
  config: StoryConfig
): DevModeChapterDiagnostic[] {
  const bounds = getChapterLengthBounds(config);
  const paragraphBounds = getParagraphBounds(config);
  const priority = (chapter: DevModeChapterDiagnostic): number => {
    const overBy = Math.max(0, chapter.chars - bounds.max);
    const underBy = Math.max(0, bounds.min - chapter.chars);
    const dialogGap = Math.max(0, DEV_MODE_MIN_CHAPTER_DIALOG_PCT - chapter.dialogPct);
    const targetDialogGap = Math.max(0, DEV_MODE_TARGET_DIALOG_PCT - chapter.dialogPct) * 0.2;
    return chapter.issues.length * 1000 + overBy + underBy + dialogGap * 80 + targetDialogGap * 20;
  };
  const failing = diagnostics.chapterDiagnostics.filter((chapter) => {
    if (chapter.issues.length > 0) return true;
    if (chapter.dialogPct < DEV_MODE_TARGET_DIALOG_PCT) return true;
    if (chapter.paragraphs < paragraphBounds.min || chapter.paragraphs > paragraphBounds.max) return true;
    if (chapter.chars < bounds.min || chapter.chars > bounds.max) return true;
    return false;
  });

  if (failing.length > 0) return failing.slice().sort((a, b) => priority(b) - priority(a));
  if (diagnostics.dialogPct < DEV_MODE_TARGET_DIALOG_PCT) {
    return diagnostics.chapterDiagnostics
      .slice()
      .sort((a, b) => a.dialogPct - b.dialogPct)
      .slice(0, Math.min(2, story.chapters.length));
  }
  return [];
}

// True when every remaining hard issue is something a targeted chapter-repair
// can fix (length out of bounds, dialogue%, paragraph count, long sentences,
// chapter-localized issues). Story-level issues like novelty/cast/banned
// patterns require a different path.
function isChapterLocalHardFailure(diagnostics?: DevModeStoryDiagnostics): boolean {
  if (!diagnostics || diagnostics.hardIssueCount === 0) return false;
  const chapterLocalPattern = /Kapitel \d+|Dialoganteil|deutlich zu lang|deutlich zu kurz|Absaetze|Absätze|zu langen Satz/i;
  return diagnostics.hardIssues.every((issue) => chapterLocalPattern.test(issue));
}

// Picks the failing chapters for a final post-polish rescue pass. Targets
// ONLY chapters that appear in story-level hard issues (via "Kapitel N" prefix
// match). Previous broader selection sometimes pulled in chapters that only
// had soft warnings, and the LLM repair would then introduce real hard issues
// trying to "fix" perfectly fine chapters.
function selectPostPolishChapterRepairChapters(
  diagnostics: DevModeStoryDiagnostics,
  config: StoryConfig
): DevModeChapterDiagnostic[] {
  const bounds = getChapterLengthBounds(config);
  // Extract chapter numbers explicitly named in hardIssues.
  const chaptersWithHardIssues = new Set<number>();
  for (const issue of diagnostics.hardIssues) {
    const match = issue.match(/Kapitel\s+(\d+)/i);
    if (match) chaptersWithHardIssues.add(Number(match[1]));
  }
  const offenders = diagnostics.chapterDiagnostics.filter((chapter) =>
    chaptersWithHardIssues.has(Number(chapter.order))
  );
  // Priority: most-over-bound length first, then most-under-dialog.
  return offenders
    .slice()
    .sort((a, b) => {
      const aSev = Math.max(0, a.chars - bounds.max) + Math.max(0, bounds.min - a.chars)
        + Math.max(0, DEV_MODE_MIN_CHAPTER_DIALOG_PCT - a.dialogPct) * 30;
      const bSev = Math.max(0, b.chars - bounds.max) + Math.max(0, bounds.min - b.chars)
        + Math.max(0, DEV_MODE_MIN_CHAPTER_DIALOG_PCT - b.dialogPct) * 30;
      return bSev - aSev;
    })
    .slice(0, DEV_MODE_POST_POLISH_DIALOG_REPAIR_LIMIT);
}

function selectValidatorQualityRepairChapters(
  diagnostics: DevModeStoryDiagnostics,
  validatorFindings: any,
  chapterCount: number
): DevModeChapterDiagnostic[] {
  const selected = new Map<number, DevModeChapterDiagnostic>();
  const chapters = diagnostics.chapterDiagnostics.slice().sort((a, b) => a.order - b.order);
  const add = (order: number | undefined) => {
    if (!order || selected.size >= DEV_MODE_VALIDATOR_QUALITY_REPAIR_LIMIT) return;
    const chapter = chapters.find((candidate) => Number(candidate.order) === Number(order));
    if (chapter) selected.set(Number(chapter.order), chapter);
  };
  const addLowestDialogue = () => {
    const chapter = chapters
      .filter((candidate) => !selected.has(Number(candidate.order)))
      .slice()
      .sort((a, b) => a.dialogPct - b.dialogPct)[0];
    add(chapter?.order);
  };

  const findingText = [
    ...(Array.isArray(validatorFindings?.warnings) ? validatorFindings.warnings : []),
    ...(Array.isArray(validatorFindings?.mustFixBefore95) ? validatorFindings.mustFixBefore95 : []),
    ...(Array.isArray(validatorFindings?.publishabilityBlockers) ? validatorFindings.publishabilityBlockers : []),
  ].join(" ").toLowerCase();

  if (/chapter|page|pull|hook|cliff|weiter|sog|kapitelende/.test(findingText)) {
    for (const chapter of chapters.filter((candidate) => candidate.issues.some((issue) => /pull|weiterlese|sog/i.test(issue)))) {
      add(chapter.order);
    }
    if (selected.size === 0 && chapterCount > 1) add(Math.max(1, chapterCount - 1));
  }

  if (/ending|payoff|moral|didactic|resolution|finale|schluss|lehre|lesson/.test(findingText)) {
    add(chapterCount);
  }

  if (/wonder|magic|mechanic|rule|regel|plot driver|magi/.test(findingText)) {
    add(Math.min(chapterCount, Math.max(2, Math.ceil(chapterCount / 2))));
    add(Math.max(1, chapterCount - 1));
  }

  if (/dialogue|dialog|voice|stimme|speaker|character voices/.test(findingText)) {
    addLowestDialogue();
    addLowestDialogue();
  }

  if (selected.size === 0) {
    add(chapters.find((chapter) => chapter.issues.length > 0)?.order);
    add(chapterCount);
  }

  return [...selected.values()].slice(0, DEV_MODE_VALIDATOR_QUALITY_REPAIR_LIMIT);
}

function replaceStoryChapter(story: DevModeRawStory, repairedChapter: DevModeChapter): DevModeRawStory {
  const chapters = story.chapters
    .map((chapter) => (Number(chapter.order) === Number(repairedChapter.order) ? repairedChapter : chapter))
    .sort((a, b) => a.order - b.order);
  return {
    ...story,
    chapters,
  };
}

function promptJson(value: any): string {
  return JSON.stringify(value);
}

function compactDiagnosticsForPrompt(diagnostics?: DevModeStoryDiagnostics | null): any {
  if (!diagnostics) return null;
  return {
    needsPolish: diagnostics.needsPolish,
    hardIssueCount: diagnostics.hardIssueCount,
    softIssueCount: diagnostics.softIssueCount,
    totalChars: diagnostics.totalChars,
    totalWords: diagnostics.totalWords,
    dialogPct: diagnostics.dialogPct,
    hardIssues: diagnostics.hardIssues.slice(0, 12),
    softIssues: diagnostics.softIssues.slice(0, 8),
    polishInstructions: diagnostics.polishInstructions.slice(0, 8),
    chapters: diagnostics.chapterDiagnostics.map((chapter) => ({
      order: chapter.order,
      title: chapter.title,
      chars: chapter.chars,
      dialogPct: chapter.dialogPct,
      paragraphs: chapter.paragraphs,
      longestSentenceChars: chapter.longestSentenceChars,
      issues: chapter.issues,
    })),
  };
}

function compactCritiqueForDraft(critique: any): any {
  return {
    score: critique?.score,
    marketGap: compactExcerpt(critique?.marketGap || "", 220) || undefined,
    mustFix: asStringArray(critique?.mustFix, 8),
    missingEmotionalPayoff: asStringArray(critique?.missingEmotionalPayoff, 5),
    voiceRisks: asStringArray(critique?.voiceRisks, 5),
    readOnRisks: asStringArray(critique?.readOnRisks, 5),
    addictiveReadingFixes: asStringArray(critique?.addictiveReadingFixes, 5),
    draftInstructions: asStringArray(critique?.draftInstructions, 10),
    chapterRisks: Array.isArray(critique?.chapterRisks) ? critique.chapterRisks.slice(0, 8) : [],
    validatorFindings: critique?.validatorFindings
      ? {
          marketQualityScore: critique.validatorFindings.marketQualityScore,
          errors: Array.isArray(critique.validatorFindings.errors) ? critique.validatorFindings.errors.slice(0, 8) : [],
          warnings: Array.isArray(critique.validatorFindings.warnings) ? critique.validatorFindings.warnings.slice(0, 6) : [],
          mustFixBefore95: Array.isArray(critique.validatorFindings.mustFixBefore95) ? critique.validatorFindings.mustFixBefore95.slice(0, 8) : [],
        }
      : undefined,
    polishReason: critique?.polishReason || undefined,
  };
}

function asStringArray(value: any, limit = 6): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => compactExcerpt(typeof item === "string" ? item : String(JSON.stringify(item) || ""), 260))
      .filter(Boolean)
      .slice(0, limit);
  }
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return [];
    return [compactExcerpt(text, 260)];
  }
  if (value && typeof value === "object") {
    return [compactExcerpt(String(JSON.stringify(value) || ""), 260)];
  }
  return [];
}

function compactExcerpt(text: string, maxChars = 360): string {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;
  const head = normalized.slice(0, Math.floor(maxChars * 0.58)).trim();
  const tail = normalized.slice(-Math.floor(maxChars * 0.34)).trim();
  return `${head} … ${tail}`;
}

function firstParagraph(text: string): string {
  return splitParagraphs(text)[0] || "";
}

function lastParagraph(text: string): string {
  const paragraphs = splitParagraphs(text);
  return paragraphs[paragraphs.length - 1] || "";
}

function buildCompactRepairStoryContext(story: DevModeRawStory, targetOrder: number): any {
  return {
    title: story.title,
    description: story.description,
    targetOrder,
    chapters: story.chapters
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((chapter) => {
        const distance = Number(chapter.order) - Number(targetOrder);
        const nearTarget = Math.abs(distance) <= 1;
        return {
          order: chapter.order,
          title: chapter.title,
          contentChars: chapter.content.length,
          relation: distance === 0 ? "target" : distance < 0 ? "before" : "after",
          opening: nearTarget && distance !== 0 ? compactExcerpt(firstParagraph(chapter.content), 240) : undefined,
          ending: nearTarget && distance !== 0 ? compactExcerpt(lastParagraph(chapter.content), 280) : undefined,
        };
      }),
  };
}

function buildChapterRepairBlueprintContext(reviewedBlueprint: any, order: number): any {
  const chapterPlan = Array.isArray(reviewedBlueprint?.chapterPlan)
    ? reviewedBlueprint.chapterPlan.find((plan: any) => Number(plan?.order) === Number(order))
    : null;
  return {
    premise: compactExcerpt(reviewedBlueprint?.premise || "", 260),
    storySpine: reviewedBlueprint?.storySpine,
    noveltySignature: reviewedBlueprint?.noveltySignature,
    keyMoments: Array.isArray(reviewedBlueprint?.keyMoments)
      ? reviewedBlueprint.keyMoments.filter((moment: any) => {
          const momentOrder = Number(moment?.order);
          return !Number.isFinite(momentOrder) || Math.abs(momentOrder - Number(order)) <= 1;
        }).slice(0, 5)
      : undefined,
    causalChain: Array.isArray(reviewedBlueprint?.causalChain)
      ? reviewedBlueprint.causalChain.slice(0, 8)
      : undefined,
    coreMagicRule: compactExcerpt(reviewedBlueprint?.coreMagicRule || "", 260),
    readerMagnet: reviewedBlueprint?.readerMagnet
      ? {
          refrainLine: reviewedBlueprint.readerMagnet.refrainLine,
          iconicMotif: reviewedBlueprint.readerMagnet.iconicMotif,
          activeUseByChapter: Array.isArray(reviewedBlueprint.readerMagnet.activeUseByChapter)
            ? reviewedBlueprint.readerMagnet.activeUseByChapter.slice(0, 8)
            : undefined,
          nextStorySpark: reviewedBlueprint.readerMagnet.nextStorySpark,
        }
      : undefined,
    payoffEngine: reviewedBlueprint?.payoffEngine,
    antagonistChangeLadder: reviewedBlueprint?.antagonistChangeLadder,
    humorCallbackPlan: reviewedBlueprint?.humorCallbackPlan,
    characterArcs: Array.isArray(reviewedBlueprint?.characterArcs)
      ? reviewedBlueprint.characterArcs.map((arc: any) => ({
          name: arc?.name,
          startingFriction: arc?.startingFriction,
          strength: arc?.strength,
          finalContribution: arc?.finalContribution,
        }))
      : undefined,
    chapterPlan,
  };
}

function parseChapterRepairResult(content: string, fallbackChapter: DevModeChapter): { chapter: DevModeChapter; selfReflection?: any; parsed: any } {
  const parsed = tryParseJson(content);
  const rawChapter = parsed?.repairedChapter || parsed?.chapter || parsed?.chapters?.[0] || parsed?.selfReflection?.repairedChapter || parsed;
  const chapter = parseChapterFromModel(rawChapter, Math.max(0, fallbackChapter.order - 1), fallbackChapter.title);
  return {
    chapter: {
      ...chapter,
      order: fallbackChapter.order,
      title: chapter.title || fallbackChapter.title,
    },
    selfReflection: parsed?.selfReflection || parsed?.selfCheck || parsed?.afterRepairCheck || null,
    parsed,
  };
}

function buildChapterRepairPrompts(
  input: DevModeGenerationInput,
  chapterCount: number,
  story: DevModeRawStory,
  chapter: DevModeChapter,
  chapterDiagnostics: DevModeChapterDiagnostic,
  storyDiagnostics: DevModeStoryDiagnostics,
  blueprint: any,
  critique: any,
  repairAttempt: number
): { systemPrompt: string; userPrompt: string } {
  const languageName = localizedLanguageName(input.config.language);
  const bounds = getChapterLengthBounds(input.config);
  const reviewedBlueprint = getReviewedBlueprint(blueprint, critique);
  const chapterTargetDialogPct = storyDiagnostics.dialogPct < DEV_MODE_MIN_DIALOG_PCT
    ? DEV_MODE_PROMPT_DIALOG_PCT
    : storyDiagnostics.dialogPct < DEV_MODE_TARGET_DIALOG_PCT
      ? DEV_MODE_PROMPT_DIALOG_PCT
      : DEV_MODE_MIN_CHAPTER_DIALOG_PCT;
  const targetMaxChars = getChapterRepairTargetMaxChars(input.config);
  const paragraphBudget = getParagraphBudgetGuidance(input.config);
  const paragraphBounds = getParagraphBounds(input.config);
  const targetParagraphMaxChars = paragraphBudget.maxChars;
  const maxSentenceChars = maxSentenceCharsForAge(input.config.ageGroup);
  const dialogueLineTarget = input.config.length === "short"
    ? Math.max(5, DEV_MODE_CHAPTER_DIALOG_LINE_TARGET - 2)
    : DEV_MODE_CHAPTER_DIALOG_LINE_TARGET;
  const validatorQualityRepairMode = /validator-quality|market-quality/i.test(String(critique?.polishReason || ""));
  const systemPrompt = qualitySystemPrompt(
    languageName,
    [
      "Chapter repair schema:",
      "{",
      '  "selfReflection": {',
      '    "targetedIssues": string[],',
      '    "repairPlan": string[],',
      '    "afterRepairCheck": {',
      '      "paragraphCount": number,',
      '      "estimatedChars": number,',
      '      "estimatedDialoguePct": number,',
      '      "dialogueLineCount": number,',
      '      "speakerTurnCount": number,',
      '      "hardGatesPassed": boolean,',
      '      "remainingIssues": string[]',
      "    }",
      "  },",
      '  "repairedChapter": {',
      '    "order": number,',
      '    "title": string,',
      '    "paragraphs": string[]',
      "  }",
      "}",
      "IMPORTANT: repairedChapter.paragraphs is mandatory. Each array item is exactly one paragraph. Do not output the full story.",
    ].join("\n")
  );

  const userPrompt = [
    `CALL 3B.${repairAttempt}: TARGETED CHAPTER GATE REPAIR. Repair only chapter ${chapter.order} and keep prose in ${languageName}.`,
    "This is a mechanical gate repair first and a children's-book polish second. Do not invent a new plot, a new main character, or a new subplot.",
    "The selected story model must fix the chapter itself; do not ask for another model or a fallback.",
    "Return ONLY the repaired chapter plus the required selfReflection JSON. The final story will be assembled by the server.",
    "",
    buildLeanRepairPromptContext(input, chapterCount),
    "",
    "GLOBAL STORY DIAGNOSTICS BEFORE THIS CHAPTER REPAIR:",
    promptJson(compactDiagnosticsForPrompt(storyDiagnostics)),
    "",
    "TARGET CHAPTER DIAGNOSTICS:",
    promptJson(chapterDiagnostics),
    validatorQualityRepairMode
      ? [
          "",
          "VALIDATOR MARKET-QUALITY REPAIR MODE:",
          "- This chapter passed basic form gates, but the full story is below release quality. Repair for literary effect, not just mechanics.",
          "- Use validatorFindings in the critique block as binding: strengthen page-turn pull, wonder-rule payoff, voice, child agency, or non-didactic ending as relevant.",
          "- Preserve continuity. Change only this chapter's prose, and only enough to address the named market-quality gap.",
        ].join("\n")
      : null,
    "",
    buildSilentPreWriteSelfReviewContract(input, 1, "chapter-repair"),
    "",
    buildVoiceBibleBlock(input),
    "",
    "TARGET GATES FOR THE REPAIRED CHAPTER:",
    `- Keep order exactly ${chapter.order}.`,
    `- Keep title unless a tiny grammar fix is needed: ${chapter.title}.`,
    `- HARD LENGTH: ${bounds.min}-${bounds.max} characters of target-language prose. Aim for ${bounds.min}-${targetMaxChars}; if unsure, write shorter, not longer.`,
    `- Whole-story budget still applies: ${storyWordBudgetGuidance(input.config, chapterCount)}`,
    "- Previous repairs failed because the model under-estimated character counts. Trust the server budget, not your estimate.",
    `- No paragraph should exceed about ${targetParagraphMaxChars} characters. Long paragraphs are the main reason previous repair failed.`,
    `- No sentence may exceed ${maxSentenceChars} characters. Split long sentences into simple action/dialogue beats.`,
    `- ${paragraphBounds.min}-${paragraphBounds.max} paragraphs, output as repairedChapter.paragraphs[]. Aim for ${paragraphBudget.targetCount} paragraphs.`,
    input.config.length === "short"
      ? "- SHORT REPAIR MEANS REAL CUTS: remove secondary images, repeated reactions, and any sentence that only explains what the reader already saw."
      : null,
    `- At least ${chapterTargetDialogPct}% dialogue in this chapter; never below ${DEV_MODE_MIN_CHAPTER_DIALOG_PCT}%.`,
    storyDiagnostics.dialogPct < DEV_MODE_MIN_DIALOG_PCT
      ? `- Because the full story is under the dialogue floor, aim closer to ${DEV_MODE_PROMPT_DIALOG_PCT}% dialogue in this repaired chapter by replacing narration with conflict-bearing exchanges.`
      : null,
    `- At least ${dialogueLineTarget} dialogue lines and at least ${DEV_MODE_CHAPTER_SPEAKER_TURN_TARGET} speaker turns.`,
    "- Dialogue must change action, relationship, tension, subtext, or comic timing. No filler chatter.",
    "- End the chapter with a concrete pull: danger, decision, question, new rule, or funny aftershock.",
    "",
    "SELF-REFLECTION AFTER REPAIR (MANDATORY AND VISIBLE IN JSON):",
    "1. First repair the chapter.",
    "2. Then inspect your own repairedChapter.paragraphs before answering: count paragraphs, count approximate characters by paragraph length, estimate dialogue percent, count dialogue lines, count speaker turns.",
    `3. If your own check finds more than ${bounds.max} characters, revise again by cutting explanation/repeated description until it is safely below ${targetMaxChars}.`,
    "4. Set selfReflection.afterRepairCheck.hardGatesPassed=true ONLY if your own repaired chapter satisfies all listed target gates. If not, remainingIssues must list every remaining issue honestly.",
    "5. The server will run deterministic diagnostics after you answer; false self-certification is a failure.",
    "",
    "DIALOGUE / VOICE REPAIR METHOD:",
    "- Convert explanatory narration into short character-specific exchanges.",
    "- Use the named VOICE BIBLE above; never flatten characters into generic careful/lively/helper/antagonist templates.",
    "- If a helper/adult line explains the solution, turn it into pressure, comic action, or a prop clue so the main avatars still decide and act.",
    "- If two speakers sound interchangeable, rewrite one line using age, body detail, memory habit, question style, or gesture.",
    "",
    "STRUCTURE / PAYOFF REPAIR METHOD:",
    "- Preserve the chapter's goal, conflict, turn, and chapter-end hook from the blueprint.",
    "- If a chapter is too long: cut explanation, repeated sensory description, repeated warnings, and repeated moral phrasing first; keep decision beats.",
    "- Do not solve length by adding filler dialogue. Dialogue must replace narration, not sit on top of it.",
    "- If dialogue is low: add conflict-bearing speaker turns, not narrator explanation.",
    "- If paragraphs are too many: combine adjacent action and reaction into stronger paragraphs.",
    "- If the antagonist changes too quickly, add a small visible hesitation or pull toward old behavior.",
    "- If this chapter participates in the finale/payoff, make the cost of sharing or letting go visible as an action, not a moral sentence.",
    "- Preserve the recurring humor callback; make it slightly evolve instead of repeating the exact same joke.",
    "- If a helper/adult currently explains the answer, convert that beat into the main avatars noticing, testing, choosing, or doing.",
    "- If the magic/wonder rule is only described, make it cause a visible obstacle, false attempt, or final action.",
    "- If the readerMagnet/refrain is present, make it cause or reveal something in this chapter. Do not keep it as a decorative repeated line.",
    "",
    "RELEVANT BLUEPRINT FOR THIS CHAPTER:",
    promptJson(buildChapterRepairBlueprintContext(reviewedBlueprint, chapter.order)),
    "",
    "CRITIQUE TO RESPECT:",
    promptJson({
      ...compactCritiqueForDraft(critique),
      chapterRisks: (critique?.chapterRisks || []).filter((risk: any) => Number(risk?.order) === Number(chapter.order)),
    }),
    "",
    "COMPACT CURRENT STORY CONTEXT (do not rewrite other chapters; use only for continuity):",
    promptJson(buildCompactRepairStoryContext(story, chapter.order)),
    "",
    "CURRENT TARGET CHAPTER TO REPAIR:",
    promptJson(chapter),
    "",
    `FINAL REMINDER: repairedChapter.paragraphs and all dialogue must be in ${languageName}. No Markdown. No full-story copy.`,
  ].join("\n");
  return { systemPrompt, userPrompt };
}

function buildValidationPrompts(
  input: DevModeGenerationInput,
  chapterCount: number,
  story: DevModeRawStory,
  diagnostics?: DevModeStoryDiagnostics
): { systemPrompt: string; userPrompt: string } {
  const languageName = localizedLanguageName(input.config.language);
  const systemPrompt = [
    "You are a strict children's-book market-quality validator, not a story writer.",
    "Evaluate honestly against real published children's books. Never rewrite the story.",
    `The story prose is in ${languageName}; your validation JSON may be in English.`,
    "Hard local diagnostics are binding: if they report failed form gates, you must reflect that in score, warnings, and mustFixBefore95.",
    "Respond with valid JSON only, no Markdown, no comments, no trailing commas.",
    "Schema:",
    "{",
    '  "isValid": boolean,',
    '  "marketQualityScore": number,',
    '  "dimensionScores": {',
    '    "emotionalEngine": number,',
    '    "iconicCharacters": number,',
    '    "tensionEscalation": number,',
    '    "voiceDistinctiveness": number,',
    '    "readAloudRhythm": number,',
    '    "originality": number,',
    '    "premiseFreshness": number,',
    '    "centralConflict": number,',
    '    "keyMomentPayoff": number,',
    '    "causalChain": number,',
    '    "ageFit": number,',
    '    "endingPayoff": number,',
    '    "pageTurnDrive": number,',
    '    "rereadValue": number,',
    '    "chapterEndPull": number,',
    '    "jsonValidity": number',
    '  },',
    '  "errors": string[],',
    '  "warnings": string[],',
    '  "publishabilityBlockers": string[],',
    '  "mustFixBefore95": string[]',
    "}",
  ].join("\n");
  const code = languageCodeFromName(languageName);
  const anchorBlock = validatorAnchorBlock(code);
  const contextSummary = [
    `Output language: ${languageName}`,
    `Age group: ${input.config.ageGroup}`,
    `Chapter count: exactly ${chapterCount}`,
    `Genre: ${input.config.genre}`,
    `Setting: ${input.config.setting}`,
    `Main characters: ${(input.avatars || []).map((avatar) => avatar.name).filter(Boolean).join(", ") || "unspecified"}`,
    `Supporting pool used: ${(input.poolCharacters || []).map((character) => character.name).filter(Boolean).join(", ") || "none"}`,
  ].join("\n");
  const userPrompt = [
    "CALL 4: Validate JSON, style, market quality, and logic of the final story.",
    "IMPORTANT: Do NOT rewrite the story or return a story copy. This support call only evaluates. The final prose must come from the selected writer model.",
    "Your JSON output (the validation verdict) is fine in English. Only the story you are evaluating is in the target language.",
    "",
    "CALIBRATION (binding — compare the story to these anchors, written in the story's target language):",
    "",
    anchorBlock,
    "",
    "SCORING RULES:",
    "- 9.5+ ONLY if the story sits in the same league as Donaldson/Nordqvist (rhyme/beat OR unmistakable character voices + humor + setup-payoff + emotional aftertaste).",
    "- 9.0–9.4 only if it is release-ready: strong child agency, consistent wonder rule, distinct voices, page-turn pull, earned ending, and no didactic final explanation.",
    "- 8.5–8.9 if clearly above anchor 7.5, but at least one weakness (e.g. character voices present but not iconic; humor present but quiet; setup/payoff present but not surprising).",
    "- 7.0–8.4 if at or slightly above anchor 7.5 (standard children's book).",
    "- 5.0–6.9 if at anchor-6 level (forbidden phrases, generic).",
    "- < 5.0 if at anchor-4 level or worse.",
    "",
    "MANDATORY CAPS (whichever is lower wins):",
    "- Antagonist is only mechanic (no wound / no new place at the end): max 8.4.",
    "- Main characters not iconically distinguishable (dialogue interchangeable): max 8.7.",
    "- No clear central conflict a child can retell in one sentence: max 8.2.",
    "- No irreversible emotional key moment / shattering turn: max 8.3.",
    "- Wonder mechanic / magic rule is named but not repeatedly tested as a plot driver: max 8.6.",
    "- Events feel like 'and then' episodes rather than therefore/but causality: max 8.4.",
    "- Title/premise would not stand out on a children's-library shelf: max 8.6.",
    "- Ending explains moral instead of showing ('they learned...' / 'Sie lernten...'): max 7.5.",
    "- Final paragraph states the lesson in a neat aphorism instead of leaving a concrete image: max 8.2.",
    "- Adult/helper/supporting figure solves the decisive problem, while the child only follows instructions: max 8.2.",
    "- Supporting cast crowds the story and weakens the main character arc: max 8.5.",
    "- Chapter endings without read-on pull: max 8.6.",
    "- Dialogue quota / form gates failed per local diagnostics: max 8.7.",
    "- NO humor in the 'kid giggles' sense in at least 4 of 5 chapters: max 8.2.",
    "- No setup-payoff (resolution doesn't come from prepared details): max 8.0.",
    "- Too similar to a recent story title/premise/motif from the novelty brief: max 7.0.",
    "- Uses hard-avoid motifs without explicit user request: max 7.0.",
    "- Selected pool cast is missing from the story or reduced to decorative cameo: max 8.4.",
    "- More than 2 forbidden phrases in any language ('they learned...', 'true magic in the heart...', 'with courage and togetherness...'): max 6.5.",
    "",
    "Check: exactly correct chapter count, valid JSON, no [object Object], clear character roles, central conflict, irreversible key moment, therefore/but causal chain, no explained moral, prepared solution, no spoiled / cheap antagonist defeat, age-appropriate language, dialogue with typographic quotation marks.",
    "Also check: would a child want to hear the next chapter? Is there a recurring motif? Is there callback/payoff? Are there reread rewards and characters one wants to meet again?",
    "Be honest. A truthful 7.8 beats a flattering 9.2. Self-inflating the score would be a pipeline error.",
    "",
    "VALIDATION TARGET:",
    contextSummary,
    "",
    "NOVELTY BRIEF USED FOR THIS GENERATION:",
    buildNoveltyPromptBlock(input) || "No novelty brief available.",
    "",
    "LOCKED WINNING IDEA FOR THIS GENERATION:",
    buildSelectedIdeaPromptBlock(input) || "No explicit winning-idea block available.",
    "",
    "LOCAL DIAGNOSTICS OF THE FINAL STORY:",
    promptJson(compactDiagnosticsForPrompt(diagnostics || null)),
    "",
    "STORY:",
    promptJson(story),
  ].join("\n");
  return { systemPrompt, userPrompt };
}

/**
 * Validator anchors are written in the same target language as the story.
 * Otherwise the validator compares German prose against English benchmarks
 * which trips models toward over-scoring. We keep the meta-explanation
 * ("why this score") in English so the validator's reasoning works in the
 * model's strongest language.
 */
function validatorAnchorBlock(languageCode: string): string {
  if (languageCode === "de") {
    return [
      "ANCHOR 10.0 — Gruffalo-level picture-book craft (German market):",
      "  Why 10: read-aloud rhythm or refrain makes it memorizable; no wasted word; one small protagonist trick/rule carries the plot; punchline and reversal are planted early.",
      "",
      "ANCHOR 9.0 — Pettersson-und-Findus-level character comedy (German market):",
      "  Why 9: two clearly separated voices; concrete situational comedy; visual/detail-rich scenes; no explained joke; warmth and affection appear through small actions, not direct statements.",
      "",
      "ANCHOR 7.5 — elevated standard children's book (German):",
      "  „Anna nahm den goldenen Schlüssel und sagte: 'Damit öffnen wir das geheimnisvolle Tor!' Ben nickte tapfer. Gemeinsam stürmten sie los, denn sie wussten: Freundschaft ist stärker als jede Angst.\"",
      "  Why only 7.5: readable, clear plot, BUT characters interchangeable (both talk the same); moral spoken aloud; stereotypes (golden key, off they ran together); no humor; no setup/payoff.",
      "",
      "ANCHOR 6.0 — generic AI children's story (German):",
      '  „Lena und Tom betraten den verzauberten Wald. Die Bäume schimmerten in allen Farben. \'Wir müssen mutig sein!\', rief Lena. Sie hatten gelernt, dass wahre Magie im Herzen liegt."',
      "  Why only 6: everything is a label, nothing is shown; forbidden phrases ('hatten gelernt', 'wahre Magie im Herzen liegt'); no sensory detail; no character voice.",
      "",
      "ANCHOR 4.0 — weak AI output (German):",
      '  „Sie gingen weiter und weiter. Plötzlich sahen sie einen Drachen. Sie hatten Angst. Aber dann waren sie mutig und freundeten sich mit dem Drachen an. Alle waren glücklich."',
      "  Why only 4: claims without scenes; the turn explained in one sentence; no detail; no voice.",
    ].join("\n");
  }
  if (languageCode === "en") {
    return [
      "ANCHOR 10.0 — Gruffalo-level picture-book craft (English market):",
      "  Why 10: read-aloud rhythm or refrain makes it memorizable; no wasted word; one small protagonist trick/rule carries the plot; punchline and reversal are planted early.",
      "",
      "ANCHOR 9.0 — Pettson-and-Findus-level character comedy (English market):",
      "  Why 9: two clearly separated voices; concrete situational comedy; detail-rich scenes; no explained joke; warmth and affection appear through small actions.",
      "",
      "ANCHOR 7.5 — elevated standard children's book (English):",
      "  \"Anna took the golden key and said: 'This will open the mysterious gate!' Ben nodded bravely. Together they rushed off, because they knew: friendship is stronger than fear.\"",
      "  Why only 7.5: readable, clear plot, BUT characters interchangeable; moral spoken aloud; stereotypes; no humor; no setup/payoff.",
      "",
      "ANCHOR 6.0 — generic AI children's story (English):",
      "  \"Lena and Tom entered the enchanted forest. The trees shimmered in every color. 'We must be brave!' Lena cried. They had learned that true magic lies in the heart.\"",
      "  Why only 6: labels not scenes; forbidden phrases ('they had learned', 'true magic lies in the heart'); no sensory detail; no voice.",
      "",
      "ANCHOR 4.0 — weak AI output (English):",
      '  "They walked on and on. Suddenly they saw a dragon. They were afraid. But then they were brave and made friends with the dragon. Everyone was happy."',
      "  Why only 4: claims without scenes; turn explained in one sentence; no detail; no voice.",
    ].join("\n");
  }
  // Fallback for languages we don't have hand-curated anchors for: ask the
  // validator to evaluate against equivalent local benchmarks.
  return [
    "ANCHOR-FREE FALLBACK:",
    `The validator anchors are not available in the story's target language. Mentally compare against the best contemporary picture/early-reader books in the target language (in the spirit of Donaldson/Nordqvist quality for the 10/9 anchors, and a generic age-appropriate book for 7.5).`,
    "Anchor 10: rhyme/beat OR unmistakable voices + humor + setup-payoff.",
    "Anchor 9: two clearly separated voices, situational comedy, subtext.",
    "Anchor 7.5: readable but characters interchangeable, moral spoken aloud, no humor, no setup/payoff.",
    "Anchor 6.0: labels not scenes, forbidden moral-summary phrases.",
    "Anchor 4.0: claims without scenes, turn explained in one sentence.",
  ].join("\n");
}

function stripJsonFence(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  }
  return trimmed;
}

function sliceToOuterObject(content: string): string {
  const firstBrace = content.indexOf("{");
  const lastBrace = content.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return content.slice(firstBrace, lastBrace + 1);
  }
  return content;
}

/**
 * Best-effort JSON repair. Models sometimes emit:
 *   - // line comments or /* block *\/ comments
 *   - trailing commas before } or ]
 *   - unescaped " inside string values (typical when the story uses German
 *     typographic dialog like „Ja" — model writes regular " inside the value
 *     and doesn't escape it).
 *   - single quotes instead of doubles (rarer; we don't auto-fix this).
 * We fix what we safely can without breaking valid JSON.
 */
function repairLooseJson(input: string): string {
  let s = input;
  // Strip /* ... */ block comments
  s = s.replace(/\/\*[\s\S]*?\*\//g, "");
  // Strip // line comments (but not inside strings — best-effort: only outside quotes via simple state machine)
  s = stripLineCommentsOutsideStrings(s);
  // Remove trailing commas before } or ]
  s = s.replace(/,(\s*[}\]])/g, "$1");
  return s;
}

/**
 * Heuristic recovery for the most common dev-mode failure: a model emits
 * a JSON object whose string values contain unescaped " characters from
 * dialog. We walk the input, treat every `"key":` token as a property
 * boundary, then re-quote the value by detecting where the value ends
 * (next `,\n  "key":` or `\n]` or `\n}` at a reasonable indent).
 *
 * This is a fallback for when JSON.parse keeps throwing "Expected
 * double-quoted property name" — meaning the parser has miscounted
 * quotes inside a value. Only attempt this when normal repair already
 * failed; the cost is correctness loss in edge cases vs. the alternative
 * of "story generation failed entirely".
 */
function escapeInnerQuotesInStringValues(raw: string): string {
  // Find the top-level object body.
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first < 0 || last <= first) return raw;
  const before = raw.slice(0, first);
  const body = raw.slice(first, last + 1);
  const after = raw.slice(last + 1);

  // Property-name pattern: a key followed by colon. We use a state machine.
  // For each string-value start (after `":` or `: `), scan forward and
  // collect characters; whenever we see a `"` decide whether it terminates
  // the value (next non-space is `,`, `}`, `]`, or newline+key) or is an
  // inner quote that must be escaped.
  let out = "";
  let i = 0;
  let depth = 0;
  while (i < body.length) {
    const ch = body[i];
    out += ch;
    if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") depth--;

    // Detect a property `"key":` or array-element string start.
    // Approach: when we hit `"`, scan the string. If the string is a
    // "value" string (preceded by `:` ignoring whitespace), parse with
    // tolerant rules.
    if (ch === '"') {
      // Check whether this " opens a VALUE string (preceded by `:` after ws)
      // or a KEY string (preceded by `{` or `,` after ws).
      let look = out.length - 2;
      while (look >= 0 && /\s/.test(out[look])) look--;
      const prevNonWs = look >= 0 ? out[look] : "";
      const isValueString = prevNonWs === ":";
      const isKeyOrSimple = prevNonWs === "{" || prevNonWs === "," || prevNonWs === "[";

      // Scan forward, copying characters, handling escapes.
      let j = i + 1;
      let valueAcc = "";
      while (j < body.length) {
        const c = body[j];
        if (c === "\\") {
          // Pass through escape sequence verbatim.
          valueAcc += c;
          if (j + 1 < body.length) {
            valueAcc += body[j + 1];
            j += 2;
            continue;
          }
          j++;
          continue;
        }
        if (c === '"') {
          // Decide: terminator or inner quote?
          // Peek ahead skipping whitespace.
          let k = j + 1;
          while (k < body.length && /[ \t]/.test(body[k])) k++;
          const peek = body[k];
          // Terminator if followed by , } ] : or end-of-line that leads to one of these.
          // For a KEY string the next non-ws must be `:`. For a VALUE string the next
          // non-ws should be `,` `}` `]` or newline+`"key":` pattern.
          let isTerminator = false;
          if (isKeyOrSimple && !isValueString) {
            // It's a key string — terminator must be `:`.
            isTerminator = peek === ":";
          } else if (isValueString) {
            if (peek === "," || peek === "}" || peek === "]") {
              isTerminator = true;
            } else if (peek === "\n" || peek === "\r") {
              // Look further: skip whitespace then expect `,` `}` `]` or `"key":` shape.
              let m = k;
              while (m < body.length && /\s/.test(body[m])) m++;
              const nextChar = body[m];
              if (nextChar === "," || nextChar === "}" || nextChar === "]") {
                isTerminator = true;
              } else if (nextChar === '"') {
                // Possible key — look for `":` after a non-quote run.
                let n = m + 1;
                while (n < body.length && body[n] !== '"') {
                  if (body[n] === "\\") n += 2;
                  else n++;
                }
                let o = n + 1;
                while (o < body.length && /[ \t]/.test(body[o])) o++;
                if (body[o] === ":") isTerminator = true;
              }
            } else {
              // Inner quote inside a value — escape it.
              isTerminator = false;
            }
          } else {
            // Bare string somewhere (e.g., inside an array of strings).
            isTerminator = peek === "," || peek === "}" || peek === "]" || peek === "\n" || peek === "\r";
          }

          if (isTerminator) {
            valueAcc += c;
            j++;
            break;
          } else {
            valueAcc += "\\\"";
            j++;
            continue;
          }
        }
        // Escape raw control characters that JSON doesn't allow inside strings.
        if (c === "\n") {
          valueAcc += "\\n";
          j++;
          continue;
        }
        if (c === "\r") {
          valueAcc += "\\r";
          j++;
          continue;
        }
        if (c === "\t") {
          valueAcc += "\\t";
          j++;
          continue;
        }
        valueAcc += c;
        j++;
      }
      out += valueAcc;
      i = j;
      continue;
    }
    i++;
  }
  return before + out + after;
}

function stripLineCommentsOutsideStrings(s: string): string {
  let out = "";
  let inString = false;
  let escape = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      out += ch;
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === "/" && s[i + 1] === "/") {
      // Skip until end-of-line
      while (i < s.length && s[i] !== "\n") i++;
      if (i < s.length) out += s[i]; // preserve the newline
      continue;
    }
    out += ch;
  }
  return out;
}

function tryParseJson(raw: string): any {
  const trimmed = raw.trim();
  const fenced = stripJsonFence(trimmed);
  const sliced = sliceToOuterObject(fenced);
  const looseRepaired = repairLooseJson(sliced);
  const aggressiveRepaired = escapeInnerQuotesInStringValues(looseRepaired);

  const attempts: Array<{ label: string; text: string }> = [
    { label: "raw", text: trimmed },
    { label: "fence-stripped", text: fenced },
    { label: "outer-sliced", text: sliced },
    { label: "loose-repaired", text: looseRepaired },
    { label: "aggressive-quote-repair", text: aggressiveRepaired },
  ];

  let lastError: unknown = null;
  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt.text);
      if (attempt.label !== "raw") {
        console.log(`[dev-mode-generation] JSON parsed via "${attempt.label}" repair stage.`);
      }
      return parsed;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError ?? "unknown JSON parse failure"));
}

function splitParagraphs(text: string): string[] {
  return String(text || "")
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeParagraphsToMax(paragraphs: string[], maxParagraphs = DEV_MODE_MAX_PARAGRAPHS): string[] {
  const normalized = paragraphs.map((part) => String(part || "").trim()).filter(Boolean);
  if (normalized.length <= maxParagraphs) return normalized;

  const merged = [...normalized];
  while (merged.length > maxParagraphs) {
    let mergeIndex = 0;
    let shortestCombinedLength = Number.POSITIVE_INFINITY;
    for (let i = 0; i < merged.length - 1; i += 1) {
      const combinedLength = merged[i].length + merged[i + 1].length;
      if (combinedLength < shortestCombinedLength) {
        shortestCombinedLength = combinedLength;
        mergeIndex = i;
      }
    }
    merged.splice(mergeIndex, 2, `${merged[mergeIndex]} ${merged[mergeIndex + 1]}`.trim());
  }
  return merged;
}

function paragraphsToContent(paragraphs: string[]): string {
  return normalizeParagraphsToMax(paragraphs).join("\n\n").trim();
}

function normalizeChapterContentFromModel(ch: any): string {
  const paragraphArray = Array.isArray(ch?.paragraphs)
    ? ch.paragraphs.map((part: any) => String(part || "").trim()).filter(Boolean)
    : [];
  if (paragraphArray.length > 0) {
    return paragraphsToContent(paragraphArray);
  }

  const content = String(ch?.content || "").trim();
  const paragraphs = splitParagraphs(content);
  if (paragraphs.length > DEV_MODE_MAX_PARAGRAPHS) {
    return paragraphsToContent(paragraphs);
  }
  return content;
}

function parseChapterFromModel(ch: any, idx: number, fallbackTitle?: string): DevModeChapter {
  const chTitle = String(ch?.title || fallbackTitle || `Kapitel ${idx + 1}`).trim();
  const chContent = normalizeChapterContentFromModel(ch);
  if (!chContent) {
    throw new Error(`Developer-mode chapter ${idx + 1} is empty.`);
  }
  const order = Number.isInteger(ch?.order) && ch.order > 0 ? Number(ch.order) : idx + 1;
  return { title: chTitle, content: chContent, order };
}

function parseAndValidate(content: string, chapterCount: number): DevModeRawStory {
  let parsed: any;
  try {
    parsed = tryParseJson(content);
  } catch (err) {
    const preview = content.slice(0, 400);
    const tail = content.length > 800 ? `…${content.slice(-300)}` : "";
    console.error("[dev-mode-generation] Failed to parse model JSON. Preview:", { preview, tail, length: content.length });
    throw new Error(
      `Developer-mode generation returned unparseable JSON: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Developer-mode generation returned malformed JSON.");
  }

  const title = String(parsed.title || "").trim();
  const description = String(parsed.description || "").trim();
  const rawChapters = Array.isArray(parsed.chapters) ? parsed.chapters : [];

  if (!title) throw new Error("Developer-mode story missing title.");
  if (rawChapters.length === 0) throw new Error("Developer-mode story has no chapters.");

  const chapters: DevModeChapter[] = rawChapters.map((ch: any, idx: number) => parseChapterFromModel(ch, idx));

  if (chapters.length !== chapterCount) {
    console.warn(
      `[dev-mode-generation] Expected ${chapterCount} chapters, got ${chapters.length}. Continuing with what the model returned.`
    );
  }

  return { title, description, chapters };
}

interface DevModeChapterDiagnostic {
  order: number;
  title: string;
  chars: number;
  paragraphs: number;
  dialogPct: number;
  longestSentenceChars: number;
  issues: string[];
}

interface DevModeStoryDiagnostics {
  needsPolish: boolean;
  hardIssueCount: number;
  softIssueCount: number;
  totalChars: number;
  totalWords: number;
  dialogPct: number;
  chapterDiagnostics: DevModeChapterDiagnostic[];
  hardIssues: string[];
  softIssues: string[];
  polishInstructions: string[];
}

function getChapterLengthBounds(config: StoryConfig): { min: number; max: number } {
  // v11 alignment: 5 chapters * max chars must comfortably fit the whole-story
  // word budget. Previous medium=1250 made the per-chapter caps mathematically
  // tighter than the story-word target. Raised so the splitter has room.
  if (config.length === "short") return { min: 650, max: 1250 };
  if (config.length === "long") return { min: 1300, max: 2200 };
  return { min: 800, max: 1450 };
}

function getChapterDraftTargetMaxChars(config: StoryConfig): number {
  const bounds = getChapterLengthBounds(config);
  const margin = config.length === "short" ? 250 : config.length === "long" ? 350 : 200;
  return Math.max(bounds.min, bounds.max - margin);
}

function getChapterRepairTargetMaxChars(config: StoryConfig): number {
  const bounds = getChapterLengthBounds(config);
  const margin = config.length === "short" ? 300 : config.length === "long" ? 450 : 400;
  return Math.max(bounds.min, bounds.max - margin);
}

function getParagraphBounds(config: StoryConfig): { min: number; max: number } {
  if (config.length === "short") return { min: 4, max: 7 };
  if (config.length === "long") return { min: 6, max: 10 };
  return { min: 4, max: 6 };
}

function getParagraphBudgetGuidance(config: StoryConfig): { targetCount: string; maxChars: number } {
  if (config.length === "short") return { targetCount: "4-5", maxChars: 170 };
  if (config.length === "long") return { targetCount: "6-8", maxChars: 240 };
  return { targetCount: "4-5", maxChars: 145 };
}

function countDialogChars(text: string): number {
  return Array.from(text.matchAll(/„[^“]+“|«[^»]+»|"[^"]+"/g)).reduce((sum, match) => sum + match[0].length, 0);
}

function countParagraphs(text: string): number {
  return splitParagraphs(text).length;
}

function countWords(text: string): number {
  return String(text || "")
    .replace(/[^\w\u00c0-\u024f\u1e00-\u1eff'-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function hasForwardPull(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/[?!…]$/.test(trimmed)) return true;
  return /\b(plötzlich|doch|aber|hinter|unter|wartete|hörte|klang|leuchtete|bewegte|flüsterte|flusterte|morgen|nächste|naechste|noch|geheim|warum|wer|was)\b/i.test(trimmed);
}

function longestSentenceChars(text: string): number {
  const sentences = String(text || "")
    .split(/(?<=[.!?…])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  if (sentences.length === 0) return 0;
  return Math.max(...sentences.map((sentence) => sentence.length));
}

function maxSentenceCharsForAge(ageGroup?: StoryConfig["ageGroup"]): number {
  // Aligned with real published children's books (Donaldson, Nordqvist,
  // Steinhöfel): occasional 200-250 char sentences with subordinate clauses
  // are normal and good. Prior 190 cap was defensive; produced borderline
  // 3-char-over hard failures with no real quality difference.
  switch (ageGroup) {
    case "3-5":
      return 170;
    case "6-8":
      return 220;
    case "9-12":
      return 260;
    case "13+":
      return 300;
    default:
      return 230;
  }
}

function buildNameVariants(name: string): string[] {
  const clean = name.trim();
  if (clean.length < 5) return [];
  const variants = new Set<string>();
  for (let i = 0; i < clean.length; i += 1) {
    const variant = clean.slice(0, i) + clean.slice(i + 1);
    if (variant.length >= 4) variants.add(variant);
  }
  return [...variants];
}

function collectNoveltyGateIssues(story: DevModeRawStory, input: DevModeGenerationInput): string[] {
  const brief = input.noveltyBrief;
  if (!brief) return [];
  const issues: string[] = [];
  const title = String(story.title || "");
  const description = String(story.description || "");
  const allContent = story.chapters.map((chapter) => `${chapter.title}\n${chapter.content}`).join("\n\n");
  const normalizedStoryText = normalizeNoveltyText(`${title} ${description} ${allContent}`);
  const normalizedStorySurface = normalizeNoveltyText(`${title} ${description} ${story.chapters.map((chapter) => chapter.title).join(" ")}`);
  const explicitSoundRequest = promptExplicitlyRequestsRepeatedSoundPremise(input.config);

  for (const motif of brief.hardAvoidMotifs) {
    const normalizedMotif = normalizeNoveltyText(motif);
    if (normalizedMotif.length < 6) continue;
    if (NOVELTY_STOPWORDS.has(normalizedMotif)) continue;
    if (isCurrentCharacterNameMotif(normalizedMotif, input)) continue;
    if (explicitSoundRequest && /gloeckchen|glocke|bell|sound|klang|geraeusch|stille|lautlos/.test(normalizedMotif)) {
      continue;
    }
    const surfaceHit = noveltyMotifMatches(normalizedStorySurface, normalizedMotif);
    const fullHits = noveltyMotifHitCount(normalizedStoryText, normalizedMotif);
    const singleWordMotif = !normalizedMotif.includes(" ");

    // A single incidental body mention (e.g. "Geschirr" heard downstairs)
    // should not fail the entire story if the motif is not part of the title,
    // blurb, chapter titles, or repeated premise mechanics.
    if (!surfaceHit && singleWordMotif && fullHits < 2) continue;
    if (!surfaceHit && !singleWordMotif && fullHits === 0) continue;

    if (surfaceHit || fullHits > 0) {
      issues.push(`Wiederholungs-/Novelty-Gate: verbotenes oder kuerzlich verwendetes Motiv gefunden: "${motif}".`);
      break;
    }
  }

  const storyKeywords = extractMotifKeywords(`${title} ${description}`, 12);
  let closestTitle = "";
  let closestScore = 0;
  for (const recent of brief.recentStories) {
    const recentKeywords = recent.motifKeywords.length > 0
      ? recent.motifKeywords
      : extractMotifKeywords(`${recent.title} ${recent.description}`, 12);
    const score = noveltyJaccard(storyKeywords, recentKeywords);
    if (score > closestScore) {
      closestScore = score;
      closestTitle = recent.title;
    }
  }
  if (closestScore >= 0.45) {
    issues.push(`Wiederholungs-/Novelty-Gate: Titel/Blurb ist zu nah an letzter Story "${closestTitle}" (Motivueberschneidung ${Math.round(closestScore * 100)}%).`);
  }

  return issues;
}

// --- Title-promise gate ---------------------------------------------------
// Verifies the title's core content words actually surface in the story body.
// Catches "Der Kühlschrank, der nur Dienstags singt" -> Dienstag is never used.

const TITLE_PROMISE_STOPWORDS_DE = new Set([
  "der","die","das","den","dem","des","ein","eine","einen","einem","einer","eines",
  "und","oder","aber","mit","von","zum","zur","ins","im","am","auf","aus","bei","nach",
  "vor","unter","ueber","über","durch","gegen","ohne","fuer","für","an","zu","als","so",
  "wie","wenn","weil","dass","nur","auch","schon","noch","mehr","mal","ja","nein","nicht",
  "kein","keine","kann","kannst","koennen","koennten","wird","werden","sind","ist","war",
  "waren","hat","hatte","haben","sein","geht","gehen","ging","sehr","viel","viele","dann","wer","was","wo","wann",
  "story","geschichte","kapitel","ende","mit","ohne"
]);

function extractTitleContentWords(title: string): string[] {
  return String(title || "")
    .toLowerCase()
    .replace(/[„""''«»‚‹›()\[\]{},.:;!?—–\-]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 4 && !TITLE_PROMISE_STOPWORDS_DE.has(word));
}

function buildWordStemRegex(word: string): RegExp {
  // Match the stem (first 4-5 chars) followed by any inflection up to 4 chars,
  // so "singt" matches "singen, sang, sing, singend" etc.
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const stem = escaped.slice(0, Math.max(4, Math.min(escaped.length, 5)));
  return new RegExp(`\\b${stem}\\w{0,5}\\b`, "i");
}

function collectTitlePromiseIssues(story: DevModeRawStory, input: DevModeGenerationInput): string[] {
  const titleWords = extractTitleContentWords(story.title || "");
  if (titleWords.length === 0) return [];
  const code = languageCodeFromName(localizedLanguageName(input.config.language));
  if (code !== "de") return []; // stopword list is German for now
  const body = `${story.description || ""}\n${story.chapters.map((chapter) => `${chapter.title}\n${chapter.content}`).join("\n")}`;
  const missing = titleWords.filter((word) => {
    const characterNameMatch = (input.avatars || []).some(
      (avatar) => avatar.name && avatar.name.toLowerCase().includes(word.slice(0, 4))
    );
    if (characterNameMatch) return false;
    return !buildWordStemRegex(word).test(body);
  });
  if (missing.length === 0) return [];
  // Limit to a single soft issue so we don't flood diagnostics.
  return [
    `Titel-Versprechen unerfuellt: Kernwoerter aus dem Titel fehlen im Storytext (${missing.slice(0, 3).join(", ")}). Loese das Titelversprechen im Text ein oder schaerfe den Titel.`,
  ];
}

// --- Age-vocabulary filter ------------------------------------------------
// Flags words too literary/adult for the target age band. Soft-issue only.

const AGE_BANNED_VOCAB_6_8 = new Set([
  "stocksteif","geschniegelt","zinnsoldat","dirigentenstab","mutstein","verbuendete",
  "verbündete","unscheinbar","befangen","ergeben","versichert","ergebnis","insofern",
  "demzufolge","mithin","gleichwohl","dergleichen","wankelmuetig","wankelmütig",
  "argwoehnisch","argwöhnisch","wehmuetig","wehmütig","beflissen","unterfangen",
  "geheimnisumwittert","schicksalhaft","verbluefft","verblüfft","schlauerweise",
  "weisheitlich","grundlegend","durchaus","mithilfe","gegebenenfalls","keineswegs",
  "schlechterdings","mitnichten","weitlaeufig","weitläufig","mannigfaltig","sodann",
  "weiland","fuerderhin","fürderhin","alsbald","unterdessen","nichtsdestoweniger",
  "andernfalls","unbeschadet","abermals","bisweilen","gleichermassen","gleichermaßen",
  "spaehte","spähte","kalibrierte","akzentuierte","sondiert","sondierte",
  "gravitaetisch","gravitätisch","ostentativ","apodiktisch"
]);

const AGE_BANNED_VOCAB_3_5 = new Set([
  ...AGE_BANNED_VOCAB_6_8,
  // tighter list for younger children
  "obwohl","jedoch","beizeiten","unverhofft","wuetend","wütend","entrüstet","entruestet",
  "verstoeren","verstören","entgeistert","schamhaft","tunlichst","umsichtig",
  "behutsam","behaglich","betraechtlich","beträchtlich"
]);

function ageBannedVocab(ageGroup?: string): Set<string> {
  switch (ageGroup) {
    case "3-5": return AGE_BANNED_VOCAB_3_5;
    case "6-8": return AGE_BANNED_VOCAB_6_8;
    case "9-12":
    case "13+":
    default:
      // Older bands: tolerate richer vocabulary; no filter applied.
      return new Set();
  }
}

function collectAgeVocabularyIssues(story: DevModeRawStory, input: DevModeGenerationInput): string[] {
  const code = languageCodeFromName(localizedLanguageName(input.config.language));
  if (code !== "de") return []; // banned list is German for now
  const banned = ageBannedVocab(input.config.ageGroup);
  if (banned.size === 0) return [];
  const allContent = story.chapters
    .map((chapter) => chapter.content.toLowerCase())
    .join("\n");
  const found = new Set<string>();
  for (const word of banned) {
    const regex = new RegExp(`\\b${word}\\b`, "i");
    if (regex.test(allContent)) found.add(word);
  }
  if (found.size === 0) return [];
  return [
    `Alters-Vokabular-Gate (${input.config.ageGroup}): zu erwachsene/literarische Woerter gefunden: ${[...found].slice(0, 5).join(", ")}. Ersetze durch konkretere, kindlichere Sprache.`,
  ];
}

function collectMarketQualitySoftIssues(story: DevModeRawStory, input: DevModeGenerationInput): string[] {
  const issues: string[] = [];
  const finalChapter = story.chapters.slice().sort((a, b) => a.order - b.order).slice(-1)[0];
  const finalTail = finalChapter ? splitParagraphs(finalChapter.content).slice(-2).join(" ") : "";
  const languageCode = languageCodeFromName(localizedLanguageName(input.config.language));

  if (languageCode === "de") {
    const neatLessonPattern = /\b(Fehler|Mut|Freundschaft|Magie|Zauber|Fragen|Zusammenhalt|Geschichten)\b.{0,34}\b(sind|ist|machen|macht|bedeutet|heisst|heißt)\b/i;
    if (neatLessonPattern.test(finalTail)) {
      issues.push("Finale klingt stellenweise wie eine ausgesprochene Lehre; ersetze die Schluss-Aussage durch ein konkretes Bild, eine Handlung oder einen leisen Witz.");
    }
  }

  const selectedCast = input.selectedIdea?.selectedSupportingCast || [];
  if (selectedCast.length > 1 && finalChapter) {
    const finalText = normalizeNoveltyText(finalChapter.content);
    const castHits = selectedCast.filter((name) =>
      characterNameMotifAliases(name).some((alias) => {
        const pattern = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
        return pattern.test(finalText);
      })
    );
    if (castHits.length > 1) {
      issues.push(`Finale wirkt durch mehrere Nebenfiguren potenziell ueberfuellt (${castHits.join(", ")}); pruefe, ob die Hauptavatare die entscheidende Handlung sichtbar selbst tragen.`);
    }
  }

  return issues;
}

function collectSelectedCastIssues(story: DevModeRawStory, input: DevModeGenerationInput): string[] {
  const selectedIdea = input.selectedIdea;
  if (!selectedIdea || !selectedIdea.selectedSupportingCast || selectedIdea.selectedSupportingCast.length === 0) {
    return [];
  }

  const storyText = normalizeNoveltyText([
    story.title,
    story.description,
    ...story.chapters.map((chapter) => `${chapter.title}\n${chapter.content}`),
  ].join("\n"));

  const missing = selectedIdea.selectedSupportingCast.filter((name) => {
    const aliases = characterNameMotifAliases(name);
    if (aliases.length === 0) return false;
    return !aliases.some((alias) => {
      const pattern = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      return pattern.test(storyText);
    });
  });

  if (missing.length === 0) return [];
  return [
    `Pool-Cast-Gate: Ausgewaehlte Nebenfiguren fehlen im Storytext oder bleiben ungenutzt: ${missing.join(", ")}.`,
  ];
}

function analyzeDevModeStoryQuality(
  story: DevModeRawStory,
  input: DevModeGenerationInput,
  chapterCount: number
): DevModeStoryDiagnostics {
  const hardIssues: string[] = [];
  const softIssues: string[] = [];
  const polishInstructions: string[] = [];
  const bounds = getChapterLengthBounds(input.config);
  const paragraphBounds = getParagraphBounds(input.config);
  const maxSentenceChars = maxSentenceCharsForAge(input.config.ageGroup);
  const languageCode = languageCodeFromName(localizedLanguageName(input.config.language));
  const chapterDiagnostics: DevModeChapterDiagnostic[] = [];
  const allContent = story.chapters.map((chapter) => `${chapter.title}\n${chapter.content}`).join("\n\n");
  const totalChars = story.chapters.reduce((sum, chapter) => sum + chapter.content.length, 0);
  const totalWords = countWords(allContent);
  const wordBounds = getStoryWordBounds(input.config);
  const dialogPct = totalChars > 0 ? Math.round((countDialogChars(allContent) / totalChars) * 1000) / 10 : 0;

  if (story.chapters.length !== chapterCount) {
    hardIssues.push(`Erwartet ${chapterCount} Kapitel, erhalten ${story.chapters.length}.`);
  }

  if (/\[object Object\]/i.test(allContent)) {
    hardIssues.push("Kaputte Platzhalter gefunden: [object Object].");
  }

  if (languageCode !== "en" && /"[^"]+"/.test(allContent)) {
    hardIssues.push("ASCII-Anfuehrungszeichen in Storytext gefunden; Dialog muss typografische Zeichen nutzen.");
  }

  if (/\b(Fortsetzung folgt|to be continued)\b/i.test(allContent)) {
    hardIssues.push("Unzulaessiger Fortsetzungs-Hinweis gefunden; Schluss muss geschlossen wirken.");
  }

  const bannedPatterns = [
    /Sie lernten, dass/i,
    /Das groesste Geschenk war/i,
    /Das größte Geschenk war/i,
    /Mit Mut und Zusammenhalt/i,
    /wahre Magie liegt im Herzen/i,
    /alles nur ein Traum/i,
  ];
  for (const pattern of bannedPatterns) {
    if (pattern.test(allContent)) {
      hardIssues.push(`Verbotenes KI-/Moral-Muster gefunden: ${pattern.source}.`);
    }
  }

  for (const noveltyIssue of collectNoveltyGateIssues(story, input)) {
    hardIssues.push(noveltyIssue);
  }
  for (const castIssue of collectSelectedCastIssues(story, input)) {
    hardIssues.push(castIssue);
  }
  for (const titleIssue of collectTitlePromiseIssues(story, input)) {
    softIssues.push(titleIssue);
    polishInstructions.push(
      "Loese das Titel-Versprechen ein: arbeite die zentralen Titel-Begriffe spuerbar in mindestens ein Kapitel ein (gerne als Refrain oder Reim), oder schaerfe den Titel beim Polish so, dass er zum Storyinhalt passt."
    );
  }
  for (const vocabIssue of collectAgeVocabularyIssues(story, input)) {
    softIssues.push(vocabIssue);
    polishInstructions.push(
      "Ersetze zu erwachsene/literarische Woerter durch konkretere, kindlichere Begriffe; nutze Vergleiche aus dem Alltag des Kindes (Spielzeug, Tiere, Essen)."
    );
  }
  for (const qualityIssue of collectMarketQualitySoftIssues(story, input)) {
    softIssues.push(qualityIssue);
    polishInstructions.push(
      "Schaerfe Marktqualitaet: Hauptavatare handeln entscheidend selbst, Magieregel wirkt als Plotmotor, Schluss endet in Bild/Handlung statt Lehre."
    );
  }

  const avatarNames = (input.avatars || []).map((avatar) => avatar.name).filter((name): name is string => Boolean(name));
  for (const name of avatarNames) {
    for (const variant of buildNameVariants(name)) {
      const regex = new RegExp(`\\b${variant}s?\\b`, "g");
      const hits = Array.from(allContent.matchAll(regex)).map((hit) => hit[0]);
      if (hits.length > 0 && variant !== name) {
        hardIssues.push(`Moeglicher Namensfehler bei "${name}": ${[...new Set(hits)].slice(0, 4).join(", ")}.`);
        break;
      }
    }
  }

  if (dialogPct < DEV_MODE_MIN_DIALOG_PCT) {
    hardIssues.push(`Dialoganteil ist mit ${dialogPct}% zu niedrig; Minimum ${DEV_MODE_MIN_DIALOG_PCT}%, Soft-Ziel ${DEV_MODE_TARGET_DIALOG_PCT}%, Prompt-Ziel ${DEV_MODE_PROMPT_DIALOG_PCT}%.`);
  } else if (dialogPct < DEV_MODE_TARGET_DIALOG_PCT) {
    softIssues.push(`Dialoganteil ist mit ${dialogPct}% knapp unter Soft-Zielwert ${DEV_MODE_TARGET_DIALOG_PCT}% trotz Prompt-Ziel ${DEV_MODE_PROMPT_DIALOG_PCT}%.`);
  }

  if (totalWords > wordBounds.max) {
    hardIssues.push(`Story ist deutlich zu lang (${totalWords} Woerter; Ziel ${wordBounds.targetMin}-${wordBounds.targetMax}, Maximum ${wordBounds.max}).`);
    polishInstructions.push("Kuerze den Scope: pro Kapitel nur Hook, Konflikt, Wendung und Pull behalten; dekorative Nebenbilder und Wiederholungen streichen.");
  } else if (totalWords > wordBounds.targetMax) {
    softIssues.push(`Story ist etwas zu lang (${totalWords} Woerter; Ziel ${wordBounds.targetMin}-${wordBounds.targetMax}).`);
    polishInstructions.push("Kuerze Erklaerungen und zweite Sinnesbilder, damit die Geschichte im Zielbereich bleibt.");
  } else if (totalWords < wordBounds.min) {
    softIssues.push(`Story ist sehr knapp (${totalWords} Woerter; Ziel ${wordBounds.targetMin}-${wordBounds.targetMax}).`);
    polishInstructions.push("Nur wenn es der Plot braucht: ein konkretes Handlungsdetail ergaenzen, keine allgemeine Erklaerung.");
  }

  story.chapters.forEach((chapter, index) => {
    const issues: string[] = [];
    const chars = chapter.content.length;
    const paragraphs = countParagraphs(chapter.content);
    const chapterDialogPct = chars > 0 ? Math.round((countDialogChars(chapter.content) / chars) * 1000) / 10 : 0;
    const chapterLongestSentence = longestSentenceChars(chapter.content);
    const chapterPrefix = `Kapitel ${chapter.order || index + 1}`;

    // Grace margin: modest chapter-length variation is a quality warning, not
    // a reason to abort generation. The LLM regularly undercounts characters;
    // keep hard failures for clear pacing problems, not a single fuller scene.
    const chapterHardMaxOver = bounds.max + (
      input.config.length === "short" ? 180 : input.config.length === "long" ? 450 : 300
    );
    const chapterHardMinUnder = Math.max(0, bounds.min - 100);
    if (chars < chapterHardMinUnder) {
      issues.push(`zu kurz (${chars} Zeichen)`);
      hardIssues.push(`${chapterPrefix} ist deutlich zu kurz (${chars}; Ziel ${bounds.min}-${bounds.max}).`);
    } else if (chars < bounds.min) {
      issues.push(`leicht zu kurz (${chars} Zeichen)`);
      softIssues.push(`${chapterPrefix} ist leicht zu kurz (${chars}; Ziel ${bounds.min}-${bounds.max}).`);
    } else if (chars > chapterHardMaxOver) {
      issues.push(`deutlich zu lang (${chars} Zeichen)`);
      hardIssues.push(`${chapterPrefix} ist deutlich zu lang (${chars}; Ziel ${bounds.min}-${bounds.max}).`);
    } else if (chars > bounds.max) {
      issues.push(`leicht zu lang (${chars} Zeichen)`);
      softIssues.push(`${chapterPrefix} ist leicht zu lang (${chars}; Ziel ${bounds.min}-${bounds.max}).`);
    }

    if (paragraphs < paragraphBounds.min) {
      issues.push(`zu wenige Absaetze (${paragraphs})`);
      hardIssues.push(`${chapterPrefix} hat zu wenige Absaetze (${paragraphs}; Ziel ${paragraphBounds.min}-${paragraphBounds.max}).`);
    } else if (paragraphs > paragraphBounds.max) {
      issues.push(`zu viele Absaetze (${paragraphs})`);
      hardIssues.push(`${chapterPrefix} hat zu viele Absaetze (${paragraphs}; Ziel ${paragraphBounds.min}-${paragraphBounds.max}).`);
    }

    const lastParagraph = chapter.content.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean).slice(-1)[0] || "";
    if (index < story.chapters.length - 1 && !hasForwardPull(lastParagraph)) {
      issues.push("Kapitelende hat wenig Weiterlese-Sog");
      softIssues.push(`${chapterPrefix} endet ohne klaren Pull zur naechsten Szene.`);
    }

    if (chapterDialogPct < DEV_MODE_MIN_CHAPTER_DIALOG_PCT) {
      issues.push(`wenig Dialog (${chapterDialogPct}%)`);
      hardIssues.push(`${chapterPrefix} hat zu wenig Dialog (${chapterDialogPct}%; Minimum ${DEV_MODE_MIN_CHAPTER_DIALOG_PCT}%).`);
    }

    // Grace margin: a single sentence overshooting by < 30 chars is a soft
    // warning. Real children's books regularly have 200-260 char sentences
    // with subordinate clauses. Hard fail only for runaway sentences that
    // would actually hurt read-aloud rhythm.
    const sentenceHardCap = maxSentenceChars + 30;
    if (chapterLongestSentence > sentenceHardCap) {
      issues.push(`zu langer Satz (${chapterLongestSentence} Zeichen)`);
      hardIssues.push(`${chapterPrefix} hat einen zu langen Satz (${chapterLongestSentence}; Maximum ${maxSentenceChars} fuer ${input.config.ageGroup}).`);
    } else if (chapterLongestSentence > maxSentenceChars) {
      issues.push(`leicht zu langer Satz (${chapterLongestSentence} Zeichen)`);
      softIssues.push(`${chapterPrefix} hat einen leicht zu langen Satz (${chapterLongestSentence}; Maximum ${maxSentenceChars} fuer ${input.config.ageGroup}).`);
    }

    chapterDiagnostics.push({
      order: chapter.order || index + 1,
      title: chapter.title,
      chars,
      paragraphs,
      dialogPct: chapterDialogPct,
      longestSentenceChars: chapterLongestSentence,
      issues,
    });
  });

  if (hardIssues.some((issue) => /Dialoganteil|ASCII|Namensfehler|\[object Object\]|deutlich zu lang|zu wenige Absaetze|zu viele Absaetze/i.test(issue))) {
    polishInstructions.push("Behebe alle harten Form- und Oberflaechenfehler vollstaendig.");
  }
  if (dialogPct < DEV_MODE_MIN_DIALOG_PCT) {
    polishInstructions.push(`Erhoehe den Dialoganteil sicher ueber ${DEV_MODE_MIN_DIALOG_PCT}% und peile beim Schreiben ${DEV_MODE_PROMPT_DIALOG_PCT}% an, indem Erklaerungen in charakterstarke Dialoge mit Handlung/Subtext umgebaut werden. Nicht durch Fuellsaetze aufblaehen.`);
  }
  if (hardIssues.concat(softIssues).some((issue) => /Laenge|lang|kurz|Absaetze/i.test(issue))) {
    polishInstructions.push(`Bringe Kapitel naeher an ${bounds.min}-${bounds.max} Zeichen und ${paragraphBounds.min}-${paragraphBounds.max} Absaetze, ohne die Szenenhaftigkeit zu verlieren.`);
  }
  if (hardIssues.some((issue) => /zu langen Satz/i.test(issue))) {
    polishInstructions.push("Kuerze zu lange Saetze: aufteilen, Nebensaetze entfernen und kindnahe Hauptsaetze bevorzugen.");
  }
  if (softIssues.some((issue) => /Pull|Weiterlese/i.test(issue))) {
    polishInstructions.push("Schaerfe jedes Nicht-Final-Kapitelende: letzter Absatz mit Frage, Gefahr, Entscheidung, komischem Nachhall oder neuem konkretem Detail.");
  }
  polishInstructions.push("Staerke Lesesog und Wiedererkennung: ein Leitmotiv/Refrain/Objekt soll in mehreren Kapiteln wiederkommen und im Finale emotional oder plotrelevant auszahlen.");
  polishInstructions.push("Fixe Namens-, Tipp- und Grammatikfehler. Keine neuen Figuren, keine neue Nebenhandlung, keine Meta-Erklaerung.");

  const needsPolish = hardIssues.length > 0 || softIssues.length >= 3;
  return {
    needsPolish,
    hardIssueCount: hardIssues.length,
    softIssueCount: softIssues.length,
    totalChars,
    totalWords,
    dialogPct,
    chapterDiagnostics,
    hardIssues,
    softIssues,
    polishInstructions: [...new Set(polishInstructions)],
  };
}

function parseStageObject(content: string): { parsed?: any; parseError?: string } {
  try {
    return { parsed: tryParseJson(content) };
  } catch (err) {
    return {
      parseError: err instanceof Error ? err.message : String(err),
    };
  }
}

function usageSum(results: ProviderResult[]): { prompt: number; completion: number; total: number } {
  return results.reduce(
    (acc, result) => ({
      prompt: acc.prompt + result.usage.prompt,
      completion: acc.completion + result.usage.completion,
      total: acc.total + result.usage.total,
    }),
    { prompt: 0, completion: 0, total: 0 }
  );
}

function extractQualityScore(parsed: any): number | null {
  const raw =
    parsed?.marketQualityScore ??
    parsed?.score10 ??
    parsed?.score ??
    parsed?.qualityScore ??
    null;
  if (raw == null || raw === "") return null;
  const score = Number(raw);
  if (!Number.isFinite(score)) return null;
  if (score > 10 && score <= 100) return score / 10;
  return score;
}

function releaseDimensionFailures(validatorFindings: any): string[] {
  const scores = validatorFindings?.dimensionScores;
  if (!scores || typeof scores !== "object") return [];

  const checks: Array<[string, number | undefined]> = [
    ["redThreadScore", Math.min(Number(scores.causalChain ?? 0), Number(scores.centralConflict ?? 0))],
    ["readOnPullScore", Math.min(Number(scores.chapterEndPull ?? 0), Number(scores.pageTurnDrive ?? 0))],
    ["childComprehensionScore", Number(scores.ageFit ?? 0)],
    ["emotionalPayoffScore", Math.min(
      Number(scores.emotionalEngine ?? 0),
      Number(scores.keyMomentPayoff ?? 0),
      Number(scores.endingPayoff ?? 0)
    )],
  ];

  return checks
    .filter(([, score]) => Number.isFinite(score) && Number(score) < DEV_MODE_MIN_RELEASE_DIMENSION_SCORE)
    .map(([name, score]) => `${name} ${score} is below ${DEV_MODE_MIN_RELEASE_DIMENSION_SCORE}.`);
}

function calculateLocalGateScore(diagnostics?: DevModeStoryDiagnostics): number | undefined {
  if (!diagnostics) return undefined;

  let score = 9.5;
  if (diagnostics.dialogPct < DEV_MODE_TARGET_DIALOG_PCT) score -= 0.3;
  if (diagnostics.dialogPct < DEV_MODE_MIN_DIALOG_PCT) score -= 0.4;
  if (diagnostics.dialogPct < 18) score -= 0.5;
  for (const chapter of diagnostics.chapterDiagnostics) {
    if (chapter.dialogPct < DEV_MODE_MIN_CHAPTER_DIALOG_PCT) score -= 0.2;
    if (chapter.issues.some((issue) => /Absätze|Absaetze/i.test(issue))) score -= 0.2;
    if (chapter.issues.some((issue) => /kurz|lang|Laenge|Länge/i.test(issue))) score -= 0.15;
  }

  if (diagnostics.hardIssueCount > 0) score = Math.min(score, 8.6);
  if (diagnostics.hardIssueCount >= 4) score = Math.min(score, 8.2);
  if (diagnostics.hardIssues.some((issue) => /Verbotenes|Moral|ASCII|Namensfehler|Novelty|Wiederholungs|\[object Object\]/i.test(issue))) {
    score = Math.min(score, 7.8);
  }

  return Math.max(0, Math.round(score * 10) / 10);
}

function applyHardCaps(llmScore: number | undefined, diagnostics?: DevModeStoryDiagnostics): number | undefined {
  const localGateScore = calculateLocalGateScore(diagnostics);
  let score = typeof llmScore === "number" && Number.isFinite(llmScore) ? llmScore : localGateScore;
  if (score === undefined) return undefined;

  if (diagnostics) {
    if (diagnostics.dialogPct < DEV_MODE_MIN_DIALOG_PCT) score = Math.min(score, 8.4);
    if (diagnostics.dialogPct < 18) score = Math.min(score, 7.9);
    if (diagnostics.hardIssueCount > 0) score = Math.min(score, 8.6);
    if (diagnostics.hardIssueCount >= 4) score = Math.min(score, 8.2);
    if (diagnostics.hardIssues.some((issue) => /Absätze|Absaetze/i.test(issue))) {
      score = Math.min(score, 8.6);
    }
    if (diagnostics.chapterDiagnostics.some((chapter) => chapter.dialogPct < DEV_MODE_MIN_CHAPTER_DIALOG_PCT)) {
      score = Math.min(score, 8.5);
    }
    if (diagnostics.hardIssues.some((issue) => /deutlich zu lang|deutlich zu kurz/i.test(issue))) {
      score = Math.min(score, 8.7);
    }
    if (diagnostics.hardIssues.some((issue) => /zu langen Satz/i.test(issue))) {
      score = Math.min(score, 8.6);
    }
    if (diagnostics.hardIssues.some((issue) => /Verbotenes|Moral|ASCII|Namensfehler|Novelty|Wiederholungs|\[object Object\]/i.test(issue))) {
      score = Math.min(score, 7.8);
    }
    // --- v11 scoring caps (whole-story-first spec) ----------------------
    // Title promise missing -> max 8.2 (per spec).
    if (diagnostics.softIssues.some((issue) => /Titel-Versprechen unerfuellt/i.test(issue))) {
      score = Math.min(score, 8.2);
    }
    // Finale sounds like an explained moral -> max 7.5 (per spec).
    if (diagnostics.softIssues.some((issue) => /ausgesprochene Lehre|wie eine Lehre|erklaerte Moral/i.test(issue))) {
      score = Math.min(score, 7.5);
    }
    // Novelty core-fail -> max 7.0 (per spec). Incidental single-word hits
    // are already filtered to soft warnings inside collectNoveltyGateIssues.
    if (diagnostics.hardIssues.some((issue) => /Novelty|Wiederholungs/i.test(issue))) {
      score = Math.min(score, 7.0);
    }
    // Helper/cast explains the solution OR steals decisive action
    // (surfaced as a market-quality soft issue) -> max 8.2.
    if (diagnostics.softIssues.some((issue) => /erklaert die Loesung|nimmt die finale Handlung|steht im Finale im Zentrum/i.test(issue))) {
      score = Math.min(score, 8.2);
    }
    // Finale mechanism repeats an earlier chapter's payoff -> max 8.4 (spec).
    if (diagnostics.softIssues.some((issue) => /Finale wiederholt|Payoff wiederholt|wiederholtes Payoff/i.test(issue))) {
      score = Math.min(score, 8.4);
    }
    // Weak weiterlese-pull on two or more non-final chapters -> max 8.5.
    {
      const weakPullCount = diagnostics.softIssues.filter((issue) =>
        /wenig Weiterlese-Sog|schwacher Pull|ohne klaren Pull|Kapitelende ohne Sog/i.test(issue)
      ).length;
      if (weakPullCount >= 2) score = Math.min(score, 8.5);
    }
    // Single magic rule never tested twice on-page before the finale -> max 8.4.
    if (diagnostics.softIssues.some((issue) => /Wunder-Regel nicht zweimal|Magie-Regel nur einmal|Regel nicht getestet/i.test(issue))) {
      score = Math.min(score, 8.4);
    }
    // Too many formulaic catchphrase / fixed-opener uses -> max 8.5.
    if (diagnostics.softIssues.some((issue) => /formulaic|formelhaft|Catchphrase wiederholt|fester Eingangssatz/i.test(issue))) {
      score = Math.min(score, 8.5);
    }
    // Story-level dialogue clearly under floor -> max 8.4 (per spec).
    if (diagnostics.dialogPct < DEV_MODE_MIN_DIALOG_PCT) {
      score = Math.min(score, 8.4);
    }
  }

  if (typeof localGateScore === "number") {
    score = Math.min(score, localGateScore);
  }

  return Math.max(0, Math.round(score * 10) / 10);
}

function diagnosticsSeverityScore(
  diagnostics: DevModeStoryDiagnostics,
  expectedChapterCount: number,
  config?: StoryConfig
): number {
  const chapterCountPenalty = Math.abs(diagnostics.chapterDiagnostics.length - expectedChapterCount) * 1000;
  const dialogPenalty =
    Math.max(0, DEV_MODE_MIN_DIALOG_PCT - diagnostics.dialogPct) * 80
    + Math.max(0, DEV_MODE_TARGET_DIALOG_PCT - diagnostics.dialogPct) * 10;
  const bounds = config ? getChapterLengthBounds(config) : undefined;
  const paragraphBounds = config ? getParagraphBounds(config) : { min: DEV_MODE_MIN_PARAGRAPHS, max: DEV_MODE_MAX_PARAGRAPHS };
  const chapterPenalty = diagnostics.chapterDiagnostics.reduce((sum, chapter) => {
    const lengthPenalty = bounds
      ? (Math.max(0, chapter.chars - bounds.max) + Math.max(0, bounds.min - chapter.chars)) * 0.8
      : 0;
    const paragraphPenalty =
      Math.max(0, paragraphBounds.min - chapter.paragraphs) * 120
      + Math.max(0, chapter.paragraphs - paragraphBounds.max) * 120;
    const chapterDialogPenalty =
      Math.max(0, DEV_MODE_MIN_CHAPTER_DIALOG_PCT - chapter.dialogPct) * 60
      + Math.max(0, DEV_MODE_TARGET_DIALOG_PCT - chapter.dialogPct) * 8;
    return sum + lengthPenalty + paragraphPenalty + chapterDialogPenalty;
  }, 0);
  return chapterCountPenalty
    + diagnostics.hardIssueCount * 1000
    + diagnostics.softIssueCount * 50
    + dialogPenalty
    + chapterPenalty;
}

function isDiagnosticsBetter(
  candidate: DevModeStoryDiagnostics,
  currentBest: DevModeStoryDiagnostics | undefined,
  expectedChapterCount: number,
  config?: StoryConfig
): boolean {
  if (!currentBest) return true;
  return diagnosticsSeverityScore(candidate, expectedChapterCount, config) < diagnosticsSeverityScore(currentBest, expectedChapterCount, config);
}

function formatQualityGateFailureReason(diagnostics?: DevModeStoryDiagnostics): string | undefined {
  if (!diagnostics || diagnostics.hardIssueCount === 0) return undefined;
  const visibleIssues = diagnostics.hardIssues.slice(0, 12);
  const hiddenCount = diagnostics.hardIssues.length - visibleIssues.length;
  return [
    `Developer-mode story still has ${diagnostics.hardIssueCount} hard local gate issue(s) after repair.`,
    visibleIssues.join(" | "),
    hiddenCount > 0 ? `… plus ${hiddenCount} more.` : "",
  ].filter(Boolean).join(" ");
}

interface ProviderResult {
  content: string;
  usage: { prompt: number; completion: number; total: number };
  modelUsed: string;
}

interface ProviderCallOptions {
  stage?: DevModePipelineStage;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  modelOverride?: string;
  providerOverride?: AIProvider;
  openRouterModelOverride?: string;
  modelRole?: "support" | "selected-story";
}

function extractChatChoiceContent(choice: any): string {
  const content = choice?.message?.content ?? choice?.text ?? "";
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (typeof part?.text === "string") return part.text;
        if (typeof part?.content === "string") return part.content;
        return "";
      })
      .join("\n")
      .trim();
  }
  return "";
}

function shouldForceOpenRouterJsonObject(model: string): boolean {
  const normalized = String(model || "").toLowerCase();
  // Some OpenRouter-routed providers don't honor OpenAI's
  // response_format=json_object consistently. In production we saw Gemini Pro
  // return malformed repairs and Kimi return an empty story draft with
  // finish_reason=length when JSON mode was forced. Keep strict JSON
  // instructions in the prompt, but do not force provider-level JSON mode for
  // these families.
  if (isOpenRouterTextCompatibilityModel(normalized)) return false;
  return true;
}

function isOpenRouterTextCompatibilityModel(model: string): boolean {
  const normalized = String(model || "").toLowerCase();
  return /claude|anthropic|google\/gemini|gemini-pro|gemini-flash|moonshot|kimi|mini.?max|minimax|qwen|deepseek|zhipu|glm|baidu|ernie|alibaba|dashscope|tencent|hunyuan|stepfun|01-ai|yi-|bytedance|doubao/.test(normalized);
}

function isOpenRouterCompactDraftModel(model: string): boolean {
  const normalized = String(model || "").toLowerCase();
  return /moonshot|kimi|mini.?max|minimax|qwen|deepseek|zhipu|glm|baidu|ernie|alibaba|dashscope|tencent|hunyuan|stepfun|01-ai|yi-|bytedance|doubao/.test(normalized);
}

function resolveSelectedOpenRouterStoryModel(config: StoryConfig): string {
  return normalizeOpenRouterModel(
    (isOpenRouterFamilyModel(config.openRouterModel) ? config.openRouterModel : undefined)
    || (isOpenRouterFamilyModel(resolveConfiguredStoryModel(config)) ? resolveConfiguredStoryModel(config) : undefined)
    || config.openRouterModel
    || resolveConfiguredStoryModel(config)
  );
}

function shouldUseCompactOpenRouterDraft(config: StoryConfig): boolean {
  if (config.aiProvider !== "openrouter") return false;
  return true;
}

function isRecoverableStoryDraftFailure(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error ?? "")).toLowerCase();
  return message.includes("empty response from openrouter")
    || message.includes("finish_reason=length")
    || message.includes("finish_reason=max_tokens")
    || message.includes("developer-mode generation returned unparseable json")
    || message.includes("unterminated string")
    || message.includes("unexpected token")
    || message.includes("timed out")
    || message.includes("timeout");
}

function devModeStoryDraftMaxTokens(config: StoryConfig, compactMode: boolean, retry: boolean): number {
  if (config.length === "long") return retry ? 12000 : compactMode ? 9800 : 9200;
  if (config.length === "short") return retry ? 4200 : compactMode ? 3400 : 3200;
  return retry ? 5200 : compactMode ? 4200 : 4300;
}

function devModeStoryPolishMaxTokens(config: StoryConfig): number {
  if (config.length === "long") return 7800;
  if (config.length === "short") return 2600;
  return 3400;
}

function devModeStoryDraftTimeoutMs(config: StoryConfig, retry: boolean): number {
  if (config.length === "long") return retry ? 420_000 : 300_000;
  return retry ? 330_000 : 240_000;
}

function resolveDevModeSupportProvider(_config: StoryConfig): AIProvider {
  return "openrouter";
}

function resolveDevModeSupportModel(_config: StoryConfig): string {
  return DEV_MODE_SUPPORT_MODEL;
}

function buildDevModeSupportCallOptions(config: StoryConfig): Pick<ProviderCallOptions, "modelOverride" | "providerOverride" | "openRouterModelOverride"> {
  const supportProvider = resolveDevModeSupportProvider(config);
  const supportModel = resolveDevModeSupportModel(config);
  return {
    modelOverride: supportModel,
    providerOverride: supportProvider,
    openRouterModelOverride: supportProvider === "openrouter" ? supportModel : undefined,
  };
}

async function callProvider(
  config: StoryConfig,
  systemPrompt: string,
  userPrompt: string,
  options: ProviderCallOptions = {}
): Promise<ProviderResult> {
  const configuredStoryModel = resolveConfiguredStoryModel(config);
  const requestedModel = (options.modelOverride || configuredStoryModel || config.aiModel || DEFAULT_GEMINI_MODEL).trim();
  const aiProvider: AIProvider =
    options.providerOverride ||
    (isOpenRouterFamilyModel(requestedModel) || config.aiProvider === "openrouter"
      ? "openrouter"
      : "native");
  const openRouterModel =
    options.openRouterModelOverride ||
    (isOpenRouterFamilyModel(config.openRouterModel) ? config.openRouterModel : undefined) ||
    (isOpenRouterFamilyModel(requestedModel) ? requestedModel : undefined) ||
    (isOpenRouterFamilyModel(configuredStoryModel) ? configuredStoryModel : undefined);
  const maxTokens = options.maxTokens ?? 16000;
  const temperature = options.temperature ?? 0.9;

  if (aiProvider === "openrouter") {
    const orModel = normalizeOpenRouterModel(openRouterModel);
    const forceJsonObjectFormat = shouldForceOpenRouterJsonObject(orModel);
    console.log(`[dev-mode-generation] Calling OpenRouter model: ${orModel}`, {
      forceJsonObjectFormat,
    });
    const timeoutMs =
      options.timeoutMs ??
      (config.length === "long" ? 360_000 : config.length === "medium" ? 240_000 : 180_000);
    const controller = new AbortController();
    const handle = setTimeout(() => controller.abort(), timeoutMs);

    let res: Awaited<ReturnType<typeof callOpenRouterChatCompletion>>;
    try {
      res = await callOpenRouterChatCompletion({
        model: orModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        maxTokens,
        responseFormat: forceJsonObjectFormat ? "json_object" : "text",
        temperature,
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as any)?.name === "AbortError") {
        throw new Error(`OpenRouter request timed out after ${timeoutMs / 1000}s (dev mode, model=${orModel}, stage=${options.stage || "unknown"}).`);
      }
      throw err;
    } finally {
      clearTimeout(handle);
    }
    const choice = res.data.choices?.[0];
    const content = extractChatChoiceContent(choice);
    if (!content) {
      const finishReason = choice?.finish_reason ?? "unknown";
      throw new Error(`Empty response from OpenRouter (dev mode, model=${orModel}, stage=${options.stage || "unknown"}, finish_reason=${finishReason}).`);
    }
    const usage = res.data.usage || {};
    return {
      content,
      usage: {
        prompt: Number(usage.prompt_tokens || 0),
        completion: Number(usage.completion_tokens || 0),
        total: Number(usage.total_tokens || 0),
      },
      modelUsed: orModel,
    };
  }

  if (requestedModel.startsWith("gemini-")) {
    if (!isGeminiConfigured()) {
      throw new Error("Gemini API not configured. Set GeminiAPIKey secret.");
    }
    console.log(`[dev-mode-generation] Calling Gemini model: ${requestedModel}`);
    const res = await generateWithGemini({
      systemPrompt,
      userPrompt,
      model: requestedModel,
      maxTokens: Math.max(maxTokens, 1024),
      temperature,
      fetchTimeoutMs: options.timeoutMs,
      logSource: "dev-mode-generation",
      logMetadata: { devMode: true, stage: options.stage },
    });
    return {
      content: res.content,
      usage: {
        prompt: res.usage.promptTokens,
        completion: res.usage.completionTokens,
        total: res.usage.totalTokens,
      },
      modelUsed: res.model,
    };
  }

  if (requestedModel.startsWith("claude-")) {
    console.log(`[dev-mode-generation] Calling Anthropic model: ${requestedModel}`);
    const res = await callAnthropicCompletion({
      model: requestedModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      maxTokens,
      temperature,
      context: "dev-mode-generation",
      logSource: "dev-mode-generation",
      logMetadata: { devMode: true, stage: options.stage },
    });
    return {
      content: res.content,
      usage: {
        prompt: res.usage?.promptTokens ?? 0,
        completion: res.usage?.completionTokens ?? 0,
        total: res.usage?.totalTokens ?? 0,
      },
      modelUsed: requestedModel,
    };
  }

  // Default: OpenAI native (gpt-*, o4-*, etc.)
  console.log(`[dev-mode-generation] Calling OpenAI model: ${requestedModel}`);
  const payload = {
    model: requestedModel,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_completion_tokens: maxTokens,
    response_format: { type: "json_object" },
  };

  const timeoutMs =
    options.timeoutMs ??
    (config.length === "long" ? 360_000 : config.length === "medium" ? 240_000 : 180_000);
  const controller = new AbortController();
  const handle = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAIKey()}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as any)?.name === "AbortError") {
      throw new Error(`OpenAI request timed out after ${timeoutMs / 1000}s (dev mode).`);
    }
    throw err;
  } finally {
    clearTimeout(handle);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI API error (dev mode): ${response.status} - ${text}`);
  }

  const data: any = await response.json();
  const content = data?.choices?.[0]?.message?.content || "";
  if (!content) throw new Error("Empty response from OpenAI (dev mode).");

  return {
    content,
    usage: {
      prompt: Number(data?.usage?.prompt_tokens || 0),
      completion: Number(data?.usage?.completion_tokens || 0),
      total: Number(data?.usage?.total_tokens || 0),
    },
    modelUsed: requestedModel,
  };
}

export async function generateStoryDevMode(
  input: DevModeGenerationInput
): Promise<DevModeGeneratedStory> {
  const chapterCount = deriveChapterCount(input.config.length);
  const avatarNames = (input.avatars || []).map((a) => a.name).filter(Boolean);
  const poolNames = (input.poolCharacters || []).map((c) => c.name);
  const stageLogs: DevModeStageLog[] = [];
  const providerResults: ProviderResult[] = [];
  const startedAt = Date.now();
  const supportProvider = resolveDevModeSupportProvider(input.config);
  const supportModel = resolveDevModeSupportModel(input.config);
  const supportCallOptions = buildDevModeSupportCallOptions(input.config);
  const recentStoryFingerprints = input.noveltyBrief?.recentStories || await loadRecentDevModeStoryFingerprints(input);
  input = {
    ...input,
    noveltyBrief: input.noveltyBrief || buildDevModeNoveltyBrief(input, recentStoryFingerprints),
  };

  const runStage = async (
    stage: DevModePipelineStage,
    prompts: { systemPrompt: string; userPrompt: string },
    options: ProviderCallOptions
  ): Promise<{ provider: ProviderResult; parsed?: any; parseError?: string }> => {
    const stageStartedAt = Date.now();
    const logEntry: DevModeStageLog = {
      stage,
      systemPrompt: prompts.systemPrompt,
      userPrompt: prompts.userPrompt,
      modelRole: options.modelRole,
    };
    stageLogs.push(logEntry);

    const publishStageLog = async (extra?: { error?: string }) => {
      await publishWithTimeout(logTopic, {
        source: "dev-mode-generation-stage",
        timestamp: new Date(),
        request: {
          mode: "developer",
          pipeline: DEV_MODE_PIPELINE_ID,
          stage,
          modelRole: options.modelRole,
          requestedModel: options.modelOverride || input.config.aiModel,
          supportModel,
          supportProvider,
          aiProvider: options.providerOverride || input.config.aiProvider,
          openRouterModel: options.openRouterModelOverride || input.config.openRouterModel,
          systemPrompt: prompts.systemPrompt,
          userPrompt: prompts.userPrompt,
        },
        response: {
          stage,
          rawContent: logEntry.rawContent,
          contentLength: logEntry.rawContent?.length ?? 0,
          parsed: logEntry.parsed,
          parseError: logEntry.parseError,
          usage: logEntry.usage,
          modelUsed: logEntry.modelUsed,
          modelRole: logEntry.modelRole,
          durationMs: logEntry.durationMs,
          score: extractQualityScore(logEntry.parsed),
          error: extra?.error,
        },
        metadata: {
          devMode: true,
          pipeline: DEV_MODE_PIPELINE_ID,
          stage,
          modelRole: options.modelRole,
          individualStage: true,
          failed: Boolean(extra?.error),
        },
      }).catch((logErr) => {
        console.warn(`[dev-mode-generation] Failed to publish stage log for ${stage}:`, logErr);
      });
    };

    try {
      const provider = await callProvider(
        input.config,
        prompts.systemPrompt,
        prompts.userPrompt,
        { ...options, stage }
      );
      providerResults.push(provider);
      const parsedStage = parseStageObject(provider.content);

      logEntry.rawContent = provider.content;
      logEntry.parsed = parsedStage.parsed;
      logEntry.parseError = parsedStage.parseError;
      logEntry.usage = provider.usage;
      logEntry.modelUsed = provider.modelUsed;
      logEntry.modelRole = options.modelRole;
      logEntry.durationMs = Date.now() - stageStartedAt;

      await publishStageLog();
      return { provider, ...parsedStage };
    } catch (err) {
      logEntry.error = err instanceof Error ? err.message : String(err);
      logEntry.durationMs = Date.now() - stageStartedAt;
      await publishStageLog({ error: logEntry.error });
      throw err;
    }
  };

  console.log("[dev-mode-generation] Dev mode adaptive chapter-repair quality pipeline", {
    pipeline: DEV_MODE_PIPELINE_ID,
    chapterCount,
    ageGroup: input.config.ageGroup,
    genre: input.config.genre,
    setting: input.config.setting,
    avatarCount: avatarNames.length,
    avatarNames,
    poolCharacterCount: poolNames.length,
    poolCharacterNames: poolNames,
    aiModel: input.config.aiModel,
    aiProvider: input.config.aiProvider,
    supportProvider,
    supportModel,
    storyModel: resolveConfiguredStoryModel(input.config),
    noveltySeed: input.noveltyBrief?.seed,
    recentStoryCount: input.noveltyBrief?.recentStories.length ?? 0,
    hardAvoidMotifCount: input.noveltyBrief?.hardAvoidMotifs.length ?? 0,
    noveltyKeyMomentLens: input.noveltyBrief?.keyMomentLens,
    selectedIdeaTitle: input.selectedIdea?.title,
    selectedSupportingCast: input.selectedIdea?.selectedSupportingCast,
  });

  let finalParsed: DevModeRawStory | null = null;
  let finalModelUsed: string = input.config.aiModel || DEFAULT_GEMINI_MODEL;
  let finalQualityScore: number | undefined;
  let rawQualityScore: number | undefined;
  let localGateScore: number | undefined;
  let finalValidatorFindings: any | undefined;
  let finalDiagnostics: DevModeStoryDiagnostics | undefined;
  let storyPolishApplied = false;
  let chapterRepairApplied = false;
  let qualityGateFailureReason: string | undefined;
  const repairSelfReflections: any[] = [];
  let ideaCandidates: DevModeIdeaCandidate[] = [];
  let selectedIdea: DevModeSelectedIdea | undefined;

  try {
    const ideaCandidatePrompts = buildIdeaCandidatePrompts(input, chapterCount);
    const ideaCandidatesStage = await runStage("idea-candidates", ideaCandidatePrompts, {
      maxTokens: 2400,
      temperature: 0.92,
      timeoutMs: 90_000,
      ...supportCallOptions,
      modelRole: "support",
    });
    ideaCandidates = normalizeIdeaCandidates(ideaCandidatesStage.parsed, input.poolCharacters);

    if (ideaCandidates.length > 0) {
      const ideaSelectionPrompts = buildIdeaSelectionPrompts(input, chapterCount, ideaCandidates);
      const ideaSelectionStage = await runStage("idea-selection", ideaSelectionPrompts, {
        maxTokens: 1100,
        temperature: 0.22,
        timeoutMs: 90_000,
        ...supportCallOptions,
        modelRole: "support",
      });
      const modelSelectedIdea =
        normalizeIdeaSelection(ideaSelectionStage.parsed, ideaCandidates, input.poolCharacters) ||
        fallbackSelectedIdea(ideaCandidates, input.poolCharacters);
      selectedIdea = enforceSelectedIdeaNovelty(
        modelSelectedIdea,
        ideaCandidates,
        input,
        input.poolCharacters
      );
      if (
        modelSelectedIdea
        && selectedIdea
        && normalizePoolName(modelSelectedIdea.title) !== normalizePoolName(selectedIdea.title)
      ) {
        console.warn("[dev-mode-generation] Server novelty audit overrode model idea selection", {
          modelSelectedIdea: modelSelectedIdea.title,
          finalSelectedIdea: selectedIdea.title,
          reason: selectedIdea.chosenReason,
        });
      }
    } else {
      console.warn("[dev-mode-generation] Idea lab returned no usable candidates; continuing without locked winning idea.");
    }

    if (selectedIdea) {
      const finalizedCast = finalizeSelectedIdeaCast(input, selectedIdea, input.poolCharacters);
      selectedIdea = finalizedCast.selectedIdea;
      input = {
        ...input,
        selectedIdea,
        poolCharacters: finalizedCast.poolCharacters,
      };
    }

    const blueprintPrompts = buildBlueprintPrompts(input, chapterCount);
    let blueprintStage = await runStage("blueprint", blueprintPrompts, {
      maxTokens: input.config.length === "long" ? 5200 : 4300,
      temperature: 0.45,
      timeoutMs: 120_000,
      ...supportCallOptions,
      modelRole: "support",
    });
    if (!blueprintStage.parsed) {
      console.warn("[dev-mode-generation] Blueprint did not parse; retrying once with compact blueprint prompt", {
        parseError: blueprintStage.parseError,
        rawContentChars: blueprintStage.provider.content.length,
      });
      const compactBlueprintPrompts = buildBlueprintPrompts(input, chapterCount, {
        compactRetry: true,
        retryReason: blueprintStage.parseError,
      });
      const retryBlueprintStage = await runStage("blueprint", compactBlueprintPrompts, {
        maxTokens: input.config.length === "long" ? 4600 : 3200,
        temperature: 0.28,
        timeoutMs: 120_000,
        ...supportCallOptions,
        modelRole: "support",
      });
      if (retryBlueprintStage.parsed) {
        blueprintStage = retryBlueprintStage;
      }
    }
    let blueprint = blueprintStage.parsed || {
      rawBlueprint: blueprintStage.provider.content,
      parseWarning: blueprintStage.parseError,
    };

    let critique: any = null;
    let blueprintScore = 0;
    let bestBlueprint = blueprint;
    let bestCritique: any = null;
    let bestBlueprintScore = Number.NEGATIVE_INFINITY;
    for (let blueprintAttempt = 0; blueprintAttempt <= DEV_MODE_MAX_BLUEPRINT_REPAIR_ATTEMPTS; blueprintAttempt += 1) {
      const critiquePrompts = buildCritiquePrompts(input, chapterCount, blueprint);
      const critiqueStage = await runStage("dramaturgy-check", critiquePrompts, {
        maxTokens: 3600,
        temperature: 0.28,
        timeoutMs: 120_000,
        ...supportCallOptions,
        modelRole: "support",
      });
      critique = critiqueStage.parsed || {
        rawCritique: critiqueStage.provider.content,
        parseWarning: critiqueStage.parseError,
      };
      blueprintScore = extractQualityScore(critique) ?? 0;
      const reviewedBlueprint = getReviewedBlueprint(blueprint, critique);
      blueprint = reviewedBlueprint;
      if (blueprintScore > bestBlueprintScore) {
        bestBlueprintScore = blueprintScore;
        bestBlueprint = reviewedBlueprint;
        bestCritique = critique;
      }

      if (blueprintScore >= DEV_MODE_BLUEPRINT_TARGET_SCORE) {
        break;
      }

      if (blueprintAttempt >= DEV_MODE_MAX_BLUEPRINT_REPAIR_ATTEMPTS) {
        blueprint = bestBlueprint;
        critique = bestCritique || critique;
        blueprintScore = Number.isFinite(bestBlueprintScore) ? bestBlueprintScore : blueprintScore;
        if (blueprintScore < DEV_MODE_BLUEPRINT_HARD_FLOOR_SCORE) {
          console.warn("[dev-mode-generation] Blueprint stayed below hard floor after repairs; continuing for stability with final release warnings", {
            score: blueprintScore,
            hardFloor: DEV_MODE_BLUEPRINT_HARD_FLOOR_SCORE,
            repairAttempts: DEV_MODE_MAX_BLUEPRINT_REPAIR_ATTEMPTS,
          });
        }
        console.warn("[dev-mode-generation] Blueprint stayed below target after repairs; continuing with best blueprint and final release warnings if needed", {
          score: blueprintScore,
          targetScore: DEV_MODE_BLUEPRINT_TARGET_SCORE,
          hardFloor: DEV_MODE_BLUEPRINT_HARD_FLOOR_SCORE,
          repairAttempts: DEV_MODE_MAX_BLUEPRINT_REPAIR_ATTEMPTS,
        });
        break;
      }

      console.warn("[dev-mode-generation] Blueprint below target; repairing before draft", {
        attempt: blueprintAttempt + 1,
        score: blueprintScore,
        targetScore: DEV_MODE_BLUEPRINT_TARGET_SCORE,
        hardFloor: DEV_MODE_BLUEPRINT_HARD_FLOOR_SCORE,
      });

      const blueprintRepairPrompts = buildBlueprintRepairPrompts(input, chapterCount, blueprint, critique, blueprintAttempt + 1);
      const blueprintRepairStage = await runStage("blueprint-repair", blueprintRepairPrompts, {
        maxTokens: 3000,
        temperature: 0.24,
        timeoutMs: 120_000,
        ...supportCallOptions,
        modelRole: "support",
      });
      const patch =
        blueprintRepairStage.parsed?.revisedBlueprintPatch ||
        blueprintRepairStage.parsed?.blueprintPatch ||
        blueprintRepairStage.parsed?.patch ||
        (blueprintRepairStage.parsed?.storySpine || blueprintRepairStage.parsed?.chapterPlan
          ? blueprintRepairStage.parsed
          : {});
      blueprint = mergeBlueprintObjects(blueprint, patch || {});
    }

    // ---- WHOLE-STORY-FIRST PIPELINE (v11) -------------------------------
    // 1) Selected story model writes ONE continuous narrative as paragraphs[].
    // 2) Support model splits the prose into display chapters with titles.
    // On failure or invalid plan we fall back to a deterministic even split.
    const selectedOpenRouterStoryModel = resolveSelectedOpenRouterStoryModel(input.config);
    const compactDraftMode = shouldUseCompactOpenRouterDraft(input.config);
    const wholeStoryPrompts = buildWholeStoryDraftPrompts(input, chapterCount, blueprint, critique);

    let wholeStoryStage: Awaited<ReturnType<typeof runStage>>;
    let wholeStoryDraft: DevModeWholeStoryDraft;
    try {
      wholeStoryStage = await runStage("whole-story-draft", wholeStoryPrompts, {
        maxTokens: devModeStoryDraftMaxTokens(input.config, compactDraftMode, false),
        temperature: 0.82,
        timeoutMs: devModeStoryDraftTimeoutMs(input.config, false),
        modelRole: "selected-story",
      });
      wholeStoryDraft = parseWholeStoryDraft(wholeStoryStage.provider.content);
    } catch (wholeStoryError) {
      const reason = wholeStoryError instanceof Error ? wholeStoryError.message : String(wholeStoryError);
      console.warn("[dev-mode-generation] Whole-story draft failed; retrying once with stricter prompt", {
        model: selectedOpenRouterStoryModel,
        error: reason,
      });
      const retryPrompts = buildWholeStoryDraftPrompts(input, chapterCount, blueprint, critique);
      try {
        wholeStoryStage = await runStage("whole-story-draft", retryPrompts, {
          maxTokens: devModeStoryDraftMaxTokens(input.config, true, true),
          temperature: 0.6,
          timeoutMs: devModeStoryDraftTimeoutMs(input.config, true),
          modelRole: "selected-story",
        });
        wholeStoryDraft = parseWholeStoryDraft(wholeStoryStage.provider.content);
      } catch (retryError) {
        throw new Error(
          `Selected story model could not produce a usable whole-story draft (${selectedOpenRouterStoryModel}): ${retryError instanceof Error ? retryError.message : String(retryError)}`
        );
      }
    }

    // Splitter: cheap support-model call. Falls back to deterministic even
    // split if the plan is malformed or has gaps/overlaps.
    let parsedStoryDraft: DevModeRawStory;
    try {
      const splitterPrompts = buildStorySplitterPrompts(
        wholeStoryDraft,
        chapterCount,
        localizedLanguageName(input.config.language)
      );
      const splitterStage = await runStage("story-splitter", splitterPrompts, {
        maxTokens: 1400,
        temperature: 0.2,
        timeoutMs: 60_000,
        ...supportCallOptions,
        modelRole: "support",
      });
      parsedStoryDraft = applySplitterPlanToDraft(wholeStoryDraft, chapterCount, splitterStage.parsed);
    } catch (splitterError) {
      console.warn("[dev-mode-generation] Story splitter stage failed; using deterministic even split", {
        error: splitterError instanceof Error ? splitterError.message : String(splitterError),
      });
      parsedStoryDraft = applySplitterPlanToDraft(wholeStoryDraft, chapterCount, undefined);
    }

    const storyStage = wholeStoryStage;
    finalParsed = parsedStoryDraft;
    finalModelUsed = storyStage.provider.modelUsed;
    // Suppress unused-variable warnings for legacy compact-draft helpers
    // that are still referenced elsewhere (compatibility retry paths).
    void compactDraftMode;
    finalDiagnostics = analyzeDevModeStoryQuality(finalParsed, input, chapterCount);

    let bestParsed = finalParsed;
    let bestModelUsed = finalModelUsed;
    let bestDiagnostics = finalDiagnostics;

    let repairAttempt = 0;
    while (finalDiagnostics?.needsPolish && repairAttempt < DEV_MODE_MAX_REPAIR_ATTEMPTS) {
      repairAttempt += 1;
      let chaptersToRepair = selectChapterDiagnosticsForRepair(finalDiagnostics, finalParsed, input.config);
      const broadFailureChapterThreshold = input.config.length === "short"
        ? DEV_MODE_BROAD_FAILURE_CHAPTER_COUNT
        : Math.min(DEV_MODE_BROAD_FAILURE_CHAPTER_COUNT, Math.max(3, chapterCount));
      const broadFormFailure =
        chaptersToRepair.length >= broadFailureChapterThreshold
        && finalDiagnostics.hardIssues.some((issue) => /Dialoganteil|deutlich zu lang|deutlich zu kurz|Absaetze|Absätze/i.test(issue));
      if (broadFormFailure) {
        console.log("[dev-mode-generation] Broad form failure will still use targeted chapter repairs", {
          attempt: repairAttempt,
          failingChapterCount: chaptersToRepair.length,
          hardIssueCount: finalDiagnostics.hardIssueCount,
          dialogPct: finalDiagnostics.dialogPct,
        });
      }
      if (chaptersToRepair.length > DEV_MODE_CHAPTER_REPAIR_LIMIT_PER_PASS) {
        chaptersToRepair = chaptersToRepair.slice(0, DEV_MODE_CHAPTER_REPAIR_LIMIT_PER_PASS);
      }
      if (repairAttempt > 1 && chaptersToRepair.length > DEV_MODE_SECOND_PASS_REPAIR_CHAPTER_LIMIT) {
        chaptersToRepair = chaptersToRepair.slice(0, DEV_MODE_SECOND_PASS_REPAIR_CHAPTER_LIMIT);
      }
      if (chaptersToRepair.length === 0) break;
      chapterRepairApplied = true;

      console.log("[dev-mode-generation] Triggering chapter-level strict gate repair", {
        attempt: repairAttempt,
        chapters: chaptersToRepair.map((chapter) => ({
          order: chapter.order,
          title: chapter.title,
          chars: chapter.chars,
          paragraphs: chapter.paragraphs,
          dialogPct: chapter.dialogPct,
          issues: chapter.issues,
        })),
        reason: "targeted-chapter-repair",
        hardIssueCount: finalDiagnostics?.hardIssueCount,
        softIssueCount: finalDiagnostics?.softIssueCount,
        dialogPct: finalDiagnostics?.dialogPct,
      });

      let repairedParsed = finalParsed;
      let repairedModelUsed = finalModelUsed;

      for (const chapterDiagnostic of chaptersToRepair) {
        const currentChapter = repairedParsed.chapters.find((chapter) => Number(chapter.order) === Number(chapterDiagnostic.order));
        if (!currentChapter) continue;

        const chapterRepairPrompts = buildChapterRepairPrompts(
          input,
          chapterCount,
          repairedParsed,
          currentChapter,
          chapterDiagnostic,
          finalDiagnostics!,
          blueprint,
          critique,
          repairAttempt
        );
        let chapterRepairStage: Awaited<ReturnType<typeof runStage>>;
        try {
          const repairMaxTokens = input.config.length === "long" ? 4200 : input.config.length === "short" ? 1700 : 2100;
          chapterRepairStage = await runStage("chapter-repair", chapterRepairPrompts, {
            maxTokens: repairMaxTokens,
            temperature: repairAttempt === 1 ? 0.38 : 0.24,
            timeoutMs: input.config.length === "long" ? 240_000 : 180_000,
            modelRole: "selected-story",
          });
        } catch (repairCallError) {
          const error = repairCallError instanceof Error ? repairCallError.message : String(repairCallError);
          console.warn("[dev-mode-generation] Chapter repair call failed; keeping previous chapter", {
            attempt: repairAttempt,
            order: currentChapter.order,
            title: currentChapter.title,
            error,
          });
          repairSelfReflections.push({
            attempt: repairAttempt,
            order: currentChapter.order,
            title: currentChapter.title,
            modelUsed: finalModelUsed,
            error,
            deterministicChapterDiagnostics: chapterDiagnostic,
            deterministicStoryHardIssueCount: finalDiagnostics?.hardIssueCount,
            deterministicStoryDialogPct: finalDiagnostics?.dialogPct,
          });
          continue;
        }

        let repairResult: { chapter: DevModeChapter; selfReflection?: any; parsed: any } | null = null;
        try {
          repairResult = parseChapterRepairResult(chapterRepairStage.provider.content, currentChapter);
        } catch (repairParseError) {
          console.warn("[dev-mode-generation] Chapter repair returned unusable JSON; keeping previous chapter", {
            attempt: repairAttempt,
            order: currentChapter.order,
            title: currentChapter.title,
            error: repairParseError instanceof Error ? repairParseError.message : String(repairParseError),
          });
          continue;
        }

        repairedParsed = replaceStoryChapter(repairedParsed, repairResult.chapter);
        repairedModelUsed = chapterRepairStage.provider.modelUsed;
        const interimDiagnostics = analyzeDevModeStoryQuality(repairedParsed, input, chapterCount);
        const repairedChapterDiagnostics = interimDiagnostics.chapterDiagnostics.find((chapter) => Number(chapter.order) === Number(repairResult?.chapter.order));
        const selfCheck = repairResult.selfReflection?.afterRepairCheck || repairResult.selfReflection;
        if (selfCheck && selfCheck.hardGatesPassed === false) {
          console.warn("[dev-mode-generation] Model self-reflection reports remaining repair issues", {
            attempt: repairAttempt,
            order: repairResult.chapter.order,
            title: repairResult.chapter.title,
            remainingIssues: selfCheck.remainingIssues,
          });
        }
        if (selfCheck?.hardGatesPassed === true && repairedChapterDiagnostics?.issues?.length) {
          console.warn("[dev-mode-generation] Model self-reflection claimed pass, deterministic diagnostics disagree", {
            attempt: repairAttempt,
            order: repairResult.chapter.order,
            title: repairResult.chapter.title,
            modelSelfCheck: selfCheck,
            deterministicIssues: repairedChapterDiagnostics.issues,
          });
        }
        repairSelfReflections.push({
          attempt: repairAttempt,
          order: repairResult.chapter.order,
          title: repairResult.chapter.title,
          modelUsed: chapterRepairStage.provider.modelUsed,
          selfReflection: repairResult.selfReflection,
          deterministicChapterDiagnostics: repairedChapterDiagnostics,
          deterministicStoryHardIssueCount: interimDiagnostics.hardIssueCount,
          deterministicStoryDialogPct: interimDiagnostics.dialogPct,
        });
      }

      const repairedDiagnostics = analyzeDevModeStoryQuality(repairedParsed, input, chapterCount);
      const improved = isDiagnosticsBetter(repairedDiagnostics, bestDiagnostics, chapterCount, input.config);
      if (isDiagnosticsBetter(repairedDiagnostics, bestDiagnostics, chapterCount, input.config)) {
        bestParsed = repairedParsed;
        bestModelUsed = repairedModelUsed;
        bestDiagnostics = repairedDiagnostics;
      } else {
        console.warn("[dev-mode-generation] Chapter repair pass did not improve deterministic diagnostics", {
          attempt: repairAttempt,
          hardIssueCountBefore: finalDiagnostics?.hardIssueCount,
          hardIssueCountAfter: repairedDiagnostics.hardIssueCount,
          dialogPctBefore: finalDiagnostics?.dialogPct,
          dialogPctAfter: repairedDiagnostics.dialogPct,
        });
      }

      finalParsed = bestParsed;
      finalModelUsed = bestModelUsed;
      finalDiagnostics = bestDiagnostics;

      if (broadFormFailure && repairAttempt >= 1 && finalDiagnostics.hardIssueCount > 0) {
        console.warn("[dev-mode-generation] Broad form failure remains after chapter repair pass; escalating to full-story gate rescue", {
          attempt: repairAttempt,
          hardIssueCount: finalDiagnostics.hardIssueCount,
          dialogPct: finalDiagnostics.dialogPct,
        });
        break;
      }

      // One successful local repair is enough for soft issues; keep looping
      // only while hard gates still fail.
      if (finalDiagnostics.hardIssueCount === 0) break;
      if (!improved) break;
    }

    if (!chapterRepairApplied) {
      console.log("[dev-mode-generation] Skipping chapter repair", {
        reason: finalDiagnostics?.needsPolish ? "no-targetable-chapter-diagnostics" : "draft-passed-local-gates",
        hardIssueCount: finalDiagnostics?.hardIssueCount,
        softIssueCount: finalDiagnostics?.softIssueCount,
        dialogPct: finalDiagnostics?.dialogPct,
      });
    }

    const skipInitialValidationForLocalGates = Boolean(
      finalDiagnostics
      && ((finalDiagnostics.hardIssueCount ?? 0) > 0 || (finalDiagnostics.dialogPct ?? 0) < DEV_MODE_MIN_DIALOG_PCT)
    );

    for (let validationAttempt = 0; validationAttempt <= DEV_MODE_MAX_VALIDATION_POLISH_ATTEMPTS; validationAttempt += 1) {
      let validatorFindings: any | undefined;
      const shouldSkipValidation = validationAttempt === 0 && skipInitialValidationForLocalGates;
      if (shouldSkipValidation) {
        console.log("[dev-mode-generation] Skipping initial LLM validation because deterministic local gates already fail", {
          hardIssueCount: finalDiagnostics?.hardIssueCount,
          dialogPct: finalDiagnostics?.dialogPct,
        });
        rawQualityScore = undefined;
      } else {
        const validationPrompts = buildValidationPrompts(input, chapterCount, finalParsed!, finalDiagnostics);
        try {
          const validationStage = await runStage("final-validation", validationPrompts, {
            maxTokens: 1800,
            temperature: 0.1,
            timeoutMs: 120_000,
            ...supportCallOptions,
            modelRole: "support",
          });
          validatorFindings = validationStage.parsed;
          finalValidatorFindings = validatorFindings;
          rawQualityScore = extractQualityScore(validationStage.parsed) ?? undefined;
        } catch (validationError) {
          console.warn("[dev-mode-generation] Final validation failed; using deterministic local gate score", {
            error: validationError instanceof Error ? validationError.message : String(validationError),
            hardIssueCount: finalDiagnostics?.hardIssueCount,
            dialogPct: finalDiagnostics?.dialogPct,
          });
          rawQualityScore = undefined;
        }
      }
      localGateScore = calculateLocalGateScore(finalDiagnostics);
      finalQualityScore = applyHardCaps(rawQualityScore, finalDiagnostics);

      if (typeof rawQualityScore === "number" && typeof finalQualityScore === "number" && finalQualityScore < rawQualityScore) {
        console.warn("[dev-mode-generation] Validator score capped by local gates", {
          rawQualityScore,
          localGateScore,
          finalQualityScore,
          hardIssueCount: finalDiagnostics?.hardIssueCount,
          dialogPct: finalDiagnostics?.dialogPct,
        });
      }

      const currentScore = finalQualityScore ?? rawQualityScore ?? localGateScore ?? 0;
      const hasLocalHardIssues = (finalDiagnostics?.hardIssueCount ?? 0) > 0;
      const shouldAttemptStoryPolish =
        validationAttempt < DEV_MODE_MAX_VALIDATION_POLISH_ATTEMPTS
        && Boolean(finalParsed)
        && Boolean(finalDiagnostics)
        && (
          hasLocalHardIssues
          || currentScore < DEV_MODE_MIN_MARKET_QUALITY_SCORE
        );

      if (!shouldAttemptStoryPolish || !finalParsed || !finalDiagnostics) break;

      const currentParsed: DevModeRawStory = finalParsed;
      const currentDiagnostics: DevModeStoryDiagnostics = finalDiagnostics;
      const currentSeverity = diagnosticsSeverityScore(currentDiagnostics, chapterCount, input.config);
      const polishReason =
        currentDiagnostics.hardIssueCount > 0
          ? "local-hard-gates"
          : currentScore < DEV_MODE_MIN_MARKET_QUALITY_SCORE
            ? "validator-market-quality"
            : "dialogue-target";

      // Decide between SURGICAL line-punchup (default, low-cost, preserves
      // iconic prose) and the legacy FULL-STORY polish (for hard form
      // failures the punchup cannot fix). Line-punchup is the v7 default
      // for soft-quality bumps because prior full-story polish passes were
      // the main source of quality regression (flattened similes, weakened
      // dialogue, dropped refrains chasing dialog% gates).
      //
      // Punchup CANNOT fix: length-over-bound chapters (it preserves length
      // by design), low dialog ratios (replaces 1:1, doesn't add lines),
      // missing paragraphs, novelty/cast-gate failures.
      // For those, fall through to the legacy full-story polish.
      const onlyValidatorScoreGap =
        currentDiagnostics.hardIssueCount === 0
        && currentScore < DEV_MODE_MIN_MARKET_QUALITY_SCORE
        && currentDiagnostics.dialogPct >= DEV_MODE_MIN_DIALOG_PCT;
      const onlySoftIssuesAndDialogueOK =
        currentDiagnostics.hardIssueCount === 0
        && currentDiagnostics.softIssueCount > 0
        && currentDiagnostics.dialogPct >= DEV_MODE_TARGET_DIALOG_PCT;
      const canUseLinePunchup = onlyValidatorScoreGap || onlySoftIssuesAndDialogueOK;
      const validatorQualityRepairChapters =
        currentDiagnostics.hardIssueCount === 0
        && currentScore < DEV_MODE_MIN_MARKET_QUALITY_SCORE
        && validatorFindings
          ? selectValidatorQualityRepairChapters(currentDiagnostics, validatorFindings, chapterCount)
          : [];

      console.warn("[dev-mode-generation] Triggering post-validation polish", {
        validationAttempt: validationAttempt + 1,
        polishReason,
        currentScore,
        hardIssueCount: currentDiagnostics.hardIssueCount,
        dialogPct: currentDiagnostics.dialogPct,
        mode: validatorQualityRepairChapters.length > 0
          ? "validator-quality-chapter-repair"
          : canUseLinePunchup ? "line-punchup" : "full-story-polish",
      });

      try {
        if (validatorQualityRepairChapters.length > 0) {
          console.warn("[dev-mode-generation] Triggering validator-driven chapter quality repair", {
            validationAttempt: validationAttempt + 1,
            score: currentScore,
            targetScore: DEV_MODE_MIN_MARKET_QUALITY_SCORE,
            chapters: validatorQualityRepairChapters.map((chapter) => ({
              order: chapter.order,
              title: chapter.title,
              chars: chapter.chars,
              dialogPct: chapter.dialogPct,
              issues: chapter.issues,
            })),
            mustFixBefore95: Array.isArray(validatorFindings?.mustFixBefore95)
              ? validatorFindings.mustFixBefore95.slice(0, 6)
              : [],
            warnings: Array.isArray(validatorFindings?.warnings)
              ? validatorFindings.warnings.slice(0, 6)
              : [],
          });

          let qualityParsed: DevModeRawStory = currentParsed;
          let qualityModelUsed = finalModelUsed;
          let qualityDiagnostics: DevModeStoryDiagnostics = currentDiagnostics;
          let repairedAnyChapter = false;

          for (const chapterDiagnostic of validatorQualityRepairChapters) {
            const currentChapter = qualityParsed.chapters.find((chapter) => Number(chapter.order) === Number(chapterDiagnostic.order));
            if (!currentChapter) continue;

            const chapterRepairPrompts = buildChapterRepairPrompts(
              input,
              chapterCount,
              qualityParsed,
              currentChapter,
              chapterDiagnostic,
              qualityDiagnostics,
              blueprint,
              {
                ...critique,
                validatorFindings,
                polishReason: "validator-quality-chapter-rescue",
              },
              validationAttempt + 1
            );

            try {
              const repairMaxTokens = input.config.length === "long" ? 4200 : input.config.length === "short" ? 1700 : 2100;
              const chapterRepairStage = await runStage("chapter-repair", chapterRepairPrompts, {
                maxTokens: repairMaxTokens,
                temperature: 0.3,
                timeoutMs: input.config.length === "long" ? 240_000 : 180_000,
                modelRole: "selected-story",
              });
              const repairResult = parseChapterRepairResult(chapterRepairStage.provider.content, currentChapter);
              qualityParsed = replaceStoryChapter(qualityParsed, repairResult.chapter);
              qualityModelUsed = chapterRepairStage.provider.modelUsed;
              qualityDiagnostics = analyzeDevModeStoryQuality(qualityParsed, input, chapterCount);
              repairedAnyChapter = true;
              const repairedChapterDiagnostics = qualityDiagnostics.chapterDiagnostics.find((chapter) => Number(chapter.order) === Number(repairResult.chapter.order));
              repairSelfReflections.push({
                attempt: validationAttempt + 1,
                order: repairResult.chapter.order,
                title: repairResult.chapter.title,
                modelUsed: chapterRepairStage.provider.modelUsed,
                selfReflection: repairResult.selfReflection,
                deterministicChapterDiagnostics: repairedChapterDiagnostics,
                deterministicStoryHardIssueCount: qualityDiagnostics.hardIssueCount,
                deterministicStoryDialogPct: qualityDiagnostics.dialogPct,
                reason: "validator-quality-chapter-rescue",
                validatorFindings: compactCritiqueForDraft({ validatorFindings }).validatorFindings,
              });
            } catch (qualityRepairError) {
              console.warn("[dev-mode-generation] Validator-driven chapter repair failed; keeping current chapter", {
                order: currentChapter.order,
                title: currentChapter.title,
                error: qualityRepairError instanceof Error ? qualityRepairError.message : String(qualityRepairError),
              });
            }
          }

          if (repairedAnyChapter) {
            const qualitySeverity = diagnosticsSeverityScore(qualityDiagnostics, chapterCount, input.config);
            const locallyAcceptable =
              qualityDiagnostics.hardIssueCount <= currentDiagnostics.hardIssueCount
              && qualityDiagnostics.dialogPct >= Math.max(DEV_MODE_MIN_DIALOG_PCT, currentDiagnostics.dialogPct - 1)
              && qualitySeverity <= currentSeverity + 180;
            if (locallyAcceptable) {
              finalParsed = qualityParsed;
              finalModelUsed = qualityModelUsed;
              finalDiagnostics = qualityDiagnostics;
              chapterRepairApplied = true;
              storyPolishApplied = true;
              rawQualityScore = undefined;
              localGateScore = undefined;
              finalQualityScore = undefined;
              finalValidatorFindings = undefined;
              continue;
            }

            console.warn("[dev-mode-generation] Validator-driven chapter repair rejected by deterministic diagnostics", {
              currentSeverity,
              qualitySeverity,
              hardIssueCountBefore: currentDiagnostics.hardIssueCount,
              hardIssueCountAfter: qualityDiagnostics.hardIssueCount,
              dialogPctBefore: currentDiagnostics.dialogPct,
              dialogPctAfter: qualityDiagnostics.dialogPct,
            });
          }
        }

        if (canUseLinePunchup) {
          const punchupPrompts = buildLinePunchupPrompts(
            input,
            chapterCount,
            currentParsed,
            currentDiagnostics,
            blueprint,
            {
              ...critique,
              validatorFindings,
              polishReason,
            }
          );
          const punchupStage = await runStage("line-punchup", punchupPrompts, {
            maxTokens: 2200,
            temperature: 0.5,
            timeoutMs: 90_000,
            modelRole: "selected-story",
          });
          const replacements = parseLinePunchupResult(punchupStage.provider.content);
          if (replacements.length === 0) {
            console.warn("[dev-mode-generation] Line-punchup returned no usable replacements; keeping previous story", {
              rawContentChars: punchupStage.provider.content?.length ?? 0,
            });
            break;
          }
          const punchupResult = applyLinePunchupResult(currentParsed, replacements);
          if (punchupResult.appliedCount === 0) {
            console.warn("[dev-mode-generation] Line-punchup had no applicable replacements (all 'find' strings missed); keeping previous story", {
              droppedCount: punchupResult.droppedCount,
              droppedReplacements: punchupResult.droppedReplacements.slice(0, 4),
            });
            break;
          }
          const punchupDiagnostics = analyzeDevModeStoryQuality(punchupResult.story, input, chapterCount);
          const punchupSeverity = diagnosticsSeverityScore(punchupDiagnostics, chapterCount, input.config);
          const introducedHardIssue =
            punchupDiagnostics.hardIssueCount > currentDiagnostics.hardIssueCount;
          const locallyAcceptable =
            !introducedHardIssue
            && (
              punchupSeverity <= currentSeverity + 40
              || punchupDiagnostics.softIssueCount < currentDiagnostics.softIssueCount
            );
          if (!locallyAcceptable) {
            console.warn("[dev-mode-generation] Line-punchup rejected by deterministic diagnostics", {
              currentSeverity,
              punchupSeverity,
              hardIssueCountBefore: currentDiagnostics.hardIssueCount,
              hardIssueCountAfter: punchupDiagnostics.hardIssueCount,
              dialogPctBefore: currentDiagnostics.dialogPct,
              dialogPctAfter: punchupDiagnostics.dialogPct,
              appliedCount: punchupResult.appliedCount,
              droppedCount: punchupResult.droppedCount,
            });
            break;
          }
          finalParsed = punchupResult.story;
          finalModelUsed = punchupStage.provider.modelUsed;
          finalDiagnostics = punchupDiagnostics;
          storyPolishApplied = true;
          repairSelfReflections.push({
            attempt: validationAttempt + 1,
            modelUsed: punchupStage.provider.modelUsed,
            reason: "line-punchup",
            polishReason,
            appliedCount: punchupResult.appliedCount,
            droppedCount: punchupResult.droppedCount,
            appliedReplacements: punchupResult.appliedReplacements,
            droppedReplacements: punchupResult.droppedReplacements.slice(0, 4),
            deterministicStoryHardIssueCount: punchupDiagnostics.hardIssueCount,
            deterministicStoryDialogPct: punchupDiagnostics.dialogPct,
          });

          rawQualityScore = undefined;
          localGateScore = undefined;
          finalQualityScore = undefined;
          finalValidatorFindings = undefined;
          continue;
        }

        // Hard structural failure path → keep legacy full-story polish.
        const storyPolishPrompts = buildStoryPolishPrompts(
          input,
          chapterCount,
          currentParsed,
          currentDiagnostics,
          blueprint,
          {
            ...critique,
            validatorFindings,
            polishReason,
          }
        );
        const storyPolishStage = await runStage("story-polish", storyPolishPrompts, {
          maxTokens: devModeStoryPolishMaxTokens(input.config),
          temperature: currentDiagnostics.hardIssueCount > 0 ? 0.28 : 0.34,
          timeoutMs: devModeStoryDraftTimeoutMs(input.config, true),
          modelRole: "selected-story",
        });
        const polishedParsed = parseAndValidate(storyPolishStage.provider.content, chapterCount);
        const polishedDiagnostics = analyzeDevModeStoryQuality(polishedParsed, input, chapterCount);
        const polishedSeverity = diagnosticsSeverityScore(polishedDiagnostics, chapterCount, input.config);
        const currentHardIssueKeys = new Set(currentDiagnostics.hardIssues.map((issue) => normalizeNoveltyText(issue)));
        const introducedCriticalHardIssue = polishedDiagnostics.hardIssues.some((issue) => {
          if (!/Verbotenes|Moral|ASCII|Namensfehler|Novelty|Wiederholungs|Pool-Cast|\[object Object\]/i.test(issue)) return false;
          return !currentHardIssueKeys.has(normalizeNoveltyText(issue));
        });
        const locallyAcceptable =
          polishedDiagnostics.hardIssueCount === 0
          || (
            polishedSeverity < currentSeverity
            && polishedDiagnostics.hardIssueCount <= currentDiagnostics.hardIssueCount
            && polishedDiagnostics.dialogPct >= Math.max(0, currentDiagnostics.dialogPct - 0.5)
            && !introducedCriticalHardIssue
          )
          || (
            currentDiagnostics.hardIssueCount === 0
            && polishedDiagnostics.hardIssueCount === 0
            && polishedSeverity <= currentSeverity + 120
          );

        if (!locallyAcceptable) {
          console.warn("[dev-mode-generation] Full-story polish rejected by deterministic diagnostics", {
            currentSeverity,
            polishedSeverity,
            hardIssueCountBefore: currentDiagnostics.hardIssueCount,
            hardIssueCountAfter: polishedDiagnostics.hardIssueCount,
            dialogPctBefore: currentDiagnostics.dialogPct,
            dialogPctAfter: polishedDiagnostics.dialogPct,
            introducedCriticalHardIssue,
          });
          break;
        }

        finalParsed = polishedParsed;
        finalModelUsed = storyPolishStage.provider.modelUsed;
        finalDiagnostics = polishedDiagnostics;
        storyPolishApplied = true;

        // Post-polish targeted rescue: if the polish reduced issues but still
        // leaves chapter-localized hard fails (length, dialogue, paragraphs,
        // long sentences), run one more pass of chapter-repair on the worst
        // offenders. Was previously dialogue-only; widened to also rescue
        // length issues, which the full-story polish often fails to cut.
        if (isChapterLocalHardFailure(finalDiagnostics)) {
          const rescueChapters = selectPostPolishChapterRepairChapters(finalDiagnostics, input.config);
          if (rescueChapters.length > 0) {
            console.warn("[dev-mode-generation] Triggering post-polish targeted chapter rescue", {
              chapters: rescueChapters.map((chapter) => ({
                order: chapter.order,
                title: chapter.title,
                chars: chapter.chars,
                dialogPct: chapter.dialogPct,
                paragraphs: chapter.paragraphs,
                longestSentenceChars: chapter.longestSentenceChars,
                issues: chapter.issues,
              })),
              hardIssueCount: finalDiagnostics.hardIssueCount,
              dialogPct: finalDiagnostics.dialogPct,
            });

            let rescueParsed = finalParsed;
            let rescueModelUsed = finalModelUsed;
            let rescueDiagnostics = finalDiagnostics;
            const postPolishRepairAttempt = repairAttempt + 1;

            for (const chapterDiagnostic of rescueChapters) {
              const currentChapter = rescueParsed.chapters.find((chapter) => Number(chapter.order) === Number(chapterDiagnostic.order));
              if (!currentChapter) continue;

              const chapterRepairPrompts = buildChapterRepairPrompts(
                input,
                chapterCount,
                rescueParsed,
                currentChapter,
                chapterDiagnostic,
                rescueDiagnostics,
                blueprint,
                {
                  ...critique,
                  validatorFindings,
                  polishReason: "post-polish-chapter-rescue",
                },
                postPolishRepairAttempt
              );

              try {
                const repairMaxTokens = input.config.length === "long" ? 4200 : input.config.length === "short" ? 1700 : 2100;
                const chapterRepairStage = await runStage("chapter-repair", chapterRepairPrompts, {
                  maxTokens: repairMaxTokens,
                  temperature: 0.24,
                  timeoutMs: input.config.length === "long" ? 240_000 : 180_000,
                  modelRole: "selected-story",
                });
                const repairResult = parseChapterRepairResult(chapterRepairStage.provider.content, currentChapter);
                rescueParsed = replaceStoryChapter(rescueParsed, repairResult.chapter);
                rescueModelUsed = chapterRepairStage.provider.modelUsed;
                rescueDiagnostics = analyzeDevModeStoryQuality(rescueParsed, input, chapterCount);
                const repairedChapterDiagnostics = rescueDiagnostics.chapterDiagnostics.find((chapter) => Number(chapter.order) === Number(repairResult.chapter.order));
                repairSelfReflections.push({
                  attempt: postPolishRepairAttempt,
                  order: repairResult.chapter.order,
                  title: repairResult.chapter.title,
                  modelUsed: chapterRepairStage.provider.modelUsed,
                  selfReflection: repairResult.selfReflection,
                  deterministicChapterDiagnostics: repairedChapterDiagnostics,
                  deterministicStoryHardIssueCount: rescueDiagnostics.hardIssueCount,
                  deterministicStoryDialogPct: rescueDiagnostics.dialogPct,
                  reason: "post-polish-chapter-rescue",
                });
              } catch (rescueError) {
                console.warn("[dev-mode-generation] Post-polish chapter rescue failed; keeping current chapter", {
                  order: currentChapter.order,
                  title: currentChapter.title,
                  error: rescueError instanceof Error ? rescueError.message : String(rescueError),
                });
              }
            }

            const rescueImproved = isDiagnosticsBetter(rescueDiagnostics, finalDiagnostics, chapterCount, input.config)
              || rescueDiagnostics.hardIssueCount < finalDiagnostics.hardIssueCount;
            if (rescueImproved) {
              finalParsed = rescueParsed;
              finalModelUsed = rescueModelUsed;
              finalDiagnostics = rescueDiagnostics;
              chapterRepairApplied = true;
              repairAttempt = postPolishRepairAttempt;
            } else {
              console.warn("[dev-mode-generation] Post-polish chapter rescue rejected by deterministic diagnostics", {
                hardIssueCountBefore: finalDiagnostics.hardIssueCount,
                hardIssueCountAfter: rescueDiagnostics.hardIssueCount,
                dialogPctBefore: finalDiagnostics.dialogPct,
                dialogPctAfter: rescueDiagnostics.dialogPct,
              });
            }
          }
        }

        rawQualityScore = undefined;
        localGateScore = undefined;
        finalQualityScore = undefined;
        finalValidatorFindings = undefined;
      } catch (storyPolishError) {
        console.warn("[dev-mode-generation] Full-story polish failed; keeping previous story", {
          error: storyPolishError instanceof Error ? storyPolishError.message : String(storyPolishError),
        });
        break;
      }
    }

    const releaseScore = finalQualityScore ?? rawQualityScore ?? localGateScore ?? 0;
    const releaseGateFailures: string[] = [];
    if (finalDiagnostics?.hardIssueCount && finalDiagnostics.hardIssueCount > 0) {
      releaseGateFailures.push(formatQualityGateFailureReason(finalDiagnostics) || "Hard local quality gates failed.");
    }
    if (releaseScore < DEV_MODE_MIN_MARKET_QUALITY_SCORE) {
      releaseGateFailures.push(
        `Developer-mode story market-quality score ${releaseScore} is below ${DEV_MODE_MIN_MARKET_QUALITY_SCORE}.`
      );
    }
    releaseGateFailures.push(...releaseDimensionFailures(finalValidatorFindings));
    if (releaseGateFailures.length > 0) {
      qualityGateFailureReason = releaseGateFailures.join(" ");
      console.warn("[dev-mode-generation] Returning developer-mode story with quality gate warnings", {
        hardIssueCount: finalDiagnostics?.hardIssueCount,
        softIssueCount: finalDiagnostics?.softIssueCount,
        dialogPct: finalDiagnostics?.dialogPct,
        rawQualityScore,
        localGateScore,
        finalQualityScore,
        qualityGateFailureReason,
      });
    }
  } catch (pipelineError) {
    await publishWithTimeout(logTopic, {
      source: "dev-mode-generation",
      timestamp: new Date(),
      request: {
        mode: "developer",
        pipeline: DEV_MODE_PIPELINE_ID,
        provider: input.config.aiProvider === "openrouter" ? "openrouter" : "native",
        model: input.config.aiModel,
        supportProvider,
        supportModel,
        openRouterModel: input.config.openRouterModel,
        wizardConfig: {
          chapterCount,
          ageGroup: input.config.ageGroup,
          genre: input.config.genre,
          setting: input.config.setting,
          language: input.config.language,
          avatarNames,
          poolCharacterNames: poolNames,
          primaryProfileAge: input.primaryProfileAge,
          learningModeEnabled: !!input.config.learningMode?.enabled,
          learningModeSubjects: input.config.learningMode?.subjects,
          customPrompt: input.config.customPrompt,
          noveltySeed: input.noveltyBrief?.seed,
          recentStoryCount: input.noveltyBrief?.recentStories.length ?? 0,
          hardAvoidMotifCount: input.noveltyBrief?.hardAvoidMotifs.length ?? 0,
          noveltyKeyMomentLens: input.noveltyBrief?.keyMomentLens,
          ideaCandidateCount: ideaCandidates.length,
          selectedIdeaTitle: input.selectedIdea?.title,
          selectedSupportingCast: input.selectedIdea?.selectedSupportingCast,
        },
      },
      response: {
        error: pipelineError instanceof Error ? pipelineError.message : String(pipelineError),
        stages: stageLogs.map((stage) => ({
          stage: stage.stage,
          systemPromptChars: stage.systemPrompt.length,
          userPromptChars: stage.userPrompt.length,
          usage: stage.usage,
          modelUsed: stage.modelUsed,
          modelRole: stage.modelRole,
          durationMs: stage.durationMs,
          error: stage.error,
        })),
        durationMs: Date.now() - startedAt,
      },
      metadata: { devMode: true, pipeline: DEV_MODE_PIPELINE_ID, stage: "failed", failed: true },
    }).catch((logErr) => {
      console.warn("[dev-mode-generation] Failed to publish failure log:", logErr);
    });
    throw pipelineError;
  }

  const parsed = finalParsed;
  if (!parsed) {
    throw new Error("Developer-mode adaptive chapter-repair pipeline did not produce a story.");
  }

  const totalUsage = usageSum(providerResults);

  await publishWithTimeout(logTopic, {
    source: "dev-mode-generation",
    timestamp: new Date(),
    request: {
      mode: "developer",
      pipeline: DEV_MODE_PIPELINE_ID,
      provider: input.config.aiProvider === "openrouter" ? "openrouter" : "native",
      model: finalModelUsed,
      supportProvider,
      supportModel,
      openRouterModel: input.config.openRouterModel,
      wizardConfig: {
        chapterCount,
        ageGroup: input.config.ageGroup,
        genre: input.config.genre,
        setting: input.config.setting,
        language: input.config.language,
        avatarNames,
        poolCharacterNames: poolNames,
        primaryProfileAge: input.primaryProfileAge,
        learningModeEnabled: !!input.config.learningMode?.enabled,
        learningModeSubjects: input.config.learningMode?.subjects,
        customPrompt: input.config.customPrompt,
        noveltySeed: input.noveltyBrief?.seed,
        recentStoryCount: input.noveltyBrief?.recentStories.length ?? 0,
        hardAvoidMotifCount: input.noveltyBrief?.hardAvoidMotifs.length ?? 0,
        noveltyKeyMomentLens: input.noveltyBrief?.keyMomentLens,
        ideaCandidateCount: ideaCandidates.length,
        selectedIdeaTitle: input.selectedIdea?.title,
        selectedSupportingCast: input.selectedIdea?.selectedSupportingCast,
      },
      stages: stageLogs.map((stage) => ({
        stage: stage.stage,
        systemPromptChars: stage.systemPrompt.length,
        userPromptChars: stage.userPrompt.length,
      })),
    },
    response: {
      stages: stageLogs.map((stage) => ({
        stage: stage.stage,
        rawContent: stage.rawContent,
        contentLength: stage.rawContent?.length ?? 0,
        parsed: stage.parsed,
        parseError: stage.parseError,
        usage: stage.usage,
        modelUsed: stage.modelUsed,
        modelRole: stage.modelRole,
        durationMs: stage.durationMs,
        score: extractQualityScore(stage.parsed),
      })),
      parsed: {
        title: parsed.title,
        description: parsed.description,
        chapterCount: parsed.chapters.length,
        chapters: parsed.chapters.map((c) => ({
          order: c.order,
          title: c.title,
          contentChars: c.content.length,
        })),
      },
      localQualityDiagnostics: finalDiagnostics,
      storyPolishApplied,
      chapterRepairApplied,
      repairSelfReflections,
      rawQualityScore,
      localGateScore,
      finalQualityScore,
      literaryValidation: finalValidatorFindings,
      qualityGateFailureReason,
      returnedWithQualityGateWarnings: Boolean(qualityGateFailureReason),
      usage: totalUsage,
      durationMs: Date.now() - startedAt,
    },
    metadata: { devMode: true, pipeline: DEV_MODE_PIPELINE_ID, stage: "complete" },
  }).catch((logErr) => {
    console.warn("[dev-mode-generation] Failed to publish success log:", logErr);
  });

  const chapters = parsed.chapters
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((ch, idx) => ({
      id: crypto.randomUUID(),
      title: ch.title,
      content: ch.content,
      order: idx + 1,
      imageUrl: undefined,
      imagePrompt: undefined,
      imageModel: undefined,
    }));

  return {
    title: parsed.title,
    description: parsed.description || parsed.title,
    coverImageUrl: undefined,
    chapters,
    avatarDevelopments: [],
    metadata: {
      tokensUsed: {
        prompt: totalUsage.prompt,
        completion: totalUsage.completion,
        total: totalUsage.total,
        modelUsed: finalModelUsed,
      },
      model: finalModelUsed,
      supportModel,
      storyModel: finalModelUsed,
      imagesGenerated: 0,
      developerMode: true,
      devModePipeline: DEV_MODE_PIPELINE_ID,
      storyPolishApplied,
      chapterRepairApplied,
      localQualityDiagnostics: finalDiagnostics,
      repairSelfReflections,
      rawQualityScore,
      localGateScore,
      literaryValidation: finalValidatorFindings,
      qualityGatePassed:
        (finalDiagnostics?.hardIssueCount ?? 0) === 0
        && (finalQualityScore ?? rawQualityScore ?? localGateScore ?? 0) >= DEV_MODE_MIN_MARKET_QUALITY_SCORE
        && releaseDimensionFailures(finalValidatorFindings).length === 0,
      qualityGateFailureReason,
      returnedWithQualityGateWarnings: Boolean(qualityGateFailureReason),
      noveltySeed: input.noveltyBrief?.seed,
      noveltyRecentStoryCount: input.noveltyBrief?.recentStories.length ?? 0,
      noveltyHardAvoidMotifCount: input.noveltyBrief?.hardAvoidMotifs.length ?? 0,
      noveltyKeyMomentLens: input.noveltyBrief?.keyMomentLens,
      ideaCandidateCount: ideaCandidates.length,
      selectedIdeaTitle: input.selectedIdea?.title,
      selectedSupportingCast: input.selectedIdea?.selectedSupportingCast,
      devModeStages: stageLogs.map((stage) => ({
        stage: stage.stage,
        usage: stage.usage,
        modelUsed: stage.modelUsed,
        modelRole: stage.modelRole,
        durationMs: stage.durationMs,
        score: extractQualityScore(stage.parsed) ?? undefined,
      })),
      qualityScore: finalQualityScore,
    },
  };
}

async function generateStoryDevModeLegacy(
  input: DevModeGenerationInput
): Promise<DevModeGeneratedStory> {
  const { systemPrompt, userPrompt, chapterCount } = buildPrompts(input);

  const avatarNames = (input.avatars || []).map((a) => a.name).filter(Boolean);
  const poolNames = (input.poolCharacters || []).map((c) => c.name);

  console.log("[dev-mode-generation] 🧪 Dev mode prompt", {
    chapterCount,
    ageGroup: input.config.ageGroup,
    genre: input.config.genre,
    setting: input.config.setting,
    avatarCount: avatarNames.length,
    avatarNames,
    poolCharacterCount: poolNames.length,
    poolCharacterNames: poolNames,
    aiModel: input.config.aiModel,
    aiProvider: input.config.aiProvider,
    systemPromptChars: systemPrompt.length,
    userPromptChars: userPrompt.length,
  });

  const startedAt = Date.now();
  let provider: ProviderResult;
  try {
    provider = await callProvider(input.config, systemPrompt, userPrompt);
  } catch (callError) {
    // Persist the failed attempt so it shows up in /logs for debugging.
    await publishWithTimeout(logTopic, {
      source: "dev-mode-generation",
      timestamp: new Date(),
      request: {
        mode: "developer",
        provider: input.config.aiProvider === "openrouter" ? "openrouter" : "native",
        model: input.config.aiModel,
        openRouterModel: input.config.openRouterModel,
        systemPrompt,
        userPrompt,
        wizardConfig: {
          chapterCount,
          ageGroup: input.config.ageGroup,
          genre: input.config.genre,
          setting: input.config.setting,
          language: input.config.language,
          avatarNames,
          poolCharacterNames: poolNames,
          primaryProfileAge: input.primaryProfileAge,
          learningModeEnabled: !!input.config.learningMode?.enabled,
          learningModeSubjects: input.config.learningMode?.subjects,
          customPrompt: input.config.customPrompt,
        },
      },
      response: {
        error: callError instanceof Error ? callError.message : String(callError),
        durationMs: Date.now() - startedAt,
      },
      metadata: { devMode: true, stage: "provider-call", failed: true },
    }).catch((logErr) => {
      console.warn("[dev-mode-generation] Failed to publish failure log:", logErr);
    });
    throw callError;
  }

  let parsed: DevModeRawStory;
  try {
    parsed = parseAndValidate(provider.content, chapterCount);
  } catch (parseError) {
    // Log the raw model output even when parsing fails — this is exactly
    // what we need on /logs to diagnose JSON breakage.
    await publishWithTimeout(logTopic, {
      source: "dev-mode-generation",
      timestamp: new Date(),
      request: {
        mode: "developer",
        provider: input.config.aiProvider === "openrouter" ? "openrouter" : "native",
        model: provider.modelUsed,
        openRouterModel: input.config.openRouterModel,
        systemPrompt,
        userPrompt,
      },
      response: {
        rawContent: provider.content,
        contentLength: provider.content.length,
        usage: provider.usage,
        parseError: parseError instanceof Error ? parseError.message : String(parseError),
        durationMs: Date.now() - startedAt,
      },
      metadata: { devMode: true, stage: "parse", failed: true },
    }).catch((logErr) => {
      console.warn("[dev-mode-generation] Failed to publish parse-failure log:", logErr);
    });
    throw parseError;
  }

  // Successful run — log input prompts + raw model output + parsed story.
  await publishWithTimeout(logTopic, {
    source: "dev-mode-generation",
    timestamp: new Date(),
    request: {
      mode: "developer",
      provider: input.config.aiProvider === "openrouter" ? "openrouter" : "native",
      model: provider.modelUsed,
      openRouterModel: input.config.openRouterModel,
      systemPrompt,
      userPrompt,
      wizardConfig: {
        chapterCount,
        ageGroup: input.config.ageGroup,
        genre: input.config.genre,
        setting: input.config.setting,
        language: input.config.language,
        avatarNames,
        poolCharacterNames: poolNames,
        primaryProfileAge: input.primaryProfileAge,
        learningModeEnabled: !!input.config.learningMode?.enabled,
        learningModeSubjects: input.config.learningMode?.subjects,
        customPrompt: input.config.customPrompt,
      },
    },
    response: {
      rawContent: provider.content,
      contentLength: provider.content.length,
      parsed: {
        title: parsed.title,
        description: parsed.description,
        chapterCount: parsed.chapters.length,
        chapters: parsed.chapters.map((c) => ({
          order: c.order,
          title: c.title,
          contentChars: c.content.length,
        })),
      },
      usage: provider.usage,
      durationMs: Date.now() - startedAt,
    },
    metadata: { devMode: true, stage: "complete" },
  }).catch((logErr) => {
    console.warn("[dev-mode-generation] Failed to publish success log:", logErr);
  });

  const chapters = parsed.chapters
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((ch, idx) => ({
      id: crypto.randomUUID(),
      title: ch.title,
      content: ch.content,
      order: idx + 1, // normalize ordering to 1..n regardless of what the model emitted
      imageUrl: undefined,
      imagePrompt: undefined,
      imageModel: undefined,
    }));

  return {
    title: parsed.title,
    description: parsed.description || parsed.title,
    coverImageUrl: undefined,
    chapters,
    avatarDevelopments: [],
    metadata: {
      tokensUsed: {
        prompt: provider.usage.prompt,
        completion: provider.usage.completion,
        total: provider.usage.total,
        modelUsed: provider.modelUsed,
      },
      model: provider.modelUsed,
      imagesGenerated: 0,
      developerMode: true,
    },
  };
}

// ─── Auto-cast supporting characters from character_pool ───────────────────
// Mirrors the *outcome* of the standard pipeline's casting-engine but stays
// fully synchronous and self-contained — no variant plan, no RNG seed, no
// artifact matching, no LLM calls. Just: filter by setting/age, prefer
// story-fit and freshness, return a broad idea-lab pool; final 2–4 supporting
// characters are selected after the winning idea is known.

interface CharacterPoolRow {
  id: string;
  name: string;
  role: string | null;
  archetype: string | null;
  emotional_nature: any;
  visual_profile: any;
  max_screen_time: number | null;
  available_chapters: number[] | null;
  age_category: string | null;
  species_category: string | null;
  personality_keywords: string[] | null;
  physical_description: string | null;
  backstory: string | null;
  dominant_personality: string | null;
  secondary_traits: string[] | null;
  catchphrase: string | null;
  catchphrase_context: string | null;
  speech_style: string[] | null;
  emotional_triggers: string[] | null;
  quirk: string | null;
  canon_settings: string[] | null;
  recent_usage_count: number | null;
  total_usage_count: number | null;
  last_used_at: Date | null;
}

function ageGroupMaxAge(ageGroup?: string): number {
  switch (ageGroup) {
    case "3-5":
      return 5;
    case "6-8":
      return 8;
    case "9-12":
      return 12;
    case "13+":
      return 16;
    default:
      return 12;
  }
}

async function loadRecentCharacterUsageForUser(userId?: string): Promise<Map<string, number>> {
  if (!userId) return new Map();
  try {
    const rows = await storyDB.queryAll<{ character_id: string; usage_count: number }>`
      SELECT sc.character_id, COUNT(*) as usage_count
      FROM story_characters sc
      WHERE sc.story_id IN (
        SELECT id
        FROM stories
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT 20
      )
      GROUP BY sc.character_id
    `;
    return new Map(rows.map((row) => [row.character_id, Number(row.usage_count) || 0]));
  } catch (err) {
    console.warn("[dev-mode-generation] Failed to load recent character usage; casting will continue without user-recency penalty:", err);
    return new Map();
  }
}

function daysSince(date?: Date | string | null): number | undefined {
  if (!date) return undefined;
  const value = date instanceof Date ? date : new Date(date);
  const time = value.getTime();
  if (!Number.isFinite(time)) return undefined;
  return Math.max(0, (Date.now() - time) / (24 * 60 * 60 * 1000));
}

function weightedPickCharacter<T extends { score: number }>(candidates: T[]): T | undefined {
  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) return candidates[0];
  const minScore = Math.min(...candidates.map((candidate) => candidate.score));
  const weights = candidates.map((candidate) => Math.pow(Math.max(1, candidate.score - minScore + 1), 1.15));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = Math.random() * totalWeight;
  for (let i = 0; i < candidates.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

/**
 * Pick supporting characters for dev mode. Caller passes the wizard's
 * setting/genre/age and the set of hero avatar names to exclude.
 *
 * Selection strategy:
 *  1. Load all active pool characters.
 *  2. Score each by setting/genre/age fit plus global and per-user freshness.
 *  3. Pick from a weighted top window with archetype diversity instead of
 *     always returning the same deterministic top rows.
 *  4. Return a broader idea-lab candidate pool. The final 0-2 story cast is
 *     selected after the winning premise is known, before blueprint writing.
 */
export async function pickDevModePoolCharacters(input: {
  setting?: string;
  genre?: string;
  ageGroup?: string;
  userId?: string;
  excludeNames: Set<string>;
  heroCount: number;
}): Promise<DevModePoolCharacter[]> {
  let rows: CharacterPoolRow[] = [];
  try {
    rows = await storyDB.queryAll<CharacterPoolRow>`
      SELECT id, name, role, archetype, emotional_nature, visual_profile,
             max_screen_time, available_chapters,
             age_category, species_category, personality_keywords,
             physical_description, backstory, dominant_personality,
             secondary_traits, catchphrase, catchphrase_context,
             speech_style, emotional_triggers, quirk, canon_settings,
             recent_usage_count, total_usage_count, last_used_at
      FROM character_pool
      WHERE is_active = TRUE
    `;
  } catch (err) {
    console.warn("[dev-mode-generation] Failed to load character_pool, continuing without supporting cast:", err);
    return [];
  }

  if (rows.length === 0) return [];

  const setting = (input.setting || "").trim().toLowerCase();
  const genre = (input.genre || "").trim().toLowerCase();
  const ageMax = ageGroupMaxAge(input.ageGroup);
  const maxGlobalChars = ageMax <= 5 ? 3 : ageMax <= 8 ? 4 : 6;
  const finalStoryCastBudget = Math.max(
    DEV_MODE_MIN_SUPPORTING_CAST,
    Math.min(DEV_MODE_MAX_SUPPORTING_CAST, maxGlobalChars - Math.max(1, input.heroCount))
  );
  const targetCount = Math.min(DEV_MODE_MAX_IDEA_POOL_CANDIDATES, Math.max(8, finalStoryCastBudget * 3));
  const userRecentUsage = await loadRecentCharacterUsageForUser(input.userId);

  const scored = rows
    .filter((r) => !input.excludeNames.has((r.name || "").toLowerCase()))
    .map((r) => {
      let score = 0;
      const role = String(r.role || "").toLowerCase();
      const archetype = String(r.archetype || "").toLowerCase();
      const visualProfile = asPlainObject(r.visual_profile);
      const visualSpecies = String(visualProfile.species || "").toLowerCase();
      const species = String(r.species_category && r.species_category !== "any" ? r.species_category : visualSpecies || r.species_category || "").toLowerCase();
      const emotionalNature = asPlainObject(r.emotional_nature);
      const dominantPersonality = String(r.dominant_personality || emotionalNature.dominant || r.personality_keywords?.[0] || "").trim();
      const secondaryTraits = compactStringList((r.secondary_traits || []).length > 0 ? r.secondary_traits : emotionalNature.secondary, 4);
      const emotionalTriggers = compactStringList((r.emotional_triggers || []).length > 0 ? r.emotional_triggers : emotionalNature.triggers, 4);

      // Setting match — strong signal. canon_settings is text[].
      const canon = (r.canon_settings || []).map((s) => s.toLowerCase());
      if (setting.length > 0 && canon.length > 0) {
        if (canon.includes(setting)) score += 34;
        else if (canon.some((c) => c.includes(setting) || setting.includes(c))) score += 18;
      } else if (canon.length === 0) {
        // No canon_settings = universal character, small neutral score.
        score += 8;
      }

      // Freshness — prefer less-recently-used to rotate cast across stories.
      const recent = Number(r.recent_usage_count) || 0;
      const total = Number(r.total_usage_count) || 0;
      const userRecent = userRecentUsage.get(r.id) || 0;
      score += Math.max(0, 18 - recent * 5);
      score -= userRecent * 6;
      score -= Math.min(total, 30) * 0.15;
      if (total === 0) score += 8;
      const lastUsedDays = daysSince(r.last_used_at);
      if (typeof lastUsedDays === "number") {
        if (lastUsedDays < 2) score -= 5;
        else if (lastUsedDays < 7) score -= 3;
        else if (lastUsedDays < 21) score -= 1;
      }

      // Genre fit — light approximation of the standard pipeline's requirement-based matcher.
      if (genre.includes("fairy") || genre.includes("maerchen") || genre.includes("märchen")) {
        if (species === "animal" || species === "magical_creature" || looksLikeVividStorySpecies(species)) score += 14;
        if (/helper|guide|witch|trickster|villain|guardian/.test(`${role} ${archetype}`)) score += 10;
      } else if (genre.includes("adventure") || genre.includes("abenteuer")) {
        if (/helper|guide|scout|messenger|trickster/.test(`${role} ${archetype}`)) score += 10;
        if (species === "animal" || species === "magical_creature" || looksLikeVividStorySpecies(species)) score += 6;
      } else {
        if (/helper|guide|friend|guardian/.test(`${role} ${archetype}`)) score += 6;
      }

      // Age fit — younger stories benefit from vivid, readable support cast.
      if (ageMax <= 8) {
        if (species === "animal" || species === "magical_creature" || looksLikeVividStorySpecies(species)) score += 8;
        if ((r.catchphrase || "").trim()) score += 4;
        if ((r.quirk || "").trim()) score += 4;
        if ((r.speech_style || []).length > 0) score += 3;
      }

      // Richness — prefer characters with usable on-page behavior, not empty shells.
      if (dominantPersonality) score += 3;
      if (secondaryTraits.length > 0) score += 3;
      if (emotionalTriggers.length > 0) score += 4;
      if ((r.personality_keywords || []).length >= 2) score += 2;
      if ((r.catchphrase_context || "").trim()) score += 1;
      if ((r.backstory || "").trim()) score += 2;

      // Small noise + weighted lottery below prevent the same top rows from
      // winning every dev-mode generation while preserving relevance.
      score += Math.random() * 8;

      return { row: r, score, recent, total, userRecent };
    })
    .sort((a, b) => b.score - a.score);

  const picked: CharacterPoolRow[] = [];
  const seenArchetypes = new Set<string>();

  const pickFromScored = (allowDuplicateArchetypes: boolean) => {
    while (picked.length < targetCount) {
      const available = scored.filter((candidate) => {
        if (picked.includes(candidate.row)) return false;
        const arch = (candidate.row.archetype || "").toLowerCase();
        return allowDuplicateArchetypes || !arch || !seenArchetypes.has(arch);
      });
      if (available.length === 0) break;
      const windowSize = Math.min(available.length, Math.max(targetCount * 4, 12));
      const chosen = weightedPickCharacter(available.slice(0, windowSize));
      if (!chosen) break;
      picked.push(chosen.row);
      const arch = (chosen.row.archetype || "").toLowerCase();
      if (arch) seenArchetypes.add(arch);
    }
  };

  // Diversity first: avoid same archetype if enough candidates exist. Then top up.
  pickFromScored(false);
  pickFromScored(true);

  if (picked.length < targetCount) {
    for (const candidate of scored) {
      if (picked.length >= targetCount) break;
      if (picked.includes(candidate.row)) continue;
      picked.push(candidate.row);
    }
  }

  console.log("[dev-mode-generation] Dev mode pool casting selection", {
    availableCharacters: rows.length,
    eligibleCharacters: scored.length,
    targetCount,
    finalStoryCastBudget,
    picked: picked.map((row) => row.name),
    topCandidates: scored.slice(0, 8).map((candidate) => ({
      name: candidate.row.name,
      score: Math.round(candidate.score * 10) / 10,
      recent: candidate.recent,
      userRecent: candidate.userRecent,
      total: candidate.total,
    })),
  });

  return picked.map((r) => {
    const vp = asPlainObject(r.visual_profile);
    const physicalDescription =
      r.physical_description ||
      (vp.description || vp.appearance || null);
    const emotionalNature = asPlainObject(r.emotional_nature);
    const dominantPersonality = String(r.dominant_personality || emotionalNature.dominant || r.personality_keywords?.[0] || "").trim() || null;
    const secondaryTraits = compactStringList((r.secondary_traits || []).length > 0 ? r.secondary_traits : emotionalNature.secondary, 6);
    const emotionalTriggers = compactStringList((r.emotional_triggers || []).length > 0 ? r.emotional_triggers : emotionalNature.triggers, 6);
    const personalityKeywords = (r.personality_keywords || []).length > 0
      ? r.personality_keywords || []
      : [dominantPersonality, ...secondaryTraits].filter((value): value is string => Boolean(value)).slice(0, 6);
    const visualSpecies = String(vp.species || "").trim();
    const species = r.species_category && r.species_category !== "any"
      ? r.species_category
      : visualSpecies || r.species_category;
    const colorPalette = compactStringList(vp.colorPalette, 4);

    return {
      id: r.id,
      name: r.name,
      role: r.role || undefined,
      archetype: r.archetype || undefined,
      species,
      ageCategory: r.age_category,
      dominantPersonality,
      secondaryTraits,
      emotionalNature,
      emotionalTriggers,
      physicalDescription,
      colorPalette,
      personalityKeywords,
      catchphrase: r.catchphrase,
      catchphraseContext: r.catchphrase_context,
      speechStyle: r.speech_style || [],
      quirk: r.quirk,
      backstory: r.backstory,
      maxScreenTime: r.max_screen_time,
      availableChapters: r.available_chapters || [],
      canonSettings: r.canon_settings || [],
      recentUsageCount: Number(r.recent_usage_count) || 0,
      totalUsageCount: Number(r.total_usage_count) || 0,
      recentUserUsageCount: userRecentUsage.get(r.id) || 0,
      lastUsedAt: r.last_used_at,
    };
  });
}

export async function recordDevModePoolCharacterUsage(input: {
  storyId: string;
  poolCharacters: DevModePoolCharacter[];
  selectedSupportingCast?: string[];
}): Promise<void> {
  const selectedNames = new Set((input.selectedSupportingCast || []).map(normalizePoolName));
  const usedCharacters = selectedNames.size > 0
    ? input.poolCharacters.filter((character) => selectedNames.has(normalizePoolName(character.name)))
    : input.poolCharacters.slice(0, Math.min(3, input.poolCharacters.length));

  if (usedCharacters.length === 0) return;

  for (const [index, character] of usedCharacters.entries()) {
    try {
      const existing = await storyDB.queryRow<{ id: string }>`
        SELECT id
        FROM story_characters
        WHERE story_id = ${input.storyId}
          AND character_id = ${character.id}
        LIMIT 1
      `;
      if (existing) continue;

      await storyDB.exec`
        UPDATE character_pool
        SET recent_usage_count = COALESCE(recent_usage_count, 0) + 1,
            total_usage_count = COALESCE(total_usage_count, 0) + 1,
            last_used_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${character.id}
      `;

      await storyDB.exec`
        INSERT INTO story_characters (id, story_id, character_id, placeholder)
        VALUES (
          ${crypto.randomUUID()},
          ${input.storyId},
          ${character.id},
          ${`{{DEV_MODE_SUPPORT_${index + 1}}}`}
        )
      `;
    } catch (err) {
      console.warn("[dev-mode-generation] Failed to record dev-mode character usage", {
        storyId: input.storyId,
        characterId: character.id,
        characterName: character.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
