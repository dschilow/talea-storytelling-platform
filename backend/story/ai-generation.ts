import { api } from "encore.dev/api";
import { secret } from "encore.dev/config";
import type {
  StoryConfig,
  Chapter,
  StylePresetKey,
} from "./generate";
import type { Avatar, AvatarVisualProfile } from "../avatar/avatar";
import { ai } from "~encore/clients";
import { logTopic } from "../log/logger";
import { publishWithTimeout } from "../helpers/pubsubTimeout";
import { avatarDB } from "../avatar/db";
import {
  buildAvatarProgressionSummary,
  selectRelevantMemoryForPrompt,
} from "../avatar/progression";
// MCP imports kept for potential future use, but not currently used
import {
  type ValidationResult,
} from "../helpers/mcpClient";
import { generateWithGemini, isGeminiConfigured } from "./gemini-generation";
import {
  normalizeAvatarIds,
  createFallbackProfile,
  upgradeProfileWithVersion,
  generateProfileHash,
  normalizeLanguage,
  safeCoverScene,
  createTelemetry,
  OptimizationErrorCode,
  type MinimalAvatarProfile,
  type OptimizationTelemetry,
} from "./avatar-image-optimization";
import {
  buildCharacterBlock,
  buildCompleteImagePrompt,
  type CharacterBlock,
} from "./character-block-builder";
import {
  performVisionQA,
  strengthenConstraintsForRetry,
  extractKeyFeaturesFromMustInclude,
  type VisionQAExpectation,
  type VisionQAResult,
} from "./vision-qa";
import {
  createStoryConsistency,
  buildCharacterFirstBlock,
  smartClampPrompt,
  logConsistencyStatus,
  type StoryCharacterConsistency,
  TALEA_DEFAULT_STYLE,
} from "./image-consistency-system";

/**
 * OPTIMIZED v3.0: Smart prompt clamping that NEVER removes character identity blocks
 * Character details at the START of prompt are preserved, scene details at END can be truncated
 */
function clampRunwarePrompt(prompt: string, maxLength = 2800): string {
  if (!prompt) {
    return "";
  }
  if (prompt.length <= maxLength) {
    return prompt;
  }

  // Check if prompt uses new CHARACTER block format
  if (prompt.includes('=== CHARACTERS') || prompt.includes('[STYLE:')) {
    return smartClampPrompt(prompt, maxLength);
  }

  // Legacy format: Try to preserve CHARACTERS section
  const charactersMarker = 'CHARACTERS:';
  const charactersIndex = prompt.indexOf(charactersMarker);

  if (charactersIndex !== -1) {
    // Find end of characters section (next major section or double newline)
    const afterCharacters = prompt.substring(charactersIndex);
    const nextSectionMatch = afterCharacters.match(/\n\n[A-Z]+:/);
    const charactersEndIndex = nextSectionMatch
      ? charactersIndex + (nextSectionMatch.index || afterCharacters.length)
      : charactersIndex + Math.min(800, afterCharacters.length);

    const characterBlock = prompt.substring(0, charactersEndIndex);
    const restOfPrompt = prompt.substring(charactersEndIndex);

    // Calculate how much space we have for the rest
    const availableForRest = maxLength - characterBlock.length - 10;

    if (availableForRest > 100) {
      const truncatedRest = restOfPrompt.substring(0, availableForRest);
      const lastGoodBreak = Math.max(
        truncatedRest.lastIndexOf('.'),
        truncatedRest.lastIndexOf('\n'),
        truncatedRest.lastIndexOf(',')
      );
      const cleanRest = lastGoodBreak > availableForRest * 0.5
        ? truncatedRest.substring(0, lastGoodBreak + 1)
        : truncatedRest;

      console.log(`[clampRunwarePrompt] Preserved character block (${characterBlock.length} chars), truncated scene details`);
      return (characterBlock + cleanRest).trimEnd() + '...';
    }

    // Character block alone is too long, return it truncated
    console.warn(`[clampRunwarePrompt] Character block too long, hard truncating`);
    return characterBlock.substring(0, maxLength - 3) + '...';
  }

  // Fallback: simple truncation at good break point
  const sliced = prompt.slice(0, maxLength);
  const lastSeparator = Math.max(
    sliced.lastIndexOf("."),
    sliced.lastIndexOf(","),
    sliced.lastIndexOf(";"),
    sliced.lastIndexOf(" ")
  );
  const cleanSlice = lastSeparator > maxLength * 0.6 ? sliced.slice(0, lastSeparator) : sliced;
  return `${cleanSlice.trimEnd()}...`;
}

interface StylePresetMeta {
  inspiration: string;
  description: string;
}

const STYLE_PRESET_META: Record<StylePresetKey, StylePresetMeta> = {
  rhymed_playful: {
    inspiration:
      "Inspired by 'Der Grüffelo': rhythmic, playful cadence with call-and-response dialogue; keep lines musical. Always dialogue-driven with action.",
    description: "Rhymed phrases, call-and-response, humorous dialogue.",
  },
  gentle_minimal: {
    inspiration:
      "Inspired by 'Die kleine Raupe Nimmersatt': minimal structure with repeating phrases; calm but always action-based. Characters DO things, not just exist.",
    description: "Repetition, clear structure, calm actions.",
  },
  wild_imaginative: {
    inspiration:
      "Inspired by 'Wo die wilden Kerle wohnen': bold energy with safe boundaries; celebrate curiosity through concrete physical action and dialogue.",
    description: "Rebellious imagination, safe boundaries, action-driven.",
  },
  philosophical_warm: {
    inspiration:
      "Inspired by 'Der kleine Prinz': warm, reflective tone with ONE simple wisdom per chapter — delivered through dialogue, not narration. No poetic metaphors.",
    description: "Small wisdoms through dialogue, grounded.",
  },
  mischief_empowering: {
    inspiration:
      "Inspired by 'Pippi Langstrumpf': mischievous, empowering tone where kids act confidently and humor drives the plot through dialogue and slapstick.",
    description: "Self-efficacy, humor, dialogue-heavy.",
  },
  adventure_epic: {
    inspiration:
      "Inspired by 'Harry Potter': episodic adventure with clear quests and team spirit; told through character dialogue and action, not description.",
    description: "Quest feeling, dialogue-driven action.",
  },
  quirky_dark_sweet: {
    inspiration:
      "Inspired by 'Charlie und die Schokoladenfabrik': quirky, gently dark sweetness with surprising twists — shown through situational comedy and dialogue.",
    description: "Slightly quirky, always friendly, situational humor.",
  },
  cozy_friendly: {
    inspiration:
      "Inspired by 'Winnie Puuh': cozy, dialogue-rich scenes full of friendship and gentle warmth. At least 50% dialogue.",
    description: "Cozy dialogue, friendship, character-driven.",
  },
  classic_fantasy: {
    inspiration:
      "Inspired by 'Peter Pan': timeless fairy-tale fantasy with wide-eyed heroes; told through action sequences and character dialogue, not atmospheric description.",
    description: "Timeless fantasy, action-driven.",
  },
  whimsical_logic: {
    inspiration:
      "Inspired by 'Alice im Wunderland': playful logic puzzles and wordplay delivered through character dialogue; easy to follow for kids.",
    description: "Logic games, playful dialogue.",
  },
  mythic_allegory: {
    inspiration:
      "Inspired by 'Die Chroniken von Narnia': mythic storytelling with team spirit; symbolic moments shown through action and character choices, not poetic narration.",
    description: "Symbolism through action, team spirit.",
  },
  road_fantasy: {
    inspiration:
      "Inspired by 'Der Zauberer von Oz': journey fantasy with clear stages and memorable companions; each stage shown through dialogue and concrete encounters.",
    description: "Journey, stages, companions, encounter-driven.",
  },
  imaginative_meta: {
    inspiration:
      "Inspired by 'Die unendliche Geschichte': meta-fantasy celebrating imagination; stories inside stories told through character interaction, not atmospheric prose.",
    description: "Story within story, character-driven.",
  },
  pastoral_heart: {
    inspiration:
      "Inspired by 'Heidi': heartfelt community and gentle resilience; warmth shown through character relationships and dialogue, not nature descriptions.",
    description: "Community feeling, dialogue-driven warmth.",
  },
  bedtime_soothing: {
    inspiration:
      "Inspired by 'Gute Nacht, Mond': soothing bedtime tone with calm, short sentences and gentle rhythm. Still needs character action — just slower and softer.",
    description: "Very gentle, whispering pace.",
  },
};

// Quality standards
const QUALITY_CONFIG = {
  MIN_CHAPTER_WORDS: 200,
  MAX_CHAPTER_WORDS: 500,
  MIN_ACCEPTABLE_SCORE: 7.5,
  TARGET_SCORE: 9.0,
  MAX_RETRIES: 2,
  AVG_SENTENCE_LENGTH: {
    "3-5": { min: 5, max: 10 },
    "6-8": { min: 8, max: 15 },
    "9-12": { min: 10, max: 20 },
    "13+": { min: 12, max: 25 },
  },
  FORBIDDEN_PATTERNS: [
    /lotschte/gi,
    /wie oelen|wie ölen/gi,
    /\.\.\.\.\./g,
    /!!!/g,
  ],
} as const;

// Model configurations with costs per 1M tokens
interface ModelConfig {
  name: string;
  inputCostPer1M: number;
  outputCostPer1M: number;
  maxCompletionTokens: number;
  supportsReasoningEffort?: boolean;
}

