import { api } from "encore.dev/api";
import { secret } from "encore.dev/config";
import type { StoryConfig, Chapter } from "./generate";
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

// WICHTIG: gpt-5-nano für beste Qualität und Tool-Nutzung
const MODEL = "gpt-5-nano";
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

function buildImagePromptFromVisualProfile(
  visualProfile: AvatarVisualProfile,
  avatarName: string,
  sceneDetails: {
    position?: string;
    expression?: string;
    action?: string;
    clothing?: string;
  }
): string {
  const sections: string[] = [];

  sections.push(
    "masterpiece, best quality, ultra detailed, professional children's book illustration, vibrant colors, perfect lighting"
  );

  sections.push(`character: ${avatarName}`);

  if (visualProfile.ageApprox) {
    sections.push(`age ${visualProfile.ageApprox} years old`);
  }
  if (visualProfile.gender && visualProfile.gender !== "unknown") {
    sections.push(`${visualProfile.gender} child`);
  }

  if (visualProfile.skin) {
    const skinParts: string[] = [];
    if (visualProfile.skin.tone) skinParts.push(`${visualProfile.skin.tone} skin tone`);
    if (visualProfile.skin.undertone) skinParts.push(`${visualProfile.skin.undertone} undertones`);
    if (visualProfile.skin.distinctiveFeatures?.length) {
      skinParts.push(visualProfile.skin.distinctiveFeatures.join(" and "));
    }
    if (skinParts.length) sections.push(`skin: ${skinParts.join(", ")}`);
  }

  if (visualProfile.hair) {
    const hairParts: string[] = [];
    if (visualProfile.hair.color) hairParts.push(`${visualProfile.hair.color} color`);
    if (visualProfile.hair.type) hairParts.push(`${visualProfile.hair.type} texture`);
    if (visualProfile.hair.length) hairParts.push(`${visualProfile.hair.length} length`);
    if (visualProfile.hair.style) hairParts.push(`style: ${visualProfile.hair.style}`);
    if (hairParts.length) sections.push(`hair: ${hairParts.join(", ")}`);
  }

  if (visualProfile.eyes) {
    const eyeParts: string[] = [];
    if (visualProfile.eyes.color) eyeParts.push(`${visualProfile.eyes.color} eyes`);
    if (visualProfile.eyes.shape) eyeParts.push(`${visualProfile.eyes.shape} shape`);
    if (visualProfile.eyes.size) eyeParts.push(`${visualProfile.eyes.size} size`);
    if (eyeParts.length) sections.push(`eyes: ${eyeParts.join(", ")}`);
  }

  if (visualProfile.face) {
    const faceParts: string[] = [];
    if (visualProfile.face.shape) faceParts.push(`${visualProfile.face.shape} face shape`);
    if (visualProfile.face.nose) faceParts.push(`nose: ${visualProfile.face.nose}`);
    if (visualProfile.face.mouth) faceParts.push(`mouth: ${visualProfile.face.mouth}`);
    if (visualProfile.face.eyebrows) faceParts.push(`eyebrows: ${visualProfile.face.eyebrows}`);
    if (visualProfile.face.freckles) faceParts.push("freckles");
    if (visualProfile.face.otherFeatures?.length) {
      faceParts.push(visualProfile.face.otherFeatures.join(" and "));
    }
    if (faceParts.length) sections.push(`face: ${faceParts.join(", ")}`);
  }

  if (visualProfile.accessories?.length) {
    sections.push(`accessories: ${visualProfile.accessories.join(", ")}`);
  }

  if (sceneDetails.clothing) {
    sections.push(`clothing: ${sceneDetails.clothing}`);
  } else if (visualProfile.clothingCanonical) {
    const clothing = visualProfile.clothingCanonical;
    const parts: string[] = [];
    if (clothing.outfit) parts.push(clothing.outfit);
    if (clothing.top) parts.push(`top: ${clothing.top}`);
    if (clothing.bottom) parts.push(`bottom: ${clothing.bottom}`);
    if (clothing.footwear) parts.push(`footwear: ${clothing.footwear}`);
    if (parts.length) sections.push(`clothing: ${parts.join(", ")}`);
  }

  if (sceneDetails.position) sections.push(`position: ${sceneDetails.position}`);
  if (sceneDetails.action) sections.push(`action: ${sceneDetails.action}`);
  if (sceneDetails.expression) sections.push(`expression: ${sceneDetails.expression}`);

  if (visualProfile.consistentDescriptors?.length) {
    sections.push(
      `consistency tokens: ${visualProfile.consistentDescriptors.slice(0, 10).join(", ")}`
    );
  }

  sections.push(
    "style: child friendly illustration, expressive facial features, anatomically correct proportions, high resolution details"
  );

  return sections.join(". ");
}

