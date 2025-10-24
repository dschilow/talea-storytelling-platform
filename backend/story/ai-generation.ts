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
import {
  getMultipleAvatarProfiles,
  getAvatarMemories,
  validateStoryResponse,
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

// WICHTIG: gpt-4.1-nano fuer optimale Qualitaet
// Update: Modell gewechselt zu gpt-4.1-nano (24.10.2025)
const MODEL = "gpt-4.1-nano";
const INPUT_COST_PER_1M = 5.0;
const OUTPUT_COST_PER_1M = 15.0;

const openAIKey = secret("OpenAIKey");
const mcpServerApiKey = secret("MCPServerAPIKey");

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
    if (!req.clerkToken) {
      throw new Error("Missing Clerk token for MCP integration");
    }
    const mcpApiKey = mcpServerApiKey();

    const startTime = Date.now();
    const metadata: GenerateStoryContentResponse["metadata"] = {
      tokensUsed: { prompt: 0, completion: 0, total: 0 },
      model: MODEL,
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
        clerkToken: req.clerkToken,
        mcpApiKey,
      });

      metadata.tokensUsed = storyOutcome.usage ?? {
        prompt: 0,
        completion: 0,
        total: 0,
      };

      const outputTokens = metadata.tokensUsed.completion;
      metadata.totalCost.text =
        (metadata.tokensUsed.prompt / 1_000_000) * INPUT_COST_PER_1M +
        (outputTokens / 1_000_000) * OUTPUT_COST_PER_1M;

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

      const validationResult = await validateStoryResponse(storyOutcome.story, mcpApiKey);
      storyOutcome.state.validationResult = validationResult;

      if (!validationResult?.isValid) {
        throw new Error(
          `Story validation failed: ${JSON.stringify(validationResult?.errors ?? {})}`
        );
      }

      const normalizedStory = validationResult.normalized ?? storyOutcome.story;
      enforceAvatarDevelopments(normalizedStory, req.avatarDetails);

      const avatarProfilesByName: Record<string, AvatarVisualProfile> = {};
      storyOutcome.state.avatarProfilesByName.forEach((profile, name) => {
        avatarProfilesByName[name] = profile;
      });

      // KRITISCH: Prüfe ob ALLE Avatare ein visualProfile haben
      const missingProfiles = req.avatarDetails.filter((av: any) => !avatarProfilesByName[av.name]);
      
      if (Object.keys(avatarProfilesByName).length === 0) {
        console.warn("[ai-generation] ⚠️ Keine Avatarprofile über Tool-Aufrufe erhalten – Fallback auf direkten MCP-Aufruf.");
        const fallbackProfiles = await getMultipleAvatarProfiles(avatarIds, req.clerkToken, mcpApiKey);
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
      const coverSceneText = typeof normalizedStory.coverImageDescription === 'string'
        ? normalizedStory.coverImageDescription
        : normalizedStory.coverImageDescription.mainScene || "";
      
      const safeCoverSceneText = safeCoverScene(
        coverSceneText,
        normalizedStory.chapters[0]?.imageDescription?.scene
      );

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
        
        const chapterSceneText = typeof chapter.imageDescription === 'string'
          ? chapter.imageDescription
          : chapter.imageDescription.scene || "";

        // Build character blocks for this chapter
        const chapterCharactersData = Object.entries(versionedProfiles).map(([name, profile]) => {
          const charDetails = typeof chapter.imageDescription !== 'string' 
            && chapter.imageDescription.characters?.[name];
          
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
          seed: (seedBase + i * 101) >>> 0,
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
  clerkToken: string;
  mcpApiKey: string;
}): Promise<StoryToolOutcome> {
  const { config, avatars, clerkToken, mcpApiKey } = args;

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
STIL-PRESET-SPEZIAL:
- ${stylePresetMeta.inspiration}
- Beschreibung: ${stylePresetMeta.description}`
    : "";
  const userStyleAddendum = stylePresetMeta
    ? `
STIL-PRESET:
- ${stylePresetMeta.inspiration}
- ${stylePresetMeta.description}`
    : "";

  const systemPrompt = `Du bist eine professionelle Kinderbuch-Autorin für Talea. 

WORKFLOW (Schritt für Schritt):
1. Rufe get_avatar_profiles auf (nur einmal!)
2. Rufe get_avatar_memories für jeden Avatar auf (nur einmal pro Avatar!)
3. SCHREIBE DIE VOLLSTÄNDIGE GESCHICHTE mit ALLEN Kapiteln und VOLLEM CONTENT (${minWordsPerChapter}-${maxWordsPerChapter} Wörter pro Kapitel, Ziel ca. ${targetWordsPerChapter})
4. Validiere mit validate_story_response (sende die KOMPLETTE Story im storyData-Feld!)
5. Bei Fehlern: korrigiere und validiere erneut
6. Gib die finale JSON-Antwort zurück

STILRICHTLINIEN (v1.2 - SEHR WICHTIG!):
📖 ERZÄHLSTIL:
- "Show, don't tell": Zeige Emotionen durch Handlungen, Dialoge und sensorische Details
- Lebendige Bilder im Text (Sehen, Hören, Fühlen, Riechen, Schmecken)
- Melodischer Satzrhythmus, sanfte Alliterationen, wiederkehrende sprachliche Motive
- Abwechslungsreiches Tempo: Action, ruhige Momente, Humor, Spannung

📚 MÄRCHENSTIMME:
- Orientiere dich am Ton geliebter Bilderbuch-Klassiker ("Rotkäppchen", "Hänsel und Gretel", "Schneewittchen", "Die kleine Meerjungfrau", "Das hässliche Entlein", "Pippi Langstrumpf", "Die kleine Raupe Nimmersatt", "Der Grüffelo", "Wo die wilden Kerle wohnen", "Oh, wie schön ist Panama")
- Nutze wiederkehrende Symbole, märchenhafte Vergleiche und einen warmen Erzählsog, der Staunen und Geborgenheit vermittelt
- Jede Szene liefert mindestens zwei bildstarke Momente, die als Illustrationsanweisungen funktionieren
${systemStyleAddendum}

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

🎨 BILDNOTIZEN:
- WICHTIG: Beschreibe im imageDescription-Feld was die Charaktere TUN (Action/Bewegung), nicht nur wie sie aussehen
- Beispiel GUT: "Diego klettert auf einen Baum während Alexander unten zuschaut"
- Beispiel SCHLECHT: "Diego und Alexander stehen im Park"
- Die Szene soll zeigen was im Kapitel passiert, mit dynamischem Winkel (nicht frontal)
- Charaktere sollen unterschiedlich positioniert sein (links/rechts, vorne/hinten, verschiedene Höhen)

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
${userStyleAddendum}

Konfigurationsdetails:
- Komplexität: ${config.complexity}
- Lernmodus: ${config.learningMode?.enabled ?? false}
- Lernziele: ${(config.learningMode?.learningObjectives ?? []).join(", ") || "keine"}

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

WORKFLOW:
1. Rufe get_avatar_profiles EINMAL auf
2. Rufe get_avatar_memories für JEDEN Avatar EINMAL auf
3. Schreibe die VOLLSTÄNDIGE Geschichte (alle ${chapterCount} Kapitel!)
4. Validiere mit validate_story_response (sende die komplette Story!)
5. Gib die finale JSON-Antwort zurück

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

  const tools = [
    {
      type: "function",
      function: {
        name: "get_avatar_profiles",
        description:
          "Liefert kanonische visuelle Profile (Aussehen) mehrerer Avatare für konsistente Bildbeschreibungen.",
        parameters: {
          type: "object",
          properties: {
            avatar_ids: {
              type: "array",
              items: { type: "string" },
              description: "Liste der Avatar-IDs, die geladen werden sollen.",
            },
          },
          required: ["avatar_ids"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_avatar_memories",
        description:
          "Liefert relevante Erinnerungen eines Avatars, um sie in der Geschichte zu berücksichtigen.",
        parameters: {
          type: "object",
          properties: {
            avatar_id: { type: "string", description: "ID des Avatars." },
            limit: {
              type: "integer",
              minimum: 1,
              maximum: 50,
              description: "Maximale Anzahl an Erinnerungen (Standard 10).",
            },
          },
          required: ["avatar_id"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "validate_story_response",
        description:
          "Validiert die fertige Story und liefert normalisierte Daten sowie Fehlermeldungen, falls das Format nicht passt.",
        parameters: {
          type: "object",
          properties: {
            storyData: {
              type: "object",
              description: "Die vollständige Story als JSON, die validiert werden soll.",
            },
          },
          required: ["storyData"],
        },
      },
    },
  ];

  const messages: Array<any> = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const usageTotals: UsageTotals = { prompt: 0, completion: 0, total: 0 };
  const state: StoryToolState = {
    avatarProfilesById: new Map(),
    avatarProfilesByName: new Map(),
    compressedProfilesById: new Map(),
    avatarMemoriesById: new Map(),
    compressedMemoriesById: new Map(),
    validatorFailures: 0,
  };

  let finalRequest: any = null;
  let finalResponse: any = null;
  
  // OPTIMIERT: Verhindert endlose Tool-Loops (max 15 Iterationen)
  let loopIterations = 0;
  const MAX_LOOP_ITERATIONS = 15;

  const toolHandlers: Record<
    string,
    (args: Record<string, any>) => Promise<unknown>
  > = {
    get_avatar_profiles: async ({ avatar_ids }) => {
      if (!Array.isArray(avatar_ids) || avatar_ids.length === 0) {
        throw new Error("avatar_ids must be a non-empty array");
      }

      const missingIds = avatar_ids.filter((id) => !state.avatarProfilesById.has(id));
      
      // OPTIMIERT: Wenn bereits gecacht, gib sofort zurück ohne MCP-Aufruf
      if (missingIds.length === 0) {
        console.log(`[get_avatar_profiles] ✅ All ${avatar_ids.length} profiles already cached`);
        return avatar_ids
          .filter((id) => state.compressedProfilesById.has(id))
          .map((id) => ({
            avatarId: id,
            ...(state.compressedProfilesById.get(id) as Record<string, unknown>),
          }));
      }

      console.log(`[get_avatar_profiles] 🔄 Fetching ${missingIds.length} missing profiles from MCP`);
      const results = await getMultipleAvatarProfiles(missingIds, clerkToken, mcpApiKey);
      if (Array.isArray(results)) {
        results.forEach((profile: any) => {
          if (profile?.id && profile?.visualProfile) {
            state.avatarProfilesById.set(profile.id, profile.visualProfile);
            state.compressedProfilesById.set(profile.id, {
              name: profile.name,
              ...compressVisualProfile(profile.visualProfile),
            });
          }
          if (profile?.name && profile?.visualProfile) {
            state.avatarProfilesByName.set(profile.name, profile.visualProfile);
          }
        });
      }

      return avatar_ids
        .filter((id) => state.compressedProfilesById.has(id))
        .map((id) => ({
          avatarId: id,
          ...(state.compressedProfilesById.get(id) as Record<string, unknown>),
        }));
    },
    get_avatar_memories: async ({ avatar_id, limit }) => {
      if (!avatar_id || typeof avatar_id !== "string") {
        throw new Error("avatar_id must be provided as string");
      }

      // OPTIMIERT: Wenn bereits gecacht, gib sofort zurück ohne MCP-Aufruf
      if (state.avatarMemoriesById.has(avatar_id)) {
        const cached = state.compressedMemoriesById.get(avatar_id) ?? [];
        console.log(`[get_avatar_memories] ✅ Memories for ${avatar_id} already cached (${cached.length} memories)`);
        return cached;
      }

      console.log(`[get_avatar_memories] 🔄 Fetching memories for ${avatar_id} from MCP`);
      const max = typeof limit === "number" ? Math.min(limit, MAX_TOOL_MEMORIES) : MAX_TOOL_MEMORIES;
      const memories = await getAvatarMemories(avatar_id, clerkToken, mcpApiKey, max);
      if (Array.isArray(memories)) {
        state.avatarMemoriesById.set(avatar_id, memories as McpAvatarMemory[]);
        state.compressedMemoriesById.set(avatar_id, compressMemories(memories as McpAvatarMemory[]));
      } else {
        state.avatarMemoriesById.set(avatar_id, []);
        state.compressedMemoriesById.set(avatar_id, []);
      }

      return state.compressedMemoriesById.get(avatar_id) ?? [];
    },
    validate_story_response: async ({ storyData }) => {
      state.validatorFailures += 1;
      
      // OPTIMIERT: Nach 3 Fehlversuchen ohne Daten, brechen wir ab und fordern explizit die Story an
      if (!storyData) {
        if (state.validatorFailures >= 3) {
          return {
            error: "KRITISCH: validate_story_response wurde 3x ohne storyData aufgerufen. STOPPE Validierungsversuche.",
            hint: "Erstelle ZUERST die vollständige Geschichte, DANN validiere sie. Sende die Geschichte JETZT als JSON-Antwort ohne weitere Tool-Aufrufe.",
            attempts: state.validatorFailures,
            skipValidation: true,
          };
        }
        return {
          error: "storyData ist erforderlich. Beispiel: {\"storyData\": {\"title\": \"...\", \"description\": \"...\", \"chapters\": [...]}}",
          hint: "Sende die vollständige Story im Feld storyData, damit die Validierung funktioniert.",
          attempts: state.validatorFailures,
        };
      }
      
      const validation = await validateStoryResponse(storyData, mcpApiKey);
      state.validationResult = validation;
      
      // KRITISCH: Wenn avatarDevelopments fehlt, gib explizite Anweisungen
      if (!validation.isValid && validation.errors) {
        const missingAvatarDevs = validation.errors.some(
          (err: any) => err.path?.includes("avatarDevelopments")
        );
        
        if (missingAvatarDevs) {
          const avatarNames = avatars.map(a => a.name);
          const errorDetails = validation.errors
            .filter((err: any) => err.path?.includes("avatarDevelopments"))
            .map((err: any) => `Pfad: ${err.path?.join(".")} - ${err.message}`)
            .join("; ");
          
          return {
            ...validation,
            hint: `❌ KRITISCH: avatarDevelopments ist fehlerhaft!
            
Fehler: ${errorDetails}

Du MUSST für JEDEN der ${avatars.length} Avatare GENAU EINEN Eintrag erstellen:
${avatars.map((a, i) => `${i + 1}. "${a.name}"`).join('\n')}

❌ HÄUFIGE FEHLER:
- Zu viele Einträge (${avatars.length} ist Maximum!)
- Zu wenige Einträge (${avatars.length} ist Minimum!)
- Falscher Name verwendet (nutze: ${avatarNames.join(", ")})
- Fehlendes "name" oder "changedTraits" Feld

✅ KORREKTES BEISPIEL für genau ${avatars.length} ${avatars.length === 1 ? 'Avatar' : 'Avatare'}:
[${avatars.map(a => `
  {"name": "${a.name}", "changedTraits": [{"trait": "courage", "change": 5}, {"trait": "empathy", "change": 3}]}`).join(',')}
]`,
          };
        }
      }
      
      return validation;
    },
  };

  while (true) {
    loopIterations++;
    
    // OPTIMIERT: Verhindert endlose Schleifen
    if (loopIterations > MAX_LOOP_ITERATIONS) {
      console.error(`[ai-generation] ABBRUCH: Maximale Loop-Iterationen (${MAX_LOOP_ITERATIONS}) erreicht`);
      throw new Error(`Story-Generierung abgebrochen nach ${MAX_LOOP_ITERATIONS} Iterationen. Möglicherweise Tool-Loop-Problem.`);
    }
    
    const payload = {
      model: MODEL,
      messages,
      tools,
      tool_choice: "auto" as const,
      // gpt-4.1-nano: Max 16384 completion tokens (Modell-Limit)
      // Berechnung: ~2000 Tokens pro Kapitel * 5 = 10k + 4k für Struktur + 2k Buffer
      max_completion_tokens: 16_000,
      response_format: { type: "json_object" },
      // Standard-Parameter fuer gpt-4.1-nano (kein reasoning_effort)
    };

    finalRequest = payload;

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
      usageTotals.prompt += data.usage.prompt_tokens ?? 0;
      usageTotals.completion += data.usage.completion_tokens ?? 0;
      usageTotals.total += data.usage.total_tokens ?? 0;
    }

    const choice = data.choices?.[0];
    if (!choice?.message) {
      throw new Error("Ungültige Antwort von OpenAI (keine Nachricht im vollständigen Ergebnis).");
    }

    const toolCalls = (choice.message as any).tool_calls;
    if (Array.isArray(toolCalls) && toolCalls.length > 0) {
      messages.push(choice.message);

      for (const toolCall of toolCalls) {
        const functionName = toolCall?.function?.name;
        const functionArgs = toolCall?.function?.arguments ?? "{}";

        const handler = toolHandlers[functionName];
        if (!handler) {
          console.warn(`[ai-generation] Unbekanntes Tool angefordert: ${functionName}`);
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: `Tool ${functionName} ist nicht verfügbar.` }),
          });
          continue;
        }

        let parsedArgs: Record<string, any> = {};
        try {
          parsedArgs = JSON.parse(functionArgs || "{}");
        } catch (error) {
          console.error("[ai-generation] Konnte Tool-Argumente nicht parsen:", error);
        }

        try {
          const result = await handler(parsedArgs);
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result ?? {}),
          });
        } catch (error) {
          console.error(`[ai-generation] Toolausführung fehlgeschlagen (${functionName}):`, error);
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({
              error: (error as Error)?.message ?? "Unbekannter Fehler bei Toolausführung",
            }),
          });
        }
      }

      continue;
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
      source: "openai-story-generation-mcp",
      timestamp: new Date(),
      request: finalRequest,
      response: finalResponse,
    });

    return {
      story: parsedStory,
      usage: usageTotals,
      state,
      finalRequest,
      finalResponse,
    };
  }
}