const MODEL_CONFIGS: Record<string, ModelConfig> = {
  "gpt-5-nano": {
    name: "gpt-5-nano",
    inputCostPer1M: 0.050,      // $0.050/1M tokens
    outputCostPer1M: 0.400,     // $0.400/1M tokens
    maxCompletionTokens: 16000,
    supportsReasoningEffort: false,
  },
  "gpt-5-mini": {
    name: "gpt-5-mini",
    inputCostPer1M: 0.250,      // $0.250/1M tokens
    outputCostPer1M: 2.000,     // $2.000/1M tokens
    maxCompletionTokens: 16000,
    supportsReasoningEffort: false,
  },
  "gpt-5": {
    name: "gpt-5",
    inputCostPer1M: 1.250,      // $1.250/1M tokens
    outputCostPer1M: 10.000,    // $10.000/1M tokens
    maxCompletionTokens: 16000,
    supportsReasoningEffort: false,
  },
  "gpt-5.2": {
    name: "gpt-5.2",
    inputCostPer1M: 1.250,      // $1.250/1M tokens
    outputCostPer1M: 10.000,    // $10.000/1M tokens
    maxCompletionTokens: 16000,
    supportsReasoningEffort: false,
  },
  "gpt-5-pro": {
    name: "gpt-5-pro",
    inputCostPer1M: 15.00,      // $15.00/1M tokens
    outputCostPer1M: 120.00,    // $120.00/1M tokens
    maxCompletionTokens: 32000,
    supportsReasoningEffort: true,
  },
  "gpt-4.1-nano": {
    name: "gpt-4.1-nano",
    inputCostPer1M: 0.20,       // $0.20/1M tokens
    outputCostPer1M: 0.80,      // $0.80/1M tokens
    maxCompletionTokens: 16384,
    supportsReasoningEffort: false,
  },
  "gpt-4.1-mini": {
    name: "gpt-4.1-mini",
    inputCostPer1M: 0.80,       // $0.80/1M tokens
    outputCostPer1M: 3.20,      // $3.20/1M tokens
    maxCompletionTokens: 16384,
    supportsReasoningEffort: false,
  },
  "gpt-4.1": {
    name: "gpt-4.1",
    inputCostPer1M: 3.00,       // $3.00/1M tokens
    outputCostPer1M: 12.00,     // $12.00/1M tokens
    maxCompletionTokens: 16384,
    supportsReasoningEffort: false,
  },
  "o4-mini": {
    name: "o4-mini",
    inputCostPer1M: 4.00,       // $4.00/1M tokens
    outputCostPer1M: 16.00,     // $16.00/1M tokens
    maxCompletionTokens: 16384,
    supportsReasoningEffort: true,
  },
  "gemini-3-flash-preview": {
    name: "gemini-3-flash-preview",
    inputCostPer1M: 0.00,       // FREE during preview
    outputCostPer1M: 0.00,      // FREE during preview
    maxCompletionTokens: 65536,
    supportsReasoningEffort: false,
  },
  "gemini-3.1-pro-preview": {
    name: "gemini-3.1-pro-preview",
    inputCostPer1M: 0.00,       // Preview pricing (configure when finalized)
    outputCostPer1M: 0.00,      // Preview pricing (configure when finalized)
    maxCompletionTokens: 65536,
    supportsReasoningEffort: false,
  },
};

// Default model
const DEFAULT_MODEL = "gpt-5-mini";

const openAIKey = secret("OpenAIKey");

interface McpAvatarProfile {
  id: string;
  name: string;
  visualProfile?: AvatarVisualProfile;
}

interface McpAvatarMemory {
  id: string;
  avatarId: string;
  storyId: string;
  storyTitle: string;
  experience: string;
  emotionalImpact: "positive" | "negative" | "neutral";
  personalityChanges: Array<{ trait: string; change: number }>;
  createdAt: string;
}

// Direct DB access functions (replacing MCP calls)
async function getAvatarProfilesFromDB(avatarIds: string[]): Promise<McpAvatarProfile[]> {
  const profiles: McpAvatarProfile[] = [];

  for (const avatarId of avatarIds) {
    const row = await avatarDB.queryRow<{
      id: string;
      name: string;
      visual_profile: string | null;
    }>`
      SELECT id, name, visual_profile FROM avatars WHERE id = ${avatarId}
    `;

    if (row) {
      profiles.push({
        id: row.id,
        name: row.name,
        visualProfile: row.visual_profile ? JSON.parse(row.visual_profile) : undefined,
      });
    }
  }

  return profiles;
}

