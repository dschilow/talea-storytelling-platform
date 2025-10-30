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
// MCP imports kept for potential future use, but not currently used
import {
  type ValidationResult,
} from "../helpers/mcpClient";
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

function clampRunwarePrompt(prompt: string, maxLength = 2800): string {
  if (!prompt) {
    return "";
  }
  if (prompt.length <= maxLength) {
    return prompt;
  }
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
      "Inspired by 'Der Grüffelo': rhythmic, playful cadence with gentle call-and-response energy; keep lines musical yet clearly understandable.",
    description: "Gereimte Wendungen, Call-and-Response, humorvoll.",
  },
  gentle_minimal: {
    inspiration:
      "Inspired by 'Die kleine Raupe Nimmersatt': minimal, soothing structure with repeating phrases and calm sensory cues; ideal for bedtime.",
    description: "Wiederholung, klare Struktur, ruhig.",
  },
  wild_imaginative: {
    inspiration:
      "Inspired by 'Wo die wilden Kerle wohnen': bold imaginative energy with safe boundaries that celebrate curiosity and courage.",
    description: "Rebellische Imagination, sichere Grenzen.",
  },
  philosophical_warm: {
    inspiration:
      "Inspired by 'Der kleine Prinz': warm, reflective narration with small pearls of wisdom and poetic comparisons.",
    description: "Kleine Weisheiten, poetische Bilder.",
  },
  mischief_empowering: {
    inspiration:
      "Inspired by 'Pippi Langstrumpf': mischievous, empowering tone where kids act confidently and humor drives the plot.",
    description: "Selbstwirksamkeit, Humor.",
  },
  adventure_epic: {
    inspiration:
      "Inspired by 'Harry Potter': episodic adventure feeling with clear quests and team spirit, always age-appropriate.",
    description: "Quest-Gefühl, kindgerecht dosiert.",
  },
  quirky_dark_sweet: {
    inspiration:
      "Inspired by 'Charlie und die Schokoladenfabrik': quirky, gently dark sweetness with surprising yet friendly twists.",
    description: "Leicht schräg, immer freundlich.",
  },
  cozy_friendly: {
    inspiration:
      "Inspired by 'Winnie Puuh': cozy, dialogue-rich scenes full of friendship, snacks, and gentle warmth.",
    description: "Gemütliche Dialoge, Freundschaft.",
  },
  classic_fantasy: {
    inspiration:
      "Inspired by 'Peter Pan': timeless, fairy-tale fantasy with wide-eyed heroes and classic motifs.",
    description: "Zeitlose Fantasie.",
  },
  whimsical_logic: {
    inspiration:
      "Inspired by 'Alice im Wunderland': playful logic puzzles and wordplay that remain easy to follow for kids.",
    description: "Logikspiele, verspielt (altersgerecht).",
  },
  mythic_allegory: {
    inspiration:
      "Inspired by 'Die Chroniken von Narnia': mythic, softly allegorical storytelling with symbolic moments and calm heroism.",
    description: "Symbolik, Teamgeist.",
  },
  road_fantasy: {
    inspiration:
      "Inspired by 'Der Zauberer von Oz': journey-style fantasy with clear stages, memorable companions, and scenic landscapes.",
    description: "Weg, Etappen, Gefährten.",
  },
  imaginative_meta: {
    inspiration:
      "Inspired by 'Die unendliche Geschichte': meta-fantasy celebrating imagination itself with stories inside stories.",
    description: "Geschichte in Geschichte (einfach).",
  },
  pastoral_heart: {
    inspiration:
      "Inspired by 'Heidi': pastoral warmth with nature imagery, heartfelt community, and gentle resilience.",
    description: "Alpen-Gefühl, Geborgenheit.",
  },
  bedtime_soothing: {
    inspiration:
      "Inspired by 'Gute Nacht, Mond': extremely soothing, near-whisper bedtime tone with long, dreamy sentences.",
    description: "Sehr sanft, flüsterndes Tempo.",
  },
};

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

