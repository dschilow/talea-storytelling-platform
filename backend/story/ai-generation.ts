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

interface ChapterImageDescription {
  scene: string;
  characters: {
    [name: string]: {
      position?: string;
      expression?: string;
      action?: string;
      clothing?: string;
    };
  };
  environment: {
    setting?: string;
    lighting?: string;
    atmosphere?: string;
    objects?: string[];
  };
  composition?: {
    foreground?: string;
    background?: string;
    focus?: string;
  };
}

interface CoverImageDescription {
  mainScene: string;
  characters: {
    [name: string]: {
      position?: string;
      expression?: string;
      pose?: string;
    };
  };
  environment: {
    setting?: string;
    mood?: string;
    colorPalette?: string[];
  };
  composition?: {
    layout?: string;
    titleSpace?: string;
    visualFocus?: string;
  };
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

interface GenerateStoryContentResponse {
  title: string;
  description: string;
  coverImageUrl: string;
  coverImageDescription: CoverImageDescription;
  chapters: (Omit<Chapter, "id"> & {
    imageDescription: ChapterImageDescription;
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
      const coverSceneRaw =
        typeof normalizedStory.coverImageDescription === "string"
          ? normalizedStory.coverImageDescription
          : normalizedStory.coverImageDescription?.mainScene || "";

      const firstChapterScene =
        typeof normalizedStory.chapters?.[0]?.imageDescription === "string"
          ? normalizedStory.chapters?.[0]?.imageDescription
          : normalizedStory.chapters?.[0]?.imageDescription?.scene;

      const safeCoverSceneText = safeCoverScene(coverSceneRaw, firstChapterScene);

      const coverCharactersData = Object.entries(versionedProfiles).map(([name, profile]) => ({
        name,
        profile,
        sceneDetails: {
          position: "foreground",
          pose: "friendly, welcoming",
        },
      }));

      const coverPromptOptimized = buildCompleteImagePrompt({
        characters: coverCharactersData,
        scene: safeCoverSceneText,
        customStyle: {
          composition: "story cover, title space top, all visible",
          style: "watercolor cover, warm colors",
          quality: `${coverCharactersData.length} subjects, child-safe`,
        },
      });

      // Normalize language (DE->EN)
      const coverPromptNormalized = normalizeLanguage(coverPromptOptimized);

      console.log("[ai-generation] 📸 Generating COVER image with optimized prompt");
      console.log("[ai-generation] Cover prompt length:", coverPromptNormalized.length);

      const coverResponse = await ai.generateImage({
        prompt: coverPromptNormalized,
        model: "runware:101@1",
        width: coverDimensions.width,
        height: coverDimensions.height,
        steps: 28,
        CFGScale: 3.5,
        seed: seedBase,
        outputFormat: "JPEG",
      });

      // CHAPTER IMAGES GENERATION with CHARACTER-BLOCKS
      const chapterResponses: Array<{ imageUrl?: string }> = [];
      for (let i = 0; i < normalizedStory.chapters.length; i++) {
        const chapter = normalizedStory.chapters[i];
        
        const chapterImageDescription =
          typeof chapter.imageDescription === "object" && chapter.imageDescription
            ? chapter.imageDescription
            : null;

        const chapterSceneText =
          typeof chapter.imageDescription === "string"
            ? chapter.imageDescription
            : chapterImageDescription?.scene || "";

        // Build character blocks for this chapter
        const chapterCharactersData = Object.entries(versionedProfiles).map(([name, profile]) => {
          const charDetails = chapterImageDescription?.characters?.[name];
          
          return {
            name,
            profile,
            sceneDetails: charDetails ? {
              position: charDetails.position,
              action: charDetails.action,
              expression: charDetails.expression,
            } : {},
          };
        });

        const chapterPromptOptimized = buildCompleteImagePrompt({
          characters: chapterCharactersData,
          scene: chapterSceneText,
        });

        const chapterPromptNormalized = normalizeLanguage(chapterPromptOptimized);

        console.log(`[ai-generation] 📸 Generating Chapter ${i + 1} image`);

        const chapterResponse = await ai.generateImage({
          prompt: chapterPromptNormalized,
          model: "runware:101@1",
          width: chapterDimensions.width,
          height: chapterDimensions.height,
          steps: 28,
          CFGScale: 3.5,
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
    chapters: (Omit<Chapter, "id" | "imageUrl"> & {
      imageDescription: ChapterImageDescription;
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

// OPTIMIERT: Reduziert Memories von 3 auf 2 und Descriptors von 6 auf 4 für Token-Einsparung
const MAX_TOOL_MEMORIES = 2;
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

  const systemPrompt = `Du bist eine professionelle Kinderbuch-Autorin für Talea.

🌍 SPRACHE: ${config.language === 'en' ? 'Write the ENTIRE story in ENGLISH' : 'Schreibe die GESAMTE Geschichte auf DEUTSCH'} (title, description, chapters, all text content)
⚠️ WICHTIG: Nur die imageDescription-Felder für Bilder müssen auf Englisch sein, ALLES andere auf ${config.language === 'en' ? 'English' : 'Deutsch'}!

WORKFLOW:
1. Du erhältst alle benötigten Avatar-Daten bereits im Prompt
2. SCHREIBE DIE VOLLSTÄNDIGE GESCHICHTE mit ALLEN Kapiteln und VOLLEM CONTENT (${minWordsPerChapter}-${maxWordsPerChapter} Wörter pro Kapitel, Ziel ca. ${targetWordsPerChapter})
3. Gib die finale JSON-Antwort zurück

WICHTIG:
- Schreibe die KOMPLETTE Story BEVOR du antwortest!
- Jedes Kapitel muss ${minWordsPerChapter}-${maxWordsPerChapter} Wörter haben (Ziel ca. ${targetWordsPerChapter})
- Genau ${chapterCount} Kapitel
- Alle Pflichtfelder müssen vorhanden sein

STILRICHTLINIEN (v1.2 - SEHR WICHTIG!):
📖 ERZÄHLSTIL:
- "Show, don't tell": Zeige Emotionen durch Handlungen, Dialoge und sensorische Details
- Lebendige Bilder im Text (Sehen, Hören, Fühlen, Riechen, Schmecken)
- Melodischer Satzrhythmus, sanfte Alliterationen, wiederkehrende sprachliche Motive
- Abwechslungsreiches Tempo: Action, ruhige Momente, Humor, Spannung

📚 MÄRCHENSTIMME & ILLUSTRATIONSSTIL:
- Orientiere dich am Ton geliebter Bilderbuch-Klassiker ("Rotkäppchen", "Hänsel und Gretel", "Schneewittchen", "Die kleine Meerjungfrau", "Das hässliche Entlein", "Pippi Langstrumpf", "Die kleine Raupe Nimmersatt", "Der Grüffelo", "Wo die wilden Kerle wohnen", "Oh, wie schön ist Panama")
- Nutze wiederkehrende Symbole, märchenhafte Vergleiche und einen warmen Erzählsog, der Staunen und Geborgenheit vermittelt
- Jede Szene liefert mindestens zwei bildstarke Momente, die als Illustrationsanweisungen funktionieren
- 🎨 BILDSTIL-REFERENZ: Axel Scheffler watercolor - warme Aquarelle, sanfte Gouache-Texturen, handgezeichnete Outlines, kindgerechte Proportionen, einladende Farbpalette
${systemStyleAddendum}

🎨 STIL-KONFIGURATION (WICHTIG):
${config.allowRhymes ? `- 📝 REIME ERWÜNSCHT: Verwende gereimte Verse und rhythmische Strukturen! Der Text sollte sich wie der Grüffelo lesen - mit Reimen, die natürlich fließen und Spaß machen.` : `- KEINE REIME: Schreibe in Prosa, ohne gereimte Strukturen.`}
${config.suspenseLevel !== undefined ? `- 🎭 Spannungslevel: ${config.suspenseLevel}/5 - ${config.suspenseLevel === 0 ? "Keine Spannung, sehr beruhigend" : config.suspenseLevel === 1 ? "Sehr sanft, beruhigend, ohne Konflikte" : config.suspenseLevel === 2 ? "Leichte Spannung mit schneller Auflösung" : config.suspenseLevel === 3 ? "Mittlere Spannung mit klaren Lösungen" : "Spannend mit dramatischen Momenten"}` : ""}
${config.humorLevel !== undefined ? `- 😄 Humor-Level: ${config.humorLevel}/5 - ${config.humorLevel === 0 ? "Kein Humor, ernst" : config.humorLevel === 1 ? "Subtiler Humor, warmherzig" : config.humorLevel === 2 ? "Leicht humorvoll mit sanften Scherzen" : config.humorLevel === 3 ? "Humorvoll mit lustigen Situationen" : "Sehr humorvoll mit viel Slapstick"}` : ""}

👥 CHARAKTERE:
- Jeder Avatar hat eine unterscheidbare Stimme/Persönlichkeit
- Verankere Identitäten: ${avatars
    .map((a) => `${a.name} = ${a.physicalTraits?.characterType || "Figur"}`)
    .join(", ")}
- Zeige Charakterentwicklung durch Entscheidungen und Reaktionen
- Hebe arttypische Wahrnehmungen hervor (Tiere -> Sinne und Körper, Menschen -> Gefühle, Sprache, soziale Impulse)
- Konsistente Namen und Pronomen (${avatars.map((a) => a.name).join(", ")})

📏 KAPITELSTRUKTUR:
- Schreibe pro Kapitel ${minWordsPerChapter}-${maxWordsPerChapter} Wörter (Ziel ca. ${targetWordsPerChapter})
- Struktur: Einstieg mit bildstarkem Aufhänger -> Entwicklung mit Handlung und Dialog -> Cliffhanger, der ein neues Rätsel oder Ziel ankündigt
- Platziere pro Kapitel mindestens einen ruhigen Gefühlsmoment und eine dynamische Aktion
- Visuell beschreibbare Momente für Illustrationen

🎯 WERTE & SICHERHEIT:
- Positive Werte: Mut, Teamwork, Hilfsbereitschaft, Kreativität, Empathie
- Kindgerecht: Keine Gewalt, keine Ängste verstärkend
- Lösungsorientiert: Probleme werden gemeinsam bewältigt

🎨 BILDNOTIZEN (CRITICAL - 100% ENGLISH!):
- ❗ WICHTIG: Beschreibe im imageDescription-Feld was die Charaktere TUN (Action/Bewegung), nicht nur wie sie aussehen
- ❗ ALLE imageDescription-Felder MÜSSEN 100% ENGLISCH sein (NIEMALS Deutsch!)
- Beispiel GUT: "Alexander crouches low, examining a glowing map while adrian points excitedly at a distant clocktower"
- Beispiel SCHLECHT: "Alexander und adrian stehen vor dem Uhrturm"
- ❗ VERBOTEN: "stehen", "standen", "sitzen", "saßen" → Nutze stattdessen: "crouches", "leans forward", "reaches up", "kneels beside", "points at"
- Die Szene soll zeigen was im Kapitel passiert, mit dynamischem Winkel (nicht frontal)
- Charaktere sollen unterschiedlich positioniert sein (left/right, foreground/background, different heights)
- ❗ Axel Scheffler Stil: Warme Aquarelle, sanfte Gouache-Texturen, kindgerechte Proportionen

💡 LERNMODUS (falls aktiv):
- Lernziele NATÜRLICH einbauen (keine Lehrbuch-Tiraden!)
- Neues Wissen durch Dialoge und Entdeckungen vermitteln
- Sachwissen in Handlung integrieren (z.B. "Diego entdeckt, dass Katzen im Dunkeln sehen können")
- Konsistentes Inventar (z.B. "roter Rucksack" taucht wieder auf)
- Optional: 2 einfache Verständnisfragen am Ende (nur bei learningMode.enabled = true)

✅ KONSISTENZ-CHECKLISTE (SEHR WICHTIG!):
- Namen & Pronomen: Nutze EXAKT die Avatar-Namen (${avatars
    .map((a) => a.name)
    .join(", ")}) - keine Variationen!
- Inventar-Tracking: Eingeführte Gegenstände müssen konsistent bleiben (Farbe, Eigenschaften)
- Orte & Settings: Einmal etablierte Orte müssen wiederkehrend beschrieben werden
- Cliffhanger: JEDES Kapitel (außer letztes) endet mit spannendem Cliffhanger
- Charaktereigenschaften: Avatare bleiben ihrer Persönlichkeit treu (siehe Personality Traits)

KRITISCH - Chapter Content:
- Jedes Kapitel muss einen vollständigen content-Text im geforderten Umfang haben
- NIEMALS leere oder kurze Platzhalter verwenden!
- Schreibe den KOMPLETTEN Text BEVOR du validierst!

TECHNISCHE REGELN:
- Antworte NUR mit gültigem JSON, NIEMALS mit freiem Text
- Rufe Tools nicht mehrfach mit denselben Parametern auf
- Jedes Kapitel endet mit spannendem Cliffhanger

PFLICHTFELDER IM JSON (ALLE müssen vorhanden sein!):
- title (string)
- description (string, max 500 Zeichen)
- chapters (array mit title, content (${minWordsPerChapter}-${maxWordsPerChapter} Wörter), order, imageDescription)
- coverImageDescription (object)
- avatarDevelopments (array mit name, changedTraits) - KRITISCH: Muss für JEDEN Avatar vorhanden sein!
- learningOutcomes (array mit category, description)`;

  const avatarSummary = avatars
    .map((avatar) => {
      const description = avatar.description ? avatar.description.trim() : "Keine Beschreibung vorhanden.";
      return `- ${avatar.name} (id: ${avatar.id}): ${description}`;
    })
    .join("\n");

  const userPrompt = `Erstelle eine ${config.genre}-Geschichte im Setting ${config.setting} für die Altersgruppe ${config.ageGroup}. Die Geschichte soll ${chapterCount} Kapitel haben.

WICHTIG - KAPITELLÄNGE:
- Jedes Kapitel muss ${minWordsPerChapter}-${maxWordsPerChapter} Wörter haben (Ziel ca. ${targetWordsPerChapter})
- Schreibe lebendige Beschreibungen, Dialoge und Emotionen
- Nutze atmosphärische Details und Charakterentwicklung im Stil klassischer Bilderbücher
- Jedes Kapitel endet mit einem spannenden Cliffhanger
- Bleibe fokussiert und präzise

STILREFERENZEN:
- Orientiere dich am Ton von "Rotkäppchen", "Hänsel und Gretel", "Schneewittchen", "Die kleine Meerjungfrau", "Das hässliche Entlein", "Pippi Langstrumpf", "Die kleine Raupe Nimmersatt", "Der Grüffelo", "Wo die wilden Kerle wohnen" und "Oh, wie schön ist Panama"
- Verwende märchenhafte Vergleiche, wiederkehrende Symbole und eine warme Erzählerstimme
- Beschreibe Szenen so, dass sie als ausdrucksstarke Illustrationen funktionieren
- 🎨 BILDSTIL-REFERENZ: Axel Scheffler watercolor style - warme Aquarelle, sanfte Gouache-Texturen, kindgerechte Proportionen
${userStyleAddendum}

Konfigurationsdetails:
- Komplexität: ${config.complexity}
- Lernmodus: ${config.learningMode?.enabled ?? false}
- Lernziele: ${(config.learningMode?.learningObjectives ?? []).join(", ") || "keine"}
${config.allowRhymes ? `- 📝 REIME ERWÜNSCHT: Verwende gereimte Verse und rhythmische Strukturen (wie im Grüffelo)` : ""}
${config.suspenseLevel !== undefined ? `- 🎭 Spannungslevel: ${config.suspenseLevel}/5 (${config.suspenseLevel === 0 ? "keine Spannung" : config.suspenseLevel === 1 ? "sanft" : config.suspenseLevel === 2 ? "leicht spannend" : config.suspenseLevel === 3 ? "mittel spannend" : "spannend"})` : ""}
${config.humorLevel !== undefined ? `- 😄 Humor-Level: ${config.humorLevel}/5 (${config.humorLevel === 0 ? "ernst" : config.humorLevel === 1 ? "subtil" : config.humorLevel === 2 ? "leicht humorvoll" : config.humorLevel === 3 ? "humorvoll" : "sehr humorvoll"})` : ""}

${config.learningMode?.enabled ? `
🎓 LERNMODUS AKTIV - Spezielle Anforderungen:
- Integriere die Lernziele (${(config.learningMode?.learningObjectives ?? []).join(", ")}) NATÜRLICH in die Handlung
- Nutze Dialoge zwischen Avataren, um Wissen zu vermitteln (z.B. "Weißt du, Diego, dass...")
- Zeige Lernen durch Entdeckung und Erfahrung, nicht durch Belehrung
- Füge am Ende 2 einfache Verständnisfragen hinzu (im learningOutcomes-Feld)
- Beispiel: {"category": "Sachwissen", "description": "Warum können Katzen im Dunkeln sehen?"}
` : ""}

Verfügbare Avatare:
${avatarSummary}

AVATAR-DATEN (bereits geladen):
Die visuellen Profile und Erinnerungen der Avatare sind bereits verfügbar und wurden in die Story-Generierung integriert.

WORKFLOW:
1. Schreibe die VOLLSTÄNDIGE Geschichte (alle ${chapterCount} Kapitel!) basierend auf den bereitgestellten Avatar-Daten
2. Gib die finale JSON-Antwort zurück

❗ KRITISCH - avatarDevelopments (SEHR WICHTIG!):
Das avatarDevelopments-Array muss EXAKT ${avatars.length} Einträge haben - NICHT MEHR, NICHT WENIGER!

📋 DIE VOLLSTÄNDIGE LISTE DER AVATARE IN DIESER GESCHICHTE:
${avatars.map((a, idx) => `${idx + 1}. "${a.name}"`).join('\n')}

✅ RICHTIG: Erstelle genau ${avatars.length} Einträge für: ${avatars.map(a => a.name).join(" UND ")}
❌ FALSCH: Andere Namen verwenden oder mehr/weniger als ${avatars.length} Einträge

PFLICHT-BEISPIEL für diese Geschichte (GENAU SO FORMAT):
[
  {
    "name": "${avatars[0].name}",
    "changedTraits": [
      {"trait": "courage", "change": 5},
      {"trait": "teamwork", "change": 3}
    ]
  }${avatars.length > 1 ? `,
  {
    "name": "${avatars[1].name}",
    "changedTraits": [
      {"trait": "creativity", "change": 4},
      {"trait": "empathy", "change": 2}
    ]
  }` : ''}
]

⚠️ PRÜFE VOR DEM VALIDIEREN:
- Hast du genau ${avatars.length} Einträge? (zähle nach!)
- Hast du die richtigen Namen verwendet? (${avatars.map(a => a.name).join(", ")})
- Hat jeder Eintrag "name" UND "changedTraits"?

FORMAT: {title, description, chapters[{title, content, order, imageDescription:{scene,characters,environment,composition}}], coverImageDescription, avatarDevelopments[{name, changedTraits[{trait, change}]}], learningOutcomes[{category, description}]}`;

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
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAIKey()}`,
    },
    body: JSON.stringify(payload),
  });

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