async function getAvatarMemoriesFromDB(avatarId: string, limit: number = 2): Promise<McpAvatarMemory[]> {
  // OPTIMIZED: Simple query with actual limit, no CTE overhead.
  // Table is created by migrations, no need for CREATE TABLE IF NOT EXISTS on every call.
  const memoryRowsGenerator = await avatarDB.query<{
    id: string;
    story_id: string;
    story_title: string;
    experience: string;
    emotional_impact: 'positive' | 'negative' | 'neutral';
    personality_changes: string;
    created_at: string;
  }>`
    SELECT id, story_id, story_title, experience, emotional_impact, personality_changes, created_at
    FROM avatar_memories
    WHERE avatar_id = ${avatarId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  const memoryRows: any[] = [];
  for await (const row of memoryRowsGenerator) {
    memoryRows.push(row);
  }

  return memoryRows.map(row => ({
    id: row.id,
    avatarId: avatarId,
    storyId: row.story_id,
    storyTitle: row.story_title,
    experience: row.experience,
    emotionalImpact: row.emotional_impact,
    personalityChanges: JSON.parse(row.personality_changes),
    createdAt: row.created_at,
  }));
}

async function getAvatarProgressStatsFromDB(avatarId: string): Promise<{
  storiesRead: number;
  dokusRead: number;
  memoryCount: number;
}> {
  const row = await avatarDB.queryRow<{
    stories_read: number;
    dokus_read: number;
    memory_count: number;
  }>`
    SELECT
      (SELECT COUNT(*)::int FROM avatar_story_read WHERE avatar_id = ${avatarId}) AS stories_read,
      (SELECT COUNT(*)::int FROM avatar_doku_read WHERE avatar_id = ${avatarId}) AS dokus_read,
      (SELECT COUNT(*)::int FROM avatar_memories WHERE avatar_id = ${avatarId}) AS memory_count
  `;

  return {
    storiesRead: row?.stories_read ?? 0,
    dokusRead: row?.dokus_read ?? 0,
    memoryCount: row?.memory_count ?? 0,
  };
}

type ExtendedAvatarDetails = Omit<
  Avatar,
  "userId" | "isShared" | "originalAvatarId" | "createdAt" | "updatedAt"
> & {
  memories?: McpAvatarMemory[];
};

interface GenerateStoryContentRequest {
  config: StoryConfig;
  avatarDetails: ExtendedAvatarDetails[];
  clerkToken: string;
}

interface OpenAIResponse {
  choices?: Array<{
    message?: {
      content?: string;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

interface ImageCharacterBeat {
  name: string;
  action: string;
  expression?: string;
  position?: string;
  pose?: string;
  clothingHint?: string;
  ageGuard?: string;
}

interface ImageEnvironmentLayers {
  foreground: string[];
  midground: string[];
  background: string[];
}

interface ImageAtmosphere {
  weather: string;
  lighting: string;
  season: string;
  mood: string;
  sensoryDetails?: string[];
}

interface ImageComposition {
  camera: string;
  perspective: string;
  focalPoints: string[];
  movement?: string;
  depth?: string;
}

interface ChapterImageDescription {
  scene: string;
  characters: {
    protagonists: ImageCharacterBeat[];
    supporting: ImageCharacterBeat[];
  };
  environment: ImageEnvironmentLayers;
  props: string[];
  atmosphere: ImageAtmosphere;
  composition: ImageComposition;
  storytellingDetails?: string[];
  recurringElement?: string;
}

interface ImagePromptContext {
  summary: string;
  protagonistLines: string[];
  supportingLines: string[];
  environmentLayers?: ImageEnvironmentLayers;
  props: string[];
  atmosphereLines: string[];
  recurringElementNote?: string;
  storytellingDetails: string[];
}

function describeCharacter(group: ImageCharacterBeat[], label: string): string[] {
  if (!Array.isArray(group) || group.length === 0) {
    return [];
  }

  return group.map((entry) => {
    const parts: string[] = [label + ": " + entry.name];
    if (entry.action) parts.push(entry.action);
    if (entry.position) parts.push("position " + entry.position);
    if (entry.expression) parts.push("expression " + entry.expression);
    if (entry.pose) parts.push("pose " + entry.pose);
    if (entry.clothingHint) parts.push("clothing " + entry.clothingHint);
    if (entry.ageGuard) parts.push(entry.ageGuard);
    return parts.join(", ");
  });
}

function summarizeAtmosphere(atmosphere?: ImageAtmosphere): string[] {
  if (!atmosphere) return [];
  const lines: string[] = [];
  if (atmosphere.weather) lines.push("Weather: " + atmosphere.weather);
  if (atmosphere.lighting) lines.push("Lighting: " + atmosphere.lighting);
  if (atmosphere.season) lines.push("Season: " + atmosphere.season);
  if (atmosphere.mood) lines.push("Mood: " + atmosphere.mood);
  if (Array.isArray(atmosphere.sensoryDetails) && atmosphere.sensoryDetails.length > 0) {
    lines.push("Sensory: " + atmosphere.sensoryDetails.join(", "));
  }
  return lines;
}

function summarizeEnvironment(layers?: ImageEnvironmentLayers): string[] {
  if (!layers) return [];
  const lines: string[] = [];
  if (Array.isArray(layers.foreground) && layers.foreground.length > 0) {
    lines.push("Foreground: " + layers.foreground.join(", "));
  }
  if (Array.isArray(layers.midground) && layers.midground.length > 0) {
    lines.push("Midground: " + layers.midground.join(", "));
  }
  if (Array.isArray(layers.background) && layers.background.length > 0) {
    lines.push("Background: " + layers.background.join(", "));
  }
  return lines;
}

function extractImagePromptContext(description?: ChapterImageDescription): ImagePromptContext {
  if (!description) {
    return {
      summary: "",
      protagonistLines: [],
      supportingLines: [],
      environmentLayers: undefined,
      props: [],
      atmosphereLines: [],
      recurringElementNote: undefined,
      storytellingDetails: [],
    };
  }

  const protagonistLines = describeCharacter(description.characters?.protagonists ?? [], "Protagonist").slice(0, 3);
  const supportingLines = describeCharacter(description.characters?.supporting ?? [], "Supporting").slice(0, 3);

  const narrativePieces: string[] = [];
  if (description.scene) {
    narrativePieces.push(description.scene);
  }

  const actionHighlights = [
    ...protagonistLines.map((line) => line.replace(/^Protagonist: /, "")),
    ...supportingLines.map((line) => line.replace(/^Supporting: /, "")),
  ];
  if (actionHighlights.length > 0) {
    narrativePieces.push("Actions: " + actionHighlights.join(" | "));
  }

  const environmentSummary = summarizeEnvironment(description.environment);
  if (environmentSummary.length > 0) {
    narrativePieces.push(environmentSummary.join(" | "));
  }

  if (Array.isArray(description.props) && description.props.length > 0) {
    narrativePieces.push("Props: " + description.props.join(", "));
  }

  const atmosphereLines = summarizeAtmosphere(description.atmosphere).slice(0, 4);
  if (atmosphereLines.length > 0) {
    narrativePieces.push(atmosphereLines.join(" | "));
  }

  if (description.recurringElement) {
    narrativePieces.push("Recurring element: " + description.recurringElement);
  }

  if (Array.isArray(description.storytellingDetails) && description.storytellingDetails.length > 0) {
    narrativePieces.push("Story notes: " + description.storytellingDetails.join(", "));
  }

  const summary = narrativePieces.join(" ");
  const limitedEnvironment: ImageEnvironmentLayers = {
    foreground: Array.isArray(description.environment?.foreground)
      ? description.environment!.foreground.filter(Boolean).slice(0, 4)
      : [],
    midground: Array.isArray(description.environment?.midground)
      ? description.environment!.midground.filter(Boolean).slice(0, 6)
      : [],
    background: Array.isArray(description.environment?.background)
      ? description.environment!.background.filter(Boolean).slice(0, 4)
      : [],
  };
  const limitedProps = Array.isArray(description.props) ? description.props.filter(Boolean).slice(0, 6) : [];
  const limitedStoryDetails = Array.isArray(description.storytellingDetails)
    ? description.storytellingDetails.filter(Boolean).slice(0, 5)
    : [];

  return {
    summary,
    protagonistLines,
    supportingLines,
    environmentLayers:
      limitedEnvironment.foreground.length ||
      limitedEnvironment.midground.length ||
      limitedEnvironment.background.length
        ? limitedEnvironment
        : undefined,
    props: limitedProps,
    atmosphereLines,
    recurringElementNote: description.recurringElement,
    storytellingDetails: limitedStoryDetails,
  };
}

interface CoverImageDescription {
  scene: string;
  characters: {
    protagonists: ImageCharacterBeat[];
    supporting: ImageCharacterBeat[];
  };
  environment: ImageEnvironmentLayers;
  props: string[];
  atmosphere: ImageAtmosphere;
  composition: ImageComposition & {
    titleSpace?: string;
    layout?: string;
  };
  storytellingDetails?: string[];
}

interface AvatarDevelopment {
  name: string;
  changedTraits: Array<{
    trait: string;
    change: number;
  }>;
}

interface LearningOutcome {
  subject: string;
  newConcepts: string[];
  reinforcedSkills: string[];
  difficulty_mastered: string;
  practical_applications: string[];
}

interface SupportingCharacterSummary {
  name: string;
  role: string;
  personality: string;
  appearance: string;
  motivation?: string;
  recurringElementUsage?: string;
}

interface StoryRecurringElement {
  name: string;
  description: string;
  payoffChapter: number;
}

interface ChapterBeatSummary {
  order: number;
  focus: string;
  conflict: string;
  surprise: string;
  supportingCast: string[];
  environmentHighlights: string[];
  cliffhanger: string;
  sensoryDetails: string[];
}

interface GenerateStoryContentResponse {
  title: string;
  description: string;
  coverImageUrl: string;
  coverImageDescription: CoverImageDescription;
  supportingCharacters: SupportingCharacterSummary[];
  recurringElement: StoryRecurringElement;
  plotBeats: ChapterBeatSummary[];
  chapters: (Omit<Chapter, "id"> & {
    imageDescription: ChapterImageDescription;
    beatSummary?: ChapterBeatSummary;
  })[];
  avatarDevelopments: AvatarDevelopment[];
  learningOutcomes: LearningOutcome[];
  // OPTIMIZATION v1.1: New field to notify frontend about auto-generated characters
  newlyGeneratedCharacters?: Array<{
    id: string;
    name: string;
    role: string;
    species: string;
    gender: string;
  }>;
  metadata: {
    tokensUsed: {
      prompt: number;
      completion: number;
      total: number;
    };
    model: string;
    processingTime: number;
    imagesGenerated: number;
    totalCost: {
      text: number;
      images: number;
      total: number;
    };
  };
}

function normalizeRunwareDimensions(
  width: number,
  height: number
): { width: number; height: number } {
  const roundToMultiple64 = (value: number) => Math.round(value / 64) * 64;
  return {
    width: Math.max(128, Math.min(2048, roundToMultiple64(width))),
    height: Math.max(128, Math.min(2048, roundToMultiple64(height))),
  };
}

function deterministicSeedFrom(source: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = (hash >>> 0) * 0x01000193;
  }
  return Math.abs(hash >>> 0);
}

// OLD FUNCTIONS REMOVED - Now using buildCompleteImagePrompt() from character-block-builder.ts

export const generateStoryContent = api<
  GenerateStoryContentRequest,
  GenerateStoryContentResponse
>(
  { expose: true, method: "POST", path: "/ai/generate-story" },
  async (req) => {
    const startTime = Date.now();

    // Select model configuration
    const modelKey = req.config.aiModel || DEFAULT_MODEL;
    const selectedModel = MODEL_CONFIGS[modelKey] || MODEL_CONFIGS[DEFAULT_MODEL];

    const metadata: GenerateStoryContentResponse["metadata"] = {
      tokensUsed: { prompt: 0, completion: 0, total: 0 },
      model: selectedModel.name,
      processingTime: 0,
      imagesGenerated: 0,
      totalCost: { text: 0, images: 0, total: 0 },
    };

    try {
      console.log("[ai-generation] 🚀🚀🚀 OPTIMIZATION v1.0 ACTIVE - BUILD 2025-10-23-v3-NORMALIZED 🚀🚀🚀");

      // OPTIMIZATION v1.0: Hard-fail ID mapping before MCP calls
      const avatarIdMappings: Array<{id: string; name: string}> = req.avatarDetails.map(a => ({
        id: a.id,
        name: a.name,
      }));
      
      const avatarIdsOrNames = req.avatarDetails.map((avatar) => avatar.id);
      let avatarIds: string[];
      
      try {
        avatarIds = normalizeAvatarIds(avatarIdsOrNames, avatarIdMappings);
        console.log("[ai-generation] ✅ Avatar IDs normalized:", avatarIds.length, "IDs");
      } catch (error) {
        console.error("[ai-generation] ❌ Avatar ID mapping failed:", error);
        throw error; // Hard-fail as per spec
      }

      const storyOutcome = await generateEnhancedStoryWithOpenAI(
        req.config,
        req.avatarDetails,
        QUALITY_CONFIG.MAX_RETRIES
      );

      metadata.tokensUsed = storyOutcome.usage ?? {
        prompt: 0,
        completion: 0,
        total: 0,
      };

      const outputTokens = metadata.tokensUsed.completion;
      metadata.totalCost.text =
        (metadata.tokensUsed.prompt / 1_000_000) * selectedModel.inputCostPer1M +
        (outputTokens / 1_000_000) * selectedModel.outputCostPer1M;

      // DEBUG: Log chapter structure before cleanup
      console.log(`[ai-generation] 🔍 Story chapters before cleanup:`, {
        chapterCount: storyOutcome.story.chapters?.length ?? 0,
        chapters: storyOutcome.story.chapters?.map((ch: any, idx: number) => ({
          index: idx,
          hasTitle: !!ch?.title,
          titleLength: ch?.title?.length ?? 0,
          hasContent: !!ch?.content,
          contentLength: ch?.content?.length ?? 0,
          contentPreview: ch?.content?.substring(0, 100) ?? "EMPTY"
        }))
      });

      // CLEANUP: Remove only truly empty chapters (no title AND no content)
      // Keep chapters with at least a title, even if content is short
      if (storyOutcome.story.chapters) {
        const originalCount = storyOutcome.story.chapters.length;
        storyOutcome.story.chapters = storyOutcome.story.chapters.filter((ch: any) => 
          ch && (ch.title?.trim() || ch.content?.trim())
        );
        const removedCount = originalCount - storyOutcome.story.chapters.length;
        console.log(`[ai-generation] ✂️ Cleaned chapters: ${storyOutcome.story.chapters.length} valid, ${removedCount} removed`);
        
        // Ensure all chapters have an 'order' field (validator requires it)
        storyOutcome.story.chapters = storyOutcome.story.chapters.map((ch: any, idx: number) => ({
          ...ch,
          order: ch.order ?? idx
        }));
      }

      // Ensure description is max 500 characters (validator requirement)
      if (storyOutcome.story.description && storyOutcome.story.description.length > 500) {
        storyOutcome.story.description = storyOutcome.story.description.substring(0, 497) + '...';
        console.log('[ai-generation] ✂️ Description truncated to 500 characters');
      }

      enforceAvatarDevelopments(storyOutcome.story, req.avatarDetails);

      // VALIDATION DISABLED (2025-10-27): Removing validate_story_response MCP call to reduce token overhead
      // Use story directly without external validation
      const normalizedStory = storyOutcome.story;
      enforceAvatarDevelopments(normalizedStory, req.avatarDetails);
      if (!Array.isArray((normalizedStory as any).supportingCharacters)) {
        (normalizedStory as any).supportingCharacters = [];
      }
      if (
        !normalizedStory.recurringElement ||
        typeof normalizedStory.recurringElement !== "object"
      ) {
        (normalizedStory as any).recurringElement = {
          name: "",
          description: "",
          payoffChapter: 0,
        };
      }
      if (!Array.isArray((normalizedStory as any).plotBeats)) {
        (normalizedStory as any).plotBeats = [];
      }

      const avatarProfilesByName: Record<string, AvatarVisualProfile> = {};
      storyOutcome.state.avatarProfilesByName.forEach((profile, name) => {
        avatarProfilesByName[name] = profile;
      });

      // KRITISCH: Prüfe ob ALLE Avatare ein visualProfile haben
      const missingProfiles = req.avatarDetails.filter((av: any) => !avatarProfilesByName[av.name]);
      
      if (Object.keys(avatarProfilesByName).length === 0) {
        console.warn("[ai-generation] ⚠️ Keine Avatarprofile über Tool-Aufrufe erhalten – Fallback auf direkten DB-Aufruf.");
        const fallbackProfiles = await getAvatarProfilesFromDB(avatarIds);
        (fallbackProfiles as McpAvatarProfile[] | undefined)?.forEach((profile) => {
          if (profile?.name && profile.visualProfile) {
            avatarProfilesByName[profile.name] = profile.visualProfile;
          }
        });
      } else if (missingProfiles.length > 0) {
        console.warn(`[ai-generation] ${missingProfiles.length} Avatare ohne visualProfile erkannt:`, missingProfiles.map((a: any) => a.name));
        
        // OPTIMIZATION v1.0: Use createFallbackProfile function
        missingProfiles.forEach((avatar: any) => {
          console.log(`[ai-generation] Erstelle Fallback-Profil für Avatar "${avatar.name}"`);
          
          const fallbackProfile = createFallbackProfile(avatar);
          avatarProfilesByName[avatar.name] = fallbackProfile;
          
          console.log(`[ai-generation] ✅ Fallback-Profil für "${avatar.name}" erstellt (v${fallbackProfile.version}, hash: ${fallbackProfile.hash.substring(0, 8)})`);
        });
      }

      console.log(`[ai-generation] Avatar profiles verfügbar:`, {
        count: Object.keys(avatarProfilesByName).length,
        names: Object.keys(avatarProfilesByName),
        requestedAvatarIds: avatarIds,
      });

      // OPTIMIZATION v1.0: Upgrade profiles with versioning and prepare for CHARACTER-BLOCKS
      const versionedProfiles: Record<string, MinimalAvatarProfile> = {};

      Object.entries(avatarProfilesByName).forEach(([name, profile]) => {
        const versioned = upgradeProfileWithVersion(profile);
        versionedProfiles[name] = versioned;
      });

      // OPTIMIZATION v3.0: Create story consistency system for character identity preservation
      const storyTitle = normalizedStory.title || 'Untitled Story';
      const avatarDataForConsistency = Object.entries(versionedProfiles).map(([name, profile]) => ({
        name,
        visualProfile: profile as unknown as AvatarVisualProfile,
      }));
      const storyConsistency = createStoryConsistency(
        storyTitle,
        avatarDataForConsistency,
        req.config.ageGroup || '6-8',
        TALEA_DEFAULT_STYLE
      );

      // Log consistency system status for debugging
      logConsistencyStatus(storyConsistency);

      // CRITICAL FIX: Use SAME seed for ALL images in this story for character consistency
      const seedBase = storyConsistency.baseSeed;
      console.log(`[ai-generation] 🎯 Using consistent seed base: ${seedBase} for all story images`);

      const coverDimensions = normalizeRunwareDimensions(1024, 1024);
      const chapterDimensions = normalizeRunwareDimensions(1024, 1024);

      // OPTIMIZATION v3.0: Build character-first block that will be prepended to ALL prompts
      const characterFirstBlock = buildCharacterFirstBlock(
        storyConsistency.characters,
        storyConsistency.lockedStyle
      );
      console.log(`[ai-generation] 📋 Character-first block created (${characterFirstBlock.length} chars)`);

      // COVER IMAGE GENERATION with CHARACTER-BLOCKS
      const coverImageDescription =
        typeof normalizedStory.coverImageDescription === "object"
          ? (normalizedStory.coverImageDescription as ChapterImageDescription)
          : undefined;

      const firstChapterImageDescription =
        typeof normalizedStory.chapters?.[0]?.imageDescription === "object"
          ? (normalizedStory.chapters?.[0]?.imageDescription as ChapterImageDescription)
          : undefined;

      const coverContext = extractImagePromptContext(coverImageDescription);
      const firstChapterContext = extractImagePromptContext(firstChapterImageDescription);

      let safeCoverSceneText = safeCoverScene(
        coverContext.summary,
        firstChapterContext.summary
      );

      if (coverContext.protagonistLines.length > 0) {
        safeCoverSceneText += " Protagonists: " + coverContext.protagonistLines.join(" | ");
      }
      if (coverContext.supportingLines.length > 0) {
        safeCoverSceneText += " Supporting: " + coverContext.supportingLines.join(" | ");
      }

      const coverCharactersData = Object.entries(versionedProfiles).map(([name, profile]) => ({
        name,
        profile,
        sceneDetails: {
          position: "foreground",
          pose: "friendly, welcoming",
        },
      }));

      const coverPrompts = buildCompleteImagePrompt({
        characters: coverCharactersData,
        scene: safeCoverSceneText,
        customStyle: {
          composition: "story cover, title space top, all visible",
          style: "watercolor cover, warm colors",
          quality: `${coverCharactersData.length} subjects, child-safe`,
        },
        supportingCharacterLines: coverContext.supportingLines,
        environmentLayers: coverContext.environmentLayers,
        props: coverContext.props,
        atmosphereLines: coverContext.atmosphereLines,
        recurringElementNote: coverContext.recurringElementNote,
        storytellingDetails: coverContext.storytellingDetails,
      });

      // OPTIMIZATION v3.0: Prepend character-first block to cover prompt
      const coverPromptWithCharacterFirst = `${characterFirstBlock}\n\n${coverPrompts.positivePrompt}`;
      const coverPromptNormalized = normalizeLanguage(coverPromptWithCharacterFirst);
      const coverPromptClamped = clampRunwarePrompt(coverPromptNormalized, 3200); // Increased limit for character block
      const coverNegativePromptNormalized = normalizeLanguage(coverPrompts.negativePrompt);

      console.log("[ai-generation] 📸 Generating COVER image with CHARACTER-FIRST prompt structure");
      console.log("[ai-generation] Cover positive prompt length:", coverPromptNormalized.length);
      if (coverPromptClamped.length !== coverPromptNormalized.length) {
        console.log("[ai-generation] Cover positive prompt clamped to length:", coverPromptClamped.length);
      }
      console.log("[ai-generation] Cover negative prompt length:", coverNegativePromptNormalized.length);
      console.log("[ai-generation] Using seed:", seedBase);

      // OPTIMIZATION v4.0: Use runware:400@4 with optimized parameters
      const coverResponse = await ai.generateImage({
        prompt: coverPromptClamped,
        negativePrompt: coverNegativePromptNormalized,
        model: "runware:400@4",
        width: coverDimensions.width,
        height: coverDimensions.height,
        steps: 4,     // runware:400@4 uses fewer steps
        CFGScale: 4,
        seed: seedBase,
        outputFormat: "JPEG",
      });

      // CHAPTER IMAGES GENERATION with CHARACTER-BLOCKS
      const chapterResponses: Array<{ imageUrl?: string }> = [];
      for (let i = 0; i < normalizedStory.chapters.length; i++) {
        const chapter = normalizedStory.chapters[i];
        const chapterImageDescription =
          typeof chapter.imageDescription === "object"
            ? (chapter.imageDescription as ChapterImageDescription)
            : undefined;

        const chapterContext = extractImagePromptContext(chapterImageDescription);

        let chapterSceneText =
          typeof chapter.imageDescription === "string"
            ? chapter.imageDescription
            : chapterContext.summary;

        if (chapterContext.protagonistLines.length > 0) {
          chapterSceneText += " Protagonists: " + chapterContext.protagonistLines.join(" | ");
        }
        if (chapterContext.supportingLines.length > 0) {
          chapterSceneText += " Supporting: " + chapterContext.supportingLines.join(" | ");
        }

        const chapterCharactersData = Object.entries(versionedProfiles).map(([name, profile]) => ({
          name,
          profile,
          sceneDetails: {},
        }));

        const chapterPrompts = buildCompleteImagePrompt({
          characters: chapterCharactersData,
          scene: chapterSceneText,
          supportingCharacterLines: chapterContext.supportingLines,
          environmentLayers: chapterContext.environmentLayers,
          props: chapterContext.props,
          atmosphereLines: chapterContext.atmosphereLines,
          recurringElementNote: chapterContext.recurringElementNote,
          storytellingDetails: chapterContext.storytellingDetails,
        });

        // OPTIMIZATION v3.0: Prepend character-first block to chapter prompt
        const chapterPromptWithCharacterFirst = `${characterFirstBlock}\n\n${chapterPrompts.positivePrompt}`;
        const chapterPromptNormalized = normalizeLanguage(chapterPromptWithCharacterFirst);
        const chapterPromptClamped = clampRunwarePrompt(chapterPromptNormalized, 3200); // Increased limit
        const chapterNegativePromptNormalized = normalizeLanguage(chapterPrompts.negativePrompt);

        // CRITICAL FIX v3.0: Use SAME base seed for character consistency
        // Small offset (i * 3) provides scene variation while maintaining character identity
        const chapterSeed = (seedBase + i * 3) >>> 0;

        console.log(`[ai-generation] 📸 Generating Chapter ${i + 1} with CHARACTER-FIRST structure`);
        console.log(`[ai-generation] Chapter ${i + 1} positive prompt length:`, chapterPromptNormalized.length);
        if (chapterPromptClamped.length !== chapterPromptNormalized.length) {
          console.log(`[ai-generation] Chapter ${i + 1} positive prompt clamped to:`, chapterPromptClamped.length);
        }
        console.log(`[ai-generation] Chapter ${i + 1} seed:`, chapterSeed);

        // OPTIMIZATION v4.0: Use runware:400@4 with optimized parameters
        const chapterResponse = await ai.generateImage({
          prompt: chapterPromptClamped,
          negativePrompt: chapterNegativePromptNormalized,
          model: "runware:400@4",
          width: chapterDimensions.width,
          height: chapterDimensions.height,
          steps: 4,     // runware:400@4 uses fewer steps
          CFGScale: 4,
          seed: chapterSeed,
          outputFormat: "JPEG",
        });

        chapterResponses.push(chapterResponse);
        await new Promise((resolve) => setTimeout(resolve, 750));
      }

      const chaptersWithImages = normalizedStory.chapters.map((chapter: any, index: number) => ({
        ...chapter,
        imageUrl: chapterResponses[index]?.imageUrl || "",
      }));

      metadata.imagesGenerated = 1 + chapterResponses.length;
      metadata.totalCost.images = metadata.imagesGenerated * 0.0008;
      metadata.totalCost.total = metadata.totalCost.text + metadata.totalCost.images;
      metadata.processingTime = Date.now() - startTime;

      // OPTIMIZATION v1.0: Enhanced telemetry logging
      const telemetry = createTelemetry({
        correlationId: crypto.randomUUID(),
        storyId: normalizedStory.title,
        avatarIds,
        profileHashes: Object.fromEntries(
          Object.entries(versionedProfiles).map(([name, profile]) => [name, profile.hash])
        ),
        profileVersions: Object.fromEntries(
          Object.entries(versionedProfiles).map(([name, profile]) => [name, profile.version])
        ),
        positivePrompt: coverPromptNormalized.substring(0, 500), // First 500 chars
        negativePrompt: "",
        seed: seedBase,
        cfg: 4,
        steps: 4,  // runware:400@4
        generationMs: metadata.processingTime,
      });

      console.log("[ai-generation] 📊 Telemetry:", {
        correlationId: telemetry.correlationId,
        avatarCount: avatarIds.length,
        profileHashes: Object.keys(telemetry.profileHashes).length,
        imagesGenerated: metadata.imagesGenerated,
        totalCost: metadata.totalCost.total.toFixed(4),
        processingTimeSeconds: (metadata.processingTime / 1000).toFixed(1),
      });

      // Log to database for analytics (telemetry embedded in request/response)
      await publishWithTimeout(logTopic, {
        source: 'openai-story-generation',
        timestamp: new Date(),
        request: {
          avatarIds,
          profileHashes: telemetry.profileHashes,
          profileVersions: telemetry.profileVersions,
          seed: telemetry.seed,
          cfg: telemetry.cfg,
          steps: telemetry.steps,
        },
        response: {
          imagesGenerated: metadata.imagesGenerated,
          processingTime: metadata.processingTime,
          totalCost: metadata.totalCost,
          correlationId: telemetry.correlationId,
        },
      });

      return {
        title: normalizedStory.title,
        description: normalizedStory.description,
        coverImageUrl: coverResponse.imageUrl,
        coverImageDescription: normalizedStory.coverImageDescription,
        supportingCharacters: normalizedStory.supportingCharacters,
        recurringElement: normalizedStory.recurringElement,
        plotBeats: normalizedStory.plotBeats,
        chapters: chaptersWithImages,
        avatarDevelopments: normalizedStory.avatarDevelopments,
        learningOutcomes: normalizedStory.learningOutcomes,
        metadata,
      };
    } catch (error) {
      metadata.processingTime = Date.now() - startTime;
      console.error("[ai-generation] MCP story generation failed:", error);
      throw new Error(
        `Story generation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
);

