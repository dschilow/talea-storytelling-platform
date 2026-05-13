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
import { publishWithTimeout } from "../helpers/pubsubTimeout";
import { logTopic } from "../log/logger";
import { storyDB } from "./db";

const openAIKey = secret("OpenAIKey");

const DEFAULT_GEMINI_MODEL = "gemini-3-flash-preview";
const DEV_MODE_SUPPORT_MODEL = "google/gemini-3.1-flash-lite";
const DEV_MODE_PIPELINE_ID = "adaptive-chapter-repair-v3";
const DEV_MODE_MIN_DIALOG_PCT = 25;
const DEV_MODE_TARGET_DIALOG_PCT = 30;
const DEV_MODE_MIN_CHAPTER_DIALOG_PCT = 18;
const DEV_MODE_MIN_PARAGRAPHS = 6;
const DEV_MODE_MAX_PARAGRAPHS = 12;
const DEV_MODE_MAX_REPAIR_ATTEMPTS = 2;
const DEV_MODE_SECOND_PASS_REPAIR_CHAPTER_LIMIT = 2;
const DEV_MODE_CHAPTER_DIALOG_LINE_TARGET = 8;
const DEV_MODE_CHAPTER_SPEAKER_TURN_TARGET = 3;

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
  | "blueprint"
  | "dramaturgy-check"
  | "story-draft"
  | "chapter-repair"
  | "story-polish"
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
    devModePipeline?: typeof DEV_MODE_PIPELINE_ID | "adaptive-chapter-repair-v2" | "four-stage-cost-optimized";
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
    repairSelfReflections?: any[];
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
 * Slim pool character info for prompt injection. Mirrors what the standard
 * pipeline's casting-engine produces (auto-cast), but stripped to what a
 * single-shot prompt actually needs.
 */
export interface DevModePoolCharacter {
  id: string;
  name: string;
  role?: string;
  archetype?: string;
  species?: string | null;
  ageCategory?: string | null;
  /** One-line visual hook. */
  physicalDescription?: string | null;
  /** Up to ~3 personality words. */
  personalityKeywords?: string[];
  catchphrase?: string | null;
  speechStyle?: string[];
  quirk?: string | null;
  backstory?: string | null;
}

export interface DevModeGenerationInput {
  config: StoryConfig;
  /** Full hero avatars (the user's chosen avatars). */
  avatars: DevModeAvatar[];
  /** Auto-cast supporting characters picked from character_pool. */
  poolCharacters?: DevModePoolCharacter[];
  primaryProfileAge?: number | null;
}

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
    if (c.personalityKeywords && c.personalityKeywords.length > 0) {
      lines.push(`   Character: ${c.personalityKeywords.join(", ")}`);
    }
    if (c.catchphrase) lines.push(`   Catchphrase (translate into the target language while preserving meaning): "${c.catchphrase}"`);
    if (c.speechStyle && c.speechStyle.length > 0) {
      lines.push(`   Speech style: ${c.speechStyle.join(", ")}`);
    }
    if (c.quirk) lines.push(`   Quirk: ${c.quirk}`);
    const backstory = sanitizePoolPromptText(c.backstory);
    if (backstory) lines.push(`   Backstory: ${backstory}`);
  });
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
    `Write a children's story with ${chapterCount} chapters.`,
    `Age group: ${config.ageGroup}.`,
    `Genre: ${config.genre}.`,
    `Setting: ${config.setting}.`,
    "",
    avatarBlock,
    poolBlock || null,
    "",
    learningLine,
    customLine,
    "Each chapter needs a clear arc (beginning, middle, turn/climax) and must feel complete on its own.",
    `"order" starts at 1 and counts up. Exactly ${chapterCount} chapters.`,
    `"description" is a 1–2 sentence blurb.`,
    `FINAL REMINDER: title, description and all chapter content MUST be in ${languageName}.`,
  ]
    .filter((line): line is string => line !== null && line !== undefined)
    .join("\n");

  return { systemPrompt, userPrompt, chapterCount };
}