function buildChapterImagePrompt(
  chapterDesc: ChapterImageDescription | string,
  avatarProfilesByName: Record<string, AvatarVisualProfile>
): string {
  const sections: string[] = [];

  sections.push(
    "masterpiece, best quality, ultra detailed, professional children's book illustration, vibrant colors, perfect lighting"
  );

  // Handle simple string descriptions
  if (typeof chapterDesc === 'string') {
    sections.push(`scene: ${chapterDesc}`);

    // Add all available avatar profiles
    Object.entries(avatarProfilesByName).forEach(([name, profile]) => {
      sections.push(buildImagePromptFromVisualProfile(profile, name, {}));
    });

    return sections.join(". ");
  }

  sections.push(`scene: ${chapterDesc.scene}`);

  const characterPrompts: string[] = [];
  const addedCharacterNames = new Set<string>();

  // Handle both array and object formats for characters
  if (Array.isArray(chapterDesc.characters)) {
    // Characters is an array of names
    chapterDesc.characters.forEach((name: string) => {
      const profile = avatarProfilesByName[name];
      if (profile) {
        characterPrompts.push(buildImagePromptFromVisualProfile(profile, name, {}));
        addedCharacterNames.add(name.toLowerCase());
      }
    });
  } else if (chapterDesc.characters && typeof chapterDesc.characters === 'object') {
    // Characters is an object with details
    Object.entries(chapterDesc.characters).forEach(([name, details]) => {
      const profile = avatarProfilesByName[name];
      if (profile) {
        characterPrompts.push(buildImagePromptFromVisualProfile(profile, name, details as any));
        addedCharacterNames.add(name.toLowerCase());
      }
    });
  }

  console.log(`[buildChapterImagePrompt] Characters from OpenAI: ${addedCharacterNames.size} (${Array.from(addedCharacterNames).join(', ')})`);
  console.log(`[buildChapterImagePrompt] Available avatars: ${Object.keys(avatarProfilesByName).length} (${Object.keys(avatarProfilesByName).join(', ')})`);

  // CRITICAL FIX: Add any missing avatars that weren't included by OpenAI
  // This ensures ALL selected avatars appear in the image, not just what OpenAI returns
  Object.entries(avatarProfilesByName).forEach(([name, profile]) => {
    if (!addedCharacterNames.has(name.toLowerCase())) {
      console.log(`[buildChapterImagePrompt] Missing avatar detected: "${name}" - adding to prompts`);
      const prompt = buildImagePromptFromVisualProfile(profile, name, {});
      console.log(`[buildChapterImagePrompt] Added missing avatar "${name}" - prompt length: ${prompt.length}`);
      characterPrompts.push(prompt);
      addedCharacterNames.add(name.toLowerCase());
    }
  });

  console.log(`[buildChapterImagePrompt] Total character prompts: ${characterPrompts.length}`);

  if (characterPrompts.length) {
    // Join with "AND" for multiple characters to ensure Runware understands both characters should be in the image
    const separator = characterPrompts.length > 1 ? " AND " : "";
    const joinedPrompts = characterPrompts.join(separator);
    console.log(`[buildChapterImagePrompt] Joined character prompts length: ${joinedPrompts.length}`);
    console.log(`[buildChapterImagePrompt] First 200 chars of joined prompts:`, joinedPrompts.substring(0, 200));

    // For multiple characters, add emphasis that BOTH should be visible
    if (characterPrompts.length > 1) {
      const characterNames = Array.from(addedCharacterNames).join(" and ");
      sections.push(`TWO DISTINCT CHARACTERS (${characterNames}) in the same scene: ${joinedPrompts}`);
    } else {
      sections.push(joinedPrompts);
    }
  }

  // Handle environment (string or object)
  if (typeof chapterDesc.environment === 'string') {
    sections.push(`environment: ${chapterDesc.environment}`);
  } else if (chapterDesc.environment) {
    const environmentParts: string[] = [];
    if (chapterDesc.environment.setting) environmentParts.push(`setting: ${chapterDesc.environment.setting}`);
    if (chapterDesc.environment.lighting) environmentParts.push(`lighting: ${chapterDesc.environment.lighting}`);
    if (chapterDesc.environment.atmosphere) environmentParts.push(`atmosphere: ${chapterDesc.environment.atmosphere}`);
    if (chapterDesc.environment.objects?.length) {
      environmentParts.push(`objects: ${chapterDesc.environment.objects.join(", ")}`);
    }
    if (environmentParts.length) {
      sections.push(environmentParts.join(", "));
    }
  }

  // Handle composition (string or object)
  if (typeof chapterDesc.composition === 'string') {
    sections.push(`composition: ${chapterDesc.composition}`);
  } else if (chapterDesc.composition) {
    const compositionParts: string[] = [];
    if (chapterDesc.composition.foreground) compositionParts.push(`foreground: ${chapterDesc.composition.foreground}`);
    if (chapterDesc.composition.background) compositionParts.push(`background: ${chapterDesc.composition.background}`);
    if (chapterDesc.composition.focus) compositionParts.push(`focus: ${chapterDesc.composition.focus}`);
    if (compositionParts.length) {
      sections.push(compositionParts.join(", "));
    }
  }

  sections.push(
    "ensure each character remains visually identical across all images, matching hair color, eye color, face shape, skin tone, and distinctive features"
  );

  const finalPrompt = sections.join(". ");
  console.log(`[buildChapterImagePrompt] Final prompt length: ${finalPrompt.length}`);
  console.log(`[buildChapterImagePrompt] Final prompt (first 500 chars):`, finalPrompt.substring(0, 500));
  console.log(`[buildChapterImagePrompt] Final prompt (last 500 chars):`, finalPrompt.substring(Math.max(0, finalPrompt.length - 500)));

  return finalPrompt;
}