interface UsageTotals {
  prompt: number;
  completion: number;
  total: number;
  inputCostUSD?: number;
  outputCostUSD?: number;
  totalCostUSD?: number;
  modelUsed?: string;
}

interface StoryToolState {
  avatarProfilesById: Map<string, AvatarVisualProfile>;
  avatarProfilesByName: Map<string, AvatarVisualProfile>;
  compressedProfilesById: Map<string, Record<string, unknown>>;
  avatarMemoriesById: Map<string, McpAvatarMemory[]>;
  compressedMemoriesById: Map<string, unknown[]>;
  validatorFailures: number;
  validationResult?: ValidationResult;
}

interface StoryToolOutcome {
  story: {
    title: string;
    description: string;
    supportingCharacters: SupportingCharacterSummary[];
    recurringElement: StoryRecurringElement;
    plotBeats: ChapterBeatSummary[];
    chapters: (Omit<Chapter, "id" | "imageUrl"> & {
      imageDescription: ChapterImageDescription;
      beatSummary?: ChapterBeatSummary;
    })[];
    coverImageDescription: CoverImageDescription;
    avatarDevelopments: AvatarDevelopment[];
    learningOutcomes: LearningOutcome[];
    newlyGeneratedCharacters?: Array<{
      id: string;
      name: string;
      role: string;
      species: string;
      gender: string;
    }>;
  };
  usage: UsageTotals;
  state: StoryToolState;
  finalRequest: any;
  finalResponse: any;
}

