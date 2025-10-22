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
} from "../helpers/mcpClient";

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

function summarizeMemoriesForPrompt(memories?: McpAvatarMemory[]): string {
  if (!memories || memories.length === 0) {
    return "";
  }

  const topMemories = memories.slice(0, 3);
  const summaries = topMemories.map((memory) => {
    const changes = (memory.personalityChanges || [])
      .map((change) => `${change.trait} ${change.change > 0 ? "+" : ""}${change.change}`)
      .join(", ");
    const changeSummary = changes ? ` (traits: ${changes})` : "";
    return `${memory.experience}${changeSummary}`;
  });

  return summaries.join("; ");
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

  // Handle both array and object formats for characters
  if (Array.isArray(chapterDesc.characters)) {
    // Characters is an array of names
    chapterDesc.characters.forEach((name: string) => {
      const profile = avatarProfilesByName[name];
      if (profile) {
        characterPrompts.push(buildImagePromptFromVisualProfile(profile, name, {}));
      }
    });
  } else if (chapterDesc.characters && typeof chapterDesc.characters === 'object') {
    // Characters is an object with details
    Object.entries(chapterDesc.characters).forEach(([name, details]) => {
      const profile = avatarProfilesByName[name];
      if (profile) {
        characterPrompts.push(buildImagePromptFromVisualProfile(profile, name, details as any));
      }
    });
  }

  if (characterPrompts.length) {
    sections.push(characterPrompts.join(" || "));
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

  return sections.join(". ");
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

  // Handle both array and object formats for characters
  if (Array.isArray(coverDesc.characters)) {
    // Characters is an array of names
    coverDesc.characters.forEach((name: string) => {
      const profile = avatarProfilesByName[name];
      if (profile) {
        characterPrompts.push(buildImagePromptFromVisualProfile(profile, name, {}));
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
      }
    });
  }

  if (characterPrompts.length) {
    sections.push(characterPrompts.join(" || "));
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

      const profilePromise = getMultipleAvatarProfiles(avatarIds, req.clerkToken, mcpApiKey);
      const memoryPromises = avatarIds.map((avatarId) =>
        getAvatarMemories(avatarId, req.clerkToken, mcpApiKey, 20).catch(() => [])
      );

      const [profileResults, memoryResults] = await Promise.all([
        profilePromise,
        Promise.all(memoryPromises),
      ]);

      const avatarProfilesByName: Record<string, AvatarVisualProfile> = {};
      (profileResults as McpAvatarProfile[] | undefined)?.forEach((profile) => {
        if (profile?.name && profile.visualProfile) {
          avatarProfilesByName[profile.name] = profile.visualProfile;
        }
      });

      const avatarMemoriesById = new Map<string, McpAvatarMemory[]>();
      memoryResults.forEach((memories, index) => {
        const avatarId = avatarIds[index];
        avatarMemoriesById.set(
          avatarId,
          (Array.isArray(memories) ? memories : []) as McpAvatarMemory[]
        );
      });

      const avatarDetailsWithContext = req.avatarDetails.map((avatar) => ({
        ...avatar,
        memories: avatarMemoriesById.get(avatar.id) ?? [],
      }));

      const storyResult = await generateEnhancedStoryWithOpenAI(
        req.config,
        avatarDetailsWithContext
      );

      metadata.tokensUsed = storyResult.tokensUsed ?? {
        prompt: 0,
        completion: 0,
        total: 0,
      };

      const outputTokens = metadata.tokensUsed.completion;
      metadata.totalCost.text =
        (metadata.tokensUsed.prompt / 1_000_000) * INPUT_COST_PER_1M +
        (outputTokens / 1_000_000) * OUTPUT_COST_PER_1M;

      const validationResult = await validateStoryResponse(storyResult, mcpApiKey);
      if (!validationResult?.isValid) {
        throw new Error(
          `Story validation failed: ${JSON.stringify(validationResult?.errors ?? {})}`
        );
      }

      const normalizedStory = validationResult.normalized ?? storyResult;

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

async function generateEnhancedStoryWithOpenAI(
  config: StoryConfig,
  avatars: ExtendedAvatarDetails[]
): Promise<{
  title: string;
  description: string;
  chapters: (Omit<Chapter, "id" | "imageUrl"> & {
    imageDescription: ChapterImageDescription;
  })[];
  coverImageDescription: CoverImageDescription;
  avatarDevelopments: AvatarDevelopment[];
  learningOutcomes: LearningOutcome[];
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };
}> {
  const chapterCount =
    config.length === "short" ? 3 : config.length === "medium" ? 5 : 8;

  const characterContext = avatars
    .map((avatar) => {
      const memories = summarizeMemoriesForPrompt(avatar.memories);
      const memoryText = memories ? `\nErinnerungen: ${memories}` : "";
      return `${avatar.name}: ${avatar.description}${memoryText}`;
    })
    .join("\n\n");

  const systemPrompt =
    "Erstelle eine fesselnde Kindergeschichte. Kapitel enden mit Cliffhanger. Show don't tell. Halte dich an Avatar-Beschreibungen. Antworte nur mit JSON.";

  const userPrompt = `${config.genre}-Geschichte im ${config.setting} fuer ${config.ageGroup}. ${chapterCount} Kapitel.

CHARAKTERE:
${characterContext}

PERSONLICHKEITS-UPDATE-SYSTEM:
Analysiere die generierte Geschichte und bestimme welche Merkmale sich bei jedem Charakter entwickeln sollen.

BASIS-MERKMALE (verwende diese exakten IDs):
courage, intelligence, creativity, empathy, strength, humor, adventure, patience, curiosity, leadership, teamwork

WISSENS-MERKMALE (verwende knowledge.BEREICH):
knowledge.biology, knowledge.history, knowledge.physics, knowledge.geography, knowledge.astronomy, knowledge.mathematics, knowledge.chemistry

PUNKTE-VERGABE:
- Basis-Merkmale: 1-5 Punkte (je nach Relevanz zur Geschichte)
- Wissens-Merkmale: 1-10 Punkte (je nach Lerninhalt)
- Hauptcharaktere: Mehr Punkte als Nebencharaktere

ANTWORT-FORMAT:
Gib nur JSON zurueck mit: title, description, chapters[{title,content,order,imageDescription:{scene,characters,environment,composition}}], coverImageDescription, avatarDevelopments, learningOutcomes.

avatarDevelopments muss folgendes Format haben:
[{ "name": "Avatar-Name", "changedTraits": [{ "trait": "MERKMAL_ID", "change": PUNKTE }] }]`;

  const payload = {
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_completion_tokens: 24_000,
    response_format: { type: "json_object" },
  };

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

  const data = await response.json();

  await publishWithTimeout(logTopic, {
    source: "openai-story-generation-mcp",
    timestamp: new Date(),
    request: payload,
    response: data,
  });

  const choice = data.choices?.[0];
  if (!choice) {
    throw new Error("Ungueltige Antwort von OpenAI (keine choices)");
  }

  if (choice.finish_reason === "content_filter") {
    throw new Error("Die Anfrage wurde vom OpenAI Inhaltsfilter blockiert.");
  }

  if (choice.finish_reason === "length") {
    throw new Error(
      "Die Story-Generierung wurde wegen Token-Limit abgeschnitten. Bitte versuche es mit kuerzeren Einstellungen."
    );
  }

  const content = choice.message?.content;
  if (!content) {
    throw new Error(`Leere Antwort von OpenAI (Finish Reason: ${choice.finish_reason})`);
  }

  let parsed;
  try {
    const cleanContent = content.replace(/```json\s*/g, "").replace(/```$/g, "").trim();
    parsed = JSON.parse(cleanContent);
  } catch (error) {
    throw new Error(
      `JSON Parse Fehler: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return {
    ...parsed,
    tokensUsed: {
      prompt: data.usage?.prompt_tokens ?? 0,
      completion: data.usage?.completion_tokens ?? 0,
      total: data.usage?.total_tokens ?? 0,
    },
  };
}
