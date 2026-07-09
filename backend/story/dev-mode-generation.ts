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
 *   1. support model: idea candidates + 9.0 potential filter
 *   2. support model: logline, emotional engine, beat sheet, scene cards
 *   3. selected wizard model: one continuous final story draft
 *   3b. server-side reading breaks for app display (not author chapters)
 *   4. support model: hard market-quality validation (no prose rewrite)
 *
 * Images: cover + per-reading-page illustrations are generated via a single
 * support-model call that produces all image prompts, followed by parallel
 * Runware calls. Best-effort: a story without images still ships.
 * No personality / memory mutation happens after generation — the caller
 * (`backend/story/generate.ts`) is responsible for skipping that block.
 */

import { createHash } from "crypto";
import { secret } from "encore.dev/config";
import { ai } from "~encore/clients";
import { generateWithGemini, isGeminiConfigured } from "./gemini-generation";
import { callAnthropicCompletion } from "./pipeline/llm-client";
import { callOpenRouterChatCompletion, normalizeOpenRouterModel } from "./openrouter-generation";
import { isOpenRouterFamilyModel, resolveConfiguredStoryModel, GEMINI_MAIN_STORY_MODEL } from "./pipeline/model-routing";
import { getReferenceFewshotBlock } from "./pipeline/reference-fewshot";
import type { StoryConfig, AIProvider } from "./generate";
import { buildStoryExperienceContext, describeEmotionalFlavors, describeSpecialIngredients } from "./story-experience";
import { publishWithTimeout } from "../helpers/pubsubTimeout";
import { logTopic } from "../log/logger";
import { storyDB } from "./db";
import { artifactMatcher, recordStoryArtifact } from "./artifact-matcher";
import type { ArtifactTemplate, ArtifactRequirement, ArtifactCategory } from "./types";
import { mapWithConcurrency } from "../helpers/asyncPool";
import { buildSpriteCollage } from "./pipeline/sprite-collage";
import { resolveImageUrlForClient } from "../helpers/bucket-storage";
import {
  sanitizeDescription,
  applyOrthographyAutoFix,
  validateGermanGrammar,
  detectHelperExplainsSolution,
  detectStructureSignals,
} from "./dev-mode-sanitizers";
import {
  unwrapJsonPrompt,
  mergeNegativePrompt,
  preflightImagePrompt,
  filterReferencesForScene,
} from "./dev-mode-image-guards";
import {
  recordStoryMotif,
  loadRecentMotifs,
  findMotifReuse,
  buildFingerprintFromBlueprint,
} from "./dev-mode-motif-memory";
import {
  buildVisualQaPrompt,
  parseVisualQaReport,
  shouldRegenerateImage,
  type VisualQaReport,
} from "./dev-mode-visual-qa";

const openAIKey = secret("OpenAIKey");

const DEFAULT_GEMINI_MODEL = "gemini-3-flash-preview";
const DEV_MODE_SUPPORT_MODEL = "google/gemini-3.1-flash-lite";
// v12 - "screenplay-first": lock idea potential and scene function before prose,
// then draft a continuous narrative and derive display-only reading pages.
const DEV_MODE_PIPELINE_ID = "screenplay-first-v12";
const DEV_MODE_RUNTIME_HOTFIX = "dev-mode-blocking-quality-gates-2026-05-20";
const DEV_MODE_PREMIUM_QUALITY_SCORE_CAP_ON_HARD_GATE = 7.9;
const DEV_MODE_SCENE_CARD_COUNT = 5;
const DEV_MODE_MAX_IDEA_ROUNDS = 3;
const DEV_MODE_MIN_DIALOG_PCT = 25;
// Premium hard floor for measured dialogue share. Re-calibrated 27 → 25 to
// match real published read-aloud picture books (Gruffalo / Schule der
// magischen Tiere sit around 20–26% spoken text). The old 27% floor turned
// genuinely excellent quiet fairy tales (clean motif, subtext, planted
// payoff, image ending) into permanent quality_gate_failed runs because a
// reflective Vorlesegeschichte naturally lands at ~25%. Premium quality is
// now gated on craft (distinct voices, payoff, image ending), not on a raw
// dialogue quota that punishes the calm register.
const DEV_MODE_DIALOG_REBALANCE_MIN_DIALOG_PCT = 25;
// Below this measured dialogue share the draft gets ONE targeted redraft with
// explicit feedback before any polish/rebalance pass runs. Production logs
// (734d7ae5: 16.6%, a27e9788: 16.9%) show drafts this far under the floor are
// never rescued by downstream repairs — they just trade words for dialogue.
const DEV_MODE_DRAFT_REDRAFT_DIALOG_PCT = 24;
const DEV_MODE_TARGET_DIALOG_PCT = 32;
// Writer-side target. Was 50% (caused filler chatter and compliance prose).
// New range matches real children's-book dialogue density (25–40%).
const DEV_MODE_PROMPT_DIALOG_PCT = 35;
// Upper soft cap. Kimi/Moonshot overshoots badly (run 3db9b3b0: 49% overall,
// 58-67% on chapters 1-3) — a story that is almost all talk loses the sensory
// narration, action beats and read-aloud rhythm a picture book needs.
const DEV_MODE_MAX_DIALOG_PCT = 45;
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
const DEV_MODE_MIN_MARKET_QUALITY_SCORE = 8.0;
const DEV_MODE_PREMIUM_RELEASE_SCORE = 9.0;
const DEV_MODE_TARGET_MARKET_QUALITY_SCORE = 9.5;
const DEV_MODE_MIN_RELEASE_DIMENSION_SCORE = 8.0;
const DEV_MODE_MAX_VALIDATION_POLISH_ATTEMPTS = 2;
// See "Diminishing-returns brake" at the validation-polish loop: once a
// story clears all hard gates and scores at/above this, further validation
// rounds are skipped even though the premium target (9.0) is technically
// unmet. Chosen just above the "market-quality" floor (8.0) so a story that
// already reads as a solid shelf book does not pay for a third or fourth
// repair pass chasing the last half-point.
const DEV_MODE_DIMINISHING_RETURNS_SCORE = 8.5;
const DEV_MODE_MIN_SUPPORTING_CAST = 0;
// v12 §8: short children's stories (900-1200 words) collapse under 4 supporting
// characters. Cap at 2 and bias the cast-selection toward 1 unless both are
// plot-critical (see finalizeSelectedIdeaCast / supporting-cast prompt
// instructions, which now require `requiredForBeat` for the second slot).
const DEV_MODE_MAX_SUPPORTING_CAST = 2;
const DEV_MODE_PREFERRED_SUPPORTING_CAST = 1;
const DEV_MODE_MAX_IDEA_POOL_CANDIDATES = 8;
const DEV_MODE_IDEA_STRUCTURE_CARD_LIMIT = 4;
// v12 §R — spec allows 8–12 surgical line replacements. Raised from 8 to 12
// so a release-near story with multiple weak dialogue beats can still be
// fixed in one punchup pass without the writer cherry-picking which lines
// to skip.
const DEV_MODE_LINE_PUNCHUP_MAX_REPLACEMENTS = 12;
// v12 §R — line-punchup is only valid for release-near stories. Below this
// score the structural repair router must run instead; punchup cannot fix
// plot, page count, or dialogue volume.
const DEV_MODE_LINE_PUNCHUP_MIN_SCORE = 8.6;
const DEV_MODE_LINE_PUNCHUP_MIN_LINE_CHARS = 30;
const DEV_MODE_VALIDATOR_QUALITY_REPAIR_LIMIT = 2;

const NOVELTY_MIN_FAMILY_PREFIX_LENGTH = 6;

// v12 §B/§C — premium/efficient potential thresholds live in their own
// importsafe module so smoke tests and other tooling can read them without
// pulling the Encore runtime. See backend/story/pipeline/potential-thresholds.ts.
import {
  EFFICIENT_POTENTIAL_THRESHOLDS,
  PREMIUM_POTENTIAL_THRESHOLDS,
  getPotentialThresholds,
  potentialGateFailures as potentialGateFailuresShared,
  type DevModeQualityMode,
  type PotentialThresholds,
} from "./pipeline/potential-thresholds";
import { shouldBlockPremiumPotentialGateFailure } from "./pipeline/dev-mode-gate-policy";
import {
  validateBeatSheetSpecH,
  validateSceneCardsSpecI,
  isHardRejectInPremium,
} from "./pipeline/screenplay-validators";
import {
  chooseRepairStrategy as chooseRepairStrategyShared,
  isDeterministicRepairStrategy as isDeterministicRepairStrategyShared,
  maxRepairAttemptsFor as maxRepairAttemptsForShared,
  type DevModeRepairStrategy as RepairRouterStrategy,
  type RepairRouterContext as RepairRouterCtx,
} from "./pipeline/repair-router";
import { buildStrategyDirectivesBlock as buildStrategyDirectivesBlockShared } from "./pipeline/repair-strategy-directives";
import {
  classifyFinalRouting,
  type FinalFailureClass,
  type FinalRecommendedRoute,
} from "./pipeline/final-routing";
import {
  STORY_SKELETONS,
  type StorySkeleton,
} from "./pipeline/content-library/story-skeletons";
import { getAntagonistArchetype } from "./pipeline/content-library/antagonist-archetypes";
import {
  buildPremiseSeedPromptBlock,
  selectPremiseSeedsForIdeaLab,
} from "./pipeline/content-library/premise-seeds";

/**
 * Back-compat alias. Existing code reads `DEV_MODE_POTENTIAL_THRESHOLDS.<key>`
 * in a handful of non-mode-aware spots; those default to premium thresholds.
 * Prefer `getPotentialThresholds(mode)` for any new call site.
 */
const DEV_MODE_POTENTIAL_THRESHOLDS = PREMIUM_POTENTIAL_THRESHOLDS;
// Keep `EFFICIENT_POTENTIAL_THRESHOLDS` re-export referenced so the import does
// not get tree-shaken; it is used by potential-thresholds tests.
void EFFICIENT_POTENTIAL_THRESHOLDS;
void (null as unknown as PotentialThresholds);

interface DevModeChapter {
  title: string;
  content: string;
  order: number;
}

interface DevModeReadingBreak {
  afterParagraph: number;
  imagePromptScene: string;
  scenePurpose?: string;
}

interface DevModeRawStory {
  title: string;
  description: string;
  chapters: DevModeChapter[];
  storyText?: string;
  readingBreaks?: DevModeReadingBreak[];
  displayMode?: "reading_pages";
}

type DevModePipelineStage =
  | "idea-candidates"
  | "idea-selection"
  | "potential-filter"
  | "logline-emotional-engine"
  | "filmic-beat-sheet"
  | "beat-sheet-repair"
  | "scene-cards"
  | "scene-cards-repair"
  | "dialogue-intent"
  | "dialogue-intent-repair"
  | "dialogue-rebalance"
  | "blueprint"
  | "blueprint-repair"
  | "dramaturgy-check"
  | "story-draft"
  | "whole-story-draft"
  | "story-splitter"
  | "reading-breaks"
  | "local-diagnostics"
  | "repair-router"
  | "chapter-repair"
  | "story-polish"
  | "line-punchup"
  | "final-validation"
  | "image-scene-plan"
  | "image-prompt-compiler"
  | "visual-qa"
  | "image-prompts"
  // v12 §4 + §11: page-count + expansion repair logging.
  | "page-count-repair"
  | "expansion-repair"
  // Draft-stage dialogue redraft (one retry when the draft's dialogue share
  // collapses far below the floor).
  | "draft-dialog-redraft";

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
  storyText?: string;
  readingBreaks?: DevModeReadingBreak[];
  displayMode?: "reading_pages";
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
    devModePipeline?: typeof DEV_MODE_PIPELINE_ID | "whole-story-first-v11" | "whole-story-continuity-v10" | "adaptive-chapter-repair-v5" | "adaptive-chapter-repair-v4" | "adaptive-chapter-repair-v2" | "four-stage-cost-optimized";
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
    releaseReady?: boolean;
    qualityMode?: "efficient" | "premium";
    /**
     * Final-story integrity. `storyVersion` increments with each applied
     * prose-repair pass (polish, chapter-repair). `storyContentHash` is a
     * SHA-256 prefix over the canonical visible text accepted by the quality
     * gate; persistence and render layers must echo it back unchanged.
     */
    storyVersion?: number;
    storyContentHash?: string;
    /** v12 §B: true when the run was executed with the debug flag set. */
    debug?: boolean;
    /**
     * v12 §S — which stage owns the failure (if any). Lets downstream
     * dashboards route a failed run to the right repair lane without
     * having to re-parse `hardIssueList`.
     */
    failureClass?: FinalFailureClass;
    /**
     * v12 §S — recommended next action. `release` only when releaseReady,
     * `local_fix` for form-only failures (page count, ortho, raw JSON),
     * `targeted_repair` for draft failures, `rewrite_from_scene_cards` for
     * plan failures, `regenerate_idea` when the core motif is unsalvageable.
     */
    recommendedRoute?: FinalRecommendedRoute;
    /** v12 §S — concrete issue strings the caller must address before release. */
    mustFixBeforeRelease?: string[];
    qualityGateFailureReason?: string;
    // v12 §1: explicit failure status so downstream PDF/image pipelines never
    // ship a story with open hard-gates. "ok" means releaseReady can be true.
    status?: "ok" | "quality_gate_failed";
    hardIssueList?: string[];
    imagesSkippedDueToQualityGate?: boolean;
    returnedWithQualityGateWarnings?: boolean;
    literaryValidation?: any;
    repairSelfReflections?: any[];
    displayMode?: "reading_pages";
    readingBreaks?: DevModeReadingBreak[];
    storyText?: string;
    noveltySeed?: string;
    noveltyRecentStoryCount?: number;
    noveltyHardAvoidMotifCount?: number;
    noveltyKeyMomentLens?: string;
    ideaCandidateCount?: number;
    selectedIdeaTitle?: string;
    selectedPremiseSeedId?: string;
    selectedPremiseSeedMutation?: string;
    selectedSupportingCast?: string[];
    matchedArtifact?: {
      id: string;
      name: string;
      category?: string;
      rarity?: string;
    };
    /**
     * Pool characters that actually made it into the story. Persisted into
     * the story metadata so `backend/story/list.ts` can hydrate them as
     * `story.config.characters` for the participants UI (same shape as the
     * standard pipeline).
     */
    characterPoolUsed?: Array<{ characterId: string; characterName: string }>;
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
  /** Canonical character reference image URL (used to build the sprite collage). */
  imageUrl?: string;
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
  /** Canonical pool character reference image URL (used to build the sprite collage). */
  imageUrl?: string;
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
  /**
   * v11 §5 / v12 §B: quality mode. `efficient` targets 8.3–8.8 with tighter
   * word budgets; `premium` targets 8.8–9.3+ with longer chapters. When unset
   * the legacy defaults apply (medium-length, target 9.0+).
   */
  qualityMode?: "efficient" | "premium";
  /**
   * v12 §B: debug flag. Inherits all premium-mode defaults (strict thresholds,
   * longer chapters), but disables hard-throws on candidate-filter failures so
   * callers can inspect failed runs, and skips the image pipeline entirely. Use
   * for diagnostics — do NOT mix into the user-facing premium path.
   */
  debug?: boolean;
  /**
   * Artifact picked from `artifact_pool` for this story. Acts as a supporting
   * prop / red-thread candidate — NOT the main role. Selected before idea
   * candidates so the prose can plant it naturally.
   */
  matchedArtifact?: DevModeMatchedArtifact;
}

/**
 * v12 §B: debug mode is a flag on top of premium, not a separate mode. Used to
 * short-circuit the §4 strict-fail throw and to skip image stages. Keep this
 * helper at module scope so it stays cheap and side-effect-free.
 */
function isDebugMode(input: { debug?: boolean }): boolean {
  return input.debug === true;
}

export interface DevModeMatchedArtifact {
  id: string;
  name: string;             // already in user language
  nameEn?: string;
  category: ArtifactCategory;
  rarity?: string;
  storyRole: string;
  visualKeywords: string[];
  emoji?: string;
  imageUrl?: string;
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

export interface CandidatePotentialScores {
  childRetellableHook: number;
  visualShelfAppeal: number;
  novelty: number;
  emotionalEngine: number;
  personalCostPotential: number;
  irreversibleMiddlePotential: number;
  conflictEscalationPotential: number;
  finalImagePotential: number;
  helperDependencyRisk: number;
  similarityToRecentEmotionalMechanics: number;
}

interface DevModeIdeaCandidate {
  id: string;
  premiseSeedId?: string;
  premiseSeedMutation?: string;
  title: string;
  oneLineHook: string;
  centralObjectOrPlace: string;
  wonderRule: string;
  emotionalEngine: string;
  coreConflict: string;
  whyKidWantsThis: string;
  whyDifferentFromRecent: string;
  recommendedSupportingCast: string[];
  potentialScores?: Partial<CandidatePotentialScores>;
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

interface DevModePotentialFilterAudit {
  id: string;
  title: string;
  scores: Candidate9Audit;
}

interface DevModePotentialFilterResult {
  candidateAudits: DevModePotentialFilterAudit[];
  passingCandidateIds: string[];
  chosenIdeaId?: string;
  selectedSupportingCast?: string[];
  roundRecommendation: "pass" | "regenerate";
}

interface DevModeScreenplayPlan {
  potentialFilter?: DevModePotentialFilterResult;
  loglineEngine?: any;
  beatSheet?: any;
  sceneCards?: any[];
  dialoguePlan?: any;
  gateIssues?: string[];
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
  "weiter", "jetzt", "dort", "hier", "heute", "morgen", "abend", "nacht", "zuruck", "zurueck",
  // Common content stopwords that aren't story-distinguishing
  "grosse", "große", "grossen", "großen", "klein", "kleine", "kleiner", "kleinen", "kleines", "kleinem",
  "abenteuer", "bruder", "schwester", "familie", "freund", "freunde",
  "zauber", "magie", "fantasie", "geheimnis", "geheimnisse", "wunder", "ploetzlich", "plötzlich",
  "geschichte", "kapitel", "kinder", "jungen", "maedchen", "mädchen", "junge",
  // Generic descriptive adjectives — these appear in nearly every blurb and
  // should never count as a "motif" that blocks a future story.
  "lustig", "lustige", "lustigen", "lustiges", "lustiger", "lustigem",
  "spannend", "spannende", "spannenden", "spannendes", "spannender", "spannendem",
  "wundervoll", "wundervolle", "wundervollen", "wundervolles", "wundervoller",
  "schoen", "schön", "schoene", "schöne", "schoenen", "schönen", "schoenes", "schönes",
  "warm", "warme", "warmen", "warmes", "warmer", "warmem",
  "froehlich", "fröhlich", "froehliche", "fröhliche", "froehlichen", "fröhlichen",
  "magisch", "magische", "magischen", "magisches", "magischer",
  "geheimnisvoll", "geheimnisvolle", "geheimnisvollen", "geheimnisvolles",
  // Everyday physical adjectives — far too common in children's prose to act
  // as story motifs (log 0e8c0a4e flagged "schweren" as a forbidden motif).
  "schwer", "schwere", "schweren", "schweres", "schwerer", "schwerem",
  "leicht", "leichte", "leichten", "leichtes", "leichter", "leichtem",
  "alt", "alte", "alten", "altes", "alter", "altem",
  "neu", "neue", "neuen", "neues", "neuer", "neuem",
  "dunkel", "dunkle", "dunklen", "dunkles", "dunkler", "dunklem",
  "hell", "helle", "hellen", "helles", "heller", "hellem",
  "kalt", "kalte", "kalten", "kaltes", "kalter", "kaltem",
  "lang", "lange", "langen", "langes", "langer", "langem",
  "tief", "tiefe", "tiefen", "tiefes", "tiefer", "tiefem",
  "leise", "leisen", "leises", "leiser", "leisem",
  "laut", "laute", "lauten", "lautes", "lauter", "lautem",
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

// ───────────────────────────────────────────────────────────────────────────
// v12 §3: Forbidden-Motif Preflight
//
// The novelty system tracks hardAvoidMotifs as full word-families
// ("schatten" -> schatten, schattencape, schattenumhang, schattenflur, …).
// Without an explicit pre-draft check those motifs can still slip into
// title/centralObject/wonderRule/sceneCards via the LLM's free-form fields
// and produce a fail at final-validation (one whole pipeline run wasted).
//
// This preflight runs BEFORE the prose draft. It does two things:
//   1. Try a local rename via a small dictionary (cheap, deterministic).
//   2. If the motif is load-bearing (centralObject or wonderRule), refuse
//      to repair and signal "regenerate idea".
// ───────────────────────────────────────────────────────────────────────────

const FORBIDDEN_MOTIF_LOCAL_REPAIRS: Record<string, string[]> = {
  schattencape: ["Tarncape", "Leisecape", "Stillcape", "Umhang der stillen Schritte"],
  schattenumhang: ["Tarncape", "Leisecape", "Stillumhang"],
  schattenkleid: ["Stillkleid", "Leisekleid"],
  schattenflur: ["Diele", "Stillflur"],
  schattenmantel: ["Tarnmantel", "Leisemantel"],
  toastgeraet: ["Frühstückskorb", "Frühstückstablett"],
  toaster: ["Frühstückskorb", "Frühstückstablett"],
  bodenritze: ["Bodenfuge", "Bodenrinne"],
};

interface ForbiddenMotifPlanScan {
  title?: string | null;
  description?: string | null;
  centralObjectOrPlace?: string | null;
  wonderRule?: string | null;
  artifact?: string | null;
  imagePromptSeed?: string | null;
  sceneCards?: Array<Record<string, any> | string> | null;
  oneLineHook?: string | null;
}

interface ForbiddenMotifPreflightResult {
  // Hard violations only: motifs the spec actually bans (e.g. user-supplied
  // hard-avoid list, anchor-contamination set). Caller should refuse to
  // proceed or trigger an idea regenerate when this is non-empty.
  violations: Array<{ field: string; motif: string; matched: string }>;
  // Soft warnings: novelty-hint motifs from recent stories. Logged for
  // observability but not blocking — children's-book vocabulary inevitably
  // overlaps with previous stories' theme words.
  softWarnings: Array<{ field: string; motif: string; matched: string }>;
  canRepair: boolean;
  repairedPlan?: ForbiddenMotifPlanScan;
  repairLog: string[];
}

function localRepairCandidate(matched: string): string | null {
  const key = normalizeNoveltyText(matched).replace(/\s+/g, "");
  if (FORBIDDEN_MOTIF_LOCAL_REPAIRS[key]) return FORBIDDEN_MOTIF_LOCAL_REPAIRS[key][0];
  return null;
}

function scanFieldForMotifs(
  fieldName: string,
  value: string | null | undefined,
  hardAvoidMotifs: string[]
): Array<{ field: string; motif: string; matched: string }> {
  if (!value) return [];
  const normalized = normalizeNoveltyText(value);
  const hits: Array<{ field: string; motif: string; matched: string }> = [];
  for (const motif of hardAvoidMotifs) {
    const normMotif = normalizeNoveltyText(motif);
    if (!normMotif) continue;
    for (const regex of buildNoveltyMotifRegexes(normMotif)) {
      regex.lastIndex = 0;
      for (const match of normalized.matchAll(regex)) {
        hits.push({ field: fieldName, motif, matched: match[0] });
      }
    }
  }
  return hits;
}

/**
 * Classify a motif as a hard ban or a soft novelty hint.
 *
 * Hard bans:
 *   - the curated `ANCHOR_CONTAMINATION_MOTIFS` set (style-anchor leakage)
 *   - the existing `FORBIDDEN_MOTIF_LOCAL_REPAIRS` keys (we have a known
 *     rename for them, so they are explicit policy)
 *
 * Everything else (`recentMotifs` from the user's prior stories) is a
 * novelty *hint* — children's-book vocabulary inevitably overlaps with
 * earlier stories' theme words ("wachst", "ablenkung", "regen", …) and
 * blocking every overlap kills generation outright (see logs.1779275469620
 * where two harmless words shut down a healthy scene-cards stage).
 */
function isHardBanMotif(motif: string): boolean {
  const normalized = normalizeNoveltyText(motif);
  if (!normalized) return false;
  for (const anchor of ANCHOR_CONTAMINATION_MOTIFS) {
    if (normalizeNoveltyText(anchor) === normalized) return true;
  }
  // Local-repair dictionary keys are explicit policy motifs.
  const collapsed = normalized.replace(/\s+/g, "");
  if (FORBIDDEN_MOTIF_LOCAL_REPAIRS[collapsed]) return true;
  // Also treat the prefix root as hard if any repair-dict key starts with
  // it (e.g. "schatten" is hard because "schattencape", "schattenumhang"
  // are in the dict). This catches the case where the user adds the bare
  // root to hardAvoidMotifs.
  for (const dictKey of Object.keys(FORBIDDEN_MOTIF_LOCAL_REPAIRS)) {
    if (dictKey.startsWith(collapsed) && collapsed.length >= 6) return true;
  }
  return false;
}

export function forbiddenMotifPreflight(
  plan: ForbiddenMotifPlanScan,
  hardAvoidMotifs: string[]
): ForbiddenMotifPreflightResult {
  // Split the input motif list once. `hardMotifs` block; `softMotifs` only
  // get logged as novelty drift signals.
  const hardMotifs = hardAvoidMotifs.filter(isHardBanMotif);
  const softMotifs = hardAvoidMotifs.filter((m) => !isHardBanMotif(m));

  const allViolations: Array<{ field: string; motif: string; matched: string }> = [];
  const softWarnings: Array<{ field: string; motif: string; matched: string }> = [];
  const repairLog: string[] = [];

  const scalarFields: Array<keyof ForbiddenMotifPlanScan> = [
    "title",
    "description",
    "oneLineHook",
    "centralObjectOrPlace",
    "wonderRule",
    "artifact",
    "imagePromptSeed",
  ];

  for (const field of scalarFields) {
    const value = plan[field];
    if (typeof value !== "string") continue;
    allViolations.push(...scanFieldForMotifs(field as string, value, hardMotifs));
    softWarnings.push(...scanFieldForMotifs(field as string, value, softMotifs));
  }

  if (Array.isArray(plan.sceneCards)) {
    plan.sceneCards.forEach((card, idx) => {
      if (!card) return;
      const text = typeof card === "string" ? card : JSON.stringify(card);
      allViolations.push(...scanFieldForMotifs(`sceneCards[${idx}]`, text, hardMotifs));
      softWarnings.push(...scanFieldForMotifs(`sceneCards[${idx}]`, text, softMotifs));
    });
  }

  if (allViolations.length === 0) {
    return { violations: [], softWarnings, canRepair: true, repairLog: [] };
  }

  // If any violation lives in centralObjectOrPlace or wonderRule, the motif
  // is load-bearing — local rename would break the story logic, so we refuse
  // to repair and signal regenerate.
  const loadBearingFields = new Set(["centralObjectOrPlace", "wonderRule"]);
  const hasLoadBearing = allViolations.some((v) => loadBearingFields.has(v.field));
  if (hasLoadBearing) {
    repairLog.push(
      `Load-bearing forbidden motif in ${allViolations
        .filter((v) => loadBearingFields.has(v.field))
        .map((v) => `${v.field}="${v.matched}"`)
        .join(", ")} — idea must be regenerated.`
    );
    return { violations: allViolations, softWarnings, canRepair: false, repairLog };
  }

  // Attempt local repairs on the remaining fields. Scene-card matches that
  // we can't rename are dropped to softWarnings rather than failing the
  // whole pipeline — the model can revise mid-stream.
  const repaired: ForbiddenMotifPlanScan = { ...plan };
  const stillHardViolations: typeof allViolations = [];
  for (const violation of allViolations) {
    const replacement = localRepairCandidate(violation.matched);
    if (!replacement) {
      if (violation.field.startsWith("sceneCards")) {
        // Sceneside hits are usually surface-level wording, not load-bearing;
        // we keep them as warnings instead of throwing.
        softWarnings.push(violation);
        repairLog.push(`No local repair for "${violation.matched}" in ${violation.field}; downgraded to soft warning.`);
        continue;
      }
      stillHardViolations.push(violation);
      repairLog.push(`No local repair candidate for "${violation.matched}" in ${violation.field}.`);
      continue;
    }
    const field = violation.field as keyof ForbiddenMotifPlanScan;
    const original = repaired[field];
    if (typeof original === "string") {
      const re = new RegExp(violation.matched.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      (repaired as any)[field] = original.replace(re, replacement);
      repairLog.push(`Renamed "${violation.matched}" → "${replacement}" in ${violation.field}.`);
    }
  }

  if (stillHardViolations.length > 0) {
    return { violations: stillHardViolations, softWarnings, canRepair: false, repairLog };
  }
  return { violations: [], softWarnings, canRepair: true, repairedPlan: repaired, repairLog };
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
  const aliases = currentCharacterNameMotifs(input);
  if (aliases.has(normalized)) return true;
  // Also catch German genitive/plural/possessive forms of character names
  // (e.g. "adrians" \u2192 "adrian", "alexanders" \u2192 "alexander", "novas" \u2192 "nova").
  // Strip a handful of common German/English noun suffixes and re-check.
  const trimmedCandidates = new Set<string>();
  for (const suffix of ["s", "es", "en", "n", "'s", "'"]) {
    if (normalized.endsWith(suffix) && normalized.length - suffix.length >= 3) {
      trimmedCandidates.add(normalized.slice(0, normalized.length - suffix.length));
    }
  }
  for (const candidate of trimmedCandidates) {
    if (aliases.has(candidate)) return true;
  }
  // Final guard: if any alias is a prefix of the motif and the motif is only
  // 1-3 chars longer (a typical inflection), treat as the same character name.
  for (const alias of aliases) {
    if (alias.length >= 4 && normalized.startsWith(alias) && normalized.length - alias.length <= 3) {
      return true;
    }
  }
  return false;
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
  const trueHardAvoid = brief.hardAvoidMotifs
    .filter((motif) => !NOVELTY_STOPWORDS.has(normalizeNoveltyText(motif)))
    .filter(isHardBanMotif)
    .slice(0, 18);
  const softAvoid = brief.hardAvoidMotifs
    .filter((motif) => !NOVELTY_STOPWORDS.has(normalizeNoveltyText(motif)))
    .filter((motif) => !isHardBanMotif(motif))
    .slice(0, 18);
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
    "- Treat true hard-avoid motifs as word families: if 'spiegel' is forbidden, also avoid spiegelt, Spiegelung, Spiegelwasser, etc.",
    trueHardAvoid.length > 0 ? `- True hard-avoid motifs unless the user's prompt explicitly requires them: ${trueHardAvoid.join(", ")}.` : null,
    softAvoid.length > 0 ? `- Soft recent-story motif hints: avoid making these the title/premise/magic rule, but do not contort normal prose around incidental generic words: ${softAvoid.join(", ")}.` : null,
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
  const lines: string[] = ["MAIN CHARACTERS FOR IDEA LAB:"];  avatars.forEach((avatar, index) => {
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
    `AVAILABLE SUPPORTING CAST CANDIDATES FOR IDEA LAB (recommend ${DEV_MODE_MIN_SUPPORTING_CAST}-${DEV_MODE_MAX_SUPPORTING_CAST} names — every story should include at least one supporting character to give the heroes someone to react to):`,
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

function escapeRegExp(text: string): string {
  return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getLockedCentralObject(input: DevModeGenerationInput): string {
  return compactExcerpt(String(
    input.selectedIdea?.centralObjectOrPlace ||
    input.selectedIdea?.title ||
    input.selectedIdea?.wonderRule ||
    ""
  ).trim(), 140);
}

/**
 * Final-story version + content hash.
 *
 * Computes a stable hash over the canonical user-visible text: title,
 * description, and ordered chapter (title + content). Used as a tripwire
 * between the validator's input and what is eventually persisted / rendered:
 * any drift indicates that the last repair was not propagated into the
 * exported version (e.g. PDF rendering off a stale story object).
 */
function computeStoryContentHash(input: {
  title: string;
  description: string;
  chapters: Array<{ title: string; content: string; order?: number }>;
}): string {
  const normalized = JSON.stringify({
    t: String(input.title || "").trim(),
    d: String(input.description || "").trim(),
    c: [...input.chapters]
      .map((ch, idx) => ({
        o: Number(ch.order ?? idx + 1),
        t: String(ch.title || "").trim(),
        c: String(ch.content || "").trim(),
      }))
      .sort((a, b) => a.o - b.o),
  });
  return createHash("sha256").update(normalized, "utf8").digest("hex").slice(0, 24);
}

function artifactNameCandidates(input: DevModeGenerationInput): string[] {
  const artifact = input.matchedArtifact;
  if (!artifact?.name) return [];
  const raw = [artifact.name, artifact.nameEn].filter((value): value is string => Boolean(value));
  const firstContentWords = raw
    .flatMap((name) => String(name).split(/\s+/))
    .map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").trim())
    .filter((word) => word.length >= 5 && !NOVELTY_STOPWORDS.has(normalizeNoveltyText(word)))
    .slice(0, 2);
  return [...new Set([...raw, ...firstContentWords].map((value) => value.trim()).filter(Boolean))];
}

function textMentionsArtifact(input: DevModeGenerationInput, text: unknown): boolean {
  const normalized = normalizeNoveltyText(String(text || ""));
  if (!normalized) return false;
  return artifactNameCandidates(input).some((candidate) => {
    const normalizedCandidate = normalizeNoveltyText(candidate);
    return normalizedCandidate.length >= 5 && noveltyMotifMatches(normalized, normalizedCandidate);
  });
}

function selectedIdeaMentionsArtifact(input: DevModeGenerationInput): boolean {
  if (!input.selectedIdea) return false;
  const ideaText = [
    input.selectedIdea.title,
    input.selectedIdea.oneLineHook,
    input.selectedIdea.centralObjectOrPlace,
    input.selectedIdea.wonderRule,
    input.selectedIdea.emotionalEngine,
    input.selectedIdea.coreConflict,
  ].filter(Boolean).join(" ");
  return textMentionsArtifact(input, ideaText);
}

function artifactNoveltyConflictMotifs(input: DevModeGenerationInput): string[] {
  const artifactText = artifactNameCandidates(input).join(" ");
  if (!artifactText || !input.noveltyBrief?.hardAvoidMotifs?.length) return [];
  const normalizedArtifactText = normalizeNoveltyText(artifactText);
  const conflicts: string[] = [];
  for (const motif of input.noveltyBrief.hardAvoidMotifs) {
    const normalizedMotif = normalizeNoveltyText(motif);
    if (normalizedMotif.length < 5 || NOVELTY_STOPWORDS.has(normalizedMotif)) continue;
    if (noveltyMotifMatches(normalizedArtifactText, normalizedMotif)) conflicts.push(motif);
  }
  return [...new Set(conflicts)].slice(0, 6);
}

function shouldExposeDevModeArtifact(input: DevModeGenerationInput): boolean {
  const artifact = input.matchedArtifact;
  if (!artifact?.name) return false;
  if (artifactNoveltyConflictMotifs(input).length > 0) return false;
  // Once a 9.0-potential idea is locked, the pool artifact may only remain in
  // planning prompts if that idea itself is about the artifact. Otherwise the
  // support model tends to promote the pool prop into personalObject/finale,
  // which breaks the selected premise's red thread (e.g. Umhang -> Rucksack).
  if (input.selectedIdea && !selectedIdeaMentionsArtifact(input)) return false;
  return true;
}

function buildCentralObjectContractBlock(input: DevModeGenerationInput): string | null {
  const central = getLockedCentralObject(input);
  if (!central) return null;
  const lines = [
    "CENTRAL OBJECT / RED-THREAD LOCK (binding):",
    `- The selected idea's central object/place is: ${central}.`,
    "- recurringMotif, personalObject, irreversibleMiddle.visibleDamage, and finalPayoff must all grow from this central object/place or from a child-keepsake directly tied to it.",
    "- Do not promote any pool artifact/background prop into the personalObject, magic rule, red thread, or final payoff unless the locked winning idea itself is explicitly about that artifact.",
    "- If a background prop conflicts with the locked central object, omit the prop entirely instead of renaming it or giving it a disguised function.",
  ];
  return lines.join("\n");
}

function buildPremiseSeedPromiseBlock(input: DevModeGenerationInput): string | null {
  const idea = input.selectedIdea;
  if (!idea?.premiseSeedId && !idea?.premiseSeedMutation) return null;
  const lines = [
    "PREMISE-SEED PROMISE (binding):",
    idea.premiseSeedId ? `- Seed id: ${idea.premiseSeedId}.` : null,
    idea.premiseSeedMutation ? `- Mutation to preserve causally: ${idea.premiseSeedMutation}.` : null,
    "- The mutated seed ingredients must become plot mechanics, not only title/description decoration.",
    "- If the seed/title promises a special system (e.g. seasons, moods, gravity, weather), the wonder rule must test that system on-page at least twice and the finale must pay it off visibly.",
    "- Do not flatten the seed into a generic magic object + generic lesson; keep the odd, child-retellable rule that made the premise worth selecting.",
  ];
  return lines.filter((line): line is string => Boolean(line)).join("\n");
}

function buildWonderRuleConsistencyBlock(input: DevModeGenerationInput): string | null {
  const rule = input.selectedIdea?.wonderRule?.trim();
  if (!rule) return null;
  const ruleLower = rule.toLowerCase();
  const hasColorCost = /farb|color|colour|blass|grau|bleich/.test(ruleLower)
    || /farb|color|colour|blass|grau|bleich/.test(String(input.selectedIdea?.oneLineHook || "").toLowerCase())
    || /farb|color|colour|blass|grau|bleich/.test(String(input.selectedIdea?.premiseSeedMutation || "").toLowerCase());
  const lines = [
    "WONDER-RULE CONSISTENCY (binding):",
    `- Rule to dramatize: ${rule}`,
    "- Every deliberate use/test of the magic must show cause → visible consequence → child reaction on the same page.",
    "- Do not have a helper explain the rule first. The children must infer it from repeated physical evidence.",
    hasColorCost
      ? "- Color-cost rule: each major magic use must name a specific color that fades/vanishes and what that loss changes for the child or garden. The finale may restore color only after the child's concrete restraint/sacrifice, not by automatic reset."
      : null,
  ];
  return lines.filter((line): line is string => Boolean(line)).join("\n");
}

function replaceSuppressedArtifactMentions(text: string, input: DevModeGenerationInput, replacement: string): { text: string; changed: boolean } {
  let out = String(text || "");
  const before = out;
  for (const candidate of artifactNameCandidates(input)) {
    if (candidate.length < 5) continue;
    out = out.replace(new RegExp(escapeRegExp(candidate), "gi"), replacement);
  }
  return { text: out, changed: out !== before };
}

function sanitizeSuppressedArtifactInValue<T>(value: T, input: DevModeGenerationInput, context: string): { value: T; changed: boolean; reason?: string } {
  if (shouldExposeDevModeArtifact(input) || !input.matchedArtifact?.name) return { value, changed: false };
  const central = getLockedCentralObject(input);
  if (!central) return { value, changed: false };

  const visit = (node: any): any => {
    if (typeof node === "string") {
      return replaceSuppressedArtifactMentions(node, input, central).text;
    }
    if (Array.isArray(node)) return node.map((item) => visit(item));
    if (node && typeof node === "object") {
      const next: Record<string, any> = {};
      for (const [key, nested] of Object.entries(node)) {
        next[key] = visit(nested);
      }
      return next;
    }
    return node;
  };

  const nextValue = visit(value) as T;
  const changed = JSON.stringify(nextValue) !== JSON.stringify(value);
  return {
    value: nextValue,
    changed,
    reason: changed ? `${context}: suppressed non-central/novelty-conflicting pool artifact; locked red thread to ${central}` : undefined,
  };
}

/**
 * Builds the artifact-from-pool block injected into idea/blueprint/draft/polish
 * prompts. The artifact is a SUPPORTING PROP and red-thread candidate, NOT the
 * main role. The model may anchor the recurring object/refrain around it, but
 * is free to keep it on the periphery if the story needs another red thread.
 */
function buildArtifactPropBlock(input: DevModeGenerationInput): string | null {
  const artifact = input.matchedArtifact;
  if (!artifact || !artifact.name) return null;
  if (!shouldExposeDevModeArtifact(input)) return null;
  const visualWords = (artifact.visualKeywords || []).slice(0, 6).filter(Boolean).join(", ");
  const lines: string[] = [
    "ARTIFACT FROM POOL (supporting prop, NOT the main role \u2014 use as the recurring red-thread object if it fits naturally):",
    `- Name: ${artifact.name}${artifact.emoji ? ` ${artifact.emoji}` : ""}`,
    `- Category: ${artifact.category}${artifact.rarity ? ` (${artifact.rarity})` : ""}`,
    `- Story role / how it works: ${artifact.storyRole}`,
  ];
  if (visualWords) lines.push(`- Visual cues: ${visualWords}`);
  lines.push(
    "- Treat this prop the way a real picture-book uses an object: it appears in the world, it gets used or misused once, it carries a small choice, and it stays present \u2014 it never solves the plot for the children. The MAIN avatars perform every decisive action."
  );
  lines.push(
    "- If the artifact does not fit the story idea cleanly, mention it only briefly as a small background detail; never force it. Do not put it on the cover or in the title unless it is genuinely central."
  );
  lines.push(
    "- ARTIFACT COMMITMENT RULE (binding for idea candidates): if you weave this artifact into a candidate, its name MUST appear in that candidate's centralObjectOrPlace OR wonderRule. Otherwise OMIT the artifact name from every field of that candidate \u2014 do NOT name it in premiseSeedMutation, oneLineHook, coreConflict, or title. Half-hearted decoration is forbidden: any candidate that names the artifact only in mutation/hook without making it load-bearing in centralObjectOrPlace/wonderRule will be scrubbed downstream and treated as a contract violation."
  );
  return lines.join("\n");
}

/**
 * Picks an artifact from `artifact_pool` using the shared ArtifactMatcher.
 * Lightweight requirement: no chapter constraints (dev-mode does not enforce
 * artifact discovery/usage chapters), category preference derived from genre
 * with sensible fallbacks. Returns null when the pool is empty or matching
 * fails \u2014 callers must NEVER block story generation on artifact selection.
 */
async function selectDevModeArtifact(
  input: DevModeGenerationInput,
  recentFingerprints: DevModeRecentStoryFingerprint[]
): Promise<DevModeMatchedArtifact | null> {
  const requirement: ArtifactRequirement = {
    placeholder: "{{ARTIFACT_REWARD}}",
    preferredCategory: pickDevModeArtifactCategory(input.config),
    requiredAbility: undefined,
    contextHint: "Dev-mode whole-story-first: prefer a graspable child-readable prop usable as a red-thread object.",
    discoveryChapter: 2,
    usageChapter: Math.max(3, deriveChapterCount(input.config.length) - 1),
    importance: "medium",
  };
  const recentIds = (recentFingerprints || []).map((entry) => entry.id).filter(Boolean);
  const genreKey = String(input.config.genre || "adventure").toLowerCase();
  const languageCode = String(input.config.language || "de").toLowerCase().startsWith("en") ? "en" : "de";
  let template: ArtifactTemplate;
  try {
    template = await artifactMatcher.match(requirement, genreKey, recentIds, languageCode);
  } catch (err) {
    console.warn("[dev-mode-generation] artifactMatcher.match failed:", (err as Error)?.message || err);
    return null;
  }
  if (!template || !template.id) return null;
  const localizedName = languageCode === "en" ? (template.name?.en || template.name?.de) : (template.name?.de || template.name?.en);
  return {
    id: template.id,
    name: String(localizedName || "").trim(),
    nameEn: template.name?.en,
    category: template.category,
    rarity: template.rarity,
    storyRole: template.storyRole,
    visualKeywords: Array.isArray(template.visualKeywords) ? template.visualKeywords : [],
    emoji: template.emoji,
    imageUrl: template.imageUrl,
  };
}

/**
 * Genre-aware category preference for dev-mode artifact picks. Keeps the
 * selection biased toward graspable picture-book props rather than weapons or
 * battle gear.
 */
function pickDevModeArtifactCategory(config: StoryConfig): ArtifactCategory | undefined {
  const genre = String(config.genre || "").toLowerCase();
  if (/mystery|detective|krim/.test(genre)) return "tool";
  if (/learning|education|lern/.test(genre)) return "book";
  if (/nature|tier|animal|wald|forest/.test(genre)) return "nature";
  if (/friendship|freund/.test(genre)) return "jewelry";
  if (/fantasy|magic|magie|maerchen|m\u00e4rchen/.test(genre)) return "magic";
  if (/adventure|abenteuer|quest/.test(genre)) return "map";
  return undefined; // let matcher decide
}

/**
 * Two-step image generation for dev-mode stories:
 *   1) Support model produces ONE JSON with cover + per-reading-page English
 *      image prompts (avatar visuals + artifact visuals + scene cues).
 *   2) Parallel Runware calls via `ai.generateImage` (concurrency 3).
 *
 * Never throws \u2014 partial failure returns whichever images succeeded. The
 * caller treats this as best-effort: a story without images is still a valid
 * dev-mode result.
 */
// Picks the single most action/emotion-loaded sentence of a reading page so
// the image director can build the illustration around a concrete peak moment.
// Scores sentences by motion verbs, exclamation, dialogue and sensory cues;
// falls back to the longest sentence. German motion/emotion lexicon (the story
// prose is German; the director translates the beat into an English prompt).
function extractDramaticBeat(content: string): string {
  const text = String(content || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const sentences = text.match(/[^.!?…]+[.!?…]+["'“”»)\]]*/g) || [text];
  const MOTION = /\b(rann?te?|sprang|sprin[gt]|stürzt|sturzt|fiel|riss|zog|schoss|kletter|hüpft|huepft|packte|griff|schleuderte?|warf|drückte|druckte|stemmte|zerriss|flatter|wirbelt|schob|duckte|rutschte|kroch|klammerte|hielt fest|rannte)\w*/i;
  const EMOTION = /\b(schrie|rief|flüsterte|fluesterte|lachte|weinte|zitterte|keuchte|staunte|erschrak|jubelte|schluckte|starrte|strahlte)\w*/i;
  const SENSE = /\b(leuchtet|glänzt|glanzt|funkelt|schimmert|knistert|blitzt|strahlt|glüht|gluht|sprüht|spruht|wirbelt|stiebt)\w*/i;
  let best = sentences[0];
  let bestScore = -1;
  for (const raw of sentences) {
    const s = raw.trim();
    if (s.length < 12) continue;
    let score = 0;
    if (MOTION.test(s)) score += 3;
    if (EMOTION.test(s)) score += 2;
    if (SENSE.test(s)) score += 2;
    if (/[!?]/.test(s)) score += 1;
    if (/[„"»].+[""«]/.test(s)) score += 1; // spoken line
    score += Math.min(2, Math.floor(s.length / 90)); // richer sentences
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return compactExcerpt(best.trim(), 220);
}

async function generateDevModeImages(
  input: DevModeGenerationInput,
  parsedTitle: string,
  parsedChapters: Array<{ order: number; title: string; content: string }>,
  // v12 §13B: scene-card scope so the per-chapter prompt fallback can
  // restrict character names to actually-on-stage figures rather than the
  // full cast.
  screenplayPlan?: DevModeScreenplayPlan
): Promise<{
  coverImageUrl?: string;
  chapterImages: Map<number, { imageUrl?: string; prompt: string }>;
  imagesGenerated: number;
  promptTokenUsage: { prompt: number; completion: number; total: number };
}> {
  const chapterImages = new Map<number, { imageUrl?: string; prompt: string }>();
  const promptTokenUsage = { prompt: 0, completion: 0, total: 0 };

  // -----------------------------------------------------------------------
  // 1) Build the on-stage cast for the whole story (avatars + selected
  //    supporting characters). The supporting cast is filtered down to the
  //    names the idea lab actually picked, so we never put unrelated pool
  //    characters into the reference collage.
  // -----------------------------------------------------------------------
  const selectedSupportingNames = new Set(
    (input.selectedIdea?.selectedSupportingCast || []).map((n) => normalizePoolName(String(n)))
  );
  // Robustness net: the writer occasionally introduces a pool character that
  // was NOT in the locked cast (run 3db9b3b0: "Mia Neugier" appeared in every
  // chapter although the idea's locked cast was "Hexe Kräuterweis"). Such a
  // character would then have NO reference image and vanish from the filtered
  // chapter illustrations. So we also include any pool character whose name
  // actually appears in the final prose — they must get a reference anchor.
  const storyProseForCast = parsedChapters.map((ch) => ch.content || "").join(" ").toLowerCase();
  const appearsInProse = (name: string): boolean => {
    const trimmed = String(name || "").trim();
    if (!trimmed) return false;
    // Match the full name or its first token (e.g. "Mia" from "Mia Neugier").
    const firstToken = trimmed.split(/\s+/)[0];
    return (
      storyProseForCast.includes(trimmed.toLowerCase()) ||
      (firstToken.length >= 3 && storyProseForCast.includes(firstToken.toLowerCase()))
    );
  };
  const selectedPoolCharacters = (input.poolCharacters || []).filter((c) => {
    if (selectedSupportingNames.size === 0) return appearsInProse(c.name);
    return selectedSupportingNames.has(normalizePoolName(c.name)) || appearsInProse(c.name);
  });

  type CastEntry = { kind: "avatar" | "pool"; name: string; imageUrl?: string; description?: string };
  const safeVisualProfileDescription = (visualProfile: unknown, fallback?: string): string | undefined => {
    if (!visualProfile || typeof visualProfile !== "object") return fallback;
    const obj: any = visualProfile;
    const parts: string[] = [];
    const add = (value: unknown) => {
      const text = String(value || "").replace(/\s+/g, " ").trim();
      if (text && text !== "null" && text !== "undefined" && text !== "[object Object]") parts.push(text);
    };
    if (Array.isArray(obj.visualSignature)) obj.visualSignature.slice(0, 3).forEach(add);
    if (Array.isArray(obj.outfitLock)) obj.outfitLock.slice(0, 3).forEach(add);
    if (Array.isArray(obj.faceLock)) obj.faceLock.slice(0, 2).forEach(add);
    add(obj.description);
    add(obj.hair);
    add(obj.outfit);
    add(obj.clothingCanonical?.outfit);
    add(obj.clothingCanonical?.top);
    add(obj.clothingCanonical?.bottom);
    add(obj.distinctiveFeature || obj.distinctiveFeatures);
    const cleaned = parts
      .join(", ")
      .replace(/[{}\[\]"]/g, " ")
      .replace(/\b(?:null|undefined)\b/gi, " ")
      .replace(/\s+,/g, ",")
      .replace(/,\s*,/g, ",")
      .replace(/\s{2,}/g, " ")
      .trim();
    return cleaned || fallback;
  };
  const cast: CastEntry[] = [];
  for (const a of input.avatars || []) {
    cast.push({
      kind: "avatar",
      name: a.name,
      imageUrl: a.imageUrl,
      description: safeVisualProfileDescription(a.visualProfile, a.description),
    });
  }
  for (const c of selectedPoolCharacters) {
    cast.push({
      kind: "pool",
      name: c.name,
      imageUrl: c.imageUrl,
      description: c.physicalDescription || (c.personalityKeywords || []).slice(0, 4).join(", ") || c.archetype,
    });
  }

  // -----------------------------------------------------------------------
  // 2) Resolve every cast reference URL to a publicly-fetchable URL (proxy or
  //    signed). Bucket-internal URLs cannot be downloaded by sharp inside
  //    `buildSpriteCollage`, so this step is required \u2014 the standard pipeline
  //    does the same in `buildCollageReference`.
  //    Then build the sprite collage. Failure is non-fatal.
  // -----------------------------------------------------------------------
  const resolvedCast: Array<{ kind: "avatar" | "pool"; name: string; resolvedUrl: string }> = [];
  for (const entry of cast) {
    if (!entry.imageUrl) continue;
    try {
      const resolved = await resolveImageUrlForClient(entry.imageUrl);
      if (resolved) {
        resolvedCast.push({ kind: entry.kind, name: entry.name, resolvedUrl: resolved });
      }
    } catch (err) {
      console.warn(`[dev-mode-generation] Failed to resolve ref image for ${entry.name}:`, (err as Error)?.message || err);
    }
  }
  console.log(`[dev-mode-generation] Reference images resolved: ${resolvedCast.length} (avatars=${resolvedCast.filter(c => c.kind === "avatar").length}, pool=${resolvedCast.filter(c => c.kind === "pool").length})`);

  let collageUrl: string | undefined;
  let collagePositions: Array<{ index: number; name: string; colorName: string; colorHex: string; kind: "avatar" | "pool" }> = [];
  // Always build the sprite collage for 2+ cast refs — same approach as the
  // standard pipeline (single collage image, characters listed in a sprite
  // and referenced by slot in the prompt), instead of passing separate
  // individual reference images to Runware.
  if (resolvedCast.length >= 2) {
    try {
      const slots = resolvedCast.map((entry) => ({
        imageUrl: entry.resolvedUrl,
        displayName: entry.name,
      }));
      const collageResult = await buildSpriteCollage(slots);
      if (collageResult?.collageUrl) {
        collageUrl = collageResult.collageUrl;
        const kindByName = new Map(resolvedCast.map((c) => [c.name, c.kind]));
        collagePositions = collageResult.positions.map((pos) => ({
          index: pos.index,
          name: pos.displayName,
          colorName: pos.color.name,
          colorHex: pos.color.hex,
          kind: kindByName.get(pos.displayName) || "avatar",
        }));
        console.log(`[dev-mode-generation] Sprite collage built with ${collagePositions.length} slots, url=${collageUrl}`);
      } else {
        console.warn("[dev-mode-generation] buildSpriteCollage returned null \u2014 falling back to individual refs");
      }
    } catch (err) {
      console.warn("[dev-mode-generation] Sprite collage build failed:", (err as Error)?.message || err);
    }
  }

  // -----------------------------------------------------------------------
  // 3) Generate the prompts. When we have a collage, instruct the model to
  //    anchor each on-stage character to its slot \u2014 the same convention the
  //    standard pipeline uses (slot_1, slot_2, \u2026). Without a collage we fall
  //    back to plain descriptive prompts.
  // -----------------------------------------------------------------------
  const castDescriptors = cast
    .slice(0, 6)
    .map((entry) => {
      const desc = entry.description ? `: ${entry.description.slice(0, 400)}` : "";
      return `- ${entry.name} [${entry.kind}]${desc}`;
    })
    .join("\n") || "- (no canonical cast)";

  const collageBlock = collagePositions.length > 0
    ? [
        "REFERENCE COLLAGE (one image with framed slots, left-to-right):",
        ...collagePositions.map((pos) => `- slot_${pos.index + 1} = ${pos.name} (${pos.colorName} frame, ${pos.colorHex})`),
        "Use slots only as invisible identity anchors. Final prompts must name characters by NAME and visual description only; do NOT write slot_N, frame colors, borders, or technical reference markers into any prompt.",
      ].join("\n")
    : "(no reference collage \u2014 describe each character's appearance verbatim from the cast list above)";

  const artifact = shouldExposeDevModeArtifact(input) ? input.matchedArtifact : undefined;
  const artifactBlock = artifact
    ? `Supporting prop available: ${artifact.name}${artifact.emoji ? ` ${artifact.emoji}` : ""}; visual cues: ${(artifact.visualKeywords || []).slice(0, 6).join(", ") || "(none)"}. Include it briefly on reading pages where it is on-stage.`
    : "(no supporting prop)";

  const imageScenePlan = parsedChapters.map((chapter) => {
    const contentLower = chapter.content.toLowerCase();
    const onStageNames = cast
      .filter((entry) => contentLower.includes(entry.name.toLowerCase()))
      .map((entry) => entry.name);
    return {
      order: chapter.order,
      title: chapter.title,
      onStageNames,
      humanChildCount: onStageNames.filter((name) => (input.avatars || []).some((avatar) => avatar.name === name)).length,
      sceneSummary: compactExcerpt(chapter.content.replace(/\s+/g, " "), 520),
      // v13: hand the director the single most action-loaded sentence of the
      // page so it can build the illustration around a real peak moment
      // instead of a static average of the whole page.
      dramaticBeat: extractDramaticBeat(chapter.content),
      mustAvoid: [
        "no raw JSON",
        "no slot_N text",
        "no collage terminology",
        "no readable text or signs in the image",
        "no extra background human children",
        "no outfit transfer between characters",
      ],
    };
  });
  const imageScenePlanByOrder = new Map(imageScenePlan.map((scene) => [Number(scene.order), scene]));

  const englishVisualHint = (raw: unknown, fallback: string, maxChars = 180): string => {
    let out = String(raw || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    const replacements: Array<[RegExp, string]> = [
      [/\bsesselbezug\b/g, "armchair seam"],
      [/\bsessel\b/g, "armchair"],
      [/\bamulett\b/g, "amulet"],
      [/\bkette\b/g, "necklace"],
      [/\bwohnzimmer\b/g, "living room"],
      [/\bkuche\b/g, "kitchen"],
      [/\bflur\b/g, "hallway"],
      [/\bdachboden\b/g, "attic"],
      [/\bschrank\b/g, "wardrobe"],
      [/\bsofa\b/g, "sofa"],
      [/\bstuhl\b/g, "chair"],
      [/\btisch\b/g, "table"],
      [/\bstaub\b/g, "dust"],
      [/\bdraht\b/g, "wire"],
      [/\bleuchtet?\b/g, "glowing"],
      [/\bglanzt?\b/g, "shining"],
      [/\bversteckt\w*\b/g, "hidden"],
      [/\bverlor\w*\b/g, "lost"],
      [/\bsucht\w*\b/g, "searching"],
      [/\bflick\w*\b/g, "repairing"],
      [/\brepar\w*\b/g, "repairing"],
      [/\balte[nrs]?\b/g, "old"],
      [/\bwunderlich\w*\b/g, "wonder-filled"],
    ];
    for (const [pattern, replacement] of replacements) out = out.replace(pattern, replacement);
    out = out
      .replace(/\b(der|die|das|den|dem|des|ein|eine|einen|einem|und|oder|aber|mit|von|vom|im|in|am|an|auf|aus|zu|zum|zur|als|sich|sie|er|es|war|ist|waren|wird|nicht|nur|ganz|plot|seite|leseseite)\b/g, " ")
      .replace(/[^a-z0-9\s,.-]/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
    // German-residue guard: the tiny dictionary above only covers common
    // props. When the source text is full German prose, the survivors form a
    // word salad ("schrumpfte wilde wachsen weg ... flusterte zack") that
    // FLUX-family models render as garbled speech bubbles INSIDE the image
    // (log a27e9788 / Karren-PDF pages 2/3/5). A generic clean English line
    // beats pseudo-German every time.
    const germanResidue = /\b(wurde|blieb|seine?[mnrs]?|ihre?[mnrs]?|ihm|ihn|dann|noch|mehr|wenn|beim|nach|gegen|ueber|unter|wieder|dass|hatte|hatten|sagte|rief|jetzt|dort|hier|wachsen|schrumpfte?|fluester\w*|fluster\w*|zwitscher\w*|piepste?|murmelte?|kleine[rn]?|grosse[rn]?|wilde[rn]?)\b/;
    if (germanResidue.test(out)) {
      return compactExcerpt(fallback, maxChars);
    }
    return compactExcerpt(out || fallback, maxChars);
  };

  const systemPrompt = [
    "You are an award-winning picture-book illustration director (think of the liveliness of the best modern children's books).",
    "Every prompt you write must capture a single DRAMATIC PEAK MOMENT \u2014 a character mid-action, mid-gesture, mid-emotion \u2014 never a static line-up or a calm portrait.",
    "Output STRICT JSON only \u2014 no commentary, no markdown fences.",
  ].join(" ");
  const userPrompt = [
    `Story title: ${parsedTitle}`,
    `Genre: ${input.config.genre} / Setting: ${input.config.setting} / Age group: ${input.config.ageGroup}`,
    "",
    "ON-STAGE CAST (avatars + chosen supporting characters):",
    castDescriptors,
    "",
    collageBlock,
    "",
    artifactBlock,
    "",
    "IMAGE SCENE PLAN (use this, not raw prose snippets):",
    "Each page carries a `dramaticBeat` — the single most action/emotion-loaded moment of that page. BUILD the illustration around that beat: that is the frozen instant the picture must show.",
    promptJson(imageScenePlan),
    "",
    "TASK:",
    "Return JSON with this exact shape:",
    "{ \"cover\": \"<cover prompt>\", \"chapters\": [{\"order\": 1, \"prompt\": \"<prompt>\"}, ...] }",
    "- Cover: ONE iconic single-scene illustration prompt that captures the story's heart (the main heroes plus at least one supporting cast member if applicable).",
    "- Exactly one prompt per reading page, single scene, picture-book composition. The JSON key stays chapters for app compatibility.",
    "- ENGLISH ONLY. 40\u201380 words per prompt.",
    "",
    "LIVELINESS (this is what separates a flat AI image from a real picture book \u2014 every prompt MUST include):",
    "- PEAK MOMENT: pick the single most dramatic or emotional beat of that reading page and show the characters clearly in motion \u2014 running, reaching, pointing, ducking, hugging, leaning in. Never standing still and posing.",
    "- READABLE ANATOMY (critical): keep every pose natural and anatomically clean \u2014 two arms, two legs, two hands per child, all clearly visible and correctly attached. Prefer a strong CLEAR silhouette over an extreme acrobatic contortion. Do NOT twist torsos all the way around, do NOT cross many limbs, do NOT hide hands in a tangle. A calm, clearly readable action beats a dynamic but broken body.",
    "- EXPRESSION: name each character's clear facial emotion and body language (wide-eyed wonder, gritted-teeth effort, open-mouthed laugh, shrinking back in fear). Show the feeling, don't just place the body.",
    "- DYNAMIC CAMERA: choose a lively but simple angle that fits the beat \u2014 a gentle low hero angle, a slight high view, or a clear close-up on faces and hands. Avoid both the flat eye-level group shot AND wild foreshortening that distorts limbs.",
    "- MOTION & ATMOSPHERE: add 1-2 concrete moving details that bring the world alive (dust swirling, papers flying, hair and clothes blown, light streaming, sparks, splashes) and describe the light/mood (warm morning glow, tense blue shadows, magical shimmer).",
    "- COMPOSITION: depth comes from the ENVIRONMENT (a foreground prop, midground action, background scenery) \u2014 NEVER from stacking characters in front of each other.",
    "",
    "CHARACTER SEPARATION (HARD RULE \u2014 AI renderers blend features between overlapping figures):",
    "- Every character stands in their OWN clear space with visible air between all silhouettes. No character directly in front of, behind, or touching another (a hand on a shoulder is fine; bodies never overlap).",
    "- Winged, fairy, or non-human characters are placed to the SIDE or clearly ABOVE the children, never layered over them. Mention their wings/crown/tail only right next to THAT character's name, never in the same clause as a child's name.",
    "- The dramatic energy must come from each character's own pose and expression, not from crowding them together.",
    "",
    "- Refer to on-stage characters by NAME plus concrete visual specifics (hair, skin, clothing colors, outfit). NEVER include slot_N or collage wording in final prompts.",
    "- If the supporting prop is on-stage on a reading page, mention it briefly with its visual cues, ideally caught in the action.",
    "- Do NOT include readable text, captions, signs, labels, or written words in the imagery. Blank/unreadable paper is allowed only when the scene explicitly needs a note or letter.",
    "- Do NOT mention frame colors, borders, or technical reference markers in the prompt.",
    "- Do NOT mention TTS markers, brackets, or technical instructions.",
    "- Do NOT reference any named living artist or studio (forbidden: Axel Scheffler, Quentin Blake, Studio Ghibli, Pixar, Disney, etc.). Describe style with neutral terms only.",
    "- Composition constraint: state how many human children are on-stage in each scene; never imply extra background human children. Non-human animal families may appear only when the scene explicitly needs them. Each named avatar appears EXACTLY once per image.",
  ].join("\n");

  let parsedPrompts: { cover?: string; chapters?: Array<{ order?: number; prompt?: string }> } | null = null;
  try {
    const res = await callProvider(input.config, systemPrompt, userPrompt, {
      stage: "image-prompt-compiler",
      maxTokens: 6000,
      temperature: 0.7,
    });
    promptTokenUsage.prompt += res.usage.prompt;
    promptTokenUsage.completion += res.usage.completion;
    promptTokenUsage.total += res.usage.total;
    const raw = String(res.content || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
    parsedPrompts = JSON.parse(raw);
  } catch (err) {
    console.warn("[dev-mode-generation] Image prompt generation failed:", (err as Error)?.message || err);
    parsedPrompts = null;
  }

  // ---------------------------------------------------------------------
  // 3b) Heuristic: if the director call returned no parse, no cover, or one
  //     or more chapters are missing/too short/clearly not English, issue a
  //     per-reading-page mini-call so EVERY image gets a clean English picture-book
  //     prompt. This eliminates the "raw German story text used as image
  //     prompt" regression we saw in production.
  // ---------------------------------------------------------------------
  const looksLikeEnglishPrompt = (s: string): boolean => {
    const t = String(s || "").trim();
    if (t.length < 30) return false;
    if (/^\s*[\[{]/.test(t)) return false;
    if (/"error"\s*:|developer instruction requires|can't provide|cannot provide|requested json|plain single-paragraph prompt|no json/i.test(t)) {
      return false;
    }
    // Heuristic: English picture-book prompts overwhelmingly use ASCII Latin-1
    // and lack German diacritics. If we detect German-specific characters or
    // common German short words, treat as not-English and refill.
    if (/[\u00e4\u00f6\u00fc\u00df\u00c4\u00d6\u00dc]/.test(t)) return false;
    if (/\b(der|die|das|und|nicht|ist|war|sich|nach|sie|ihn|aber)\b/i.test(t)) return false;
    return true;
  };

  // Strip forbidden style references from any image prompt (whether produced
  // by the director, the refill, or the fallback). Pattern includes any "in
  // the style of …" / "X style" phrase and a curated denylist of named
  // illustrators/studios that Runware would otherwise mimic too closely.
  //
  // v11 §12A: also unwrap any leftover `{"prompt":"..."}` JSON envelope that
  // the director model may emit verbatim. Runware treats JSON as literal
  // tokens otherwise.
  const sanitizeImagePrompt = (s: string): string => {
    let out = String(s || "");
    const unwrapped = unwrapJsonPrompt(out);
    if (unwrapped.changed) {
      console.log("[dev-mode-generation] §12A unwrapped JSON envelope from image prompt", {
        reason: unwrapped.reason,
        before: out.slice(0, 120),
        after: unwrapped.prompt.slice(0, 120),
      });
      out = unwrapped.prompt;
    }
    const forbiddenNames = [
      "axel scheffler", "quentin blake", "studio ghibli", "ghibli", "pixar", "disney",
      "dreamworks", "tim burton", "miyazaki", "beatrix potter", "eric carle",
      "maurice sendak", "oliver jeffers", "chris van allsburg", "jon klassen",
    ];
    for (const name of forbiddenNames) {
      const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b[^,.]*`, "ig");
      out = out.replace(re, "");
    }
    // Generic "in the style of X" / "X style" stripping.
    out = out.replace(/,?\s*in the style of [^,.]+/ig, "");
    out = out.replace(/,?\s*[A-Z][a-z]+ [A-Z][a-z]+ (?:watercolor|illustration|storybook) style/g, "");
    out = out.replace(/\bslot_\d+\b/ig, "");
    out = out.replace(/\b(?:collage|reference frame|frame color|colored border|technical reference marker)s?\b/ig, "");
    // Cleanup leftover punctuation/space.
    out = out.replace(/\s+,/g, ",").replace(/,\s*,/g, ",").replace(/\s{2,}/g, " ").trim();
    return out;
  };

  const needsCoverRefill = !parsedPrompts?.cover || !looksLikeEnglishPrompt(String(parsedPrompts.cover));
  const missingChapters: Array<{ order: number; title: string; content: string }> = [];
  for (const ch of parsedChapters) {
    const found = (parsedPrompts?.chapters || []).find((c) => Number(c?.order) === ch.order);
    if (!found?.prompt || !looksLikeEnglishPrompt(String(found.prompt))) {
      missingChapters.push(ch);
    }
  }

  if (needsCoverRefill || missingChapters.length > 0) {
    console.log(`[dev-mode-generation] Image-prompts refill needed: cover=${needsCoverRefill}, readingPages=${missingChapters.map(c => c.order).join(",")}`);
    const refillSystem = "You are an image-prompt director for an English-language children's picture book. Output ONE single-paragraph English prompt of 40-80 words \u2014 NO JSON, NO markdown, NO commentary. Build the image around the page's most DRAMATIC peak moment: characters caught mid-action with clear facial expressions and dynamic poses, a lively camera angle, and motion details (flying dust/papers/hair, streaming light). Never a static line-up or calm portrait. HARD RULE: every character stands in their own clear space with visible air between silhouettes \u2014 bodies never overlap, and winged/fairy/non-human characters are placed to the side or clearly above the children, never layered over them; mention wings/crown/tail only right next to that character's own name. Depth comes from the environment, never from stacking characters. Picture-book composition, single scene, no readable text in image, no named living artist or studio (no Axel Scheffler, no Pixar, no Ghibli). State the on-stage human child count explicitly; no extra background human children.";
    const refillCommon = [
      `Story title: ${parsedTitle}`,
      `Genre: ${input.config.genre} / Setting: ${input.config.setting} / Age group: ${input.config.ageGroup}`,
      "",
      "ON-STAGE CAST:",
      castDescriptors,
      "",
      collageBlock,
      "",
      artifactBlock,
      "",
      "Refer to on-stage characters by NAME and concrete visual specifics. Do NOT mention slot_N, collage, frame colors, or borders.",
      "Do NOT include readable text, captions, signs, labels, or written words in the imagery. Blank/unreadable paper is allowed only when the scene explicitly needs a note or letter.",
      "Reply with the ENGLISH 40-80 word prompt ONLY \u2014 no preamble, no quotes.",
    ].join("\n");

    type RefillJob = { kind: "cover" | "chapter"; order?: number; instruction: string };
    const refillJobs: RefillJob[] = [];
    if (needsCoverRefill) {
      refillJobs.push({
        kind: "cover",
        instruction: `${refillCommon}\n\nTASK: Write the COVER illustration prompt \u2014 one iconic single-scene image capturing the story's heart, featuring the main heroes (and at least one supporting cast member if applicable).`,
      });
    }
    for (const ch of missingChapters) {
      refillJobs.push({
        kind: "chapter",
        order: ch.order,
        instruction: `${refillCommon}\n\nTASK: Write the picture-book prompt for reading page ${ch.order}. The page title is only an app label: \"${ch.title}\". Base the visual on this German reading-page content (translate the action into English imagery):\n\n${ch.content.slice(0, 1200)}`,
      });
    }

    const refillResults = await mapWithConcurrency(refillJobs, 3, async (job) => {
      try {
        const r = await callProvider(input.config, refillSystem, job.instruction, {
          stage: "image-prompt-compiler",
          maxTokens: 400,
          temperature: 0.7,
          openRouterResponseFormat: "text",
        });
        promptTokenUsage.prompt += r.usage.prompt;
        promptTokenUsage.completion += r.usage.completion;
        promptTokenUsage.total += r.usage.total;
        const text = String(r.content || "")
          .trim()
          .replace(/^```(?:json|text)?\s*/i, "")
          .replace(/```\s*$/i, "")
          .replace(/^["'\s]+|["'\s]+$/g, "");
        return { job, text };
      } catch (err) {
        console.warn(`[dev-mode-generation] Image-prompt refill failed for ${job.kind}${job.order ? ` ch${job.order}` : ""}:`, (err as Error)?.message || err);
        return { job, text: "" };
      }
    });

    if (!parsedPrompts) parsedPrompts = { chapters: [] };
    if (!parsedPrompts.chapters) parsedPrompts.chapters = [];
    for (const r of refillResults) {
      if (!r.text || !looksLikeEnglishPrompt(r.text)) continue;
      if (r.job.kind === "cover") {
        parsedPrompts.cover = r.text;
      } else if (r.job.kind === "chapter" && typeof r.job.order === "number") {
        const existing = parsedPrompts.chapters.find((c) => Number(c?.order) === r.job.order);
        if (existing) existing.prompt = r.text;
        else parsedPrompts.chapters.push({ order: r.job.order, prompt: r.text });
      }
    }
  }

  // Style suffix: deliberately NOT referencing any named living artist. Runware
  // ip-adapter handles identity via the collage reference, so we describe style
  // generically and append hard constraints against text, extra characters, and
  // duplicate avatars. These constraints are the most reliable in-prompt lever
  // against the visual-QA failures we observed (text/labels, ghost children,
  // duplicate avatars, identity drift).
  const styleSuffix = ", modern European watercolor picture-book illustration, warm expressive characters, soft ink outlines, cozy lighting, child-friendly, single cohesive scene, no readable text, no captions, no speech bubbles, no signs, no labels, no logos, blank unreadable paper only if required by the scene, no extra background human children, no duplicate characters, no adults unless required by the scene";

  // v11 §12D + v12 §13C/D: per-scene character manifest is appended to the
  // prompt so the diffusion model receives explicit "NO dress on boys"
  // constraints rather than relying on the negative prompt alone. The
  // manifest is added BEFORE the styleSuffix so it never gets truncated.
  //
  // v12 fixes three bugs from log-runware-single-image-3b8eedfe:
  //   1. JSON fragments: `entry.description` can be a stringified character
  //      profile ({"accessories":[],"ageApprox":"5 years old",…}). We now
  //      sanitize it to a plain prose 1-liner with `compactCharacterDescription()`.
  //   2. False wings permission: the old code emitted
  //      `Only ${entry.name} may wear wings or a fairy dress` for every
  //      non-avatar, granting Detektiv Schnüffel and Mia Neugier wings
  //      unconditionally. The new rule is: nobody wears wings/fairy dress
  //      unless the character is explicitly a fairy in this scene.
  //   3. The cover/fallback prompt formerly listed all cast names (4
  //      figures) — see the fallbackImagePrompt fix below.
  const compactCharacterDescription = (raw: string | undefined, fallback: string): string => {
    if (!raw) return fallback;
    const trimmed = String(raw).trim();
    // If the value already looks like JSON, parse and extract a few plain
    // fields. Otherwise treat it as prose and collapse whitespace.
    if (/^[\[{]/.test(trimmed)) {
      try {
        const obj = JSON.parse(trimmed);
        const parts: string[] = [];
        const visual = (obj?.visualSignature || obj?.outfitLock || obj?.faceLock || []) as unknown;
        if (Array.isArray(visual)) {
          parts.push(...visual.filter((v) => typeof v === "string").slice(0, 3) as string[]);
        }
        if (typeof obj?.description === "string") parts.push(obj.description);
        if (typeof obj?.outfit === "string") parts.push(obj.outfit);
        if (typeof obj?.hair === "string") parts.push(`hair: ${obj.hair}`);
        const joined = parts
          .filter(Boolean)
          .join(", ")
          .replace(/\s{2,}/g, " ")
          .replace(/[{}\[\]"]/g, "")
          .slice(0, 200)
          .trim();
        return joined || fallback;
      } catch {
        // Strip JSON-ish punctuation so a half-parsed string doesn't leak.
        return trimmed
          .replace(/[{}\[\]"]/g, " ")
          .replace(/\b\w+:\s*null\b/g, " ")
          .replace(/\s{2,}/g, " ")
          .trim()
          .slice(0, 200) || fallback;
      }
    }
    return trimmed.replace(/\s{2,}/g, " ").slice(0, 220);
  };

  const buildManifestBlock = (sceneNames: string[]): string => {
    if (sceneNames.length === 0) return "";
    const lines: string[] = [];
    const isFairyLike = (entry: CastEntry): boolean => /\b(fee|fairy|fluegel|flügel|wings?|zauberstab|flower crown|blumenkranz)\b/i.test(`${entry.name} ${entry.description || ""}`);
    for (const entry of cast) {
      if (!sceneNames.some((n) => n.toLowerCase().includes(entry.name.toLowerCase()) || entry.name.toLowerCase().includes(n.toLowerCase()))) continue;
      if (entry.kind === "avatar") {
        let visual = compactCharacterDescription(entry.description, "casual boy clothing");
        // German avatar descriptions ("ist sehr lieber junge, hat eine große
        // Zahnlücke") must not leak verbatim into the FLUX prompt — German
        // tokens both dilute the prompt and invite text rendering. Extract the
        // known VISUAL hints into English and drop the rest.
        if (/\b(und|der|die|das|ist|sehr|kann|hat|eine[mnr]?|junge|gro(?:ss|ß)e?)\b/i.test(visual)) {
          const englishHints: string[] = [];
          const visualHintMap: Array<[RegExp, string]> = [
            [/zahnl(?:ü|ue)cke/i, "big visible tooth gap in his smile"],
            [/blonde?[mnrs]?\s*haar\w*/i, "short blond hair"],
            [/braune?[mnrs]?\s*haar\w*/i, "short brown hair"],
            [/rote?[mnrs]?\s*haar\w*/i, "red hair"],
            [/lockig\w*/i, "curly hair"],
            [/brille/i, "round glasses"],
            [/sommersprossen/i, "freckles"],
            [/gr(?:ü|ue)ne?[mnrs]?\s*augen/i, "green eyes"],
            [/blaue?[mnrs]?\s*augen/i, "blue eyes"],
            [/braune?[mnrs]?\s*augen/i, "brown eyes"],
          ];
          for (const [pattern, english] of visualHintMap) {
            if (pattern.test(visual)) englishHints.push(english);
          }
          visual = englishHints.length > 0 ? englishHints.join(", ") : "casual boy clothing";
        }
        // IDENTITY LOCK: the reference image is the single source of truth for
        // recurring heroes. Without this line the model re-rolled hair color
        // per page whenever the avatar's text description carried no visual
        // details (Adrian: blond on page 2, brown on page 4 — log 0e8c0a4e).
        lines.push(`${entry.name}: human boy, ${visual}. IDENTITY: match ${entry.name}'s reference image exactly — same face, same hair color and hairstyle, same skin tone, same outfit colors as the reference, on every page. No dress, no skirt, no fairy wings, no flower crown, no pink fairy outfit.`);
      } else {
        const visual = compactCharacterDescription(entry.description, "supporting character");
        if (isFairyLike(entry)) {
          lines.push(`${entry.name}: fairy character, ${visual}. Keep wings, wand, flower crown, or fairy outfit only if they are part of this character's canonical look; do not transfer those features to human children.`);
        } else {
          // v12 §13D: NO character permission for wings unless the character
          // is explicitly a fairy in the story AND appears as a fairy in this
          // scene. The old "Only X may wear wings" template gave non-fairy
          // characters wings in every image.
          lines.push(`${entry.name}: ${visual}. No fairy wings, no fairy dress, no flower crown, unless explicitly required by this scene.`);
        }
      }
    }
    return lines.length > 0 ? ` CHARACTERS: ${lines.join(" ")}` : "";
  };

  // -----------------------------------------------------------------------
  // 4) Render via Runware. Prefer the resolved collage URL as the single
  //    reference image (same approach as standard pipeline). When the collage
  //    is unavailable (e.g. only one cast member with an image), fall back
  //    to passing that single character image directly so Runware still gets
  //    an identity reference.
  // -----------------------------------------------------------------------
  let referenceImages: string[] = [];
  let usingCollageReference = false;
  if (collageUrl) {
    try {
      const resolved = await resolveImageUrlForClient(collageUrl);
      if (resolved) {
        referenceImages = [resolved];
        usingCollageReference = true;
      }
    } catch (err) {
      console.warn("[dev-mode-generation] Failed to resolve collage URL, will fall back to individual refs:", (err as Error)?.message || err);
    }
  }
  if (referenceImages.length === 0 && resolvedCast.length > 0) {
    // Individual references mode: pass up to 4 already-resolved URLs (avatars first).
    const avatarsFirst = [
      ...resolvedCast.filter((c) => c.kind === "avatar"),
      ...resolvedCast.filter((c) => c.kind === "pool"),
    ];
    referenceImages = avatarsFirst.slice(0, 4).map((c) => c.resolvedUrl);
  }
  // Identity-priority weights: recurring storybook characters need the
  // reference to win over prompt creativity. 0.68-0.74 allowed visible hair
  // color drift across pages (Adrian blond on page 2, brown on page 4).
  const ipAdapterWeight = referenceImages.length > 0
    ? (usingCollageReference
        ? (collagePositions.length >= 3 ? 0.74 : 0.72)
        : (referenceImages.length >= 3 ? 0.75 : referenceImages.length === 2 ? 0.78 : 0.74))
    : undefined;
  console.log(`[dev-mode-generation] Runware reference set: count=${referenceImages.length}, collage=${usingCollageReference}, ipAdapterWeight=${ipAdapterWeight}`);

  // ONE deterministic seed per story: all 6 images share seed + style + refs,
  // which keeps face/hair/outfit rendering far more stable than per-image
  // random seeds (log 0e8c0a4e: 6 images, 6 random seeds, Adrian's hair
  // flipped blond/brown between pages). Scene variety still comes from the
  // per-page prompts.
  const storyImageSeed = (hashString(String(input.storyId || parsedTitle)) % 2_000_000_000) + 1;
  console.log(`[dev-mode-generation] Story image seed: ${storyImageSeed}`);

  type Job = { kind: "cover" | "chapter"; order?: number; prompt: string };
  const jobs: Job[] = [];
  // v12 §13B/E: fallback prompts must NOT list the entire cast pauschal.
  // The previous build inserted "Adrian, Alexander, Detektiv Schnüffel, Mia
  // Neugier" into every chapter image — even chapters where only Adrian +
  // Alexander appear. We now derive per-chapter names from the scene card /
  // scene plan so the diffusion model is not asked to render 4 characters in
  // a kitchen/hallway scene that only contains 2.
  const sceneCharsByChapter = new Map<number, string[]>();
  for (const card of (screenplayPlan?.sceneCards as any[] | undefined) || []) {
    const order = Number((card && (card.order ?? card.chapter)) ?? NaN);
    if (!Number.isFinite(order)) continue;
    const names = Array.isArray(card?.onStage) && card.onStage.length > 0
      ? card.onStage
      : Array.isArray(card?.onStageCharacters) && card.onStageCharacters.length > 0
        ? card.onStageCharacters
        : (cast.filter((c) => c.kind === "avatar").map((c) => c.name));
    sceneCharsByChapter.set(
      order,
      names
        .map((n: any) => String(n || "").trim())
        .filter((n: string): n is string => Boolean(n))
        .slice(0, 3) // never more than 3 characters in one picture-book scene
    );
  }
  const avatarNamesOnly = cast.filter((c) => c.kind === "avatar").map((c) => c.name);
  const fallbackImagePrompt = (job: { kind: "cover" | "chapter"; order?: number }): string => {
    const storyAnchor = englishVisualHint(
      input.selectedIdea?.centralObjectOrPlace || input.matchedArtifact?.name || input.selectedIdea?.wonderRule,
      "the story's central object",
      120
    );
    const settingHint = englishVisualHint(input.config.setting || input.config.genre, "cozy story setting", 80);
    if (job.kind === "cover") {
      // Cover can show the full hero set, but capped at 3 to avoid clutter.
      const coverNames = (avatarNamesOnly.length > 0 ? avatarNamesOnly : cast.map((e) => e.name))
        .slice(0, 3)
        .join(", ") || "the heroes";
      return `Single picture-book cover scene with ${coverNames}, centered on ${storyAnchor} in ${settingHint}. Show one specific magical problem, warm child-friendly tension, exactly the named characters, no text.`;
    }
    const sceneNames = (job.order ? sceneCharsByChapter.get(job.order) : undefined) || avatarNamesOnly;
    const chapterNames = sceneNames.slice(0, 3).join(", ") || "the heroes";
    const scenePlan = typeof job.order === "number" ? imageScenePlanByOrder.get(job.order) : undefined;
    // Prefer the extracted dramatic beat over the flat page summary so even
    // the deterministic fallback prompt shows a lively peak moment.
    const actionHint = englishVisualHint(
      (scenePlan as any)?.dramaticBeat || scenePlan?.sceneSummary,
      `a concrete action around ${storyAnchor}`,
      180
    );
    const childCount = sceneNames.filter((name) => avatarNamesOnly.includes(name)).length;
    const countHint = childCount > 0
      ? `exactly ${childCount} named human child${childCount === 1 ? "" : "ren"}`
      : "only the named on-stage characters";
    return `Lively picture-book illustration: ${chapterNames} caught mid-action at the story's peak moment, ${countHint}, with clear facial expressions and dynamic body poses. Every character in their own clear space, bodies never overlapping. Action focus: ${actionHint}. Visual anchor: ${storyAnchor}. ${settingHint} surroundings with environmental depth, motion, and warm dramatic light. Single cohesive moment, no text.`;
  };
  const coverPrompt = String(parsedPrompts?.cover || "").trim();
  jobs.push({ kind: "cover", prompt: looksLikeEnglishPrompt(coverPrompt) ? coverPrompt : fallbackImagePrompt({ kind: "cover" }) });
  for (const ch of parsedChapters) {
    const found = (parsedPrompts?.chapters || []).find((c) => Number(c?.order) === ch.order);
    let promptText = String(found?.prompt || "").trim();
    if (!promptText || !looksLikeEnglishPrompt(promptText)) {
      // Last-resort: ship a SHORT generic English scene description rather
      // than raw German story text (which Runware cannot render well).
      promptText = fallbackImagePrompt({ kind: "chapter", order: ch.order });
    }
    jobs.push({ kind: "chapter", order: ch.order, prompt: promptText });
  }

  // v11 §12B: build a per-scene name list so reference filtering can drop
  // characters that are not actually on stage. Names are matched
  // case-insensitively against the reading-page prompt body.
  const allCastNames = cast.map((c) => c.name);

  // v13 §12I: winged/fairy/creature POOL references visibly bleed onto the
  // child avatars when the renderer blends multiple ip-adapter references at
  // 4 steps / CFG 4 (run e09199a3: Adrian rendered with Rosalie's wings).
  // Whenever an avatar reference is in the same reference set, drop the
  // winged pool reference — the prompt still carries that character's
  // canonical look as text, and the children's identity anchors stay clean.
  const wingedPoolRefUrls = new Set(
    resolvedCast
      .filter((entry) => {
        if (entry.kind !== "pool") return false;
        const description = cast.find((c) => c.name === entry.name)?.description || "";
        return /fee\b|fairy|elfe|drache|dragon|fl(?:ü|ue)gel|wing/i.test(`${entry.name} ${description}`);
      })
      .map((entry) => entry.resolvedUrl)
  );
  const onStageForJob = (job: { kind: "cover" | "chapter"; order?: number; prompt: string }): string[] => {
    if (job.kind === "cover") return allCastNames; // cover may show everyone
    const lower = job.prompt.toLowerCase();
    return allCastNames.filter((name) => lower.includes(name.toLowerCase()));
  };

  let imageResults = await mapWithConcurrency(jobs, 3, async (job) => {
    try {
      // Local image-prompt sanitizer: strip any named living artist/studio the
      // model still slipped in, plus any "in the style of X" pattern, and
      // unwrap any leftover JSON envelope. Deterministic guardrails.
      let sanitizedPrompt = sanitizeImagePrompt(job.prompt);
      if (!looksLikeEnglishPrompt(sanitizedPrompt)) {
        console.warn("[dev-mode-generation] image prompt rejected after sanitizer; using deterministic fallback", {
          job: `${job.kind}${job.order ? `:ch${job.order}` : ""}`,
          rejectedPreview: sanitizedPrompt.slice(0, 120),
        });
        sanitizedPrompt = fallbackImagePrompt(job);
      }

      // v11 §12B: filter individual references to characters actually in the
      // scene. When using a collage but the scene only contains a subset of
      // the cast, fall back to per-character refs of just those on-stage
      // characters so an off-stage character's outfit cannot leak in.
      // Avatars are ALWAYS kept even when prompt-name matching misses them:
      // they are the recurring heroes, and a stable avatar anchor on every
      // page is the whole point of reference images.
      const sceneNames = onStageForJob({ ...job, prompt: sanitizedPrompt });
      let sceneRefs = referenceImages;
      let sceneIpWeight = ipAdapterWeight;
      if (usingCollageReference && resolvedCast.length >= 2 && sceneNames.length > 0 && sceneNames.length < resolvedCast.length) {
        const filtered = filterReferencesForScene({
          onStageNames: sceneNames,
          availableRefs: resolvedCast.map((c) => ({ name: c.name, imageUrl: c.resolvedUrl, kind: c.kind })),
        });
        const keptNames = new Set(filtered.references.map((r) => r.name));
        const withAvatars = [
          ...filtered.references,
          ...resolvedCast
            .filter((c) => c.kind === "avatar" && !keptNames.has(c.name))
            .map((c) => ({ name: c.name, imageUrl: c.resolvedUrl, kind: c.kind })),
        ];
        if (filtered.dropped.length > 0 && withAvatars.length > 0) {
          sceneRefs = withAvatars.slice(0, 4).map((r) => r.imageUrl);
          sceneIpWeight = sceneRefs.length >= 3 ? 0.75 : sceneRefs.length === 2 ? 0.78 : 0.74;
          console.log(`[dev-mode-generation] §12B per-scene ref filter`, {
            job: `${job.kind}${job.order ? `:ch${job.order}` : ""}`,
            kept: withAvatars.map((r) => r.name),
            dropped: filtered.dropped.filter((name) => !withAvatars.some((r) => r.name === name)),
          });
        }
      }

      // v13 §12I: strip winged/creature pool refs whenever a child avatar ref
      // is in the same set (identity priority: the heroes must never inherit
      // wings/crowns from a blended reference).
      if (wingedPoolRefUrls.size > 0 && sceneRefs.length > 1) {
        const hasAvatarRef = sceneRefs.some((url) =>
          resolvedCast.some((c) => c.kind === "avatar" && c.resolvedUrl === url)
        );
        const cleanedRefs = hasAvatarRef
          ? sceneRefs.filter((url) => !wingedPoolRefUrls.has(url))
          : sceneRefs;
        if (cleanedRefs.length > 0 && cleanedRefs.length < sceneRefs.length) {
          console.log("[dev-mode-generation] §12I winged pool ref dropped (avatar identity priority)", {
            job: `${job.kind}${job.order ? `:ch${job.order}` : ""}`,
            before: sceneRefs.length,
            after: cleanedRefs.length,
          });
          sceneRefs = cleanedRefs;
          sceneIpWeight = cleanedRefs.length >= 3 ? 0.75 : cleanedRefs.length === 2 ? 0.78 : 0.74;
        }
      }

      // v11 §12F: merge canonical negative-prompt pack (no dress on boys,
      // no wings, no flower crown, no outfit swap, no text, etc.).
      const negativePrompt = mergeNegativePrompt(undefined);

      // v11 §12D: append character manifest with explicit attribute locks.
      const manifestBlock = buildManifestBlock(sceneNames.length > 0 ? sceneNames : allCastNames);
      const fullPrompt = `${sanitizedPrompt}${manifestBlock}${styleSuffix}`;

      // v11 §12 preflight: assert prompt is well-formed before sending.
      const preflight = preflightImagePrompt({
        positivePrompt: fullPrompt,
        references: sceneRefs.map((_, i) => ({ name: `slot_${i + 1}` })),
        onStageNames: sceneNames.length > 0 ? sceneNames : allCastNames,
      });
      if (!preflight.ok && preflight.issues.some((i) => i.code === "json_wrapper")) {
        // Hard issue — refuse to ship a JSON-wrapped prompt to Runware. This
        // is the bug from log 88ec895c.
        console.warn(`[dev-mode-generation] §12 preflight FAILED, dropping image job`, {
          job: `${job.kind}${job.order ? `:ch${job.order}` : ""}`,
          issues: preflight.issues,
        });
        return { job, imageUrl: undefined as string | undefined, fullPrompt, sceneRefs: [] as string[], sceneIpWeight: undefined as number | undefined };
      }

      const img = await ai.generateImage({
        prompt: fullPrompt,
        negativePrompt,
        width: 1024,
        height: 1024,
        steps: 4,
        CFGScale: 4,
        outputFormat: "JPEG",
        referenceImages: sceneRefs.length > 0 ? sceneRefs : undefined,
        ipAdapterWeight: sceneIpWeight,
        seed: storyImageSeed,
      });
      return { job, imageUrl: img.imageUrl as string | undefined, fullPrompt, sceneRefs, sceneIpWeight };
    } catch (err) {
      console.warn(`[dev-mode-generation] Image generation failed for ${job.kind}${job.order ? ` ch${job.order}` : ""}:`, (err as Error)?.message || err);
      return { job, imageUrl: undefined as string | undefined, fullPrompt: job.prompt, sceneRefs: [] as string[], sceneIpWeight: undefined as number | undefined };
    }
  });

  const missingImageJobs = imageResults
    .filter((result) => !result.imageUrl)
    .map((result) => result.job);
  if (missingImageJobs.length > 0) {
    console.warn("[dev-mode-generation] Retrying missing image jobs with deterministic no-reference fallback prompts", {
      missing: missingImageJobs.map((job) => `${job.kind}${job.order ? `:${job.order}` : ""}`),
    });
    const retryResults = await mapWithConcurrency(missingImageJobs, 2, async (job) => {
      const retryPrompt = `${sanitizeImagePrompt(fallbackImagePrompt(job))}${styleSuffix}`;
      try {
        const img = await ai.generateImage({
          prompt: retryPrompt,
          negativePrompt: mergeNegativePrompt(undefined),
          width: 1024,
          height: 1024,
          steps: 4,
          CFGScale: 4,
          outputFormat: "JPEG",
          // Keep the avatar identity anchor + story seed even on the
          // no-frills retry, otherwise the retried page is the one page
          // where the heroes look different.
          referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
          ipAdapterWeight,
          seed: storyImageSeed + 1,
        });
        return { job, imageUrl: img.imageUrl as string | undefined, fullPrompt: retryPrompt, sceneRefs: referenceImages, sceneIpWeight: ipAdapterWeight };
      } catch (err) {
        console.warn(`[dev-mode-generation] Image retry failed for ${job.kind}${job.order ? ` ch${job.order}` : ""}:`, (err as Error)?.message || err);
        return { job, imageUrl: undefined as string | undefined, fullPrompt: retryPrompt, sceneRefs: [] as string[], sceneIpWeight: undefined as number | undefined };
      }
    });
    const keyForJob = (job: Job) => `${job.kind}:${job.order ?? "cover"}`;
    const retryByJob = new Map(retryResults.map((result) => [keyForJob(result.job), result]));
    imageResults = imageResults.map((result) => result.imageUrl ? result : (retryByJob.get(keyForJob(result.job)) || result));
  }

  let coverImageUrl: string | undefined;
  let imagesGenerated = 0;
  for (const r of imageResults) {
    if (r.imageUrl) imagesGenerated += 1;
    if (r.job.kind === "cover") {
      coverImageUrl = r.imageUrl;
    } else if (r.job.kind === "chapter" && typeof r.job.order === "number") {
      chapterImages.set(r.job.order, { imageUrl: r.imageUrl, prompt: r.fullPrompt });
    }
  }

  // v11 §12H: Visual QA pass. Opt-in via env DEV_MODE_VISUAL_QA_ENABLED
  // (costs ~1 extra Gemini Flash call per image + optional 1 regen).
  // Reports are persisted to the success log so we can observe the
  // ground-truth Identity/Character-Count failure rate over time.
  const visualQaEnabled = process.env.DEV_MODE_VISUAL_QA_ENABLED === "1";
  const qaReports: Array<{ kind: "cover" | "chapter"; order?: number; report: VisualQaReport; regenerate: boolean; reasons: string[] }> = [];
  if (visualQaEnabled && imagesGenerated > 0) {
    const boyNames = (input.avatars || []).map((a) => a.name).filter(Boolean);
    const fairyNames = selectedPoolCharacters
      .filter((c) => /fee|fairy/i.test(c.name) || /fee|fairy/i.test(c.archetype || ""))
      .map((c) => c.name);

    const qaJobs = imageResults
      .filter((r) => Boolean(r.imageUrl))
      .map((r) => ({ result: r }));

    const qaModel = DEV_MODE_SUPPORT_MODEL; // Gemini Flash supports vision
    const qaSeen = await mapWithConcurrency(qaJobs, 2, async ({ result: r }) => {
      try {
        const qaPrompt = buildVisualQaPrompt({
          imageUrl: r.imageUrl!,
          expectedBoyNames: boyNames,
          expectedFairyNames: fairyNames,
          scenePrompt: r.fullPrompt,
        });
        const qaRes = await callOpenRouterChatCompletion({
          messages: [
            { role: "system", content: "You are a strict picture-book illustration QA assistant. Output STRICT JSON only." },
            { role: "user", content: qaPrompt },
          ],
          model: qaModel,
          responseFormat: "json_object",
          imageInputs: [r.imageUrl!],
          temperature: 0,
          maxTokens: 600,
        });
        const qaUsage = qaRes.data?.usage || {};
        promptTokenUsage.prompt += Number(qaUsage.prompt_tokens || 0);
        promptTokenUsage.completion += Number(qaUsage.completion_tokens || 0);
        promptTokenUsage.total += Number(qaUsage.total_tokens || 0);
        const qaContent = qaRes.data?.choices?.[0]?.message?.content || "";
        const report = parseVisualQaReport(String(qaContent));
        const { regenerate, reasons } = shouldRegenerateImage(report);
        return { result: r, report, regenerate, reasons };
      } catch (err) {
        console.warn(`[dev-mode-generation] §12H visual-QA call failed`, {
          job: `${r.job.kind}${r.job.order ? `:ch${r.job.order}` : ""}`,
          error: err instanceof Error ? err.message : String(err),
        });
        return null;
      }
    });

    for (const entry of qaSeen) {
      if (!entry) continue;
      qaReports.push({
        kind: entry.result.job.kind,
        order: entry.result.job.order,
        report: entry.report,
        regenerate: entry.regenerate,
        reasons: entry.reasons,
      });
      if (entry.regenerate) {
        console.warn(`[dev-mode-generation] §12H visual-QA flagged image for regen`, {
          job: `${entry.result.job.kind}${entry.result.job.order ? `:ch${entry.result.job.order}` : ""}`,
          reasons: entry.reasons,
        });
      }
    }

    // §12H-regen: actually regenerate flagged images. The previous build only
    // logged the flag, so identity failures (wrong hair color, duplicate
    // children) shipped to the child anyway. Capped at 2 regens per story;
    // same prompt + same refs + bumped ip-adapter weight + offset seed.
    const flaggedForRegen = qaSeen
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry && entry.regenerate && entry.result.imageUrl))
      .slice(0, 2);
    for (const entry of flaggedForRegen) {
      const r = entry.result;
      try {
        const regenWeight = r.sceneRefs.length > 0
          ? Math.min(0.85, (r.sceneIpWeight ?? 0.74) + 0.06)
          : undefined;
        const regen = await ai.generateImage({
          prompt: r.fullPrompt,
          negativePrompt: mergeNegativePrompt(undefined),
          width: 1024,
          height: 1024,
          steps: 4,
          CFGScale: 4,
          outputFormat: "JPEG",
          referenceImages: r.sceneRefs.length > 0 ? r.sceneRefs : undefined,
          ipAdapterWeight: regenWeight,
          seed: storyImageSeed + 101,
        });
        if (regen.imageUrl) {
          if (r.job.kind === "cover") {
            coverImageUrl = regen.imageUrl;
          } else if (typeof r.job.order === "number") {
            chapterImages.set(r.job.order, { imageUrl: regen.imageUrl, prompt: r.fullPrompt });
          }
          console.log(`[dev-mode-generation] §12H visual-QA regen applied`, {
            job: `${r.job.kind}${r.job.order ? `:ch${r.job.order}` : ""}`,
            reasons: entry.reasons,
            regenWeight,
          });
        }
      } catch (err) {
        console.warn(`[dev-mode-generation] §12H visual-QA regen failed; keeping original image`, {
          job: `${r.job.kind}${r.job.order ? `:ch${r.job.order}` : ""}`,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Persist QA reports on the cover slot for now (no schema field per
    // chapter); downstream caller can pull them from the response log.
    (chapterImages as any).__qaReports = qaReports;
  }

  return { coverImageUrl, chapterImages, imagesGenerated, promptTokenUsage };
}

function countIdeaCandidates(config: StoryConfig): number {
  // Keep each idea-lab response parseable. The previous 8/10-candidate
  // payload regularly exceeded the support model's completion budget, so the
  // JSON was cut mid-string and the pipeline fell back to deterministic ideas.
  // Multiple rounds still provide variety, but every single round must finish.
  if (config.length === "long") return 6;
  if (config.length === "medium") return 5;
  return 4;
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

function normalizePotentialScores(raw: any): Partial<CandidatePotentialScores> {
  const source = raw && typeof raw === "object" ? raw : {};
  const read = (key: keyof CandidatePotentialScores): number | undefined => {
    const value = Number(source[key]);
    return Number.isFinite(value) ? clampNumber(value, 0, 10) : undefined;
  };
  const result: Partial<CandidatePotentialScores> = {};
  for (const key of [
    "childRetellableHook",
    "visualShelfAppeal",
    "novelty",
    "emotionalEngine",
    "personalCostPotential",
    "irreversibleMiddlePotential",
    "conflictEscalationPotential",
    "finalImagePotential",
    "helperDependencyRisk",
    "similarityToRecentEmotionalMechanics",
  ] as Array<keyof CandidatePotentialScores>) {
    const value = read(key);
    if (typeof value === "number") result[key] = Math.round(value * 10) / 10;
  }
  return result;
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
      const premiseSeedId = compactExcerpt(String(candidate?.premiseSeedId || candidate?.seedId || "").trim(), 80);
      const premiseSeedMutation = compactExcerpt(String(candidate?.premiseSeedMutation || candidate?.seedMutation || "").trim(), 220);
      if (!title || !oneLineHook || !centralObjectOrPlace || !wonderRule || !coreConflict) return null;
      return {
        id: String(candidate?.id || `idea_${index + 1}`),
        ...(premiseSeedId ? { premiseSeedId } : {}),
        ...(premiseSeedMutation ? { premiseSeedMutation } : {}),
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
        potentialScores: normalizePotentialScores(candidate?.potentialScores || candidate?.scores || candidate),
      };
    })
    .filter((candidate: DevModeIdeaCandidate | null): candidate is DevModeIdeaCandidate => Boolean(candidate));
}

/**
 * v11 §4: deterministic 9.0-potential gate. Scores a candidate idea on the
 * structural features that correlate with high-quality picture books:
 *   - emotional engine (warm or socially meaningful conflict)
 *   - novelty (no near-duplicate in recent stories)
 *   - irreversible middle potential (clear path to a costly mistake)
 *   - personal object potential (named tool/keepsake the hero can give up)
 *   - helper dependency risk (penalised if helpers carry the plot)
 *
 * Returns the audit so the orchestrator can pick a different candidate when
 * the selected one is structurally under 9.0.
 */
export interface Candidate9Audit extends Partial<CandidatePotentialScores> {
  emotionalEngine: number;
  novelty: number;
  irreversibleMiddlePotential: number;
  helperDependencyRisk: number;
  personalObjectPotential?: number;
  reject: boolean;
  rejectReason?: string;
  rejectReasons?: string[];
}

const PERSONAL_OBJECT_HINTS = [
  "löffel", "loeffel", "kette", "amulett", "ring", "feder", "stein", "muschel",
  "schlüssel", "schluessel", "buch", "kompass", "spielzeug", "puppe", "knopf",
  "münze", "muenze", "uhr", "linse", "spiegel",
];

const HELPER_RESCUE_HINTS = [
  /helfer rettet/i,
  /\b(rosalie|fee|trolly?|magier|hexe|elf|sternenschweif)\b.{0,40}\b(erkl|zeig|hilft|fix|rettet|löst|loest)\b/i,
];

export function auditCandidate9Potential(
  candidate: DevModeIdeaCandidate,
  recentOverlap: number,
): Candidate9Audit {
  const text = [
    candidate.title,
    candidate.oneLineHook,
    candidate.centralObjectOrPlace,
    candidate.wonderRule,
    candidate.emotionalEngine,
    candidate.coreConflict,
  ].filter(Boolean).join(" ").toLowerCase();

  // emotional engine — does it speak about a child-relatable feeling
  let emotional = 7.5;
  if (/empath|trau|angst|fehl|mut|scheu|allein|stolz|schämen|schamen|verant/.test(text)) emotional += 1.0;
  if (/lernt|merkt|erkennt|spürt|spuert/.test(text)) emotional += 0.5;
  if (text.length > 120) emotional += 0.2;
  emotional = Math.min(10, emotional);

  // novelty — based on recent-overlap audit
  const novelty = Math.max(0, 10 - recentOverlap * 14);

  // irreversible middle potential — explicit cost word in candidate body
  let irreversible = 7.5;
  if (/(opfer|verlier|verzicht|nicht zurück|nicht zurueck|zerbroch|schrumpf|fest|verloren)/.test(text)) irreversible += 1.2;
  if (/regel|magie|verwandl/.test(text)) irreversible += 0.4;
  irreversible = Math.min(10, irreversible);

  // personal object — named keepsake
  const hasObject = PERSONAL_OBJECT_HINTS.some((h) => text.includes(h));
  const personalObject = hasObject ? 8.5 : 7.0;

  // helper dependency risk — high if helper does the rescue
  let helperRisk = 4.0;
  if (HELPER_RESCUE_HINTS.some((re) => re.test(text))) helperRisk += 2.5;
  if (/fee\s+\w+/.test(text)) helperRisk += 0.5;
  helperRisk = Math.min(10, helperRisk);

  // Reject thresholds (spec §4)
  let reject = false;
  let rejectReason: string | undefined;
  if (emotional < 8.5) { reject = true; rejectReason = `emotionalEngine ${emotional.toFixed(1)} < 8.5`; }
  else if (novelty < 8.7) { reject = true; rejectReason = `novelty ${novelty.toFixed(1)} < 8.7`; }
  else if (irreversible < 8.5) { reject = true; rejectReason = `irreversibleMiddlePotential ${irreversible.toFixed(1)} < 8.5`; }
  else if (personalObject < 8.0) { reject = true; rejectReason = `personalObjectPotential ${personalObject.toFixed(1)} < 8.0`; }
  else if (helperRisk > 6.5) { reject = true; rejectReason = `helperDependencyRisk ${helperRisk.toFixed(1)} > 6.5`; }

  return {
    emotionalEngine: Math.round(emotional * 10) / 10,
    novelty: Math.round(novelty * 10) / 10,
    irreversibleMiddlePotential: Math.round(irreversible * 10) / 10,
    personalObjectPotential: Math.round(personalObject * 10) / 10,
    helperDependencyRisk: Math.round(helperRisk * 10) / 10,
    reject,
    rejectReason,
  };
}

/**
 * v12 §B/§C: returns the list of potential-gate failures for the active
 * quality mode. Empty array = candidate passes the gate.
 *
 * Thin wrapper over the shared implementation in
 * `backend/story/pipeline/potential-thresholds.ts` so tests can import the
 * gate logic without the Encore runtime.
 */
export function potentialGateFailures(
  scores: Partial<CandidatePotentialScores>,
  mode?: DevModeQualityMode,
): string[] {
  return potentialGateFailuresShared(scores, mode);
}

function buildFullPotentialAudit(
  candidate: DevModeIdeaCandidate,
  input: DevModeGenerationInput,
  modelScores?: Partial<CandidatePotentialScores>,
  modelRejectReasons: string[] = []
): Candidate9Audit {
  const noveltyAudit = auditIdeaCandidateNovelty(candidate, input);
  const legacy = auditCandidate9Potential(candidate, noveltyAudit.closestRecentOverlap);
  const c = candidate.potentialScores || {};
  const text = [
    candidate.title,
    candidate.oneLineHook,
    candidate.centralObjectOrPlace,
    candidate.wonderRule,
    candidate.emotionalEngine,
    candidate.coreConflict,
  ].join(" ").toLowerCase();
  const hasPersonalObject = PERSONAL_OBJECT_HINTS.some((hint) => text.includes(hint));
  const fallbackScores: CandidatePotentialScores = {
    childRetellableHook: Math.max(7.5, legacy.childRetellableHook ?? (candidate.oneLineHook.length > 70 ? 8.6 : 8.1)),
    visualShelfAppeal: Math.max(7.5, legacy.visualShelfAppeal ?? (hasPersonalObject ? 8.6 : 8.0)),
    novelty: Math.min(legacy.novelty, noveltyAudit.recommendation === "reject" ? 7.0 : 10),
    emotionalEngine: legacy.emotionalEngine,
    personalCostPotential: Math.max(legacy.personalCostPotential ?? legacy.personalObjectPotential ?? 0, hasPersonalObject ? 8.2 : 7.2),
    irreversibleMiddlePotential: legacy.irreversibleMiddlePotential,
    conflictEscalationPotential: Math.max(7.5, legacy.conflictEscalationPotential ?? (/(scheit|falsch|folge|sonst|bis|problem)/.test(text) ? 8.6 : 7.8)),
    finalImagePotential: Math.max(7.7, legacy.finalImagePotential ?? (hasPersonalObject ? 8.6 : 8.0)),
    helperDependencyRisk: legacy.helperDependencyRisk,
    similarityToRecentEmotionalMechanics: noveltyAudit.recommendation === "reject"
      ? 8.5
      : Math.max(legacy.similarityToRecentEmotionalMechanics ?? 0, noveltyAudit.closestRecentOverlap * 10),
  };
  const merged: CandidatePotentialScores = { ...fallbackScores };
  for (const key of Object.keys(merged) as Array<keyof CandidatePotentialScores>) {
    const provided = modelScores?.[key] ?? c[key];
    if (typeof provided !== "number" || !Number.isFinite(provided)) continue;
    if (key === "helperDependencyRisk" || key === "similarityToRecentEmotionalMechanics") {
      merged[key] = Math.round(Math.max(fallbackScores[key], clampNumber(provided, 0, 10)) * 10) / 10;
    } else {
      merged[key] = Math.round(Math.min(clampNumber(provided, 0, 10), fallbackScores[key] + 1.0) * 10) / 10;
    }
  }
  if (noveltyAudit.recommendation === "reject") {
    merged.novelty = Math.min(merged.novelty, 7.0);
    merged.similarityToRecentEmotionalMechanics = Math.max(merged.similarityToRecentEmotionalMechanics, 8.5);
  }
  const rejectReasons = [
    ...potentialGateFailures(merged, input.qualityMode),
    ...modelRejectReasons.filter(Boolean),
  ];
  if (noveltyAudit.hardAvoidMatches.length > 0) {
    rejectReasons.push(`hardAvoidMatches: ${noveltyAudit.hardAvoidMatches.join(", ")}`);
  }
  return {
    ...merged,
    personalObjectPotential: merged.personalCostPotential,
    reject: rejectReasons.length > 0,
    rejectReason: rejectReasons[0],
    rejectReasons,
  };
}

function potentialAuditScore(audit: Candidate9Audit): number {
  const scoreKeys: Array<keyof CandidatePotentialScores> = [
    "childRetellableHook",
    "visualShelfAppeal",
    "novelty",
    "emotionalEngine",
    "personalCostPotential",
    "irreversibleMiddlePotential",
    "conflictEscalationPotential",
    "finalImagePotential",
  ];
  const positive = scoreKeys.reduce((sum, key) => sum + Number(audit[key] ?? 0), 0) / scoreKeys.length;
  return positive - Math.max(0, Number(audit.helperDependencyRisk ?? 0) - 4) * 0.6 - Math.max(0, Number(audit.similarityToRecentEmotionalMechanics ?? 0) - 3) * 0.4;
}

function selectPotentialFilterCandidates(
  candidates: DevModeIdeaCandidate[],
  input: DevModeGenerationInput,
  limit = 3
): DevModeIdeaCandidate[] {
  if (candidates.length <= limit) return candidates;
  return candidates
    .map((candidate) => {
      const novelty = auditIdeaCandidateNovelty(candidate, input);
      const audit = auditCandidate9Potential(candidate, novelty.closestRecentOverlap);
      const auditNovelty = Number(audit.novelty ?? 0);
      const auditSimilarity = Number(audit.similarityToRecentEmotionalMechanics ?? 0);
      const score = potentialAuditScore({
        ...audit,
        novelty: novelty.recommendation === "reject" ? Math.min(auditNovelty, 7.0) : auditNovelty,
        similarityToRecentEmotionalMechanics: novelty.recommendation === "reject"
          ? Math.max(auditSimilarity, 8.5)
          : auditSimilarity,
      });
      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.candidate);
}

function auditSummaryLine(audit: DevModePotentialFilterAudit): string {
  return `${audit.title}: ${audit.scores.rejectReason || "passed"} (novelty ${audit.scores.novelty?.toFixed?.(1) ?? "?"}, emotional ${audit.scores.emotionalEngine?.toFixed?.(1) ?? "?"}, cost ${audit.scores.personalCostPotential?.toFixed?.(1) ?? "?"}, irreversible ${audit.scores.irreversibleMiddlePotential?.toFixed?.(1) ?? "?"})`;
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

function buildDeterministicFallbackIdeaCandidates(
  input: DevModeGenerationInput,
  chapterCount: number
): DevModeIdeaCandidate[] {
  const heroNames = (input.avatars || [])
    .map((avatar) => String(avatar.name || "").trim())
    .filter(Boolean);
  const lead = heroNames[0] || "Das Kind";
  const partner = heroNames[1] || heroNames[0] || "ein Freund";
  const poolNames = (input.poolCharacters || [])
    .map((character) => String(character.name || "").trim())
    .filter(Boolean)
    .slice(0, DEV_MODE_MAX_SUPPORTING_CAST);
  const artifactName = String(input.matchedArtifact?.name || "").trim();
  const centralObject = artifactName
    ? `${artifactName} und ein kleiner Schluessel`
    : "ein kleiner Schluessel";
  const setting = compactExcerpt(String(input.config.setting || input.config.genre || "ein geheimnisvoller Ort"), 80);
  const lane = input.noveltyBrief?.creativeLane || "living object";
  const engine = input.noveltyBrief?.emotionalEngine || "wanting a shortcut and discovering why the slow careful way matters";
  const keyMoment = input.noveltyBrief?.keyMomentLens || "wrong shortcut -> visible consequence -> patient repair -> shared ownership";
  const titleObject = artifactName || "der kleine Schluessel";

  const base: Array<Omit<DevModeIdeaCandidate, "id">> = [
    {
      title: `${lead} und ${titleObject}`,
      oneLineHook: `${lead} will in ${chapterCount} Leseseiten schnell helfen, doch ${centralObject} macht jede Abkuerzung sichtbar groesser, bis ${lead} etwas Eigenes opfert und die Regel selbst prueft.`,
      centralObjectOrPlace: centralObject,
      wonderRule: `Der Gegenstand hilft nur, wenn ${lead} zuerst eine unbequeme Wahrheit sagt; jede Abkuerzung kostet ein persoenliches Ding oder eine klare Entscheidung.`,
      emotionalEngine: `${lead} will Verantwortung uebernehmen, hat aber Angst, den entscheidenden Fehler gemacht zu haben.`,
      coreConflict: `Ein schneller Griff loest eine Folge aus, die nicht zurueckgenommen werden kann; ${lead} und ${partner} muessen ohne rettenden Helfer eine genaue Reparatur finden.`,
      whyKidWantsThis: "Konkretes Objekt, klare Regel, sichtbare Folgen, kindlicher Trotz und eine reparierbare Katastrophe.",
      whyDifferentFromRecent: `${lane}; ${keyMoment}; keine Wiederholung der zuletzt gespeicherten Titelmechanik.`,
      recommendedSupportingCast: poolNames.slice(0, Math.max(DEV_MODE_MIN_SUPPORTING_CAST, Math.min(2, poolNames.length))),
      potentialScores: {
        childRetellableHook: 9.0,
        visualShelfAppeal: 8.9,
        novelty: 9.1,
        emotionalEngine: 9.0,
        personalCostPotential: 9.0,
        irreversibleMiddlePotential: 9.0,
        conflictEscalationPotential: 8.9,
        finalImagePotential: 8.8,
        helperDependencyRisk: 3.5,
        similarityToRecentEmotionalMechanics: 3.0,
      },
    },
    {
      title: `${partner} und die falsche Tuer`,
      oneLineHook: `${partner} findet in ${setting} eine Tuer, die nur aufgeht, wenn jemand einen eigenen Fehler zugibt; ${lead} muss entscheiden, ob Bequemlichkeit oder Mut die Geschichte lenkt.`,
      centralObjectOrPlace: `eine Tuer in ${setting} mit einem Schluesselzeichen`,
      wonderRule: "Die Tuer zeigt immer den bequemsten Weg, aber nur der schwerere Weg laesst sie wieder kleiner werden.",
      emotionalEngine: `${partner} will beweisen, dass alles leicht ist, und merkt, dass ein ehrlicher Umweg mutiger ist als ein schneller Sieg.`,
      coreConflict: `${lead} und ${partner} waehlen zuerst falsch; dadurch verschiebt sich der Ort sichtbar und zwingt sie zu einer Entscheidung mit persoenlichem Einsatz.`,
      whyKidWantsThis: "Ein raetselhafter Ort, eine einfache Magieregel und ein sichtbarer Fehler, den Kinder mitloesen koennen.",
      whyDifferentFromRecent: `${engine}; Fokus auf Tuer-Regel und Entscheidung statt auf gespeicherte Motive.`,
      recommendedSupportingCast: poolNames.slice(0, Math.max(DEV_MODE_MIN_SUPPORTING_CAST, Math.min(2, poolNames.length))),
      potentialScores: {
        childRetellableHook: 8.8,
        visualShelfAppeal: 8.8,
        novelty: 9.0,
        emotionalEngine: 8.9,
        personalCostPotential: 8.7,
        irreversibleMiddlePotential: 8.9,
        conflictEscalationPotential: 8.8,
        finalImagePotential: 8.7,
        helperDependencyRisk: 3.8,
        similarityToRecentEmotionalMechanics: 3.2,
      },
    },
  ];

  return base.map((candidate, index) => ({
    ...candidate,
    id: `deterministic_idea_${index + 1}`,
    title: compactExcerpt(candidate.title, 120),
    oneLineHook: compactExcerpt(candidate.oneLineHook, 220),
    centralObjectOrPlace: compactExcerpt(candidate.centralObjectOrPlace, 120),
    wonderRule: compactExcerpt(candidate.wonderRule, 180),
    emotionalEngine: compactExcerpt(candidate.emotionalEngine, 180),
    coreConflict: compactExcerpt(candidate.coreConflict, 180),
    whyKidWantsThis: compactExcerpt(candidate.whyKidWantsThis, 180),
    whyDifferentFromRecent: compactExcerpt(candidate.whyDifferentFromRecent, 180),
  }));
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

/**
 * v11 §3: after the in-window novelty audit, run a second pass against the
 * long-term motif memory (last 50 stories from DB). If the selected idea
 * collides on two load-bearing fields with a stored fingerprint, override
 * to the next-best candidate.
 *
 * Best-effort: a DB failure must never block story generation. We log and
 * fall through if the lookup fails.
 */
async function enforceLongTermNovelty(
  selectedIdea: DevModeSelectedIdea | undefined,
  candidates: DevModeIdeaCandidate[],
  input: DevModeGenerationInput,
  userId: string | undefined,
  pool?: DevModePoolCharacter[]
): Promise<DevModeSelectedIdea | undefined> {
  if (!selectedIdea || !userId) return selectedIdea;
  try {
    const records = await loadRecentMotifs(userId, 50);
    if (records.length === 0) return selectedIdea;

    const buildFp = (idea: DevModeIdeaCandidate | DevModeSelectedIdea, storyId: string) =>
      buildFingerprintFromBlueprint(storyId, {
        title: idea.title,
        description: idea.oneLineHook,
        centralObject: idea.centralObjectOrPlace,
        centralPlace: idea.centralObjectOrPlace,
        wonderRule: idea.wonderRule,
        emotionalEngine: idea.emotionalEngine,
        coreConflict: idea.coreConflict,
      }, []);

    const fp = buildFp(selectedIdea, "pending");
    const hits = findMotifReuse(fp, records);
    const coreHit = hits.find((h) => h.classification === "core_reuse");
    if (!coreHit) {
      console.log("[dev-mode-generation] §3 long-term novelty: clean", {
        candidatesChecked: candidates.length,
        topHitSim: hits[0]?.similarity ?? 0,
      });
      return selectedIdea;
    }

    console.warn("[dev-mode-generation] §3 long-term novelty: core motif reuse detected, overriding", {
      candidate: selectedIdea.title,
      collidesWith: coreHit.record.title,
      similarity: coreHit.similarity,
      similarFields: coreHit.similarFields,
    });

    // Pick the next candidate without a core reuse.
    const ranked = candidates
      .filter((c) => c.title !== selectedIdea.title)
      .map((c) => ({ c, fp: buildFp(c, "pending") }))
      .map(({ c, fp: cfp }) => ({ c, hits: findMotifReuse(cfp, records) }))
      .filter(({ hits: h }) => !h.some((x) => x.classification === "core_reuse"))
      .sort((a, b) => {
        const aSim = a.hits[0]?.similarity ?? 0;
        const bSim = b.hits[0]?.similarity ?? 0;
        return aSim - bSim;
      });

    if (ranked.length === 0) {
      console.warn("[dev-mode-generation] §3 long-term novelty: NO replacement candidate, keeping flagged idea");
      return selectedIdea;
    }
    const replacement = ranked[0].c;
    return enforceSelectedIdeaNovelty(
      {
        ...replacement,
        chosenReason: `Long-term novelty override: original "${selectedIdea.title}" collided with stored "${coreHit.record.title}" (${coreHit.similarFields.join(", ")}). Switched to ${replacement.title}.`,
        selectedSupportingCast: resolvePoolNames(replacement.recommendedSupportingCast, pool),
      },
      candidates,
      input,
      pool,
    );
  } catch (err) {
    console.warn("[dev-mode-generation] §3 long-term novelty check failed (non-fatal):", err instanceof Error ? err.message : String(err));
    return selectedIdea;
  }
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

function isExplanatoryAdultCastRisk(
  character: DevModePoolCharacter,
  selectedIdea: DevModeSelectedIdea,
  input: DevModeGenerationInput
): boolean {
  const mode = input.qualityMode || "premium";
  if (mode !== "premium") return false;
  const characterText = normalizeNoveltyText(poolCharacterFitText(character));
  const ideaText = normalizeNoveltyText(selectedIdeaFitText(selectedIdea, input.config));
  const looksAdultExplainer =
    /\b(lehrer|lehrerin|teacher|mentor|guide|coach|erzieher|erwachsen|adult|mutter|vater|parent|professor|weise|wisdom)\b/.test(characterText);
  if (!looksAdultExplainer) return false;

  const moralOrLessonPremise =
    /\b(ehrlich|ehrlichkeit|wahrheit|lug|lugen|lueg|gelog|gelogen|schuld|verantwort|mut|moral|lehre|lesson|frage|fragen|aufsatz|schule|school)\b/.test(ideaText);
  const physicalCausality =
    /\b(werkzeug|tool|repar|flick|nah|naeh|schraub|klemm|druck|drueck|zieh|schieb|block|rutsch|leucht|mess|mass|karte|kompass)\b/.test(characterText);

  // Premium short stories usually flatten when an adult/teacher figure sits
  // inside an honesty/courage lesson and has no physical plot job.
  return moralOrLessonPremise && !physicalCausality;
}

function finalizeSelectedIdeaCast(
  input: DevModeGenerationInput,
  selectedIdea: DevModeSelectedIdea,
  pool?: DevModePoolCharacter[]
): { selectedIdea: DevModeSelectedIdea; poolCharacters?: DevModePoolCharacter[] } {
  if (!pool || pool.length === 0) return { selectedIdea, poolCharacters: pool };

  const requestedNames = new Set((selectedIdea.selectedSupportingCast || selectedIdea.recommendedSupportingCast || []).map(normalizePoolName));
  const removedRiskyRequested = pool
    .filter((character) => requestedNames.has(normalizePoolName(character.name)))
    .filter((character) => isExplanatoryAdultCastRisk(character, selectedIdea, input))
    .map((character) => character.name);
  const eligiblePool = pool.filter((character) => !isExplanatoryAdultCastRisk(character, selectedIdea, input));

  const minCount = Math.min(DEV_MODE_MIN_SUPPORTING_CAST, eligiblePool.length);
  const maxCount = Math.min(DEV_MODE_MAX_SUPPORTING_CAST, pool.length);
  const recommendedCount = (selectedIdea.selectedSupportingCast || selectedIdea.recommendedSupportingCast || []).length;
  const effectiveRecommendedCount = Math.max(0, recommendedCount - removedRiskyRequested.length);
  const targetCount = Math.max(minCount, Math.min(maxCount, effectiveRecommendedCount || minCount));
  const scored = eligiblePool
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
    removedRiskyRequested,
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
        ? `${selectedIdea.chosenReason} Final supporting cast chosen after premise selection for story fit; recent usage only acted as a soft tie-breaker.${removedRiskyRequested.length ? ` Removed adult-explainer risk: ${removedRiskyRequested.join(", ")}.` : ""}`
        : `${selectedIdea.chosenReason} No supporting cast was forced after premise selection; main-avatar agency and pacing ranked higher than pool usage.${removedRiskyRequested.length ? ` Removed adult-explainer risk: ${removedRiskyRequested.join(", ")}.` : ""}`,
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
    selectedIdea.premiseSeedId
      ? `- Premise seed trace: ${selectedIdea.premiseSeedId}${selectedIdea.premiseSeedMutation ? `; mutation: ${selectedIdea.premiseSeedMutation}` : ""}. Preserve the mutated engine, but do not revert to the raw seed card.`
      : null,
    buildPremiseSeedPromiseBlock(input),
    buildWonderRuleConsistencyBlock(input),
    selectedIdea.selectedSupportingCast.length > 0
      ? `- Supporting cast chosen from pool for this idea: ${selectedIdea.selectedSupportingCast.join(", ")}. They must appear with one plot-necessary function each, then leave room for the main avatars.`
      : "- No pool character is mandatory for this idea; keep extra cast lean.",
    buildCentralObjectContractBlock(input),
    `- Selection reason: ${selectedIdea.chosenReason}`,
  ].filter((line): line is string => Boolean(line)).join("\n");
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

  // Contrast contract for the two heroes. The recurring validator finding
  // across runs was "hero B is a mirror of hero A" (voiceDistinctiveness
  // stuck at 7.5). When both avatars carry similar/empty traits, the derived
  // voices above are too close, so we assign COMPLEMENTARY dialogue ROLES the
  // model must keep distinct regardless of trait data.
  const heroNames = (input.avatars || []).map((a) => a?.name).filter(Boolean) as string[];
  const contrastBlock = heroNames.length >= 2
    ? [
        "",
        `HERO CONTRAST CONTRACT (binding \u2014 ${heroNames[0]} and ${heroNames[1]} must never be interchangeable):`,
        `- ${heroNames[0]} DRIVES: acts first, wants to fix/try/grab, speaks in short decisive statements and commands.`,
        `- ${heroNames[1]} STEADIES: notices, questions, slows things down, speaks in gentle questions and small observations.`,
        "- In EVERY dialogue exchange the two play different beats: one pushes, the other checks \u2014 never two agreeing echoes in a row.",
        `- Distinct RHYTHM (not a repeated phrase): ${heroNames[0]} clipped and blunt, ${heroNames[1]} softer with a trailing question. A reader must name the speaker from the rhythm alone.`,
        "- At least once, let them openly DISAGREE about what to do next before they act \u2014 friction is what makes two voices feel real.",
      ].join("\n")
    : "";

  // Helper anti-solve contract. Both "Der Schl\u00fcssel zu gestern und morgen"
  // (Hexe Kr\u00e4uterweis: "Fange den Duft des Jetzt", "Jede Wurzel kennt ein
  // Gegenmittel") and "Der Weg der stickigen Umwege" (Troll Grummel steering
  // the sorting task) tripped the validator with "helper borders on solving
  // the problem" \u2014 the single point that kept the Kimi run off the 9.0 gate.
  // Knowledge/wise archetypes (witch, wizard, sage, detective) are the worst
  // offenders because "knowing the answer" is their nature.
  const selectedCastForHelper = input.selectedIdea?.selectedSupportingCast || [];
  const helperBlock = selectedCastForHelper.length > 0
    ? [
        "",
        "HELPER ANTI-SOLVE CONTRACT (binding \u2014 supporting cast must COMPLICATE, never SOLVE):",
        "- A helper may pressure, misread, ask a sharp question, hand over a plain object, or create a comic obstacle. A helper may NEVER name the cure, state the rule, or tell the children what to do.",
        "- Wise/knowing archetypes (Hexe, Zauberer, weise Figur, Detektiv) are especially at risk: give them mood, smell, gesture, and ONE cryptic half-line at most \u2014 never a working instruction like \"Fange den Duft des Jetzt\" or \"Jede Wurzel kennt ein Gegenmittel\".",
        "- The decisive insight (\"the key eats my memories\", \"running is what drains the colour\") and the decisive action MUST come from the child avatars, on the page, in their own words.",
      ].join("\n")
    : "";

  return [
    "VOICE BIBLE (binding \u2014 every quoted line must sound unmistakably like the named character):",
    ...lines,
    "- A reader should often identify the speaker WITHOUT tags. If two characters could say a line interchangeably, rewrite one of them.",
    "- CATCHPHRASE RULE: any fixed signature line for a character (e.g. \"Du bist traurig, oder?\", \"Ich hab mir gemerkt...\", \"Warte, ich hab da noch eine Frage!\") may appear AT MOST ONCE in the whole story. Prefer showing the character\u2019s voice through fresh, varied phrasings, gestures, and concrete actions \u2014 not by repeating catchphrases.",
    "- Voice should come from rhythm, vocabulary, body, and reaction style \u2014 not from formulaic openers. Two lines starting with the same fixed phrase = rewrite one.",
    contrastBlock,
    helperBlock,
  ].filter(Boolean).join("\n");
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
      "- Allowed and encouraged: one surprising simile per major scene movement from a child's world (toy, animal, food, weather). Never delete a strong simile during repair.",
    ].join("\n");
  }
  if (code === "en") {
    return [
      "WRITER VOICE BENCHMARK (craft target — do not copy, continue, or imitate any existing book):",
      "- Top read-aloud craft: short musical beats, recurring refrain, no wasted words, and a central trick/rule that keeps paying off.",
      "- Top character-comedy craft: two unmistakably different voices; comedy from action and props; warmth in small gestures.",
      "- Use these as quality criteria only. The story must remain the user's original premise with original wording.",
      "- Allowed and encouraged: one surprising simile per major scene movement from a child's world (toy, animal, food, weather). Never delete a strong simile during repair.",
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
    "- Each scene movement must force the next by therefore/but causality. No episode may be movable without breaking the plot.",
    "- The final choice must be child-small but emotionally exact: giving up control, sharing a private thing, waiting, admitting a mistake, or noticing what a helper cannot say.",
    "- No-refund rule: if a personal object, privilege, promise, status, or secret is paid as the story's cost, the finale may transform/rehome it, but may NOT simply return it unchanged or let a helper undo the cost.",
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

function buildReadingPageContinuityContract(pageCount: number): string {
  return [
    "CONTINUOUS-STORY / READING-PAGE CONTRACT:",
    `- Write ONE fluent read-aloud story that the app displays as exactly ${pageCount} technical reading pages.`,
    "- Reading pages are display containers only. Do not add chapter titles, chapter arcs, recaps, page labels, or mini-endings.",
    "- The five scene movements should flow by cause/effect: hook and false impulse -> first wrong try -> irreversible middle -> discovery by observation -> final choice and closing image.",
    "- Every page boundary must read like a natural paragraph break inside one story, not like the end of a small episode.",
    "- Preserve forward pull through unresolved cause/effect, not through cheap cliffhangers or title-shaped chapter endings.",
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

function minReleaseScoreForMode(mode?: DevModeQualityMode | "efficient" | "premium"): number {
  return (mode || "premium") === "efficient" ? 8.3 : DEV_MODE_PREMIUM_RELEASE_SCORE;
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

function buildDevModeIdeaStructureLibraryBlock(input: DevModeGenerationInput): string {
  const cards = selectDevModeIdeaStructureCards(input);
  if (cards.length === 0) return "";

  return [
    "CURATED STRUCTURE LIBRARY FOR THE IDEA LAB:",
    "- Source: internal abstract construction cards only. This is NOT StoryDNA, NOT FairyDNA, and NOT a database of finished fairy tales.",
    "- Do not retell, translate, modernize, or copy any finished fairy tale. Do not use Cinderella/Grimm/Andersen/etc. as plot sources.",
    "- Use one card as hidden craft pressure per premise candidate, then mutate it with the wizard brief, novelty brief, avatars, and cast fit.",
    "- Do not output card labels/ids as story content. The candidate must sound like a new, ownable children's-book premise.",
    "- At least half the candidates must differ in structure card OR in how the card is concretized. No same-engine candidates with swapped nouns.",
    input.matchedArtifact
      ? "- The provided artifact/prop remains the only specific artifact to consider. Do not replace it with a library artifact name."
      : "- If a candidate needs an object, invent a fresh visible object/place with a rule and a price; do not copy library artifact names.",
    "",
    ...cards.map((card, index) => formatDevModeIdeaStructureCard(card, index, input)),
  ].filter((line): line is string => Boolean(line)).join("\n");
}

function selectDevModeIdeaStructureCards(input: DevModeGenerationInput): StorySkeleton[] {
  const signalText = buildDevModeIdeaStructureSignalText(input);
  const seedText = [
    input.noveltyBrief?.seed,
    input.storyId,
    input.config.genre,
    input.config.setting,
    input.config.customPrompt,
  ].filter(Boolean).join(":") || "dev-mode-idea-structure";

  return STORY_SKELETONS
    .map((skeleton) => ({
      skeleton,
      score: scoreDevModeIdeaStructureCard(skeleton, input, signalText, seedText),
    }))
    .sort((a, b) => b.score - a.score || a.skeleton.id.localeCompare(b.skeleton.id))
    .slice(0, DEV_MODE_IDEA_STRUCTURE_CARD_LIMIT)
    .map((entry) => entry.skeleton);
}

function buildDevModeIdeaStructureSignalText(input: DevModeGenerationInput): string {
  const novelty = input.noveltyBrief;
  const values = [
    input.config.genre,
    input.config.setting,
    input.config.customPrompt,
    input.config.storySoul,
    input.config.storyTempo,
    ...compactStringList(input.config.hooks, 8),
    ...compactStringList(input.config.emotionalFlavors, 8),
    ...compactStringList(input.config.specialIngredients, 8),
    ...(input.config.learningMode?.subjects || []),
    ...(input.config.learningMode?.learningObjectives || []),
    novelty?.shelfPromise,
    novelty?.creativeLane,
    novelty?.emotionalEngine,
    novelty?.wonderMechanic,
    novelty?.keyMomentLens,
    novelty?.titleEnergy,
    ...(novelty?.hardAvoidMotifs || []),
  ];
  return normalizeNoveltyText(values.filter(Boolean).join(" "));
}

function scoreDevModeIdeaStructureCard(
  skeleton: StorySkeleton,
  input: DevModeGenerationInput,
  signalText: string,
  seedText: string
): number {
  const genre = normalizeNoveltyText(input.config.genre || "");
  const setting = normalizeNoveltyText(input.config.setting || "");
  const genreAndSetting = `${genre} ${setting}`;
  let score = 1;

  const isFairyLike = devModeIdeaSignalIncludesAny(genreAndSetting, [
    "fairy",
    "maerchen",
    "marchen",
    "classic",
    "klassisch",
  ]);
  const isMagicalWorldLike = devModeIdeaSignalIncludesAny(genreAndSetting, [
    "magical",
    "magisch",
    "fantasy",
    "zauber",
    "wunder",
    "enchanted",
  ]);

  if (isFairyLike && skeleton.genre === "classical-fairy-tales") score += 2.4;
  if (isMagicalWorldLike && skeleton.genre === "magical-worlds") score += 2.4;
  if (!isFairyLike && !isMagicalWorldLike) score += skeleton.genre === "magical-worlds" ? 0.4 : 0.2;

  if (input.matchedArtifact && skeleton.id === "mw-01-artifact-price") score += 3.2;
  if (input.matchedArtifact && skeleton.id === "cft-01-three-trials") score += 0.8;

  if (skeleton.id === "cft-02-transformation" && devModeIdeaSignalIncludesAny(signalText, [
    "verwandl",
    "transformation",
    "fluch",
    "curse",
    "gestalt",
    "tausch",
  ])) score += 3;

  if (skeleton.id === "cft-03-helper-returns" && devModeIdeaSignalIncludesAny(signalText, [
    "helfer",
    "helper",
    "dank",
    "gutherzig",
    "freundlich",
    "rett",
  ])) score += 3;

  if (skeleton.id === "mw-01-artifact-price" && devModeIdeaSignalIncludesAny(signalText, [
    "artefakt",
    "artifact",
    "objekt",
    "object",
    "preis",
    "price",
    "kosten",
    "cost",
    "tausch",
    "trade",
    "fund",
    "find",
  ])) score += 3;

  if (skeleton.id === "mw-02-gate-to-other-world" && devModeIdeaSignalIncludesAny(signalText, [
    "portal",
    "tor",
    "tuer",
    "tur",
    "door",
    "threshold",
    "schwelle",
    "andere welt",
    "other world",
    "dachboden",
    "schrank",
  ])) score += 3;

  if (skeleton.id === "mw-03-forgotten-rule" && devModeIdeaSignalIncludesAny(signalText, [
    "regel",
    "rule",
    "vergess",
    "forgotten",
    "gemeinschaft",
    "community",
    "club",
    "schule",
    "school",
    "bibliothek",
    "library",
  ])) score += 3;

  if (skeleton.id === "cft-01-three-trials" && devModeIdeaSignalIncludesAny(signalText, [
    "prufung",
    "pruefung",
    "trial",
    "challenge",
    "hindernis",
    "wald",
    "forest",
    "weg",
  ])) score += 2;

  for (const typicalSetting of skeleton.typicalSettings) {
    const normalizedSetting = normalizeNoveltyText(typicalSetting);
    if (normalizedSetting && (setting.includes(normalizedSetting) || signalText.includes(normalizedSetting))) {
      score += 1;
    }
  }

  // Tiny deterministic jitter keeps equally suitable cards rotating by story/novelty seed
  // without introducing random output or hiding the main matching reasons.
  score += (hashString(`${seedText}:${skeleton.id}`) % 100) / 1000;
  return score;
}

function devModeIdeaSignalIncludesAny(signalText: string, needles: ReadonlyArray<string>): boolean {
  return needles.some((needle) => signalText.includes(normalizeNoveltyText(needle)));
}

function formatDevModeIdeaStructureCard(
  skeleton: StorySkeleton,
  index: number,
  input: DevModeGenerationInput
): string {
  const antagonist = getAntagonistArchetype(skeleton.antagonistPattern.archetypeCategory);
  const arcCues = skeleton.chapterHints
    .map((hint) => `${hint.arc}: ${compactExcerpt(hint.playableHint || hint.beat, 72)}`)
    .join(" | ");
  const anchors = skeleton.concreteAnchorHints
    .slice(0, 3)
    .map((hint) => `${hint.abstractTheme} => ${hint.concreteCandidates.slice(0, 2).join(" / ")}`)
    .join("; ");
  const refrains = skeleton.refrainCandidates
    .slice(0, 3)
    .map((hint) => `\"${hint.candidate}\" (${hint.tone})`)
    .join(" / ");

  return [
    `CARD ${index + 1}: ${skeleton.label}`,
    `- Hidden engine to mutate: ${compactExcerpt(skeleton.description, 170)}`,
    `- Visible irreversible middle pressure: ${compactExcerpt(skeleton.mustHaveMoment.description, 170)}`,
    `- Child-playable progression cues: ${arcCues}`,
    antagonist
      ? `- Antagonist pressure: ${antagonist.label}: ${compactExcerpt(antagonist.motivePattern, 150)}`
      : `- Antagonist pressure: ${compactExcerpt(skeleton.antagonistPattern.firstActionShape, 150)}`,
    `- Resolution pressure: ${compactExcerpt(skeleton.antagonistPattern.defeatShape, 150)}`,
    anchors ? `- Concrete-anchor examples to mutate: ${anchors}` : null,
    refrains ? `- Refrain/callback model: ${refrains}` : null,
    `- Iconic motif model: ${skeleton.iconicMotif.object}; invent a fresh recurring object/image for the candidate.`,
    input.matchedArtifact
      ? "- If the provided prop fits, make it create a price/choice; if not, keep it as a planted visual prop instead of forcing it."
      : null,
  ].filter((line): line is string => Boolean(line)).join("\n");
}

function buildDevModePremiseSeedLibraryBlock(
  input: DevModeGenerationInput,
  candidateCount: number,
  round = 1
): string {
  const novelty = input.noveltyBrief;
  const seeds = selectPremiseSeedsForIdeaLab(
    {
      genre: input.config.genre,
      setting: input.config.setting,
      ageGroup: input.config.ageGroup,
      length: input.config.length,
      customPrompt: input.config.customPrompt,
      noveltySeed: novelty?.seed,
      creativeLane: novelty?.creativeLane,
      emotionalEngine: novelty?.emotionalEngine,
      wonderMechanic: novelty?.wonderMechanic,
      keyMomentLens: novelty?.keyMomentLens,
      hardAvoidMotifs: novelty?.hardAvoidMotifs || [],
      recentStoryTexts: (novelty?.recentStories || []).map((story) => [
        story.title,
        story.description,
        story.motifKeywords.join(" "),
      ].filter(Boolean).join(" ")),
      matchedArtifactName: input.matchedArtifact?.name,
      round,
    },
    Math.min(6, Math.max(4, candidateCount))
  );
  return buildPremiseSeedPromptBlock(seeds, { candidateCount, round });
}

function buildIdeaCandidatePrompts(
  input: DevModeGenerationInput,
  chapterCount: number,
  options: { round?: number; previousPotentialFailures?: string[] } = {}
): { systemPrompt: string; userPrompt: string } {
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
      '      "premiseSeedId": string,',
      '      "premiseSeedMutation": string,',
      '      "title": string,',
      '      "oneLineHook": string,',
      '      "centralObjectOrPlace": string,',
      '      "wonderRule": string,',
      '      "emotionalEngine": string,',
      '      "coreConflict": string,',
      '      "whyKidWantsThis": string,',
      '      "whyDifferentFromRecent": string,',
      '      "potentialScores": {',
      '        "childRetellableHook": number,',
      '        "visualShelfAppeal": number,',
      '        "novelty": number,',
      '        "emotionalEngine": number,',
      '        "personalCostPotential": number,',
      '        "irreversibleMiddlePotential": number,',
      '        "conflictEscalationPotential": number,',
      '        "finalImagePotential": number,',
      '        "helperDependencyRisk": number,',
      '        "similarityToRecentEmotionalMechanics": number',
      "      },",
      '      "recommendedSupportingCast": string[]',
      "    }",
      "  ]",
      "}",
    ].join("\n")
  );

  const userPrompt = [
    `IDEA LAB CALL${options.round ? ` ROUND ${options.round}` : ""}: Generate exactly ${candidateCount} short children's-book premises before any blueprint writing.`,
    "Do NOT write story prose. Do NOT write chapters. Generate only premise candidates strong enough to deserve a full story.",
    "COMPLETION BUDGET IS BINDING: output complete valid JSON. Keep every string to one compact sentence. Do not exceed 850 characters per candidate. If you need to save space, shorten wording; never truncate the JSON.",
    "Every candidate must feel like a real book a child would pull from a library shelf: concrete, visual, memorable, emotionally playable, and different from the recent stories.",
    "Every candidate must be capable of a visible irreversible middle and a concrete personal cost. If you cannot name those potentials, do not include the candidate.",
    "Every distinctive word promised by the title or premise-seed mutation must become part of the wonder rule, conflict escalation, or final image. Do not use big shelf words (seasons, dreams, courage, moods, gravity, weather) as decoration only.",
    "Score potentialScores honestly from 0-10. Scores below 8.5 on emotional engine, personal cost, irreversible middle, or conflict escalation mean the premise should probably be replaced before output.",
    options.previousPotentialFailures?.length
      ? [
          "PREVIOUS POTENTIAL FILTER REJECTIONS (do not repeat these mechanics):",
          ...options.previousPotentialFailures.slice(0, 12).map((failure) => `- ${failure}`),
        ].join("\n")
      : null,
    "No generic fantasy quests. No recycled sound/bell/silence premises unless the user explicitly asked for them.",
    "Hard-avoid motifs are word families, not exact words. If a motif like 'spiegel' is in the novelty brief, do not use spiegelt, Spiegelung, Spiegelwasser, mirror-rule, or a title/chapter built around that idea.",
    "",
    buildDevModeIdeaStructureLibraryBlock(input),
    "",
    buildDevModePremiseSeedLibraryBlock(input, candidateCount, options.round || 1),
    "",
    "Use the available supporting cast only when the fit is real. If a pool character does not fit a candidate naturally, leave them out of that candidate.",
    `Recommended supporting cast names must come ONLY from the provided pool list. Recommend ${DEV_MODE_MIN_SUPPORTING_CAST}-${DEV_MODE_MAX_SUPPORTING_CAST} names; pick the smallest set that genuinely serves the story.`,
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
    buildArtifactPropBlock(input),
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
    `If a candidate recommends supporting cast, keep ${DEV_MODE_MIN_SUPPORTING_CAST}-${DEV_MODE_MAX_SUPPORTING_CAST} names that truly improve this story. Decorative, adult-explainer, or mismatched pool characters should be dropped.`,
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

function buildPotentialFilterPrompts(
  input: DevModeGenerationInput,
  chapterCount: number,
  candidates: DevModeIdeaCandidate[],
  round: number
): { systemPrompt: string; userPrompt: string } {
  const languageName = localizedLanguageName(input.config.language);
  const systemPrompt = qualitySystemPrompt(
    languageName,
    [
      "Schema:",
      "{",
      '  "candidateAudits": [',
      '    {',
      '      "id": string,',
      '      "title": string,',
      '      "scores": {',
      '        "childRetellableHook": number,',
      '        "visualShelfAppeal": number,',
      '        "novelty": number,',
      '        "emotionalEngine": number,',
      '        "personalCostPotential": number,',
      '        "irreversibleMiddlePotential": number,',
      '        "conflictEscalationPotential": number,',
      '        "finalImagePotential": number,',
      '        "helperDependencyRisk": number,',
      '        "similarityToRecentEmotionalMechanics": number',
      "      },",
      '      "reject": boolean,',
      '      "rejectReasons": string[]',
      "    }",
      "  ],",
      '  "passingCandidateIds": string[],',
      '  "chosenIdeaId": string | null,',
      '  "selectedSupportingCast": string[],',
      '  "roundRecommendation": "pass" | "regenerate"',
      "}",
    ].join("\n")
  );
  const t = getPotentialThresholds(input.qualityMode);
  const userPrompt = [
    `CALL 2: 9.0 POTENTIAL FILTER, round ${round}. Do not write prose and do not outline chapters.`,
    "Judge whether each candidate can realistically become a 9.0+ children's story after beat sheet and scene-card work.",
    "Do not trust the candidate's self-scores. Judge the evidence in the fields: a candidate without a concrete cost, irreversible middle, conflict escalation path, and final image must be rejected even if its numbers are high.",
    "Reject or downscore any candidate whose title/seed mutation promises a system (e.g. seasons, plant moods, gravity, weather) but whose wonderRule/coreConflict only uses a generic magic object without that system becoming causal.",
    `Quality mode: ${input.qualityMode || "premium"}. Use these hard thresholds exactly:`,
    `- childRetellableHook >= ${t.childRetellableHook}`,
    `- visualShelfAppeal >= ${t.visualShelfAppeal}`,
    `- novelty >= ${t.novelty}`,
    `- emotionalEngine >= ${t.emotionalEngine}`,
    `- personalCostPotential >= ${t.personalCostPotential}`,
    `- irreversibleMiddlePotential >= ${t.irreversibleMiddlePotential}`,
    `- conflictEscalationPotential >= ${t.conflictEscalationPotential}`,
    `- finalImagePotential >= ${t.finalImagePotential}`,
    `- helperDependencyRisk <= ${t.helperDependencyRiskMax}`,
    `- similarityToRecentEmotionalMechanics <= ${t.similarityToRecentEmotionalMechanicsMax}`,
    "Reject cute but structurally soft ideas. Reject any idea whose core emotional mechanic is another version of waiting/listening/letting go unless the user explicitly requested that mechanic.",
    "For ages 6-8, concrete child-play beats poetic abstraction: a physical comic engine/object game outranks a beautiful metaphor if both pass.",
    "If two candidates are close, choose the one a child can retell and play immediately (funny rule, visible object, escalating mess), not the one with the deepest abstract emotional wording.",
    "If no candidate passes, set passingCandidateIds=[] and roundRecommendation='regenerate'. Do not choose the best weak candidate.",
    `If a candidate passes, choose the strongest one for exactly ${chapterCount} display chapters later and keep only supporting cast that creates a complication, clue, pressure, joke, or payoff.`,
    "",
    "WIZARD CONTEXT:",
    buildWizardCreativeBrief(input.config, chapterCount, true),
    buildNoveltyPromptBlock(input) || "No novelty brief available.",
    "",
    "CANDIDATES:",
    promptJson(candidates),
  ].filter(Boolean).join("\n");
  return { systemPrompt, userPrompt };
}

function normalizePotentialFilterResult(
  parsed: any,
  candidates: DevModeIdeaCandidate[],
  input: DevModeGenerationInput,
  pool?: DevModePoolCharacter[]
): DevModePotentialFilterResult {
  const rawAudits = Array.isArray(parsed?.candidateAudits)
    ? parsed.candidateAudits
    : Array.isArray(parsed?.audits)
      ? parsed.audits
      : [];
  const rawByIdOrTitle = new Map<string, any>();
  for (const raw of rawAudits) {
    const id = String(raw?.id || "").trim();
    const title = normalizePoolName(String(raw?.title || ""));
    if (id) rawByIdOrTitle.set(id, raw);
    if (title) rawByIdOrTitle.set(title, raw);
  }

  const candidateAudits: DevModePotentialFilterAudit[] = candidates.map((candidate) => {
    const raw = rawByIdOrTitle.get(candidate.id) || rawByIdOrTitle.get(normalizePoolName(candidate.title));
    const rawReasons = Array.isArray(raw?.rejectReasons)
      ? raw.rejectReasons.map((r: any) => String(r || "").trim()).filter(Boolean)
      : [];
    const scores = buildFullPotentialAudit(
      candidate,
      input,
      normalizePotentialScores(raw?.scores || raw),
      Boolean(raw?.reject) ? rawReasons : []
    );
    return { id: candidate.id, title: candidate.title, scores };
  });

  const passingCandidateIds = candidateAudits
    .filter((audit) => !audit.scores.reject)
    .sort((a, b) => potentialAuditScore(b.scores) - potentialAuditScore(a.scores))
    .map((audit) => audit.id);
  // Deterministic audit wins over the model's own final pick. Logs showed the
  // support model sometimes chose a poetic/abstract candidate even when its
  // own audited scores ranked a more concrete, funny, child-playable idea
  // slightly higher. The sorted passing list is the source of truth.
  const chosenIdeaId = passingCandidateIds[0];
  return {
    candidateAudits,
    passingCandidateIds,
    chosenIdeaId: chosenIdeaId || undefined,
    selectedSupportingCast: resolvePoolNames(parsed?.selectedSupportingCast || [], pool),
    roundRecommendation: passingCandidateIds.length > 0 ? "pass" : "regenerate",
  };
}

function selectedIdeaFromPotentialFilter(
  result: DevModePotentialFilterResult,
  candidates: DevModeIdeaCandidate[],
  pool?: DevModePoolCharacter[]
): DevModeSelectedIdea | undefined {
  if (!result.chosenIdeaId) return undefined;
  const candidate = candidates.find((c) => c.id === result.chosenIdeaId);
  if (!candidate) return undefined;
  const selectedSupportingCast = result.selectedSupportingCast && result.selectedSupportingCast.length > 0
    ? result.selectedSupportingCast
    : resolvePoolNames(candidate.recommendedSupportingCast, pool);
  const audit = result.candidateAudits.find((a) => a.id === candidate.id);
  return {
    ...candidate,
    chosenReason: audit
      ? `9.0 potential filter passed: ${auditSummaryLine(audit)}.`
      : "9.0 potential filter selected this candidate.",
    selectedSupportingCast,
    selectionScores: {
      shelfAppeal: audit?.scores.visualShelfAppeal,
      novelty: audit?.scores.novelty,
      emotionalPotential: audit?.scores.emotionalEngine,
      childCuriosity: audit?.scores.childRetellableHook,
      poolCastFit: selectedSupportingCast.length > 0 ? 8.5 : 8.0,
    },
  };
}

function buildLeanRepairPromptContext(
  input: DevModeGenerationInput,
  chapterCount: number,
  options: { readingPageMode?: boolean } = {}
): string {
  const languageName = localizedLanguageName(input.config.language);
  const heroNames = (input.avatars || []).map((avatar) => avatar.name).filter(Boolean);
  const poolNames = (input.poolCharacters || []).map((character) => character.name).filter(Boolean);
  const readingPageMode = !!options.readingPageMode;
  return [
    `Output language: ${languageName}.`,
    readingPageMode
      ? `Age group: ${input.config.ageGroup}. Display target: exactly ${chapterCount} technical reading pages; no author chapters.`
      : `Age group: ${input.config.ageGroup}. Chapter count: exactly ${chapterCount}.`,
    `Genre: ${input.config.genre}. Setting: ${input.config.setting}.`,
    readingPageMode
      ? `Length: ${input.config.length}; write one continuous story, later displayed as ${chapterCount} reading pages.`
      : buildWizardCreativeBrief(input.config, chapterCount, true),
    heroNames.length > 0 ? `Main characters: ${heroNames.join(", ")}.` : "Main characters: preserve the existing story's main characters.",
    poolNames.length > 0 ? `Supporting cast already available: ${poolNames.join(", ")}.` : null,
    readingPageMode
      ? "Repair context is intentionally compact to reduce cost. Preserve whole-story continuity and do not make reading pages self-contained."
      : "Repair context is intentionally compact to reduce cost. Preserve continuity from the compact story map and the target chapter only.",
    "Voice contract: use the named voice/cast notes from the full prompt; do not force generic careful/lively/helper templates if they do not fit the actual characters.",
    "Quality goal: cleaner scenes with more action-bearing dialogue; no new subplot, no rewritten story world. Tighten wording but NEVER push the whole story below its word target.",
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
    return `Whole-story word budget: about 550-850 words total across one continuous story, later displayed as ${chapterCount} reading pages.`;
  }
  if (config.length === "long") {
    return `Whole-story word budget: about 1,400-2,200 words total across one continuous story, later displayed as ${chapterCount} reading pages.`;
  }
  return `Whole-story word budget: 900-1,200 words total across one continuous story, later displayed as ${chapterCount} reading pages.`;
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
    "",
    buildArtifactPropBlock(input) || null,
  ].filter((line): line is string => line !== null && line !== undefined).join("\n");
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

function buildLoglineEnginePrompts(
  input: DevModeGenerationInput,
  chapterCount: number
): { systemPrompt: string; userPrompt: string } {
  const languageName = localizedLanguageName(input.config.language);
  const systemPrompt = qualitySystemPrompt(
    languageName,
    [
      "Schema:",
      "{",
      '  "logline": string,',
      '  "emotionalPremise": string,',
      '  "centralQuestion": string,',
      '  "mainWant": string,',
      '  "mainNeed": string,',
      '  "falseBelief": string,',
      '  "wonderRule": string,',
      '  "recurringMotif": string,',
      '  "personalObject": string',
      "}",
    ].join("\n")
  );
  const userPrompt = [
    "CALL 3: LOGLINE + EMOTIONAL ENGINE. Do not write prose, chapters, or scene summaries.",
    "Turn the locked 9.0-potential idea into a compact story engine a screenwriter could build from.",
    "The engine must make child agency, personal cost, and the wonder rule concrete. No moral wording.",
    `Future display chapters: ${chapterCount}. Scene cards will be exactly ${DEV_MODE_SCENE_CARD_COUNT}.`,
    "",
    "LOCKED WINNING IDEA:",
    buildSelectedIdeaPromptBlock(input) || "No selected idea available.",
    "",
    buildCentralObjectContractBlock(input) || "",
    "PERSONAL-OBJECT RULE:",
    "- personalObject must come from the locked idea's central object/place or a child-owned keepsake organically tied to it.",
    "- Do NOT use a pool artifact/background prop as personalObject unless it is literally the selected idea's central object.",
    "",
    "VOICE / CAST BRIEF:",
    buildVoiceBibleBlock(input) || "",
    buildSelectedCastIntegrationContract(input) || "",
    "",
    buildArtifactPropBlock(input) || "",
  ].filter(Boolean).join("\n");
  return { systemPrompt, userPrompt };
}

function buildBeatSheetPrompts(
  input: DevModeGenerationInput,
  chapterCount: number,
  loglineEngine: any,
  repairIssues: string[] = []
): { systemPrompt: string; userPrompt: string } {
  const languageName = localizedLanguageName(input.config.language);
  const isPremium = (input.qualityMode || "premium") === "premium";
  const systemPrompt = qualitySystemPrompt(
    languageName,
    [
      "Schema:",
      "{",
      '  "logline": string,',
      '  "emotionalPremise": string,',
      '  "centralQuestion": string,',
      '  "mainWant": string,',
      '  "mainNeed": string,',
      '  "falseBelief": string,',
      '  "wonderRule": string,',
      '  "recurringMotif": string,',
      '  "personalObject": { "object": string, "whyPersonal": string, "risk": string, "payoff": string },',
      '  "act1": { "hook": string, "incitingIncident": string, "wrongFirstMove": string, "firstConsequence": string },',
      '  "act2": { "complication": string, "helperComplicates": string, "midpointIrreversibleTurn": string, "personalCost": string },',
      '  "act3": { "recognition": string, "finalChoice": string, "payoffFromPlant": string, "closingImage": string },',
      '  "irreversibleMiddle": { "wrongAction": string, "visibleDamage": string, "personalCost": string, "cannotReturnToStartBecause": string, "newPressure": string },',
      '  "finalPayoff": { "plantedDetail": string, "childAction": string, "worldResponse": string, "closingImage": string }',
      "}",
    ].join("\n")
  );
  const userPrompt = [
    repairIssues.length > 0
      ? "CALL 4R: REPAIR THE FILMIC BEAT SHEET. Do not write prose."
      : "CALL 4: FILMIC BEAT SHEET. Do not write prose.",
    "Build this like film/TV prep: a causal beat sheet before any pretty sentences exist.",
    "Hard gates:",
    "- midpointIrreversibleTurn must be visible and make the old situation impossible to restore by simply waiting.",
    "- personalCost must be concrete: an object, comfort, promise, status, sound, secret, or habit the child risks or gives up.",
    "- personalObject.object, recurringMotif, irreversibleMiddle.visibleDamage, finalPayoff.plantedDetail, and finalPayoff.closingImage must share ONE red-thread object/place from the locked idea.",
    "- Do NOT make a pool artifact/background prop the personalObject or finale engine unless it is already the selected idea's central object.",
    "- finalChoice must be executed by the main children, not by a helper or adult.",
    "- helperComplicates may confuse, pressure, fail, ask, or hand over an object. It must not explain the answer.",
    "- closingImage must be a picture/action, not a stated lesson.",
    // v12 §H additive gates — structured sub-objects.
    "- personalObject.object must be a NAMED thing (not 'something important'); whyPersonal explains why this specific child cares; risk states what is at stake; payoff describes what happens to the object at the end.",
    "- irreversibleMiddle.visibleDamage must be a concrete visible change (zerbrochen, verlischt, schrumpft, weg, ...) — NOT abstract phrasing like 'alles wird schwieriger'.",
    "- irreversibleMiddle.cannotReturnToStartBecause must give a structural reason why simply waiting cannot undo it.",
    "- finalPayoff.plantedDetail must be a detail that was visibly planted before the midpoint.",
    "- finalPayoff.childAction must be executed by the main children, named. NOT by a helper.",
    "- finalPayoff.closingImage must echo finalPayoff.plantedDetail (same object / motif / location).",
    isPremium
      ? "PREMIUM MODE: the new structured sub-objects (irreversibleMiddle, finalPayoff, personalObject) are HARD REQUIRED. An incomplete sub-object will trigger regenerate_from_plan_or_idea, not a cosmetic repair."
      : "EFFICIENT MODE: structured sub-objects are preferred. If you cannot fill them, the legacy flat fields (act2.midpointIrreversibleTurn, act3.payoffFromPlant) are still acceptable.",
    repairIssues.length > 0 ? `Repair these gate issues: ${repairIssues.join(" | ")}` : null,
    "",
    "LOCKED ENGINE:",
    promptJson(loglineEngine),
    "",
    "LOCKED IDEA / CONTEXT:",
    buildSelectedIdeaPromptBlock(input) || "",
    buildCentralObjectContractBlock(input) || "",
    buildSelectedCastIntegrationContract(input, true) || "",
    buildArtifactPropBlock(input) || "",
    `Future display chapters: ${chapterCount}; screenplay scene cards next: exactly ${DEV_MODE_SCENE_CARD_COUNT}.`,
  ].filter(Boolean).join("\n");
  return { systemPrompt, userPrompt };
}

function buildSceneCardPrompts(
  input: DevModeGenerationInput,
  beatSheet: any,
  repairIssues: string[] = []
): { systemPrompt: string; userPrompt: string } {
  const languageName = localizedLanguageName(input.config.language);
  const heroNames = (input.avatars || []).map((avatar) => avatar.name).filter(Boolean);
  const heroA = heroNames[0] || "main child A";
  const heroB = heroNames[1] || "main child B";
  const isPremium = (input.qualityMode || "premium") === "premium";
  const systemPrompt = qualitySystemPrompt(
    languageName,
    [
      "Schema:",
      "{",
      '  "sceneCards": [',
      '    {',
      '      "scene": number,',
      '      "titleHint": string,',
      '      "location": string,',
      '      "timePressureOrQuestion": string,',
      '      "scenePurpose": "hook" | "false_attempt" | "complication" | "irreversible_middle" | "final_payoff",',
      '      "visibleGoal": string,',
      '      "emotionalGoal": string,',
      '      "obstacle": string,',
      '      "wrongAction": string,',
      '      "visibleConsequence": string,',
      '      "visibleDamage": string,',
      '      "irreversibleChange": string,',
      '      "emotionalTurn": string,',
      '      "personalCost": string,',
      '      "cannotGoBackReason": string,',
      '      "childDiscovery": string,',
      '      "childDecision": string,',
      '      "characterDriver": string,',
      '      "adrianAction": string,',
      '      "alexanderAction": string,',
      '      "helperFunction": string,',
      '      "helperAction": string,',
      '      "helperMustNotExplain": true,',
      '      "recurringMotifState": "introduced" | "misused" | "lost" | "reinterpreted" | "payoff",',
      '      "dialogueBeats": [ { "speaker": string, "intent": string, "subtext": string, "actionCarried": string } ],',
      '      "plant": string,',
      '      "payoffLater": string,',
      '      "endPull": string',
      "    }",
      "  ]",
      "}",
    ].join("\n")
  );
  const userPrompt = [
    repairIssues.length > 0
      ? "CALL 5R: REPAIR SCENE CARDS BEFORE PROSE. Do not write prose."
      : "CALL 5: SCENE CARDS / DREHBUCHKARTEN. Do not write prose.",
    `Create exactly ${DEV_MODE_SCENE_CARD_COUNT} scene cards. These are cinematic story functions, not display chapters.`,
    "Required purposes, in order: hook, false_attempt, complication, irreversible_middle, final_payoff.",
    "Every scene needs a visible goal, obstacle, wrong action or pressure, visible consequence, changed state, plant/payoff logic, and an end pull.",
    `Use characterDriver as "${heroA}", "${heroB}", or "shared". If the raw field names say adrianAction/alexanderAction, map them to ${heroA}/${heroB} actions.`,
    "Scene 3 or 4 must contain both irreversibleChange and personalCost.",
    "personalCost must name a PHYSICAL object, place, or privilege that is visibly given up, used up, broken, or left behind — NEVER an abstract feeling. Forbidden: 'verliert Zuversicht', 'muss Scham überwinden', 'loses hope'. Required shape: 'gibt den letzten X her', 'lässt Y zurück', 'Z zerbricht und bleibt zerbrochen'.",
    "The red-thread object/place must stay consistent from beat sheet to scene cards: visibleDamage, personalCost, plant, payoffLater, childDiscovery, and childDecision may not swap in a different main object.",
    // v12 §I additive gates.
    "Scene 3 or 4 (the irreversible middle) must include visibleDamage (a concrete visible change), emotionalTurn, and cannotGoBackReason.",
    "Scene 4 must include childDiscovery — the children find the structural connection. helperFunction must NOT explain the answer.",
    "The last scene must include childDecision — the resolving action is executed by a named child.",
    "recurringMotifState must progress across the 5 scenes: introduced → (misused | lost) → reinterpreted → payoff. Pick the value that matches the scene's role.",
    "Each card needs at least 4 dialogueBeats; the next pass will expand to 4-6. Each beat must carry an actionCarried (a body action, object exchange, or pause) — never filler.",
    "Helpers must not explain the solution. helperFunction must be one of: complicates, misreads, provides tool, creates pressure, creates comic obstacle, witnesses choice. helperAction is the in-scene line/move.",
    "Non-final endPull must not be a calm conclusion.",
    isPremium
      ? "PREMIUM MODE: visibleDamage on the middle scene, childDiscovery on scene 4, childDecision on the final scene, and recurringMotifState on every scene are HARD REQUIRED. Incomplete cards trigger scene_card_repair_then_rewrite."
      : "EFFICIENT MODE: the new fields are preferred but the legacy fields (irreversibleChange, personalCost) remain the hard floor.",
    repairIssues.length > 0 ? `Repair these gate issues: ${repairIssues.join(" | ")}` : null,
    "",
    "BEAT SHEET:",
    promptJson(beatSheet),
    "",
    "VOICE / CAST:",
    buildCentralObjectContractBlock(input) || "",
    buildVoiceBibleBlock(input) || "",
    buildSelectedCastIntegrationContract(input, true) || "",
  ].filter(Boolean).join("\n");
  return { systemPrompt, userPrompt };
}

function buildDialogueIntentPrompts(
  input: DevModeGenerationInput,
  sceneCards: any[],
  repairIssues: string[] = [],
  previousDialoguePlan?: any
): { systemPrompt: string; userPrompt: string } {
  const languageName = localizedLanguageName(input.config.language);
  const systemPrompt = qualitySystemPrompt(
    languageName,
    [
      "Schema:",
      "{",
      '  "sceneDialogue": [',
      '    {',
      '      "scene": number,',
      '      "dialogueBeats": [',
      '        { "speaker": string, "intent": "want" | "resist" | "joke" | "observe" | "decide" | "hide fear" | "challenge", "subtext": string, "draftStyle": string }',
      "      ]",
      "    }",
      "  ]",
      "}",
    ].join("\n")
  );
  const userPrompt = [
    repairIssues.length > 0
      ? "CALL 6R: REPAIR DIALOGUE INTENT BEFORE PROSE. Do not write prose."
      : "CALL 6: DIALOGUE INTENT PASS. Do not write prose.",
    "Plan dialogue function before drafting. This is not a quota pass; every beat must carry action, relationship, tension, humor, or subtext.",
    "For each of the 5 scenes, produce 4-6 dialogue beats. Hard minimum is 4 beats per scene.",
    "Make the main children sound different through rhythm, word choice, first reaction, and body action.",
    "No filler acknowledgements. No helper explaining the magic rule or final answer.",
    repairIssues.length > 0 ? `Repair these gate issues: ${repairIssues.join(" | ")}` : null,
    repairIssues.length > 0 && previousDialoguePlan
      ? `Previous incomplete plan to extend (keep good beats, add more to reach 4-6 per scene):\n${promptJson(previousDialoguePlan)}`
      : null,
    "",
    "SCENE CARDS:",
    promptJson(sceneCards),
    "",
    "VOICE BIBLE:",
    buildVoiceBibleBlock(input) || "",
    buildWriterVoiceAnchorBlock(input) || "",
  ].filter(Boolean).join("\n");
  return { systemPrompt, userPrompt };
}

function unwrapBeatSheet(parsed: any): any {
  return parsed?.beatSheet || parsed?.filmicBeatSheet || parsed;
}

function normalizeSceneCards(parsed: any): any[] {
  const raw = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.sceneCards)
      ? parsed.sceneCards
      : Array.isArray(parsed?.scenes)
        ? parsed.scenes
        : [];
  return raw
    .slice(0, DEV_MODE_SCENE_CARD_COUNT)
    .map((scene: any, index: number) => ({
      ...scene,
      scene: Number(scene?.scene || index + 1),
      helperMustNotExplain: scene?.helperMustNotExplain !== false,
      dialogueBeats: Array.isArray(scene?.dialogueBeats) ? scene.dialogueBeats : [],
    }));
}

function firstSceneText(...values: any[]): string {
  for (const value of values) {
    if (typeof value === "string") {
      const text = value.replace(/\s+/g, " ").trim();
      if (text && text !== "[object Object]") return text;
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      const text = String(value).trim();
      if (text) return text;
      continue;
    }
    if (value && typeof value === "object") {
      const nested = firstSceneText(
        value.object,
        value.name,
        value.item,
        value.title,
        value.description,
        value.whyPersonal,
        value.whyItMatters,
        value.meaning,
        value.emotionalValue,
        value.risk,
        value.whatItCostsToShare,
        value.cost,
        value.visibleDamage,
        value.personalCost,
        value.cannotReturnToStartBecause,
        value.finalChoice,
        value.childAction,
        value.closingImage,
        value.payoff,
      );
      if (nested) return nested;
    }
  }
  return "";
}

function extractPersonalObjectDetails(primary: any, fallback?: any): {
  object: string;
  whyPersonal: string;
  risk: string;
  payoff: string;
  text: string;
} {
  const source = primary ?? fallback;
  if (source && typeof source === "object") {
    const object = firstSceneText(source.object, source.name, source.item, fallback);
    const whyPersonal = firstSceneText(source.whyPersonal, source.whyItMatters, source.meaning, source.emotionalValue);
    const risk = firstSceneText(source.risk, source.whatItCostsToShare, source.personalCost, source.cost);
    const payoff = firstSceneText(source.payoff, source.finalChoice, source.childAction, source.closingImage);
    const parts = [
      object,
      whyPersonal ? `why personal: ${whyPersonal}` : "",
      risk ? `risk/cost: ${risk}` : "",
      payoff ? `payoff: ${payoff}` : "",
    ].filter(Boolean);
    return { object, whyPersonal, risk, payoff, text: parts.join("; ") };
  }
  const text = firstSceneText(source, fallback);
  return { object: text, whyPersonal: "", risk: "", payoff: "", text };
}

function compactPersonalObjectForPrompt(primary: any, fallback?: any, maxChars = 180): string | Record<string, string | undefined> {
  const details = extractPersonalObjectDetails(primary, fallback);
  if (details.whyPersonal || details.risk || details.payoff) {
    return {
      object: compactExcerpt(details.object || details.text, 90),
      whyPersonal: details.whyPersonal ? compactExcerpt(details.whyPersonal, 130) : undefined,
      risk: details.risk ? compactExcerpt(details.risk, 130) : undefined,
      payoff: details.payoff ? compactExcerpt(details.payoff, 130) : undefined,
    };
  }
  return compactExcerpt(details.text, maxChars);
}

function hasConcreteSceneDamageSignal(text: string): boolean {
  return /(zerbr|brech|kaputt|riss|reißt|reisst|verschwind|verlisch|erlisch|schrumpf|verlier|loest sich|löst sich|stuerz|stürz|brennt|verbrann|tropft|leckt|verstummt|verdorrt|welkt|broken|lost|missing|silent|cracked|shrinks|fades|vanishes|disappears|spilled|burned|dies)/i.test(text);
}

function ensureSceneDialogueBeats(card: any, input: DevModeGenerationInput): any[] {
  const heroNames = (input.avatars || []).map((avatar) => avatar.name).filter(Boolean);
  const heroA = heroNames[0] || "Kind 1";
  const heroB = heroNames[1] || "Kind 2";
  const existing = Array.isArray(card?.dialogueBeats) ? card.dialogueBeats.slice(0, 6) : [];
  const fillers = [
    { speaker: heroA, intent: "want", subtext: "will das sichtbare Ziel erreichen", actionCarried: card?.visibleGoal || card?.plant || "zeigt auf den nächsten Schritt" },
    { speaker: heroB, intent: "observe", subtext: "bemerkt die Regel oder Gefahr", actionCarried: card?.obstacle || card?.visibleConsequence || "hält kurz inne und prüft die Spur" },
    { speaker: heroA, intent: "resist", subtext: "will den einfachen Weg nehmen", actionCarried: card?.wrongAction || "greift zu schnell nach der falschen Lösung" },
    { speaker: heroB, intent: "decide", subtext: "lenkt zur nächsten Handlung", actionCarried: card?.endPull || card?.childDecision || "setzt eine konkrete Entscheidung in Bewegung" },
  ];
  for (const filler of fillers) {
    if (existing.length >= 4) break;
    existing.push(filler);
  }
  return existing;
}

function repairSceneCardsDeterministically(
  sceneCards: any[],
  beatSheet: any,
  input: DevModeGenerationInput,
): { sceneCards: any[]; changed: boolean; fixes: string[] } {
  const purposes = ["hook", "false_attempt", "complication", "irreversible_middle", "final_payoff"];
  const motif = firstSceneText(beatSheet?.recurringMotif, beatSheet?.wonderRule, input.selectedIdea?.centralObjectOrPlace, "das wiederkehrende Zeichen");
  const middle = beatSheet?.irreversibleMiddle || {};
  const finalPayoff = beatSheet?.finalPayoff || {};
  const heroNames = (input.avatars || []).map((avatar) => avatar.name).filter(Boolean);
  const heroA = heroNames[0] || "Die Kinder";
  const heroB = heroNames[1] || "das zweite Kind";
  const lockedCentralObject = getLockedCentralObject(input);
  const personalObject = firstSceneText(beatSheet?.personalObject, lockedCentralObject, motif);
  const rawPersonalCost = firstSceneText(middle.personalCost, beatSheet?.act2?.personalCost, input.selectedIdea?.coreConflict);
  const personalCost = rawPersonalCost.length >= 18 && !/(learns|lernt|understands|versteht|erkennt)\b/i.test(rawPersonalCost)
    ? rawPersonalCost
    : `${heroA} und ${heroB} riskieren ${personalObject}; wenn sie falsch handeln, bleibt es sichtbar beschädigt.`;
  const rawVisibleDamage = firstSceneText(middle.visibleDamage, beatSheet?.act2?.midpointIrreversibleTurn, beatSheet?.act1?.firstConsequence);
  const visibleDamage = hasConcreteSceneDamageSignal(rawVisibleDamage)
    ? rawVisibleDamage
    : `${personalObject} bekommt einen sichtbaren Riss; ein wichtiges Stück verschwindet vor den Augen der Kinder.`;
  const rawCannotGoBack = firstSceneText(middle.cannotReturnToStartBecause, middle.newPressure, beatSheet?.act2?.midpointIrreversibleTurn);
  const cannotGoBack = rawCannotGoBack.length >= 18
    ? rawCannotGoBack
    : `Weil ${personalObject} sichtbar beschädigt ist, kann der Anfangszustand nicht einfach durch Warten zurückkommen.`;
  const childDiscovery = firstSceneText(beatSheet?.act3?.recognition, finalPayoff.plantedDetail, beatSheet?.act3?.payoffFromPlant, motif);
  const childDecision = firstSceneText(finalPayoff.childAction, beatSheet?.act3?.finalChoice, beatSheet?.act3?.payoffFromPlant);
  const motifStates = ["introduced", "misused", "lost", "reinterpreted", "payoff"];
  const fixes: string[] = [];

  const baseCards = sceneCards.slice(0, DEV_MODE_SCENE_CARD_COUNT);
  while (baseCards.length < DEV_MODE_SCENE_CARD_COUNT) {
    baseCards.push({ scene: baseCards.length + 1 });
    fixes.push(`padded-scene-${baseCards.length}`);
  }

  const repaired = baseCards.map((card, index) => {
    const sceneNo = index + 1;
    const original = card || {};
    const scenePurpose = purposes[index];
    const next: any = {
      ...original,
      scene: Number(original.scene || sceneNo),
      scenePurpose,
      helperMustNotExplain: original.helperMustNotExplain !== false,
      recurringMotifState: firstSceneText(original.recurringMotifState) || motifStates[index],
    };

    const titleFallbacks = [
      beatSheet?.act1?.hook,
      beatSheet?.act1?.wrongFirstMove,
      beatSheet?.act2?.complication,
      beatSheet?.act2?.midpointIrreversibleTurn,
      beatSheet?.act3?.closingImage,
    ];
    const consequenceFallbacks = [
      beatSheet?.act1?.firstConsequence,
      beatSheet?.act2?.helperComplicates,
      beatSheet?.act2?.complication,
      visibleDamage,
      finalPayoff.worldResponse || beatSheet?.act3?.closingImage,
    ];
    const endPullFallbacks = [
      beatSheet?.act1?.incitingIncident,
      beatSheet?.act2?.complication,
      beatSheet?.act2?.midpointIrreversibleTurn,
      beatSheet?.act3?.finalChoice,
      beatSheet?.act3?.closingImage,
    ];

    next.titleHint = firstSceneText(original.titleHint, titleFallbacks[index], `Szene ${sceneNo}`);
    next.location = firstSceneText(original.location, input.config.setting, input.selectedIdea?.centralObjectOrPlace, "ein konkreter Spielort");
    next.timePressureOrQuestion = firstSceneText(original.timePressureOrQuestion, beatSheet?.centralQuestion, endPullFallbacks[index]);
    next.visibleGoal = firstSceneText(original.visibleGoal, original.goal, beatSheet?.act1?.incitingIncident, beatSheet?.act3?.finalChoice, `Die Kinder verfolgen ${motif}.`);
    next.emotionalGoal = firstSceneText(original.emotionalGoal, beatSheet?.mainWant, beatSheet?.mainNeed, beatSheet?.emotionalPremise);
    next.obstacle = firstSceneText(original.obstacle, beatSheet?.act2?.helperComplicates, input.selectedIdea?.coreConflict, "Die Regel stellt sich sichtbar quer.");
    next.wrongAction = firstSceneText(original.wrongAction, beatSheet?.act1?.wrongFirstMove, middle.wrongAction, "Die Kinder versuchen zuerst den bequemsten falschen Weg.");
    next.visibleConsequence = firstSceneText(original.visibleConsequence, original.consequence, original.result, original.outcome, original.visibleDamage, original.irreversibleChange, consequenceFallbacks[index]);
    next.irreversibleChange = firstSceneText(original.irreversibleChange, original.changedState, original.turn, original.visibleDamage, index === 0 ? consequenceFallbacks[index] : undefined, index >= 2 ? visibleDamage : consequenceFallbacks[index]);
    next.endPull = firstSceneText(original.endPull, original.chapterEndHook, original.pull, endPullFallbacks[index], "Etwas bleibt offen und zieht sie weiter.");
    next.plant = firstSceneText(original.plant, finalPayoff.plantedDetail, beatSheet?.personalObject, motif);
    next.payoffLater = firstSceneText(original.payoffLater, finalPayoff.closingImage, beatSheet?.act3?.payoffFromPlant, beatSheet?.act3?.closingImage);
    next.characterDriver = firstSceneText(original.characterDriver, index >= 3 ? "shared" : heroA);
    next.adrianAction = firstSceneText(original.adrianAction, original[`${heroA}Action`], `${heroA} handelt sichtbar am Objekt.`);
    next.alexanderAction = firstSceneText(original.alexanderAction, original[`${heroB}Action`], `${heroB} bemerkt die Folge und reagiert.`);
    const helperFunction = firstSceneText(original.helperFunction);
    const helperAction = firstSceneText(original.helperAction);
    next.helperFunction = /(explain|erklaer|erklär|loesung|lösung|reveals|enthuellt|enthüllt|tells the answer|sagt die antwort)/i.test(helperFunction)
      ? "creates pressure"
      : firstSceneText(helperFunction, "creates pressure");
    next.helperAction = /(explain|erklaer|erklär|loesung|lösung|solution|tells them|sagt ihnen)/i.test(helperAction)
      ? "Der Helfer bringt Druck in die Szene und zeigt nur auf ein neues Hindernis."
      : firstSceneText(helperAction, "Der Helfer bringt Druck in die Szene und zeigt nur auf ein neues Hindernis.");

    if (scenePurpose === "irreversible_middle" || index === 2 || index === 3) {
      next.visibleDamage = firstSceneText(original.visibleDamage, visibleDamage, next.visibleConsequence);
      next.personalCost = firstSceneText(original.personalCost, personalCost, `${heroA} und ${heroB} geben einen bequemen Vorteil auf.`);
      next.cannotGoBackReason = firstSceneText(original.cannotGoBackReason, cannotGoBack, "Der alte Zustand ist sichtbar verändert und kann nicht durch Warten zurückkehren.");
      next.emotionalTurn = firstSceneText(original.emotionalTurn, beatSheet?.emotionalPremise, beatSheet?.mainNeed, "Die Kinder merken, was ihr falscher Weg kostet.");
    } else {
      next.visibleDamage = firstSceneText(original.visibleDamage, index > 0 ? next.visibleConsequence : "");
      next.personalCost = firstSceneText(original.personalCost, index > 1 ? personalCost : "");
      next.cannotGoBackReason = firstSceneText(original.cannotGoBackReason, index > 1 ? cannotGoBack : "");
      next.emotionalTurn = firstSceneText(original.emotionalTurn, beatSheet?.emotionalPremise);
    }

    if (index >= Math.max(0, DEV_MODE_SCENE_CARD_COUNT - 2)) {
      next.childDiscovery = firstSceneText(original.childDiscovery, childDiscovery, `${heroA} und ${heroB} erkennen die Verbindung zu ${motif}.`);
    }
    if (index === DEV_MODE_SCENE_CARD_COUNT - 1) {
      next.childDecision = firstSceneText(original.childDecision, childDecision, `${heroA} und ${heroB} führen die finale Handlung selbst aus.`);
    }

    next.dialogueBeats = ensureSceneDialogueBeats(next, input);
    return next;
  });

  const changed = JSON.stringify(repaired) !== JSON.stringify(sceneCards.slice(0, DEV_MODE_SCENE_CARD_COUNT));
  if (changed) fixes.push("filled-missing-scene-card-fields-from-beat-sheet");
  return { sceneCards: repaired, changed, fixes: [...new Set(fixes)] };
}

function validateLoglineEngine(engine: any): string[] {
  const issues: string[] = [];
  for (const key of ["logline", "emotionalPremise", "centralQuestion", "mainWant", "mainNeed", "falseBelief", "wonderRule", "recurringMotif", "personalObject"]) {
    if (!String(engine?.[key] || "").trim()) issues.push(`loglineEngine.${key} missing`);
  }
  return issues;
}

/**
 * Tighter personal-cost contract used in premium runs.
 *
 * Returns issues when the beat-sheet declares a personal cost that does not
 * actually risk a named, child-owned object. The 8.4-score postmortem showed
 * that a generic personalCost ("verliert Kontrolle") passes the legacy
 * length+verb check but produces a finale that pays nothing visible off —
 * this helper closes that loophole before whole-story-draft runs.
 */
function validatePersonalCostContract(beatSheet: any): string[] {
  const issues: string[] = [];
  const personalCost = String(beatSheet?.act2?.personalCost || "");
  if (!personalCost.trim()) return issues;

  const vagueMoodOnly = /(verliert kontrolle|verliert die ?(kontrolle|ubersicht|übersicht|orientierung)|wird ruhig|lernt ruhig|nur innerlich|nur in sich|nur gedanklich|nur emotional|loses control|stays calm|learns calm|inner peace)/i;
  if (vagueMoodOnly.test(personalCost)) {
    issues.push("act2.personalCost is mood/insight only (no tangible object at risk)");
  }

  const personalObject = beatSheet?.personalObject;
  const objectName = (() => {
    if (typeof personalObject === "string") return personalObject.trim();
    if (personalObject && typeof personalObject === "object") return String(personalObject.object || "").trim();
    return "";
  })();
  if (!objectName) {
    issues.push("personalObject.object is empty; personal-cost cannot anchor to anything");
    return issues;
  }

  const folded = (text: string) => text
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ß/g, "ss");
  const stems = (text: string) => folded(text)
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 4)
    .map((w) => w.slice(0, 4));
  const objectStems = new Set(stems(objectName));
  if (objectStems.size === 0) return issues;
  const shareStem = (text: string): boolean => {
    for (const s of stems(text)) {
      if (objectStems.has(s)) return true;
    }
    return false;
  };

  if (!shareStem(personalCost)) {
    issues.push("act2.personalCost does not name the personalObject.object (no shared stem)");
  }

  if (personalObject && typeof personalObject === "object") {
    const risk = String(personalObject.risk || "");
    if (risk && !shareStem(risk)) {
      issues.push("personalObject.risk does not reference personalObject.object");
    }
  }

  const planted = String(beatSheet?.finalPayoff?.plantedDetail || "");
  if (planted && !shareStem(planted)) {
    issues.push("finalPayoff.plantedDetail does not reference personalObject.object (cost is not planted)");
  }

  return issues;
}

function validateBeatSheet(beatSheet: any, input: DevModeGenerationInput): string[] {
  const issues: string[] = [];
  const required = [
    "logline", "emotionalPremise", "centralQuestion", "mainWant", "mainNeed", "falseBelief",
    "wonderRule", "recurringMotif",
  ];
  for (const key of required) {
    if (!String(beatSheet?.[key] || "").trim()) issues.push(`beatSheet.${key} missing`);
  }
  // v12 §H: personalObject was a string in the legacy schema, now a structured
  // sub-object. Accept either shape here — the additive validator below
  // checks the sub-object's leaves and adds mode-aware hard gates.
  const personalObject = beatSheet?.personalObject;
  const hasLegacyString = typeof personalObject === "string" && personalObject.trim().length > 0;
  const hasStructured = typeof personalObject === "object" && personalObject !== null;
  if (!hasLegacyString && !hasStructured) {
    issues.push("beatSheet.personalObject missing");
  }
  const midpoint = String(beatSheet?.act2?.midpointIrreversibleTurn || "");
  if (!/(verlier|verloren|lost|lose|cannot|kann nicht|kein|keinen|keine|niemals|nie mehr|nicht mehr|endgueltig|endgültig|fuer immer|für immer|zerbr|zerbrich|zerbrochen|kaputt|broken|break|schrump|shrink|verschwind|gone|fort|weg|closed|verschlossen|locked|eingesperrt|gefangen|revealed|enthuellt|enthüllt|risk|risiko|cost|preis|opfer|sacrifice|aufgeben|muss|verlassen|geht verloren|abgeschnitten|verbrannt|ruiniert|kein zurück|kein zurueck|irreversible|irreversibel|unwiederbringlich|stirbt|tot|gestorben|verlischt|erlischt|verstummt)/i.test(midpoint)) {
    issues.push("midpointIrreversibleTurn is not visibly irreversible");
  }
  const personalCost = String(beatSheet?.act2?.personalCost || "");
  if (personalCost.length < 18 || /(learns|lernt|understands|erkennt)\b/i.test(personalCost)) {
    issues.push("personalCost is not concrete enough");
  }
  // Tighter personal-cost contract (premium): personalCost must name the
  // child-owned object (or share a stem with it), must not collapse into a
  // vague mood-only loss ("verliert Kontrolle", "wird ruhig"), and the
  // personalObject.risk / finalPayoff.plantedDetail must reference the same
  // named object so the cost is planted and paid off — not just asserted.
  if ((input.qualityMode || "premium") === "premium") {
    issues.push(...validatePersonalCostContract(beatSheet));
  }
  const helper = String(beatSheet?.act2?.helperComplicates || "");
  if (/(explain|erklaer|erklär|loesung|lösung|solution|tells them|sagt ihnen)/i.test(helper)) {
    issues.push("helperComplicates looks like helperExplains");
  }
  const finalChoice = String(beatSheet?.act3?.finalChoice || "");
  const heroNames = (input.avatars || []).map((a) => a.name).filter(Boolean);
  const heroSubjectHint = /(child|children|kid|kids|kinder|jungen|junge|maedchen|mädchen|freunde|freundinnen|geschwister|beide|die zwei|die zwoo|sie zusammen|gemeinsam|zusammen entscheid|together they|both of them|the two)/i.test(finalChoice);
  const namedHero = heroNames.some((name) => finalChoice.toLowerCase().includes(name.toLowerCase()));
  if (!heroSubjectHint && !namedHero) {
    issues.push("finalChoice is not clearly executed by the children");
  }
  const closingImage = String(beatSheet?.act3?.closingImage || "");
  if (/(learn|lesson|moral|lernten|lehre|wahre magie|friendship is)/i.test(closingImage)) {
    issues.push("closingImage explains a moral instead of leaving an image");
  }
  // v12 §H additive gates — structured sub-objects checked separately so the
  // legacy gates above keep their existing behavior in efficient mode. Reuse
  // the heroNames already computed for the legacy finalChoice check.
  issues.push(...validateBeatSheetSpecH(beatSheet, input.qualityMode, heroNames));
  return issues;
}

function repairBeatSheetDeterministically(
  beatSheet: any,
  input: DevModeGenerationInput,
  issues: string[]
): any {
  if (!beatSheet || typeof beatSheet !== "object") return beatSheet;
  if (!issues.some((issue) => /closingImage explains a moral/i.test(issue))) return beatSheet;

  const heroNames = (input.avatars || []).map((avatar) => avatar.name).filter(Boolean);
  const heroA = heroNames[0] || "Die Kinder";
  const heroB = heroNames[1] || "das zweite Kind";
  const artifactName = String(input.matchedArtifact?.name || "").trim();
  const motif = String(beatSheet?.recurringMotif || artifactName || "das kleine Zeichen").trim();
  const object = String(beatSheet?.personalObject || artifactName || motif).trim();
  const helper = String((input.selectedIdea as any)?.selectedSupportingCast?.[0] || "").trim();
  const helperClause = helper ? `, waehrend ${helper} daneben einen letzten, leisen Handgriff macht` : "";

  return {
    ...beatSheet,
    act3: {
      ...(beatSheet.act3 || {}),
      closingImage: `${heroA} und ${heroB} stellen ${object} ans Fenster; ${motif} bewegt sich noch einmal im Licht${helperClause}.`,
    },
  };
}

function isNegated(text: string, word: string): boolean {
  const negators = /\b(nicht|kein|keine|keinen|keines|keineswegs|nie|kaum|alles andere als|not|never|no|hardly|scarcely|barely)\b/i;
  const wordRegex = new RegExp(`\\b${word}\\b`, 'i');
  
  const match = text.match(wordRegex);
  if (!match) return false;
  
  const wordIndex = match.index ?? 0;
  const prefix = text.substring(0, wordIndex);
  
  const lastNegatorMatch = [...prefix.matchAll(new RegExp(negators, 'gi'))].pop();
  if (lastNegatorMatch) {
    const negatorIndex = lastNegatorMatch.index ?? 0;
    const distance = wordIndex - (negatorIndex + lastNegatorMatch[0].length);
    if (distance < 30) {
      return true;
    }
  }
  return false;
}

function validateSceneCards(sceneCards: any[], mode?: DevModeQualityMode): string[] {
  const issues: string[] = [];
  if (sceneCards.length !== DEV_MODE_SCENE_CARD_COUNT) {
    issues.push(`expected ${DEV_MODE_SCENE_CARD_COUNT} scene cards, got ${sceneCards.length}`);
  }
  const purposes = ["hook", "false_attempt", "complication", "irreversible_middle", "final_payoff"];
  // v12 §I: bump dialogue-beat floor from 3 to 4 in premium; efficient keeps
  // the looser legacy minimum so it does not stall the repair loop on every
  // narrowly-three-beat card.
  const isPremium = (mode || "premium") === "premium";
  const minBeats = isPremium ? 4 : 3;
  sceneCards.forEach((card, index) => {
    const n = Number(card?.scene || index + 1);
    if (card?.scenePurpose !== purposes[index]) issues.push(`scene ${n} purpose should be ${purposes[index]}`);
    for (const key of ["visibleGoal", "obstacle", "visibleConsequence", "endPull"]) {
      if (!String(card?.[key] || "").trim()) issues.push(`scene ${n}.${key} missing`);
    }
    if (!String(card?.irreversibleChange || "").trim() && index > 0) {
      issues.push(`scene ${n}.irreversibleChange missing`);
    }
    if (!Array.isArray(card?.dialogueBeats) || card.dialogueBeats.length < minBeats) {
      issues.push(`scene ${n} has fewer than ${minBeats} dialogue beats`);
    }
    if (index < sceneCards.length - 1) {
      const endPullVal = String(card?.endPull || "").trim().toLowerCase();
      let isTooClosed = false;
      
      // 1. English exact words (calm, peaceful, closed, resolved)
      if (/\b(calm|peaceful|closed|resolved)\b/i.test(endPullVal)) {
        if (!["calm", "peaceful", "closed", "resolved"].some(w => isNegated(endPullVal, w))) {
          isTooClosed = true;
        }
      }
      // 2. German "alles gut" or "gelöst"
      if (!isTooClosed && /\b(alles gut|gelöst)\b/i.test(endPullVal)) {
        if (!["alles gut", "gelöst"].some(w => isNegated(endPullVal, w))) {
          isTooClosed = true;
        }
      }
      // 3. German "ruhig"
      if (!isTooClosed && /\bruhig\b/i.test(endPullVal)) {
        if (!/\bunruhig\b/i.test(endPullVal) && !isNegated(endPullVal, "ruhig")) {
          isTooClosed = true;
        }
      }
      // 4. German "fertig"
      if (!isTooClosed && /\bfertig\b/i.test(endPullVal)) {
        const isExcludedFertig = 
          /\bunfertig\b/i.test(endPullVal) ||
          /\bfertig\s+(für|zum|mit\s+den\s+nerven)\b/i.test(endPullVal) ||
          /\bmach(e|t|en|te|ten)?\s+fertig\b/i.test(endPullVal) ||
          isNegated(endPullVal, "fertig");
        if (!isExcludedFertig) {
          isTooClosed = true;
        }
      }
      
      if (isTooClosed) {
        issues.push(`scene ${n} endPull is too closed`);
      }
    }
    if (/(explain|erklaer|erklär|loesung|lösung|solution|tells them|sagt ihnen)/i.test(String(card?.helperAction || ""))) {
      issues.push(`scene ${n} helperAction explains the solution`);
    }
  });
  const irreversibleMiddle = sceneCards.slice(2, 4).some((card) =>
    String(card?.irreversibleChange || "").trim().length > 0 && String(card?.personalCost || "").trim().length > 0
  );
  if (!irreversibleMiddle) issues.push("scene 3 or 4 must contain irreversibleChange plus personalCost");
  // Abstract-cost gate: a personalCost that names only a feeling ("verliert
  // Zuversicht", "muss Scham überwinden") produces a story with no visible
  // sacrifice — the premium release gate then fails on personalCost AFTER the
  // expensive prose stages (log 0e8c0a4e). Catch it here where repair is cheap.
  if (isPremium) {
    const abstractCost = /(?:verlier\w*|verlor\w*|(?:ue|ü)berwind\w*|gewinn\w*|fass\w*|find\w*)\s+(?:seine[nrs]?\s+|ihre[nrs]?\s+|den\s+|die\s+|das\s+)?(?:zuversicht|scham|angst|mut|vertrauen|hoffnung|geduld|selbstvertrauen|sicherheit|stolz|freude|ruhe|confidence|courage|hope|shame|fear|trust)\b/i;
    sceneCards.slice(2, 4).forEach((card, idx) => {
      const cost = String(card?.personalCost || "").trim();
      if (cost && abstractCost.test(cost)) {
        issues.push(
          `scene ${idx + 3} personalCost is an abstract feeling ("${cost.slice(0, 60)}") — it must name a physical object, place, or privilege that is visibly given up, used up, broken, or left behind`
        );
      }
    });
  }
  // v12 §I additive gates.
  issues.push(...validateSceneCardsSpecI(sceneCards, mode));
  return issues;
}

function normalizeDialoguePlan(parsed: any): any {
  const sceneDialogue = Array.isArray(parsed?.sceneDialogue)
    ? parsed.sceneDialogue
    : Array.isArray(parsed?.scenes)
      ? parsed.scenes
      : [];
  return { sceneDialogue };
}

function validateDialoguePlan(dialoguePlan: any): string[] {
  const issues: string[] = [];
  const scenes = Array.isArray(dialoguePlan?.sceneDialogue) ? dialoguePlan.sceneDialogue : [];
  if (scenes.length !== DEV_MODE_SCENE_CARD_COUNT) {
    issues.push(`dialogue intent expected ${DEV_MODE_SCENE_CARD_COUNT} scenes, got ${scenes.length}`);
  }
  for (let index = 0; index < DEV_MODE_SCENE_CARD_COUNT; index += 1) {
    const scene = scenes.find((s: any) => Number(s?.scene) === index + 1) || scenes[index];
    const beats = Array.isArray(scene?.dialogueBeats) ? scene.dialogueBeats : [];
    if (beats.length < 4) issues.push(`scene ${index + 1} needs at least 4 dialogue intent beats`);
  }
  return issues;
}

function padDialoguePlanFromSceneCards(dialoguePlan: any, sceneCards: any[]): any {
  const minBeats = 4;
  const planScenes: any[] = Array.isArray(dialoguePlan?.sceneDialogue) ? dialoguePlan.sceneDialogue : [];
  const fallbackIntents = ["want", "resist", "observe", "decide", "challenge", "hide fear"];
  const sceneDialogue: any[] = [];
  for (let index = 0; index < DEV_MODE_SCENE_CARD_COUNT; index += 1) {
    const sceneNumber = index + 1;
    const planScene = planScenes.find((s) => Number(s?.scene) === sceneNumber) || planScenes[index] || {};
    const card = sceneCards.find((c) => Number(c?.scene) === sceneNumber) || sceneCards[index] || {};
    const planBeats: any[] = Array.isArray(planScene?.dialogueBeats) ? planScene.dialogueBeats.filter(Boolean) : [];
    const cardBeats: any[] = Array.isArray(card?.dialogueBeats) ? card.dialogueBeats.filter(Boolean) : [];
    const beats: any[] = [...planBeats];
    for (const candidate of cardBeats) {
      if (beats.length >= minBeats) break;
      const speaker = String(candidate?.speaker || "").trim();
      const intent = String(candidate?.intent || "").trim();
      if (!speaker || !intent) continue;
      const alreadyIn = beats.some((b) =>
        String(b?.speaker || "").trim() === speaker &&
        String(b?.intent || "").trim() === intent &&
        String(b?.subtext || "").trim() === String(candidate?.subtext || "").trim()
      );
      if (alreadyIn) continue;
      beats.push({
        speaker,
        intent,
        subtext: String(candidate?.subtext || "").trim() || "implied tension",
        draftStyle: String(candidate?.draftStyle || "").trim() || "short, in-character line with body action",
      });
    }
    let intentCursor = 0;
    while (beats.length < minBeats) {
      const lastSpeaker = beats.length > 0 ? String(beats[beats.length - 1]?.speaker || "") : "";
      const cardSpeakerPool = cardBeats.map((b) => String(b?.speaker || "").trim()).filter(Boolean);
      const fallbackSpeaker = cardSpeakerPool.find((s) => s && s !== lastSpeaker) || cardSpeakerPool[0] || "main child";
      const intent = fallbackIntents[intentCursor % fallbackIntents.length];
      intentCursor += 1;
      beats.push({
        speaker: fallbackSpeaker,
        intent,
        subtext: "carries action, relationship, or tension",
        draftStyle: "short, in-character line with body action",
      });
    }
    sceneDialogue.push({ scene: sceneNumber, dialogueBeats: beats });
  }
  return { sceneDialogue };
}

function mergeDialoguePlanIntoSceneCards(sceneCards: any[], dialoguePlan: any): any[] {
  const scenes = Array.isArray(dialoguePlan?.sceneDialogue) ? dialoguePlan.sceneDialogue : [];
  return sceneCards.map((card, index) => {
    const scene = scenes.find((s: any) => Number(s?.scene) === Number(card.scene)) || scenes[index];
    return {
      ...card,
      dialogueBeats: Array.isArray(scene?.dialogueBeats) && scene.dialogueBeats.length > 0
        ? scene.dialogueBeats
        : card.dialogueBeats,
    };
  });
}

function buildBlueprintFromScreenplayPlan(
  input: DevModeGenerationInput,
  loglineEngine: any,
  beatSheet: any,
  sceneCards: any[],
  dialoguePlan: any
): any {
  const selectedIdea = input.selectedIdea;
  const heroNames = (input.avatars || []).map((avatar) => avatar.name).filter(Boolean);
  const personalObjectDetails = extractPersonalObjectDetails(beatSheet?.personalObject, loglineEngine?.personalObject);
  return {
    premise: beatSheet?.logline || loglineEngine?.logline || selectedIdea?.oneLineHook || "",
    storySpine: {
      childWish: beatSheet?.mainWant || loglineEngine?.mainWant,
      triggerMistake: beatSheet?.act1?.wrongFirstMove,
      magicRule: beatSheet?.wonderRule || loglineEngine?.wonderRule,
      escalation: beatSheet?.act2?.complication,
      falseSolution: beatSheet?.act1?.wrongFirstMove,
      smallSacrifice: beatSheet?.act2?.personalCost,
      finalImage: beatSheet?.act3?.closingImage,
    },
    noveltySignature: {
      oneLineShelfPitch: selectedIdea?.oneLineHook,
      whyDifferentFromRecent: selectedIdea?.whyDifferentFromRecent,
      rejectedFamiliarPremises: [],
    },
    keyMoments: sceneCards.map((card) => ({
      order: card.scene,
      emotionalExperience: card.emotionalGoal,
      sceneFunction: card.scenePurpose,
      irreversibleChange: card.irreversibleChange,
    })),
    causalChain: sceneCards.map((card) => `Scene ${card.scene}: ${card.visibleGoal} -> ${card.obstacle} -> ${card.visibleConsequence} -> ${card.endPull}`),
    emotionalEngine: {
      storyPromise: beatSheet?.emotionalPremise || loglineEngine?.emotionalPremise,
      childRelatableNeed: beatSheet?.mainNeed || loglineEngine?.mainNeed,
      relationshipDynamic: heroNames.join(" + "),
      antagonistHumanity: "",
      endingImage: beatSheet?.act3?.closingImage,
    },
    readerMagnet: {
      refrainLine: "",
      iconicMotif: beatSheet?.recurringMotif || loglineEngine?.recurringMotif,
      callbackLadder: sceneCards.map((card) => card.plant).filter(Boolean),
      activeUseByChapter: sceneCards.map((card) => card.payoffLater || card.plant).filter(Boolean),
      rereadRewards: sceneCards.map((card) => card.plant).filter(Boolean).slice(0, 4),
      nextStorySpark: beatSheet?.act3?.closingImage,
    },
    payoffEngine: {
      personalObject: personalObjectDetails.object || personalObjectDetails.text,
      whyItMatters: personalObjectDetails.whyPersonal || beatSheet?.emotionalPremise || loglineEngine?.emotionalPremise,
      whatItCostsToShare: personalObjectDetails.risk || beatSheet?.act2?.personalCost,
      wrongAttempt: beatSheet?.act1?.wrongFirstMove,
      finalChoice: personalObjectDetails.payoff || beatSheet?.act3?.finalChoice,
      personalObjectDetails: compactPersonalObjectForPrompt(beatSheet?.personalObject, loglineEngine?.personalObject, 260),
    },
    antagonistChangeLadder: {
      wantsToPossess: beatSheet?.act2?.complication,
      confusion: beatSheet?.act2?.helperComplicates,
      relapse: sceneCards[3]?.wrongAction,
      decision: beatSheet?.act3?.finalChoice,
      newRole: beatSheet?.act3?.closingImage,
    },
    humorCallbackPlan: {
      recurringGag: sceneCards.map((card) => card.dialogueBeats?.find?.((beat: any) => /joke/i.test(String(beat?.intent || "")))?.subtext).find(Boolean) || "",
      escalationByChapter: sceneCards.map((card) => card.titleHint).filter(Boolean),
    },
    coreMagicRule: beatSheet?.wonderRule || loglineEngine?.wonderRule,
    characterArcs: heroNames.map((name) => ({
      name,
      startingFriction: beatSheet?.falseBelief || loglineEngine?.falseBelief,
      strength: "acts visibly from their own voice and trait profile",
      finalContribution: beatSheet?.act3?.finalChoice,
    })),
    supportingCastUse: (input.selectedIdea?.selectedSupportingCast || []).map((name) => ({
      name,
      storyFunction: beatSheet?.act2?.helperComplicates || "complicates the children's plan",
      mustDo: "complicate, fail, ask, pressure, or provide a prop; never explain the solution",
    })),
    plantsAndPayoffs: sceneCards.map((card) => ({ plant: card.plant, payoff: card.payoffLater })).filter((item) => item.plant || item.payoff),
    sceneOwnership: sceneCards.map((card) => ({ order: card.scene, driver: card.characterDriver, changedState: card.irreversibleChange || card.visibleConsequence })),
    chapterPlan: sceneCards.map((card) => ({
      order: card.scene,
      title: card.titleHint,
      goal: card.visibleGoal,
      hook: card.timePressureOrQuestion,
      sceneBeats: [
        card.visibleGoal,
        card.obstacle,
        card.wrongAction,
        card.visibleConsequence,
        card.endPull,
      ].filter(Boolean),
      obstacle: card.obstacle,
      conflict: card.timePressureOrQuestion,
      wrongAction: card.wrongAction,
      turn: card.visibleConsequence,
      irreversibleChange: card.irreversibleChange,
      endingTension: card.endPull,
      chapterEndHook: card.endPull,
      kidQuestion: card.timePressureOrQuestion,
      humorMoment: card.dialogueBeats?.find?.((beat: any) => /joke/i.test(String(beat?.intent || "")))?.subtext || "",
      emotionalBeat: card.emotionalGoal,
      characterActions: { adrianAction: card.adrianAction, alexanderAction: card.alexanderAction, helperAction: card.helperAction },
      preparedDetail: card.plant,
      laterPayoff: card.payoffLater,
      dialogueFunction: Array.isArray(card.dialogueBeats)
        ? card.dialogueBeats.map((beat: any) => `${beat.speaker}: ${beat.intent} (${beat.subtext})`).join(" | ")
        : "",
      callbackToUse: beatSheet?.recurringMotif || loglineEngine?.recurringMotif,
    })),
    dialoguePlan,
    forbiddenShortcuts: [
      "helper explains the solution",
      "prose before scene cards pass",
      "moral-summary ending",
      "dialogue filler to satisfy quota",
    ],
  };
}

function compactScreenplayPlanForDraft(plan?: DevModeScreenplayPlan): any {
  if (!plan) return null;
  const sceneCards = (plan.sceneCards || []).slice(0, DEV_MODE_SCENE_CARD_COUNT);
  return {
    storyCore: {
      logline: compactExcerpt(plan.loglineEngine?.logline || "", 220),
      centralQuestion: compactExcerpt(plan.loglineEngine?.centralQuestion || "", 180),
      wonderRule: compactExcerpt(plan.loglineEngine?.wonderRule || plan.beatSheet?.wonderRule || "", 220),
      recurringMotif: compactExcerpt(plan.loglineEngine?.recurringMotif || plan.beatSheet?.recurringMotif || "", 140),
      personalObject: compactPersonalObjectForPrompt(plan.beatSheet?.personalObject, plan.loglineEngine?.personalObject, 180),
      emotionalPremise: compactExcerpt(plan.loglineEngine?.emotionalPremise || "", 200),
    },
    actPath: {
      hook: compactExcerpt(plan.beatSheet?.act1?.hook || "", 180),
      wrongFirstMove: compactExcerpt(plan.beatSheet?.act1?.wrongFirstMove || "", 180),
      firstConsequence: compactExcerpt(plan.beatSheet?.act1?.firstConsequence || "", 180),
      helperComplicates: compactExcerpt(plan.beatSheet?.act2?.helperComplicates || "", 180),
      midpointIrreversibleTurn: compactExcerpt(plan.beatSheet?.act2?.midpointIrreversibleTurn || "", 180),
      personalCost: compactExcerpt(plan.beatSheet?.act2?.personalCost || "", 180),
      recognition: compactExcerpt(plan.beatSheet?.act3?.recognition || "", 180),
      finalChoice: compactExcerpt(plan.beatSheet?.act3?.finalChoice || "", 180),
      payoffFromPlant: compactExcerpt(plan.beatSheet?.act3?.payoffFromPlant || "", 180),
      closingImage: compactExcerpt(plan.beatSheet?.act3?.closingImage || "", 180),
    },
    sceneCards: sceneCards.map((card: any) => ({
      scene: card.scene,
      purpose: card.scenePurpose,
      location: compactExcerpt(card.location || "", 90),
      goal: compactExcerpt(card.visibleGoal || "", 110),
      obstacle: compactExcerpt(card.obstacle || "", 110),
      wrongAction: compactExcerpt(card.wrongAction || "", 110),
      consequence: compactExcerpt(card.visibleConsequence || "", 120),
      irreversibleChange: compactExcerpt(card.irreversibleChange || "", 120),
      personalCost: compactExcerpt(card.personalCost || "", 120),
      driver: compactExcerpt(card.characterDriver || "", 40),
      castMoves: [
        compactExcerpt(card.adrianAction || "", 90),
        compactExcerpt(card.alexanderAction || "", 90),
        compactExcerpt(card.helperAction || "", 90),
      ].filter(Boolean),
      dialogueBeats: Array.isArray(card.dialogueBeats)
        ? card.dialogueBeats.slice(0, 6).map((beat: any) => ({
            speaker: beat?.speaker,
            intent: compactExcerpt(beat?.intent || "", 40),
            subtext: compactExcerpt(beat?.subtext || "", 80),
            draftStyle: beat?.draftStyle ? compactExcerpt(beat.draftStyle, 60) : undefined,
            actionCarried: beat?.actionCarried ? compactExcerpt(beat.actionCarried, 60) : undefined,
          }))
        : [],
      plant: compactExcerpt(card.plant || "", 90),
      payoffLater: compactExcerpt(card.payoffLater || "", 90),
      endPull: compactExcerpt(card.endPull || "", 110),
    })),
  };
}

function buildCompactStoryBibleForDraft(
  input: DevModeGenerationInput,
  chapterCount: number
): any {
  return {
    outputLanguage: localizedLanguageName(input.config.language),
    ageGroup: input.config.ageGroup,
    displayChapterCount: chapterCount,
    genre: input.config.genre,
    setting: input.config.setting,
    selectedIdea: input.selectedIdea ? {
      title: input.selectedIdea.title,
      hook: input.selectedIdea.oneLineHook,
      centralObjectOrPlace: input.selectedIdea.centralObjectOrPlace,
      wonderRule: input.selectedIdea.wonderRule,
      emotionalEngine: input.selectedIdea.emotionalEngine,
      premiseSeedId: input.selectedIdea.premiseSeedId,
      premiseSeedMutation: input.selectedIdea.premiseSeedMutation,
      selectedSupportingCast: input.selectedIdea.selectedSupportingCast,
    } : undefined,
    mainCharacters: (input.avatars || []).map((avatar) => ({
      name: avatar.name,
      age: avatar.age,
      description: compactExcerpt(avatar.description || "", 110),
      traitSignals: summarizeDramaturgicTraitProfile(avatar.name, avatar.personalityTraits)
        .slice(0, 2)
        .map((signal) => compactExcerpt(signal, 120)),
    })),
    supportingCast: (input.poolCharacters || [])
      .filter((character) => (input.selectedIdea?.selectedSupportingCast || []).includes(character.name))
      .map((character) => ({
        name: character.name,
        role: character.role,
        archetype: character.archetype || undefined,
        speechStyle: character.speechStyle?.slice(0, 3),
        catchphrase: character.catchphrase ? compactExcerpt(character.catchphrase, 80) : undefined,
        catchphraseContext: character.catchphraseContext ? compactExcerpt(character.catchphraseContext, 60) : undefined,
        dominantTrait: poolCharacterDominant(character),
        emotionalTriggers: poolCharacterTriggers(character, 2),
        quirk: compactExcerpt(character.quirk || "", 90),
        rule: "may complicate, fail, ask, pressure, or provide an object; never explain the answer",
      })),
    centralObjectContract: getLockedCentralObject(input) ? {
      lockedCentralObjectOrPlace: getLockedCentralObject(input),
      rule: "personalObject, recurringMotif, visibleDamage, and finalPayoff must grow from this object/place; do not substitute background props",
    } : undefined,
    artifact: shouldExposeDevModeArtifact(input) && input.matchedArtifact ? {
      name: input.matchedArtifact.name,
      storyRole: compactExcerpt(input.matchedArtifact.storyRole, 110),
      visualKeywords: input.matchedArtifact.visualKeywords?.slice(0, 4),
    } : undefined,
    titleContract: input.selectedIdea?.title ? {
      title: input.selectedIdea.title,
      exactWordsToRedeem: extractTitleContentWords(input.selectedIdea.title).slice(0, 4),
    } : undefined,
  };
}

function buildCompactPromptStory(
  story: DevModeRawStory,
  options: { includeReadingBreaks?: boolean; maxChapterContentChars?: number } = {}
): any {
  const compactChapterContent = (content: string): string => {
    const max = options.maxChapterContentChars;
    if (!max || content.length <= max) return content;
    const headSize = Math.max(300, Math.floor(max * 0.58));
    const tailSize = Math.max(220, max - headSize - 80);
    return [
      content.slice(0, headSize).trim(),
      "[middle omitted in prompt; preserve continuity from current story]",
      content.slice(Math.max(0, content.length - tailSize)).trim(),
    ].join("\n");
  };
  return {
    title: story.title,
    description: story.description,
    displayMode: story.displayMode,
    chapters: (story.chapters || [])
      .map((chapter) => ({
        order: chapter.order,
        title: chapter.title,
        content: compactChapterContent(chapter.content),
      }))
      .sort((a, b) => a.order - b.order),
    readingBreaks: options.includeReadingBreaks && Array.isArray(story.readingBreaks)
      ? story.readingBreaks.map((item) => ({
          afterParagraph: item.afterParagraph,
          imagePromptScene: item.imagePromptScene,
          scenePurpose: item.scenePurpose,
        }))
      : undefined,
  };
}

function compactReviewedBlueprintForRepair(reviewedBlueprint: any, chapterCount: number): any {
  const compact = compactReviewedBlueprintForDraft(reviewedBlueprint, chapterCount);
  return {
    premise: compact.premise,
    storySpine: compact.storySpine
      ? {
          childWish: compactExcerpt(compact.storySpine.childWish || "", 120),
          triggerMistake: compactExcerpt(compact.storySpine.triggerMistake || "", 120),
          magicRule: compactExcerpt(compact.storySpine.magicRule || "", 140),
          falseSolution: compactExcerpt(compact.storySpine.falseSolution || "", 120),
          smallSacrifice: compactExcerpt(compact.storySpine.smallSacrifice || "", 120),
          finalImage: compactExcerpt(compact.storySpine.finalImage || "", 140),
        }
      : undefined,
    readerMagnet: compact.readerMagnet
      ? {
          refrainLine: compactExcerpt(compact.readerMagnet.refrainLine || "", 90),
          iconicMotif: compactExcerpt(compact.readerMagnet.iconicMotif || "", 90),
          callbackLadder: Array.isArray(compact.readerMagnet.callbackLadder)
            ? compact.readerMagnet.callbackLadder.slice(0, chapterCount).map((item: any) => compactExcerpt(item, 90))
            : [],
        }
      : undefined,
    payoffEngine: compact.payoffEngine
      ? {
          personalObject: compactPersonalObjectForPrompt(compact.payoffEngine.personalObjectDetails, compact.payoffEngine.personalObject, 120),
          whyItMatters: compactExcerpt(compact.payoffEngine.whyItMatters || "", 120),
          whatItCostsToShare: compactExcerpt(compact.payoffEngine.whatItCostsToShare || "", 120),
          wrongAttempt: compactExcerpt(compact.payoffEngine.wrongAttempt || "", 120),
          finalChoice: compactExcerpt(compact.payoffEngine.finalChoice || "", 120),
        }
      : undefined,
    characterArcs: Array.isArray(compact.characterArcs)
      ? compact.characterArcs.map((arc: any) => ({
          name: arc?.name,
          startingFriction: compactExcerpt(arc?.startingFriction || "", 110),
          strength: compactExcerpt(arc?.strength || "", 110),
          finalContribution: compactExcerpt(arc?.finalContribution || "", 110),
        }))
      : [],
    supportingCastUse: Array.isArray(compact.supportingCastUse)
      ? compact.supportingCastUse
      : [],
    chapterPlan: Array.isArray(compact.chapterPlan)
      ? compact.chapterPlan.map((plan: any) => ({
          order: plan.order,
          title: plan.title,
          goal: compactExcerpt(plan.goal || "", 90),
          wrongAction: compactExcerpt(plan.wrongAction || "", 90),
          irreversibleChange: compactExcerpt(plan.irreversibleChange || "", 110),
          chapterEndHook: compactExcerpt(plan.chapterEndHook || "", 100),
          preparedDetail: compactExcerpt(plan.preparedDetail || "", 90),
          laterPayoff: compactExcerpt(plan.laterPayoff || "", 90),
          dialogueFunction: compactExcerpt(plan.dialogueFunction || "", 110),
        }))
      : [],
  };
}

function buildCompactValidationNoveltyBlock(input: DevModeGenerationInput): string {
  const brief = input.noveltyBrief;
  if (!brief) return "No novelty brief available.";
  const trueHardAvoid = brief.hardAvoidMotifs
    .filter((motif) => !NOVELTY_STOPWORDS.has(normalizeNoveltyText(motif)))
    .filter(isHardBanMotif)
    .slice(0, 14);
  const softMotifHints = brief.hardAvoidMotifs
    .filter((motif) => !NOVELTY_STOPWORDS.has(normalizeNoveltyText(motif)))
    .filter((motif) => !isHardBanMotif(motif))
    .slice(0, 14);
  const recent = brief.recentStories
    .slice(0, 6)
    .map((story, index) => `${index + 1}. ${story.title}${story.motifKeywords?.length ? ` motifs: ${story.motifKeywords.slice(0, 4).join(", ")}` : ""}`);
  const lines = [
    "NOVELTY CHECK BRIEF:",
    `- Shelf promise: ${compactExcerpt(brief.shelfPromise, 140)}`,
    `- Creative lane: ${compactExcerpt(brief.creativeLane, 120)}`,
    `- Emotional engine: ${compactExcerpt(brief.emotionalEngine, 120)}`,
    `- Wonder mechanic: ${compactExcerpt(brief.wonderMechanic, 120)}`,
    trueHardAvoid.length > 0
      ? `- True hard-ban motifs (score cap applies if load-bearing or repeated): ${trueHardAvoid.join(", ")}`
      : null,
    softMotifHints.length > 0
      ? `- Recent-story soft motif hints (do NOT cap for one generic incidental word; only flag title/premise/magic-rule collisions): ${softMotifHints.join(", ")}`
      : null,
    recent.length > 0 ? "Recent stories to avoid:" : null,
    ...recent,
  ];
  return lines.filter((line): line is string => Boolean(line)).join("\n");
}

function buildCompactValidationIdeaBlock(input: DevModeGenerationInput): string {
  const idea = input.selectedIdea;
  if (!idea) return "No explicit winning-idea block available.";
  return [
    "LOCKED IDEA SUMMARY:",
    `- Title: ${idea.title}`,
    `- Hook: ${compactExcerpt(idea.oneLineHook, 180)}`,
    `- Central object/place: ${compactExcerpt(idea.centralObjectOrPlace, 120)}`,
    `- Wonder rule: ${compactExcerpt(idea.wonderRule, 160)}`,
    `- Emotional engine: ${compactExcerpt(idea.emotionalEngine, 160)}`,
    `- Core conflict: ${compactExcerpt(idea.coreConflict, 160)}`,
    idea.premiseSeedId ? `- Premise seed: ${idea.premiseSeedId}` : null,
    idea.premiseSeedMutation ? `- Premise seed mutation: ${compactExcerpt(idea.premiseSeedMutation, 180)}` : null,
    idea.selectedSupportingCast.length > 0
      ? `- Locked supporting cast: ${idea.selectedSupportingCast.join(", ")}. Use ONLY the heroes plus these exact named characters. Do NOT introduce any other named side character (no character from a different idea, no invented friend). Every non-hero who speaks or acts must be one of the locked names.`
      : "- No pool character is mandatory for this idea. Do NOT invent a named side character; keep the cast to the heroes (plus a nameless, non-speaking background figure only if a scene truly needs one).",
  ].filter((line): line is string => Boolean(line)).join("\n");
}

function screenplayCritiqueForDraft(gateIssues: string[]): any {
  return {
    score: gateIssues.length === 0 ? 9.1 : 8.0,
    marketGap: gateIssues.length === 0
      ? "Screenplay gates passed before prose."
      : "Screenplay gates needed repair before prose.",
    mustFix: gateIssues,
    draftInstructions: [
      "Follow the beat sheet and scene cards exactly; do not invent a new plot.",
      "Use dialogue beats as action-bearing exchanges, not filler.",
      "Scene 3 or 4 must land the irreversible middle and concrete personal cost on the page.",
      "The final choice comes from the children and pays off an early plant.",
      "End on a closing image, not a moral sentence.",
    ],
    chapterRisks: [],
    revisedBlueprintPatch: {},
  };
}

// ---------------------------------------------------------------------------
// SCREENPLAY-FIRST / WHOLE-STORY-DRAFT PIPELINE (v12)
//
// The story model writes ONE continuous narrative as flat paragraphs[].
// The server then creates technical reading breaks for app pages and images.
// No model is asked to invent chapter titles or mini-endings.
//
// Output of the writer (whole-story-draft):
//   JSON-capable models: { "title": string, "description": string, "paragraphs": string[] }
//   Text-compat OpenRouter models: TITLE/DESCRIPTION/STORY plain text
//
// Internal display projection:
//   { storyText, readingBreaks, chapters[] as reading pages }
// ---------------------------------------------------------------------------

/**
 * v12 §10 — Compact whole-story-draft prompt builder.
 *
 * The legacy `buildWholeStoryDraftPrompts()` produces a ~27 000-character
 * userPrompt because it bundles the voice bible, blueprint, critique,
 * screenplay plan, novelty brief, dialog rules and structural arc into a
 * single message. Prompt.txt §9 caps `whole-story-draft userPrompt` at
 * 10 000 characters; §10 specifies the new short shape.
 *
 * This compact variant strips everything that is already locked into the
 * screenplay plan (scene cards, beat sheet, dialogue intent) and feeds the
 * model only:
 *   - the compact story bible (≤ 2 k)
 *   - the compact scene cards (≤ 2 k)
 *   - the binding writer contract (≤ 1 k)
 *   - the JSON output shape (≤ 0.5 k)
 *
 * Total target: under 7 000 characters. The legacy builder is kept for
 * backward compatibility and for the case where no screenplay plan is
 * available (which would leave this compact variant without anchors).
 */
// Step 4 — Read-aloud sound craft. Real picture books and early readers live
// on SOUND: alliteration, rhythm, onomatopoeia, refrains. The draft prompts
// addressed rhythm but never sound-level craft, so read-aloud sparkle was left
// to chance. Appended to BOTH whole-story-draft builders.
function buildReadAloudSoundBlock(languageName: string): string {
  return [
    "KLANG & VORLESE-MELODIE (read-aloud sound craft \u2014 mandatory):",
    `- The prose is read ALOUD. It must sound good in ${languageName}, not just look correct.`,
    "- Per scene movement, land at least ONE deliberate sound moment: a lautmalerisches Wort (klong, platsch, knirsch, summ), a short alliteration, or an echoing word pair.",
    "- Keep ONE recurring sound motif or refrain that returns 2\u20133 times and shifts meaning each time \u2014 a handle a child can chant along.",
    "- Vary the sentence music: alternate very short beats (1\u20134 words) with one flowing sentence. Never three long sentences in a row.",
    "- Read each finished paragraph in your head. If it does not invite an enthusiastic out-loud voice, rewrite it tighter and more musical.",
  ].join("\n");
}

// Step 3 — Preschool (ages 3-5) structural craft. The pipeline previously
// bucketed 3-5 with 6-8 and only shrank the word budget. Picture books for 3-5
// are STRUCTURALLY different: cumulative patterns, predictable repetition, one
// emotional beat per page, a refrain used as scaffolding rather than decoration.
function buildPreschoolCraftBlock(languageName: string): string {
  return [
    "PICTURE-BOOK MODE (ages 3-5 \u2014 binding, overrides denser dramaturgy):",
    "- This is a read-aloud picture book, NOT a chapter story. Keep ONE simple want and ONE simple problem.",
    "- Use a strong, predictable PATTERN: a repeated structure or cumulative build the child can anticipate and say along.",
    "- A clear REFRAIN must repeat almost word-for-word (3+ times) as the spine of the story; only a tiny, meaningful variation at the very end.",
    "- One emotional beat per scene movement. No subplots, no second mystery, no inner low-point dramaturgy.",
    "- Very short sentences. Concrete, familiar things only: animals, toys, food, weather, family, bedtime.",
    "- Gentle stakes and a warm, reassuring close. No real peril, no irreversible loss.",
    `- All prose stays in simple ${languageName} a 4-year-old hears every day.`,
  ].join("\n");
}

function buildCompactWholeStoryDraftPrompts(
  input: DevModeGenerationInput,
  chapterCount: number,
  screenplayPlan: DevModeScreenplayPlan
): { systemPrompt: string; userPrompt: string } {
  const languageName = localizedLanguageName(input.config.language);
  const wordBounds = getStoryWordBounds(input.config);
  const heroNames = (input.avatars || []).map((a) => a.name).filter(Boolean);
  const heroA = heroNames[0] || "Main A";
  const heroB = heroNames[1] || "Main B";
  const ageGroup = input.config.ageGroup || "6-8";
  const titleWords = extractTitleContentWords(String(input.selectedIdea?.title || "")).slice(0, 4);

  const compactStoryBible = buildCompactStoryBibleForDraft(input, chapterCount);
  const compactScenePlan = compactScreenplayPlanForDraft(screenplayPlan);

  const systemPrompt = [
    `You write children's storybook prose in ${languageName} for ages ${ageGroup}.`,
    "Output schema (NO chapters, NO headings, NO reading-page labels):",
    '{ "title": string, "description": string, "paragraphs": string[] }',
    "Emit the \"paragraphs\" key EXACTLY ONCE. Do not restart it per scene; append every paragraph to the same flat array in reading order.",
    "Do not output: chapters, reading-page labels, markdown, raw JSON inside the prose, explanation notes.",
    "",
    getReferenceFewshotBlock(languageCodeFromName(languageName)),
  ].join("\n");

  const wordsPerMovement = Math.round(wordBounds.targetMin / Math.max(1, chapterCount));
  // Countable dialogue contract: gpt-tier models ignore percentage targets
  // (three production drafts measured 16.6-17.2% against a "30-38%" rule) but
  // comply with concrete counts. Derive the minimum quoted-line count from the
  // scene plan's own dialogue beats.
  const plannedDialogueBeats = (screenplayPlan?.sceneCards || []).reduce(
    (sum: number, card: any) => sum + (Array.isArray(card?.dialogueBeats) ? card.dialogueBeats.length : 0),
    0
  );
  const minQuotedLines = Math.max(18, Math.min(32, plannedDialogueBeats || 20));
  const userPrompt = [
    `WHOLE STORY DRAFT — one continuous ${languageName} story for ages ${ageGroup}.`,
    "No chapter headings, no scene labels. The app technically splits later into reading pages.",
    "",
    "STORY BIBLE (binding):",
    promptJson(compactStoryBible),
    buildPremiseSeedPromiseBlock(input) || "",
    buildWonderRuleConsistencyBlock(input) || "",
    "",
    "SCENE PLAN (binding, do not invent a different plot):",
    promptJson(compactScenePlan),
    "",
    buildVoiceBibleBlock(input) || "",
    buildWriterVoiceAnchorBlock(input) || "",
    "",
    "MANDATORY:",
    "- one clear magic / wonder rule, tested on-page at least twice",
    "- one visible wrong action with visible consequence",
    "- irreversible middle with concrete personal cost (object, place, privilege given up)",
    "- the sacrifice must HURT on the page: one line of hesitation/pang BEFORE letting go (a swallow, a last look, a gripped fist) and one line AFTER naming what is now missing. A sacrifice without a visible pang reads as a mere tool-use and fails the quality gate.",
    "- preserve the SCENE PLAN's irreversible visibleDamage on the page: it must leave a visible mark/change (Riss, Stein, Farbe weg, festgewachsen, verschmolzen, verloren) and not soften into 'it got heavy for a moment'",
    "- keep ONE central red-thread object/place from the story bible and scene plan; do not swap in a backpack/bag/lock/closure or any other object-function mid-draft",
    "- if SCENE PLAN.storyCore.personalObject includes whyPersonal/risk/payoff, plant why it matters before the sacrifice and make the final choice use that same value; never reduce it to a generic useful object",
    "- no-refund payoff: a sacrificed object/status may become useful in a new place, but cannot simply be handed back unchanged by a helper",
    "- final decision performed by the children, not by helpers",
    "- helpers may complicate, pressure, ask sharp questions — they may NOT explain the solution",
    "- finale uses a detail planted earlier",
    "- CONTINUITY: no object, place, or magic effect may appear at the moment it is needed without being introduced earlier. Plant everything the finale uses; pay off everything you plant (a planted object that never returns confuses the child).",
    "- ORIENTATION: after every scene change, the first sentence must let a listening 6-year-old know WHERE the heroes are and WHAT they want right now. Never jump locations between paragraphs without a visible transition (a door, a path, a fall, a pull).",
    "- the wonder rule is tested ONE final time inside the finale: a child knowingly applies the learned rule and the effect is visible on the page (this cements the causal loop)",
    "- ending is an IMAGE, not a moral. No \"sie lernten...\" / \"they learned...\". Also no as-if moral similes (\"als wäre er klüger geworden\", \"as if it had grown wiser\") — the last sentence shows one concrete object, sound, or motion in the scene.",
    "",
    "REFRAIN CONTRACT (read-aloud magnet — this is what separates a 9.0 book from a 7.0 draft):",
    "- Derive ONE short SPOKEN signature line (3–7 words, inside „…“) from the wonder rule or the creature/object voice. It must be chantable, ideally with internal rhyme or a strong 2–4 beat rhythm a 6-year-old can repeat after one hearing.",
    "- A sound effect alone (Klong, Plopp, Wusch) is NOT a refrain. The refrain is WORDS a character says. A recurring sound may accompany it, but cannot replace it.",
    "- It must appear at least 3 times: introduced early → repeated under pressure in the middle → TRANSFORMED in the finale (same shape, new meaning).",
    "- The refrain belongs to a character's voice, not the narrator. Each return should land on its own short line so the page invites the child to say it aloud.",
    "",
    "LEVITY BEAT (mandatory, at least one): plant one genuinely funny moment that grows out of character — a helper's silly logic, a comic mishap with the magic object, a witty mismatch between what a child says and does. Warmth and humour, never sarcasm or a character being mocked. The humour must not derail the emotional through-line.",
    "",
    "LENGTH AND DIALOGUE (both budgets are HARD and apply TOGETHER — never fix one by breaking the other):",
    `- ${wordBounds.targetMin}–${wordBounds.targetMax} words total (hard min ${wordBounds.min}, hard max ${wordBounds.max}).`,
    `- That is roughly ${wordsPerMovement} words per scene movement. Do NOT write a compressed summary; let each movement breathe with action, sensory consequence, and speech.`,
    "- dialogue 30–38% of the prose, measured in characters. This floor is as hard as the word count. Do NOT exceed ~45%: a page that is almost all quoted speech loses the sensory narration and action a picture book needs. Keep description, movement and inner perception between the lines of dialogue.",
    `- COUNTABLE DIALOGUE CONTRACT: the scene plan contains ${plannedDialogueBeats || "20+"} planned dialogue beats. Realize EVERY beat as at least one quoted line — the finished prose must contain at least ${minQuotedLines} quoted lines („…“). A beat may grow into a short exchange, never shrink into narration.`,
    "- in the first half of the story, never go more than 2 paragraphs without direct speech",
    "- each scene movement needs at least 2 short quoted exchanges that change action, pressure, or relationship",
    titleWords.length > 0
      ? `- redeem the title inside the prose with these exact content words or close inflections: ${titleWords.map((word) => `"${word}"`).join(", ")}`
      : null,
    "- If a title word is abstract (Freundlichkeit, Mut, Freundschaft, Verantwortung), redeem it through concrete action/image; do not add moral/filler dialogue just to say the word.",
    `- ${heroA} and ${heroB} must sound unmistakably different (rhythm, vocabulary, gestures)`,
    "",
    languageCodeFromName(languageName) === "de"
      ? "SPRACH-ECHTHEIT (Pflicht): Nur echte, gebräuchliche deutsche Wörter. KEINE erfundenen Komposita oder Kunstwörter (kein \"apfelscharf\" o.ä.). Wenn unsicher, ob ein 7-Jähriger das Wort kennt: einfacheres Wort wählen. Vergleiche aus der Kinderwelt (Spielzeug, Tiere, Essen, Wetter)."
      : "LANGUAGE AUTHENTICITY (mandatory): only real, common words a 7-year-old knows. Never invent compound words. If unsure, choose the simpler word.",
    "",
    buildReadAloudSoundBlock(languageName),
    ageGroup === "3-5" ? buildPreschoolCraftBlock(languageName) : null,
    "",
    "BANNED:",
    "- chapter headings, dividers, page labels, scene labels",
    "- mini-endings between scenes",
    "- moral closures inside the prose",
    "- helpers explaining the solution",
    "- multiple competing magic rules",
    "",
    "PRE-EMIT SELF-CHECK (run silently, rewrite before answering — do not narrate):",
    `1. Count the words. Below ${wordBounds.targetMin}? Expand scene movements with action + dialogue (never filler). Above ${wordBounds.targetMax}? Trim narration, never dialogue.`,
    `2. COUNT the quoted lines („…“) in your draft. Fewer than ${minQuotedLines}? Go back through the scene plan's dialogue beats and convert every unrealized beat into a quoted exchange. Percentages lie — count the lines.`,
    "3. Confirm the refrain appears 3 times and shifts meaning in the finale.",
    "4. Confirm every quoted line could be attributed WITHOUT its speaker tag (distinct voices).",
    "",
    `FINAL REMINDER: ONE JSON object with title, description, ONE paragraphs[] array only. Never emit duplicate \"paragraphs\" keys. All prose in ${languageName}.`,
  ].filter(Boolean).join("\n");

  return { systemPrompt, userPrompt };
}

function buildWholeStoryDraftPrompts(
  input: DevModeGenerationInput,
  chapterCount: number,
  blueprint: any,
  critique: any,
  screenplayPlan?: DevModeScreenplayPlan
): { systemPrompt: string; userPrompt: string } {
  const languageName = localizedLanguageName(input.config.language);
  const wordBounds = getStoryWordBounds(input.config);
  const totalBounds = getChapterLengthBounds(input.config);
  const maxSentenceChars = maxSentenceCharsForAge(input.config.ageGroup);
  const totalMinChars = totalBounds.min * chapterCount;
  const totalMaxChars = totalBounds.max * chapterCount;
  const revisedBlueprint = getReviewedBlueprint(blueprint, critique);
  const compactBlueprint = compactReviewedBlueprintForDraft(revisedBlueprint, chapterCount);
  const screenplayDraftPlan = compactScreenplayPlanForDraft(screenplayPlan);
  const compactStoryBible = screenplayDraftPlan ? buildCompactStoryBibleForDraft(input, chapterCount) : null;
  const heroNames = (input.avatars || []).map((a) => a.name).filter(Boolean);
  const heroA = heroNames[0] || "Main character A";
  const heroB = heroNames[1] || "Main character B";
  // Title-promise contract: surface the concrete content nouns from the chosen
  // idea title so the writer is FORCED to weave them into the prose.
  const ideaTitle = String(
    (input.selectedIdea as any)?.title
    || (input.selectedIdea as any)?.workingTitle
    || (revisedBlueprint as any)?.title
    || ""
  );
  const titleKeyWords = ideaTitle ? extractTitleContentWords(ideaTitle) : [];
  const ageGroup = input.config.ageGroup || "6-8";
  const isYoungAudience = ageGroup === "3-5" || ageGroup === "6-8";
  const plainTextDraftMode = shouldUsePlainTextWholeStoryDraft(input.config);

  const baseSystemPrompt = qualitySystemPrompt(
    languageName,
    plainTextDraftMode
      ? [
          "Whole-story draft output format for this model (plain text, NO JSON):",
          "TITLE: <one story title>",
          "DESCRIPTION: <one sentence>",
          "STORY:",
          "<blank-line-separated story paragraphs>",
          "",
          "IMPORTANT: Do NOT output JSON, arrays, braces, Markdown fences, chapters, scene headings, dividers, page labels, or reading-break labels.",
          "Only the control labels TITLE, DESCRIPTION, and STORY are allowed. The STORY section itself must be pure prose paragraphs.",
          "The reader should be able to read the STORY paragraphs straight through as ONE continuous narrative.",
        ].join("\n")
      : [
          "Whole-story draft schema (NO chapters, NO headings, NO reading-page labels):",
          "{",
          '  "title": string,',
          '  "description": string,',
          '  "paragraphs": string[]   // ONE flat array; the entire story as continuous prose, in reading order',
          "}",
          "CRITICAL JSON RULE: emit the \"paragraphs\" key exactly once. Never output multiple paragraphs arrays; append every scene paragraph to the single flat array.",
          "IMPORTANT: Do NOT output a chapters array. Do NOT insert chapter headings, scene breaks, dividers, page labels, or labels into the paragraphs.",
          "Each paragraph is one paragraph of story prose. The reader should be able to read the paragraphs straight through as ONE continuous narrative.",
        ].join("\n")
  );
  // Step 1 — anchor the writer with curated, non-copyright few-shot prose so it
  // imitates real children's-book rhythm/concreteness while writing (not only
  // at validation time). Appended to the cacheable SYSTEM region.
  const systemPrompt = [baseSystemPrompt, getReferenceFewshotBlock(languageCodeFromName(languageName))].join("\n\n");

  const userPrompt = [
    `WHOLE STORY DRAFT \u2014 write ONE continuous children's story in ${languageName}.`,
    "Do NOT split it into chapters. Do NOT write chapter headings, numbers, or scene labels.",
    screenplayDraftPlan
      ? "Use the locked screenplay plan as binding dramaturgy; on the page the prose flows as one arc."
      : "Internally use the blueprint's beats as private dramaturgy; on the page the prose flows as one arc.",
    "",
    "CORE WRITER CONTRACT (only the rules that matter \u2014 do not over-comply, write like a real children's-book author):",
    "1. Write one continuous story, not 5 mini-stories. Every paragraph must grow out of the previous one.",
    "2. Each repetition (refrain, prop, sound, rule) must shift in meaning. Never repeat for decoration.",
    "2a. REFRAIN CONTRACT: derive ONE short, chantable signature line from the wonder rule or creature/object voice (internal rhyme or strong rhythm). It appears at least 3 times: introduced early → repeated under pressure → TRANSFORMED in the finale. It belongs to a character's voice, never the narrator. A recurring SOUND alone (Klong, Plopp) is not a refrain — the refrain is WORDS a character says, set on its own short line so the child can chant it.",
    "2b. LEVITY BEAT (mandatory, at least one): one genuinely funny, character-driven moment — a helper's silly logic, a comic mishap with the magic object, a witty say/do mismatch. Warmth and humour, never sarcasm or mocking a character; it must not derail the emotional through-line.",
    "3. The MAIN avatars must spot the crucial clue and perform the decisive action. Helpers may complicate, pressure, or hint \u2014 they may NEVER explain the solution.",
    "4. The final action must come from a detail that was planted earlier in the story.",
    "5. The ending is an IMAGE, not a moral. No \"Sie lernten...\" / \"They learned...\" sentences.",
    "6. One clear magic/wonder rule. Test it on-page at least twice before the finale; the finale uses it.",
    "7. Somewhere in the middle, something becomes irreversible (object lost, voice gone, path closed, secret revealed) so the children can't simply turn back.",
    "7a. Preserve the screenplay plan's visibleDamage literally as a visible on-page consequence: a mark, break, color loss, stone edge, stuck/fused state, or missing piece must remain after the scene.",
    "8. No-refund payoff: if the child pays a personal cost, do not erase it by returning the object/status unchanged. Transform it, rehome it, or let the child choose a new relationship to it.",
    "9. If the screenplay plan names a personal object with whyPersonal/risk/payoff, plant that emotional value early on-page and make the final sacrifice clearly conscious. A 'last useful item' is not enough unless the child-reader knows why it hurts to give up.",
    "",
    "ROTER FADEN (causal through-line \u2014 the single most important rule):",
    "- Pick ONE concrete recurring object/sound/refrain (the red thread) and make it visible in EVERY segment of the story. Each appearance must change meaning (introduced \u2192 misused \u2192 lost \u2192 reinterpreted \u2192 redeems the finale).",
    "- The red thread is the locked central object/place from the selected idea. Do not substitute a background prop, backpack, lock, clasp, or disguised version of a rejected object-function.",
    "- Every paragraph must answer 'why now?' from the previous paragraph. If a paragraph could be deleted without the next one missing it, REMOVE that paragraph.",
    "- No orphan scenes, no decorative side-trips. Place markers for the future payoff EARLY \u2014 a child should be able to retell the story as a chain: 'because... then... so...'.",
    "- After writing, mentally read the story to a 6-year-old. If they would ask 'wait, why did that happen?' anywhere, rewrite that bridge.",
    "",
    isYoungAudience
      ? `KINDERVERSTAENDLICHKEIT (Pflicht fuer Alter ${ageGroup}):`
      : `KINDERVERSTAENDLICHKEIT (Ziel-Alter ${ageGroup}):`,
    "- Kurze Saetze. Bilder aus dem Kinder-Alltag: Spielzeug, Tiere, Essen, Wetter, Schule, Familie. Keine literarischen Adjektive (\"stocksteif\", \"geschniegelt\", \"gravitaetisch\", \"sondiert\").",
    "- Hoechstens ein Fremdwort pro Segment, und wenn, dann sofort durch ein Bild erklaert.",
    "- Keine verschachtelten Bandwurmsaetze. Max ein Nebensatz pro Satz; lieber zwei kurze Saetze als ein langer.",
    "- Gefuehle nicht benennen \u2014 sie an Koerper und Handlung zeigen (\"die Hand wurde feucht\", nicht \"sie war nervoes\").",
    "- Die Geschichte hat fuenf natuerliche Szenenbewegungen, aber keine sichtbaren Kapitel. Jeder Szenenwechsel entsteht aus Ursache/Folge, nicht aus einer Ueberschrift.",
    "",
    titleKeyWords.length > 0
      ? `TITEL-VERTRAG (PFLICHT): Der Storytitel ist \"${ideaTitle}\". Diese Kernwoerter MUESSEN wortgetreu (oder als enge Beugung) sichtbar im Prosatext vorkommen \u2014 verteilt ueber die Story, nicht nur einmal: ${titleKeyWords.map((w) => `\"${w}\"`).join(", ")}. Falls ein Wort nicht in den Prosatext passt, aendere lieber den Titel als das Versprechen zu brechen.`
      : "",
    "",
    "ABSTRAKTE TITELWOERTER: Wenn der Titel ein Wert-Wort enthaelt (Freundlichkeit, Mut, Freundschaft, Verantwortung), loese es durch Handlung/Bild ein. Keine Dialog-Fuellsaetze, die nur das Wort erklaeren.",
    "DIALOG-VERTEILUNG (Pflicht):",
    `- Jedes Segment von 4\u20136 Paragraphen MUSS mindestens 2 echte Dialog-Wechsel enthalten (zwei oder mehr direkt aufeinander folgende quoted lines). Kein Segment darf rein narrativ sein.`,
    `- Direkte Rede insgesamt 25\u201340% des Prosatexts. Jede Zeile traegt Handlung, Beziehung, Humor, Spannung oder Subtext \u2014 keine Fueller.`,
    `- ${heroA} und ${heroB} klingen unverwechselbar (Rhythmus, Wortwahl, Gesten). Ein Leser soll ohne Sprechertag wissen, wer spricht.`,
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
    screenplayDraftPlan
      ? [
          "COMPACT STORY BIBLE (binding):",
          promptJson(compactStoryBible),
          "",
          buildVoiceBibleBlock(input) || "",
          "",
          buildWriterVoiceAnchorBlock(input) || "",
          "",
          "LOCKED SCREENPLAY PLAN (binding; prose may not invent a different plot):",
          promptJson(screenplayDraftPlan),
        ].join("\n")
      : [
          buildVoiceBibleBlock(input),
          "",
          buildWriterVoiceAnchorBlock(input),
          "",
          buildEmotionAndVoicePromptContext(input, chapterCount, { includeNoveltyBrief: false }),
          "",
          "SELECTED IDEA AND CAST:",
          buildSelectedIdeaPromptBlock(input),
          buildSelectedCastIntegrationContract(input),
        ].join("\n"),
    "",
      buildCentralObjectContractBlock(input) || "",
      buildPremiseSeedPromiseBlock(input) || "",
      "",
    buildArtifactPropBlock(input) || "",
    "",
    "LENGTH & RHYTHM:",
    `- Target ${wordBounds.targetMin}-${wordBounds.targetMax} words for the whole story (hard min ${wordBounds.min}, hard max ${wordBounds.max}).`,
    `- Roughly ${totalMinChars}-${totalMaxChars} characters of prose across the whole story.`,
    `- Output the prose as flat paragraphs (around ${chapterCount * 5}-${chapterCount * 7} paragraphs total for the whole story). The server will create technical reading breaks later; you do not write them.`,
    `- Each paragraph \u2264 380 characters. Split long beats into separate paragraphs instead of cramming.`,
    `- Every 4\u20136 paragraphs should contain a natural scene-turn (open question, new visible detail, decision, small surprise, comic aftershock, direction change). These turns are NOT chapter endings and must not close the scene like a mini-story.`,
    `- No sentence may exceed ${maxSentenceChars} characters. Use child-readable beats.`,
    `- Dialogue 25\u201340% of the prose. Do NOT force a quota \u2014 every quoted line must carry action, relationship, humor, tension, or subtext. Never add filler chatter to reach a number.`,
    `- ${heroA} and ${heroB} must sound unmistakably different (rhythm, vocabulary, gestures, first reactions). A reader should often identify the speaker without tags.`,
    "",
    buildReadAloudSoundBlock(languageName),
    ageGroup === "3-5" ? buildPreschoolCraftBlock(languageName) : null,
    "",
    "FINALE-PFLICHTEN (last 25% of the story \u2014 hard requirements, not optional):",
    `- ${heroA} (or ${heroB}) must name AT LEAST TWO concrete worries out loud before the decisive action. Not generic fears (\"ich habe Angst\") \u2014 specific things, in their own voice (\"Was, wenn der Schluckauf bleibt?\", \"Was sage ich Mama, wenn das Taschentuch zerrissen ist?\").`,
    "- The personal object planted earlier must appear in the final scene VISIBLY DAMAGED, USED UP, or CHANGED FOR EVER. It must not be magically restored.",
    "- The decisive final action is performed by the children, not by a helper. The helper may stand at the edge, hand over one small thing, or stay silent \u2014 they may not solve, explain, or rescue.",
    "- The child makes a clearly conscious choice (\"Ich gebe ... her\", \"Ich lasse ... zurück\", \"Wir lassen ... so wie es ist\") \u2014 not an accidental success, not a discovery by the helper.",
    "- Closing image must contain the damaged/used personalObject AS A VISIBLE REMAINDER and at least one sensory beat (light, sound, touch, smell). No moral, no \"sie lernten\", no narrator wrap-up.",
    "",
    "BANNED:",
    "- chapter headings, chapter numbers, scene labels, dividers (\"---\", \"***\"), or recap sentences",
    "- mini-endings after each scene movement",
    "- mini-conclusions or moral closures inside the prose",
    "- formulaic catchphrase repetition (each character may use a signature line at MOST once in the whole story; max 2 formulaic feeling/memory openers total across all characters)",
    "- supporting / helper figures EXPLAINING the magic rule, the lesson, or the solution. Helpers may pressure, misinterpret, ask a sharp question, hand over a tool, or miss a clue \u2014 the MAIN avatars must perform the decisive insight and action.",
    "- the finale repeating the exact mechanism/payoff of an earlier scene movement; the finale must escalate or transform what was tried before",
    "- multiple competing magic rules \u2014 keep ONE clear rule, and test it on-page at least twice before the finale",
    "- AI-tics: \"Not X. Not Y. Just Z.\" chains, narrator commentary, explained jokes",
    "",
    screenplayDraftPlan
      ? "SCREENPLAY FIRST CONTRACT: The AI was not allowed to write prose until beat sheet, scene cards, and dialogue intent passed. Preserve that structure exactly."
      : "COMPACT REVIEWED BLUEPRINT (use the beats privately as dramaturgy, do NOT echo them):",
    screenplayDraftPlan ? "" : promptJson(compactBlueprint),
    "",
    "CRITIQUE TO RESOLVE:",
    promptJson(compactCritiqueForDraft(critique)),
    "",
    plainTextDraftMode
      ? "PRE-EMIT SELF-CHECK (silently run before plain-text output \u2014 rewrite, do not narrate):"
      : "PRE-EMIT SELF-CHECK (silently run before JSON output \u2014 rewrite, do not narrate):",
    `1. Word count: count words in the story paragraphs. If outside ${wordBounds.targetMin}\u2013${wordBounds.targetMax}, trim descriptive subordinate clauses (NEVER cut dialogue) or expand a beat.`,
    "2. Dialog share (quality check, not a filler quota): scan how much of the prose is direct speech. Aim for roughly 28\u201336% across the whole story, but NEVER add filler chatter to hit a number \u2014 a quiet, atmospheric beat is allowed to breathe. If a scene movement has gone fully narrative, convert the part that would play better as a spoken line into real dialogue that carries action, relationship, or subtext. (Prose under ~25% dialogue overall tends to read flat, so do not undershoot either.)",
    "3. Red thread: list the recurring red-thread object/refrain by paragraph. If it is missing from a segment, weave it in.",
    titleKeyWords.length > 0
      ? `4. Title contract: confirm each of these words appears in the story paragraphs: ${titleKeyWords.map((w) => `\"${w}\"`).join(", ")}. If any is missing, add it naturally to a fitting paragraph.`
      : "4. Title coherence: confirm the title genuinely matches what the prose delivers.",
    "5. Causality: scan paragraph starts. Each new paragraph must follow logically from the previous (because/then/so/meanwhile/now). If a paragraph reads like a topic switch, add a one-sentence bridge.",
    isYoungAudience
      ? "6. Verstaendlichkeit: scan for any sentence over " + maxSentenceChars + " characters or with more than one nested subordinate clause. Split into two simpler sentences."
      : "6. Sentence rhythm: vary length; no chains of long sentences.",
    "",
    plainTextDraftMode
      ? [
          "FINAL REMINDER: output plain text only, exactly in this shape:",
          "TITLE: one story title",
          "DESCRIPTION: one sentence",
          "STORY:",
          "first story paragraph",
          "",
          "second story paragraph",
          "",
          `No JSON, no braces, no arrays, no Markdown, no chapters, no readingBreaks, no headings in the prose. All story text in ${languageName}.`,
        ].join("\n")
        : `FINAL REMINDER: output ONE JSON object with title, description, ONE paragraphs[] array only. Never emit duplicate \"paragraphs\" keys. No chapters array, no readingBreaks array, no headings in the prose. All story text in ${languageName}.`,
  ].filter(Boolean).join("\n");

  return { systemPrompt, userPrompt };
}

interface DevModeWholeStoryDraft {
  title: string;
  description: string;
  paragraphs: string[];
}

function extractProseFallback(
  content: string
): { title: string; description: string; paragraphs: string[]; titleSource: "field" | "first-paragraph" | "synthetic" } | null {
  if (!content) return null;
  let body = stripReasoningPreamble(String(content).trim());
  if (!body) return null;
  if (body.startsWith("```")) {
    body = body.replace(/^```(?:json|markdown|md|text)?\s*/i, "").replace(/```\s*$/, "").trim();
  }
  body = body.replace(/^﻿/, "").trim();
  if (!body) return null;
  let title = "";
  let titleSource: "field" | "first-paragraph" | "synthetic" = "synthetic";
  const titleFieldMatch = body.match(/(?:^|\n)\s*[*_#>\-]*\s*(?:"?title"?|titel)\s*[:=]\s*"?([^"\n]+?)"?\s*(?:,|\n|$)/i);
  if (titleFieldMatch) {
    title = titleFieldMatch[1].trim();
    titleSource = "field";
    body = body.replace(titleFieldMatch[0], "\n").trim();
  }
  let description = "";
  const descFieldMatch = body.match(/(?:^|\n)\s*[*_#>\-]*\s*(?:"?description"?|beschreibung)\s*[:=]\s*"?([^"\n]+?)"?\s*(?:,|\n|$)/i);
  if (descFieldMatch) {
    description = descFieldMatch[1].trim();
    body = body.replace(descFieldMatch[0], "\n").trim();
  }
  body = body
    .replace(/^\s*[*_#>\-]*\s*(?:story|geschichte|prose|text)\s*[:=]\s*/im, "\n")
    .replace(/^\s*[*_#>\-]*\s*(?:story|geschichte|prose|text)\s*:?\s*$/gim, "")
    .trim();
  body = body.replace(/^\s*[\[\]{},]+\s*$/gm, "").trim();
  const looksLikeMetaAnalysis =
    /\(\s*\d+\s*words?\s*\)/i.test(body) ||
    /let'?s\s+check/i.test(body) ||
    /dialogue\s+density/i.test(body) ||
    /^\s*(?:ch|kap|chapter|kapitel)\s*\d+\s*[:.\-]/im.test(body) ||
    /^\s*\*\s+\*\s+/m.test(body);
  if (looksLikeMetaAnalysis) return null;
  const rawParagraphs = splitLooseProseParagraphs(body)
    .map((p) =>
      p
        .replace(/^[\s>*\-•]+/, "")
        .replace(/^(?:kapitel|chapter)\s*\d+[.:\s\-–—]*/i, "")
        .trim()
    )
    .filter((p) => p.length > 0 && !/^(?:[-*_=]{3,}|kapitel\s*\d+|chapter\s*\d+)\s*$/i.test(p))
    .filter((p) => !/^(?:story|geschichte|prose|text)\s*:?\s*$/i.test(p))
    .filter((p) => !/^[\*\-•]\s/.test(p) && !/\(\s*\d+\s*words?\s*\)/i.test(p));
  if (rawParagraphs.length === 0) return null;
  if (!title) {
    const firstParagraph = rawParagraphs[0];
    if (firstParagraph && firstParagraph.length <= 90 && !/[.!?]/.test(firstParagraph)) {
      title = firstParagraph;
      titleSource = "first-paragraph";
      rawParagraphs.shift();
    }
  }
  if (rawParagraphs.length === 0) return null;
  const totalChars = rawParagraphs.reduce((sum, p) => sum + p.length, 0);
  const sentenceLikeCount = rawParagraphs.filter((p) => /[.!?]/.test(p)).length;
  if (rawParagraphs.length < 4 || totalChars < 600 || sentenceLikeCount < Math.max(2, Math.floor(rawParagraphs.length / 2))) {
    return null;
  }
  if (!title) {
    const sentenceMatch = rawParagraphs[0].match(/^(.{6,80}?[.!?])/);
    title = sentenceMatch ? sentenceMatch[1].replace(/[.!?]+$/, "").trim() : rawParagraphs[0].slice(0, 60).trim();
    titleSource = "synthetic";
  }
  return { title, description, paragraphs: rawParagraphs, titleSource };
}

function splitWholeStoryDraftParagraphIntoChunks(paragraph: string, maxChars = 420): string[] {
  const text = String(paragraph || "").trim();
  if (text.length <= maxChars) return text ? [text] : [];
  const sentences = (text.match(/.+?(?:[.!?…]+["“”»]?|$)(?=\s+|$)/gu) || [text])
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  if (sentences.length <= 1) return [text];

  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (!current) {
      current = sentence;
      continue;
    }
    if (current.length + 1 + sentence.length <= maxChars || current.length < 180) {
      current = `${current} ${sentence}`.trim();
      continue;
    }
    chunks.push(current);
    current = sentence;
  }
  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [text];
}

function splitOverlongWholeStoryDraftParagraphs(paragraphs: string[]): { paragraphs: string[]; changed: boolean } {
  const split = paragraphs.flatMap((paragraph) => splitWholeStoryDraftParagraphIntoChunks(paragraph));
  return { paragraphs: split, changed: split.length !== paragraphs.length };
}

function parseWholeStoryDraft(content: string): DevModeWholeStoryDraft {
  let parsed: any;
  let parseError: unknown = null;
  try {
    parsed = tryParseJson(content);
  } catch (err) {
    parseError = err;
  }
  if (!parsed || typeof parsed !== "object") {
    const prose = extractProseFallback(content);
    if (prose) {
      console.warn("[dev-mode-generation] Whole-story draft was prose, not JSON; recovering as prose fallback", {
        paragraphCount: prose.paragraphs.length,
        titleSource: prose.titleSource,
        parseError: parseError instanceof Error ? parseError.message : parseError ? String(parseError) : undefined,
      });
      return { title: prose.title, description: prose.description, paragraphs: prose.paragraphs };
    }
    if (parseError) {
      throw new Error(
        `Whole-story draft returned unparseable JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`
      );
    }
    throw new Error("Whole-story draft returned malformed JSON.");
  }
  const title = String(parsed.title || "").trim();
  const description = String(parsed.description || "").trim();
  if (!title) throw new Error("Whole-story draft missing title.");

  // Accept either paragraphs[] (preferred) or a single body/content string.
  let paragraphs: string[] = [];
  const duplicateParagraphRecovery = recoverDuplicateWholeStoryParagraphs(content, parsed);
  if (duplicateParagraphRecovery) {
    paragraphs = duplicateParagraphRecovery.paragraphs;
    console.warn("[dev-mode-generation] Recovered duplicate whole-story paragraphs arrays", {
      paragraphArrayCount: duplicateParagraphRecovery.arrayCount,
      parsedParagraphCount: duplicateParagraphRecovery.parsedParagraphCount,
      recoveredParagraphCount: paragraphs.length,
    });
  } else if (Array.isArray(parsed.paragraphs)) {
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

  const paragraphSplit = splitOverlongWholeStoryDraftParagraphs(paragraphs);
  if (paragraphSplit.changed) {
    console.warn("[dev-mode-generation] Split overlong whole-story draft paragraphs before reading-page layout", {
      beforeParagraphCount: paragraphs.length,
      afterParagraphCount: paragraphSplit.paragraphs.length,
    });
    paragraphs = paragraphSplit.paragraphs;
  }

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

  // Enforce balance ratio: stricter than spec's 1.6 because real children's
  // books are tightly balanced. Medium/short stories: 1.4. Long stories
  // (>25 paragraphs in the draft): 1.6.
  const balanceCap = draft.paragraphs.length > 25 ? 1.6 : 1.4;
  const llmRatio = computePlanBalanceRatio(draft, plan);
  if (llmRatio > balanceCap) {
    console.warn("[dev-mode-generation] Splitter plan unbalanced; using balanced deterministic split", {
      llmRatio: Number(llmRatio.toFixed(2)),
      threshold: balanceCap,
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

function buildReadingPageTitle(order: number, languageName: string): string {
  const code = languageCodeFromName(languageName);
  if (code === "de") return `Leseseite ${order}`;
  if (code === "nl") return `Leespagina ${order}`;
  if (code === "es" || code === "it") return `Pagina ${order}`;
  if (code === "fr") return `Page ${order}`;
  return `Reading page ${order}`;
}

function applyReadingBreaksToDraft(
  draft: DevModeWholeStoryDraft,
  pageCount: number,
  languageName: string,
  screenplayPlan?: DevModeScreenplayPlan
): DevModeRawStory & { balanceRatio?: number } {
  const plan = balancedDeterministicSplit(draft, pageCount);
  const sceneCards = screenplayPlan?.sceneCards || [];
  const readingBreaks: DevModeReadingBreak[] = plan.map((slice, index) => {
    const sceneCard = sceneCards[index];
    return {
      afterParagraph: slice.end + 1,
      imagePromptScene: String(
        sceneCard?.titleHint ||
        sceneCard?.visibleConsequence ||
        draft.paragraphs[slice.end] ||
        `Reading page ${index + 1}`
      ).slice(0, 220),
      scenePurpose: sceneCard?.scenePurpose,
    };
  });
  const chapters: DevModeChapter[] = plan.map((slice, index) => ({
    order: index + 1,
    title: buildReadingPageTitle(index + 1, languageName),
    content: paragraphsToContent(draft.paragraphs.slice(slice.start, slice.end + 1)),
  }));
  return {
    title: draft.title,
    description: draft.description,
    storyText: paragraphsToContent(draft.paragraphs),
    readingBreaks,
    displayMode: "reading_pages",
    chapters,
    balanceRatio: computePlanBalanceRatio(draft, plan),
  };
}

function markStoryAsReadingPages(story: DevModeRawStory, source?: DevModeRawStory): DevModeRawStory {
  const chapters = story.chapters.map((chapter, index) => ({
    ...chapter,
    title: source?.chapters?.[index]?.title || chapter.title,
  }));
  const readingBreaks = story.chapters.map((chapter, index) => ({
    afterParagraph: story.chapters
      .slice(0, index + 1)
      .reduce((sum, ch) => sum + splitParagraphs(ch.content).length, 0),
    imagePromptScene: source?.readingBreaks?.[index]?.imagePromptScene || chapter.title || `Reading page ${index + 1}`,
    scenePurpose: source?.readingBreaks?.[index]?.scenePurpose,
  }));
  return {
    ...story,
    chapters,
    displayMode: "reading_pages",
    storyText: chapters.map((chapter) => chapter.content).join("\n\n"),
    readingBreaks,
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
  const wordBounds = getStoryWordBounds(input.config);
  const overlongChapterCount = diagnostics.chapterDiagnostics.filter((chapter) => chapter.chars > bounds.max).length;
  const broadCompressionMode = overlongChapterCount >= Math.min(3, chapterCount) || diagnostics.dialogPct < DEV_MODE_MIN_DIALOG_PCT;
  const readingPageMode = story.displayMode === "reading_pages" || Array.isArray(story.readingBreaks);
  const hardUnderlengthMode =
    diagnostics.totalWords < wordBounds.min
    || diagnostics.hardIssues.some((issue) => /deutlich zu kurz|too short|word count/i.test(issue));
  const wordsToAddForTarget = Math.max(0, wordBounds.targetMin - diagnostics.totalWords);
  const targetWordsPerPage = Math.ceil(wordBounds.targetMin / Math.max(1, chapterCount));
  // Word-derived page char window (~6.2-6.5 chars/word incl. spaces in German
  // children's prose). The legacy bounds.min-targetMaxChars window told the
  // model to aim 800-1050 chars/page, which is mathematically BELOW the
  // whole-story word floor at 5 pages and caused polish passes to shrink
  // healthy 970-word drafts to ~650 words (log 734d7ae5).
  const pageCharsLow = Math.max(bounds.min, Math.round((wordBounds.targetMin * 6.2) / Math.max(1, chapterCount)));
  const pageCharsHigh = Math.round((wordBounds.targetMax * 6.5) / Math.max(1, chapterCount));
  const systemPrompt = [
    `You are a surgical children's-story repair editor. Repair prose in ${languageName}.`,
    "Return valid JSON only, no markdown, no commentary.",
    "Schema:",
    "{",
    '  "title": string,',
    '  "description": string,',
    '  "chapters": [',
    '    { "order": number, "title": string, "paragraphs": string[] }',
    "  ]",
    "}",
    "Use paragraphs[] for prose. Do not output content fields unless unavoidable.",
  ].join("\n");
  const reviewedBlueprint = getReviewedBlueprint(blueprint, critique);
  const compactBlueprint = compactReviewedBlueprintForRepair(reviewedBlueprint, chapterCount);
  const compactStory = buildCompactPromptStory(story);
  const compactStoryBible = buildCompactStoryBibleForDraft(input, chapterCount);
  const validatorMustFixes = asStringArray(critique?.validatorFindings?.mustFixBefore95, 10);
  const validatorWarnings = asStringArray(critique?.validatorFindings?.warnings, 8);
  const validatorBlock = validatorMustFixes.length > 0 || validatorWarnings.length > 0
    ? [
        "FINAL VALIDATOR REPAIR BRIEF (binding — fix these exact issues, do not just improve style):",
        ...validatorMustFixes.map((issue) => `- MUST: ${issue}`),
        ...validatorWarnings.map((issue) => `- WATCH: ${issue}`),
      ].join("\n")
    : "";
  const validatorText = [...validatorMustFixes, ...validatorWarnings].join(" ");
  const hasTitlePromiseIssue = diagnostics.hardIssues.some((issue) => /Titel-Versprechen unerfuellt/i.test(issue));
  const hasEndingImageIssue = diagnostics.softIssues.some((issue) => /Finale endet eher mit Erkl/i.test(issue))
    || /ending|ende|schluss|finale|moral|holding|haelt|hält|schluessel nutzt|schlüssel nutzt/i.test(validatorText);
  const hasPersonalCostIssue = diagnostics.softIssues.some((issue) => /kein pers[oö]nlicher Einsatz|kein persoenlicher Einsatz/i.test(issue))
    || /opfer|sacrifice|personal|wertvoll|valuable|object|gegenstand|heilkraut|cost/i.test(validatorText);
  const hasNoveltyIssue = /forbidden|verbot|hard-avoid|novelty|wiederholungs|zurueck|zuruck|zurück/i.test(validatorText);

  // Build a chapter-by-chapter dialogue-deficit briefing so the polish model
  // sees EXACTLY which chapters are below 18 % / 25 % and roughly how many
  // short quoted lines it needs to inject. Without this concrete budget, the
  // model tends to leave the overall dialog ratio in the low 20s.
  const dialogDeficit: Array<{ order: number; pct: number; addLines: number }> = [];
  for (const chapter of diagnostics.chapterDiagnostics || []) {
    const gap = DEV_MODE_PROMPT_DIALOG_PCT - Math.max(0, chapter.dialogPct || 0);
    if (gap <= 0) continue;
    // ~6-8 characters per spoken word, ~8 words per added short line.
    const approxWords = Math.max(40, Math.round((chapter.chars || 0) / 6));
    const wordsNeeded = Math.ceil((gap / 100) * approxWords);
    const addLines = Math.max(2, Math.min(10, Math.round(wordsNeeded / 8)));
    dialogDeficit.push({ order: chapter.order, pct: Math.round(chapter.dialogPct || 0), addLines });
  }
  const overallDialogGap = Math.max(0, DEV_MODE_PROMPT_DIALOG_PCT - Math.round(diagnostics.dialogPct || 0));

  const dialogBoostBlock = dialogDeficit.length > 0 || overallDialogGap > 0
    ? [
        "DIALOGUE INJECTION PLAN (TOP PRIORITY \u2014 the previous draft failed the dialog gate):",
        `- Overall dialog share is currently ${Math.round(diagnostics.dialogPct || 0)} % \u2014 it MUST end at \u2265 ${DEV_MODE_MIN_DIALOG_PCT} %, aim ${DEV_MODE_PROMPT_DIALOG_PCT} %.`,
        ...dialogDeficit.map((d) =>
          `- ${readingPageMode ? "Reading page" : "Chapter"} ${d.order}: currently ~${d.pct} % dialog \u2192 inject about ${d.addLines} short quoted lines (1\u20138 words each). Replace narrator sentences with character speech, not new filler chatter.`
        ),
        "- Each quoted line must DO something (action, conflict, decision, relationship beat, joke). Forbidden filler: \"Ja.\" / \"Okay.\" / \"Stimmt.\" / \"Gut.\" alone.",
        "- Convert summary or interior thought to dialogue between the on-stage characters rather than adding new ones.",
        `- CRITICAL COUPLING: injecting dialogue must NOT pull the whole story below the word target (${wordBounds.targetMin}-${wordBounds.targetMax} words). When the story is at or below target, ADD dialogue lines on top of the existing scene instead of replacing narration 1:1. Only replace narration when the story is over length.`,
      ].join("\n")
    : "";

  const rejectedPolishFeedback = critique?.rejectedPolishFeedback;
  const userPrompt = [
    `CALL 3B: STRICT GATE REPAIR + CHILDREN'S BOOK POLISH. The repaired prose must stay in ${languageName}.`,
    "You repair an existing children's story. Do not invent a different plot, but you MUST satisfy all hard gates below.",
    "If local diagnostics and your literary preference conflict, local diagnostics win. This is a mechanical repair pass first, a style polish second.",
    rejectedPolishFeedback
      ? `PREVIOUS POLISH ATTEMPT WAS REJECTED — do not repeat its mistake: ${compactExcerpt(String(rejectedPolishFeedback.instruction || ""), 280)} (before: ${rejectedPolishFeedback.beforeWords ?? "?"} words / ${rejectedPolishFeedback.beforeDialogPct ?? "?"}% dialogue, rejected attempt produced: ${rejectedPolishFeedback.afterWords ?? "?"} words / ${rejectedPolishFeedback.afterDialogPct ?? "?"}% dialogue). BOTH budgets must hold simultaneously.`
      : null,
    readingPageMode
      ? "READING-PAGE MODE: the chapters[] schema is only an app display container. Think and write as ONE continuous Vorlesegeschichte with natural reading pages. Do not create chapter arcs, chapter titles, mini-endings, recaps, or isolated page tasks."
      : null,
    broadCompressionMode
      ? "BROAD COMPRESSION MODE: this is not line editing. Rewrite every chapter compactly from the current story map; each overlong chapter must become visibly shorter before any stylistic addition is allowed."
      : null,
    hardUnderlengthMode
      ? `EXPANSION MODE: the current story has only ${diagnostics.totalWords} words. This fails the hard floor (${wordBounds.min}). Add roughly ${wordsToAddForTarget} meaningful words through action, sensory consequence, and character-specific dialogue. Do not compress. CRITICAL COUPLING: at least one third of the words you ADD must be quoted dialogue, so the dialogue share does NOT sink while you expand. Expanding with narration-only blocks gets the result rejected.`
      : null,
    dialogBoostBlock ? "" : null,
    dialogBoostBlock || null,
    hasTitlePromiseIssue
      ? "- TITLE-REPAIR PRIORITY: if the title promises a specific word or action, redeem it verbatim inside the prose. Do not dodge this by flattening the title into something vague."
      : null,
    hasEndingImageIssue
      ? "- ENDING-IMAGE PRIORITY: the final paragraph must end on one visible object/sound/motion from the world, not on explanation."
      : null,
    hasPersonalCostIssue
      ? "- COST PRIORITY: make the child visibly give up, risk, or release something concrete on-page. A private insight alone does not count."
      : null,
    hasPersonalCostIssue
      ? "- PERSONAL-VALUE PRIORITY: if the object is useful (medicine, key, tool), add the earlier emotional reason it mattered to the child, then make the child consciously give it up."
      : null,
    hasNoveltyIssue
      ? "- NOVELTY WORDING PRIORITY: remove or replace validator-listed repeated/forbidden wording if it is not load-bearing. For generic German words like 'zurück', use 'wieder', 'nach Hause', 'vorbei', or a concrete movement instead."
      : null,
    "",
    buildLeanRepairPromptContext(input, chapterCount, { readingPageMode }),
    validatorBlock || null,
    validatorBlock ? "" : null,
    "LOCKED STORY SUMMARY TO PRESERVE:",
    promptJson({
      selectedIdea: compactStoryBible.selectedIdea,
      centralObjectContract: compactStoryBible.centralObjectContract,
      mainCharacters: compactStoryBible.mainCharacters,
      supportingCast: compactStoryBible.supportingCast,
      // Title contract must follow the CURRENT story title, not the original
      // idea title. After a novelty/repair rename, the stale idea-title
      // contract instructed polish to revert the rename and reintroduce the
      // forbidden word (log 734d7ae5: "Monster" came back, pass rejected).
      titleContract: story.title
        ? { title: story.title, exactWordsToRedeem: extractTitleContentWords(story.title).slice(0, 4) }
        : compactStoryBible.titleContract,
    }),
    "",
    "HARD GATES:",
    readingPageMode ? `- Exactly ${chapterCount} reading pages in chapters[] for app compatibility.` : `- Exactly ${chapterCount} chapters.`,
    "- BUDGET COUPLING: the word target AND the dialogue floor below apply AT THE SAME TIME. Fixing one by breaking the other gets the result rejected and wastes the pass.",
    `- Whole repaired story MUST land in ${wordBounds.targetMin}-${wordBounds.targetMax} words; absolute rejection below ${wordBounds.min}. Current word count: ${diagnostics.totalWords}.`,
    readingPageMode
      ? `- That means roughly ${targetWordsPerPage}+ words (≈ ${pageCharsLow}-${pageCharsHigh} characters) per reading page. NEVER shrink the whole story to make pages symmetrical; whole-story word count wins over display symmetry.`
      : `- Each chapter must stay within ${bounds.min}-${bounds.max} characters of target-language prose; aim ${bounds.min}-${targetMaxChars} so the server count has margin.`,
    `- ${storyWordBudgetGuidance(input.config, chapterCount)}`,
    readingPageMode ? `- Each reading page MUST have ${paragraphBounds.min}-${paragraphBounds.max} paragraphs in paragraphs[]. This is a release-form hard gate; split scene beats instead of returning 1-2 large blocks.` : `- Each chapter must have ${paragraphBounds.min}-${paragraphBounds.max} paragraphs. If there are too many paragraphs, cut or merge them.`,
    `- Aim for ${paragraphBudget.targetCount} compact paragraphs; keep each paragraph around ${paragraphBudget.maxChars} characters.`,
    `- No sentence may exceed ${maxSentenceChars} characters; split long clauses into child-readable beats.`,
    input.config.length === "short"
      ? "- SHORT REPAIR: cut 25-40% before polishing. Keep only hook, conflict, turn, and pull."
      : input.config.length === "medium"
        ? "- MEDIUM REPAIR: cut decorative second images and repeated reactions before adding any line."
        : null,
    `- Overall dialogue share must be at least ${DEV_MODE_MIN_DIALOG_PCT}%; repair toward ${DEV_MODE_PROMPT_DIALOG_PCT}% so the measured result safely clears the floor.`,
    readingPageMode ? "- Per-page dialogue may vary naturally; the full story must clear the dialogue floor." : `- Every chapter must have at least ${DEV_MODE_MIN_CHAPTER_DIALOG_PCT}% dialogue.`,
    `- Target market-quality score: ${DEV_MODE_TARGET_MARKET_QUALITY_SCORE}/10; release floor for this mode is ${minReleaseScoreForMode(input.qualityMode)}/10. Anything below that needs another concrete fix, not score inflation.`,
    readingPageMode ? "- No new main figures, no new subplot, no explained moral, no summary sentences at reading breaks." : "- No new main figures, no new subplot, no explained moral, no summary sentence at chapter endings.",
    "- JSON must be valid and match the schema exactly.",
    "",
    "REPAIR METHOD:",
    broadCompressionMode
      ? "- First reduce scope and sentence count. Keep hook, conflict, turn, payoff. Delete decorative second images, repeated reactions, and recap sentences even if they sound nice."
      : null,
    hardUnderlengthMode
      ? "- First expand the causal spine: each reading-page movement needs one extra concrete obstacle/reaction, one short exchange, and one visible consequence. Do not add explanation or moral filler."
      : null,
    "- If a chapter is too long: cut explanatory narration first, not the core scene.",
    readingPageMode ? "- If a reading page has too few paragraphs: split existing action, dialogue, and reaction beats into compact paragraphs. Do not pad with filler." : null,
    "- If a chapter has too many paragraphs: combine adjacent beats into fewer paragraphs.",
    "- If dialogue is low: convert explanation into short character-specific dialogue that carries action, relationship, humor, or tension.",
    "- Do NOT add filler chatter. Every dialogue line must change action, relationship, tension, or comic timing.",
    "- Keep the same title idea, central conflict, recurring motif, and closing image.",
    "- Keep the locked central object/place as the story's causal red thread. If you remove a repeated/forbidden motif, rewrite its function; do NOT merely rename the old object (e.g. backpack -> clasp) while keeping the same backpack-like logic.",
    readingPageMode ? "- Strengthen the five scene movements through cause/effect; do not turn reading breaks into cliffhanger chapter endings." : "- Strengthen chapter endings with concrete danger, decision, question, new rule, or funny aftershock.",
    "- Preserve child agency: replace helper/adult explanations with child noticing, child choice, and a concrete action.",
    "- If the ending sounds like a lesson sentence, trade it for an image, joke, or small unfinished motion from the story world.",
    "",
    buildVoiceBibleBlock(input) || "",
    "",
    "DIALOGUE VOICE CONTRACT:",
    "- Use the named VOICE BIBLE above. Do not force generic 'careful/lively/trickster/whispering' templates if they do not match the actual characters.",
    "- Each quoted line needs at least two jobs: action, relationship, tension, subtext, or humor.",
    "- If two main avatars could swap a line without anyone noticing, rewrite the line using their age, body detail, memory habit, question style, or visible gesture.",
    "- REFRAIN PROTECTION: if the story contains a short repeated signature line (refrain), NEVER delete or flatten it. If it appears fewer than 3 times, weave it in (introduced → under pressure → transformed in the finale).",
    languageCodeFromName(localizedLanguageName(input.config.language)) === "de"
      ? "- SPRACH-ECHTHEIT: nur echte, gebräuchliche deutsche Wörter. Ersetze erfundene Komposita/Kunstwörter (z.B. \"apfelscharf\") durch echte kindgerechte Wörter (\"klein wie eine Erbse\")."
      : null,
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
    "ROTER FADEN (red thread) UND TITEL-VERTRAG:",
    buildCentralObjectContractBlock(input) || "",
    buildPremiseSeedPromiseBlock(input) || "",
    buildWonderRuleConsistencyBlock(input) || "",
    buildWonderRuleConsistencyBlock(input) || "",
    readingPageMode ? "- Identify the recurring concrete object/refrain/sound. Make sure it appears across the whole story and shifts meaning at each scene movement." : "- Identify the recurring concrete object/refrain/sound. Make sure it appears in EVERY chapter and shifts meaning each time. If a chapter is missing it, weave it in.",
    readingPageMode ? "- Every paragraph must follow causally from the previous one. If a reading page opens cold, add a bridge sentence without recap." : "- Every paragraph must follow causally from the previous one. If a chapter opens cold without a bridge from the previous chapter's last image/question, add one bridge sentence.",
    "- If the title promises specific words/concepts, those words must surface in the prose. If a title key word is missing, add it naturally \u2014 OR change the title to match the prose. Do not leave the title promise unredeemed.",
    "- NEVER delete an existing title-word mention while editing. If a title word appears only once in the prose, that sentence is load-bearing \u2014 rephrase around it, keep the word (log: a polish pass removed the story's only \"Umweg\" and re-opened the title gate).",
    "",
    "- Abstract title words (Freundlichkeit, Mut, Freundschaft, Verantwortung) must be fulfilled by concrete action/image, not by moral slogans or filler lines that only say the word.",
    "KINDERVERSTAENDLICHKEIT (children ages 6-8 must follow on first read):",
    "- Replace literary/adult words (stocksteif, gravitaetisch, sondiert, etc.) with concrete child-world images (toys, animals, food, weather, family).",
    "- Split any sentence with more than one nested subordinate clause into two simpler sentences. No Bandwurmsaetze.",
    "- Show feelings through body and action (hand wird feucht, Knie zittern), not labels (\"sie war nervoes\").",
    readingPageMode ? "- Every scene movement should leave momentum without sounding like a separate chapter ending." : "- Every chapter ending must give the child a clear pull forward: a question, an unopened door, a new object, an unfinished gesture.",
    "",
    "LOCAL DIAGNOSTICS:",
    promptJson(compactDiagnosticsForPrompt(diagnostics)),
    "",
    "LOCKED PLOT SPINE TO PRESERVE:",
    promptJson({
      premise: compactBlueprint.premise,
      storySpine: compactBlueprint.storySpine,
      coreMagicRule: compactBlueprint.coreMagicRule,
      supportingCastUse: compactBlueprint.supportingCastUse,
    }),
    "",
    "CRITIQUE FOCUS:",
    promptJson({
      mustFix: compactCritiqueForDraft(critique).mustFix,
      polishReason: compactCritiqueForDraft(critique).polishReason,
    }),
    "",
    "CURRENT STORY TO POLISH:",
    promptJson(compactStory),
    "",
    `FINAL REMINDER: title, description and ALL ${readingPageMode ? "reading-page content" : "chapter content"} must remain in ${languageName}.`,
  ].join("\n");
  return { systemPrompt, userPrompt };
}

function selectDialogueRebalanceTargets(
  story: DevModeRawStory,
  diagnostics: DevModeStoryDiagnostics,
  limit = 2
): DevModeChapter[] {
  const byOrder = new Map(story.chapters.map((chapter) => [Number(chapter.order), chapter]));
  return diagnostics.chapterDiagnostics
    .filter((chapter) => chapter.dialogPct < DEV_MODE_TARGET_DIALOG_PCT)
    .sort((a, b) => {
      const aHard = a.dialogPct < DEV_MODE_MIN_CHAPTER_DIALOG_PCT ? 1000 : 0;
      const bHard = b.dialogPct < DEV_MODE_MIN_CHAPTER_DIALOG_PCT ? 1000 : 0;
      return (bHard + (DEV_MODE_TARGET_DIALOG_PCT - b.dialogPct) * 10) - (aHard + (DEV_MODE_TARGET_DIALOG_PCT - a.dialogPct) * 10);
    })
    .slice(0, limit)
    .map((chapter) => byOrder.get(Number(chapter.order)))
    .filter((chapter): chapter is DevModeChapter => Boolean(chapter));
}

function buildDialogueRebalancePrompts(
  input: DevModeGenerationInput,
  story: DevModeRawStory,
  diagnostics: DevModeStoryDiagnostics,
  targets: DevModeChapter[]
): { systemPrompt: string; userPrompt: string } {
  const languageName = localizedLanguageName(input.config.language);
  const targetOrders = new Set(targets.map((chapter) => Number(chapter.order)));
  // When the whole story is already at/below the word target, dialogue repair
  // must not shrink pages further (log 734d7ae5: repair passes ping-ponged
  // between word floor and dialogue floor). Allow modest growth instead.
  const rebalanceWordBounds = getStoryWordBounds(input.config);
  const storyBelowWordTarget = diagnostics.totalWords < rebalanceWordBounds.targetMin;
  const targetDiagnostics = diagnostics.chapterDiagnostics
    .filter((chapter) => targetOrders.has(Number(chapter.order)))
    .map((chapter) => ({
      order: chapter.order,
      currentDialogPct: chapter.dialogPct,
      chars: chapter.chars,
      minCharsAfter: storyBelowWordTarget ? chapter.chars : undefined,
      maxCharsAfter: storyBelowWordTarget
        ? Math.max(900, Math.ceil(chapter.chars * 1.15))
        : Math.max(900, Math.floor(chapter.chars * 0.98)),
      targetDialogPctAfter: Math.max(32, Math.ceil(DEV_MODE_TARGET_DIALOG_PCT)),
      addShortLines: Math.max(3, Math.min(8, Math.ceil((DEV_MODE_TARGET_DIALOG_PCT - chapter.dialogPct) / 3))),
      issues: chapter.issues,
    }));
  const onStageNames = [
    ...(input.avatars || []).map((avatar) => avatar.name).filter(Boolean),
    ...(input.selectedIdea?.selectedSupportingCast || []),
  ];
  const systemPrompt = [
    `You repair only dialogue balance in a ${languageName} children's story.`,
    "Return JSON only. No markdown. No comments.",
    'Schema: { "replacements": [ { "order": number, "paragraphs": string[] } ] }',
  ].join("\n");
  const userPrompt = [
    "TASK: Rewrite the listed reading pages so dialogue actually carries the page.",
    storyBelowWordTarget
      ? `LENGTH GUARD: the whole story is currently BELOW its word target (${diagnostics.totalWords} words, target ${rebalanceWordBounds.targetMin}+). Convert narration into dialogue AND keep or slightly grow each page's length (targets[].minCharsAfter to targets[].maxCharsAfter). Do NOT compress the page.`
      : "This is NOT an insertion task. You MUST DELETE narration paragraphs and REPLACE them with dialogue exchanges. Inserting dialog lines on top of all existing narration is forbidden — that only inflates length and is rejected.",
    "Hard per-page constraints (all required):",
    storyBelowWordTarget
      ? `  • Page total characters after rewrite must stay between minCharsAfter and maxCharsAfter (see targets[]). Never shorter than before.`
      : `  • Page total characters after rewrite must be ≤ maxCharsAfter (see targets[].maxCharsAfter). Shorter is good.`,
    `  • Page dialogue share after rewrite must be ≥ targets[].targetDialogPctAfter (≥${Math.max(32, Math.ceil(DEV_MODE_TARGET_DIALOG_PCT))}% of page characters inside German quotation marks „ … ").`,
    "  • Keep the same scene location, same on-stage characters, same plot beats, same red-thread object.",
    "Method: take each narration paragraph that lacks dialogue, and convert most of its action into 2-4 short exchanged lines with brief stage business (1 verb tag, no adverbs). Delete the prose sentences you replaced — do not keep both.",
    "No new plot. No new characters. No new locations. No moral. No explanatory lesson sentence.",
    `Whole-story goal after this repair: dialogue share ${DEV_MODE_TARGET_DIALOG_PCT}-${DEV_MODE_PROMPT_DIALOG_PCT}%; minimum accepted ${DEV_MODE_DIALOG_REBALANCE_MIN_DIALOG_PCT}%.`,
    "Every new quoted line must carry action, decision, relationship, tension, clue, or a small joke.",
    "Do not add abstract moral/title filler (e.g. lines that only say Freundlichkeit/Mut/Freundschaft). If an abstract title word appears, make the line trigger a concrete action or visible consequence.",
    "Helper figures (sidekicks, magical guides) must NOT explain the central rule, give the answer, or summarize the moral. Their dialogue is questions, doubts, reactions, jokes — not solutions.",
    "Preserve the locked red-thread object/place; do not introduce a new object-function through dialogue.",
    "Forbidden filler: Ja. Okay. Stimmt. Gut. alone.",
    "",
    `On-stage character names only: ${onStageNames.join(", ") || "existing characters only"}.`,
    "Diagnostics:",
    promptJson({
      storyDialogPct: diagnostics.dialogPct,
      hardIssues: diagnostics.hardIssues.slice(0, 6),
      targets: targetDiagnostics,
    }),
    "",
    "Replace ONLY these reading pages; preserve their order/title and output full replacement paragraphs for each target. The replacement must be a complete rewrite of the page, not the original page with extra lines:",
    promptJson({
      title: story.title,
      description: story.description,
      targets: targets.map((chapter) => ({
        order: chapter.order,
        title: chapter.title,
        content: chapter.content,
      })),
    }),
    "",
    `Return JSON only. All replacement paragraphs must stay in ${languageName}.`,
  ].join("\n");
  return { systemPrompt, userPrompt };
}

function parseDialogueRebalanceResult(
  content: string,
  currentStory: DevModeRawStory,
  options?: { minKeepRatio?: number }
): DevModeRawStory {
  const parsed = tryParseJson(content);
  const replacements = Array.isArray(parsed?.replacements)
    ? parsed.replacements
    : Array.isArray(parsed?.chapters)
      ? parsed.chapters
      : [];
  if (replacements.length === 0) {
    throw new Error("dialogue-rebalance returned no replacements.");
  }
  let next = currentStory;
  let appliedCount = 0;
  for (const raw of replacements) {
    const order = Number(raw?.order);
    if (!Number.isFinite(order)) continue;
    const existing = currentStory.chapters.find((chapter) => Number(chapter.order) === order);
    if (!existing) continue;
    const parsedChapter = parseChapterFromModel(
      {
        order,
        title: raw?.title || existing.title,
        paragraphs: raw?.paragraphs,
        content: raw?.content,
      },
      Math.max(0, order - 1)
    );
    if (parsedChapter.content.trim() === existing.content.trim()) continue;
    // Word-floor guard: when the caller signals the story must not shrink
    // (minKeepRatio set), drop page replacements that compress the page —
    // production rebalances rewrote 1600-char pages down to ~900 chars and
    // the resulting word-count hard issue voided the whole pass.
    if (
      typeof options?.minKeepRatio === "number"
      && parsedChapter.content.length < existing.content.length * options.minKeepRatio
    ) {
      console.warn("[dev-mode-generation] dialogue-rebalance replacement skipped: page would shrink below keep-ratio", {
        order,
        beforeChars: existing.content.length,
        afterChars: parsedChapter.content.length,
        minKeepRatio: options.minKeepRatio,
      });
      continue;
    }
    next = replaceStoryChapter(next, {
      ...parsedChapter,
      title: existing.title,
      order,
    });
    appliedCount += 1;
  }
  if (appliedCount === 0) {
    // v12.1 stage-merge tripwire: model returned replacements but none changed
    // any chapter (either wrong orders, identical content, or empty paragraphs).
    // Treat as failed stage so the caller can fall back instead of silently
    // accepting an unchanged story.
    throw new Error("dialogue-rebalance produced no applicable chapter changes.");
  }
  return currentStory.displayMode === "reading_pages" ? markStoryAsReadingPages(next, currentStory) : next;
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
  const compactStory = buildCompactPromptStory(story);

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
    "- Replacement must preserve the locked central object/place and may not introduce a new object-function or a disguised replacement for a removed artifact.",
    "- If touching an abstract title word (Freundlichkeit/Mut/Freundschaft), the replacement must connect it to visible action, not a moral slogan.",
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
    buildCentralObjectContractBlock(input) || "",
    "",
    buildLeanRepairPromptContext(input, chapterCount),
    "",
    "COMPACT BLUEPRINT (for reference only — do not invent new beats):",
    promptJson(compactBlueprint),
    "",
    "CURRENT STORY (replace exact substrings only — do not return the rewritten story):",
    promptJson(compactStory),
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
  const nextStory = story.displayMode === "reading_pages"
    ? markStoryAsReadingPages({ ...story, chapters: newChapters }, story)
    : { ...story, chapters: newChapters };

  return {
    story: nextStory,
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
  // Priority: dialog-floor breaches FIRST (children's books need talk), then
  // length over/under-bound. Empirically the polish stage cuts length well but
  // rarely seeds new dialogue, so we steer rescues toward the talk-thin
  // chapters.
  return offenders
    .slice()
    .sort((a, b) => {
      const aDialogGap = Math.max(0, DEV_MODE_MIN_CHAPTER_DIALOG_PCT - a.dialogPct);
      const bDialogGap = Math.max(0, DEV_MODE_MIN_CHAPTER_DIALOG_PCT - b.dialogPct);
      const aLenSev = Math.max(0, a.chars - bounds.max) + Math.max(0, bounds.min - a.chars);
      const bLenSev = Math.max(0, b.chars - bounds.max) + Math.max(0, bounds.min - b.chars);
      const aSev = aDialogGap * 60 + aLenSev;
      const bSev = bDialogGap * 60 + bLenSev;
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

  if (/final\s+page|last\s+page|page\s+5|leseseite\s+5|ending|payoff|moral|didactic|resolution|finale|schluss|lehre|lesson/.test(findingText)) {
    add(chapterCount);
  }

  if (/chapter|page|pull|hook|cliff|weiter|sog|kapitelende/.test(findingText)) {
    for (const chapter of chapters.filter((candidate) => candidate.issues.some((issue) => /pull|weiterlese|sog/i.test(issue)))) {
      add(chapter.order);
    }
    if (selected.size === 0 && chapterCount > 1) add(Math.max(1, chapterCount - 1));
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

/**
 * v12 §P/§Q — thin wrapper over the importsafe directives module so smoke
 * tests can verify the strategy-specific repair wording. See
 * `backend/story/pipeline/repair-strategy-directives.ts` for the strings.
 */
function buildStrategyDirectivesBlock(
  strategy: DevModeRepairStrategy | undefined,
): string | null {
  return buildStrategyDirectivesBlockShared(strategy);
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
  repairAttempt: number,
  routerStrategy?: DevModeRepairStrategy,
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
  // Word-floor guard: when the WHOLE story is at/below its word target, a
  // single-chapter repair must not compress that chapter further ("write
  // shorter, not longer" caused net word loss across repair passes).
  const repairWordBounds = getStoryWordBounds(input.config);
  const storyAtOrBelowWordTarget = storyDiagnostics.totalWords <= repairWordBounds.targetMin;
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

  const strategyDirectives = buildStrategyDirectivesBlock(routerStrategy);
  const userPrompt = [
    `CALL 3B.${repairAttempt}: TARGETED CHAPTER GATE REPAIR. Repair only chapter ${chapter.order} and keep prose in ${languageName}.`,
    "This is a mechanical gate repair first and a children's-book polish second. Do not invent a new plot, a new main character, or a new subplot.",
    "The selected story model must fix the chapter itself; do not ask for another model or a fallback.",
    "Return ONLY the repaired chapter plus the required selfReflection JSON. The final story will be assembled by the server.",
    "",
    strategyDirectives,
    strategyDirectives ? "" : null,
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
    storyAtOrBelowWordTarget
      ? `- HARD LENGTH: ${bounds.min}-${bounds.max} characters of target-language prose. The whole story is at/below its word target (${storyDiagnostics.totalWords} words), so this repaired chapter must NOT get shorter than its current ${chapterDiagnostics.chars} characters; growing toward ${bounds.max} is allowed and welcome.`
      : `- HARD LENGTH: ${bounds.min}-${bounds.max} characters of target-language prose. Aim for ${bounds.min}-${targetMaxChars}; if unsure, write shorter, not longer.`,
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
  const compactStory = buildCompactPromptStory(story);
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
  const readingPageMode = story.displayMode === "reading_pages" || Array.isArray(story.readingBreaks);
  const anchorBlock = validatorAnchorBlock(code);
  const contextSummary = [
    `Output language: ${languageName}`,
    `Age group: ${input.config.ageGroup}`,
    readingPageMode ? `Display mode: reading_pages; exactly ${chapterCount} technical reading pages, not story chapters` : `Chapter count: exactly ${chapterCount}`,
    `Genre: ${input.config.genre}`,
    `Setting: ${input.config.setting}`,
    `Main characters: ${(input.avatars || []).map((avatar) => avatar.name).filter(Boolean).join(", ") || "unspecified"}`,
    `Supporting pool used: ${(input.selectedIdea?.selectedSupportingCast || []).join(", ") || "none"}`,
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
    readingPageMode ? "- Reading-page boundaries are app display breaks, not story chapters. Do NOT require each reading page to behave like a standalone chapter or have a title-shaped mini-arc." : null,
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
    readingPageMode ? "- If the continuous story itself lacks forward momentum between scene movements: max 8.6." : "- Chapter endings without read-on pull: max 8.6.",
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
    "LANGUAGE AUTHENTICITY CHECK (mandatory): scan the prose for invented/non-existent words, malformed compounds, or unidiomatic phrasing in the target language (e.g. a made-up German adjective like 'apfelscharf'). Each such word is a mustFixBefore95 entry quoting the exact word and a real-word replacement; 2+ occurrences cap marketQualityScore at 8.4.",
    "Be honest. A truthful 7.8 beats a flattering 9.2. Self-inflating the score would be a pipeline error.",
    "",
    "VALIDATION TARGET:",
    contextSummary,
    "",
    "NOVELTY BRIEF USED FOR THIS GENERATION:",
    buildCompactValidationNoveltyBlock(input),
    "",
    "LOCKED WINNING IDEA FOR THIS GENERATION:",
    buildCompactValidationIdeaBlock(input),
    buildPremiseSeedPromiseBlock(input) || "",
    buildWonderRuleConsistencyBlock(input) || "",
    "VALIDATOR CHECK: if the premise seed mutation is only visible as title flavor or description but not as causal on-page mechanics, cap marketQualityScore at 8.6 and list it in mustFixBefore95.",
    "",
    "LOCAL DIAGNOSTICS OF THE FINAL STORY:",
    promptJson(compactDiagnosticsForPrompt(diagnostics || null)),
    "",
    "STORY:",
    promptJson(compactStory),
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
  const trimmed = stripReasoningPreamble(raw.trim());
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

function recoverCompleteObjectsFromArrayProperty(content: string, propertyName: string): any[] {
  const propertyIndex = content.indexOf(`"${propertyName}"`);
  if (propertyIndex < 0) return [];
  const arrayStart = content.indexOf("[", propertyIndex);
  if (arrayStart < 0) return [];

  const objects: any[] = [];
  let depth = 0;
  let objectStart = -1;
  let inString = false;
  let escape = false;

  for (let i = arrayStart + 1; i < content.length; i += 1) {
    const ch = content[i];

    if (inString) {
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
      continue;
    }

    if (ch === "{") {
      if (depth === 0) objectStart = i;
      depth += 1;
      continue;
    }

    if (ch === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && objectStart >= 0) {
        const objectText = content.slice(objectStart, i + 1);
        try {
          objects.push(tryParseJson(objectText));
        } catch {
          // A single malformed completed object should not prevent recovery of
          // earlier/later completed candidates.
        }
        objectStart = -1;
      }
      continue;
    }

    if (ch === "]" && depth === 0) break;
  }

  return objects;
}

function recoverTruncatedIdeaCandidatePayload(content: string): any | null {
  const candidates = recoverCompleteObjectsFromArrayProperty(content, "candidates");
  if (candidates.length === 0) return null;
  return {
    candidates,
    recoveredFromTruncatedJson: true,
    recoveredCandidateCount: candidates.length,
  };
}

function readJsonStringLiteral(source: string, start: number): { value: string; end: number } | null {
  if (source[start] !== '"') return null;
  let escape = false;
  for (let i = start + 1; i < source.length; i += 1) {
    const ch = source[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      const literal = source.slice(start, i + 1);
      try {
        return { value: JSON.parse(literal), end: i + 1 };
      } catch {
        return { value: literal.slice(1, -1), end: i + 1 };
      }
    }
  }
  return null;
}

function findMatchingJsonBracket(source: string, start: number): number {
  const open = source[start];
  const close = open === "[" ? "]" : open === "{" ? "}" : "";
  if (!close) return -1;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (inString) {
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
      continue;
    }
    if (ch === open) {
      depth += 1;
    } else if (ch === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function recoverTopLevelStringArrayProperties(content: string, propertyName: string): string[][] {
  const trimmed = stripReasoningPreamble(String(content || "").trim());
  const source = repairLooseJson(sliceToOuterObject(stripJsonFence(trimmed)));
  const arrays: string[][] = [];
  let braceDepth = 0;
  let arrayDepth = 0;

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];

    if (ch === '"') {
      const token = readJsonStringLiteral(source, i);
      if (!token) continue;
      let afterToken = token.end;
      while (afterToken < source.length && /\s/.test(source[afterToken])) afterToken += 1;

      if (
        braceDepth === 1
        && arrayDepth === 0
        && token.value === propertyName
        && source[afterToken] === ":"
      ) {
        let valueStart = afterToken + 1;
        while (valueStart < source.length && /\s/.test(source[valueStart])) valueStart += 1;
        if (source[valueStart] === "[") {
          const arrayEnd = findMatchingJsonBracket(source, valueStart);
          if (arrayEnd > valueStart) {
            const arrayText = source.slice(valueStart, arrayEnd + 1);
            try {
              const parsedArray = JSON.parse(repairLooseJson(arrayText));
              if (Array.isArray(parsedArray)) {
                const paragraphs = parsedArray
                  .map((item: any) => String(item || "").trim())
                  .filter(Boolean);
                if (paragraphs.length > 0) arrays.push(paragraphs);
              }
            } catch {
              // Ignore one malformed duplicate array and keep scanning. A later
              // complete array can still rescue usable prose.
            }
            i = arrayEnd;
            continue;
          }
        }
      }

      i = token.end - 1;
      continue;
    }

    if (ch === "{") braceDepth += 1;
    else if (ch === "}" && braceDepth > 0) braceDepth -= 1;
    else if (ch === "[") arrayDepth += 1;
    else if (ch === "]" && arrayDepth > 0) arrayDepth -= 1;
  }

  return arrays;
}

function recoverDuplicateWholeStoryParagraphs(
  content: string,
  parsed: any
): { paragraphs: string[]; arrayCount: number; parsedParagraphCount: number } | null {
  if (Array.isArray(parsed?.chapters)) return null;
  const arrays = recoverTopLevelStringArrayProperties(content, "paragraphs");
  if (arrays.length <= 1) return null;
  const paragraphs = arrays.flat().map((p) => p.trim()).filter(Boolean);
  const parsedParagraphCount = Array.isArray(parsed?.paragraphs)
    ? parsed.paragraphs.map((p: any) => String(p || "").trim()).filter(Boolean).length
    : 0;
  if (paragraphs.length <= parsedParagraphCount) return null;
  return { paragraphs, arrayCount: arrays.length, parsedParagraphCount };
}

function stripReasoningPreamble(content: string): string {
  const text = String(content || "").trim();
  if (!text) return text;

  const markerPatterns = [
    /\n\s*```(?:json)?\s*\{/i,
    /(?:^|\n)\s*\{/,
    /(?:^|\n)\s*(?:TITLE|TITEL)\s*[:=]/i,
    /(?:^|\n)\s*(?:DESCRIPTION|BESCHREIBUNG)\s*[:=]/i,
    /(?:^|\n)\s*(?:STORY|GESCHICHTE)\s*[:=]/i,
  ];

  const markerIndex = markerPatterns
    .map((pattern) => {
      const match = text.match(pattern);
      return match?.index ?? -1;
    })
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];

  if (!markerIndex || markerIndex <= 0) return text;
  const prefix = text.slice(0, markerIndex);
  const looksLikeReasoning =
    /\*\*[^*\n]{3,80}\*\*/.test(prefix) ||
    /\bI'm\s+(?:now|currently|focusing|exploring|integrating|refining|drafting|counting)\b/i.test(prefix) ||
    /\b(?:reasoning|thinking|drafting|refining|structuring|integrating|developing|finalizing)\b/i.test(prefix);

  return looksLikeReasoning ? text.slice(markerIndex).trim() : text;
}

function splitParagraphs(text: string): string[] {
  return String(text || "")
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function splitLooseProseParagraphs(text: string): string[] {
  const paragraphSource = splitParagraphs(text);
  if (paragraphSource.length >= 4) return paragraphSource;

  const lineSource = String(text || "")
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (lineSource.length >= 4) return lineSource;

  const normalized = (lineSource.length > 0 ? lineSource : paragraphSource).join(" ").replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const sentences = normalized.match(/[^.!?]+[.!?]+["')\]]*/g) || [];
  if (sentences.length < 4) return paragraphSource.length > 0 ? paragraphSource : [normalized];

  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    current = `${current} ${sentence.trim()}`.trim();
    if (countWords(current) >= 45 || current.length >= 360) {
      chunks.push(current);
      current = "";
    }
  }
  if (current) chunks.push(current);
  return chunks.length >= 4 ? chunks : paragraphSource.length > 0 ? paragraphSource : [normalized];
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

function normalizeParagraphsToRange(
  paragraphs: string[],
  minParagraphs = DEV_MODE_MIN_PARAGRAPHS,
  maxParagraphs = DEV_MODE_MAX_PARAGRAPHS
): string[] {
  let normalized = paragraphs.map((part) => String(part || "").trim()).filter(Boolean);
  if (normalized.length > 0 && normalized.length < minParagraphs) {
    const expanded = normalized.flatMap((paragraph) => splitLooseProseParagraphs(paragraph));
    if (expanded.length > normalized.length) {
      normalized = expanded;
    }
  }
  if (normalized.length > 0 && normalized.length < minParagraphs) {
    const expanded = splitLooseProseParagraphs(normalized.join(" "));
    if (expanded.length > normalized.length) {
      normalized = expanded;
    }
  }
  return normalizeParagraphsToMax(normalized, maxParagraphs);
}

function paragraphsToContent(paragraphs: string[]): string {
  return normalizeParagraphsToRange(paragraphs).join("\n\n").trim();
}

// v13 — reading-page layout rebalancer. Runs on the FINAL reading-page story
// (after all repair/polish passes) so the PDF and reader do not render orphan
// mini-pages next to bloated pages. Run a75b53af ("Das Labyrinth der zwei
// Wege") shipped a 9-page PDF from 5 reading pages: pages with 8 paragraphs
// and one 1703-char page overflowed while a single-sentence beat sat alone.
//
// Deterministic, meaning-preserving: it only (1) merges an under-length page
// into its shorter neighbour and (2) moves whole paragraphs from an
// over-length page onto a neighbour. It never rewrites, splits, or drops
// prose, and it keeps the page COUNT fixed (chapterCount) so the reading-page
// contract and image count stay intact.
function rebalanceReadingPageLayout(
  chapters: DevModeChapter[],
  config: StoryConfig,
): { chapters: DevModeChapter[]; changed: boolean } {
  if (chapters.length <= 1) return { chapters, changed: false };

  const bounds = getChapterLengthBounds(config);
  const paragraphBounds = getParagraphBounds(config);
  const sorted = chapters.slice().sort((a, b) => a.order - b.order);

  // Work on a paragraph-array-per-page model; reassemble at the end.
  const pages: string[][] = sorted.map((ch) => splitParagraphs(ch.content));
  const charsOf = (paras: string[]) => paras.reduce((sum, p) => sum + p.length, 0);
  const MIN_PAGE_CHARS = Math.round(bounds.min * 0.55); // orphan threshold
  let changed = false;

  // Pass 1: rescue orphan pages (too few chars) by pulling one paragraph from
  // the longest adjacent neighbour, longest-page-first, bounded so we never
  // create a new orphan.
  for (let guard = 0; guard < pages.length * 2; guard += 1) {
    const orphanIdx = pages.findIndex(
      (paras) => charsOf(paras) < MIN_PAGE_CHARS && paras.length < paragraphBounds.max,
    );
    if (orphanIdx === -1) break;
    const leftIdx = orphanIdx - 1;
    const rightIdx = orphanIdx + 1;
    const leftDonor = leftIdx >= 0 && pages[leftIdx].length > paragraphBounds.min ? leftIdx : -1;
    const rightDonor = rightIdx < pages.length && pages[rightIdx].length > paragraphBounds.min ? rightIdx : -1;
    let donorIdx = -1;
    if (leftDonor !== -1 && rightDonor !== -1) {
      donorIdx = charsOf(pages[leftDonor]) >= charsOf(pages[rightDonor]) ? leftDonor : rightDonor;
    } else if (leftDonor !== -1) donorIdx = leftDonor;
    else if (rightDonor !== -1) donorIdx = rightDonor;
    if (donorIdx === -1) break; // no donor can spare a paragraph
    // Move the paragraph adjacent to the orphan so reading order is preserved.
    if (donorIdx < orphanIdx) {
      pages[orphanIdx].unshift(pages[donorIdx].pop() as string);
    } else {
      pages[orphanIdx].push(pages[donorIdx].shift() as string);
    }
    changed = true;
  }

  // Pass 2: relieve char-over-length pages by pushing the boundary paragraph
  // onto the neighbour with more char room. Room is measured in CHARACTERS,
  // not paragraph count: run 67d63377 (GLM "Die Stiefel…") had pages 1+2 at
  // 1506/1587 chars but already at the 6-paragraph ceiling, so the old
  // paragraph-count guard treated both neighbours as "full" and left the
  // overflow (→ 8-page PDF). Paragraph count is repaired afterwards by pass 3.
  for (let guard = 0; guard < pages.length * 4; guard += 1) {
    const overIdx = pages.findIndex((paras) => charsOf(paras) > bounds.max && paras.length > 1);
    if (overIdx === -1) break;
    const leftIdx = overIdx - 1;
    const rightIdx = overIdx + 1;
    // A neighbour has room if it would stay at/under bounds.max after taking
    // the boundary paragraph. Prefer the neighbour with more char headroom.
    const boundaryLeftLen = pages[overIdx][pages[overIdx].length - 1]?.length ?? 0;
    const boundaryRightLen = pages[overIdx][0]?.length ?? 0;
    const leftRoom = leftIdx >= 0 && charsOf(pages[leftIdx]) + boundaryLeftLen <= bounds.max
      ? bounds.max - charsOf(pages[leftIdx]) : -1;
    const rightRoom = rightIdx < pages.length && charsOf(pages[rightIdx]) + boundaryRightLen <= bounds.max
      ? bounds.max - charsOf(pages[rightIdx]) : -1;
    if (leftRoom < 0 && rightRoom < 0) break; // no neighbour has char room
    if (rightRoom >= leftRoom) {
      pages[rightIdx].unshift(pages[overIdx].pop() as string);
    } else {
      pages[leftIdx].push(pages[overIdx].shift() as string);
    }
    changed = true;
  }

  // Pass 3: reduce paragraph COUNT on pages that exceed the paragraph ceiling
  // even though their char count is fine. Over-fine granulation (8 short
  // paragraphs on one page) is what pushes the PDF into overflow pages. Merge
  // the two shortest ADJACENT paragraphs in-page until the ceiling is met.
  // This preserves reading order and text; it only removes a blank-line break.
  for (let pageIdx = 0; pageIdx < pages.length; pageIdx += 1) {
    let safety = 0;
    while (pages[pageIdx].length > paragraphBounds.max && safety < 20) {
      safety += 1;
      const paras = pages[pageIdx];
      let mergeAt = 0;
      let shortestPair = Number.POSITIVE_INFINITY;
      for (let i = 0; i < paras.length - 1; i += 1) {
        const pair = paras[i].length + paras[i + 1].length;
        if (pair < shortestPair) {
          shortestPair = pair;
          mergeAt = i;
        }
      }
      paras.splice(mergeAt, 2, `${paras[mergeAt]} ${paras[mergeAt + 1]}`.trim());
      changed = true;
    }
  }

  if (!changed) return { chapters, changed: false };

  const rebalanced = sorted.map((ch, idx) => ({
    ...ch,
    content: pages[idx].join("\n\n").trim(),
  }));
  return { chapters: rebalanced, changed: true };
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
  if (paragraphs.length > 0 && (paragraphs.length < DEV_MODE_MIN_PARAGRAPHS || paragraphs.length > DEV_MODE_MAX_PARAGRAPHS)) {
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

interface NoveltyGateIssueSet {
  hard: string[];
  soft: string[];
}

function collectNoveltyGateIssues(
  story: DevModeRawStory,
  input: DevModeGenerationInput
): NoveltyGateIssueSet {
  const brief = input.noveltyBrief;
  if (!brief) return { hard: [], soft: [] };
  const hard: string[] = [];
  const soft: string[] = [];
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
      // v12 (post-fix from logs.1779277372031): only ANCHOR/local-repair
      // motifs hard-fail the story. Recent-stories drift words like "loffel"
      // are children's-book vocabulary — flag as soft so the polish round
      // can revise, but never let one body-mention sink an otherwise-ready
      // release.
      const message = `Wiederholungs-/Novelty-Gate: verbotenes oder kuerzlich verwendetes Motiv gefunden: "${motif}".`;
      if (isHardBanMotif(motif)) {
        hard.push(message);
      } else {
        soft.push(message);
      }
      // We collected the strongest signal for this motif; move on.
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
    // Title/blurb collision with a recent story IS a real release blocker —
    // a child seeing two stories with the same surface motif on the same
    // shelf is exactly what the novelty system exists to prevent.
    hard.push(`Wiederholungs-/Novelty-Gate: Titel/Blurb ist zu nah an letzter Story "${closestTitle}" (Motivueberschneidung ${Math.round(closestScore * 100)}%).`);
  }

  return { hard, soft };
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

// German synonym clusters for common title adjectives/verbs. The title gate
// requires that the *concept* surfaces in the story body — not necessarily
// the exact word. Without this, "Der verschwundene Socken" hard-fails even
// though the body says "der Socken war weg / fehlte / niemand fand ihn".
// Map keys are normalized (lowercase, base form prefix); values are stems
// (5 chars max) that we test with buildWordStemRegex.
const TITLE_PROMISE_SYNONYMS_DE: Record<string, string[]> = {
  "verschw": ["verschw", "weg", "fehlt", "vermis", "verlor", "spurl", "wohin", "nicht da", "fort"],
  "fehlen": ["fehlt", "verschw", "weg", "vermis", "verlor"],
  "verlor": ["verlor", "weg", "fehlt", "verschw", "spurl"],
  "vermis": ["vermis", "fehlt", "weg", "verschw"],
  "gehei": ["gehei", "raets", "ratse", "mysti", "ratsel"],
  "raets": ["raets", "ratse", "ratsel", "gehei", "myste"],
  "magisc": ["magis", "zaube", "wunde", "verzau"],
  "zaube": ["zaube", "magis", "wunde", "verzau"],
  "munte": ["munte", "frohli", "lust", "lebha", "vergn"],
  "wunder": ["wunde", "magis", "zaube", "stau"],
  "spannen": ["spann", "aufre", "abent", "erleb"],
  "luste": ["lust", "frohl", "vergn", "kichi", "munte"],
  "frohli": ["frohl", "lust", "vergn", "munte"],
  "tapfe": ["tapfe", "mutig", "trau", "mut "],
  "mutig": ["mutig", "tapfe", "trau", "mut "],
  "mut":   ["mut", "mutig", "tapfe", "trau"],
  "mutes": ["mut", "mutig", "tapfe", "trau"],
  "neugi": ["neugi", "wunde", "forsc", "frage"],
  "kluge": ["klug", "schl", "weis", "klau"],
  "schla": ["schla", "klug", "weis", "klau"],
  "stille": ["still", "leis", "ruhi", "lautl"],
  "leise": ["leis", "still", "lautl", "ruhi"],
  "laute": ["laut", "krac", "donne", "geras"],
  "muede": ["muede", "schlaf", "matte", "ersch"],
  "garten": ["garten", "hof", "innen", "beet", "wurz"],
  "singend": ["sing", "sang", "lied", "klang", "melod", "musik"],
  "singen": ["sing", "sang", "lied", "klang", "melod", "musik"],
  "jahres": ["jahres", "frueh", "früh", "sommer", "herbst", "winter"],
};

function expandTitleWordToStems(word: string): string[] {
  const normalized = word.toLowerCase();
  const stems: string[] = [normalized.slice(0, Math.min(normalized.length, 6))];
  // German case-ending normalization: a title word in genitive/dative/plural
  // (Mutes, Mannes, Kompasses, Kindes) must still match the nominative stem
  // in the body. Strip common short endings and add the trimmed form so
  // "mutes" also matches "Mut".
  const caseTrimmed = normalized
    .replace(/(?:esses|sses)$/u, "ss")
    .replace(/(?:es|en|em|er|e|s)$/u, "")
    .trim();
  if (caseTrimmed && caseTrimmed.length >= 3 && caseTrimmed !== normalized) {
    stems.push(caseTrimmed.slice(0, Math.min(caseTrimmed.length, 6)));
  }
  // Find the longest matching cluster key that is a prefix of the word.
  let bestKey: string | null = null;
  for (const key of Object.keys(TITLE_PROMISE_SYNONYMS_DE)) {
    if (normalized.startsWith(key) && (bestKey === null || key.length > bestKey.length)) {
      bestKey = key;
    }
  }
  if (bestKey) {
    for (const syn of TITLE_PROMISE_SYNONYMS_DE[bestKey]) {
      stems.push(syn);
    }
  }
  return stems;
}

function titleWordSatisfiedByBody(word: string, body: string): boolean {
  // Exact-word check FIRST. The stem pipeline truncates to 6 chars and allows
  // only 5 continuation chars, which made long German compounds UNSATISFIABLE:
  // "kristalllinse" became stem "krista" and \bkrista\w{0,5}\b can never match
  // the 13-char word itself (log 0e8c0a4e: the prose contained "Kristalllinse"
  // five times and the gate still hard-failed, capping the run at 7.9).
  if (word && body.toLowerCase().includes(word.toLowerCase())) return true;
  const stems = expandTitleWordToStems(word);
  for (const stem of stems) {
    const safe = stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").trim();
    if (!safe) continue;
    // Multi-word stems (e.g. "nicht da") use literal search.
    if (safe.includes(" ")) {
      if (body.toLowerCase().includes(safe)) return true;
      continue;
    }
    // Long title words are usually compounds (Kristalllinse, Sockenschublade):
    // give the suffix window enough room to cover the rest of the compound.
    const suffixBudget = Math.max(5, word.length - stem.length + 3);
    const re = new RegExp(`\\b${safe}\\w{0,${suffixBudget}}\\b`, "i");
    if (re.test(body)) return true;
  }
  return false;
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
    // Semantic check: word counts as fulfilled if its stem OR any of its
    // German synonym-cluster stems appear in the body. Falls back to the
    // legacy strict stem regex if no cluster matches.
    return !titleWordSatisfiedByBody(word, body);
  });
  if (missing.length === 0) return [];
  // Limit to a single soft issue so we don't flood diagnostics.
  return [
    `Titel-Versprechen unerfuellt: Kernwoerter aus dem Titel fehlen im Storytext (${missing.slice(0, 3).join(", ")}). Loese das Titelversprechen im Text ein oder schaerfe den Titel.`,
  ];
}

function normalizeTitleForIntegrity(title: string): string {
  return String(title || "")
    .toLowerCase()
    .replace(/[„""''«»‚‹›()\[\]{},.:;!?—–\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleLooksLikeDanglingFragment(title: string): boolean {
  const normalized = normalizeTitleForIntegrity(title);
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length < 2) return true;
  const last = words[words.length - 1] || "";
  if (/^(der|die|das|den|dem|des|ein|eine|einer|eines|und|oder|von|vom|im|in|am|an|zu|zum|zur)$/.test(last)) return true;
  // German dangling participle/adjective fragments such as
  // "Der Garten der singenden" read like a missing noun. Deterministic
  // title repair must never ship those; prefer a model rewrite or the
  // locked idea title instead.
  if (/(enden|ende|ender|endes|ene|enen|ener|enes)$/.test(last) && words.length <= 4) return true;
  return false;
}

function restoreSelectedIdeaTitleIfFragment<T extends DevModeRawStory>(story: T, input: DevModeGenerationInput): T {
  const selectedTitle = input.selectedIdea?.title?.trim();
  const generatedTitle = story.title?.trim();
  if (!selectedTitle || !generatedTitle) return story;
  const selectedNorm = normalizeTitleForIntegrity(selectedTitle);
  const generatedNorm = normalizeTitleForIntegrity(generatedTitle);
  if (!selectedNorm || !generatedNorm || selectedNorm === generatedNorm) return story;
  const generatedIsSelectedPrefix = selectedNorm.startsWith(generatedNorm) && selectedNorm.length > generatedNorm.length;
  if (!generatedIsSelectedPrefix && !titleLooksLikeDanglingFragment(generatedTitle)) return story;
  const body = `${story.description || ""}\n${story.chapters.map((chapter) => `${chapter.title}\n${chapter.content}`).join("\n")}`;
  const missingSelectedWords = extractTitleContentWords(selectedTitle).filter((word) => !titleWordSatisfiedByBody(word, body));
  // Restore only when the story body already pays the selected title promise.
  // If the body truly failed the title promise, the normal title-promise gate
  // should repair the prose or ask the model for a complete alternative title.
  if (missingSelectedWords.length > 0) return story;
  console.warn("[dev-mode-generation] Restoring selected idea title after broken title fragment", {
    generatedTitle,
    selectedTitle,
  });
  return { ...story, title: selectedTitle };
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
    const neatLessonPattern = /\b(Fehler|Mut|Freundschaft|Magie|Zauber|Fragen|Zusammenhalt|Geschichten|Ehrlichkeit|Wahrheit|Schuld|Verantwortung|Gold)\b.{0,48}\b(sind|ist|machen|macht|bedeutet|heisst|heißt|wichtiger)\b/i;
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
  const readingPageMode = story.displayMode === "reading_pages" || Array.isArray(story.readingBreaks);

  if (story.chapters.length !== chapterCount) {
    hardIssues.push(readingPageMode
      ? `Erwartet ${chapterCount} Leseseiten, erhalten ${story.chapters.length}.`
      : `Erwartet ${chapterCount} Kapitel, erhalten ${story.chapters.length}.`);
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

  // v12 §3 (post-fix from logs.1779277372031): split novelty gate into
  // hard (ANCHOR motifs, title/blurb collision) and soft (recent-story
  // drift words). Soft hits cap the score via existing softIssue path but
  // no longer block release of an otherwise-ready story.
  const noveltyIssues = collectNoveltyGateIssues(story, input);
  for (const issue of noveltyIssues.hard) hardIssues.push(issue);
  for (const issue of noveltyIssues.soft) softIssues.push(issue);
  if (!shouldExposeDevModeArtifact(input) && input.matchedArtifact?.name && textMentionsArtifact(input, allContent)) {
    hardIssues.push(`Unterdruecktes Pool-Artefakt "${input.matchedArtifact.name}" ist in die Prosa gerutscht; entferne es semantisch und halte den roten Faden bei "${getLockedCentralObject(input) || "dem Zentralobjekt"}".`);
    polishInstructions.push("Pool-Artefakt nicht lexikalisch umbenennen: Funktion auf das gesperrte Zentralobjekt/Zentralort der Idee zurueckbauen.");
  }
  for (const castIssue of collectSelectedCastIssues(story, input)) {
    hardIssues.push(castIssue);
  }

  // v11 §7: pool/helper characters must not directly explain the solution.
  // Soft by default; HARD in premium when the violation appears in 2+
  // chapters OR in any finale-adjacent chapter (last two).
  const helperNames = (input.selectedIdea?.selectedSupportingCast || []).slice();
  if (helperNames.length > 0 && languageCode === "de") {
    const triggeredChapters: number[] = [];
    let firstEvidence = "";
    let firstHelper = "";
    for (const chapter of story.chapters) {
      const result = detectHelperExplainsSolution(chapter.content, helperNames);
      if (result.triggered) {
        triggeredChapters.push(chapter.order);
        if (!firstEvidence) {
          firstEvidence = result.evidence?.slice(0, 80) || "";
          firstHelper = result.helper || helperNames[0] || "Helfer";
        }
      }
    }
    if (triggeredChapters.length > 0) {
      const finaleAdjacent = triggeredChapters.some((order) => order >= story.chapters.length - 1);
      const isPremium = (input.qualityMode || "premium") === "premium";
      const message = `Helper-Explains-Gate: ${firstHelper} erklaert die Magieregel/Loesung direkt im Dialog (${firstEvidence}) in Kapitel ${triggeredChapters.join(",")}. Helfer dürfen scheitern, stören oder ein Werkzeug geben — nicht die Magieregel oder Lösung aussprechen.`;
      if (isPremium && (triggeredChapters.length >= 2 || finaleAdjacent)) {
        hardIssues.push(message);
      } else {
        softIssues.push(message);
      }
      polishInstructions.push(
        "Lass Helfer NICHT die Magieregel oder Lösung erklären. Stattdessen: Helfer gibt nur ein Werkzeug, Druck oder eine missverständliche Geste; die Kinder müssen die Regel selbst aus wiederholten Folgen herausfinden."
      );
    }
  }

  // v11 §8: grammar artefacts that need LLM repair (not auto-fix).
  if (languageCode === "de") {
    const grammar = validateGermanGrammar(allContent);
    for (const issue of grammar.hardIssues) hardIssues.push(issue);
    if (grammar.hardIssues.length > 0) {
      polishInstructions.push(
        "Behebe Grammatik-Artefakte vollständig (z.B. 'Ich Idee' → 'Ich habe eine Idee'; 'Der ist silberne' → 'Der ist silbern')."
      );
    }
  }

  // v11 §6: structural signals (irreversible middle, personal sacrifice,
  // image-not-moral finale). Missing signals become soft issues so the
  // existing scoreCap regexes ("irreversibleMiddle ..." -> max 8.3) trigger.
  if (story.chapters.length >= 3 && languageCode === "de") {
    const structure = detectStructureSignals(
      story.chapters.map((c) => ({ order: c.order, title: c.title, content: c.content }))
    );
    if (!structure.hasIrreversibleMiddle) {
      softIssues.push("Strukturelle Schwäche: keine sichtbare irreversible Mitte (Verlust, sichtbare Veränderung, Schrumpfen) erkannt.");
    }
    if (!structure.hasPersonalSacrifice) {
      softIssues.push("Strukturelle Schwäche: kein persönlicher Einsatz/Opfer erkannt (Figur gibt etwas Geliebtes her).");
    }
    if (!structure.finaleEndsInImage) {
      softIssues.push("Finale endet eher mit Erklärung als mit Bild/Handlung; baue konkrete Schlussbeobachtung ein.");
    }
  }
  for (const titleIssue of collectTitlePromiseIssues(story, input)) {
    // Title-promise is a HARD gate: if the title makes a concrete promise and
    // the prose never redeems it, the book misleads the child reader. Polish
    // must either weave the missing words in or sharpen the title.
    hardIssues.push(titleIssue);
    // Extract the missing words from the issue string so the polish prompt
    // can reference them by name.
    const missingMatch = titleIssue.match(/\(([^)]+)\)/);
    const missingWords = missingMatch ? missingMatch[1] : "";
    polishInstructions.push(
      missingWords
        ? `Titel-Vertrag einloesen: Die Titel-Kernwoerter (${missingWords}) MUESSEN im Prosatext erscheinen \u2014 entweder wortgetreu in mindestens einem Satz/Dialog (z. B. \"... ist verschwunden\") ODER kuerze den Titel beim Polish so, dass er zum vorhandenen Text passt. Beides ist erlaubt, eins ist Pflicht.`
        : "Loese das Titel-Versprechen ein: arbeite die zentralen Titel-Begriffe spuerbar in mindestens ein Kapitel ein (gerne als Refrain oder Reim), oder schaerfe den Titel beim Polish so, dass er zum Storyinhalt passt."
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

  const minDialogPct = (input.qualityMode || "premium") === "premium"
    ? DEV_MODE_DIALOG_REBALANCE_MIN_DIALOG_PCT
    : DEV_MODE_MIN_DIALOG_PCT;
  if (dialogPct < minDialogPct) {
    hardIssues.push(`Dialoganteil ist mit ${dialogPct}% zu niedrig; Minimum ${minDialogPct}%, Soft-Ziel ${DEV_MODE_TARGET_DIALOG_PCT}%, Prompt-Ziel ${DEV_MODE_PROMPT_DIALOG_PCT}%.`);
  } else if (dialogPct < DEV_MODE_TARGET_DIALOG_PCT) {
    softIssues.push(`Dialoganteil ist mit ${dialogPct}% knapp unter Soft-Zielwert ${DEV_MODE_TARGET_DIALOG_PCT}% trotz Prompt-Ziel ${DEV_MODE_PROMPT_DIALOG_PCT}%.`);
  } else if (dialogPct > DEV_MODE_MAX_DIALOG_PCT) {
    softIssues.push(`Dialoganteil ist mit ${dialogPct}% zu hoch (Obergrenze ${DEV_MODE_MAX_DIALOG_PCT}%); ersetze einen Teil der wörtlichen Rede durch sinnliche Erzählung, Handlung und innere Wahrnehmung, damit die Vorlese-Melodie nicht in reinem Geplauder untergeht.`);
  }

  if (totalWords > wordBounds.max) {
    hardIssues.push(`Story ist deutlich zu lang (${totalWords} Woerter; Ziel ${wordBounds.targetMin}-${wordBounds.targetMax}, Maximum ${wordBounds.max}).`);
    polishInstructions.push("Kuerze den Scope: pro Kapitel nur Hook, Konflikt, Wendung und Pull behalten; dekorative Nebenbilder und Wiederholungen streichen.");
  } else if (totalWords > wordBounds.targetMax) {
    softIssues.push(`Story ist etwas zu lang (${totalWords} Woerter; Ziel ${wordBounds.targetMin}-${wordBounds.targetMax}).`);
    polishInstructions.push("Kuerze Erklaerungen und zweite Sinnesbilder, damit die Geschichte im Zielbereich bleibt.");
  } else if (totalWords < wordBounds.min) {
    const issue = `Story ist deutlich zu kurz (${totalWords} Woerter; Ziel ${wordBounds.targetMin}-${wordBounds.targetMax}, Minimum ${wordBounds.min}).`;
    if ((input.qualityMode || "premium") === "premium") hardIssues.push(issue);
    else softIssues.push(issue);
    polishInstructions.push(`Erweitere auf mindestens ${wordBounds.targetMin} Woerter: pro Szenenbewegung ein zusaetzliches konkretes Handlungsdetail, ein kurzer Dialogwechsel oder eine sichtbare Folge. Keine allgemeine Erklaerung, kein Moralabsatz.`);
  }

  story.chapters.forEach((chapter, index) => {
    const issues: string[] = [];
    const chars = chapter.content.length;
    const paragraphs = countParagraphs(chapter.content);
    const chapterDialogPct = chars > 0 ? Math.round((countDialogChars(chapter.content) / chars) * 1000) / 10 : 0;
    const chapterLongestSentence = longestSentenceChars(chapter.content);
    const chapterPrefix = readingPageMode
      ? `Leseseite ${chapter.order || index + 1}`
      : `Kapitel ${chapter.order || index + 1}`;

    // Grace margin: modest chapter-length variation is a quality warning, not
    // a reason to abort generation. The LLM regularly undercounts characters;
    // keep hard failures for clear pacing problems, not a single fuller scene.
    const chapterHardMaxOver = bounds.max + (
      input.config.length === "short" ? 180 : input.config.length === "long" ? 450 : 300
    );
    const chapterHardMinUnder = Math.max(0, bounds.min - 100);
    if (chars < chapterHardMinUnder) {
      issues.push(`zu kurz (${chars} Zeichen)`);
      if (readingPageMode) {
        softIssues.push(`${chapterPrefix} / Leseseite ist kurz (${chars}; Ziel ${bounds.min}-${bounds.max}) - nur Display-Balance, keine Story-Reparatur erzwingen.`);
      } else {
        hardIssues.push(`${chapterPrefix} ist deutlich zu kurz (${chars}; Ziel ${bounds.min}-${bounds.max}).`);
      }
    } else if (chars < bounds.min) {
      issues.push(`leicht zu kurz (${chars} Zeichen)`);
      softIssues.push(`${chapterPrefix} ist leicht zu kurz (${chars}; Ziel ${bounds.min}-${bounds.max}).`);
    } else if (chars > chapterHardMaxOver) {
      issues.push(`deutlich zu lang (${chars} Zeichen)`);
      if (readingPageMode) {
        softIssues.push(`${chapterPrefix} / Leseseite ist lang (${chars}; Ziel ${bounds.min}-${bounds.max}) - nur Display-Balance, keine Kapitel-Reparatur erzwingen.`);
      } else {
        hardIssues.push(`${chapterPrefix} ist deutlich zu lang (${chars}; Ziel ${bounds.min}-${bounds.max}).`);
      }
    } else if (chars > bounds.max) {
      issues.push(`leicht zu lang (${chars} Zeichen)`);
      softIssues.push(`${chapterPrefix} ist leicht zu lang (${chars}; Ziel ${bounds.min}-${bounds.max}).`);
    }

    if (paragraphs < paragraphBounds.min) {
      issues.push(`zu wenige Absaetze (${paragraphs})`);
      if (readingPageMode) {
        softIssues.push(`${chapterPrefix} / Leseseite hat wenige Absaetze (${paragraphs}; Ziel ${paragraphBounds.min}-${paragraphBounds.max}) - Display-Hinweis, kein dramaturgischer Hard-Gate.`);
      } else {
        hardIssues.push(`${chapterPrefix} hat zu wenige Absaetze (${paragraphs}; Ziel ${paragraphBounds.min}-${paragraphBounds.max}).`);
      }
    } else if (paragraphs > paragraphBounds.max) {
      issues.push(`zu viele Absaetze (${paragraphs})`);
      if (readingPageMode) {
        softIssues.push(`${chapterPrefix} / Leseseite hat viele Absaetze (${paragraphs}; Ziel ${paragraphBounds.min}-${paragraphBounds.max}) - Display-Hinweis, kein dramaturgischer Hard-Gate.`);
      } else {
        hardIssues.push(`${chapterPrefix} hat zu viele Absaetze (${paragraphs}; Ziel ${paragraphBounds.min}-${paragraphBounds.max}).`);
      }
    }

    const lastParagraph = chapter.content.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean).slice(-1)[0] || "";
    if (!readingPageMode && index < story.chapters.length - 1 && !hasForwardPull(lastParagraph)) {
      issues.push("Kapitelende hat wenig Weiterlese-Sog");
      softIssues.push(`${chapterPrefix} endet ohne klaren Pull zur naechsten Szene.`);
    }

    if (chapterDialogPct < DEV_MODE_MIN_CHAPTER_DIALOG_PCT) {
      issues.push(`wenig Dialog (${chapterDialogPct}%)`);
      if (readingPageMode) {
        softIssues.push(`${chapterPrefix} / Leseseite hat wenig Dialog (${chapterDialogPct}%; Story-Gesamtanteil ist massgeblich).`);
      } else {
        hardIssues.push(`${chapterPrefix} hat zu wenig Dialog (${chapterDialogPct}%; Minimum ${DEV_MODE_MIN_CHAPTER_DIALOG_PCT}%).`);
      }
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
    polishInstructions.push(readingPageMode
      ? `Halte Leseseiten grob bei ${bounds.min}-${bounds.max} Zeichen und ${paragraphBounds.min}-${paragraphBounds.max} Absaetzen, aber nicht auf Kosten des durchgehenden Storyflusses.`
      : `Bringe Kapitel naeher an ${bounds.min}-${bounds.max} Zeichen und ${paragraphBounds.min}-${paragraphBounds.max} Absaetze, ohne die Szenenhaftigkeit zu verlieren.`);
  }
  if (hardIssues.some((issue) => /zu langen Satz/i.test(issue))) {
    polishInstructions.push("Kuerze zu lange Saetze: aufteilen, Nebensaetze entfernen und kindnahe Hauptsaetze bevorzugen.");
  }
  if (softIssues.some((issue) => /Pull|Weiterlese/i.test(issue))) {
    polishInstructions.push(readingPageMode
      ? "Schaerfe den kontinuierlichen Lesesog zwischen Szenenbewegungen, ohne Leseseiten wie Kapitelenden klingen zu lassen."
      : "Schaerfe jedes Nicht-Final-Kapitelende: letzter Absatz mit Frage, Gefahr, Entscheidung, komischem Nachhall oder neuem konkretem Detail.");
  }
  polishInstructions.push(readingPageMode
    ? "Staerke Lesesog und Wiedererkennung: ein Leitmotiv/Refrain/Objekt soll ueber die ganze Geschichte hinweg wiederkommen und im Finale emotional oder plotrelevant auszahlen."
    : "Staerke Lesesog und Wiedererkennung: ein Leitmotiv/Refrain/Objekt soll in mehreren Kapiteln wiederkommen und im Finale emotional oder plotrelevant auszahlen.");
  polishInstructions.push("Fixe Namens-, Tipp- und Grammatikfehler. Keine neuen Figuren, keine neue Nebenhandlung, keine Meta-Erklaerung.");

  const needsPolish = hardIssues.length > 0 || (!readingPageMode && softIssues.length >= 3);
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

function parseStageObject(content: string, stage?: DevModePipelineStage): { parsed?: any; parseError?: string } {
  try {
    const parsed = tryParseJson(content);
    if (stage === "whole-story-draft") {
      const recovered = recoverDuplicateWholeStoryParagraphs(content, parsed);
      if (recovered) {
        return {
          parsed: {
            ...parsed,
            paragraphs: recovered.paragraphs,
            recoveredFromDuplicateParagraphKeys: true,
            recoveredParagraphArrayCount: recovered.arrayCount,
            recoveredParagraphCount: recovered.paragraphs.length,
          },
          parseError: `Recovered ${recovered.paragraphs.length} paragraphs from ${recovered.arrayCount} duplicate paragraphs arrays; normal JSON kept only ${recovered.parsedParagraphCount}`,
        };
      }
    }
    return { parsed };
  } catch (err) {
    if (stage === "idea-candidates") {
      const recovered = recoverTruncatedIdeaCandidatePayload(content);
      if (recovered) {
        const originalError = err instanceof Error ? err.message : String(err);
        return {
          parsed: recovered,
          parseError: `${originalError}; recovered ${recovered.recoveredCandidateCount} complete idea candidate(s) from truncated JSON`,
        };
      }
    }
    return {
      parseError: err instanceof Error ? err.message : String(err),
    };
  }
}

function applyGermanDialogueQuoteAutoFix(text: string): { text: string; changed: boolean; fixes: string[] } {
  if (!text) return { text: "", changed: false, fixes: [] };
  const fixed = text.replace(/"([^"\n\r]{1,500})"/g, "„$1“");
  return {
    text: fixed,
    changed: fixed !== text,
    fixes: fixed !== text ? ["straight-dialogue-quotes"] : [],
  };
}

// Deterministic repair for the tiny class of German grammar artefacts that
// have exactly one correct expansion. Production shipped „Ich Idee", sagte
// Alexander (log a27e9788) at the emotional climax — the validator pattern
// existed but the LLM repair never ran. These cases are safe to fix without
// a model. The lookahead (punctuation/quote/end) prevents touching sequences
// like a miscapitalized verb ("Ich Frage mich").
function applyGermanGrammarAutoFix(text: string): { text: string; changed: boolean; fixes: string[] } {
  if (!text) return { text: "", changed: false, fixes: [] };
  const fixes: string[] = [];
  let out = text;
  const pairs: Array<[RegExp, string]> = [
    [/\bIch\s+Idee\b(?=\s*[,.!?…"“”‘’]|$)/g, "Ich habe eine Idee"],
    [/\bIch\s+Frage\b(?=\s*[,.!?…"“”‘’]|$)/g, "Ich habe eine Frage"],
    [/\bIch\s+Antwort\b(?=\s*[,.!?…"“”‘’]|$)/g, "Ich habe eine Antwort"],
    [/\bIch\s+Plan\b(?=\s*[,.!?…"“”‘’]|$)/g, "Ich habe einen Plan"],
  ];
  for (const [pattern, replacement] of pairs) {
    const next = out.replace(pattern, replacement);
    if (next !== out) {
      out = next;
      fixes.push("german-missing-verb-ich-noun");
    }
  }
  // ASCII → German typographic quotes. Kimi/Moonshot frequently emits
  // straight double quotes (or mixes them with „…“), which trips the hard
  // gate `ASCII-Anfuehrungszeichen in Storytext gefunden` and caps the score
  // at 7.8 (run 3db9b3b0). Convert every remaining straight double quote by
  // alternating opener/closer across the whole text, and normalise any
  // stray lone curly-close used as an opener. Deterministic and safe: the
  // gate only cares that no ASCII " survives in non-English prose.
  if (/"|„[^“]*„/.test(out)) {
    // Convert each straight double quote to the correct German mark by
    // tracking open/closed state across ALL quote characters (so mixed
    // „…“ + "…" prose stays balanced). A straight quote while a dialogue is
    // open becomes a closer, otherwise an opener; existing curly marks just
    // update the state. Also repairs doubled openers („…„).
    let quoteOpen = false;
    let converted = "";
    for (const ch of out) {
      if (ch === "„") {
        // A second opener while a dialogue is already open is Kimi using „
        // where a closer belongs (run 3db9b3b0: `komm her!„ Alexander`).
        converted += quoteOpen ? "“" : "„";
        quoteOpen = !quoteOpen;
      } else if (ch === "“") {
        quoteOpen = false;
        converted += ch;
      } else if (ch === '"') {
        converted += quoteOpen ? "“" : "„";
        quoteOpen = !quoteOpen;
      } else {
        converted += ch;
      }
    }
    if (converted !== out) {
      out = converted;
      fixes.push("ascii-to-german-quotes");
    }
  }
  // Typographic cleanup: stray space before a closing German quote
  // („Er schrumpft! “ → „Er schrumpft!“) — shipped in log b9994e62.
  const spacingFixed = out.replace(/([^\s„])\s+“/g, "$1“");
  if (spacingFixed !== out) {
    out = spacingFixed;
    fixes.push("german-quote-spacing");
  }
  // Close a dialogue quote the model left open at paragraph end
  // („Das Gras ist glatt! — page ended without “).
  const parts = out.split(/(\n\s*\n)/);
  let balanceChanged = false;
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (!part || /^\n\s*\n$/.test(part)) continue;
    const opens = (part.match(/„/g) || []).length;
    const closes = (part.match(/“/g) || []).length;
    if (opens === closes + 1 && !part.trimEnd().endsWith("“")) {
      parts[i] = part.trimEnd() + "“";
      balanceChanged = true;
    }
  }
  if (balanceChanged) {
    out = parts.join("");
    fixes.push("german-unbalanced-quote-closed");
  }
  return { text: out, changed: out !== text, fixes: [...new Set(fixes)] };
}

function applyDeterministicStoryTextAutofixes(
  story: DevModeRawStory,
  input: DevModeGenerationInput
): { story: DevModeRawStory; changed: boolean; fixes: string[] } {
  const languageCode = languageCodeFromName(localizedLanguageName(input.config.language));
  const fixes: string[] = [];
  const fixedChapters = story.chapters.map((chapter) => {
    let content = chapter.content;
    const ortho = applyOrthographyAutoFix(content);
    if (ortho.changed) {
      content = ortho.text;
      fixes.push(...ortho.fixes);
    }

    if (languageCode === "de") {
      const quotes = applyGermanDialogueQuoteAutoFix(content);
      if (quotes.changed) {
        content = quotes.text;
        fixes.push(...quotes.fixes);
      }
      const grammar = applyGermanGrammarAutoFix(content);
      if (grammar.changed) {
        content = grammar.text;
        fixes.push(...grammar.fixes);
      }
    }

    return content !== chapter.content ? { ...chapter, content } : chapter;
  });

  if (fixes.length === 0) return { story, changed: false, fixes: [] };
  const fixedStory = story.displayMode === "reading_pages"
    ? markStoryAsReadingPages({ ...story, chapters: fixedChapters }, story)
    : { ...story, chapters: fixedChapters };
  return { story: fixedStory, changed: true, fixes: [...new Set(fixes)] };
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

function releaseDimensionFailures(validatorFindings: any, opts?: { mode?: DevModeQualityMode }): string[] {
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

  const failures = checks
    .filter(([, score]) => Number.isFinite(score) && Number(score) < DEV_MODE_MIN_RELEASE_DIMENSION_SCORE)
    .map(([name, score]) => `${name} ${score} is below ${DEV_MODE_MIN_RELEASE_DIMENSION_SCORE}.`);

  // Premium-only raw per-dimension thresholds. The 8.4-score postmortem
  // showed that paired-MIN aggregates can mask a single weak dimension
  // (iconicCharacters 7.5 with everything else >=8.5 still ships at 8.4
  // overall). Block premium until each of these holds independently.
  const isPremium = (opts?.mode || "premium") === "premium";
  if (isPremium) {
    const premiumPerDim: Array<[string, number]> = [
      ["emotionalEngine", 8.5],
      ["iconicCharacters", 8.2],
      ["voiceDistinctiveness", 8.2],
      ["endingPayoff", 8.5],
      ["keyMomentPayoff", 8.5],
    ];
    for (const [dim, floor] of premiumPerDim) {
      const raw = Number(scores[dim] ?? NaN);
      if (Number.isFinite(raw) && raw < floor) {
        failures.push(`${dim} ${raw} is below premium floor ${floor}.`);
      }
    }
  }

  return failures;
}

/**
 * Premium-strict structural gate. Independent of the validator's numerical
 * scores: enforces hard floors on dialog percentage, presence of a tangible
 * personal cost, and absence of helper-explains-solution. Returns issues
 * only when mode === "premium".
 */
function releasePremiumStrictGate(
  diagnostics: DevModeStoryDiagnostics | undefined,
  mode: DevModeQualityMode | undefined,
): string[] {
  if ((mode || "premium") !== "premium") return [];
  if (!diagnostics) return [];
  const issues: string[] = [];

  if (Number.isFinite(diagnostics.dialogPct) && diagnostics.dialogPct < DEV_MODE_MIN_DIALOG_PCT) {
    issues.push(`dialogPct ${diagnostics.dialogPct.toFixed(1)}% is below premium floor ${DEV_MODE_MIN_DIALOG_PCT}%.`);
  }

  const allIssues = [
    ...(diagnostics.softIssues || []),
    ...(diagnostics.hardIssues || []),
  ];
  const helperExplainsTriggered = allIssues.some((s) =>
    /Helper-Explains-Gate|erklaert die Loesung|erklärt die Lösung|nimmt die finale Handlung|steht im Finale im Zentrum/i.test(s)
  );
  if (helperExplainsTriggered) {
    issues.push("helperExplainsSolution detected — premium requires helpers that complicate, not solve.");
  }

  const missingPersonalCost = allIssues.some((s) =>
    /kein persönlicher Einsatz|kein persoenlicher Einsatz|personalCost|Personal Cost/i.test(s)
  );
  if (missingPersonalCost) {
    issues.push("personalCost not detected in final story — premium requires a visible, named sacrifice.");
  }

  return issues;
}

function releaseBlockingValidatorMustFixes(validatorFindings: any, mode?: DevModeQualityMode): string[] {
  if ((mode || "premium") !== "premium") return [];
  const mustFixes = asStringArray(validatorFindings?.mustFixBefore95, 12).map((fix) => fix.trim()).filter(Boolean);
  if (mustFixes.length === 0) return [];
  const materialIssuePattern = /final|ending|schluss|finale|dialog|wonder\s*rule|wunder|regel|color|farbe|didactic|lehre|moral|premise|seed|mutation|red\s*thread|roter\s*faden|causal|payoff|helper|deus|agency|agentur|voice|stimme/i;
  return mustFixes
    .filter((fix) => materialIssuePattern.test(fix))
    .map((fix) => `Validator must-fix before premium release: ${fix}`);
}

// --- RepairRouter (v11 Section E + v12 §O) -----------------------------
// The pure router lives in pipeline/repair-router.ts so smoke tests can
// import it without the Encore runtime. This file re-exports the symbols
// so existing call sites (and external imports) keep working.
export type DevModeRepairStrategy = RepairRouterStrategy;
export type RepairRouterContext = RepairRouterCtx;

export function chooseRepairStrategy(
  diagnostics: DevModeStoryDiagnostics | undefined,
  opts?: RepairRouterContext,
): { strategy: DevModeRepairStrategy; reason: string } {
  return chooseRepairStrategyShared(diagnostics as any, opts);
}

export function isDeterministicRepairStrategy(strategy: DevModeRepairStrategy): boolean {
  return isDeterministicRepairStrategyShared(strategy);
}

export function maxRepairAttemptsFor(mode: DevModeQualityMode | undefined): number {
  return maxRepairAttemptsForShared(mode);
}

function calculateLocalGateScore(
  diagnostics?: DevModeStoryDiagnostics,
  opts?: { qualityMode?: "efficient" | "premium" }
): number | undefined {
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

  // v12 §1: in premium any open hard-gate caps the score below 8.0 so a
  // release-grade run can never coexist with hardIssueCount>0. Efficient
  // mode keeps the looser 8.6 cap as before.
  const isPremium = (opts?.qualityMode || "premium") === "premium";
  if (diagnostics.hardIssueCount > 0) {
    score = Math.min(score, isPremium ? DEV_MODE_PREMIUM_QUALITY_SCORE_CAP_ON_HARD_GATE : 8.6);
  }
  if (diagnostics.hardIssueCount >= 4) score = Math.min(score, isPremium ? 7.4 : 8.2);
  if (diagnostics.hardIssues.some((issue) => /Verbotenes|Moral|ASCII|Namensfehler|Novelty|Wiederholungs|\[object Object\]/i.test(issue))) {
    score = Math.min(score, 7.8);
  }

  return Math.max(0, Math.round(score * 10) / 10);
}

function applyHardCaps(
  llmScore: number | undefined,
  diagnostics?: DevModeStoryDiagnostics,
  opts?: { qualityMode?: "efficient" | "premium" }
): number | undefined {
  const localGateScore = calculateLocalGateScore(diagnostics, opts);
  let score = typeof llmScore === "number" && Number.isFinite(llmScore) ? llmScore : localGateScore;
  if (score === undefined) return undefined;

  if (diagnostics) {
    if (diagnostics.dialogPct < DEV_MODE_MIN_DIALOG_PCT) score = Math.min(score, 8.4);
    if (diagnostics.dialogPct < 18) score = Math.min(score, 7.9);
    // v12 §1: any unresolved hard gate caps the score at the premium
    // cap (7.9). Premium release requires hardIssueCount===0 AND score>=9.0,
    // so the two can never be satisfied at the same time with open gates.
    if (diagnostics.hardIssueCount > 0) score = Math.min(score, DEV_MODE_PREMIUM_QUALITY_SCORE_CAP_ON_HARD_GATE);
    if (diagnostics.hardIssueCount >= 2) score = Math.min(score, 7.4);
    if (diagnostics.hardIssueCount >= 4) score = Math.min(score, 6.9);
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
    // --- v11/v12 scoring caps ------------------------------------------
    // v12 §T: title promise missing → max 8.0 (compromise between the legacy
    // 8.2 cap and the strict spec value of 7.5; the user picked 8.0).
    if (diagnostics.softIssues.some((issue) => /Titel-Versprechen unerfuellt/i.test(issue))
        || diagnostics.hardIssues.some((issue) => /Titel-Versprechen unerfuellt/i.test(issue))) {
      score = Math.min(score, 8.0);
    }
    // v12 §T: raw JSON / [object Object] leaked into the prose → max 4.5.
    // Hard ceiling because the story is literally unreadable to a child.
    if (diagnostics.hardIssues.some((issue) => /\[object Object\]|raw JSON|RoheJSON|JSON-Fragment|brokenJson|broken JSON/i.test(issue))) {
      score = Math.min(score, 4.5);
    }
    // v12 §T: page count wrong → max 7.5. The PDF layout depends on the
    // exact required page count; a mismatch always blocks release.
    if (diagnostics.hardIssues.some((issue) => /Seitenzahl|pageCount|page count|Restseite|Orphan|orphan page/i.test(issue))) {
      score = Math.min(score, 7.5);
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
    if (diagnostics.softIssues.some((issue) => /erklaert die Loesung|erklärt die Lösung|Helper-Explains-Gate|nimmt die finale Handlung|steht im Finale im Zentrum/i.test(issue))) {
      score = Math.min(score, 8.2);
    }
    // v11 §6 structural caps.
    if (diagnostics.softIssues.some((issue) => /keine sichtbare irreversible Mitte/i.test(issue))) {
      score = Math.min(score, 8.3);
    }
    if (diagnostics.softIssues.some((issue) => /kein persönlicher Einsatz|kein persoenlicher Einsatz/i.test(issue))) {
      score = Math.min(score, 8.4);
    }
    if (diagnostics.softIssues.some((issue) => /Finale endet eher mit Erkl/i.test(issue))) {
      score = Math.min(score, 8.5);
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

function shouldBlockDevModeQualityGateFailure(
  input: DevModeGenerationInput,
  diagnostics?: DevModeStoryDiagnostics
): boolean {
  if (!diagnostics || diagnostics.hardIssueCount === 0) return false;
  if (input.config.strictQualityGates === true || (input.config as any).strictReleaseGateMode === "block") {
    return true;
  }

  // Keep user-facing generation resilient for narrative-quality misses, but
  // still block corrupted payloads that would not render as a usable story.
  return diagnostics.hardIssues.some((issue) =>
    /Kaputte Platzhalter|\[object Object\]|Erwartet \d+ (?:Kapitel|Leseseiten), erhalten 0/i.test(issue)
  );
}

function shouldBlockDevModePotentialGateFailure(input: DevModeGenerationInput): boolean {
  return shouldBlockPremiumPotentialGateFailure({
    qualityMode: input.qualityMode,
    strictQualityGates: input.config.strictQualityGates,
    strictReleaseGateMode: (input.config as any).strictReleaseGateMode,
    debug: input.debug,
  });
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
  openRouterResponseFormat?: "json_object" | "text";
  modelRole?: "support" | "selected-story";
  /**
   * Last-resort escape hatch: run this writer stage on the ORIGINALLY
   * selected model even when the §5 writer-model floor is active. Used by
   * the draft fallback after the floor model failed twice — a finished
   * story on the weaker model always beats a failed generation.
   */
  skipWriterModelFloor?: boolean;
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

function shouldUsePlainTextWholeStoryDraft(config: StoryConfig): boolean {
  if (config.aiProvider !== "openrouter") return false;
  return isOpenRouterTextCompatibilityModel(resolveSelectedOpenRouterStoryModel(config));
}

// Step 5 \u2014 Writer-model quality floor. The final whole-story draft is where
// prose quality is won or lost, yet support stages run on a cheap lite model.
// If the wizard-selected story model is ITSELF a weak "lite/nano/mini" tier,
// the final prose would be capped at that quality. This floor upgrades every
// writer stage (modelRole "selected-story": draft, redraft, polish, chapter
// repair, rebalance, punchup) to a clearly stronger model, so a strong draft
// is not flattened again by a mini-tier polish pass. Explicit strong choices
// stay untouched. Opt-out via `config.upgradeWriterModel === false`.
//
// OpenRouter path: the wizard exposes a full model picker (normal AND dev
// mode), so an explicit OpenRouter selection is ALWAYS respected \u2014 the user
// controls quality/cost directly in the wizard. The wizard's default and
// recommendation is moonshotai/kimi-k2.6 for prose quality (EQ-Bench
// Creative 1753, top open-weight). Its OpenRouter price is $0.65/$3.41 per 1M
// (verified live 2026-07-09) \u2014 comparable to, not dramatically cheaper than,
// gpt-mini ($0.75/$4.50); the earlier $0.15/$0.45 figure quoted here was
// wrong and overstated the savings by ~7x. Weak-tier picks like gpt-mini
// still write measurably flat stories (runs 93129526, cc6a80eb: 22.9%
// dialogue, 616 words, interchangeable voices) \u2014 that trade-off now lives in
// the wizard, not in a silent backend override (which broke run a5059aef).
//
// "mini" must not match "gemini" or "minimax": require a non-'e' character
// (or string start) before it and a word boundary or hyphen after it.
function isWeakWriterTierModelId(modelId: string): boolean {
  return /flash-lite|-lite\b|nano|haiku|(?:^|[^e])mini(?:-|\b)/.test(modelId.toLowerCase());
}

function resolveDevModeWriterModelFloor(
  config: StoryConfig
): Pick<ProviderCallOptions, "modelOverride" | "providerOverride" | "openRouterModelOverride"> | null {
  if ((config as any)?.upgradeWriterModel === false) return null;
  // Explicit OpenRouter selections come straight from the wizard picker \u2014
  // never overridden (see block comment above).
  if (config.aiProvider === "openrouter") return null;
  const selected = String(resolveConfiguredStoryModel(config) || config.aiModel || "").toLowerCase();
  if (!selected) return null;
  // Already the upgrade target \u2014 nothing to do.
  if (selected === GEMINI_MAIN_STORY_MODEL.toLowerCase()) return null;
  if (!isWeakWriterTierModelId(selected)) return null;
  return { modelOverride: GEMINI_MAIN_STORY_MODEL, providerOverride: "native" };
}

function openRouterReasoningForDevMode(model: string): { effort?: "none" | "minimal" | "low" | "medium" | "high" | "xhigh"; exclude: boolean; enabled?: boolean } {
  const normalized = String(model || "").toLowerCase();
  if (/google\/gemini|gemini-pro|gemini-flash/.test(normalized)) {
    return { effort: "minimal", exclude: true };
  }
  // Hybrid-thinking models (Anthropic, Kimi/Moonshot, GLM, Qwen, DeepSeek,
  // MiniMax & co.) switch extended thinking ON whenever OpenRouter receives
  // a reasoning object WITHOUT enabled:false — `exclude:true` only hides the
  // thinking from the response, it does not disable it. The hidden thinking
  // then consumes the entire max_tokens window: run a5059aef (claude) and run
  // 38b65185 (kimi-k2.6) both burned minutes of generation and returned an
  // EMPTY completion with finish_reason=length. Writer stages need plain
  // prose — disable thinking explicitly for every family that supports the
  // toggle. Only plain OpenAI gpt-* models keep the legacy `exclude`-only
  // shape, which is proven in production.
  if (isOpenRouterTextCompatibilityModel(normalized)) {
    return { enabled: false, exclude: true };
  }
  return { exclude: true };
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
  // Expansion repairs rewrite the WHOLE story at target length (medium:
  // 900-1200 words ≈ 2400+ tokens of German prose plus JSON scaffolding).
  // 3400 left the model squeezed between "expand" and "stay under budget";
  // a higher cap costs nothing unless used.
  if (config.length === "long") return 9000;
  if (config.length === "short") return 3200;
  return 4600;
}

function devModeIdeaCandidateMaxTokens(config: StoryConfig, retry: boolean): number {
  if (config.length === "long") return retry ? 5600 : 5000;
  if (config.length === "short") return retry ? 3600 : 3200;
  return retry ? 4400 : 4000;
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
    const responseFormat = options.openRouterResponseFormat || (forceJsonObjectFormat ? "json_object" : "text");
    const reasoning = openRouterReasoningForDevMode(orModel);
    console.log(`[dev-mode-generation] Calling OpenRouter model: ${orModel}`, {
      forceJsonObjectFormat,
      responseFormat,
      reasoning,
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
        responseFormat,
        reasoning,
        includeReasoning: false,
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
  // §5 writer-model floor: resolved once, then applied by runStage to EVERY
  // "selected-story" stage (draft, redraft, polish, chapter repair, rebalance,
  // punchup) so a strong draft is never degraded by a weaker repair model.
  const writerModelFloor = resolveDevModeWriterModelFloor(input.config);
  if (writerModelFloor) {
    console.log("[dev-mode-generation] §5 writer-model floor active for all writer stages", {
      selectedModel: resolveConfiguredStoryModel(input.config) || input.config.aiModel,
      upgradedTo: writerModelFloor.modelOverride || writerModelFloor.openRouterModelOverride,
    });
  }
  const recentStoryFingerprints = input.noveltyBrief?.recentStories || await loadRecentDevModeStoryFingerprints(input);
  input = {
    ...input,
    noveltyBrief: input.noveltyBrief || buildDevModeNoveltyBrief(input, recentStoryFingerprints),
  };

  // Artifact selection from pool. Picked BEFORE idea-candidates so the chosen
  // prop can act as the red-thread object across the whole pipeline (idea,
  // blueprint, draft, polish). Failure must NEVER block story generation \u2014
  // dev-mode is also used for cold-start / smoke runs without artifact_pool.
  if (!input.matchedArtifact) {
    try {
      const matched = await selectDevModeArtifact(input, recentStoryFingerprints);
      if (matched) {
        input = { ...input, matchedArtifact: matched };
        console.log("[dev-mode-generation] Selected artifact from pool", {
          id: matched.id,
          name: matched.name,
          category: matched.category,
          rarity: matched.rarity,
        });
      }
    } catch (err) {
      console.warn("[dev-mode-generation] Artifact selection skipped:", (err as Error)?.message || err);
    }
  }

  const runStage = async (
    stage: DevModePipelineStage,
    prompts: { systemPrompt: string; userPrompt: string },
    rawOptions: ProviderCallOptions
  ): Promise<{ provider: ProviderResult; parsed?: any; parseError?: string }> => {
    // §5: every writer stage gets the floor model; explicit per-stage
    // overrides do not exist on the writer path, so floor-last is safe.
    // The floored model may tokenize German prose differently and larger
    // models write slightly longer JSON — grant ~30% completion headroom so
    // a floor upgrade can never turn into a finish_reason=length truncation.
    const applyWriterFloor =
      rawOptions.modelRole === "selected-story"
      && Boolean(writerModelFloor)
      && rawOptions.skipWriterModelFloor !== true;
    const options: ProviderCallOptions = applyWriterFloor
      ? {
          ...rawOptions,
          ...writerModelFloor,
          maxTokens: Math.min(16000, Math.round((rawOptions.maxTokens ?? 4200) * 1.3)),
        }
      : rawOptions;
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
      const parsedStage = parseStageObject(provider.content, stage);

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

  const recordLocalStage = (stage: DevModePipelineStage, parsed: any) => {
    stageLogs.push({
      stage,
      systemPrompt: "",
      userPrompt: "",
      parsed,
      durationMs: 0,
    });
  };

  console.log("[dev-mode-generation] Dev mode adaptive chapter-repair quality pipeline", {
    pipeline: DEV_MODE_PIPELINE_ID,
    runtimeHotfix: DEV_MODE_RUNTIME_HOTFIX,
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
    plainTextWholeStoryDraft: shouldUsePlainTextWholeStoryDraft(input.config),
    noveltySeed: input.noveltyBrief?.seed,
    recentStoryCount: input.noveltyBrief?.recentStories.length ?? 0,
    hardAvoidMotifCount: input.noveltyBrief?.hardAvoidMotifs.length ?? 0,
    noveltyKeyMomentLens: input.noveltyBrief?.keyMomentLens,
    selectedIdeaTitle: input.selectedIdea?.title,
    selectedPremiseSeedId: input.selectedIdea?.premiseSeedId,
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
  let screenplayPlan: DevModeScreenplayPlan | undefined;

  try {
    const ideaCandidatePrompts = buildIdeaCandidatePrompts(input, chapterCount);
    const ideaCandidatesStage = await runStage("idea-candidates", ideaCandidatePrompts, {
      maxTokens: devModeIdeaCandidateMaxTokens(input.config, false),
      temperature: 0.92,
      timeoutMs: 90_000,
      ...supportCallOptions,
      modelRole: "support",
    });
    ideaCandidates = normalizeIdeaCandidates(ideaCandidatesStage.parsed, input.poolCharacters);
    let lastUsableIdeaCandidates = ideaCandidates;

    {
      const potentialFailureSummaries: string[] = [];
      for (let ideaRound = 1; ideaRound <= DEV_MODE_MAX_IDEA_ROUNDS && !selectedIdea; ideaRound += 1) {
        if (ideaRound > 1) {
          const retryIdeaPrompts = buildIdeaCandidatePrompts(input, chapterCount, {
            round: ideaRound,
            previousPotentialFailures: potentialFailureSummaries,
          });
          const retryIdeaStage = await runStage("idea-candidates", retryIdeaPrompts, {
            maxTokens: devModeIdeaCandidateMaxTokens(input.config, true),
            temperature: 0.96,
            timeoutMs: 90_000,
            ...supportCallOptions,
            modelRole: "support",
          });
          const retryCandidates = normalizeIdeaCandidates(retryIdeaStage.parsed, input.poolCharacters);
          if (retryCandidates.length === 0) {
            console.warn("[dev-mode-generation] Idea candidate retry returned no usable candidates; keeping last usable pool for fallback", {
              round: ideaRound,
              lastUsableCount: lastUsableIdeaCandidates.length,
            });
            continue;
          }
          ideaCandidates = retryCandidates;
          lastUsableIdeaCandidates = retryCandidates;
        }

        if (ideaCandidates.length === 0) {
          console.warn("[dev-mode-generation] Idea candidate stage returned no usable candidates; retrying before potential filter", {
            round: ideaRound,
          });
          continue;
        }

        const potentialFilterCandidates = selectPotentialFilterCandidates(ideaCandidates, input, 3);
        if (potentialFilterCandidates.length < ideaCandidates.length) {
          recordLocalStage("potential-filter", {
            round: ideaRound,
            localTop3PreFilter: true,
            candidateCount: ideaCandidates.length,
            auditedCandidateCount: potentialFilterCandidates.length,
            auditedTitles: potentialFilterCandidates.map((candidate) => candidate.title),
          });
        }
        const potentialFilterPrompts = buildPotentialFilterPrompts(input, chapterCount, potentialFilterCandidates, ideaRound);
        const potentialFilterStage = await runStage("potential-filter", potentialFilterPrompts, {
          maxTokens: 2200,
          temperature: 0.16,
          timeoutMs: 90_000,
          ...supportCallOptions,
          modelRole: "support",
        });
        const potentialFilter = normalizePotentialFilterResult(
          potentialFilterStage.parsed,
          potentialFilterCandidates,
          input,
          input.poolCharacters
        );
        screenplayPlan = { ...(screenplayPlan || {}), potentialFilter };
        console.log("[dev-mode-generation] 9.0 potential filter", {
          round: ideaRound,
          passing: potentialFilter.passingCandidateIds,
          audits: potentialFilter.candidateAudits.map(auditSummaryLine),
        });

        if (potentialFilter.roundRecommendation === "pass") {
          selectedIdea = selectedIdeaFromPotentialFilter(potentialFilter, ideaCandidates, input.poolCharacters);
          break;
        }

        potentialFailureSummaries.push(...potentialFilter.candidateAudits.map(auditSummaryLine));
      }

      if (!selectedIdea && ideaCandidates.length === 0 && lastUsableIdeaCandidates.length > 0) {
        ideaCandidates = lastUsableIdeaCandidates;
      }

      if (!selectedIdea && ideaCandidates.length === 0) {
        ideaCandidates = buildDeterministicFallbackIdeaCandidates(input, chapterCount);
        lastUsableIdeaCandidates = ideaCandidates;
        recordLocalStage("idea-candidates", {
          deterministicFallback: true,
          candidateCount: ideaCandidates.length,
          titles: ideaCandidates.map((candidate) => candidate.title),
        });
        console.warn("[dev-mode-generation] Idea candidate LLM returned no usable candidates after retries; using deterministic fallback candidates", {
          candidateCount: ideaCandidates.length,
          titles: ideaCandidates.map((candidate) => candidate.title),
        });
      }

      // Soft-fail (v11 §4 update): if after MAX_IDEA_ROUNDS no candidate
      // cleared the 9.0 gate, pick the BEST-AUDIT candidate instead of
      // throwing. The user expects a story; a slightly-under-threshold idea
      // is better than a hard 500. Annotate it so downstream knows the
      // strict gate was bypassed.
      //
      // We reuse the LAST filter audits from the loop above so we do not
      // burn another LLM call here. If audits are empty (LLM returned
      // garbage), fall back to local auditCandidate9Potential ranking.
      if (!selectedIdea && ideaCandidates.length > 0) {
        let bestCandidate: DevModeIdeaCandidate | undefined;
        let bestAuditLine = "(no audit available)";

        const lastAudits = screenplayPlan?.potentialFilter?.candidateAudits || [];
        if (lastAudits.length > 0) {
          const rankedAudits = lastAudits
            .slice()
            .sort((a, b) => potentialAuditScore(b.scores) - potentialAuditScore(a.scores));
          const bestAudit = rankedAudits[0];
          bestCandidate = ideaCandidates.find((c) => c.id === bestAudit.id);
          if (bestAudit) bestAuditLine = auditSummaryLine(bestAudit);
        }

        if (!bestCandidate) {
          // No usable audits — rank purely on local heuristic.
          const localRanked = ideaCandidates
            .map((c) => ({
              c,
              score: potentialAuditScore(
                auditCandidate9Potential(c, auditIdeaCandidateNovelty(c, input).closestRecentOverlap),
              ),
            }))
            .sort((a, b) => b.score - a.score);
          bestCandidate = localRanked[0]?.c;
          bestAuditLine = "local-heuristic fallback";
        }

        // v12 §2 / §B: premium mode no longer accepts "best of weak candidates"
        // (a previous soft-fail let an 8.5-grade idea through and drove a 7.x
        // story). Premium must either pass the thresholds clean or fail loudly.
        //
        // Debug is a flag on top of premium that short-circuits the throw so a
        // caller can inspect the failed run; debug uses the same best-audit
        // fallback as efficient, but annotates the bypass clearly.
        const mode = input.qualityMode || "premium";
        const shouldBlockPotentialGate = shouldBlockDevModePotentialGateFailure(input);
        if (bestCandidate && !shouldBlockPotentialGate) {
          const lane = isDebugMode(input)
            ? "debug"
            : mode === "premium"
              ? "premium-grace"
              : "efficient";
          console.warn(`[dev-mode-generation] §4 ${lane} soft-fail: no candidate passed gate after ${DEV_MODE_MAX_IDEA_ROUNDS} rounds; using best-audit fallback`, {
            chosen: bestCandidate.title,
            bestAudit: bestAuditLine,
            allFailures: potentialFailureSummaries.slice(0, 6),
          });
          selectedIdea = {
            ...bestCandidate,
            chosenReason: `§4 ${lane} soft-fail: best of ${ideaCandidates.length} candidates after ${DEV_MODE_MAX_IDEA_ROUNDS} strict rounds. ${bestAuditLine}`,
            selectedSupportingCast: resolvePoolNames(bestCandidate.recommendedSupportingCast, input.poolCharacters),
          };
        } else if (bestCandidate && shouldBlockPotentialGate) {
          console.warn("[dev-mode-generation] §4 PREMIUM strict-fail: no candidate passed thresholds after 2 rounds — refusing soft-fail", {
            bestCandidateTitle: bestCandidate.title,
            bestAudit: bestAuditLine,
            allFailures: potentialFailureSummaries.slice(0, 6),
          });
        }
      }

      if (!selectedIdea) {
        const emergencyCandidates = ideaCandidates.length > 0
          ? ideaCandidates
          : buildDeterministicFallbackIdeaCandidates(input, chapterCount);
        const emergencyFallback = !shouldBlockDevModePotentialGateFailure(input)
          ? fallbackNoveltySafeSelectedIdea(emergencyCandidates, input, input.poolCharacters)
          : undefined;
        if (emergencyFallback) {
          console.warn("[dev-mode-generation] §4 emergency fallback: no passing idea candidate survived, but strict blocking is disabled", {
            chosen: emergencyFallback.title,
            candidateCount: emergencyCandidates.length,
            mode: input.qualityMode || "premium",
          });
          selectedIdea = {
            ...emergencyFallback,
            chosenReason: `${emergencyFallback.chosenReason} Emergency fallback after premium potential gate miss; availability prioritized because strict blocking is disabled.`,
          };
        }
      }

      if (!selectedIdea) {
        const mode = input.qualityMode || "premium";
        if (mode === "premium" && shouldBlockDevModePotentialGateFailure(input)) {
          throw new Error(`§2 premium quality_gate_failed: no candidate met the strict thresholds after ${DEV_MODE_MAX_IDEA_ROUNDS} round(s). Caller must regenerate with a different creative lane. Last failures: ${potentialFailureSummaries.slice(0, 6).join(" | ")}`);
        }
        const deterministicCandidates = buildDeterministicFallbackIdeaCandidates(input, chapterCount);
        const deterministicFallback = fallbackNoveltySafeSelectedIdea(deterministicCandidates, input, input.poolCharacters);
        if (deterministicFallback) {
          console.warn("[dev-mode-generation] §4 last-resort deterministic idea fallback after empty/invalid candidate pool", {
            chosen: deterministicFallback.title,
            mode,
            lastFailures: potentialFailureSummaries.slice(0, 6),
          });
          selectedIdea = {
            ...deterministicFallback,
            chosenReason: `${deterministicFallback.chosenReason} Last-resort deterministic fallback; quality candidate gate could not produce a usable idea, but user-facing generation must continue.`,
          };
        } else {
          throw new Error(`No ${mode} idea candidate passed after ${DEV_MODE_MAX_IDEA_ROUNDS} round(s) AND no deterministic fallback could be built. Last failures: ${potentialFailureSummaries.slice(0, 6).join(" | ")}`);
        }
      }

      if (!selectedIdea) {
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

      // v11 §3: second pass against persistent long-term motif memory.
      // Best-effort; if the DB lookup or override fails, we keep the
      // in-window choice.
      try {
        selectedIdea = await enforceLongTermNovelty(
          selectedIdea,
          ideaCandidates,
          input,
          input.userId,
          input.poolCharacters,
        );
      } catch (longTermErr) {
        console.warn("[dev-mode-generation] §3 long-term novelty enforcement failed (non-fatal):",
          longTermErr instanceof Error ? longTermErr.message : String(longTermErr));
      }

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

      // v11 §4: candidate 9.0-potential audit. Log per-candidate scores so
      // we can tune thresholds; if the selected one fails, swap to the
      // best-audit candidate that passes. Best-effort — fall through if
      // every candidate fails.
      if (selectedIdea && ideaCandidates.length > 0) {
        const candidate9Audits = ideaCandidates.map((c) => ({
          id: c.id,
          title: c.title,
          audit: auditCandidate9Potential(c, auditIdeaCandidateNovelty(c, input).closestRecentOverlap),
        }));
        const selectedAudit = candidate9Audits.find((a) => a.title === selectedIdea?.title);
        console.log("[dev-mode-generation] §4 candidate-9.0 audit", {
          selected: selectedAudit?.title,
          selectedAudit: selectedAudit?.audit,
          allTitles: candidate9Audits.map((a) => `${a.title}${a.audit.reject ? ` [REJECT: ${a.audit.rejectReason}]` : ""}`),
        });
        if (selectedAudit?.audit.reject) {
          const replacement = candidate9Audits.find((a) => !a.audit.reject && a.title !== selectedAudit.title);
          if (replacement) {
            const replacementCandidate = ideaCandidates.find((c) => c.title === replacement.title);
            if (replacementCandidate) {
              console.warn("[dev-mode-generation] §4 candidate-9.0 swap", {
                from: selectedIdea.title,
                fromAudit: selectedAudit.audit,
                to: replacement.title,
                toAudit: replacement.audit,
              });
              selectedIdea = {
                ...replacementCandidate,
                chosenReason: `§4 candidate-9.0 swap: original "${selectedIdea.title}" failed structural gate (${selectedAudit.audit.rejectReason}). Switched to "${replacement.title}".`,
                selectedSupportingCast: resolvePoolNames(replacementCandidate.recommendedSupportingCast, input.poolCharacters),
              };
            }
          }
        }
      }
      }
    }

    if (selectedIdea) {
      try {
        const potentialEligibleCandidates = screenplayPlan?.potentialFilter?.passingCandidateIds?.length
          ? ideaCandidates.filter((candidate) => screenplayPlan?.potentialFilter?.passingCandidateIds.includes(candidate.id))
          : ideaCandidates;
        selectedIdea = await enforceLongTermNovelty(
          selectedIdea,
          potentialEligibleCandidates,
          input,
          input.userId,
          input.poolCharacters,
        );
      } catch (longTermErr) {
        console.warn("[dev-mode-generation] long-term novelty enforcement failed after potential filter (non-fatal):",
          longTermErr instanceof Error ? longTermErr.message : String(longTermErr));
      }

      if (!selectedIdea) {
        throw new Error("Long-term novelty filter removed the selected idea and no 9.0-potential replacement was available.");
      }
      const finalizedCast = finalizeSelectedIdeaCast(input, selectedIdea, input.poolCharacters);
      selectedIdea = finalizedCast.selectedIdea;
      input = {
        ...input,
        selectedIdea,
        poolCharacters: finalizedCast.poolCharacters,
      };

      // v12 §3: forbidden-motif preflight on the selected idea — before any
      // expensive downstream stage (logline, beat-sheet, scene-cards, draft).
      // If a motif is load-bearing we'd waste a whole pipeline run; renaming
      // it here is one regex pass.
      const hardAvoidForPreflight = input.noveltyBrief?.hardAvoidMotifs ?? [];
      if (hardAvoidForPreflight.length > 0 && selectedIdea) {
        const ideaScan: ForbiddenMotifPlanScan = {
          title: selectedIdea.title,
          description: selectedIdea.coreConflict ?? null,
          oneLineHook: selectedIdea.oneLineHook ?? null,
          centralObjectOrPlace: selectedIdea.centralObjectOrPlace ?? null,
          wonderRule: selectedIdea.wonderRule ?? null,
          artifact: (selectedIdea as any).artifact ?? null,
          imagePromptSeed: (selectedIdea as any).imagePromptSeed ?? null,
        };
        const preflight = forbiddenMotifPreflight(ideaScan, hardAvoidForPreflight);
        if (preflight.softWarnings.length > 0) {
          console.log("[dev-mode-generation] §3 idea novelty drift (soft)", {
            warnings: preflight.softWarnings.slice(0, 6),
          });
        }
        if (preflight.violations.length > 0) {
          console.warn("[dev-mode-generation] §3 forbidden-motif preflight on selected idea (HARD)", {
            violations: preflight.violations.slice(0, 6),
            canRepair: preflight.canRepair,
            repairLog: preflight.repairLog,
          });
          if (preflight.canRepair && preflight.repairedPlan) {
            const repaired = preflight.repairedPlan;
            selectedIdea = {
              ...selectedIdea,
              title: typeof repaired.title === "string" ? repaired.title : selectedIdea.title,
              ...(typeof repaired.description === "string" ? { coreConflict: repaired.description } : {}),
              ...(typeof repaired.oneLineHook === "string" ? { oneLineHook: repaired.oneLineHook } : {}),
              ...(typeof repaired.centralObjectOrPlace === "string" ? { centralObjectOrPlace: repaired.centralObjectOrPlace } : {}),
              ...(typeof repaired.wonderRule === "string" ? { wonderRule: repaired.wonderRule } : {}),
              chosenReason: `${selectedIdea.chosenReason || ""} | §3 motif-preflight rename: ${preflight.repairLog.join("; ")}`.trim(),
            };
            input = { ...input, selectedIdea };
          } else {
            throw new Error(
              `Forbidden motif preflight: idea "${selectedIdea.title}" contains load-bearing forbidden motifs (${preflight.violations
                .map((v) => `${v.field}="${v.matched}"`)
                .join(", ")}). Idea must be regenerated.`
            );
          }
        }
      }
    }

    // Scrub any suppressed-pool-artifact mentions from the selected idea
    // (notably premiseSeedMutation, which is invented by the candidate LLM
    // and historically introduced names like "Feuerstein" that the artifact
    // pool wanted hidden). Without this scrub, the artifact name propagates
    // into every downstream prompt and the gate fires post-hoc.
    if (selectedIdea && !shouldExposeDevModeArtifact(input) && input.matchedArtifact?.name) {
      const ideaScrub = sanitizeSuppressedArtifactInValue(selectedIdea, input, "selected-idea");
      if (ideaScrub.changed) {
        console.warn("[dev-mode-generation] scrubbed suppressed pool artifact from selectedIdea", {
          artifact: input.matchedArtifact?.name,
          lockedCentralObject: getLockedCentralObject(input),
          reason: ideaScrub.reason,
        });
        recordLocalStage("local-diagnostics", {
          type: "artifact-suppression",
          context: "selected-idea",
          artifact: input.matchedArtifact?.name,
          lockedCentralObject: getLockedCentralObject(input),
          reason: ideaScrub.reason,
        });
        selectedIdea = ideaScrub.value as typeof selectedIdea;
        input = { ...input, selectedIdea };
      }
    }

    let blueprint: any;
    let critique: any;

    const applySuppressedArtifactSanitizer = <T,>(context: string, value: T): T => {
      const result = sanitizeSuppressedArtifactInValue(value, input, context);
      if (result.changed) {
        console.warn("[dev-mode-generation] suppressed non-central artifact from screenplay plan", {
          context,
          artifact: input.matchedArtifact?.name,
          lockedCentralObject: getLockedCentralObject(input),
          reason: result.reason,
        });
        recordLocalStage("local-diagnostics", {
          type: "artifact-suppression",
          context,
          artifact: input.matchedArtifact?.name,
          lockedCentralObject: getLockedCentralObject(input),
          reason: result.reason,
        });
      }
      return result.value;
    };

    const loglinePrompts = buildLoglineEnginePrompts(input, chapterCount);
    const loglineStage = await runStage("logline-emotional-engine", loglinePrompts, {
      maxTokens: 1200,
      temperature: 0.34,
      timeoutMs: 90_000,
      ...supportCallOptions,
      modelRole: "support",
    });
    let loglineEngine = applySuppressedArtifactSanitizer("logline-emotional-engine", loglineStage.parsed || {});
    const loglineIssues = validateLoglineEngine(loglineEngine);
    if (loglineIssues.length > 0) {
      throw new Error(`Logline + emotional engine gate failed before prose: ${loglineIssues.join(" | ")}`);
    }

    const beatSheetPrompts = buildBeatSheetPrompts(input, chapterCount, loglineEngine);
    const beatSheetStage = await runStage("filmic-beat-sheet", beatSheetPrompts, {
      maxTokens: 1800,
      temperature: 0.32,
      timeoutMs: 90_000,
      ...supportCallOptions,
      modelRole: "support",
    });
    let beatSheet = applySuppressedArtifactSanitizer("filmic-beat-sheet", unwrapBeatSheet(beatSheetStage.parsed || {}));
    let beatSheetIssues = validateBeatSheet(beatSheet, input);
    if (beatSheetIssues.length > 0) {
      const repairPrompts = buildBeatSheetPrompts(input, chapterCount, { ...loglineEngine, previousBeatSheet: beatSheet }, beatSheetIssues);
      const repairedBeatSheetStage = await runStage("beat-sheet-repair", repairPrompts, {
        maxTokens: 1800,
        temperature: 0.2,
        timeoutMs: 90_000,
        ...supportCallOptions,
        modelRole: "support",
      });
      beatSheet = applySuppressedArtifactSanitizer("beat-sheet-repair", unwrapBeatSheet(repairedBeatSheetStage.parsed || beatSheet));
      beatSheetIssues = validateBeatSheet(beatSheet, input);
    }
    if (beatSheetIssues.length > 0) {
      const repairedBeatSheet = repairBeatSheetDeterministically(beatSheet, input, beatSheetIssues);
      const repairedIssues = validateBeatSheet(repairedBeatSheet, input);
      if (repairedIssues.length < beatSheetIssues.length) {
        console.warn("[dev-mode-generation] beat-sheet deterministic repair applied after support-model repair", {
          originalIssues: beatSheetIssues,
          remainingIssues: repairedIssues,
          repairedClosingImage: repairedBeatSheet?.act3?.closingImage,
        });
        beatSheet = applySuppressedArtifactSanitizer("beat-sheet-deterministic-repair", repairedBeatSheet);
        beatSheetIssues = repairedIssues;
      }
    }
    if (beatSheetIssues.length > 0) {
      // v12 §H tuning: the structured-sub-object checks (echo plantedDetail,
      // structured sub-object missing, abstract visibleDamage) are stricter
      // than the legacy regex gates and the support model (gemini-flash-lite)
      // sometimes cannot satisfy them even after the repair pass — e.g. it
      // varies wording between plantedDetail and closingImage. Treat the
      // additive §H issues as advisory in the soft-fail path so a single
      // surface-form mismatch does not derail an otherwise sound plan.
      const advisoryPattern = /finalPayoff\.closingImage does not echo plantedDetail|structured sub-object missing|visibleDamage lacks a concrete damage signal|visibleDamage too short to be concrete/;
      const blocking = beatSheetIssues.filter((i) => !advisoryPattern.test(i));
      const advisory = beatSheetIssues.filter((i) => advisoryPattern.test(i));
      if (advisory.length > 0) {
        console.warn("[dev-mode-generation] beat-sheet §H additive checks downgraded to advisory", {
          advisory,
        });
      }
      if (blocking.length > 0) {
        console.warn("[dev-mode-generation] beat-sheet soft-fail after repair; continuing to prose pipeline", {
          issues: blocking,
        });
      }
    }

    const sceneCardPrompts = buildSceneCardPrompts(input, beatSheet);
    const sceneCardStage = await runStage("scene-cards", sceneCardPrompts, {
      maxTokens: 3400,
      temperature: 0.34,
      timeoutMs: 120_000,
      ...supportCallOptions,
      modelRole: "support",
    });
    let sceneCards = applySuppressedArtifactSanitizer("scene-cards", normalizeSceneCards(sceneCardStage.parsed));
    const deterministicSceneRepair = repairSceneCardsDeterministically(sceneCards, beatSheet, input);
    if (deterministicSceneRepair.changed) {
      sceneCards = deterministicSceneRepair.sceneCards;
      console.warn("[dev-mode-generation] deterministic scene-card repair applied before validation", {
        context: "initial-scene-cards",
        fixes: deterministicSceneRepair.fixes,
      });
      recordLocalStage("scene-cards-repair", {
        deterministic: true,
        context: "initial-scene-cards",
        fixes: deterministicSceneRepair.fixes,
      });
    }
    let sceneCardIssues = validateSceneCards(sceneCards, input.qualityMode);
    if (sceneCardIssues.length > 0) {
      const repairPrompts = buildSceneCardPrompts(input, { ...beatSheet, previousSceneCards: sceneCards }, sceneCardIssues);
      const repairedSceneCardStage = await runStage("scene-cards-repair", repairPrompts, {
        maxTokens: 3400,
        temperature: 0.22,
        timeoutMs: 120_000,
        ...supportCallOptions,
        modelRole: "support",
      });
      sceneCards = applySuppressedArtifactSanitizer("scene-cards-repair", normalizeSceneCards(repairedSceneCardStage.parsed));
      const deterministicRepairAfterModel = repairSceneCardsDeterministically(sceneCards, beatSheet, input);
      if (deterministicRepairAfterModel.changed) {
        sceneCards = deterministicRepairAfterModel.sceneCards;
        console.warn("[dev-mode-generation] deterministic scene-card repair applied after model repair", {
          context: "after-scene-cards-repair",
          fixes: deterministicRepairAfterModel.fixes,
        });
        recordLocalStage("scene-cards-repair", {
          deterministic: true,
          context: "after-scene-cards-repair",
          fixes: deterministicRepairAfterModel.fixes,
        });
      }
      sceneCardIssues = validateSceneCards(sceneCards, input.qualityMode);
    }
    if (sceneCardIssues.length > 0) {
      // v12 §I: in efficient mode the spec-§I additive issues are advisory.
      // Filter them out before deciding to abort so we never block a release
      // on a missing recurringMotifState in a non-premium run. Premium keeps
      // the hard-throw behavior — incomplete scene cards there mean the plan
      // is not strong enough to draft from (audit recommendation).
      const hardPremium = isHardRejectInPremium(input.qualityMode);
      const isAdvisoryUnderEfficient = (issue: string): boolean =>
        /scene \d+ has fewer than 4 dialogue beats|recurringMotifState|visibleDamage|emotionalTurn|cannotGoBackReason|childDiscovery|childDecision|helperFunction/i.test(issue);
      const blockingIssues = hardPremium
        ? sceneCardIssues
        : sceneCardIssues.filter((issue) => !isAdvisoryUnderEfficient(issue));
      if (blockingIssues.length > 0) {
        throw new Error(`Scene-card gate failed before prose: ${blockingIssues.join(" | ")}`);
      }
      if (sceneCardIssues.length > 0) {
        console.warn("[dev-mode-generation] §I efficient mode soft-fail on additive scene-card gates", {
          advisoryIssues: sceneCardIssues,
        });
      }
    }

    // v12 §3: re-run forbidden-motif preflight on scene cards. The LLM can
    // still introduce a banned word-family inside a scene description even
    // when the selected idea was clean. Catch it here, before the most
    // expensive stages (dialogue-intent, whole-story-draft).
    //
    // Severity model (post-fix from logs.1779275469620):
    //   - violations[] = hard bans (ANCHOR set / local-repair dict). Block.
    //   - softWarnings[] = novelty-drift hints from recent stories. Log only;
    //     the LLM will revise during draft/polish if needed. Surface-level
    //     overlaps with common children's vocabulary ("wachst", "ablenkung")
    //     should never halt generation.
    const hardAvoidForSceneScan = input.noveltyBrief?.hardAvoidMotifs ?? [];
    if (hardAvoidForSceneScan.length > 0 && Array.isArray(sceneCards) && sceneCards.length > 0) {
      const sceneScan: ForbiddenMotifPlanScan = { sceneCards: sceneCards as any[] };
      const sceneFlight = forbiddenMotifPreflight(sceneScan, hardAvoidForSceneScan);
      if (sceneFlight.softWarnings.length > 0) {
        console.log("[dev-mode-generation] §3 scene-cards novelty drift (soft)", {
          warnings: sceneFlight.softWarnings.slice(0, 6),
        });
      }
      if (sceneFlight.violations.length > 0) {
        console.warn("[dev-mode-generation] §3 forbidden-motif preflight on scene cards (HARD)", {
          violations: sceneFlight.violations.slice(0, 8),
          canRepair: sceneFlight.canRepair,
          repairLog: sceneFlight.repairLog,
        });
        if (!sceneFlight.canRepair) {
          throw new Error(
            `Scene-cards contain hard-banned motifs that cannot be locally repaired: ${sceneFlight.violations
              .map((v) => `${v.field}="${v.matched}"`)
              .join(", ")}`
          );
        }
        // Local rename: apply replacement string-wise across each scene card.
        for (const violation of sceneFlight.violations) {
          const replacement = localRepairCandidate(violation.matched);
          if (!replacement) continue;
          const re = new RegExp(violation.matched.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
          sceneCards = sceneCards.map((card: any) => {
            if (!card) return card;
            return Object.fromEntries(
              Object.entries(card).map(([key, value]) => [
                key,
                typeof value === "string" ? value.replace(re, replacement) : value,
              ])
            );
          });
        }
      }
    }

    // v12 §6: irreversible-middle gate — the central turn scene (scene 3 or
    // 4 for a 5-card plan) must carry both visibleDamage AND personalCost,
    // otherwise the story has no real reversal point. Soft-fail to a one-
    // shot scene-cards-repair; if still missing after repair, raise.
    {
      const turnIndexByPurpose = sceneCards.findIndex((card: any) => String(card?.scenePurpose || "") === "irreversible_middle");
      const candidateTurnIndices = [...new Set([turnIndexByPurpose, 2, 3, Math.floor(sceneCards.length / 2)])]
        .filter((index) => index >= 0 && index < sceneCards.length);
      const successfulTurnIndex = candidateTurnIndices.find((index) => {
        const card: any = sceneCards[index];
        return !!(card?.visibleDamage || card?.irreversibleChange) && !!card?.personalCost;
      });
      const turnIndex = successfulTurnIndex ?? (turnIndexByPurpose >= 0
        ? turnIndexByPurpose
        : Math.max(2, Math.min(sceneCards.length - 2, Math.floor(sceneCards.length / 2))));
      const turnCard: any = sceneCards[turnIndex] || sceneCards[Math.floor(sceneCards.length / 2)];
      const hasVisibleDamage = !!(turnCard?.visibleDamage || turnCard?.irreversibleChange);
      const hasPersonalCost = !!turnCard?.personalCost;
      if (!hasVisibleDamage || !hasPersonalCost) {
        console.warn("[dev-mode-generation] §6 irreversible-middle gate flagged", {
          turnIndex,
          hasVisibleDamage,
          hasPersonalCost,
          turnCardKeys: turnCard ? Object.keys(turnCard) : [],
        });
        const repairIssues = [
          !hasVisibleDamage
            ? `Scene ${turnIndex + 1} (Wendepunkt) hat keinen sichtbaren Schaden — füge visibleDamage konkret (Objekt, Kratzer, Riss, Stoß) hinzu.`
            : null,
          !hasPersonalCost
            ? `Scene ${turnIndex + 1} (Wendepunkt) hat keinen persönlichen Einsatz — füge personalCost konkret (Lieblingsplatz, Murmel, Tuch, Verzicht) hinzu.`
            : null,
        ].filter((line): line is string => Boolean(line));
        const repairPrompts = buildSceneCardPrompts(input, { ...beatSheet, previousSceneCards: sceneCards }, repairIssues);
        const repairedSceneCardStage = await runStage("scene-cards-repair", repairPrompts, {
          maxTokens: 3400,
          temperature: 0.22,
          timeoutMs: 120_000,
          ...supportCallOptions,
          modelRole: "support",
        });
        sceneCards = applySuppressedArtifactSanitizer("scene-cards-irreversible-middle-repair", normalizeSceneCards(repairedSceneCardStage.parsed));
        const deterministicTurnRepair = repairSceneCardsDeterministically(sceneCards, beatSheet, input);
        if (deterministicTurnRepair.changed) {
          sceneCards = deterministicTurnRepair.sceneCards;
          recordLocalStage("scene-cards-repair", {
            deterministic: true,
            context: "irreversible-middle-gate",
            fixes: deterministicTurnRepair.fixes,
          });
        }
        const retryTurnIndex = candidateTurnIndices.find((index) => {
          const card: any = sceneCards[index];
          return !!(card?.visibleDamage || card?.irreversibleChange) && !!card?.personalCost;
        }) ?? turnIndex;
        const turnCardRetry: any = sceneCards[retryTurnIndex] || sceneCards[Math.floor(sceneCards.length / 2)];
        const stillNoDamage = !(turnCardRetry?.visibleDamage || turnCardRetry?.irreversibleChange);
        const stillNoCost = !turnCardRetry?.personalCost;
        if (stillNoDamage || stillNoCost) {
          throw new Error(
            `Scene-card §6 gate still failed after repair: visibleDamage=${!stillNoDamage}, personalCost=${!stillNoCost} on scene ${retryTurnIndex + 1}.`
          );
        }
      }
    }

    const dialogueIntentPrompts = buildDialogueIntentPrompts(input, sceneCards);
    const dialogueIntentStage = await runStage("dialogue-intent", dialogueIntentPrompts, {
      maxTokens: 2200,
      temperature: 0.28,
      timeoutMs: 90_000,
      ...supportCallOptions,
      modelRole: "support",
    });
    let dialoguePlan = normalizeDialoguePlan(dialogueIntentStage.parsed || {});
    let dialogueIssues = validateDialoguePlan(dialoguePlan);
    if (dialogueIssues.length > 0) {
      const repairPrompts = buildDialogueIntentPrompts(input, sceneCards, dialogueIssues, dialoguePlan);
      const repairedDialogueStage = await runStage("dialogue-intent-repair", repairPrompts, {
        maxTokens: 2600,
        temperature: 0.2,
        timeoutMs: 90_000,
        ...supportCallOptions,
        modelRole: "support",
      });
      const repaired = normalizeDialoguePlan(repairedDialogueStage.parsed || {});
      const mergedScenes = Array.isArray(repaired?.sceneDialogue) && repaired.sceneDialogue.length > 0
        ? repaired.sceneDialogue
        : dialoguePlan.sceneDialogue;
      dialoguePlan = { sceneDialogue: mergedScenes };
      dialogueIssues = validateDialoguePlan(dialoguePlan);
    }
    if (dialogueIssues.length > 0) {
      const padded = padDialoguePlanFromSceneCards(dialoguePlan, sceneCards);
      const padIssues = validateDialoguePlan(padded);
      if (padIssues.length === 0) {
        console.warn("[dev-mode-generation] dialogue-intent soft-pad applied after repair fallback", {
          originalIssues: dialogueIssues,
        });
        dialoguePlan = padded;
        dialogueIssues = padIssues;
      } else {
        throw new Error(`Dialogue intent gate failed before prose: ${dialogueIssues.join(" | ")}`);
      }
    }

    sceneCards = mergeDialoguePlanIntoSceneCards(sceneCards, dialoguePlan);
    screenplayPlan = {
      ...(screenplayPlan || {}),
      loglineEngine,
      beatSheet,
      sceneCards,
      dialoguePlan,
      gateIssues: [...loglineIssues, ...beatSheetIssues, ...sceneCardIssues, ...dialogueIssues],
    };
    blueprint = buildBlueprintFromScreenplayPlan(input, loglineEngine, beatSheet, sceneCards, dialoguePlan);
    critique = screenplayCritiqueForDraft(screenplayPlan.gateIssues || []);

    if (false) {
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
    }

    // ---- SCREENPLAY-FIRST / CONTINUOUS-STORY PIPELINE (v12) -------------
    // The selected story model writes ONE continuous narrative. The server
    // creates reading breaks for app display without asking another model to
    // invent chapter titles or mini-endings.
    const selectedOpenRouterStoryModel = resolveSelectedOpenRouterStoryModel(input.config);
    const compactDraftMode = shouldUseCompactOpenRouterDraft(input.config);
    // v12 §10 (default-on after logs.1779277372031 showed ~67s end-to-end
    // generation hitting Railway/Cloudflare edge timeout): compact whole-
    // story-draft prompt is now the DEFAULT for premium runs whenever the
    // screenplay plan is complete. Drops the userPrompt from ~27 000 chars
    // to ~7 000 and shaves roughly 30-40s off generation, which is enough
    // to keep responses inside the 60s edge budget.
    //
    // Opt-out: set `useCompactDraftPrompt: false` on StoryConfig to force
    // the legacy long-form builder (e.g. when chasing a quality regression).
    // The legacy builder is still the safe fallback when no screenplay plan
    // exists.
    const compactDraftOptOut = (input.config as any)?.useCompactDraftPrompt === false;
    const useCompactWholeStoryDraft =
      !compactDraftOptOut
      && Boolean(screenplayPlan?.sceneCards?.length);
    const wholeStoryPrompts = useCompactWholeStoryDraft
      ? buildCompactWholeStoryDraftPrompts(input, chapterCount, screenplayPlan!)
      : buildWholeStoryDraftPrompts(input, chapterCount, blueprint, critique, screenplayPlan);
    if (useCompactWholeStoryDraft) {
      console.log("[dev-mode-generation] §10 compact whole-story-draft prompt enabled", {
        systemPromptChars: wholeStoryPrompts.systemPrompt.length,
        userPromptChars: wholeStoryPrompts.userPrompt.length,
      });
    }

    let wholeStoryStage: Awaited<ReturnType<typeof runStage>>;
    let wholeStoryDraft: DevModeWholeStoryDraft;
    // §5 writer-model floor is applied centrally inside runStage for every
    // modelRole "selected-story" call.
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
      // finish_reason=length with empty/truncated content = the provider
      // spent the completion budget on hidden thinking tokens (kimi run
      // 38b65185, claude run a5059aef) or unusually verbose output. The
      // reasoning toggle in openRouterReasoningForDevMode is the primary
      // fix; the escalated budget below is the belt-and-suspenders for
      // providers that ignore `reasoning.enabled=false`. Unused budget
      // costs nothing.
      const firstAttemptLengthFailure = /finish_reason=length|finish_reason=max_tokens|empty response/i.test(reason);
      console.warn("[dev-mode-generation] Whole-story draft failed; retrying once with stricter prompt", {
        model: selectedOpenRouterStoryModel,
        error: reason,
        escalatedTokenBudget: firstAttemptLengthFailure,
      });
      const retryPrompts = buildWholeStoryDraftPrompts(input, chapterCount, blueprint, critique, screenplayPlan);
      const baseRetryMaxTokens = devModeStoryDraftMaxTokens(input.config, true, true);
      try {
        wholeStoryStage = await runStage("whole-story-draft", retryPrompts, {
          maxTokens: firstAttemptLengthFailure ? Math.max(baseRetryMaxTokens, 12000) : baseRetryMaxTokens,
          temperature: 0.6,
          timeoutMs: devModeStoryDraftTimeoutMs(input.config, true),
          modelRole: "selected-story",
        });
        wholeStoryDraft = parseWholeStoryDraft(wholeStoryStage.provider.content);
      } catch (retryError) {
        const retryReason = retryError instanceof Error ? retryError.message : String(retryError);
        const retryLengthFailure = /finish_reason=length|finish_reason=max_tokens|empty response/i.test(retryReason);
        // Final third attempt, two flavors:
        //  a) §5 floor active → the FLOOR model failed twice; fall back to
        //     the originally selected wizard model (run a5059aef).
        //  b) no floor, but both attempts died on length/empty → same model
        //     one last time with the maximum completion budget, so even a
        //     provider that force-enables thinking can finish its content.
        // A weaker or slower finished story still passes every quality gate;
        // a thrown error reaches the child.
        if (!writerModelFloor && !retryLengthFailure) {
          throw new Error(
            `Selected story model could not produce a usable whole-story draft (${selectedOpenRouterStoryModel}): ${retryReason}`
          );
        }
        console.warn("[dev-mode-generation] Whole-story draft failed twice; launching final fallback attempt", {
          mode: writerModelFloor ? "original-model-without-floor" : "same-model-max-budget",
          flooredModel: writerModelFloor?.openRouterModelOverride || writerModelFloor?.modelOverride,
          selectedModel: selectedOpenRouterStoryModel,
          error: retryReason,
        });
        try {
          wholeStoryStage = await runStage("whole-story-draft", wholeStoryPrompts, {
            maxTokens: writerModelFloor
              ? devModeStoryDraftMaxTokens(input.config, compactDraftMode, true)
              : 16000,
            temperature: 0.7,
            timeoutMs: devModeStoryDraftTimeoutMs(input.config, true),
            modelRole: "selected-story",
            skipWriterModelFloor: true,
          });
          wholeStoryDraft = parseWholeStoryDraft(wholeStoryStage.provider.content);
        } catch (fallbackError) {
          throw new Error(
            `Selected story model could not produce a usable whole-story draft (${selectedOpenRouterStoryModel}): ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`
          );
        }
      }
    }

    const parsedStoryDraft = applyReadingBreaksToDraft(
      wholeStoryDraft,
      chapterCount,
      localizedLanguageName(input.config.language),
      screenplayPlan
    );
    recordLocalStage("reading-breaks", {
      displayMode: parsedStoryDraft.displayMode,
      readingBreaks: parsedStoryDraft.readingBreaks,
      balanceRatio: parsedStoryDraft.balanceRatio,
    });

    const storyStage = wholeStoryStage;
    finalParsed = parsedStoryDraft;
    finalModelUsed = storyStage.provider.modelUsed;
    // Suppress unused-variable warnings for legacy compact-draft helpers
    // that are still referenced elsewhere (compatibility retry paths).
    void compactDraftMode;
    finalDiagnostics = analyzeDevModeStoryQuality(finalParsed, input, chapterCount);
    recordLocalStage("local-diagnostics", compactDiagnosticsForPrompt(finalDiagnostics));

    // Draft-stage dialogue redraft: when the draft's dialogue share collapsed
    // far below the floor, ONE redraft with explicit measured feedback at the
    // cheapest creative stage beats the historical polish→rebalance cascade,
    // which traded word count for dialogue and got rejected (logs 734d7ae5,
    // a27e9788: drafts at ~17% dialogue shipped with failed gates after three
    // wasted repair calls).
    if (finalDiagnostics && finalDiagnostics.dialogPct < DEV_MODE_DRAFT_REDRAFT_DIALOG_PCT) {
      console.warn("[dev-mode-generation] Draft dialogue collapse — issuing one redraft with measured feedback", {
        dialogPct: finalDiagnostics.dialogPct,
        totalWords: finalDiagnostics.totalWords,
      });
      try {
        const redraftWordBounds = getStoryWordBounds(input.config);
        const draftQuotedLines = (finalParsed?.chapters || []).reduce(
          (sum, ch) => sum + (String(ch.content || "").match(/„[^“]*“/g) || []).length,
          0
        );
        const redraftPrompts = {
          systemPrompt: wholeStoryPrompts.systemPrompt,
          userPrompt: [
            `REDRAFT FEEDBACK (binding): your previous draft of this exact story measured only ${finalDiagnostics.dialogPct}% direct speech (${draftQuotedLines} quoted lines) — far below the hard floor of ${DEV_MODE_DIALOG_REBALANCE_MIN_DIALOG_PCT}% and the 30–38% target. Rewrite the SAME story: same plot, same scene plan, same characters, same ${redraftWordBounds.targetMin}-${redraftWordBounds.targetMax} word budget. Keep the narration that carries action, and convert reactions, decisions, and explanations into short quoted exchanges in the characters' distinct voices. Realize every dialogue beat from the scene plan as a quoted line and COUNT your quoted lines before answering. Every scene movement needs at least 2 exchanges; never go 2 paragraphs without speech in the first half. Do NOT shorten the story to raise the percentage.`,
            wholeStoryPrompts.userPrompt,
          ].join("\n\n"),
        };
        const redraftStage = await runStage("whole-story-draft", redraftPrompts, {
          maxTokens: devModeStoryDraftMaxTokens(input.config, compactDraftMode, true),
          temperature: 0.7,
          timeoutMs: devModeStoryDraftTimeoutMs(input.config, true),
          modelRole: "selected-story",
        });
        const redraft = parseWholeStoryDraft(redraftStage.provider.content);
        const redraftParsed = applyReadingBreaksToDraft(
          redraft,
          chapterCount,
          localizedLanguageName(input.config.language),
          screenplayPlan
        );
        const redraftDiagnostics = analyzeDevModeStoryQuality(redraftParsed, input, chapterCount);
        const redraftWordsOk =
          redraftDiagnostics.totalWords >= Math.min(finalDiagnostics.totalWords, redraftWordBounds.min);
        const redraftDialogImproved = redraftDiagnostics.dialogPct >= finalDiagnostics.dialogPct + 4;
        recordLocalStage("draft-dialog-redraft", {
          accepted: redraftWordsOk && redraftDialogImproved,
          beforeDialogPct: finalDiagnostics.dialogPct,
          afterDialogPct: redraftDiagnostics.dialogPct,
          beforeWords: finalDiagnostics.totalWords,
          afterWords: redraftDiagnostics.totalWords,
        });
        if (redraftWordsOk && redraftDialogImproved) {
          finalParsed = redraftParsed;
          finalModelUsed = redraftStage.provider.modelUsed;
          finalDiagnostics = redraftDiagnostics;
          console.log("[dev-mode-generation] Draft dialogue redraft accepted", {
            dialogPct: redraftDiagnostics.dialogPct,
            totalWords: redraftDiagnostics.totalWords,
          });
        } else {
          console.warn("[dev-mode-generation] Draft dialogue redraft rejected; keeping original draft", {
            redraftDialogPct: redraftDiagnostics.dialogPct,
            redraftWords: redraftDiagnostics.totalWords,
          });
        }
      } catch (redraftError) {
        console.warn("[dev-mode-generation] Draft dialogue redraft failed; keeping original draft", {
          error: redraftError instanceof Error ? redraftError.message : String(redraftError),
        });
      }
    }

    let bestParsed = finalParsed;
    let bestModelUsed = finalModelUsed;
    let bestDiagnostics = finalDiagnostics;

    let repairAttempt = 0;
    // v12 §O: premium gets 2 repair attempts, efficient stays at 1.
    const maxRepairAttempts = maxRepairAttemptsFor(input.qualityMode);
    while (finalDiagnostics?.needsPolish && repairAttempt < maxRepairAttempts) {
      repairAttempt += 1;
      // v11 §9 + v12 §11/§O RepairRouter: use the strategy to short-circuit
      // cheap fixes. Deterministic strategies (metadata_sanitize, title-promise,
      // parse_output_repair, orthography_autofix) skip the expensive
      // chapter-repair LLM round; the orchestrator's post-loop remediation
      // block handles them.
      const routerActualPageCount = finalParsed?.chapters?.length ?? 0;
      const routerTotalWords = finalDiagnostics?.totalWords ?? 0;
      const routerMissingIrreversibleMiddle = !!finalDiagnostics?.softIssues?.some((s) =>
        /keine sichtbare irreversible Mitte/i.test(s)
      ) || !!finalDiagnostics?.hardIssues?.some((s) =>
        /keine sichtbare irreversible Mitte/i.test(s)
      );
      const routerMissingPersonalCost = !!finalDiagnostics?.softIssues?.some((s) =>
        /kein persönlicher Einsatz|kein persoenlicher Einsatz/i.test(s)
      ) || !!finalDiagnostics?.hardIssues?.some((s) =>
        /kein persönlicher Einsatz|kein persoenlicher Einsatz/i.test(s)
      );
      // v12 §O: helper-explains is surfaced as a market-quality soft issue
      // (see collectMarketQualitySoftIssues). Detect both common phrasings.
      const routerHelperExplains = !!finalDiagnostics?.softIssues?.some((s) =>
        /erklaert die Loesung|erklärt die Lösung|Helper-Explains-Gate|nimmt die finale Handlung|steht im Finale im Zentrum/i.test(s)
      );
      const routerDecision = chooseRepairStrategy(finalDiagnostics, {
        requiredPageCount: chapterCount,
        actualPageCount: routerActualPageCount,
        totalWords: routerTotalWords,
        missingIrreversibleMiddle: routerMissingIrreversibleMiddle,
        missingPersonalCost: routerMissingPersonalCost,
        helperExplainsSolution: routerHelperExplains,
      });
      recordLocalStage("repair-router", {
        attempt: repairAttempt,
        strategy: routerDecision.strategy,
        reason: routerDecision.reason,
        hardIssueCount: finalDiagnostics?.hardIssueCount,
        softIssueCount: finalDiagnostics?.softIssueCount,
        dialogPct: finalDiagnostics?.dialogPct,
        qualityMode: input.qualityMode || "premium",
        attemptOf: maxRepairAttempts,
      });
      console.log("[dev-mode-generation] §9/§O RepairRouter decision", {
        attempt: repairAttempt,
        attemptOf: maxRepairAttempts,
        strategy: routerDecision.strategy,
        reason: routerDecision.reason,
        hardIssueCount: finalDiagnostics?.hardIssueCount,
        softIssueCount: finalDiagnostics?.softIssueCount,
        dialogPct: finalDiagnostics?.dialogPct,
      });
      if (finalParsed?.displayMode === "reading_pages") {
        // Reading-page mode implements exactly ONE local repair: the dialogue
        // rebalance. Historically a structural router pick (e.g.
        // scene_card_repair_then_rewrite for a missing personal cost) hit the
        // break below and the open dialogue hard gate survived into the
        // validation loop, where it blocked the validator chapter rescue (run
        // 93129526). When dialogue is under the floor, run the rebalance
        // regardless of which non-deterministic strategy won the router.
        const dialogUnderFloor = finalDiagnostics.dialogPct < DEV_MODE_MIN_DIALOG_PCT;
        const shouldRunReadingPageRebalance =
          routerDecision.strategy === "whole_story_dialog_rebalance"
          || (dialogUnderFloor && !isDeterministicRepairStrategy(routerDecision.strategy));
        if (shouldRunReadingPageRebalance) {
          const targets = selectDialogueRebalanceTargets(finalParsed, finalDiagnostics, 2);
          if (targets.length === 0) {
            console.warn("[dev-mode-generation] dialogue-rebalance selected but no target pages were found", {
              dialogPct: finalDiagnostics.dialogPct,
            });
            break;
          }
          try {
            const rebalancePrompts = buildDialogueRebalancePrompts(input, finalParsed, finalDiagnostics, targets);
            const rebalanceStage = await runStage("dialogue-rebalance", rebalancePrompts, {
              maxTokens: 1800,
              temperature: 0.22,
              timeoutMs: 120_000,
              modelRole: "selected-story",
            });
            const rebalancedParsed = parseDialogueRebalanceResult(
              rebalanceStage.provider.content,
              finalParsed,
              finalDiagnostics.totalWords <= getStoryWordBounds(input.config).targetMin
                ? { minKeepRatio: 0.95 }
                : undefined
            );
            const rebalancedDiagnostics = analyzeDevModeStoryQuality(rebalancedParsed, input, chapterCount);
            // v12.1: Dialog-rebalance is a targeted dialog repair. Accept if dialogPct rose meaningfully,
            // even when a different hard-gate ticks up by one (e.g. helper-explains re-triggered by
            // newly-added lines). The overall severity score still has to stay roughly comparable so
            // we don't accept a regression in unrelated dimensions.
            const dialogJumped = rebalancedDiagnostics.dialogPct >= finalDiagnostics.dialogPct + 1.0;
            const dialogNudged = rebalancedDiagnostics.dialogPct > finalDiagnostics.dialogPct + 0.4;
            const hardOk = rebalancedDiagnostics.hardIssueCount <= finalDiagnostics.hardIssueCount + (dialogJumped ? 1 : 0);
            const severityOk = diagnosticsSeverityScore(rebalancedDiagnostics, chapterCount, input.config)
              <= diagnosticsSeverityScore(finalDiagnostics, chapterCount, input.config) + 180;
            const improved = dialogNudged && hardOk && severityOk;
            repairSelfReflections.push({
              attempt: repairAttempt,
              modelUsed: rebalanceStage.provider.modelUsed,
              reason: "dialogue-rebalance",
              targetOrders: targets.map((chapter) => chapter.order),
              beforeDialogPct: finalDiagnostics.dialogPct,
              afterDialogPct: rebalancedDiagnostics.dialogPct,
              deterministicStoryHardIssueCount: rebalancedDiagnostics.hardIssueCount,
            });
            if (!improved) {
              console.warn("[dev-mode-generation] dialogue-rebalance rejected by deterministic diagnostics", {
                beforeDialogPct: finalDiagnostics.dialogPct,
                afterDialogPct: rebalancedDiagnostics.dialogPct,
                beforeHardIssueCount: finalDiagnostics.hardIssueCount,
                afterHardIssueCount: rebalancedDiagnostics.hardIssueCount,
                dialogJumped,
                dialogNudged,
                hardOk,
                severityOk,
                beforeSeverity: diagnosticsSeverityScore(finalDiagnostics, chapterCount, input.config),
                afterSeverity: diagnosticsSeverityScore(rebalancedDiagnostics, chapterCount, input.config),
              });
              break;
            }
            finalParsed = rebalancedParsed;
            finalModelUsed = rebalanceStage.provider.modelUsed;
            finalDiagnostics = rebalancedDiagnostics;
            storyPolishApplied = true;
            if (finalDiagnostics.hardIssueCount === 0 && finalDiagnostics.dialogPct >= DEV_MODE_DIALOG_REBALANCE_MIN_DIALOG_PCT) break;
            continue;
          } catch (rebalanceError) {
            console.warn("[dev-mode-generation] dialogue-rebalance failed; falling back to later full-story polish", {
              error: rebalanceError instanceof Error ? rebalanceError.message : String(rebalanceError),
            });
            break;
          }
        }
        console.log("[dev-mode-generation] skipping chapter-level repair in reading-page mode; later whole-story polish handles non-dialogue strategy", {
          strategy: routerDecision.strategy,
        });
        break;
      }
      // v12 §O: skip the chapter-repair LLM call entirely for strategies the
      // deterministic post-loop remediation can fix on its own.
      if (isDeterministicRepairStrategy(routerDecision.strategy)) {
        console.log("[dev-mode-generation] §O skipping chapter-repair LLM call — deterministic remediation handles this", {
          strategy: routerDecision.strategy,
        });
        break;
      }
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
          repairAttempt,
          // v12 §P/§Q: feed the router strategy into the prompt so the LLM
          // gets strategy-specific repair restrictions (expansion may only
          // strengthen load-bearing beats; compression must not cut the
          // structural spine; agency repair redistributes the decisive beat).
          routerDecision.strategy,
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
        // v11 §10: model self-reflection is debug-only. If it claims success
        // while deterministic diagnostics still fail, mark the reflection as
        // unreliable and rely on the deterministic verdict alone for any
        // score / loop decision downstream.
        const repairSelfReflectionUnreliable =
          selfCheck?.hardGatesPassed === true && (repairedChapterDiagnostics?.issues?.length ?? 0) > 0;
        if (repairSelfReflectionUnreliable) {
          console.warn("[dev-mode-generation] §10 model self-reflection unreliable; deterministic verdict wins", {
            attempt: repairAttempt,
            order: repairResult.chapter.order,
            title: repairResult.chapter.title,
            modelSelfCheck: selfCheck,
            deterministicIssues: repairedChapterDiagnostics?.issues,
          });
        }
        repairSelfReflections.push({
          attempt: repairAttempt,
          order: repairResult.chapter.order,
          title: repairResult.chapter.title,
          modelUsed: chapterRepairStage.provider.modelUsed,
          selfReflection: repairResult.selfReflection,
          repairSelfReflectionUnreliable,
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

    const applyCurrentStoryTextAutofixes = (context: string) => {
      if (!finalParsed) return;
      const result = applyDeterministicStoryTextAutofixes(finalParsed, input);
      if (!result.changed) return;
      finalParsed = result.story;
      finalDiagnostics = analyzeDevModeStoryQuality(finalParsed, input, chapterCount);
      console.log("[dev-mode-generation] deterministic story text autofix applied", {
        context,
        fixes: result.fixes,
        hardIssueCount: finalDiagnostics.hardIssueCount,
        dialogPct: finalDiagnostics.dialogPct,
      });
    };

    applyCurrentStoryTextAutofixes("before-validation-loop");

    const skipInitialValidationForLocalGates = Boolean(
      finalDiagnostics
      && ((finalDiagnostics.hardIssueCount ?? 0) > 0 || (finalDiagnostics.dialogPct ?? 0) < DEV_MODE_MIN_DIALOG_PCT)
    );

    // Carries the rejection reason of a failed polish attempt into the NEXT
    // polish prompt, so the retry knows which budget it broke instead of
    // repeating the same mistake (log 734d7ae5: expansion pass tanked the
    // dialogue share, got rejected, and the run shipped with failed gates).
    let lastRejectedPolishFeedback: any = null;
    for (let validationAttempt = 0; validationAttempt <= DEV_MODE_MAX_VALIDATION_POLISH_ATTEMPTS; validationAttempt += 1) {
      applyCurrentStoryTextAutofixes(`validation-attempt-${validationAttempt + 1}`);
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
      localGateScore = calculateLocalGateScore(finalDiagnostics, { qualityMode: input.qualityMode });
      finalQualityScore = applyHardCaps(rawQualityScore, finalDiagnostics, { qualityMode: input.qualityMode });

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
      const targetReleaseScore = minReleaseScoreForMode(input.qualityMode);
      const hasLocalHardIssues = (finalDiagnostics?.hardIssueCount ?? 0) > 0;
      // Diminishing-returns brake: a full-story-polish or chapter-repair
      // round can take 60-170s (run 849cb6a9: one chapter-repair call alone
      // took 168s against Kimi). Once every hard gate is clean and the score
      // already reads "good enough" for a shelf book, the marginal 0.2-0.4
      // points from a further round rarely justify tripling generation time
      // for cost- and latency-sensitive production traffic. Only the FIRST
      // validation round always runs (it is often what clears the hard
      // gates in the first place); attempt 2+ needs a real reason.
      const goodEnoughToStop = !hasLocalHardIssues && currentScore >= DEV_MODE_DIMINISHING_RETURNS_SCORE;
      const shouldAttemptStoryPolish =
        validationAttempt < DEV_MODE_MAX_VALIDATION_POLISH_ATTEMPTS
        && Boolean(finalParsed)
        && Boolean(finalDiagnostics)
        && (
          hasLocalHardIssues
          || currentScore < targetReleaseScore
        )
        && !(validationAttempt >= 1 && goodEnoughToStop);

      if (!shouldAttemptStoryPolish || !finalParsed || !finalDiagnostics) {
        if (goodEnoughToStop && validationAttempt >= 1) {
          console.log("[dev-mode-generation] Diminishing-returns brake: stopping polish loop early", {
            validationAttempt,
            currentScore,
            hardIssueCount: finalDiagnostics?.hardIssueCount,
          });
        }
        break;
      }

      const currentParsed: DevModeRawStory = finalParsed;
      const currentDiagnostics: DevModeStoryDiagnostics = finalDiagnostics;
      const currentSeverity = diagnosticsSeverityScore(currentDiagnostics, chapterCount, input.config);
      const polishReason =
        currentDiagnostics.hardIssueCount > 0
          ? "local-hard-gates"
          : currentScore < targetReleaseScore
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
      // v12 §R — line-punchup may only run when the story is RELEASE-NEAR.
      // The new floor (>= 8.6) blocks the historical case where a 7.x story
      // triggered punchup and silently flattened iconic prose without
      // fixing the structural problem. Below 8.6 the router must do
      // structural repair (scene-card, expansion, agency) first.
      const isReleaseNear = typeof currentScore === "number" && currentScore >= DEV_MODE_LINE_PUNCHUP_MIN_SCORE;
      const onlyValidatorScoreGap =
        currentDiagnostics.hardIssueCount === 0
        && currentScore < targetReleaseScore
        && currentDiagnostics.dialogPct >= DEV_MODE_MIN_DIALOG_PCT;
      const onlySoftIssuesAndDialogueOK =
        currentDiagnostics.hardIssueCount === 0
        && currentDiagnostics.softIssueCount > 0
        && currentDiagnostics.dialogPct >= DEV_MODE_TARGET_DIALOG_PCT;
      const canUseLinePunchup = isReleaseNear && (onlyValidatorScoreGap || onlySoftIssuesAndDialogueOK);
      // v12.2: the rescue used to require hardIssueCount === 0, which starved
      // exactly the runs that need it — an open dialogue hard gate routed
      // every attempt into full-story polish instead (run 93129526: the
      // validator's finale must-fixes were never applied; two whole-story
      // polish passes even regressed the market score 7.8 → 7.2). Chapter
      // rescue prompts couple dialogue injection with the validator brief and
      // the emergency dialogue rebalance still runs downstream, so dialog-only
      // hard gates no longer disqualify the rescue.
      const nonDialogHardIssueCount = (currentDiagnostics.hardIssues || []).filter(
        (issue) => !/Dialoganteil|dialog/i.test(issue)
      ).length;
      const validatorQualityRepairChapters =
        nonDialogHardIssueCount === 0
        && currentScore < targetReleaseScore
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
            targetScore: targetReleaseScore,
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
              // Reading pages carry neutral "Leseseite N" titles; a repair
              // model that invents a real chapter title leaks it into the PDF
              // header — run a75b53af shipped "Der Weg in den Garten" on page
              // 5 (with a novelty-forbidden motif) while pages 1-4 stayed
              // generic. Keep the original page title in reading-page mode.
              const repairedChapter = qualityParsed.displayMode === "reading_pages"
                ? { ...repairResult.chapter, title: currentChapter.title }
                : repairResult.chapter;
              qualityParsed = replaceStoryChapter(qualityParsed, repairedChapter);
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
            // If the dialog hard-gate is already open on the current story,
            // accept any repair that strictly reduces hardIssueCount even if
            // dialog drops by a few percent: removing a different hard issue
            // (e.g. title-promise or finale weakness) is more valuable than a
            // marginal dialog wobble, and the emergency dialogue rebalance
            // downstream will lift dialog again if it lands below the floor.
            const isHardGateOpen = currentDiagnostics.hardIssueCount > 0;
            const reducedHardIssues = qualityDiagnostics.hardIssueCount < currentDiagnostics.hardIssueCount;
            // When the dialogue hard gate is already open, requiring the
            // absolute 25% floor here would reject structural rescues that
            // merely keep dialogue stable — non-regression is enough, the
            // emergency rebalance downstream lifts dialogue afterwards.
            const dialogFloorForAcceptance = isHardGateOpen
              ? currentDiagnostics.dialogPct - 1
              : Math.max(DEV_MODE_MIN_DIALOG_PCT, currentDiagnostics.dialogPct - 1);
            const locallyAcceptable = isHardGateOpen && reducedHardIssues
              ? qualitySeverity <= currentSeverity + 260
              : (
                qualityDiagnostics.hardIssueCount <= currentDiagnostics.hardIssueCount
                && qualityDiagnostics.dialogPct >= dialogFloorForAcceptance
                && qualitySeverity <= currentSeverity + 180
              );
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
            rejectedPolishFeedback: lastRejectedPolishFeedback || undefined,
          }
        );
        const storyPolishStage = await runStage("story-polish", storyPolishPrompts, {
          maxTokens: devModeStoryPolishMaxTokens(input.config),
          temperature: currentDiagnostics.hardIssueCount > 0 ? 0.28 : 0.34,
          timeoutMs: devModeStoryDraftTimeoutMs(input.config, true),
          modelRole: "selected-story",
        });
        const parsedPolishResult = parseAndValidate(storyPolishStage.provider.content, chapterCount);
        let polishedParsed = currentParsed.displayMode === "reading_pages"
          ? markStoryAsReadingPages(parsedPolishResult, currentParsed)
          : parsedPolishResult;
        // Run deterministic autofixes (quotes, orthography) on the polish
        // candidate BEFORE acceptance evaluation. Otherwise a substantively
        // better polish gets rejected for a surface issue the pipeline could
        // have fixed for free one line later.
        const polishedAutofix = applyDeterministicStoryTextAutofixes(polishedParsed, input);
        if (polishedAutofix.changed) {
          polishedParsed = polishedAutofix.story;
        }
        const polishedDiagnostics = analyzeDevModeStoryQuality(polishedParsed, input, chapterCount);
        const polishedSeverity = diagnosticsSeverityScore(polishedDiagnostics, chapterCount, input.config);
        const currentHardIssueKeys = new Set(currentDiagnostics.hardIssues.map((issue) => normalizeNoveltyText(issue)));
        // Category-based regression check. Issue strings carry dynamic numbers
        // ("zu kurz (665 Woerter...)"), so exact-string comparison would treat
        // a persisting issue as "new". A polish result is critically regressed
        // when it has a critical CATEGORY the pre-polish story did not have.
        // "Story ist deutlich zu kurz/lang" + "Dialoganteil" joined the list
        // after log 734d7ae5: polish #1 shrank a healthy 974-word draft to 652
        // words and was still accepted; polish #2 expanded without dialogue
        // and tanked the dialogue floor instead.
        const criticalCategoryPatterns: RegExp[] = [
          /Verbotenes/i,
          /Moral/i,
          /ASCII/i,
          /Namensfehler/i,
          /Novelty/i,
          /Wiederholungs/i,
          /Pool-Cast/i,
          /\[object Object\]/i,
          /Story ist deutlich zu kurz/i,
          /Story ist deutlich zu lang/i,
          /Dialoganteil/i,
        ];
        const introducedCriticalHardIssue = criticalCategoryPatterns.some((pattern) =>
          polishedDiagnostics.hardIssues.some((issue) => pattern.test(issue))
          && !currentDiagnostics.hardIssues.some((issue) => pattern.test(issue))
        );
        const locallyAcceptable =
          polishedDiagnostics.hardIssueCount === 0
          || (
            // Softened acceptance: if polish strictly REDUCES the hard-issue
            // count and doesn't introduce a critical new issue, accept it
            // even if severity ticks up slightly (severity weighs soft issues
            // and length penalties; we prioritise eliminating hard gates).
            polishedDiagnostics.hardIssueCount < currentDiagnostics.hardIssueCount
            && !introducedCriticalHardIssue
          )
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
          // Do not give up the run on the first rejected polish: hand the
          // retry the exact budget it broke. The loop bound keeps total
          // polish attempts unchanged; this only converts a wasted exit
          // into one informed retry (log 734d7ae5 shipped a failed-gate
          // story while a near-release rewrite was thrown away here).
          if (validationAttempt < DEV_MODE_MAX_VALIDATION_POLISH_ATTEMPTS) {
            const newCriticalIssues = polishedDiagnostics.hardIssues.filter(
              (issue) => !currentHardIssueKeys.has(normalizeNoveltyText(issue))
            );
            lastRejectedPolishFeedback = {
              attempt: validationAttempt + 1,
              beforeWords: currentDiagnostics.totalWords,
              afterWords: polishedDiagnostics.totalWords,
              beforeDialogPct: currentDiagnostics.dialogPct,
              afterDialogPct: polishedDiagnostics.dialogPct,
              instruction: newCriticalIssues.length > 0
                ? `Your previous rewrite introduced: ${newCriticalIssues.slice(0, 3).join(" | ")}. Fix the original issues WITHOUT introducing these.`
                : "Your previous rewrite regressed overall severity. Keep every passing gate passing while fixing the named issues.",
            };
            repairSelfReflections.push({
              attempt: validationAttempt + 1,
              reason: "full-story-polish-rejected",
              feedbackForNextAttempt: lastRejectedPolishFeedback,
            });
            rawQualityScore = undefined;
            localGateScore = undefined;
            finalQualityScore = undefined;
            finalValidatorFindings = undefined;
            continue;
          }
          break;
        }
        lastRejectedPolishFeedback = null;

        finalParsed = polishedParsed;
        finalModelUsed = storyPolishStage.provider.modelUsed;
        finalDiagnostics = polishedDiagnostics;
        storyPolishApplied = true;

        // v12 §4: page-count guard. Polish must NEVER change the number of
        // reading pages. The previous build (log 0245196d) trimmed 5 reading
        // pages to 4 during polish, which broke a hard wizard gate. If the
        // chapter count drifts here, deterministically re-split the polished
        // prose into `chapterCount` pages using the same balanced splitter
        // that produced the original layout.
        if (
          finalParsed?.displayMode === "reading_pages"
          && Array.isArray(finalParsed.chapters)
          && finalParsed.chapters.length !== chapterCount
        ) {
          console.warn("[dev-mode-generation] §4 page-count repair: polish drifted from required count", {
            requiredPageCount: chapterCount,
            actualPageCount: finalParsed.chapters.length,
          });
          // Rebuild a synthetic DevModeWholeStoryDraft from the polished
          // chapter content so we can call the standard splitter. Paragraphs
          // are re-derived from chapter content (split on blank lines).
          const rebuiltParagraphs: string[] = [];
          for (const ch of finalParsed.chapters) {
            const paras = String(ch.content || "")
              .split(/\n\s*\n/)
              .map((p) => p.trim())
              .filter(Boolean);
            rebuiltParagraphs.push(...paras);
          }
          if (rebuiltParagraphs.length >= chapterCount) {
            const syntheticDraft: DevModeWholeStoryDraft = {
              title: finalParsed.title,
              description: finalParsed.description,
              paragraphs: rebuiltParagraphs,
            };
            const repaired = applyReadingBreaksToDraft(
              syntheticDraft,
              chapterCount,
              localizedLanguageName(input.config.language),
              screenplayPlan
            );
            finalParsed = repaired;
            finalDiagnostics = analyzeDevModeStoryQuality(finalParsed, input, chapterCount);
            recordLocalStage("page-count-repair", {
              requiredPageCount: chapterCount,
              actualPageCount: finalParsed.chapters.length,
              totalWords: finalDiagnostics.totalWords,
            });
            console.log("[dev-mode-generation] §4 page-count repair applied", {
              afterPageCount: finalParsed.chapters.length,
              afterTotalWords: finalDiagnostics.totalWords,
            });
          } else {
            console.warn("[dev-mode-generation] §4 page-count repair skipped: too few paragraphs to split", {
              paragraphCount: rebuiltParagraphs.length,
              chapterCount,
            });
          }
        }

        // Reading-page polish often improves structure while still leaving the
        // full story too narration-heavy. Run a focused dialogue pass after
        // polish, because the earlier repair router may have spent its one
        // targeted pass on structure/length instead of dialogue density.
        if (
          finalParsed.displayMode === "reading_pages"
          && finalDiagnostics.dialogPct < DEV_MODE_DIALOG_REBALANCE_MIN_DIALOG_PCT
        ) {
          const rebalanceTargets = selectDialogueRebalanceTargets(finalParsed, finalDiagnostics, 4);
          if (rebalanceTargets.length > 0) {
            try {
              console.warn("[dev-mode-generation] Triggering post-polish reading-page dialogue rebalance", {
                storyDialogPct: finalDiagnostics.dialogPct,
                targets: rebalanceTargets.map((chapter) => ({
                  order: chapter.order,
                  title: chapter.title,
                })),
              });

              const rebalancePrompts = buildDialogueRebalancePrompts(input, finalParsed, finalDiagnostics, rebalanceTargets);
              const rebalanceStage = await runStage("dialogue-rebalance", rebalancePrompts, {
                maxTokens: input.config.length === "long" ? 3200 : 2600,
                temperature: 0.22,
                timeoutMs: input.config.length === "long" ? 220_000 : 180_000,
                modelRole: "selected-story",
              });
              const rebalancedParsed = parseDialogueRebalanceResult(
                rebalanceStage.provider.content,
                finalParsed,
                finalDiagnostics.totalWords <= getStoryWordBounds(input.config).targetMin
                  ? { minKeepRatio: 0.95 }
                  : undefined
              );
              const rebalancedDiagnostics = analyzeDevModeStoryQuality(rebalancedParsed, input, chapterCount);
              const rebalanceImproved =
                rebalancedDiagnostics.dialogPct >= Math.max(DEV_MODE_DIALOG_REBALANCE_MIN_DIALOG_PCT, finalDiagnostics.dialogPct + 1)
                && rebalancedDiagnostics.hardIssueCount <= finalDiagnostics.hardIssueCount + 1
                && diagnosticsSeverityScore(rebalancedDiagnostics, chapterCount, input.config)
                  <= diagnosticsSeverityScore(finalDiagnostics, chapterCount, input.config) + 180;

              if (rebalanceImproved || isDiagnosticsBetter(rebalancedDiagnostics, finalDiagnostics, chapterCount, input.config)) {
                const dialogPctBefore = finalDiagnostics.dialogPct;
                finalParsed = rebalancedParsed;
                finalModelUsed = rebalanceStage.provider.modelUsed;
                finalDiagnostics = rebalancedDiagnostics;
                storyPolishApplied = true;
                repairSelfReflections.push({
                  attempt: validationAttempt + 1,
                  modelUsed: rebalanceStage.provider.modelUsed,
                  reason: "post-polish-dialogue-rebalance",
                  targetOrders: rebalanceTargets.map((chapter) => chapter.order),
                  deterministicStoryHardIssueCount: rebalancedDiagnostics.hardIssueCount,
                  deterministicStoryDialogPct: rebalancedDiagnostics.dialogPct,
                });
                recordLocalStage("dialogue-rebalance", {
                  targetOrders: rebalanceTargets.map((chapter) => chapter.order),
                  dialogPctBefore,
                  dialogPctAfter: rebalancedDiagnostics.dialogPct,
                  hardIssueCount: rebalancedDiagnostics.hardIssueCount,
                });
              } else {
                console.warn("[dev-mode-generation] Post-polish dialogue rebalance rejected by deterministic diagnostics", {
                  dialogPctBefore: finalDiagnostics.dialogPct,
                  dialogPctAfter: rebalancedDiagnostics.dialogPct,
                  hardIssueCountBefore: finalDiagnostics.hardIssueCount,
                  hardIssueCountAfter: rebalancedDiagnostics.hardIssueCount,
                });
              }
            } catch (rebalanceError) {
              console.warn("[dev-mode-generation] Post-polish dialogue rebalance failed; keeping polished story", {
                error: rebalanceError instanceof Error ? rebalanceError.message : String(rebalanceError),
              });
            }
          }
        }

        // Post-polish targeted rescue: if the polish reduced issues but still
        // leaves chapter-localized hard fails (length, dialogue, paragraphs,
        // long sentences), run one more pass of chapter-repair on the worst
        // offenders. Was previously dialogue-only; widened to also rescue
        // length issues, which the full-story polish often fails to cut.
        if (finalParsed.displayMode !== "reading_pages" && isChapterLocalHardFailure(finalDiagnostics)) {
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

    // Deterministic last-mile remediation after the creative passes have run.
    // v11 §2: metadata sanitizer FIRST — always — so generic genre adjectives
    // ("warme, lustige Märchengeschichte") never block release, regardless of
    // whether they appear in the dynamic novelty motif list.
    if (finalParsed) {
      const sanitized = sanitizeDescription(finalParsed.description || "");
      if (sanitized.changed && sanitized.description.length >= 10) {
        console.log("[dev-mode-generation] §2 metadata sanitizer applied", {
          before: finalParsed.description,
          after: sanitized.description,
          removed: sanitized.removed,
        });
        finalParsed = { ...finalParsed, description: sanitized.description };
      }

      // v11 §8: orthography autofix on chapter content (umlaut translit only).
      const orthoFixes: string[] = [];
      const fixedChapters = finalParsed.chapters.map((chapter) => {
        const result = applyOrthographyAutoFix(chapter.content);
        if (result.changed) orthoFixes.push(...result.fixes);
        return result.changed ? { ...chapter, content: result.text } : chapter;
      });
      if (orthoFixes.length > 0) {
        console.log("[dev-mode-generation] §8 orthography autofix applied", {
          fixes: [...new Set(orthoFixes)],
        });
        finalParsed = finalParsed.displayMode === "reading_pages"
          ? markStoryAsReadingPages({ ...finalParsed, chapters: fixedChapters }, finalParsed)
          : { ...finalParsed, chapters: fixedChapters };
      }

      // v13: reading-page layout rebalance (orphan-merge + overflow-relief).
      // Deterministic and meaning-preserving; keeps the PDF/reader from
      // rendering tiny orphan pages next to bloated pages (run a75b53af).
      let layoutRebalanced = false;
      if (finalParsed.displayMode === "reading_pages") {
        const rebalance = rebalanceReadingPageLayout(finalParsed.chapters, input.config);
        if (rebalance.changed) {
          layoutRebalanced = true;
          finalParsed = markStoryAsReadingPages(
            { ...finalParsed, chapters: rebalance.chapters },
            finalParsed,
          );
          console.log("[dev-mode-generation] §13 reading-page layout rebalanced", {
            pageParagraphCounts: rebalance.chapters.map((c) => splitParagraphs(c.content).length),
            pageChars: rebalance.chapters.map((c) => c.content.length),
          });
        }
      }

      if (sanitized.changed || orthoFixes.length > 0 || layoutRebalanced) {
        finalDiagnostics = analyzeDevModeStoryQuality(finalParsed, input, chapterCount);
        rawQualityScore = undefined;
        finalValidatorFindings = undefined;
        localGateScore = calculateLocalGateScore(finalDiagnostics, { qualityMode: input.qualityMode });
        finalQualityScore = applyHardCaps(rawQualityScore, finalDiagnostics, { qualityMode: input.qualityMode });
      }
    }

    // Emergency dialogue rebalance: if the polish loop ran but every attempt
    // was rejected by deterministic diagnostics, the dialogue hard-gate can
    // still be open here. Up to two consecutive rebalance passes — accepted
    // on a looser criterion than inside the loop — give the story a final
    // chance to clear the floor before release gating turns the run into
    // quality_gate_failed. The loop bails as soon as a pass fails to lift
    // dialog further or the floor is cleared.
    for (let emergencyAttempt = 0; emergencyAttempt < 2; emergencyAttempt++) {
      if (
        !finalParsed
        || !finalDiagnostics
        || finalParsed.displayMode !== "reading_pages"
        || finalDiagnostics.dialogPct >= DEV_MODE_MIN_DIALOG_PCT
      ) break;
      const targetLimit = finalDiagnostics.dialogPct < DEV_MODE_MIN_CHAPTER_DIALOG_PCT
        ? Math.max(5, finalParsed.chapters.length)
        : 5;
      const rebalanceTargets = selectDialogueRebalanceTargets(finalParsed, finalDiagnostics, targetLimit);
      if (rebalanceTargets.length === 0) break;
      try {
        console.warn("[dev-mode-generation] Emergency dialogue rebalance triggered (post-polish gate still open)", {
          attempt: emergencyAttempt + 1,
          storyDialogPct: finalDiagnostics.dialogPct,
          hardIssueCount: finalDiagnostics.hardIssueCount,
          targetCount: rebalanceTargets.length,
        });
        const rebalancePrompts = buildDialogueRebalancePrompts(input, finalParsed, finalDiagnostics, rebalanceTargets);
          const rebalanceStage = await runStage("dialogue-rebalance", rebalancePrompts, {
            maxTokens: input.config.length === "long" ? 3200 : 2600,
            temperature: 0.22,
            timeoutMs: input.config.length === "long" ? 220_000 : 180_000,
            modelRole: "selected-story",
          });
          const rebalancedParsed = parseDialogueRebalanceResult(
            rebalanceStage.provider.content,
            finalParsed,
            finalDiagnostics.totalWords <= getStoryWordBounds(input.config).targetMin
              ? { minKeepRatio: 0.95 }
              : undefined
          );
          const rebalancedDiagnostics = analyzeDevModeStoryQuality(rebalancedParsed, input, chapterCount);
          const acceptable =
            rebalancedDiagnostics.dialogPct > finalDiagnostics.dialogPct
            && rebalancedDiagnostics.hardIssueCount <= finalDiagnostics.hardIssueCount;
          if (acceptable) {
            console.log("[dev-mode-generation] Emergency dialogue rebalance accepted", {
              dialogPctBefore: finalDiagnostics.dialogPct,
              dialogPctAfter: rebalancedDiagnostics.dialogPct,
              hardIssueCountBefore: finalDiagnostics.hardIssueCount,
              hardIssueCountAfter: rebalancedDiagnostics.hardIssueCount,
            });
            finalParsed = rebalancedParsed;
            finalDiagnostics = rebalancedDiagnostics;
            storyPolishApplied = true;
            rawQualityScore = undefined;
            finalValidatorFindings = undefined;
            localGateScore = calculateLocalGateScore(finalDiagnostics, { qualityMode: input.qualityMode });
            finalQualityScore = applyHardCaps(rawQualityScore, finalDiagnostics, { qualityMode: input.qualityMode });
          } else {
            console.warn("[dev-mode-generation] Emergency dialogue rebalance rejected", {
              dialogPctBefore: finalDiagnostics.dialogPct,
              dialogPctAfter: rebalancedDiagnostics.dialogPct,
              hardIssueCountBefore: finalDiagnostics.hardIssueCount,
              hardIssueCountAfter: rebalancedDiagnostics.hardIssueCount,
            });
          }
        } catch (rebalanceError) {
          console.warn("[dev-mode-generation] Emergency dialogue rebalance failed", {
            error: rebalanceError instanceof Error ? rebalanceError.message : String(rebalanceError),
          });
        }
    }

    // Legacy: motif-list-driven scrub for cases the static sanitizer missed.
    if (finalParsed && finalDiagnostics && finalDiagnostics.hardIssueCount > 0) {
      let remediated = false;
      const brief = input.noveltyBrief;
      if (brief && finalParsed.description) {
        const normalizedDesc = normalizeNoveltyText(finalParsed.description);
        const allChapterContent = finalParsed.chapters.map((c) => `${c.title}\n${c.content}`).join("\n");
        const normalizedBody = normalizeNoveltyText(allChapterContent);
        for (const motif of brief.hardAvoidMotifs) {
          const normalizedMotif = normalizeNoveltyText(motif);
          if (normalizedMotif.length < 4 || NOVELTY_STOPWORDS.has(normalizedMotif)) continue;
          if (isCurrentCharacterNameMotif(normalizedMotif, input)) continue;
          // Only strip from description if the motif is NOT a load-bearing
          // story element (i.e. not also in the chapter body / chapter titles).
          const inDescription = noveltyMotifMatches(normalizedDesc, normalizedMotif);
          const inBody = noveltyMotifMatches(normalizedBody, normalizedMotif);
          if (inDescription && !inBody) {
            const stripRegex = new RegExp(`,?\\s*\\b${motif.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\w{0,4}\\b`, "gi");
            const cleaned = finalParsed.description.replace(stripRegex, "").replace(/\s+,/g, ",").replace(/,\s*,/g, ",").replace(/\s{2,}/g, " ").trim();
            if (cleaned && cleaned.length >= 10 && cleaned !== finalParsed.description) {
              console.log("[dev-mode-generation] Deterministic description scrub", { motif, before: finalParsed.description, after: cleaned });
              finalParsed = { ...finalParsed, description: cleaned };
              remediated = true;
            }
          }
        }
      }
      const titleIssue = finalDiagnostics.hardIssues.find((issue) => issue.startsWith("Titel-Versprechen unerfuellt"));
      if (titleIssue && finalParsed.title) {
        const missingMatch = titleIssue.match(/\(([^)]+)\)/);
        const missing = missingMatch ? missingMatch[1].split(",").map((w) => w.trim()).filter(Boolean) : [];
        let trimmedTitle = finalParsed.title;
        for (const word of missing) {
          // Trim the missing adjective (and any trailing/leading whitespace and
          // remaining hyphens) from the title. We only trim words 5+ chars to
          // avoid mangling short connective words.
          if (word.length < 5) continue;
          const safe = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const re = new RegExp(`\\b${safe}\\w{0,4}\\b\\s*-?\\s*`, "gi");
          trimmedTitle = trimmedTitle.replace(re, "").replace(/\s{2,}/g, " ").replace(/\s+-\s+/g, " - ").trim();
        }
        // Cleanup leading article remnants like "Der " followed by nothing.
        trimmedTitle = trimmedTitle.replace(/^(Der|Die|Das|Ein|Eine)\s+$/i, "").trim();
        const trimmedTitleWords = (trimmedTitle.match(/[\p{L}]+/gu) || [])
          .filter((word) => !/^(der|die|das|den|dem|des|ein|eine|einer|eines|und|oder|von|vom|im|in|am|an|zu|zum|zur)$/i.test(word));
        const titleLooksBroken =
          trimmedTitleWords.length < 2
          || /\b(der|die|das|den|dem|des|ein|eine)\s+(der|die|das|den|dem|des|ein|eine)\b/i.test(trimmedTitle)
          || /^(der|die|das|den|dem|des|ein|eine)\s*$/i.test(trimmedTitle)
          || titleLooksLikeDanglingFragment(trimmedTitle)
          || Boolean(
            input.selectedIdea?.title
            && normalizeTitleForIntegrity(input.selectedIdea.title).startsWith(normalizeTitleForIntegrity(trimmedTitle))
            && normalizeTitleForIntegrity(input.selectedIdea.title) !== normalizeTitleForIntegrity(trimmedTitle)
          );
        if (titleLooksBroken && trimmedTitle !== finalParsed.title) {
          console.warn("[dev-mode-generation] Deterministic title trim rejected because it would produce a broken title", {
            before: finalParsed.title,
            rejected: trimmedTitle,
            missing,
          });
        } else if (trimmedTitle && trimmedTitle.length >= 4 && trimmedTitle !== finalParsed.title) {
          console.log("[dev-mode-generation] Deterministic title trim", { before: finalParsed.title, after: trimmedTitle, missing });
          finalParsed = { ...finalParsed, title: trimmedTitle };
          remediated = true;
        }
      }
      const restoredTitleStory = restoreSelectedIdeaTitleIfFragment(finalParsed, input);
      if (restoredTitleStory.title !== finalParsed.title) {
        finalParsed = restoredTitleStory;
        remediated = true;
      }
      if (remediated) {
        finalDiagnostics = analyzeDevModeStoryQuality(finalParsed, input, chapterCount);
        rawQualityScore = undefined;
        finalValidatorFindings = undefined;
        localGateScore = calculateLocalGateScore(finalDiagnostics, { qualityMode: input.qualityMode });
        finalQualityScore = applyHardCaps(rawQualityScore, finalDiagnostics, { qualityMode: input.qualityMode });
        console.log("[dev-mode-generation] Diagnostics re-evaluated after remediation", {
          hardIssueCount: finalDiagnostics.hardIssueCount,
          softIssueCount: finalDiagnostics.softIssueCount,
          localGateScore,
          finalQualityScore,
        });
      }
    }

    if (finalParsed) {
      const restoredTitleStory = restoreSelectedIdeaTitleIfFragment(finalParsed, input);
      if (restoredTitleStory.title !== finalParsed.title) {
        finalParsed = restoredTitleStory;
        finalDiagnostics = analyzeDevModeStoryQuality(finalParsed, input, chapterCount);
        rawQualityScore = undefined;
        finalValidatorFindings = undefined;
        localGateScore = calculateLocalGateScore(finalDiagnostics, { qualityMode: input.qualityMode });
        finalQualityScore = applyHardCaps(rawQualityScore, finalDiagnostics, { qualityMode: input.qualityMode });
      }
    }

    // FINAL deterministic text autofix — runs AFTER every creative/LLM stage
    // (validation loop, full-story polish, emergency dialogue rebalance,
    // motif/title remediation). Those late LLM passes can re-introduce broken
    // German grammar ("Ich Idee"), straight/unbalanced quotes, and ASCII
    // umlaut transliterations that an earlier in-loop autofix already cleared.
    // Production shipped „Ich Idee, ich kann Fauchi nicht beschützen." at the
    // emotional climax (Rindenplan PDF) precisely because the grammar autofix
    // only ran inside the loop while the emergency rebalance ran after it.
    // This last-mile pass guarantees no grammar/quote/orthography artefact can
    // survive into the persisted story or PDF, regardless of which stage
    // introduced it.
    if (finalParsed) {
      const finalAutofix = applyDeterministicStoryTextAutofixes(finalParsed, input);
      if (finalAutofix.changed) {
        finalParsed = finalAutofix.story;
        finalDiagnostics = analyzeDevModeStoryQuality(finalParsed, input, chapterCount);
        rawQualityScore = undefined;
        finalValidatorFindings = undefined;
        localGateScore = calculateLocalGateScore(finalDiagnostics, { qualityMode: input.qualityMode });
        finalQualityScore = applyHardCaps(rawQualityScore, finalDiagnostics, { qualityMode: input.qualityMode });
        console.log("[dev-mode-generation] Final last-mile deterministic text autofix applied", {
          fixes: finalAutofix.fixes,
          hardIssueCount: finalDiagnostics.hardIssueCount,
          dialogPct: finalDiagnostics.dialogPct,
        });
      }
    }

    // If any post-validation polish or deterministic last-mile edit changed
    // the story, validator findings are intentionally cleared. Refresh them
    // once here so the release score, dimension failures, and logged warnings
    // describe the ACTUAL story returned to the child, not the pre-polish
    // draft. This specifically prevents stale 7.x validator feedback from
    // surviving after a final story-polish pass.
    if (
      finalParsed
      && finalDiagnostics
      && !finalValidatorFindings
      && (finalDiagnostics.hardIssueCount ?? 0) === 0
    ) {
      try {
        const validationPrompts = buildValidationPrompts(input, chapterCount, finalParsed, finalDiagnostics);
        const validationStage = await runStage("final-validation", validationPrompts, {
          maxTokens: 1800,
          temperature: 0.1,
          timeoutMs: 120_000,
          ...supportCallOptions,
          modelRole: "support",
        });
        finalValidatorFindings = validationStage.parsed;
        rawQualityScore = extractQualityScore(validationStage.parsed) ?? undefined;
        localGateScore = calculateLocalGateScore(finalDiagnostics, { qualityMode: input.qualityMode });
        finalQualityScore = applyHardCaps(rawQualityScore, finalDiagnostics, { qualityMode: input.qualityMode });
        console.log("[dev-mode-generation] Refreshed final validation after post-polish changes", {
          rawQualityScore,
          localGateScore,
          finalQualityScore,
          hardIssueCount: finalDiagnostics.hardIssueCount,
          dialogPct: finalDiagnostics.dialogPct,
        });
      } catch (validationError) {
        console.warn("[dev-mode-generation] Final validation refresh failed; using deterministic local gate score", {
          error: validationError instanceof Error ? validationError.message : String(validationError),
          hardIssueCount: finalDiagnostics.hardIssueCount,
          dialogPct: finalDiagnostics.dialogPct,
        });
        rawQualityScore = undefined;
        localGateScore = calculateLocalGateScore(finalDiagnostics, { qualityMode: input.qualityMode });
        finalQualityScore = applyHardCaps(rawQualityScore, finalDiagnostics, { qualityMode: input.qualityMode });
      }
    }

    // v11 §1 + §13: derive a STRICT release score. If hard gates are still
    // open after all repair attempts, the final score is forcibly capped at
    // 7.9 so a downstream "score >= 9" check cannot accidentally let a
    // story through with releaseReady=true. The cap below honours
    // calculateLocalGateScore (always >= 0 if defined) and never raises
    // an existing score.
    let releaseScore = finalQualityScore ?? rawQualityScore ?? localGateScore ?? 0;
    if ((finalDiagnostics?.hardIssueCount ?? 0) > 0) {
      const cap = Math.min(localGateScore ?? 7.9, 7.9);
      if (releaseScore > cap) releaseScore = cap;
    }
    // v11 §5: quality-mode-aware minimum. "efficient" mode targets 8.3+,
    // "premium" targets 9.0+. When mode is unset we keep the legacy
    const qualityMode = input.qualityMode || "premium";
    const minReleaseScore = minReleaseScoreForMode(qualityMode);
    const releaseGateFailures: string[] = [];
    if (finalDiagnostics?.hardIssueCount && finalDiagnostics.hardIssueCount > 0) {
      releaseGateFailures.push(formatQualityGateFailureReason(finalDiagnostics) || "Hard local quality gates failed.");
    }
    if (releaseScore < minReleaseScore) {
      releaseGateFailures.push(
        `Developer-mode story market-quality score ${releaseScore} is below ${minReleaseScore} (mode=${qualityMode}).`
      );
    }
    releaseGateFailures.push(...releaseDimensionFailures(finalValidatorFindings, { mode: qualityMode }));
    releaseGateFailures.push(...releaseBlockingValidatorMustFixes(finalValidatorFindings, qualityMode));
    releaseGateFailures.push(...releasePremiumStrictGate(finalDiagnostics, qualityMode));
    if (shouldBlockDevModeQualityGateFailure(input, finalDiagnostics)) {
      throw new Error(releaseGateFailures[0] || "Developer-mode story still has open hard gates after all repair attempts.");
    }
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
        selectedPremiseSeedId: input.selectedIdea?.premiseSeedId,
        selectedPremiseSeedMutation: input.selectedIdea?.premiseSeedMutation,
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
        displayMode: parsed.displayMode,
        storyTextChars: parsed.storyText?.length,
        readingBreaks: parsed.readingBreaks,
        displayPageCount: parsed.displayMode === "reading_pages" ? parsed.chapters.length : undefined,
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
    metadata: {
      devMode: true,
      pipeline: DEV_MODE_PIPELINE_ID,
      stage: qualityGateFailureReason ? "quality_gate_failed" : "complete",
    },
  }).catch((logErr) => {
    console.warn("[dev-mode-generation] Failed to publish success log:", logErr);
  });

  const sortedParsedChapters = parsed.chapters.slice().sort((a, b) => a.order - b.order);

  // Image generation (cover + per-reading-page). Text quality warnings must
  // not suppress images in production; a completed child-facing story should
  // remain visually complete even when releaseReady=false for editorial review.
  let devModeImages: {
    coverImageUrl?: string;
    chapterImages: Map<number, { imageUrl?: string; prompt: string }>;
    imagesGenerated: number;
    promptTokenUsage: { prompt: number; completion: number; total: number };
  } = {
    coverImageUrl: undefined,
    chapterImages: new Map(),
    imagesGenerated: 0,
    promptTokenUsage: { prompt: 0, completion: 0, total: 0 },
  };

  const hasOpenQualityGate = Boolean(qualityGateFailureReason) || ((finalDiagnostics?.hardIssueCount ?? 0) > 0);
  const skipImageGenerationForQualityGate = false;

  if (hasOpenQualityGate) {
    console.warn("[dev-mode-generation] §F release-gate warning; continuing image generation for product completeness", {
      hardIssueCount: finalDiagnostics?.hardIssueCount,
      qualityGateFailureReason,
      finalQualityScore,
    });
  }
  // v12 §B: debug mode skips the image pipeline entirely. The caller is
  // running for diagnostics; image cost is wasted and would obscure the text
  // failure mode. Story metadata still reports `debug: true` so downstream
  // consumers can detect this.
  if (isDebugMode(input)) {
    console.warn("[dev-mode-generation] §B debug mode: skipping image generation (text-only diagnostics run)");
  } else {
    try {
      devModeImages = await generateDevModeImages(input, parsed.title, sortedParsedChapters, screenplayPlan);
      totalUsage.prompt += devModeImages.promptTokenUsage.prompt;
      totalUsage.completion += devModeImages.promptTokenUsage.completion;
      totalUsage.total += devModeImages.promptTokenUsage.total;
    } catch (err) {
      console.warn("[dev-mode-generation] Image generation step failed:", (err as Error)?.message || err);
    }
  }

  const chapters = sortedParsedChapters.map((ch, idx) => {
    const order = idx + 1;
    const img = devModeImages.chapterImages.get(ch.order) || devModeImages.chapterImages.get(order);
    return {
      id: crypto.randomUUID(),
      title: ch.title,
      content: ch.content,
      order,
      imageUrl: img?.imageUrl,
      imagePrompt: img?.prompt,
      imageModel: img?.imageUrl ? "runware" : undefined,
    };
  });

  // Best-effort: record the artifact assignment so usage counters and recent
  // history work the same way as in the standard pipeline. Failure here must
  // never break the generated story.
  if (input.matchedArtifact?.id && input.storyId) {
    try {
      await recordStoryArtifact(input.storyId, input.matchedArtifact.id, 2, Math.max(3, chapters.length - 1));
    } catch (err) {
      console.warn("[dev-mode-generation] recordStoryArtifact failed:", (err as Error)?.message || err);
    }
  }

  // v11 §3: record this story's motif fingerprint so future generations can
  // compare against it. Best-effort — a DB failure must never break delivery.
  if (input.storyId && input.userId) {
    try {
      const fingerprint = buildFingerprintFromBlueprint(input.storyId, {
        title: parsed.title,
        description: parsed.description,
        centralObject: input.selectedIdea?.centralObjectOrPlace || "",
        centralPlace: input.selectedIdea?.centralObjectOrPlace || "",
        wonderRule: input.selectedIdea?.wonderRule || "",
        emotionalEngine: input.selectedIdea?.emotionalEngine || "",
        coreConflict: input.selectedIdea?.coreConflict || "",
      }, (parsed.readingBreaks || []).map((br) => br.imagePromptScene).filter(Boolean).length > 0
        ? (parsed.readingBreaks || []).map((br) => br.imagePromptScene).filter(Boolean)
        : chapters.map((c) => c.title));
      const seedTags = input.selectedIdea?.premiseSeedId
        ? [`premise_seed:${input.selectedIdea.premiseSeedId}`]
        : [];
      const seedMutationKeywords = input.selectedIdea?.premiseSeedMutation
        ? extractMotifKeywords(input.selectedIdea.premiseSeedMutation, 8)
        : [];
      await recordStoryMotif({
        ...fingerprint,
        motifTags: [...new Set([...fingerprint.motifTags, ...seedTags])],
        motifKeywords: [...new Set([...fingerprint.motifKeywords, ...seedMutationKeywords])].slice(0, 24),
      }, input.userId, DEV_MODE_PIPELINE_ID);
    } catch (err) {
      console.warn("[dev-mode-generation] §3 recordStoryMotif failed (non-fatal):", err instanceof Error ? err.message : String(err));
    }
  }

  // v12 §S — classify the final outcome into a structured route the caller
  // can act on. Computed once here so the same values feed both `metadata`
  // and the (optional) log entry.
  const routingDecision = (() => {
    const mode = input.qualityMode || "premium";
    const minScore = minReleaseScoreForMode(mode);
    const releaseScore = finalQualityScore ?? rawQualityScore ?? localGateScore ?? 0;
    const dimFailures = releaseDimensionFailures(finalValidatorFindings, { mode });
    const validatorMustFixFailures = releaseBlockingValidatorMustFixes(finalValidatorFindings, mode);
    const premiumStrictFailures = releasePremiumStrictGate(finalDiagnostics, mode);
    const releaseReadyComputed =
      (finalDiagnostics?.hardIssueCount ?? 0) === 0
      && dimFailures.length === 0
      && validatorMustFixFailures.length === 0
      && premiumStrictFailures.length === 0
      && releaseScore >= minScore;
    return classifyFinalRouting({
      releaseReady: releaseReadyComputed,
      hardIssues: finalDiagnostics?.hardIssues ?? [],
      softIssues: finalDiagnostics?.softIssues ?? [],
      releaseDimensionFailures: dimFailures,
      validatorMustFixFailures,
      imagesSkipped: isDebugMode(input) || skipImageGenerationForQualityGate,
      dimensionScores: {
        emotionalPayoff: finalValidatorFindings?.dimensionScores?.emotionalEngine,
        readOnPull: finalValidatorFindings?.dimensionScores?.pageTurnDrive,
        causalChain: finalValidatorFindings?.dimensionScores?.causalChain,
        voiceDistinctiveness: finalValidatorFindings?.dimensionScores?.voiceDistinctiveness,
        childComprehension: finalValidatorFindings?.dimensionScores?.ageFit,
      },
    });
  })();

  // Final-story content-hash tripwire. We hash the parsed (post-repair)
  // canonical text and the rendered chapters[] separately. If they diverge,
  // the render path is using a stale story object — this would cause the
  // user to see prose that was already rejected by the validator.
  const acceptedFinalStoryTitle = String(parsed.title || "").trim();
  const acceptedFinalStoryDescription = String(parsed.description || parsed.title || "").trim();
  const acceptedFinalStoryHash = computeStoryContentHash({
    title: acceptedFinalStoryTitle,
    description: acceptedFinalStoryDescription,
    chapters: sortedParsedChapters.map((ch, idx) => ({
      title: ch.title,
      content: ch.content,
      order: idx + 1,
    })),
  });
  const exportContentHash = computeStoryContentHash({
    title: acceptedFinalStoryTitle,
    description: acceptedFinalStoryDescription,
    chapters: chapters.map((ch) => ({
      title: ch.title,
      content: ch.content,
      order: ch.order,
    })),
  });
  if (exportContentHash !== acceptedFinalStoryHash) {
    console.error("[dev-mode-generation] FATAL: export content hash drifted from accepted final story", {
      acceptedFinalStoryHash,
      exportContentHash,
      acceptedChapterCount: sortedParsedChapters.length,
      exportChapterCount: chapters.length,
    });
    // Repair the divergence by re-projecting chapters from parsed; image
    // metadata is preserved by order index. We never want to surface stale
    // text to the renderer/PDF.
    for (let i = 0; i < chapters.length; i++) {
      const ch = chapters[i];
      const source = sortedParsedChapters[i];
      if (!source) continue;
      ch.title = source.title;
      ch.content = source.content;
    }
  }
  // Story version increments by 1 per applied repair pass on the prose
  // (story-polish, chapter-repair, dialogue-rebalance). 1 means no repair.
  const storyVersion = 1
    + (storyPolishApplied ? 1 : 0)
    + (chapterRepairApplied ? 1 : 0);

  return {
    title: parsed.title,
    description: parsed.description || parsed.title,
    coverImageUrl: devModeImages.coverImageUrl,
    storyText: parsed.storyText,
    readingBreaks: parsed.readingBreaks,
    displayMode: parsed.displayMode,
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
      imagesGenerated: devModeImages.imagesGenerated,
      developerMode: true,
      devModePipeline: DEV_MODE_PIPELINE_ID,
      displayMode: parsed.displayMode,
      readingBreaks: parsed.readingBreaks,
      storyText: parsed.storyText,
      storyPolishApplied,
      chapterRepairApplied,
      localQualityDiagnostics: finalDiagnostics,
      repairSelfReflections,
      rawQualityScore,
      localGateScore,
      literaryValidation: finalValidatorFindings,
      // Final-story content integrity. Persisted alongside the story so any
      // downstream renderer (PDF, frontend, validator re-run) can verify that
      // the bytes it is about to publish match the bytes the quality gate
      // accepted. Mismatch is a render-pipeline bug, not a content bug.
      storyVersion,
      storyContentHash: acceptedFinalStoryHash,
      // v11 §1 + §5: releaseReady is true ONLY when no hard gates remain
      // AND score meets the mode-specific minimum (premium 9.0, efficient 8.3).
      releaseReady:
        (finalDiagnostics?.hardIssueCount ?? 0) === 0
        && releaseDimensionFailures(finalValidatorFindings, { mode: input.qualityMode }).length === 0
        && releaseBlockingValidatorMustFixes(finalValidatorFindings, input.qualityMode).length === 0
        && releasePremiumStrictGate(finalDiagnostics, input.qualityMode).length === 0
        && (finalQualityScore ?? rawQualityScore ?? localGateScore ?? 0)
          >= minReleaseScoreForMode(input.qualityMode),
      // v12 §1: explicit editorial release status. Text may be persisted and
      // illustrated for product completeness while releaseReady remains false.
      status: ((): "ok" | "quality_gate_failed" => {
        const mode = input.qualityMode || "premium";
        const releaseScore = finalQualityScore ?? rawQualityScore ?? localGateScore ?? 0;
        const minScore = minReleaseScoreForMode(mode);
        const releaseReadyComputed =
          (finalDiagnostics?.hardIssueCount ?? 0) === 0
          && releaseDimensionFailures(finalValidatorFindings, { mode }).length === 0
          && releaseBlockingValidatorMustFixes(finalValidatorFindings, mode).length === 0
          && releasePremiumStrictGate(finalDiagnostics, mode).length === 0
          && releaseScore >= minScore;
        if (mode === "premium" && !releaseReadyComputed) return "quality_gate_failed";
        if ((finalDiagnostics?.hardIssueCount ?? 0) > 0) return "quality_gate_failed";
        return "ok";
      })(),
      hardIssueList: finalDiagnostics?.hardIssues ?? [],
      // v12 §F: quality gates no longer skip production images. This flag is
      // kept for backwards compatibility and should remain false outside
      // debug/text-only runs.
      imagesSkippedDueToQualityGate: skipImageGenerationForQualityGate,
      qualityMode: input.qualityMode || "premium",
      debug: isDebugMode(input) ? true : undefined,
      // v12 §S — structured final-validation routing for downstream dashboards.
      failureClass: routingDecision.failureClass,
      recommendedRoute: routingDecision.recommendedRoute,
      mustFixBeforeRelease: routingDecision.mustFixBeforeRelease.length > 0
        ? routingDecision.mustFixBeforeRelease
        : undefined,
      // qualityGatePassed kept as alias for downstream code that still reads it.
      qualityGatePassed:
        (finalDiagnostics?.hardIssueCount ?? 0) === 0
        && (finalQualityScore ?? rawQualityScore ?? localGateScore ?? 0) >= minReleaseScoreForMode(input.qualityMode)
        && releaseDimensionFailures(finalValidatorFindings, { mode: input.qualityMode }).length === 0
        && releaseBlockingValidatorMustFixes(finalValidatorFindings, input.qualityMode).length === 0
        && releasePremiumStrictGate(finalDiagnostics, input.qualityMode).length === 0,
      qualityGateFailureReason,
      // Keep field for backwards compat: generation can return with warnings,
      // while releaseReady/qualityGatePassed stay false.
      returnedWithQualityGateWarnings: Boolean(qualityGateFailureReason),
      noveltySeed: input.noveltyBrief?.seed,
      noveltyRecentStoryCount: input.noveltyBrief?.recentStories.length ?? 0,
      noveltyHardAvoidMotifCount: input.noveltyBrief?.hardAvoidMotifs.length ?? 0,
      noveltyKeyMomentLens: input.noveltyBrief?.keyMomentLens,
      ideaCandidateCount: ideaCandidates.length,
      selectedIdeaTitle: input.selectedIdea?.title,
      selectedPremiseSeedId: input.selectedIdea?.premiseSeedId,
      selectedPremiseSeedMutation: input.selectedIdea?.premiseSeedMutation,
      selectedSupportingCast: input.selectedIdea?.selectedSupportingCast,
      characterPoolUsed: (() => {
        const selected = input.selectedIdea?.selectedSupportingCast || [];
        if (!selected.length || !input.poolCharacters?.length) return undefined;
        const wanted = new Set(selected.map((n) => normalizePoolName(String(n))));
        const used = input.poolCharacters
          .filter((c) => wanted.has(normalizePoolName(c.name)))
          .map((c) => ({ characterId: c.id, characterName: c.name }));
        return used.length > 0 ? used : undefined;
      })(),
      matchedArtifact: input.matchedArtifact
        ? {
            id: input.matchedArtifact.id,
            name: input.matchedArtifact.name,
            category: input.matchedArtifact.category,
            rarity: input.matchedArtifact.rarity,
          }
        : undefined,
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
  image_url: string | null;
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
      SELECT id, name, image_url, role, archetype, emotional_nature, visual_profile,
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
      imageUrl: r.image_url || undefined,
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
