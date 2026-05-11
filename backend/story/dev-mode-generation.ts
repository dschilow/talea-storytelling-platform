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
 *   3b. selected wizard model: targeted story polish when local gates fail
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
import { GEMINI_SUPPORT_MODEL } from "./pipeline/model-routing";
import type { StoryConfig, AIProvider } from "./generate";
import { publishWithTimeout } from "../helpers/pubsubTimeout";
import { logTopic } from "../log/logger";
import { storyDB } from "./db";

const openAIKey = secret("OpenAIKey");

const DEFAULT_GEMINI_MODEL = "gemini-3-flash-preview";
const DEV_MODE_NATIVE_SUPPORT_MODEL = GEMINI_SUPPORT_MODEL;
const DEV_MODE_OPENROUTER_SUPPORT_MODEL = "google/gemini-3.1-flash-lite";
const DEV_MODE_PIPELINE_ID = "adaptive-polish-cost-optimized";

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
    devModePipeline?: typeof DEV_MODE_PIPELINE_ID | "four-stage-cost-optimized";
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
    qualityScore?: number;
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

function summarizePersonalityTraits(pt: any): { baseLine: string; subLines: string[] } {
  if (!pt || typeof pt !== "object") return { baseLine: "", subLines: [] };

  const BASE_KEYS = ["knowledge", "creativity", "vocabulary", "courage", "curiosity", "teamwork", "empathy", "persistence", "logic"];
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

  for (const key of BASE_KEYS) {
    const node = pt[key];
    const rawValue = typeof node === "number" ? node : (node && typeof node === "object" ? Number(node.value ?? 0) : 0);
    const value = clampNumber(rawValue, 0, 100);
    baseParts.push(`${LABEL_EN[key]} ${Math.round(value)} (${traitBand(value)})`);

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
        subLines.push(`  ${LABEL_EN[key]} (detail): ${subParts.join(", ")}`);
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
      lines.push(`   Personality (prompt scale 0-100; values above 100 were clamped only for this prompt): ${baseLine}`);
      lines.push("   Dramaturgy note: low values are friction and room to grow; high values are active strengths. The character must never act against these values — only grow from them.");
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
    "Dialogue inside story text uses the target language's typographic quotation marks (German „…\", French «…», English \"…\") — NOT plain ASCII quotes inside story values.",
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
      '  "revisedBlueprint": object',
      "}",
    ].join("\n")
  );
  const userPrompt = [
    "CALL 2: Critique this blueprint like a strict children's-book dramaturg and editor.",
    "Find everything that would push the final story below 9.5/10 against real children's books: weak tension, missing emotional core, characters without an active role, identical voices, telling not showing, generic motifs, missing sensory detail, unearned turn.",
    "Inspect read-on pull specifically: is there a recognizable motif? Does every chapter end on a real question or decision? Are there enough comic or puzzling details kids want to re-listen to?",
    "A blueprint without clear chapter-end hooks, refrain/callback, or a child-curiosity engine may score at most 8.4.",
    "Then return an improved revisedBlueprint. The revisedBlueprint may sharpen structure but must not introduce new unfitting pipeline complexity.",
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

function buildStoryDraftPrompts(
  input: DevModeGenerationInput,
  chapterCount: number,
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
  const revisedBlueprint = critique?.revisedBlueprint || blueprint;
  const heroNames = (input.avatars || []).map((a) => a.name).filter(Boolean);
  const heroA = heroNames[0] || "Main character A";
  const heroB = heroNames[1] || "Main character B";
  const userPrompt = [
    `CALL 3: Now write the final story as real scenes, not a summary. Output the title, description, and chapter content in ${languageName}.`,
    "This is the ONLY call allowed to write the actual story prose. Use the blueprint, the critique, and the voice rules directly in the first draft.",
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
    "DRAMATURGY RULES:",
    `- Exactly ${chapterCount} chapters.`,
    `- ${chapterLengthGuidance(input.config)}`,
    "- 6–12 paragraphs per chapter.",
    "- Chapter 1: strong hook in the first 2 sentences, concrete problem, different reactions from the main characters, open ending.",
    "- Chapter 2: world becomes concrete, trail/encounter, side or antagonist character shows a quirk, problem grows.",
    "- Chapter 3: a wrong attempt or wrong choice coming from character, real consequence, no lucky accident saves them.",
    "- Chapter 4: understand the deeper rule, combine different strengths, an emotional moment, prepare the finale.",
    "- Chapter 5: concrete action, prepared solution, emotional aftertaste, strong closing image, no explained moral.",
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
    "VOICE / READ-ALOUD RULES:",
    "- Make voices distinguishable. Use each main character's personality values from the context block to decide their pace, lexicon, and risk tolerance.",
    "- Dialogue must do at least two things at once: action, relationship, subtext, or humor.",
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

  const userPrompt = [
    `CALL 3B: Run a targeted children's-book polish on the existing story. The polished prose must stay in ${languageName}.`,
    "This call only runs when local quality gates OR the validator flagged issues. Don't rewrite a different plot — repair and tighten what's there.",
    "Preserve tone, characters, plot, title idea, and closing image, but consistently fix the listed flaws.",
    "",
    buildEmotionAndVoicePromptContext(input, chapterCount),
    "",
    "POLISH GOALS:",
    "- Kids must want to keep listening or reading after every chapter.",
    "- Tighten, don't inflate: cut explanatory sentences, replace them with action, dialogue, gesture, or concrete detail.",
    "- Add more dialogue, but every dialogue line must do action, relationship, character, or humor.",
    "- Chapter endings need pull. No chapter may end like a finished summary.",
    "- Recurring motifs, refrains, or small objects must visibly return and pay off in the finale.",
    "- Fix all typos, name errors, and grammar issues. Names must match exactly.",
    "- Keep the exact chapter count and JSON structure.",
    "- If the validator findings list 'mustFixBefore95' items, address each one explicitly.",
    "",
    "LOCAL DIAGNOSTICS:",
    JSON.stringify(diagnostics, null, 2),
    "",
    "BLUEPRINT / READER MAGNET:",
    JSON.stringify(critique?.revisedBlueprint || blueprint, null, 2),
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

function buildValidationPrompts(
  input: DevModeGenerationInput,
  chapterCount: number,
  story: DevModeRawStory,
  diagnostics?: DevModeStoryDiagnostics
): { systemPrompt: string; userPrompt: string } {
  const languageName = localizedLanguageName(input.config.language);
  const systemPrompt = qualitySystemPrompt(
    languageName,
    [
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
    ].join("\n")
  );
  const code = languageCodeFromName(languageName);
  const anchorBlock = validatorAnchorBlock(code);
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
    "CONTEXT:",
    buildEmotionAndVoicePromptContext(input, chapterCount),
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

  const chapters: DevModeChapter[] = rawChapters.map((ch: any, idx: number) => {
    const chTitle = String(ch?.title || "").trim() || `Kapitel ${idx + 1}`;
    const chContent = String(ch?.content || "").trim();
    if (!chContent) {
      throw new Error(`Developer-mode chapter ${idx + 1} is empty.`);
    }
    const order = Number.isInteger(ch?.order) && ch.order > 0 ? Number(ch.order) : idx + 1;
    return { title: chTitle, content: chContent, order };
  });

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
  return Array.from(text.matchAll(/„[^“]+“/g)).reduce((sum, match) => sum + match[0].length, 0);
}

function countParagraphs(text: string): number {
  return text.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean).length;
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

  if (/"[^"]+"/.test(allContent)) {
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

  if (dialogPct < 26) {
    hardIssues.push(`Dialoganteil ist mit ${dialogPct}% zu niedrig; Ziel sind mindestens 30%.`);
  } else if (dialogPct < 30) {
    softIssues.push(`Dialoganteil ist mit ${dialogPct}% knapp unter Zielwert 30%.`);
  }

  story.chapters.forEach((chapter, index) => {
    const issues: string[] = [];
    const chars = chapter.content.length;
    const paragraphs = countParagraphs(chapter.content);
    const chapterDialogPct = chars > 0 ? Math.round((countDialogChars(chapter.content) / chars) * 1000) / 10 : 0;
    const chapterPrefix = `Kapitel ${chapter.order || index + 1}`;

    if (chars < bounds.min * 0.8) {
      issues.push(`zu kurz (${chars} Zeichen)`);
      hardIssues.push(`${chapterPrefix} ist deutlich zu kurz (${chars}; Ziel ${bounds.min}-${bounds.max}).`);
    } else if (chars > bounds.max * 1.25) {
      issues.push(`deutlich zu lang (${chars} Zeichen)`);
      hardIssues.push(`${chapterPrefix} ist deutlich zu lang (${chars}; Ziel ${bounds.min}-${bounds.max}).`);
    } else if (chars < bounds.min || chars > bounds.max * 1.1) {
      issues.push(`ausserhalb Ziel-Laenge (${chars} Zeichen)`);
      softIssues.push(`${chapterPrefix} liegt ausserhalb der idealen Laenge (${chars}; Ziel ${bounds.min}-${bounds.max}).`);
    }

    if (paragraphs < 6) {
      issues.push(`zu wenige Absaetze (${paragraphs})`);
      hardIssues.push(`${chapterPrefix} hat zu wenige Absaetze (${paragraphs}; Ziel 6-12).`);
    } else if (paragraphs > 16) {
      issues.push(`zu viele Absaetze (${paragraphs})`);
      hardIssues.push(`${chapterPrefix} hat zu viele Absaetze (${paragraphs}; Ziel 6-12).`);
    } else if (paragraphs > 12) {
      issues.push(`etwas viele Absaetze (${paragraphs})`);
      softIssues.push(`${chapterPrefix} hat mehr als 12 Absaetze (${paragraphs}).`);
    }

    const lastParagraph = chapter.content.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean).slice(-1)[0] || "";
    if (index < story.chapters.length - 1 && !hasForwardPull(lastParagraph)) {
      issues.push("Kapitelende hat wenig Weiterlese-Sog");
      softIssues.push(`${chapterPrefix} endet ohne klaren Pull zur naechsten Szene.`);
    }

    if (chapterDialogPct < 18) {
      issues.push(`wenig Dialog (${chapterDialogPct}%)`);
      softIssues.push(`${chapterPrefix} hat wenig Dialog (${chapterDialogPct}%).`);
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

function resolveDevModeSupportProvider(config: StoryConfig): AIProvider {
  return config.aiProvider === "openrouter" ? "openrouter" : "native";
}

function resolveDevModeSupportModel(config: StoryConfig): string {
  return resolveDevModeSupportProvider(config) === "openrouter"
    ? DEV_MODE_OPENROUTER_SUPPORT_MODEL
    : DEV_MODE_NATIVE_SUPPORT_MODEL;
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
  const hasModelOverride = typeof options.modelOverride === "string" && options.modelOverride.trim().length > 0;
  const requestedModel = (options.modelOverride || config.aiModel || DEFAULT_GEMINI_MODEL).trim();
  const aiProvider: AIProvider =
    options.providerOverride ||
    (hasModelOverride && requestedModel.startsWith("gemini-")
      ? "native"
      : config.aiProvider === "openrouter"
        ? "openrouter"
        : "native");
  const openRouterModel = options.openRouterModelOverride || config.openRouterModel;
  const maxTokens = options.maxTokens ?? 16000;
  const temperature = options.temperature ?? 0.9;

  if (aiProvider === "openrouter") {
    const orModel = normalizeOpenRouterModel(openRouterModel);
    // Some OpenRouter-routed providers (e.g. Anthropic Claude) don't honor
    // OpenAI's response_format=json_object and may return slightly malformed
    // JSON when it's forced. For Claude via OpenRouter we skip the flag and
    // rely on the strict JSON instructions in the system prompt + our
    // tolerant parser.
    const isClaudeViaOpenRouter = /claude/i.test(orModel) || /anthropic/i.test(orModel);
    console.log(`[dev-mode-generation] Calling OpenRouter model: ${orModel}`, {
      forceJsonObjectFormat: !isClaudeViaOpenRouter,
    });
    const res = await callOpenRouterChatCompletion({
      model: orModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      maxTokens,
      responseFormat: isClaudeViaOpenRouter ? "text" : "json_object",
      temperature,
    });
    const choice = res.data.choices?.[0];
    const content = choice?.message?.content || "";
    if (!content) throw new Error("Empty response from OpenRouter (dev mode).");
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

  console.log("[dev-mode-generation] Dev mode adaptive polish cost-optimized quality pipeline", {
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
  });

  let finalParsed: DevModeRawStory | null = null;
  let finalModelUsed: string = input.config.aiModel || DEFAULT_GEMINI_MODEL;
  let finalQualityScore: number | undefined;
  let finalDiagnostics: DevModeStoryDiagnostics | undefined;
  let polishApplied = false;

  try {
    const blueprintPrompts = buildBlueprintPrompts(input, chapterCount);
    const blueprintStage = await runStage("blueprint", blueprintPrompts, {
      maxTokens: 9500,
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
      maxTokens: 7500,
      temperature: 0.35,
      timeoutMs: 120_000,
      ...supportCallOptions,
      modelRole: "support",
    });
    const critique = critiqueStage.parsed || {
      rawCritique: critiqueStage.provider.content,
      parseWarning: critiqueStage.parseError,
    };

    const storyPrompts = buildStoryDraftPrompts(input, chapterCount, blueprint, critique);
    const storyStage = await runStage("story-draft", storyPrompts, {
      maxTokens: input.config.length === "long" ? 32000 : 22000,
      temperature: 0.82,
      timeoutMs: input.config.length === "long" ? 300_000 : 210_000,
      modelRole: "selected-story",
    });
    finalParsed = parseAndValidate(storyStage.provider.content, chapterCount);
    finalModelUsed = storyStage.provider.modelUsed;
    finalDiagnostics = analyzeDevModeStoryQuality(finalParsed, input, chapterCount);

    // NEW FLOW: Validator runs FIRST. Polish only triggers when the draft is
    // actually below quality threshold (validator score < 8.5) OR local
    // diagnostics flag hard issues. This skips the expensive polish call when
    // the draft is already good (saves ~$0.02 on roughly 1/3 of stories).
    const validationPrompts = buildValidationPrompts(input, chapterCount, finalParsed, finalDiagnostics);
    const validationStage = await runStage("final-validation", validationPrompts, {
      maxTokens: 6500,
      temperature: 0.15,
      timeoutMs: 120_000,
      ...supportCallOptions,
      modelRole: "support",
    });
    finalQualityScore = extractQualityScore(validationStage.parsed) ?? undefined;

    const POLISH_SCORE_THRESHOLD = 8.5;
    const needsPolishByScore =
      typeof finalQualityScore === "number" && finalQualityScore < POLISH_SCORE_THRESHOLD;
    const needsPolishByDiagnostics = Boolean(finalDiagnostics?.needsPolish);

    if (needsPolishByScore || needsPolishByDiagnostics) {
      polishApplied = true;
      console.log("[dev-mode-generation] Triggering story polish", {
        reason: needsPolishByScore ? "validator-score-below-threshold" : "local-hard-issues",
        validatorScore: finalQualityScore,
        threshold: POLISH_SCORE_THRESHOLD,
        hardIssueCount: finalDiagnostics?.hardIssueCount,
        softIssueCount: finalDiagnostics?.softIssueCount,
        dialogPct: finalDiagnostics?.dialogPct,
      });
      // Pass the validator output to the polish so the model fixes the
      // exact things the validator flagged (mustFixBefore95, warnings,
      // publishabilityBlockers).
      const polishCritique = {
        ...(critique || {}),
        validatorFindings: validationStage.parsed || null,
      };
      const polishPrompts = buildStoryPolishPrompts(
        input,
        chapterCount,
        finalParsed,
        finalDiagnostics!,
        blueprint,
        polishCritique
      );
      const polishStage = await runStage("story-polish", polishPrompts, {
        maxTokens: input.config.length === "long" ? 32000 : 22000,
        temperature: 0.62,
        timeoutMs: input.config.length === "long" ? 300_000 : 210_000,
        modelRole: "selected-story",
      });
      finalParsed = parseAndValidate(polishStage.provider.content, chapterCount);
      finalModelUsed = polishStage.provider.modelUsed;
      finalDiagnostics = analyzeDevModeStoryQuality(finalParsed, input, chapterCount);

      // Re-validate after polish so the score in metadata reflects the
      // actual final story shipped to the user.
      const revalidationPrompts = buildValidationPrompts(input, chapterCount, finalParsed, finalDiagnostics);
      const revalidationStage = await runStage("final-validation", revalidationPrompts, {
        maxTokens: 6500,
        temperature: 0.15,
        timeoutMs: 120_000,
        ...supportCallOptions,
        modelRole: "support",
      });
      finalQualityScore = extractQualityScore(revalidationStage.parsed) ?? finalQualityScore;
    } else {
      console.log("[dev-mode-generation] Skipping polish — draft already above quality threshold", {
        validatorScore: finalQualityScore,
        threshold: POLISH_SCORE_THRESHOLD,
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
        stages: stageLogs,
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
    throw new Error("Developer-mode adaptive polish cost-optimized pipeline did not produce a story.");
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
        systemPrompt: stage.systemPrompt,
        userPrompt: stage.userPrompt,
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
      localQualityDiagnostics: finalDiagnostics,
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