async function getAvatarMemoriesFromDB(avatarId: string, limit: number = 10): Promise<McpAvatarMemory[]> {
  // Create table if not exists
  await avatarDB.exec`
    CREATE TABLE IF NOT EXISTS avatar_memories (
      id TEXT PRIMARY KEY,
      avatar_id TEXT NOT NULL,
      story_id TEXT,
      story_title TEXT,
      experience TEXT,
      emotional_impact TEXT CHECK (emotional_impact IN ('positive', 'negative', 'neutral')),
      personality_changes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE CASCADE
    )
  `;

  // Get last 5 stories + last 5 dokus (max 10 total)
  const memoryRowsGenerator = await avatarDB.query<{
    id: string;
    story_id: string;
    story_title: string;
    experience: string;
    emotional_impact: 'positive' | 'negative' | 'neutral';
    personality_changes: string;
    created_at: string;
  }>`
    WITH stories AS (
      SELECT id, story_id, story_title, experience, emotional_impact, personality_changes, created_at
      FROM avatar_memories
      WHERE avatar_id = ${avatarId}
        AND (experience LIKE '%aktiver Teilnehmer%' OR experience LIKE '%Geschichte%')
        AND experience NOT LIKE '%Doku%'
      ORDER BY created_at DESC
      LIMIT 5
    ),
    dokus AS (
      SELECT id, story_id, story_title, experience, emotional_impact, personality_changes, created_at
      FROM avatar_memories
      WHERE avatar_id = ${avatarId}
        AND experience LIKE '%Doku%'
      ORDER BY created_at DESC
      LIMIT 5
    )
    SELECT * FROM stories
    UNION ALL
    SELECT * FROM dokus
    ORDER BY created_at DESC
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

      const storyOutcome = await generateStoryWithOpenAITools({
        config: req.config,
        avatars: req.avatarDetails,
      });

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

      const seedBase = deterministicSeedFrom(avatarIds.join("|"));
      const coverDimensions = normalizeRunwareDimensions(1024, 1024);
      const chapterDimensions = normalizeRunwareDimensions(1024, 1024);

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

      // Normalize language (DE->EN)
      const coverPromptNormalized = normalizeLanguage(coverPrompts.positivePrompt);
      const coverPromptClamped = clampRunwarePrompt(coverPromptNormalized);
      const coverNegativePromptNormalized = normalizeLanguage(coverPrompts.negativePrompt);

      console.log("[ai-generation] 📸 Generating COVER image with optimized prompt + negative prompt");
      console.log("[ai-generation] Cover positive prompt length:", coverPromptNormalized.length);
      if (coverPromptClamped.length !== coverPromptNormalized.length) {
        console.log("[ai-generation] Cover positive prompt clamped to length:", coverPromptClamped.length);
      }
      console.log("[ai-generation] Cover negative prompt length:", coverNegativePromptNormalized.length);

      const coverResponse = await ai.generateImage({
        prompt: coverPromptClamped,
        negativePrompt: coverNegativePromptNormalized,
        model: "runware:101@1",
        width: coverDimensions.width,
        height: coverDimensions.height,
        steps: 30, // Increased from 28 for better quality
        CFGScale: 7.5, // Increased from 3.5 for stronger prompt adherence
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

        const chapterPromptNormalized = normalizeLanguage(chapterPrompts.positivePrompt);
        const chapterPromptClamped = clampRunwarePrompt(chapterPromptNormalized);
        const chapterNegativePromptNormalized = normalizeLanguage(chapterPrompts.negativePrompt);

        console.log(`[ai-generation] 📸 Generating Chapter ${i + 1} image with negative prompt`);
        console.log(`[ai-generation] Chapter ${i + 1} positive prompt length:`, chapterPromptNormalized.length);
        if (chapterPromptClamped.length !== chapterPromptNormalized.length) {
          console.log(`[ai-generation] Chapter ${i + 1} positive prompt clamped to:`, chapterPromptClamped.length);
        }
        console.log(`[ai-generation] Chapter ${i + 1} negative prompt length:`, chapterNegativePromptNormalized.length);

        const chapterResponse = await ai.generateImage({
          prompt: chapterPromptClamped,
          negativePrompt: chapterNegativePromptNormalized,
          model: "runware:101@1",
          width: chapterDimensions.width,
          height: chapterDimensions.height,
          steps: 30, // Increased from 28 for better quality
          CFGScale: 7.5, // Increased from 3.5 for stronger prompt adherence
          seed: (seedBase + i * 7) >>> 0, // FIXED: Chapter index (not +1) for correct seed strategy
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
        cfg: 3.5,
        steps: 28,
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

async function generateStoryWithOpenAITools(args: {
  config: StoryConfig;
  avatars: ExtendedAvatarDetails[];
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
  const minWordsPerChapter = Math.max(210, targetWordsPerChapter - 60);
  const maxWordsPerChapter = targetWordsPerChapter + 60;
  const stylePresetMeta =
    config.stylePreset && STYLE_PRESET_META[config.stylePreset]
      ? STYLE_PRESET_META[config.stylePreset]
      : undefined;
  const systemStyleAddendum = stylePresetMeta
    ? `
⭐ STIL-PRESET (ABSOLUT PRIORITÄR):
- INSPIRATION: ${stylePresetMeta.inspiration}
- BESCHREIBUNG: ${stylePresetMeta.description}
- WICHTIG: Dieser Stil MUSS in JEDEM Kapitel spürbar sein!`
    : "";
  const userStyleAddendum = stylePresetMeta
    ? `
⭐ STIL-PRESET (KRITISCH WICHTIG):
INSPIRATION: ${stylePresetMeta.inspiration}
BESCHREIBUNG: ${stylePresetMeta.description}

DU MUSST diesen Stil konsequent in ALLEN Kapiteln umsetzen!`
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
        examples.push("\"" + avatar.name + " brushes a strand of " + vp.hair.color + " hair aside.\"");
      }
      if (vp?.eyes?.color) {
        examples.push("\"" + avatar.name + "'s " + vp.eyes.color + " eyes sparkle with curiosity.\"");
      }
      if (vp?.clothingCanonical?.top) {
        examples.push("\"The " + vp.clothingCanonical.top + " sways as " + avatar.name + " turns.\"");
      }
      if (vp?.locomotion === "quadruped") {
        examples.push("\"" + avatar.name + " darts forward on four paws.\"");
      }
      if (examples.length === 0) {
        examples.push("\"" + avatar.name + " reacts vividly to the scene.\"");
      }

      return examples.join("\n  ");
    })
    .join("\n");

  const systemPrompt = [
    "You are Talea's senior picture-book author and narrative director.",
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
    "STORY ARCHITECTURE:",
    "- Follow a cinematic children's adventure arc:",
    "  1. Chapter 1: normal world, inciting incident, introduce at least one supporting character.",
    "  2. Chapter 2: exploration or first encounter, new supporting character, first obstacle.",
    "  3. Chapter 3: escalation, meaningful surprise, tougher setback.",
    "  4. Chapter 4: climax where all characters collaborate to solve the biggest conflict.",
    "  5. Chapter 5: resolution with character growth, payoff of the recurring element, hint at future adventures.",
    "- If the story length differs, adapt the beats to cover inciting incident, escalation, climax, and resolution in order.",
    "",
    "CHARACTER ENSEMBLE:",
    "- Keep the user avatars (" + avatars.map((a) => a.name).join(", ") + ") consistent and central.",
    "- Invent at least three named supporting characters suited to the genre and setting (mix of helpers, mentors, rivals, comic relief).",
    "- Give each supporting character a clear role, personality trait, and visual hook that reappears.",
    "- Include ambient world citizens (shopkeepers, classmates, animals) to make the scenes lively.",
    "",
    "CONFLICT, SURPRISE, AND HEART:",
    "- Every chapter needs a concrete challenge plus an emotional beat.",
    "- Include at least one genuine surprise or twist across the story.",
    "- Resolutions must arise from clever teamwork or learned skill, never coincidence.",
    "",
    "WORLD BUILDING AND SENSORY DETAIL:",
    "- Paint each location with 8-12 tangible details (sight, sound, smell, texture, temperature, small props).",
    "- Track a recurring element introduced in chapter 1 that meaningfully returns in chapter 5.",
    "- Use dialogue generously (around 40% of each chapter) to show personality and learning moments.",
    "",
    "AVATAR VISUAL CANON (keep consistent in narration):",
    avatarVisualLines,
    "",
    "INTEGRATE TRAITS IN TEXT (examples � adapt to real scenes):",
    avatarIntegrationExamples,
    "",
    "IMAGE DESCRIPTION SPEC (English only):",
    "- Provide structured Wimmelbild-ready data for each image:",
    "  scene: single-sentence cinematic summary.",
    "  characters.protagonists: 2-3 entries (name, action, expression, position, pose).",
    "  characters.supporting: at least one entry when supporting cast is present.",
    "  environment.foreground: 3-5 concrete items with adjectives.",
    "  environment.midground: 5-8 elements covering main action, extra figures, and props.",
    "  environment.background: 3+ depth elements (buildings, nature, sky, distant characters).",
    "  props: 5-8 story-relevant or playful objects.",
    "  atmosphere: weather, lighting, season, mood, sensoryDetails (array of sounds or smells).",
    "  composition: camera, perspective, focalPoints (array), depth or movement cues.",
    "  recurringElement: explain where the recurring element appears in this scene.",
    "  storytellingDetails: short array of easter eggs or hints that link chapters together.",
    "- Use dynamic verbs (crouches, leans, dashes, peers) instead of static words like steht/sitzen.",
    "- Mention supporting characters, bystanders, animals, and props explicitly in midground details.",
    "- Human characters must stay fully human (no tails, no animal ears, no fur).",
    "",
    "COVER IMAGE DESCRIPTION:",
    "- Same structure as chapter imageDescription but emphasise ensemble and clear space for title typography.",
    "",
    "STYLE AND TONE:",
    "- Warm, whimsical picture-book energy with gentle suspense.",
    "- Show, do not tell: reveal feelings through actions, dialogue, and sensory detail.",
    "- Respect Axel Scheffler watercolor aesthetics (soft gouache textures, hand-drawn outlines).",
    systemStyleAddendum,
    "",
    "AVATAR DEVELOPMENTS:",
    "- avatarDevelopments must contain exactly one entry per avatar with concrete trait deltas (allow zero change).",
    "- Provide meaningful descriptions of how each trait changed through the story experience.",
    "",
    "QUALITY CHECK:",
    "- Keep continuity on items, places, supporting cast, and the recurring element.",
    "- Chapters 1-" + (chapterCount - 1) + " end with a hook or cliffhanger; the final chapter resolves the adventure.",
  ]
    .filter(Boolean)
    .join("\n");

  const avatarSummary = avatars
    .map((avatar) => {
      const description = avatar.description ? avatar.description.trim() : "Keine Beschreibung vorhanden.";
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

  const userPrompt = [
    "Generate a " + config.genre + " story set in " + config.setting + " for the " + config.ageGroup + " age group.",
    "Story length: exactly " + chapterCount + " chapters with " + minWordsPerChapter + "-" + maxWordsPerChapter + " words each (target " + targetWordsPerChapter + ").",
    "",
    "CONFIGURATION:",
    "- Complexity: " + config.complexity,
    "- Learning mode enabled: " + Boolean(config.learningMode?.enabled),
    config.learningMode?.enabled ? "- Learning objectives: " + ((config.learningMode.learningObjectives ?? []).join(", ") || "keine") : undefined,
    config.allowRhymes ? "- Rhymes: encouraged (playful and natural)." : "- Rhymes: use prose; avoid rhymed verse.",
    config.suspenseLevel !== undefined ? "- Suspense level target: " + config.suspenseLevel + "/5." : undefined,
    config.humorLevel !== undefined ? "- Humor level target: " + config.humorLevel + "/5." : undefined,
    config.pacing ? "- Pacing preference: " + config.pacing + "." : undefined,
    config.pov ? "- Narrative POV: " + config.pov + "." : undefined,
    config.hasTwist ? "- Include at least one memorable twist." : undefined,
    config.customPrompt ? "- Custom note: " + config.customPrompt : undefined,
    userStyleAddendum,
    "",
    "AVAILABLE AVATARS:",
    avatarSummary,
    "",
    "JSON SCHEMA (return exactly these fields):",
    jsonSchemaBlock,
    "",
    "SUPPORTING CHARACTER RULES:",
    "- Supporting characters must be original (do not reuse the user avatar names).",
    "- Provide at least three supportingCharacters entries and reference them across the chapters.",
    "",
    "AVATAR DEVELOPMENTS MUST MATCH USER AVATARS EXACTLY:",
    "- Required names: " + avatars.map((a) => a.name).join(", ") + ".",
    "- Provide exactly " + avatars.length + " entries in avatarDevelopments.",
    "- Example format (adapt trait names and values to the story):",
    exampleBlock,
    "",
    "Validate before responding:",
    "- Exactly " + avatars.length + " avatarDevelopments entries with the correct avatar names.",
    "- No missing keys. No placeholder text."
  ]
    .filter(Boolean)
    .join("\n");

  // TOOLS REMOVED (2025-10-27): No longer using OpenAI function calling for avatar data
  // Avatar profiles and memories are now fetched directly from DB before prompt generation

  // Fetch avatar profiles and memories directly from DB
  console.log(`[ai-generation] 📦 Fetching avatar data from DB for ${avatars.length} avatars`);
  const avatarIds = avatars.map(a => a.id);

  const avatarProfiles = await getAvatarProfilesFromDB(avatarIds);
  console.log(`[ai-generation] ✅ Fetched ${avatarProfiles.length} avatar profiles from DB`);

  // Fetch memories for each avatar
  const avatarMemoriesMap = new Map<string, McpAvatarMemory[]>();
  for (const avatarId of avatarIds) {
    const memories = await getAvatarMemoriesFromDB(avatarId, MAX_TOOL_MEMORIES);
    avatarMemoriesMap.set(avatarId, memories);
    console.log(`[ai-generation] ✅ Fetched ${memories.length} memories for avatar ${avatarId}`);
  }

  // Build profile and memory data for state (used later for image generation)
  const state: StoryToolState = {
    avatarProfilesById: new Map(),
    avatarProfilesByName: new Map(),
    compressedProfilesById: new Map(),
    avatarMemoriesById: avatarMemoriesMap,
    compressedMemoriesById: new Map(),
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
    throw new Error("Ungültige Antwort von OpenAI (keine Nachricht im vollständigen Ergebnis).");
  }

  if (choice.finish_reason === "content_filter") {
    throw new Error("Die Anfrage wurde vom OpenAI Inhaltsfilter blockiert.");
  }

  if (choice.finish_reason === "length") {
    throw new Error(
      "Die Story-Generierung wurde wegen Token-Limit abgeschnitten. Bitte versuche es mit kürzeren Einstellungen."
    );
  }

  const content = choice.message.content;
  if (!content) {
    throw new Error("Leere Antwort von OpenAI erhalten.");
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
      `JSON Parse Fehler: ${(error as Error)?.message ?? String(error)}`
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