function buildDevStoryContext(input: DevModeGenerationInput, chapterCount: number): string {
  const { config, avatars, poolCharacters, primaryProfileAge } = input;
  const languageName = localizedLanguageName(config.language);

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
    "",
    genreCraftGuidance(config.genre),
    settingCraftGuidance(config.setting),
    "",
    avatarBlock,
    poolBlock || null,
    learningLine,
    customLine,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

function buildEmotionAndVoicePromptContext(input: DevModeGenerationInput, chapterCount: number): string {
  return [
    buildDevStoryContext(input, chapterCount),
    "",
    "QUALITY GOAL:",
    "- Don't just resolve an adventure — transform a feeling a child recognizes.",
    "- After reading, the story should stay in mind as a place, a character, and a final image.",
    "- The story needs reading pull: kids should want to know what's around the next corner, in the next chapter, or on the next re-read.",
    "- Build recognizability in: a short refrain, a funny saying, a recurring gesture, or a visible object that gains new meaning each time.",
    "- Each chapter ends on a turn, not an explanation. The last paragraph must trigger anticipation, worry, wonder, or a quiet giggle.",
    "- Every main character must make one small mistake that comes from their character and later leads to a better action.",
    "- The antagonist must not be pure mechanic. They need a wound, a wrong belief, funny-unsettling behavior, and a new place at the end.",
  ].join("\n");
}

function buildLeanRepairPromptContext(input: DevModeGenerationInput, chapterCount: number): string {
  const languageName = localizedLanguageName(input.config.language);
  const heroNames = (input.avatars || []).map((avatar) => avatar.name).filter(Boolean);
  const poolNames = (input.poolCharacters || []).map((character) => character.name).filter(Boolean);
  return [
    `Output language: ${languageName}.`,
    `Age group: ${input.config.ageGroup}. Chapter count: exactly ${chapterCount}.`,
    `Genre: ${input.config.genre}. Setting: ${input.config.setting}.`,
    heroNames.length > 0 ? `Main characters: ${heroNames.join(", ")}.` : "Main characters: preserve the existing story's main characters.",
    poolNames.length > 0 ? `Supporting cast already available: ${poolNames.join(", ")}.` : null,
    "Repair context is intentionally compact to reduce cost. Preserve continuity from the compact story map and the target chapter only.",
    "Voice contract: one careful observer, one lively feeler, helper acts instead of explaining, antagonist stays funny-uncanny and conflicted.",
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
  if (config.length === "short") return "Each chapter approx. 1,200–1,800 characters of target-language prose.";
  if (config.length === "long") return "Each chapter approx. 2,000–2,700 characters of target-language prose.";
  return "Each chapter approx. 1,800–2,400 characters of target-language prose.";
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
      return 'Output-language micro-anchor (German): „Die Stadt klingt wie ein müdes Kissen", murmelte Alexander und hielt das Glöckchen fester. — Use this register: warm, concrete, sensory, light humor; typographic quotation marks „…".';
    case "fr":
      return 'Output-language micro-anchor (French): « La ville sonne comme un coussin fatigué », murmura Alexandre en serrant la clochette. — Use this register: warm, concrete, sensory; French guillemets « ».';
    case "es":
      return 'Output-language micro-anchor (Spanish): «La ciudad suena como un cojín cansado», murmuró Alejandro apretando la campanita. — Use this register: warm, concrete, sensory; angle quotes «».';
    case "it":
      return 'Output-language micro-anchor (Italian): «La città suona come un cuscino stanco», mormorò Alessandro stringendo il campanello. — Use this register: warm, concrete, sensory; angle quotes «».';
    case "nl":
      return 'Output-language micro-anchor (Dutch): „De stad klinkt als een moe kussentje", mompelde Alexander en hield het belletje vaster. — Use this register: warm, concrete, sensory.';
    case "ru":
      return 'Output-language micro-anchor (Russian): «Город звучит как уставшая подушка», прошептал Александр, крепче сжимая колокольчик. — Use this register: warm, concrete, sensory; guillemets «».';
    default:
      return 'Output-language micro-anchor (English): "The town sounds like a tired cushion," Alexander whispered, holding the bell tighter. — Use this register: warm, concrete, sensory, light humor; standard double quotes "".';
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
    "- At least 30 percent dialogue in the final story.",
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

function buildBlueprintPrompts(input: DevModeGenerationInput, chapterCount: number): { systemPrompt: string; userPrompt: string } {
  const languageName = localizedLanguageName(input.config.language);
  const systemPrompt = qualitySystemPrompt(
    languageName,
    [
      "Schema:",
      "{",
      '  "premise": string,',
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
      '  "chapterPlan": [ { "order": number, "title": string, "hook": string, "sceneBeats": string[], "conflict": string, "turn": string, "endingTension": string, "chapterEndHook": string, "kidQuestion": string, "callbackToUse": string } ],',
      '  "forbiddenShortcuts": string[]',
      "}",
    ].join("\n")
  );
  const userPrompt = [
    "CALL 1: Produce a story blueprint with an integrated emotional engine. Do NOT write the actual story prose yet.",
    "This support call must prepare the later story: emotional core, character roles, a clear magic rule, a try-fail-try chain, finale built from earlier-planted details.",
    "Blueprint values may stay in English — only the final story prose (Call 3) must be in the target output language.",
    "",
    buildEmotionAndVoicePromptContext(input, chapterCount),
    "",
    `Plan exactly ${chapterCount} chapters.`,
    "Every chapter needs ownership: one concrete character actively drives it, and at the end something has irreversibly changed.",
    "Plan the read-on pull explicitly: refrain / leitmotif, chapter-end hooks, a callback ladder, small reread details.",
    "Plan the emotional price explicitly: which concrete object, habit, sound, promise, or comfort must a child choose to risk or share in the finale, why it matters, and what choice makes the payoff earned.",
    "Plan the antagonist's change as a ladder, not a switch: wants to possess -> confusion -> small relapse -> active decision -> new role/task.",
    "Plan one recurring humor callback that escalates across chapters and pays off in the finale; it must come from character behavior or a prop, not narrator commentary.",
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
      '  "chapterRisks": [ { "order": number, "risk": string, "fix": string } ],',
      '  "revisedBlueprint": {',
      '    "premise": string,',
      '    "emotionalEngine": object,',
      '    "readerMagnet": object,',
      '    "payoffEngine": object,',
      '    "antagonistChangeLadder": object,',
      '    "humorCallbackPlan": object,',
      '    "coreMagicRule": string,',
      '    "characterArcs": [ { "name": string, "startingFriction": string, "strength": string, "finalContribution": string } ],',
      '    "supportingCastUse": [ { "name": string, "storyFunction": string, "mustDo": string } ],',
      '    "plantsAndPayoffs": [ { "plant": string, "payoff": string } ],',
      '    "sceneOwnership": [ { "order": number, "driver": string, "changedState": string } ],',
      '    "chapterPlan": [ { "order": number, "title": string, "hook": string, "sceneBeats": string[], "conflict": string, "turn": string, "endingTension": string, "chapterEndHook": string, "kidQuestion": string, "callbackToUse": string } ],',
      '    "forbiddenShortcuts": string[]',
      '  }',
      "}",
    ].join("\n")
  );
  const userPrompt = [
    "CALL 2: Critique this blueprint like a strict children's-book dramaturg and editor.",
    "Find everything that would push the final story below 9.5/10 against real children's books: weak tension, missing emotional core, characters without an active role, identical voices, telling not showing, generic motifs, missing sensory detail, unearned turn.",
    "Inspect read-on pull specifically: is there a recognizable motif? Does every chapter end on a real question or decision? Are there enough comic or puzzling details kids want to re-listen to?",
    "A blueprint without clear chapter-end hooks, refrain/callback, or a child-curiosity engine may score at most 8.4.",
    "Then return an improved revisedBlueprint. IMPORTANT: revisedBlueprint MUST be complete, not a reduced summary. Preserve and improve characterArcs, supportingCastUse, plantsAndPayoffs, sceneOwnership, full chapterPlan fields, and readerMagnet.",
    "Also preserve/improve payoffEngine, antagonistChangeLadder, and humorCallbackPlan. If they are weak or missing, create them concretely.",
    "Score harshly. A technically clean blueprint is not automatically market-quality.",
    "Critique values stay in English; only the final story prose (Call 3) is in the target output language.",
    "",
    "CONTEXT:",
    buildEmotionAndVoicePromptContext(input, chapterCount),
    "",
    "BLUEPRINT:",
    JSON.stringify(blueprint, null, 2),
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
  return mergeBlueprintObjects(blueprint || {}, critique?.revisedBlueprint || {});
}

function buildStoryDraftPrompts(
  input: DevModeGenerationInput,
  chapterCount: number,
  blueprint: any,
  critique: any
): { systemPrompt: string; userPrompt: string } {
  const languageName = localizedLanguageName(input.config.language);
  const bounds = getChapterLengthBounds(input.config);
  const draftTargetMaxChars = Math.max(bounds.min, bounds.max - 150);
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
  const heroNames = (input.avatars || []).map((a) => a.name).filter(Boolean);
  const heroA = heroNames[0] || "Main character A";
  const heroB = heroNames[1] || "Main character B";
  const userPrompt = [
    `CALL 3: Now write the final story as real scenes, not a summary. Output the title, description, and chapter content in ${languageName}.`,
    "This is the ONLY call allowed to write the actual story prose. Use the COMPLETE reviewedBlueprint, the critique, and the voice rules directly in the first draft.",
    "Do not reduce the blueprint to hooks. You MUST actively use emotionalEngine, payoffEngine, antagonistChangeLadder, humorCallbackPlan, characterArcs, supportingCastUse, plantsAndPayoffs, sceneOwnership, readerMagnet, coreMagicRule, and every chapterPlan field.",
    "",
    "SELF-REFLECTION BEFORE WRITING (MANDATORY):",
    "Before you write the story, answer the following three questions for yourself, in detail and concretely.",
    "Do NOT include the answers in your output. Only start writing the story AFTER you have answered each question concretely.",
    "If you cannot answer a question concretely, your answer is too generic — revise it before you start writing.",
    "(You may answer the reflection in English to think faster; this does NOT affect output language — the story itself must be in the target language.)",
    "",
    `Question 1 (Character differentiation): What specifically distinguishes ${heroA} and ${heroB} in EVERY scene?`,
    `   a) Which physical mini-gesture does ${heroA} have that recurs at least 3 times in the story? Which one does ${heroB} have?`,
    "   b) In what concrete sentence-length / rhythm pattern do the two speak differently? Give one typical dialogue example for each.",
    "   c) How do they react DIFFERENTLY to the SAME stimulus (e.g. a danger)? If I strip the dialogue tags, a reader must be able to guess who said what.",
    "",
    "Question 2 (Setups & payoffs): How do I plant prepared resolutions instead of deus-ex-machina solutions?",
    "   a) Name three concrete small details, objects, or habits that appear casually in chapters 1–2.",
    "   b) Where exactly in chapters 4–5 does each of those three details pay off? The resolution of the main crisis MUST draw from at least one of these setups.",
    "   c) If the antagonist's defeat were NOT tied to one of these setups — what would I change?",
    "",
    "Question 3 (Humor — MANDATORY, not optional): Where is the humor in this story?",
    "   a) Give me at least one concrete humorous moment per chapter. What exactly is funny — a gesture, a wordplay, an absurd comparison, a misunderstanding?",
    "   b) The humor must come from the characters, not from the narrator. Which character quirk triggers humor?",
    "   c) Age-appropriate humor: would a 6-year-old actually giggle when read aloud? If not, the humor is too adult or too abstract — revise.",
    "",
    "This self-reflection is NOT a formality. If the answers stay thin, the story will be interchangeable.",
    "",
    buildEmotionAndVoicePromptContext(input, chapterCount),
    "",
    "DIALOGUE-FIRST SCENE PLANNING (MANDATORY, SILENT):",
    "Before writing each chapter, silently plan the chapter's goal, conflict, wrong move/turn, and at least 3 concrete speaker exchanges. Do not output this plan; use it so dialogue drives the scene instead of decorating narration.",
    "Every chapter needs at least one line where a character decides, refuses, misunderstands, jokes, or changes direction.",
    "",
    "DRAMATURGY RULES:",
    `- Exactly ${chapterCount} chapters.`,
    `- ${chapterLengthGuidance(input.config)}`,
    `- Aim each chapter for ${bounds.min}-${draftTargetMaxChars} characters. Do not write to the upper edge; the repair gate fails over ${bounds.max}.`,
    "- Prefer 8 compact paragraphs over 10 long paragraphs. One paragraph should rarely exceed 350 characters in medium mode.",
    `- ${DEV_MODE_MIN_PARAGRAPHS}–${DEV_MODE_MAX_PARAGRAPHS} paragraphs per chapter. Output them as a paragraphs[] array. This is a hard gate, not a suggestion.`,
    `- Overall dialogue share at least ${DEV_MODE_MIN_DIALOG_PCT}%, target ${DEV_MODE_TARGET_DIALOG_PCT}%. Each chapter at least ${DEV_MODE_MIN_CHAPTER_DIALOG_PCT}% dialogue.`,
    `- Every chapter should include at least ${DEV_MODE_CHAPTER_DIALOG_LINE_TARGET} dialogue lines and at least ${DEV_MODE_CHAPTER_SPEAKER_TURN_TARGET} speaker turns unless the chapter is intentionally very short (${input.config.length === "short" ? "short mode" : "not short mode"}).`,
    "- Chapter 1: strong hook in the first 2 sentences, concrete problem, different reactions from the main characters, open ending.",
    "- Chapter 2: world becomes concrete, trail/encounter, side or antagonist character shows a quirk, problem grows.",
    "- Chapter 3: a wrong attempt or wrong choice coming from character, real consequence, no lucky accident saves them.",
    "- Chapter 4: understand the deeper rule, combine different strengths, an emotional moment, prepare the finale.",
    "- Chapter 5: concrete action, prepared solution, emotional aftertaste, strong closing image, no explained moral.",
    "- Do not duplicate the finale across chapters 4 and 5: chapter 4 reaches the crisis/realization; chapter 5 performs the final choice and payoff once.",
    "- A side/helper character may reveal a clue, but the children must perform the decisive action themselves.",
    "- Every main character must make at least one mini-decision that wouldn't happen without them.",
    "- The antagonist must show a recognizable behavior across at least three chapters and gain a new place at the end.",
    "- HUMOR (MANDATORY): EVERY chapter needs at least one humorous moment coming from character or situation — no narrator jokes. Good kinds: absurd comparisons, small mishaps, a dry remark from a side character, a wordplay, a loving teasing moment between the main characters. No 'explained joke', no adult irony.",
    "",
    "READ-ON / PULL RULES:",
    "- Chapter 1 must show a concrete, memorable problem in the first 2 sentences.",
    "- Every chapter ends on a pull: open question, looming consequence, new rule, unexpected gesture, or a funny moment that lingers.",
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
    "REVIEWED BLUEPRINT INCLUDING EMOTIONAL ENGINE:",
    JSON.stringify(revisedBlueprint, null, 2),
    "",
    "CRITIQUE YOU MUST RESOLVE:",
    JSON.stringify(
      {
        score: critique?.score,
        mustFix: critique?.mustFix || [],
        readOnRisks: critique?.readOnRisks || [],
        addictiveReadingFixes: critique?.addictiveReadingFixes || [],
        chapterRisks: critique?.chapterRisks || [],
      },
      null,
      2
    ),
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
          hook: compactExcerpt(plan?.hook || "", 180),
          sceneBeats: Array.isArray(plan?.sceneBeats)
            ? plan.sceneBeats.slice(0, 5).map((beat: any) => compactExcerpt(beat, 140))
            : [],
          conflict: compactExcerpt(plan?.conflict || "", 180),
          turn: compactExcerpt(plan?.turn || "", 180),
          chapterEndHook: compactExcerpt(plan?.chapterEndHook || plan?.endingTension || "", 180),
          callbackToUse: compactExcerpt(plan?.callbackToUse || "", 140),
        }))
    : [];

  return {
    premise: compactExcerpt(reviewedBlueprint?.premise || "", 320),
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
  const targetMaxChars = Math.max(bounds.min, bounds.max - 250);
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
    "",
    buildDevStoryContext(input, chapterCount),
    "",
    "HARD OUTPUT SHAPE:",
    `- Each chapter: ${bounds.min}-${targetMaxChars} characters of prose; do not exceed ${bounds.max}.`,
    `- ${DEV_MODE_MIN_PARAGRAPHS}-${DEV_MODE_MAX_PARAGRAPHS} paragraphs per chapter; aim for 8 compact paragraphs.`,
    `- Overall dialogue at least ${DEV_MODE_MIN_DIALOG_PCT}%, target ${DEV_MODE_TARGET_DIALOG_PCT}%. Each chapter at least ${DEV_MODE_MIN_CHAPTER_DIALOG_PCT}%.`,
    `- Use at least ${DEV_MODE_CHAPTER_SPEAKER_TURN_TARGET} speaker turns per chapter when natural.`,
    "- Keep sentences child-readable for ages 6-8: concrete, warm, funny, sensory.",
    "- Every chapter must have a goal, obstacle, turn, and pull at the end.",
    "- Every chapter needs at least one child-giggle moment from action, misunderstanding, prop, or character voice.",
    "- Finale must use planted details; no moral-summary ending like 'Sie lernten...'.",
    "",
    "COMPACT REVIEWED BLUEPRINT TO FOLLOW:",
    JSON.stringify(compactBlueprint, null, 2),
    "",
    "CRITIQUE POINTS TO RESOLVE:",
    JSON.stringify(
      {
        mustFix: critique?.mustFix || [],
        readOnRisks: critique?.readOnRisks || [],
        addictiveReadingFixes: critique?.addictiveReadingFixes || [],
        chapterRisks: critique?.chapterRisks || [],
      },
      null,
      2
    ),
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
  const systemPrompt = qualitySystemPrompt(
    languageName,
    [
      "Final story schema:",
      "{",
      '  "title": string,',
      '  "description": string,',
      '  "chapters": [',
      '    { "order": number, "title": string, "content": string }',
      "  ]",
      "}",
    ].join("\n")
  );
  const reviewedBlueprint = getReviewedBlueprint(blueprint, critique);

  const userPrompt = [
    `CALL 3B: STRICT GATE REPAIR + CHILDREN'S BOOK POLISH. The repaired prose must stay in ${languageName}.`,
    "You repair an existing children's story. Do not invent a different plot, but you MUST satisfy all hard gates below.",
    "If local diagnostics and your literary preference conflict, local diagnostics win. This is a mechanical repair pass first, a style polish second.",
    "",
    buildEmotionAndVoicePromptContext(input, chapterCount),
    "",
    "HARD GATES:",
    `- Exactly ${chapterCount} chapters.`,
    `- Each chapter must stay within ${getChapterLengthBounds(input.config).min}-${getChapterLengthBounds(input.config).max} characters of target-language prose.`,
    `- Each chapter must have ${DEV_MODE_MIN_PARAGRAPHS}-${DEV_MODE_MAX_PARAGRAPHS} paragraphs. If there are too many paragraphs, merge them.`,
    `- Overall dialogue share must be at least ${DEV_MODE_MIN_DIALOG_PCT}%, target ${DEV_MODE_TARGET_DIALOG_PCT}%.`,
    `- Every chapter must have at least ${DEV_MODE_MIN_CHAPTER_DIALOG_PCT}% dialogue.`,
    "- No new main figures, no new subplot, no explained moral, no summary sentence at chapter endings.",
    "- JSON must be valid and match the schema exactly.",
    "",
    "REPAIR METHOD:",
    "- If a chapter is too long: cut explanatory narration first, not the core scene.",
    "- If a chapter has too many paragraphs: combine adjacent beats into fewer paragraphs.",
    "- If dialogue is low: convert explanation into short character-specific dialogue that carries action, relationship, humor, or tension.",
    "- Do NOT add filler chatter. Every dialogue line must change action, relationship, tension, or comic timing.",
    "- Keep the same title idea, central conflict, recurring motif, and closing image.",
    "- Strengthen chapter endings with concrete danger, decision, question, new rule, or funny aftershock.",
    "",
    "DIALOGUE VOICE CONTRACT:",
    "- Main careful observer: short, concrete, braking lines; points at details; rarely speaks in long explanations.",
    "- Main lively feeler: quicker, warmer, more physical; asks questions; uses small funny comparisons.",
    "- Trickster/helper: fast, frech, tool/prop humor; helps through action, never by simply explaining the solution.",
    "- Antagonist: slow, whispering, uncanny/funny; keeps wavering between wanting to possess and learning to listen.",
    "",
    "PAYOFF CONTRACT:",
    "- Preserve prepared payoffs from the blueprint. The finale must come from planted details, not a new solution.",
    "- If a personal object is used in the solution, make the character choose to give it up consciously, not by accident.",
    "- The antagonist gets a new way to exist or a task, not instant friendship as a moral shortcut.",
    "",
    "LOCAL DIAGNOSTICS:",
    JSON.stringify(diagnostics, null, 2),
    "",
    "COMPLETE REVIEWED BLUEPRINT TO PRESERVE:",
    JSON.stringify(reviewedBlueprint, null, 2),
    "",
    "CRITIQUE FROM DRAMATURGY CHECK:",
    JSON.stringify(
      {
        score: critique?.score,
        mustFix: critique?.mustFix || [],
        readOnRisks: critique?.readOnRisks || [],
        addictiveReadingFixes: critique?.addictiveReadingFixes || [],
        chapterRisks: critique?.chapterRisks || [],
        validatorFindings: critique?.validatorFindings || null,
      },
      null,
      2
    ),
    "",
    "CURRENT STORY TO POLISH:",
    JSON.stringify(story, null, 2),
    "",
    `FINAL REMINDER: title, description and ALL chapter content must remain in ${languageName}.`,
  ].join("\n");
  return { systemPrompt, userPrompt };
}

function selectChapterDiagnosticsForRepair(
  diagnostics: DevModeStoryDiagnostics,
  story: DevModeRawStory,
  config: StoryConfig
): DevModeChapterDiagnostic[] {
  const bounds = getChapterLengthBounds(config);
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
    if (chapter.paragraphs < DEV_MODE_MIN_PARAGRAPHS || chapter.paragraphs > DEV_MODE_MAX_PARAGRAPHS) return true;
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

function replaceStoryChapter(story: DevModeRawStory, repairedChapter: DevModeChapter): DevModeRawStory {
  const chapters = story.chapters
    .map((chapter) => (Number(chapter.order) === Number(repairedChapter.order) ? repairedChapter : chapter))
    .sort((a, b) => a.order - b.order);
  return {
    ...story,
    chapters,
  };
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
    coreMagicRule: compactExcerpt(reviewedBlueprint?.coreMagicRule || "", 260),
    readerMagnet: reviewedBlueprint?.readerMagnet
      ? {
          refrainLine: reviewedBlueprint.readerMagnet.refrainLine,
          iconicMotif: reviewedBlueprint.readerMagnet.iconicMotif,
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
  const rawChapter = parsed?.repairedChapter || parsed?.chapter || parsed?.chapters?.[0] || parsed;
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
  const chapterTargetDialogPct = storyDiagnostics.dialogPct < DEV_MODE_TARGET_DIALOG_PCT
    ? DEV_MODE_TARGET_DIALOG_PCT
    : DEV_MODE_MIN_CHAPTER_DIALOG_PCT;
  const targetMaxChars = Math.max(bounds.min, bounds.max - 150);
  const targetParagraphMaxChars = input.config.length === "short" ? 280 : input.config.length === "long" ? 420 : 360;
  const dialogueLineTarget = input.config.length === "short"
    ? Math.max(5, DEV_MODE_CHAPTER_DIALOG_LINE_TARGET - 2)
    : DEV_MODE_CHAPTER_DIALOG_LINE_TARGET;
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
    JSON.stringify(storyDiagnostics, null, 2),
    "",
    "TARGET CHAPTER DIAGNOSTICS:",
    JSON.stringify(chapterDiagnostics, null, 2),
    "",
    "TARGET GATES FOR THE REPAIRED CHAPTER:",
    `- Keep order exactly ${chapter.order}.`,
    `- Keep title unless a tiny grammar fix is needed: ${chapter.title}.`,
    `- HARD LENGTH: ${bounds.min}-${bounds.max} characters of target-language prose. Aim for ${bounds.min}-${targetMaxChars}; if unsure, write shorter, not longer.`,
    `- No paragraph should exceed about ${targetParagraphMaxChars} characters. Long paragraphs are the main reason previous repair failed.`,
    `- ${DEV_MODE_MIN_PARAGRAPHS}-${DEV_MODE_MAX_PARAGRAPHS} paragraphs, output as repairedChapter.paragraphs[]. Aim for 8-10 paragraphs.`,
    `- At least ${chapterTargetDialogPct}% dialogue in this chapter; never below ${DEV_MODE_MIN_CHAPTER_DIALOG_PCT}%.`,
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
    "- Main careful observer: short, concrete, braking lines; points at details; rarely explains.",
    "- Main lively feeler: quicker, warmer, physical; asks questions; uses small funny comparisons.",
    "- Trickster/helper: fast, frech, prop humor; acts, never simply explains the solution.",
    "- Antagonist: slow, whispering, uncanny/funny; wavers between possessing and listening.",
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
    "",
    "RELEVANT BLUEPRINT FOR THIS CHAPTER:",
    JSON.stringify(buildChapterRepairBlueprintContext(reviewedBlueprint, chapter.order), null, 2),
    "",
    "CRITIQUE TO RESPECT:",
    JSON.stringify(
      {
        mustFix: critique?.mustFix || [],
        readOnRisks: critique?.readOnRisks || [],
        addictiveReadingFixes: critique?.addictiveReadingFixes || [],
        chapterRisks: (critique?.chapterRisks || []).filter((risk: any) => Number(risk?.order) === Number(chapter.order)),
      },
      null,
      2
    ),
    "",
    "COMPACT CURRENT STORY CONTEXT (do not rewrite other chapters; use only for continuity):",
    JSON.stringify(buildCompactRepairStoryContext(story, chapter.order), null, 2),
    "",
    "CURRENT TARGET CHAPTER TO REPAIR:",
    JSON.stringify(chapter, null, 2),
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
    "- 9.0–9.4 if clearly better than the elevated standard anchor (7.5), but rhyme/beat missing OR humor weak.",
    "- 8.5–8.9 if clearly above anchor 7.5, but at least one weakness (e.g. character voices present but not iconic; humor present but quiet; setup/payoff present but not surprising).",
    "- 7.0–8.4 if at or slightly above anchor 7.5 (standard children's book).",
    "- 5.0–6.9 if at anchor-6 level (forbidden phrases, generic).",
    "- < 5.0 if at anchor-4 level or worse.",
    "",
    "MANDATORY CAPS (whichever is lower wins):",
    "- Antagonist is only mechanic (no wound / no new place at the end): max 8.4.",
    "- Main characters not iconically distinguishable (dialogue interchangeable): max 8.7.",
    "- Ending explains moral instead of showing ('they learned...' / 'Sie lernten...'): max 7.5.",
    "- Chapter endings without read-on pull: max 8.6.",
    "- Dialogue quota / form gates failed per local diagnostics: max 8.7.",
    "- NO humor in the 'kid giggles' sense in at least 4 of 5 chapters: max 8.2.",
    "- No setup-payoff (resolution doesn't come from prepared details): max 8.0.",
    "- More than 2 forbidden phrases in any language ('they learned...', 'true magic in the heart...', 'with courage and togetherness...'): max 6.5.",
    "",
    "Check: exactly correct chapter count, valid JSON, no [object Object], clear character roles, no explained moral, prepared solution, no spoiled / cheap antagonist defeat, age-appropriate language, dialogue with typographic quotation marks.",
    "Also check: would a child want to hear the next chapter? Is there a recurring motif? Is there callback/payoff? Are there reread rewards and characters one wants to meet again?",
    "Be honest. A truthful 7.8 beats a flattering 9.2. Self-inflating the score would be a pipeline error.",
    "",
    "VALIDATION TARGET:",
    contextSummary,
    "",
    "LOCAL DIAGNOSTICS OF THE FINAL STORY:",
    JSON.stringify(diagnostics || null, null, 2),
    "",
    "STORY:",
    JSON.stringify(story, null, 2),
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
      "ANCHOR 10.0 — Julia Donaldson 'Der Grüffelo' (German):",
      '  „Eine Maus ging durch den dunklen Wald, / Da kam ein Fuchs, der sah sie bald. / \'Komm doch mit mir, kleine Maus, / komm zum Mittagessen mit zu mir nach Haus!\'"',
      "  Why 10: rhyme/beat make it memorizable; no wasted word; the mouse's mini-gesture (list-telling) carries the entire plot; punchline is set up.",
      "",
      "ANCHOR 9.0 — Sven Nordqvist 'Pettersson und Findus' (German):",
      '  Findus hängt kopfüber im Apfelbaum: „Wenn man so hängt, ist der Himmel unten und die Äpfel oben. Das ist sehr praktisch." Pettersson murmelt: „Sehr praktisch, ja." und schenkt sich noch Kaffee ein.',
      "  Why 9: two clearly separated voices (Findus naive-philosophical, Pettersson dry); concrete situational comedy; no explained joke; subtext (Pettersson loves Findus without saying so).",
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
      "ANCHOR 10.0 — Julia Donaldson 'The Gruffalo' (English):",
      '  "A mouse took a stroll through the deep dark wood. / A fox saw the mouse and the mouse looked good. / \'Where are you going to, little brown mouse? / Come and have lunch in my underground house.\'"',
      "  Why 10: rhyme/beat make it memorizable; no wasted word; the mouse's mini-gesture (list-telling) carries the entire plot; punchline is set up.",
      "",
      "ANCHOR 9.0 — Sven Nordqvist 'Findus and Pettson' (English):",
      '  Findus hangs upside down in the apple tree: "When you hang like this, the sky is below and the apples are above. That is very practical." Pettson mumbles: "Very practical, yes," and pours himself more coffee.',
      "  Why 9: two clearly separated voices; concrete situational comedy; no explained joke; subtext.",
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
  issues: string[];
}

interface DevModeStoryDiagnostics {
  needsPolish: boolean;
  hardIssueCount: number;
  softIssueCount: number;
  totalChars: number;
  dialogPct: number;
  chapterDiagnostics: DevModeChapterDiagnostic[];
  hardIssues: string[];
  softIssues: string[];
  polishInstructions: string[];
}

function getChapterLengthBounds(config: StoryConfig): { min: number; max: number } {
  if (config.length === "short") return { min: 1200, max: 1800 };
  if (config.length === "long") return { min: 2000, max: 2700 };
  return { min: 1800, max: 2400 };
}

function countDialogChars(text: string): number {
  return Array.from(text.matchAll(/„[^“]+“|«[^»]+»|"[^"]+"/g)).reduce((sum, match) => sum + match[0].length, 0);
}

function countParagraphs(text: string): number {
  return splitParagraphs(text).length;
}

function hasForwardPull(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/[?!…]$/.test(trimmed)) return true;
  return /\b(plötzlich|doch|aber|hinter|unter|wartete|hörte|klang|leuchtete|bewegte|flüsterte|flusterte|morgen|nächste|naechste|noch|geheim|warum|wer|was)\b/i.test(trimmed);
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

function analyzeDevModeStoryQuality(
  story: DevModeRawStory,
  input: DevModeGenerationInput,
  chapterCount: number
): DevModeStoryDiagnostics {
  const hardIssues: string[] = [];
  const softIssues: string[] = [];
  const polishInstructions: string[] = [];
  const bounds = getChapterLengthBounds(input.config);
  const languageCode = languageCodeFromName(localizedLanguageName(input.config.language));
  const chapterDiagnostics: DevModeChapterDiagnostic[] = [];
  const allContent = story.chapters.map((chapter) => `${chapter.title}\n${chapter.content}`).join("\n\n");
  const totalChars = story.chapters.reduce((sum, chapter) => sum + chapter.content.length, 0);
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
    hardIssues.push(`Dialoganteil ist mit ${dialogPct}% zu niedrig; Minimum ${DEV_MODE_MIN_DIALOG_PCT}%, Ziel ${DEV_MODE_TARGET_DIALOG_PCT}%.`);
  } else if (dialogPct < DEV_MODE_TARGET_DIALOG_PCT) {
    softIssues.push(`Dialoganteil ist mit ${dialogPct}% knapp unter Zielwert ${DEV_MODE_TARGET_DIALOG_PCT}%.`);
  }

  story.chapters.forEach((chapter, index) => {
    const issues: string[] = [];
    const chars = chapter.content.length;
    const paragraphs = countParagraphs(chapter.content);
    const chapterDialogPct = chars > 0 ? Math.round((countDialogChars(chapter.content) / chars) * 1000) / 10 : 0;
    const chapterPrefix = `Kapitel ${chapter.order || index + 1}`;

    if (chars < bounds.min) {
      issues.push(`zu kurz (${chars} Zeichen)`);
      hardIssues.push(`${chapterPrefix} ist deutlich zu kurz (${chars}; Ziel ${bounds.min}-${bounds.max}).`);
    } else if (chars > bounds.max) {
      issues.push(`deutlich zu lang (${chars} Zeichen)`);
      hardIssues.push(`${chapterPrefix} ist deutlich zu lang (${chars}; Ziel ${bounds.min}-${bounds.max}).`);
    }

    if (paragraphs < DEV_MODE_MIN_PARAGRAPHS) {
      issues.push(`zu wenige Absaetze (${paragraphs})`);
      hardIssues.push(`${chapterPrefix} hat zu wenige Absaetze (${paragraphs}; Ziel ${DEV_MODE_MIN_PARAGRAPHS}-${DEV_MODE_MAX_PARAGRAPHS}).`);
    } else if (paragraphs > DEV_MODE_MAX_PARAGRAPHS) {
      issues.push(`zu viele Absaetze (${paragraphs})`);
      hardIssues.push(`${chapterPrefix} hat zu viele Absaetze (${paragraphs}; Ziel ${DEV_MODE_MIN_PARAGRAPHS}-${DEV_MODE_MAX_PARAGRAPHS}).`);
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

    chapterDiagnostics.push({
      order: chapter.order || index + 1,
      title: chapter.title,
      chars,
      paragraphs,
      dialogPct: chapterDialogPct,
      issues,
    });
  });

  if (hardIssues.some((issue) => /Dialoganteil|ASCII|Namensfehler|\[object Object\]|deutlich zu lang|zu wenige Absaetze|zu viele Absaetze/i.test(issue))) {
    polishInstructions.push("Behebe alle harten Form- und Oberflaechenfehler vollstaendig.");
  }
  if (dialogPct < 30) {
    polishInstructions.push("Erhoehe den Dialoganteil auf mindestens 30%, indem Erklaerungen in charakterstarke Dialoge mit Handlung/Subtext umgebaut werden. Nicht durch Fuellsaetze aufblaehen.");
  }
  if (hardIssues.concat(softIssues).some((issue) => /Laenge|lang|kurz|Absaetze/i.test(issue))) {
    polishInstructions.push(`Bringe Kapitel naeher an ${bounds.min}-${bounds.max} Zeichen und 6-12 Absaetze, ohne die Szenenhaftigkeit zu verlieren.`);
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

function calculateLocalGateScore(diagnostics?: DevModeStoryDiagnostics): number | undefined {
  if (!diagnostics) return undefined;

  let score = 9.5;
  if (diagnostics.dialogPct < DEV_MODE_TARGET_DIALOG_PCT) score -= 0.3;
  if (diagnostics.dialogPct < DEV_MODE_MIN_DIALOG_PCT) score -= 0.4;
  if (diagnostics.dialogPct < 18) score -= 0.5;

  for (const chapter of diagnostics.chapterDiagnostics) {
    if (chapter.dialogPct < DEV_MODE_MIN_CHAPTER_DIALOG_PCT) score -= 0.2;
    if (chapter.paragraphs < DEV_MODE_MIN_PARAGRAPHS || chapter.paragraphs > DEV_MODE_MAX_PARAGRAPHS) score -= 0.2;
    if (chapter.issues.some((issue) => /kurz|lang|Laenge|Länge/i.test(issue))) score -= 0.15;
  }

  if (diagnostics.hardIssueCount > 0) score = Math.min(score, 8.6);
  if (diagnostics.hardIssueCount >= 4) score = Math.min(score, 8.2);
  if (diagnostics.hardIssues.some((issue) => /Verbotenes|Moral|ASCII|Namensfehler|\[object Object\]/i.test(issue))) {
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
    if (diagnostics.chapterDiagnostics.some((chapter) => chapter.paragraphs < DEV_MODE_MIN_PARAGRAPHS || chapter.paragraphs > DEV_MODE_MAX_PARAGRAPHS)) {
      score = Math.min(score, 8.6);
    }
    if (diagnostics.chapterDiagnostics.some((chapter) => chapter.dialogPct < DEV_MODE_MIN_CHAPTER_DIALOG_PCT)) {
      score = Math.min(score, 8.5);
    }
    if (diagnostics.hardIssues.some((issue) => /deutlich zu lang|deutlich zu kurz/i.test(issue))) {
      score = Math.min(score, 8.7);
    }
    if (diagnostics.hardIssues.some((issue) => /Verbotenes|Moral|ASCII|Namensfehler|\[object Object\]/i.test(issue))) {
      score = Math.min(score, 7.8);
    }
  }

  if (typeof localGateScore === "number") {
    score = Math.min(score, localGateScore);
  }

  return Math.max(0, Math.round(score * 10) / 10);
}

function diagnosticsSeverityScore(diagnostics: DevModeStoryDiagnostics, expectedChapterCount: number): number {
  const chapterCountPenalty = Math.abs(diagnostics.chapterDiagnostics.length - expectedChapterCount) * 1000;
  const dialogPenalty = Math.max(0, DEV_MODE_MIN_DIALOG_PCT - diagnostics.dialogPct) * 8;
  return chapterCountPenalty
    + diagnostics.hardIssueCount * 100
    + diagnostics.softIssueCount * 10
    + dialogPenalty;
}

function isDiagnosticsBetter(
  candidate: DevModeStoryDiagnostics,
  currentBest: DevModeStoryDiagnostics | undefined,
  expectedChapterCount: number
): boolean {
  if (!currentBest) return true;
  return diagnosticsSeverityScore(candidate, expectedChapterCount) < diagnosticsSeverityScore(currentBest, expectedChapterCount);
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
  return isOpenRouterCompactDraftModel(resolveSelectedOpenRouterStoryModel(config));
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
  if (config.length === "long") return retry ? 24000 : compactMode ? 20000 : 18000;
  if (config.length === "short") return retry ? 12000 : compactMode ? 9500 : 9000;
  return retry ? 18000 : compactMode ? 14000 : 11000;
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
  });

  let finalParsed: DevModeRawStory | null = null;
  let finalModelUsed: string = input.config.aiModel || DEFAULT_GEMINI_MODEL;
  let finalQualityScore: number | undefined;
  let rawQualityScore: number | undefined;
  let localGateScore: number | undefined;
  let finalDiagnostics: DevModeStoryDiagnostics | undefined;
  let polishApplied = false;
  let qualityGateFailureReason: string | undefined;
  const repairSelfReflections: any[] = [];

  try {
    const blueprintPrompts = buildBlueprintPrompts(input, chapterCount);
    const blueprintStage = await runStage("blueprint", blueprintPrompts, {
      maxTokens: 4200,
      temperature: 0.45,
      timeoutMs: 120_000,
      ...supportCallOptions,
      modelRole: "support",
    });
    const blueprint = blueprintStage.parsed || {
      rawBlueprint: blueprintStage.provider.content,
      parseWarning: blueprintStage.parseError,
    };

    const critiquePrompts = buildCritiquePrompts(input, chapterCount, blueprint);
    const critiqueStage = await runStage("dramaturgy-check", critiquePrompts, {
      maxTokens: 3600,
      temperature: 0.35,
      timeoutMs: 120_000,
      ...supportCallOptions,
      modelRole: "support",
    });
    const critique = critiqueStage.parsed || {
      rawCritique: critiqueStage.provider.content,
      parseWarning: critiqueStage.parseError,
    };

    const selectedOpenRouterStoryModel = resolveSelectedOpenRouterStoryModel(input.config);
    const compactDraftMode = shouldUseCompactOpenRouterDraft(input.config);
    const storyPrompts = compactDraftMode
      ? buildCompactStoryDraftPrompts(input, chapterCount, blueprint, critique)
      : buildStoryDraftPrompts(input, chapterCount, blueprint, critique);
    let storyStage: Awaited<ReturnType<typeof runStage>>;
    let parsedStoryDraft: DevModeRawStory;
    try {
      storyStage = await runStage("story-draft", storyPrompts, {
        maxTokens: devModeStoryDraftMaxTokens(input.config, compactDraftMode, false),
        temperature: compactDraftMode ? 0.64 : 0.82,
        timeoutMs: devModeStoryDraftTimeoutMs(input.config, false),
        modelRole: "selected-story",
      });
      parsedStoryDraft = parseAndValidate(storyStage.provider.content, chapterCount);
    } catch (storyDraftError) {
      if (!isRecoverableStoryDraftFailure(storyDraftError)) {
        throw storyDraftError;
      }

      const reason = storyDraftError instanceof Error ? storyDraftError.message : String(storyDraftError);
      console.warn("[dev-mode-generation] Story draft failed on selected story model; retrying with compact compatibility prompt", {
        model: selectedOpenRouterStoryModel,
        compactDraftMode,
        error: reason,
      });
      const retryPrompts = buildCompactStoryDraftPrompts(input, chapterCount, blueprint, critique, reason);
      try {
        storyStage = await runStage("story-draft", retryPrompts, {
          maxTokens: devModeStoryDraftMaxTokens(input.config, true, true),
          temperature: 0.52,
          timeoutMs: devModeStoryDraftTimeoutMs(input.config, true),
          modelRole: "selected-story",
        });
        parsedStoryDraft = parseAndValidate(storyStage.provider.content, chapterCount);
      } catch (retryError) {
        throw new Error(
          `Selected story model could not produce a usable story draft after compact retry (${selectedOpenRouterStoryModel}): ${retryError instanceof Error ? retryError.message : String(retryError)}`
        );
      }
    }
    finalParsed = parsedStoryDraft;
    finalModelUsed = storyStage.provider.modelUsed;
    finalDiagnostics = analyzeDevModeStoryQuality(finalParsed, input, chapterCount);

    let bestParsed = finalParsed;
    let bestModelUsed = finalModelUsed;
    let bestDiagnostics = finalDiagnostics;

    let repairAttempt = 0;
    while (finalDiagnostics?.needsPolish && repairAttempt < DEV_MODE_MAX_REPAIR_ATTEMPTS) {
      polishApplied = true;
      repairAttempt += 1;
      let chaptersToRepair = selectChapterDiagnosticsForRepair(finalDiagnostics, finalParsed, input.config);
      if (repairAttempt > 1 && chaptersToRepair.length > DEV_MODE_SECOND_PASS_REPAIR_CHAPTER_LIMIT) {
        chaptersToRepair = chaptersToRepair.slice(0, DEV_MODE_SECOND_PASS_REPAIR_CHAPTER_LIMIT);
      }
      if (chaptersToRepair.length === 0) break;

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
          chapterRepairStage = await runStage("chapter-repair", chapterRepairPrompts, {
            maxTokens: input.config.length === "long" ? 5200 : 3400,
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
      const improved = isDiagnosticsBetter(repairedDiagnostics, bestDiagnostics, chapterCount);
      if (isDiagnosticsBetter(repairedDiagnostics, bestDiagnostics, chapterCount)) {
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

      // One successful local repair is enough for soft issues; keep looping
      // only while hard gates still fail.
      if (finalDiagnostics.hardIssueCount === 0) break;
      if (!improved) break;
    }

    if (finalDiagnostics?.hardIssueCount && finalDiagnostics.hardIssueCount > 0) {
      qualityGateFailureReason = formatQualityGateFailureReason(finalDiagnostics);
      console.warn("[dev-mode-generation] Returning selected-model story with capped quality score after local gate warnings", {
        hardIssueCount: finalDiagnostics.hardIssueCount,
        softIssueCount: finalDiagnostics.softIssueCount,
        dialogPct: finalDiagnostics.dialogPct,
        qualityGateFailureReason,
      });
    }

    if (!polishApplied) {
      console.log("[dev-mode-generation] Skipping chapter repair — draft passed local gates", {
        hardIssueCount: finalDiagnostics?.hardIssueCount,
        softIssueCount: finalDiagnostics?.softIssueCount,
        dialogPct: finalDiagnostics?.dialogPct,
      });
    }

    const validationPrompts = buildValidationPrompts(input, chapterCount, finalParsed, finalDiagnostics);
    try {
      const validationStage = await runStage("final-validation", validationPrompts, {
        maxTokens: 2200,
        temperature: 0.1,
        timeoutMs: 120_000,
        ...supportCallOptions,
        modelRole: "support",
      });
      rawQualityScore = extractQualityScore(validationStage.parsed) ?? undefined;
    } catch (validationError) {
      console.warn("[dev-mode-generation] Final validation failed; using deterministic local gate score", {
        error: validationError instanceof Error ? validationError.message : String(validationError),
        hardIssueCount: finalDiagnostics?.hardIssueCount,
        dialogPct: finalDiagnostics?.dialogPct,
      });
      rawQualityScore = undefined;
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
      storyPolishApplied: polishApplied,
      chapterRepairApplied: polishApplied,
      repairSelfReflections,
      rawQualityScore,
      localGateScore,
      finalQualityScore,
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
      storyPolishApplied: polishApplied,
      chapterRepairApplied: polishApplied,
      localQualityDiagnostics: finalDiagnostics,
      repairSelfReflections,
      rawQualityScore,
      localGateScore,
      qualityGatePassed: (finalDiagnostics?.hardIssueCount ?? 0) === 0,
      qualityGateFailureReason,
      returnedWithQualityGateWarnings: Boolean(qualityGateFailureReason),
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
// less-recently-used, return 2–4 candidates.

interface CharacterPoolRow {
  id: string;
  name: string;
  role: string | null;
  archetype: string | null;
  emotional_nature: any;
  visual_profile: any;
  age_category: string | null;
  species_category: string | null;
  personality_keywords: string[] | null;
  physical_description: string | null;
  backstory: string | null;
  catchphrase: string | null;
  speech_style: string[] | null;
  quirk: string | null;
  canon_settings: string[] | null;
  recent_usage_count: number | null;
  total_usage_count: number | null;
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

/**
 * Pick supporting characters for dev mode. Caller passes the wizard's
 * setting/genre/age and the set of hero avatar names to exclude.
 *
 * Selection strategy:
 *  1. Load all active pool characters.
 *  2. Score each by setting match (canon_settings overlap) + freshness
 *     (lower recent_usage_count is better) + diversity (try not to pick
 *     duplicate archetypes).
 *  3. Return top N, where N = 4 for ages ≤ 8, 6 for older, minus the
 *     hero count, clamped to [2, 5].
 */
export async function pickDevModePoolCharacters(input: {
  setting?: string;
  genre?: string;
  ageGroup?: string;
  excludeNames: Set<string>;
  heroCount: number;
}): Promise<DevModePoolCharacter[]> {
  let rows: CharacterPoolRow[] = [];
  try {
    rows = await storyDB.queryAll<CharacterPoolRow>`
      SELECT id, name, role, archetype, emotional_nature, visual_profile,
             age_category, species_category, personality_keywords,
             physical_description, backstory, catchphrase, speech_style,
             quirk, canon_settings, recent_usage_count, total_usage_count
      FROM character_pool
      WHERE is_active = TRUE
    `;
  } catch (err) {
    console.warn("[dev-mode-generation] Failed to load character_pool, continuing without supporting cast:", err);
    return [];
  }

  if (rows.length === 0) return [];

  const setting = (input.setting || "").trim().toLowerCase();
  const ageMax = ageGroupMaxAge(input.ageGroup);
  const maxGlobalChars = ageMax <= 5 ? 3 : ageMax <= 8 ? 4 : 6;
  const targetCount = Math.max(2, Math.min(5, maxGlobalChars - Math.max(1, input.heroCount)));

  const scored = rows
    .filter((r) => !input.excludeNames.has((r.name || "").toLowerCase()))
    .map((r) => {
      let score = 0;

      // Setting match — strong signal. canon_settings is text[].
      const canon = (r.canon_settings || []).map((s) => s.toLowerCase());
      if (setting.length > 0 && canon.length > 0) {
        if (canon.includes(setting)) score += 50;
        else if (canon.some((c) => c.includes(setting) || setting.includes(c))) score += 25;
      } else if (canon.length === 0) {
        // No canon_settings = universal character, small neutral score.
        score += 10;
      }

      // Freshness — prefer less-recently-used to rotate cast across stories.
      const recent = Number(r.recent_usage_count) || 0;
      score += Math.max(0, 20 - recent * 4);

      // Small noise so identical scores rotate naturally between generations.
      score += Math.random() * 5;

      return { row: r, score };
    })
    .sort((a, b) => b.score - a.score);

  // Diversity: when picking the top N, skip duplicates of an archetype we
  // already chose (unless we'd have to drop below targetCount).
  const picked: CharacterPoolRow[] = [];
  const seenArchetypes = new Set<string>();
  for (const candidate of scored) {
    if (picked.length >= targetCount) break;
    const arch = (candidate.row.archetype || "").toLowerCase();
    if (arch && seenArchetypes.has(arch)) continue;
    picked.push(candidate.row);
    if (arch) seenArchetypes.add(arch);
  }
  // If diversity filter left us short, top up from the rest.
  if (picked.length < targetCount) {
    for (const candidate of scored) {
      if (picked.length >= targetCount) break;
      if (picked.includes(candidate.row)) continue;
      picked.push(candidate.row);
    }
  }

  return picked.map((r) => {
    const vp = r.visual_profile;
    const physicalDescription =
      r.physical_description ||
      (vp && typeof vp === "object" ? (vp.description || vp.appearance || null) : null);

    return {
      id: r.id,
      name: r.name,
      role: r.role || undefined,
      archetype: r.archetype || undefined,
      species: r.species_category,
      ageCategory: r.age_category,
      physicalDescription,
      personalityKeywords: r.personality_keywords || [],
      catchphrase: r.catchphrase,
      speechStyle: r.speech_style || [],
      quirk: r.quirk,
      backstory: r.backstory,
    };
  });
}