function buildCoverImagePrompt(
  coverDesc: CoverImageDescription | string,
  avatarProfilesByName: Record<string, AvatarVisualProfile>
): string {
  const sections: string[] = [];

  sections.push(
    "masterpiece, best quality, ultra detailed, professional children's book cover illustration, vibrant colors, perfect lighting"
  );

  // Handle simple string descriptions
  if (typeof coverDesc === 'string') {
    sections.push(`main scene: ${coverDesc}`);

    // Add all available avatar profiles
    Object.entries(avatarProfilesByName).forEach(([name, profile]) => {
      sections.push(buildImagePromptFromVisualProfile(profile, name, {}));
    });

    return sections.join(". ");
  }

  sections.push(`main scene: ${coverDesc.mainScene}`);

  const characterPrompts: string[] = [];
  const addedCharacterNames = new Set<string>();

  // Handle both array and object formats for characters
  if (Array.isArray(coverDesc.characters)) {
    // Characters is an array of names
    coverDesc.characters.forEach((name: string) => {
      const profile = avatarProfilesByName[name];
      if (profile) {
        characterPrompts.push(buildImagePromptFromVisualProfile(profile, name, {}));
        addedCharacterNames.add(name.toLowerCase());
      }
    });
  } else if (coverDesc.characters && typeof coverDesc.characters === 'object') {
    // Characters is an object with details
    Object.entries(coverDesc.characters).forEach(([name, details]) => {
      const profile = avatarProfilesByName[name];
      if (profile) {
        characterPrompts.push(
          buildImagePromptFromVisualProfile(profile, name, {
            position: details.position,
            expression: details.expression,
            action: details.pose,
          })
        );
        addedCharacterNames.add(name.toLowerCase());
      }
    });
  }

  console.log(`[buildCoverImagePrompt] Characters from OpenAI: ${addedCharacterNames.size} (${Array.from(addedCharacterNames).join(', ')})`);
  console.log(`[buildCoverImagePrompt] Available avatars: ${Object.keys(avatarProfilesByName).length} (${Object.keys(avatarProfilesByName).join(', ')})`);

  // CRITICAL FIX: Add any missing avatars that weren't included by OpenAI
  // This ensures ALL selected avatars appear in the cover image
  Object.entries(avatarProfilesByName).forEach(([name, profile]) => {
    if (!addedCharacterNames.has(name.toLowerCase())) {
      console.log(`[buildCoverImagePrompt] Missing avatar detected: "${name}" - adding to prompts`);
      characterPrompts.push(buildImagePromptFromVisualProfile(profile, name, {}));
      addedCharacterNames.add(name.toLowerCase());
    }
  });

  console.log(`[buildCoverImagePrompt] Total character prompts: ${characterPrompts.length}`);

  if (characterPrompts.length) {
    // Join with "AND" for multiple characters to ensure Runware understands both characters should be in the image
    const separator = characterPrompts.length > 1 ? " AND " : "";
    const joinedPrompts = characterPrompts.join(separator);

    // For multiple characters, add emphasis that ALL should be visible
    if (characterPrompts.length > 1) {
      const characterNames = Array.from(addedCharacterNames).join(" and ");
      sections.push(`${characterPrompts.length} DISTINCT CHARACTERS (${characterNames}) in the same scene: ${joinedPrompts}`);
    } else {
      sections.push(joinedPrompts);
    }
  }

  // Handle environment (string or object)
  if (typeof coverDesc.environment === 'string') {
    sections.push(`environment: ${coverDesc.environment}`);
  } else if (coverDesc.environment) {
    const environmentParts: string[] = [];
    if (coverDesc.environment.setting) environmentParts.push(`setting: ${coverDesc.environment.setting}`);
    if (coverDesc.environment.mood) environmentParts.push(`mood: ${coverDesc.environment.mood}`);
    if (coverDesc.environment.colorPalette?.length) {
      environmentParts.push(`color palette: ${coverDesc.environment.colorPalette.join(", ")}`);
    }
    if (environmentParts.length) sections.push(environmentParts.join(", "));
  }

  // Handle composition (string or object)
  if (typeof coverDesc.composition === 'string') {
    sections.push(`composition: ${coverDesc.composition}`);
  } else if (coverDesc.composition) {
    const compositionParts: string[] = [];
    if (coverDesc.composition.layout) compositionParts.push(`layout: ${coverDesc.composition.layout}`);
    if (coverDesc.composition.titleSpace) compositionParts.push(`title space: ${coverDesc.composition.titleSpace}`);
    if (coverDesc.composition.visualFocus) compositionParts.push(`focus: ${coverDesc.composition.visualFocus}`);
    if (compositionParts.length) {
      sections.push(compositionParts.join(", "));
    }
  }

  sections.push(
    "style: cinematic, dynamic composition, clear space for title, consistent character appearance, inviting and warm"
  );

  return sections.join(". ");
}

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
      console.log("[ai-generation] Generating story with MCP integration");

      const avatarIds = req.avatarDetails.map((avatar) => avatar.id);
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

      let validationResult = storyOutcome.state.validationResult;
      if (!validationResult) {
        validationResult = await validateStoryResponse(storyOutcome.story, mcpApiKey);
      }

      if (!validationResult?.isValid) {
        throw new Error(
          `Story validation failed: ${JSON.stringify(validationResult?.errors ?? {})}`
        );
      }

      const normalizedStory = validationResult.normalized ?? storyOutcome.story;

      const avatarProfilesByName: Record<string, AvatarVisualProfile> = {};
      storyOutcome.state.avatarProfilesByName.forEach((profile, name) => {
        avatarProfilesByName[name] = profile;
      });

      if (Object.keys(avatarProfilesByName).length === 0) {
        console.warn("[ai-generation] Keine Avatarprofile über Tool-Aufrufe erhalten – Fallback auf direkten MCP-Aufruf.");
        const fallbackProfiles = await getMultipleAvatarProfiles(avatarIds, req.clerkToken, mcpApiKey);
        (fallbackProfiles as McpAvatarProfile[] | undefined)?.forEach((profile) => {
          if (profile?.name && profile.visualProfile) {
            avatarProfilesByName[profile.name] = profile.visualProfile;
          }
        });
      }

      console.log(`[ai-generation] Avatar profiles verfügbar:`, {
        count: Object.keys(avatarProfilesByName).length,
        names: Object.keys(avatarProfilesByName),
        requestedAvatarIds: avatarIds,
      });

      const seedBase = deterministicSeedFrom(avatarIds.join("|"));
      const coverDimensions = normalizeRunwareDimensions(600, 800);
      const chapterDimensions = normalizeRunwareDimensions(512, 512);

      const coverPrompt = buildCoverImagePrompt(
        normalizedStory.coverImageDescription,
        avatarProfilesByName
      );

      const coverResponse = await ai.generateImage({
        prompt: coverPrompt,
        model: "runware:101@1",
        width: coverDimensions.width,
        height: coverDimensions.height,
        steps: 35,
        CFGScale: 9,
        seed: seedBase,
        outputFormat: "WEBP",
        negativePrompt:
          "blurry, low quality, bad anatomy, distorted faces, extra limbs, missing limbs, adult content, horror, violence, text, watermark, inconsistent character, wrong colors",
      });

      const chapterResponses: Array<{ imageUrl?: string }> = [];
      for (let i = 0; i < normalizedStory.chapters.length; i++) {
        const chapter = normalizedStory.chapters[i];
        const chapterPrompt = buildChapterImagePrompt(
          chapter.imageDescription,
          avatarProfilesByName
        );

        const chapterResponse = await ai.generateImage({
          prompt: chapterPrompt,
          model: "runware:101@1",
          width: chapterDimensions.width,
          height: chapterDimensions.height,
          steps: 32,
          CFGScale: 8.5,
          seed: (seedBase + i * 101) >>> 0,
          outputFormat: "WEBP",
          negativePrompt:
            "blurry, low quality, bad anatomy, distorted faces, extra limbs, missing limbs, adult content, horror, violence, text, watermark, inconsistent character, wrong colors",
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

async function generateStoryWithOpenAITools(args: {
  config: StoryConfig;
  avatars: ExtendedAvatarDetails[];
  clerkToken: string;
  mcpApiKey: string;
}): Promise<StoryToolOutcome> {
  const { config, avatars, clerkToken, mcpApiKey } = args;

  const chapterCount = config.length === "short" ? 3 : config.length === "medium" ? 5 : 8;

  // OPTIMIERT: Kürzerer, klarerer System-Prompt ohne redundante Anweisungen
  const systemPrompt = `Du bist eine Autorin für die Talea-Geschichtenplattform. Nutze konsequent die verfügbaren Tools, um Avatar-Informationen, Erinnerungen und Validierungen aus den MCP-Servern abzurufen. Workflow: 1. Rufe \`get_avatar_profiles\` auf, bevor du Beschreibungen oder Bildprompts formulierst, um visuelle Konsistenz sicherzustellen. 2. Hole mit \`get_avatar_memories\` relevante Erinnerungen jedes Avatars, bevor du die Geschichte schreibst. 3. Erstelle eine spannende Geschichte mit Cliffhanger am Ende jedes Kapitels im JSON-Format. 4. Prüfe deine fertige JSON-Antwort mit \`validate_story_response\`. Korrigiere bei Bedarf und prüfe erneut. 5. Gib erst nach erfolgreicher Validierung die finale JSON-Antwort zurück. Wichtig: Antworte niemals mit freiem Text, sondern ausschließlich mit gültigem JSON.`;

  const avatarSummary = avatars
    .map((avatar) => {
      const description = avatar.description ? avatar.description.trim() : "Keine Beschreibung vorhanden.";
      return `- ${avatar.name} (id: ${avatar.id}): ${description}`;
    })
    .join("\n");

  const userPrompt = `Erstelle eine ${config.genre}-Geschichte im Setting ${config.setting} für die Altersgruppe ${config.ageGroup}. Die Geschichte soll ${chapterCount} Kapitel haben und die Hauptcharaktere konsequent nutzen.

Konfigurationsdetails:
- Komplexität: ${config.complexity}
- Lernmodus aktiviert: ${config.learningMode?.enabled ?? false}
- Lernziele: ${(config.learningMode?.learningObjectives ?? []).join(", ") || "keine spezifischen Lernziele angegeben"}

Verfügbare Avatare:
${avatarSummary}

Nutze die Tools, um alle notwendigen Detailinformationen abzurufen. Die finale Antwort muss folgende Felder enthalten: title, description, chapters[{title, content, order, imageDescription:{scene,characters,environment,composition}}], coverImageDescription, avatarDevelopments, learningOutcomes.`;

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
      // OPTIMIERT: Reduziert von 24k auf 16k - ausreichend für 5-8 Kapitel, spart Reasoning-Overhead
      max_completion_tokens: 16_000,
      response_format: { type: "json_object" },
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
      parsedStory = JSON.parse(cleanContent);
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