// OPTIMIERT: Reduziert Memories von 3 auf 1 und Descriptors von 6 auf 4 für Token-Einsparung
const MAX_TOOL_MEMORIES = 1;
const MAX_DESCRIPTOR_COUNT = 4;

function compressVisualProfile(profile: AvatarVisualProfile) {
  return {
    ageApprox: profile.ageApprox,
    gender: profile.gender,
    hair: profile.hair
      ? {
          color: profile.hair.color,
          style: profile.hair.style,
          length: profile.hair.length,
        }
      : undefined,
    eyes: profile.eyes
      ? {
          color: profile.eyes.color,
          shape: profile.eyes.shape,
        }
      : undefined,
    skin: profile.skin
      ? {
          tone: profile.skin.tone,
          distinctiveFeatures: profile.skin.distinctiveFeatures?.slice(0, 2),
        }
      : undefined,
    clothing: profile.clothingCanonical,
    keyDescriptors: profile.consistentDescriptors?.slice(0, MAX_DESCRIPTOR_COUNT),
  };
}

function summarizeTraitChanges(changes: Array<{ trait: string; change: number }>) {
  if (!Array.isArray(changes) || changes.length === 0) {
    return undefined;
  }
  return changes.slice(0, 4).map((change) => ({
    trait: change.trait,
    change: change.change,
  }));
}

function compressMemories(memories: McpAvatarMemory[]) {
  if (!Array.isArray(memories) || memories.length === 0) {
    return [];
  }

  const sorted = [...memories].sort((a, b) => {
    const aDate = Date.parse(a.createdAt ?? "");
    const bDate = Date.parse(b.createdAt ?? "");
    if (Number.isNaN(aDate) || Number.isNaN(bDate)) {
      return 0;
    }
    return bDate - aDate;
  });

  // OPTIMIERT: Kürzere Memory-Beschreibungen für Token-Einsparung
  return sorted.slice(0, MAX_TOOL_MEMORIES).map((memory) => ({
    storyTitle: memory.storyTitle,
    // Kürze experience auf max 100 Zeichen
    experience: memory.experience?.substring(0, 100) || "",
    emotionalImpact: memory.emotionalImpact,
    personalityChanges: summarizeTraitChanges(memory.personalityChanges || []),
  }));
}

function normalizeTraitChanges(changes: any): Array<{ trait: string; change: number }> {
  if (!Array.isArray(changes)) {
    return [];
  }

  return changes
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const trait =
        typeof entry.trait === "string" && entry.trait.trim().length > 0
          ? entry.trait.trim()
          : "";
      const rawChange =
        typeof entry.change === "number"
          ? entry.change
          : typeof entry.change === "string"
            ? Number(entry.change)
            : NaN;

      if (!trait || !Number.isFinite(rawChange)) {
        return null;
      }

      return { trait, change: rawChange };
    })
    .filter((entry): entry is { trait: string; change: number } => entry !== null);
}

function enforceAvatarDevelopments(
  story: any,
  avatars: Array<{ name: string }>
): void {
  if (!story || typeof story !== "object" || !Array.isArray(avatars)) {
    return;
  }

  const requiredNames: string[] = [];
  const seenNames = new Set<string>();
  avatars.forEach((avatar) => {
    if (typeof avatar?.name !== "string") {
      return;
    }
    const trimmed = avatar.name.trim();
    if (!trimmed) {
      return;
    }
    const key = trimmed.toLowerCase();
    if (seenNames.has(key)) {
      return;
    }
    seenNames.add(key);
    requiredNames.push(trimmed);
  });

  const provided = Array.isArray(story.avatarDevelopments)
    ? story.avatarDevelopments
    : [];

  const byName = new Map<string, { name: string; changedTraits: Array<{ trait: string; change: number }> }>();

  for (const entry of provided) {
    if (!entry || typeof entry !== "object") continue;
    const providedName =
      typeof entry.name === "string" && entry.name.trim().length > 0
        ? entry.name.trim()
        : undefined;
    if (!providedName) continue;

    const key = providedName.toLowerCase();
    if (byName.has(key)) {
      continue;
    }
    byName.set(key, {
      name: providedName,
      changedTraits: normalizeTraitChanges(entry.changedTraits),
    });
  }

  const enforced = requiredNames.map((name) => {
    const key = name.toLowerCase();
    const existing = byName.get(key);
    if (existing) {
      return {
        name,
        changedTraits: existing.changedTraits,
      };
    }
    return {
      name,
      changedTraits: [],
    };
  });

  story.avatarDevelopments = enforced;
  console.log("[ai-generation] Enforced avatar developments:", enforced);
}

interface StoryValidationResult {
  isValid: boolean;
  score: number;
  issues: string[];
  suggestions: string[];
}

function validateGeneratedStory(
  story: any,
  avatars: ExtendedAvatarDetails[],
  config?: StoryConfig
): StoryValidationResult {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 10;

  const avatarNames = avatars.map(a => a.name.toLowerCase());
  const chapters = Array.isArray(story?.chapters) ? story.chapters : [];

  for (const chapter of chapters) {
    const content = String(chapter?.content || chapter?.text || "").toLowerCase();
    const missingCharacters = avatarNames.filter(name => !content.includes(name));
    if (missingCharacters.length > 0) {
      issues.push(`Kapitel "${chapter?.title || "?"}": Fehlende Charaktere: ${missingCharacters.join(", ")}`);
      score -= 0.5 * missingCharacters.length;
    }
  }

  const fullText = chapters.map((c: any) => String(c?.content || c?.text || "")).join(" ");
  for (const pattern of QUALITY_CONFIG.FORBIDDEN_PATTERNS) {
    if (pattern.test(fullText)) {
      issues.push(`Verbotenes Muster gefunden: ${pattern}`);
      score -= 0.3;
    }
  }

  for (const chapter of chapters) {
    const wordCount = String(chapter?.content || chapter?.text || "").trim().split(/\s+/).filter(Boolean).length;
    if (wordCount < QUALITY_CONFIG.MIN_CHAPTER_WORDS) {
      issues.push(`Kapitel "${chapter?.title || "?"}" ist zu kurz (${wordCount} Woerter, min. ${QUALITY_CONFIG.MIN_CHAPTER_WORDS})`);
      score -= 0.3;
    }
  }

  if (chapters.length > 0) {
    const lastChapter = chapters[chapters.length - 1];
    const lastText = String(lastChapter?.content || lastChapter?.text || "").trim();
    const hasProperEnding = /[.!?]$/.test(lastText);
    const hasEmotionalClosure = /(laechelte|freute|gluecklich|warm|zusammen|freunde)/i.test(lastText);

    if (!hasProperEnding) {
      issues.push("Letztes Kapitel endet abrupt");
      score -= 0.5;
    }
    if (!hasEmotionalClosure) {
      suggestions.push("Fuege einen waermeren, emotionaleren Abschluss hinzu");
      score -= 0.2;
    }
  }

  const hasRiddle = /(raetsel|rätsel|geheimnis|versteckt)/i.test(fullText);
  const hasResolution = /(loesung|lösung|gefunden|entdeckt|geloest|gelöst)/i.test(fullText);
  if (hasRiddle && !hasResolution) {
    issues.push("Ein Raetsel wird erwaehnt aber nicht geloest");
    score -= 1.0;
  }

  if (config?.ageGroup) {
    const sentences = fullText.split(/[.!?]+/).map((s: string) => s.trim()).filter(Boolean);
    const wordCount = fullText.trim().split(/\s+/).filter(Boolean).length;
    const avgSentenceLength = sentences.length > 0 ? wordCount / sentences.length : wordCount;
    const range = QUALITY_CONFIG.AVG_SENTENCE_LENGTH[config.ageGroup as keyof typeof QUALITY_CONFIG.AVG_SENTENCE_LENGTH];
    if (range && (avgSentenceLength < range.min || avgSentenceLength > range.max)) {
      suggestions.push(`Satzlaenge variieren (aktuell ~${avgSentenceLength.toFixed(1)} Woerter/Satz)`);
      score -= 0.2;
    }
  }

  return {
    isValid: score >= QUALITY_CONFIG.MIN_ACCEPTABLE_SCORE,
    score: Math.max(0, Math.min(10, score)),
    issues,
    suggestions,
  };
}

function getCharacterVoice(traits: Record<string, any> | undefined): string {
  if (!traits) return "spricht freundlich und neugierig";

  const getTraitValue = (t: any): number => typeof t === "object" && t !== null ? (t.value ?? 0) : (t ?? 0);
  const courage = getTraitValue(traits.courage) || 50;
  const humor = getTraitValue(traits.humor) || 50;
  const intelligence = getTraitValue(traits.intelligence) || 50;

  const voice: string[] = [];
  if (courage > 70) voice.push("spricht mutig und direkt");
  else if (courage < 30) voice.push("spricht vorsichtig und fragt oft nach");

  if (humor > 70) voice.push("macht Witze");
  else if (humor < 30) voice.push("ist ernst und nachdenklich");

  if (intelligence > 70) voice.push("benutzt manchmal schwierige Woerter");

  return voice.length > 0 ? voice.join(", ") : "spricht natuerlich und kindgerecht";
}

function getGenreGuidance(genre: string): string {
  const guidance: Record<string, string> = {
    fairy_tales: [
      "- Klassische Maerchenelemente: Zauberei, sprechende Tiere, versteckte Schaetze",
      "- Klare Gut/Boese-Unterscheidung (aber Boeses nicht zu beaengstigend)",
      "- Dreier-Regel: 3 Versuche, 3 Aufgaben, 3 Helfer",
      "- Happy End ist Pflicht",
    ].join("\n"),
    adventure: [
      "- Spannende Entdeckungen an jedem Kapitelende",
      "- Koerperliche Herausforderungen, die geloest werden",
      "- Mutproben mit positivem Ausgang",
      "- Teamwork ist der Schluessel zum Erfolg",
    ].join("\n"),
    mystery: [
      "- Hinweise muessen fair sein (Leser koennte es erraten)",
      "- Keine zu gruseligen Elemente",
      "- Logische Aufloesung (kein Zufall)",
      "- Alle verdaechtigen Momente werden erklaert",
    ].join("\n"),
    educational: [
      "- Fakten nahtlos in Handlung einweben",
      "- Neugier der Charaktere treibt Lernen an",
      "- \"Aha!\"-Momente fuer Charaktere UND Leser",
      "- Wissen hilft bei der Problemloesung",
    ].join("\n"),
  };

  return guidance[genre] || guidance.fairy_tales;
}

function getSettingAtmosphere(setting: string): string {
  const atmospheres: Record<string, string> = {
    castle: "Steinerne Mauern mit Echos, Fackellicht, versteckte Gaenge, Ritterruestungen",
    forest: "Raschelnde Blaetter, Vogelgesang, Moos und Pilze, geheime Lichtungen",
    village: "Kopfsteinpflaster, Marktplatz-Geraeuche, freundliche Nachbarn, alte Brunnen",
    underwater: "Schimmerndes Licht von oben, Luftblasen, bunte Fische, Korallenburgen",
    sky: "Wolkenformationen, Wind in den Haaren, weite Sicht, Voegel als Begleiter",
  };

  return atmospheres[setting] || "Beschreibe eine kindgerechte, einladende Umgebung mit vielen sensorischen Details";
}

function getPersonalityUpdateInstructions(): string {
  return `
Analysiere die generierte Geschichte und bestimme Charakterentwicklungen:

**BASIS-MERKMALE** (verwende exakte IDs, 1-5 Punkte):
courage, creativity, vocabulary, curiosity, teamwork, empathy, persistence, logic

**WICHTIG: KEIN "knowledge" oder "knowledge.*" vergeben!**
Wissen wird ausschließlich durch Doku-Lektüre erworben, NICHT durch Geschichten.

**REGELN:**
- Nur Merkmale vergeben, die in der Geschichte AKTIV gezeigt werden
- Hauptcharaktere: 2-4 Merkmale
- Nebencharaktere: 1-2 Merkmale
- Begruendung muss sich auf konkrete Szene beziehen
- KEINE dieser Merkmale verwenden: intelligence, strength, humor, adventure, patience, leadership, wisdom, kindness, determination

**FORMAT:**
"avatarDevelopments": [
  {
    "avatarId": "ID",
    "name": "Name",
    "changedTraits": {
      "courage": { "before": 50, "after": 53, "reason": "Hat sich dem dunklen Keller gestellt" }
    },
    "memoryAdditions": {
      "experiences": ["Hat das Brunnenraetsel geloest"],
      "relationships": { "Adrian": "Vertraut ihm jetzt mehr" }
    }
  }
]`;
}

function buildEnhancedUserPrompt(
  config: StoryConfig,
  avatars: ExtendedAvatarDetails[],
  chapterCount: number,
  qualityFeedback?: string
): string {
  const characterProfiles = avatars.map((avatar, index) => {
    const role = index === 0 ? "HAUPTCHARAKTER" : index === 1 ? "WICHTIGER NEBENCHARAKTER" : "UNTERSTUETZENDER CHARAKTER";
    const personalityTraits = (avatar.personalityTraits || {}) as Record<string, any>;
    const topTraits = Object.entries(personalityTraits)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 3)
      .map(([trait, value]) => `${trait} (${value}/100)`)
      .join(", ");

    return `
### ${avatar.name} [${role}]
- Beschreibung: ${avatar.description || "Ein Kind"}
- Persoenlichkeit: ${topTraits || "neugierig, freundlich"}
- Besonderheit: Nutze ein konkretes, einzigartiges Merkmal im Plot
- Sprechweise: ${getCharacterVoice(personalityTraits)}`.trim();
  }).join("\n\n");

  const genreGuidance = getGenreGuidance(config.genre);
  const settingAtmosphere = getSettingAtmosphere(config.setting);

  const outputSchema = `{
  "title": "Titel der Geschichte",
  "description": "2-3 Saetze Zusammenfassung",
  "centralProblem": "Das zentrale Problem, das geloest wird",
  "supportingCharacters": [
    { "name": "Name", "role": "Rolle", "personality": "Eigenschaft", "appearance": "Aussehen", "motivation": "Motivation" }
  ],
  "recurringElement": { "name": "Element", "description": "Beschreibung", "payoffChapter": 5 },
  "plotBeats": [
    { "order": 1, "focus": "Fokus", "conflict": "Konflikt", "surprise": "Ueberraschung", "supportingCast": [], "environmentHighlights": [], "cliffhanger": "", "sensoryDetails": [] }
  ],
  "chapters": [
    {
      "title": "Kapiteltitel",
      "content": "Kapiteltext (mind. ${QUALITY_CONFIG.MIN_CHAPTER_WORDS} Woerter)",
      "order": 1,
      "charactersPresent": ["Name1", "Name2"],
      "plotPoints": ["Was passiert", "Was wird geloest"],
      "imageDescription": {
        "scene": "Scene summary (ENGLISH)",
        "characters": {
          "protagonists": [ { "name": "Name", "action": "action", "expression": "expression", "position": "position", "pose": "pose" } ],
          "supporting": [ { "name": "Name", "action": "action", "expression": "expression", "position": "position", "pose": "pose" } ]
        },
        "environment": { "foreground": [], "midground": [], "background": [] },
        "props": [],
        "atmosphere": { "weather": "", "lighting": "", "season": "", "mood": "", "sensoryDetails": [] },
        "composition": { "camera": "", "perspective": "", "focalPoints": [], "depth": "" },
        "recurringElement": "",
        "storytellingDetails": []
      }
    }
  ],
  "coverImageDescription": { "scene": "", "characters": { "protagonists": [], "supporting": [] }, "environment": { "foreground": [], "midground": [], "background": [] }, "props": [], "atmosphere": { "weather": "", "lighting": "", "season": "", "mood": "", "sensoryDetails": [] }, "composition": { "camera": "", "perspective": "", "focalPoints": [], "depth": "" }, "storytellingDetails": [] },
  "avatarDevelopments": [],
  "learningOutcomes": []
}`;

  return `
## GESCHICHTE ERSTELLEN

### GRUNDDATEN
- Genre: ${config.genre}
- Setting: ${config.setting}
- Altersgruppe: ${config.ageGroup}
- Kapitelanzahl: ${chapterCount}
- Komplexitaet: ${config.complexity}

### CHARAKTERE (ALLE MUESSEN VORKOMMEN)
${characterProfiles}

### BEZIEHUNGSDYNAMIK
- Wer fuehrt Entscheidungen an?
- Wer hat kreative Ideen?
- Wer ist vorsichtig und warnt?
- Wie ergaenzen sie sich?

### GENRE-ANFORDERUNGEN
${genreGuidance}

### SETTING-ATMOSPHAERE
${settingAtmosphere}

### PLOT-ANFORDERUNGEN (KRITISCH)
1. Zentrales Problem: Definiere EIN klares, konkretes Problem, das geloest werden muss
2. Raetsel: Wenn eingefuehrt, muss die Loesung in Kapitel ${Math.ceil(chapterCount * 0.7)} erscheinen
3. Gegenstaende: Jeder wichtige Gegenstand mindestens 2x
4. Charaktere: Alle genannten Charaktere in jedem Kapitel aktiv handeln oder sprechen

${config.customPrompt ? `### ZUSAETZLICHE VORGABEN\n${config.customPrompt}\n` : ""}

${qualityFeedback ? `### FEEDBACK AUS LETZTEM VERSUCH\n${qualityFeedback}\n` : ""}

### AUSGABE-FORMAT
Gib NUR valides JSON zurueck:
${outputSchema}

### WICHTIG
- imageDescription Felder muessen auf ENGLISCH sein (alle anderen Felder auf Deutsch).

### PERSOENLICHKEITS-UPDATE-SYSTEM
${getPersonalityUpdateInstructions()}
`;
}

async function generateEnhancedStoryWithOpenAI(
  config: StoryConfig,
  avatars: ExtendedAvatarDetails[],
  maxRetries: number = QUALITY_CONFIG.MAX_RETRIES
): Promise<StoryToolOutcome> {
  let attempt = 0;
  let bestResult: StoryToolOutcome | null = null;
  let bestScore = 0;
  let feedback: string | undefined;

  while (attempt < maxRetries) {
    attempt += 1;
    console.log(`[ai-generation] Story attempt ${attempt}/${maxRetries}`);
    const result = await generateStoryWithOpenAITools({ config, avatars, qualityFeedback: feedback });
    const validation = validateGeneratedStory(result.story, avatars, config);
    console.log(`[ai-generation] Quality score: ${validation.score}/10`);
    if (validation.issues.length > 0) {
      console.log(`[ai-generation] Issues: ${validation.issues.join("; ")}`);
    }
    if (validation.score > bestScore) {
      bestResult = result;
      bestScore = validation.score;
    }
    const acceptScore = Math.min(QUALITY_CONFIG.TARGET_SCORE, 8.5);
    if (validation.score >= acceptScore) {
      console.log(`[ai-generation] Quality acceptable (${validation.score}/10)`);
      return result;
    }
    feedback = [
      validation.issues.length > 0 ? `Issues: ${validation.issues.join("; ")}` : "",
      validation.suggestions.length > 0 ? `Suggestions: ${validation.suggestions.join("; ")}` : "",
    ].filter(Boolean).join("\n");
  }

  console.log(`[ai-generation] Max retries reached, using best result (score ${bestScore}/10)`);
  if (bestResult) return bestResult;
  return generateStoryWithOpenAITools({ config, avatars });
}

async function generateStoryWithOpenAITools(args: {
  config: StoryConfig;
  avatars: ExtendedAvatarDetails[];
  qualityFeedback?: string;
}): Promise<StoryToolOutcome> {
  const { config, avatars } = args;

  // Select model configuration
  const modelKey = config.aiModel || DEFAULT_MODEL;
  const modelConfig = MODEL_CONFIGS[modelKey] || MODEL_CONFIGS[DEFAULT_MODEL];
  console.log(`[ai-generation] 🤖 Using model: ${modelConfig.name} (Input: $${modelConfig.inputCostPer1M}/1M, Output: $${modelConfig.outputCostPer1M}/1M)`);

  const chapterCount =
    config.length === "short" ? 3 : config.length === "medium" ? 5 : 8;

  // OPTIMIZED v2.1: 3x längere Kapitel für mehr Tiefe
  const targetWordsPerChapter =
    config.ageGroup === "3-5" ? 270 : config.ageGroup === "6-8" ? 330 : 450;
  const minWordsPerChapter = Math.max(QUALITY_CONFIG.MIN_CHAPTER_WORDS, targetWordsPerChapter - 60);
  const maxWordsPerChapter = Math.min(QUALITY_CONFIG.MAX_CHAPTER_WORDS, targetWordsPerChapter + 60);
  const stylePresetMeta =
    config.stylePreset && STYLE_PRESET_META[config.stylePreset]
      ? STYLE_PRESET_META[config.stylePreset]
      : undefined;
  const systemStyleAddendum = stylePresetMeta
    ? `
⭐ STYLE PRESET (ABSOLUTE PRIORITY):
- INSPIRATION: ${stylePresetMeta.inspiration}
- DESCRIPTION: ${stylePresetMeta.description}
- IMPORTANT: This style MUST be perceptible in EVERY chapter!`
    : "";
  const userStyleAddendum = stylePresetMeta
    ? `
⭐ STYLE PRESET (CRITICALLY IMPORTANT):
INSPIRATION: ${stylePresetMeta.inspiration}
DESCRIPTION: ${stylePresetMeta.description}

You MUST implement this style consistently in ALL chapters!`
    : "";

  const languageDirective =
    config.language === "en"
      ? "Write the entire story in ENGLISH."
      : "Schreibe die gesamte Geschichte auf DEUTSCH.";
  const nonImageLanguage = config.language === "en" ? "English" : "Deutsch";

  const avatarVisualLines = avatars
    .map((avatar) => {
      const vp = avatar.visualProfile as any;
      if (!vp) {
        return "- " + avatar.name + ": no visual profile available";
      }

      const details: string[] = [];

      if (vp.characterType) details.push(String(vp.characterType));
      if (vp.speciesCategory && vp.speciesCategory !== "human") {
        details.push("(" + vp.speciesCategory + ")");
      }
      if (vp.hair?.color) {
        const hairLabel = vp.hair.style || vp.hair.length || "hair";
        details.push((vp.hair.color + " " + hairLabel).trim());
      }
      if (vp.eyes?.color) details.push(vp.eyes.color + " eyes");
      if (vp.skin?.tone) details.push(vp.skin.tone + " skin");
      if (Array.isArray(vp.skin?.distinctiveFeatures)) {
        details.push(...vp.skin.distinctiveFeatures.slice(0, 3));
      }
      if (vp.clothingCanonical?.top) details.push(vp.clothingCanonical.top);
      if (vp.clothingCanonical?.outfit) details.push(vp.clothingCanonical.outfit);
      if (vp.locomotion && vp.locomotion !== "bipedal") {
        details.push(vp.locomotion);
      }

      return "- " + avatar.name + ": " + details.filter(Boolean).join(", ");
    })
    .join("\n");

  const avatarIntegrationExamples = avatars
    .map((avatar) => {
      const vp = avatar.visualProfile as any;
      const examples: string[] = [];

      if (vp?.hair?.color) {
        examples.push(`"${avatar.name} brushes a strand of ${vp.hair.color} hair aside."`);
      }
      if (vp?.eyes?.color) {
        examples.push(`"${avatar.name}'s ${vp.eyes.color} eyes sparkle with curiosity."`);
      }
      if (vp?.clothingCanonical?.top) {
        examples.push(`"The ${vp.clothingCanonical.top} sways as ${avatar.name} turns."`);
      }
      if (vp?.locomotion === "quadruped") {
        examples.push(`"${avatar.name} darts forward on four paws."`);
      }
      if (examples.length === 0) {
        examples.push(`"${avatar.name} reacts vividly to the scene."`);
      }

      return examples.join("\n  ");
    })
    .join("\n");

  const systemPrompt = [
    `Du bist Drehbuchautor fuer Kinderfilme UND Kinderbuchautor mit 30 Jahren Erfahrung, spezialisiert auf Geschichten fuer Kinder im Alter von ${config.ageGroup} Jahren.`,
    "Du denkst in SZENEN: Dialog, Handlung, Reaktion. Deine Geschichten werden DURCH Dialog erzaehlt, nicht durch Beschreibung.",
    "",
    "FUNDAMENTALE ERZAEHLPRINZIPIEN",
    "1) NARRATIVE ARCHITEKTUR (Drei-Akt-Struktur)",
    "- Akt 1 (Kapitel 1-2): Welt, Alltag, und konkretes Problem etablieren.",
    "- Akt 2 (Kapitel 2-4): Steigende Spannung, Hindernisse, Lernen, jede Huerde wird geloest.",
    "- Akt 3 (letztes Kapitel): Klimax und befriedigende Aufloesung. Alle Faden schliessen.",
    "",
    "2) SPRACHQUALITAET",
    "- Saetze: 6-12 Woerter im Durchschnitt, Rhythmus durch Varianz.",
    "- Konkrete Handlungsverben statt Atmosphaere-Beschreibungen: 'knallte', 'riss', 'schnappte' statt 'schimmerte', 'fluesterte', 'wehte'.",
    "- KEINE Vermenschlichung von Natur oder Objekten ('der Wald fluesterte', 'der Wind wollte').",
    "- KEINE Synaesthesie ('Licht schmeckte', 'Stille roch nach').",
    "- KEINE poetischen Metaphern oder Erwachsenen-Bildsprache.",
    "- Keine Passivkonstruktionen, keine abstrakten Begriffe, keine verschachtelten Nebensaetze.",
    "- Dialoge natuerlich, kurz, maximal 2-3 Saetze am Stueck. Mindestens 40% Dialog.",
    "- Keine erfundenen Woerter oder Grammatikfehler.",
    "",
    "3) SHOW, DON'T TELL",
    "- Zeige Gefuehle durch Koerperaktion und Dialog, NIEMALS durch Atmosphaere oder Erklaerung.",
    "- JEDER Absatz muss Handlung oder Dialog enthalten. Keine reinen Beschreibungs-Absaetze.",
    "",
    "4) CHARAKTER-KONSISTENZ",
    "- Jede Figur hat klare Rolle und Persoenlichkeit.",
    "- Keine Figuren tauchen ploetzlich auf oder verschwinden.",
    "- Wenn eingefuehrt, dann in allen Kapiteln oder Verschwinden erklaeren.",
    "",
    "5) PLOT-KOHAERENZ",
    "- Jedes Raetsel wird geloest.",
    "- Wichtige Gegenstaende tauchen mehrfach auf und werden genutzt.",
    "- Keine losen Enden.",
    "",
    "6) EMOTIONALE REISE",
    "- Spannung -> Sorge -> Hoffnung -> Triumph.",
    "- Mindestens ein 'Oh nein!'-Moment und ein 'Juhu!'-Moment.",
    "",
    "KAPITELSTRUKTUR",
    "- Hook im ersten Satz durch HANDLUNG (nicht Beschreibung), Entwicklung, Wendepunkt/Cliffhanger (ausser letztes Kapitel).",
    "- Letztes Kapitel: warmer, runder Abschluss.",
    "",
    "LANGUAGE RULES:",
    "- " + languageDirective,
    "- imageDescription fields must be written in English only; every other field stays in " + nonImageLanguage + ".",
    "",
    "OUTPUT CONTRACT:",
    "- Write the full story before you respond.",
    "- Exactly " + chapterCount + " chapters with " + minWordsPerChapter + "-" + maxWordsPerChapter + " words each (target " + targetWordsPerChapter + ").",
    "- Return a single valid JSON object and nothing else.",
    "",
    "IMAGE DESCRIPTION SPEC (English only):",
    "- Use the structured imageDescription schema in the JSON.",
    "- Use dynamic verbs, list props and environment elements explicitly.",
    "- Human characters must stay fully human (no tails, no animal ears, no fur).",
    "",
    "STYLE AND TONE:",
    "- Dialogreiche, handlungsgetriebene Szenen mit Humor und Spannung.",
    "- Show through ACTION and DIALOGUE: reveal feelings through what characters DO and SAY, never through atmosphere or poetic description.",
    "- FORBIDDEN: personifying nature, mixing senses, poetic metaphors, paragraphs without action or dialogue.",
    systemStyleAddendum,
    "",
    "QUALITY CHECK:",
    "- Continuity on items, places, supporting cast, and recurring elements.",
    "- Chapters 1-" + (chapterCount - 1) + " end with a hook; final chapter resolves the adventure.",
    "- Dialogue must be at least 40% of all text.",
  ]
    .filter(Boolean)
    .join("\n");

  const avatarSummary = avatars
    .map((avatar) => {
      const description = avatar.description ? avatar.description.trim() : "No description available.";
      return "- " + avatar.name + " (id: " + avatar.id + "): " + description;
    })
    .join("\n");

  const jsonSchemaBlock = [
    "{",
    '  "title": string,',
    '  "description": string (max 500 characters),',
    '  "supportingCharacters": [',
    '    { "name": string, "role": string, "personality": string, "appearance": string, "motivation": string }',
    '  ],',
    '  "recurringElement": { "name": string, "description": string, "payoffChapter": number },',
    '  "plotBeats": [',
    '    { "order": number, "focus": string, "conflict": string, "surprise": string, "supportingCast": string[], "environmentHighlights": string[], "cliffhanger": string, "sensoryDetails": string[] }',
    '  ],',
    '  "chapters": [',
    '    {',
    '      "title": string,',
    '      "order": number,',
    '      "focus": string,',
    '      "conflict": string,',
    '      "surprise": string,',
    '      "supportingCast": string[],',
    '      "environmentHighlights": string[],',
    '      "content": string,',
    '      "imageDescription": {',
    '        "scene": string,',
    '        "characters": {',
    '          "protagonists": [ { "name": string, "action": string, "expression": string, "position": string, "pose": string } ],',
    '          "supporting": [ { "name": string, "action": string, "expression": string, "position": string, "pose": string } ]',
    '        },',
    '        "environment": { "foreground": string[], "midground": string[], "background": string[] },',
    '        "props": string[],',
    '        "atmosphere": { "weather": string, "lighting": string, "season": string, "mood": string, "sensoryDetails": string[] },',
    '        "composition": { "camera": string, "perspective": string, "focalPoints": string[], "depth": string },',
    '        "recurringElement": string,',
    '        "storytellingDetails": string[]',
    '      }',
    '    }',
    '  ],',
    '  "coverImageDescription": same structure as imageDescription,',
    '  "avatarDevelopments": [',
    '    { "name": string, "changedTraits": [ { "trait": string, "change": number, "description": string } ] }',
    '  ],',
    '  "learningOutcomes": [',
    '    { "subject": string, "newConcepts": string[], "reinforcedSkills": string[], "difficulty_mastered": string, "practical_applications": string[] }',
    '  ]',
    "}"
  ].join("\n");

  const exampleBlock = [
    "[",
    ...avatars.map((avatar, index) => {
      const lines = [
        "  {",
        '    "name": "' + avatar.name + '",',
        '    "changedTraits": [',
        '      { "trait": "courage", "change": ' + (index === 0 ? "3" : "2") + ', "description": "earned through teamwork in the adventure" },',
        '      { "trait": "teamwork", "change": ' + (index === 0 ? "2" : "3") + ', "description": "grew while solving the central conflict together" }',
        '    ]',
        "  }"
      ];
      if (index < avatars.length - 1) {
        lines[lines.length - 1] += ",";
      }
      return lines.join("\n");
    }),
    "]"
  ].join("\n");

  console.log(`[ai-generation] Fetching avatar context for ${avatars.length} avatars`);
  const avatarIds = avatars.map((avatar) => avatar.id);
  const avatarProfiles = await getAvatarProfilesFromDB(avatarIds);
  console.log(`[ai-generation] Loaded ${avatarProfiles.length} avatar visual profiles`);

  const avatarMemoriesMap = new Map<string, McpAvatarMemory[]>();
  const avatarProgressStatsMap = new Map<
    string,
    { storiesRead: number; dokusRead: number; memoryCount: number }
  >();

  for (const avatarId of avatarIds) {
    const [memories, stats] = await Promise.all([
      getAvatarMemoriesFromDB(avatarId, MAX_TOOL_MEMORIES),
      getAvatarProgressStatsFromDB(avatarId),
    ]);
    avatarMemoriesMap.set(avatarId, memories);
    avatarProgressStatsMap.set(avatarId, stats);
    console.log(
      `[ai-generation] Avatar ${avatarId}: ${memories.length} memories, stats S:${stats.storiesRead} D:${stats.dokusRead} M:${stats.memoryCount}`
    );
  }

  const compressedMemoriesMap = new Map<string, unknown[]>();
  for (const [avatarId, memories] of avatarMemoriesMap.entries()) {
    const compressed = compressMemories(memories);
    if (compressed.length > 0) {
      compressedMemoriesMap.set(avatarId, compressed);
    }
  }

  const contextSeed = `${config.genre} ${config.setting} ${config.customPrompt || ""}`.trim();

  const avatarMemoryLines = avatars
    .map((avatar) => {
      const memories = avatarMemoriesMap.get(avatar.id) || [];
      const relevantMemory = selectRelevantMemoryForPrompt(memories, contextSeed);
      if (!relevantMemory) return null;

      const traitLine =
        relevantMemory.dominantTraits.length > 0
          ? ` | Traits: ${relevantMemory.dominantTraits.join(", ")}`
          : "";

      return `${avatar.name}: ${relevantMemory.title} -> ${relevantMemory.summary}${traitLine}`;
    })
    .filter(Boolean);

  const memorySection =
    avatarMemoryLines.length > 0
      ? ["MEMORY CALLBACKS (reuse only if fitting):", ...avatarMemoryLines, ""].join("\n")
      : "";

  const progressionLines = avatars
    .map((avatar) => {
      const stats = avatarProgressStatsMap.get(avatar.id) || {
        storiesRead: 0,
        dokusRead: 0,
        memoryCount: 0,
      };
      const progression = buildAvatarProgressionSummary({
        traits: avatar.personalityTraits as any,
        stats,
      });
      const focus = progression.traitMastery.find(
        (trait) => trait.trait === progression.focusTrait
      );
      const topPerks = progression.perks
        .filter((perk) => perk.unlocked)
        .slice(0, 2)
        .map((perk) => perk.title);
      const activeQuest = progression.quests.find((quest) => quest.status === "active");

      const perkText =
        topPerks.length > 0 ? `Perks: ${topPerks.join(", ")}` : "Perks: none yet";
      const questText = activeQuest
        ? `Quest: ${activeQuest.title} ${activeQuest.progress}/${activeQuest.target}`
        : "Quest: all tracked quests completed";

      return `${avatar.name}: Focus ${focus?.label || "Wissen"} (${focus?.rank.name || "Anfaenger"}) | ${perkText} | ${questText}`;
    })
    .filter(Boolean);

  const progressionSection =
    progressionLines.length > 0
      ? ["AVATAR GROWTH CONTEXT:", ...progressionLines, ""].join("\n")
      : "";

  const userPrompt = [
    buildEnhancedUserPrompt(config, avatars, chapterCount, args.qualityFeedback),
    "",
    "AVAILABLE AVATARS:",
    avatarSummary,
    "",
    memorySection,
    progressionSection,
    "AVATAR VISUAL CANON:",
    avatarVisualLines,
    "",
    "INTEGRATE TRAITS IN TEXT (examples - adapt to real scenes):",
    avatarIntegrationExamples,
    "",
    "STYLE PRESET (IMPORTANT):",
    userStyleAddendum,
    "",
    "VALIDATE BEFORE RESPONDING:",
    "- Use exact avatar names: " + avatars.map((a) => a.name).join(", "),
    "- No missing keys, no placeholder text.",
    "- imageDescription fields in ENGLISH only.",
    "",
  ]
    .filter(Boolean)
    .join("\n");

  const state: StoryToolState = {
    avatarProfilesById: new Map(),
    avatarProfilesByName: new Map(),
    compressedProfilesById: new Map(),
    avatarMemoriesById: avatarMemoriesMap,
    compressedMemoriesById: compressedMemoriesMap,
    validatorFailures: 0,
  };

  avatarProfiles.forEach((profile: any) => {
    if (profile?.id && profile?.visualProfile) {
      state.avatarProfilesById.set(profile.id, profile.visualProfile);
      state.avatarProfilesByName.set(profile.name, profile.visualProfile);
    }
  });

  const messages: Array<any> = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const usageTotals: UsageTotals = { prompt: 0, completion: 0, total: 0 };
  let finalRequest: any = null;
  let finalResponse: any = null;
  let content: string;

  // Check if using Gemini model
  const isGeminiModel = modelConfig.name.startsWith("gemini-");

  if (isGeminiModel) {
    // Use Gemini API
    if (!isGeminiConfigured()) {
      throw new Error("Gemini API is not configured. Please set GeminiAPIKey secret.");
    }

    console.log(`[ai-generation] 🤖 Using Google Gemini model: ${modelConfig.name}`);

    try {
      const geminiResponse = await generateWithGemini({
        systemPrompt,
        userPrompt,
        model: modelConfig.name,
        maxTokens: modelConfig.maxCompletionTokens,
        temperature: 0.9,
      });

      content = geminiResponse.content;
      usageTotals.prompt = geminiResponse.usage.promptTokens;
      usageTotals.completion = geminiResponse.usage.completionTokens;
      usageTotals.total = geminiResponse.usage.totalTokens;

      finalRequest = { model: geminiResponse.model, systemPrompt, userPrompt };
      finalResponse = {
        model: geminiResponse.model,
        content,
        usage: geminiResponse.usage,
        finishReason: geminiResponse.finishReason,
      };

      console.log(`[ai-generation] ✅ Gemini generation successful`);
    } catch (error) {
      console.error(`[ai-generation] ❌ Gemini generation failed:`, error);
      throw new Error(`Gemini generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    // Use OpenAI API
    const payload = {
      model: modelConfig.name,
      messages,
      max_completion_tokens: modelConfig.maxCompletionTokens,
      response_format: { type: "json_object" },
      // Add reasoning_effort if supported by model
      ...(modelConfig.supportsReasoningEffort ? { reasoning_effort: "medium" } : {}),
    };

    finalRequest = payload;

    console.log(`[ai-generation] 🤖 Calling OpenAI API without tool calling`);
    const openAITimeoutMs =
      config.length === "long"
        ? 360_000
        : config.length === "medium"
        ? 240_000
        : 180_000;
    const abortController = new AbortController();
    const timeoutHandle = setTimeout(() => abortController.abort(), openAITimeoutMs);

    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAIKey()}`,
        },
        body: JSON.stringify(payload),
        signal: abortController.signal,
      });
    } catch (error) {
      if ((error as any)?.name === "AbortError") {
        throw new Error(`OpenAI request timed out after ${openAITimeoutMs / 1000}s`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutHandle);
    }
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as OpenAIResponse;
    finalResponse = data;

    if (data.usage) {
      usageTotals.prompt = data.usage.prompt_tokens ?? 0;
      usageTotals.completion = data.usage.completion_tokens ?? 0;
      usageTotals.total = data.usage.total_tokens ?? 0;
    }

    const choice = data.choices?.[0];
    if (!choice?.message) {
      throw new Error("Invalid response from OpenAI (no message in complete result).");
    }

    if (choice.finish_reason === "content_filter") {
      throw new Error("The request was blocked by OpenAI's content filter.");
    }

    if (choice.finish_reason === "length") {
      throw new Error(
        "Story generation was cut off due to token limit. Please try with shorter settings."
      );
    }

    content = choice.message.content || "";
    if (!content) {
      throw new Error("Empty response received from OpenAI.");
    }
  }

  let parsedStory: StoryToolOutcome["story"];
  try {
    const cleanContent = content.replace(/```json\s*/g, "").replace(/```$/g, "").trim();
    let tempParsed: any = JSON.parse(cleanContent);

    // Unwrap if nested in storyData
    if (tempParsed.storyData && !tempParsed.title) {
      console.log('[ai-generation] Unwrapping nested storyData structure');
      tempParsed = tempParsed.storyData;
    }

    parsedStory = tempParsed;
  } catch (error) {
    throw new Error(
      `JSON Parse Error: ${(error as Error)?.message ?? String(error)}`
    );
  }

  await publishWithTimeout(logTopic, {
    source: "openai-story-generation",
    timestamp: new Date(),
    request: finalRequest,
    response: finalResponse,
  });

  // Calculate costs in USD
  const inputCostUSD = (usageTotals.prompt / 1_000_000) * modelConfig.inputCostPer1M;
  const outputCostUSD = (usageTotals.completion / 1_000_000) * modelConfig.outputCostPer1M;
  const totalCostUSD = inputCostUSD + outputCostUSD;

  console.log(`[ai-generation] 💰 Cost breakdown:`);
  console.log(`  Input: ${usageTotals.prompt} tokens × $${modelConfig.inputCostPer1M}/1M = $${inputCostUSD.toFixed(4)}`);
  console.log(`  Output: ${usageTotals.completion} tokens × $${modelConfig.outputCostPer1M}/1M = $${outputCostUSD.toFixed(4)}`);
  console.log(`  Total: $${totalCostUSD.toFixed(4)}`);

  return {
    story: parsedStory,
    usage: {
      ...usageTotals,
      inputCostUSD,
      outputCostUSD,
      totalCostUSD,
      modelUsed: modelConfig.name,
    },
    state,
    finalRequest,
    finalResponse,
  };
}

