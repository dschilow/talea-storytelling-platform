/**
 * AI Story Generation with MCP Integration
 *
 * This is an ENHANCED VERSION of ai-generation.ts that integrates with MCP servers
 * for consistent avatar appearances and memories.
 *
 * Key improvements:
 * 1. Fetches avatar visual profiles from MCP Main Server
 * 2. Uses visual profiles for EVERY image generation (cover + chapters)
 * 3. Validates story responses with MCP Validator
 * 4. Stores memories via MCP after story completion
 */

import { api } from "encore.dev/api";
import { secret } from "encore.dev/config";
import type { StoryConfig, Chapter } from "../backend/story/generate";
import type { Avatar, AvatarVisualProfile } from "../backend/avatar/avatar";
import { runwareGenerateImage } from "../backend/ai/image-generation";
import { buildCompleteImagePrompt } from "../backend/story/character-block-builder";
import { logTopic } from "../backend/log/logger";
import { publishWithTimeout } from "../backend/helpers/pubsubTimeout";
import {
  getMultipleAvatarProfiles,
  validateStoryResponse,
  addAvatarMemoryViaMcp,
} from "../backend/helpers/mcpClient";

// ---- OpenAI Modell & Pricing ----
const MODEL = "gpt-5-mini";
const INPUT_COST_PER_1M = 5.0;
const OUTPUT_COST_PER_1M = 15.0;

const openAIKey = secret("OpenAIKey");
const mcpServerApiKey = secret("MCPServerAPIKey");

type ExtendedAvatarDetails = Omit<
  Avatar,
  "userId" | "isShared" | "originalAvatarId" | "createdAt" | "updatedAt"
> & {
  memory?: {
    experiences: string[];
    learnedSkills: string[];
    personalGrowth: string[];
    relationships: Record<string, string>;
  };
  currentLevel?: {
    knowledge: number;
    emotional: number;
    social: number;
    creativity: number;
  };
};

interface GenerateStoryContentRequest {
  config: StoryConfig;
  avatarDetails: ExtendedAvatarDetails[];
  clerkToken: string; // Added for MCP authentication
}

interface ChapterImageDescription {
  scene: string;
  characters: {
    [name: string]: {
      position: string;
      expression: string;
      action: string;
      clothing: string;
    };
  };
  environment: {
    setting: string;
    lighting: string;
    atmosphere: string;
    objects: string[];
  };
  composition?: {
    foreground: string;
    background: string;
    focus: string;
  };
}

interface CoverImageDescription {
  mainScene: string;
  characters: {
    [name: string]: {
      position: string;
      expression: string;
      pose: string;
    };
  };
  environment: {
    setting: string;
    mood: string;
    colorPalette: string[];
  };
  composition?: {
    layout: string;
    titleSpace: string;
    visualFocus: string;
  };
}

interface AvatarDevelopment {
  avatarId: string;
  name: string;
  changedTraits: {
    [trait: string]: {
      before: number;
      after: number;
      reason: string;
    };
  };
  newSkills: string[];
  personalGrowth: string[];
  memoryAdditions: {
    experiences: string[];
    relationships: Record<string, string>;
  };
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

// Vielfache-von-64 Hilfsfunktion für Runware
function normalizeRunwareDimensions(
  width: number,
  height: number
): { width: number; height: number } {
  const roundToMultiple64 = (n: number) => Math.round(n / 64) * 64;
  const normalizedWidth = Math.max(128, Math.min(2048, roundToMultiple64(width)));
  const normalizedHeight = Math.max(128, Math.min(2048, roundToMultiple64(height)));
  return { width: normalizedWidth, height: normalizedHeight };
}

// Deterministischer Seed
function deterministicSeedFrom(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash >>> 0) * 0x01000193;
  }
  return Math.abs(hash >>> 0);
}

/**
 * NEW: Build structured image prompt using MCP-fetched Visual Profiles
 */
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

  // 1. Quality header
  sections.push(
    "masterpiece, best quality, ultra detailed, professional children's book illustration, Disney Pixar 3D style, vibrant colors, perfect lighting"
  );

  // 2. Character name
  sections.push(`CHARACTER: ${avatarName}`);

  // 3. Age & Gender
  if (visualProfile.ageApprox) {
    sections.push(`age ${visualProfile.ageApprox} years old`);
  }
  if (visualProfile.gender && visualProfile.gender !== "unknown") {
    sections.push(`${visualProfile.gender} character`);
  }

  const descriptorText =
    (visualProfile.consistentDescriptors || []).join(" ").toLowerCase();
  let species: "cat" | "dog" | "human" | "animal" | "unknown" = "unknown";
  if (descriptorText.includes("cat") || descriptorText.includes("kitten")) {
    species = "cat";
  } else if (descriptorText.includes("dog") || descriptorText.includes("puppy")) {
    species = "dog";
  } else if (
    descriptorText.includes("human") ||
    descriptorText.includes("boy") ||
    descriptorText.includes("girl")
  ) {
    species = "human";
  } else if (descriptorText.includes("animal")) {
    species = "animal";
  }

  if (species === "cat") {
    sections.push(
      "SPECIES: non-anthropomorphic cat on four paws, tail visible, natural fur patterns, no clothing, whiskers present, no human traits"
    );
  } else if (species === "dog") {
    sections.push(
      "SPECIES: non-anthropomorphic dog on four paws, tail visible, natural fur, no clothing"
    );
  } else if (species === "human") {
    sections.push(
      "SPECIES: human child, skin visible, no fur, no whiskers, no animal ears or tail"
    );
  }

  // 4. Skin details
  const skinDesc: string[] = [];
  if (visualProfile.skin?.tone)
    skinDesc.push(`${visualProfile.skin.tone} skin tone`);
  if (visualProfile.skin?.undertone)
    skinDesc.push(`${visualProfile.skin.undertone} undertones`);
  if (visualProfile.skin?.distinctiveFeatures?.length) {
    skinDesc.push(visualProfile.skin.distinctiveFeatures.join(" and "));
  }
  if (skinDesc.length) sections.push(`SKIN: ${skinDesc.join(", ")}`);

  // 5. Hair details (CRITICAL for consistency)
  const hairDesc: string[] = [];
  if (visualProfile.hair?.color)
    hairDesc.push(`${visualProfile.hair.color} color`);
  if (visualProfile.hair?.type)
    hairDesc.push(`${visualProfile.hair.type} texture`);
  if (visualProfile.hair?.length)
    hairDesc.push(`${visualProfile.hair.length} length`);
  if (visualProfile.hair?.style)
    hairDesc.push(`styled: ${visualProfile.hair.style}`);
  if (hairDesc.length) sections.push(`HAIR: ${hairDesc.join(", ")}`);

  // 6. Eye details
  const eyeDesc: string[] = [];
  if (visualProfile.eyes?.color)
    eyeDesc.push(`${visualProfile.eyes.color} colored`);
  if (visualProfile.eyes?.shape)
    eyeDesc.push(`${visualProfile.eyes.shape} shaped`);
  if (visualProfile.eyes?.size)
    eyeDesc.push(`${visualProfile.eyes.size} sized`);
  if (eyeDesc.length) sections.push(`EYES: ${eyeDesc.join(", ")}`);

  // 7. Face details
  const faceDesc: string[] = [];
  if (visualProfile.face?.shape)
    faceDesc.push(`${visualProfile.face.shape} face shape`);
  if (visualProfile.face?.nose) faceDesc.push(`nose: ${visualProfile.face.nose}`);
  if (visualProfile.face?.mouth)
    faceDesc.push(`mouth: ${visualProfile.face.mouth}`);
  if (visualProfile.face?.eyebrows)
    faceDesc.push(`eyebrows: ${visualProfile.face.eyebrows}`);
  if (visualProfile.face?.freckles) faceDesc.push("with freckles");
  if (visualProfile.face?.otherFeatures?.length) {
    faceDesc.push(visualProfile.face.otherFeatures.join(" and "));
  }
  if (faceDesc.length) sections.push(`FACE: ${faceDesc.join(", ")}`);

  // 8. Accessories
  if (visualProfile.accessories?.length) {
    sections.push(`ACCESSORIES: ${visualProfile.accessories.join(", ")}`);
  }

  // 9. Clothing
  if (sceneDetails.clothing) {
    sections.push(`CLOTHING: ${sceneDetails.clothing}`);
  } else if (visualProfile.clothingCanonical?.outfit) {
    sections.push(`CLOTHING: ${visualProfile.clothingCanonical.outfit}`);
  } else if (
    visualProfile.clothingCanonical?.top ||
    visualProfile.clothingCanonical?.bottom
  ) {
    const clothingParts: string[] = [];
    if (visualProfile.clothingCanonical.top)
      clothingParts.push(`top: ${visualProfile.clothingCanonical.top}`);
    if (visualProfile.clothingCanonical.bottom)
      clothingParts.push(`bottom: ${visualProfile.clothingCanonical.bottom}`);
    sections.push(`CLOTHING: ${clothingParts.join(", ")}`);
  }

  // 10. Scene-specific details
  if (sceneDetails.position) {
    sections.push(`POSITION: ${sceneDetails.position}`);
  }
  if (sceneDetails.action) {
    sections.push(`ACTION: ${sceneDetails.action}`);
  }
  if (sceneDetails.expression) {
    sections.push(`EXPRESSION: ${sceneDetails.expression}`);
  }

  // 11. Consistency tokens (CRITICAL)
  if (visualProfile.consistentDescriptors?.length) {
    const tokens = visualProfile.consistentDescriptors.slice(0, 10).join(", ");
    sections.push(`CHARACTER CONSISTENCY CRITICAL: [${tokens}]`);
  }

  // 12. Style enforcement
  sections.push(
    "child-friendly illustration, expressive facial features, anatomically correct proportions, high resolution details, clean composition, Disney animation quality"
  );

  return sections.join(". ");
}

/**
 * Build chapter image prompt with MCP visual profiles
 */
function buildChapterImagePrompt(
  chapterDesc: ChapterImageDescription,
  avatarProfilesByName: Record<string, AvatarVisualProfile>
): string {
  const rawCharacters = chapterDesc?.characters as any;
  const baseEntries =
    rawCharacters && typeof rawCharacters === "object" && !Array.isArray(rawCharacters)
      ? Object.entries(rawCharacters)
      : Object.entries(avatarProfilesByName).map(([name]) => [name, {} as any]);

  const characters = baseEntries
    .map(([name, rawDetails], index) => {
      const profile = avatarProfilesByName[name];
      if (!profile) {
        console.warn(`[MCP] Missing visual profile for ${name} - skipping character prompt entry`);
        return null;
      }

      const details =
        rawDetails && typeof rawDetails === "object" ? { ...rawDetails } : {};

      if (!details.position) {
        details.position =
          index === 0
            ? "left third of frame"
            : index === 1
            ? "right third of frame"
            : "midground";
      }

      return {
        name,
        profile,
        sceneDetails: {
          position: details.position,
          action: details.action,
          expression: details.expression,
        },
      };
    })
    .filter(
      (entry): entry is {
        name: string;
        profile: AvatarVisualProfile;
        sceneDetails: { position: any; action: any; expression: any };
      } => entry !== null
    );

  if (characters.length === 0) {
    characters.push(
      ...Object.entries(avatarProfilesByName).map(([name, profile], index) => ({
        name,
        profile,
        sceneDetails: {
          position:
            index === 0
              ? "left third of frame"
              : index === 1
              ? "right third of frame"
              : "midground",
          action: undefined,
          expression: undefined,
        },
      }))
    );
  }

  const sceneParts: string[] = [];
  if (chapterDesc?.scene) {
    sceneParts.push(chapterDesc.scene);
  }
  if (chapterDesc?.environment?.setting) {
    sceneParts.push(`Setting: ${chapterDesc.environment.setting}`);
  }
  if (chapterDesc?.environment?.lighting) {
    sceneParts.push(`Lighting: ${chapterDesc.environment.lighting}`);
  }
  if (chapterDesc?.environment?.atmosphere) {
    sceneParts.push(`Atmosphere: ${chapterDesc.environment.atmosphere}`);
  }
  if (chapterDesc?.environment?.objects?.length) {
    sceneParts.push(
      `Key objects: ${chapterDesc.environment.objects.join(", ")}`
    );
  }
  if (chapterDesc?.composition) {
    sceneParts.push(
      `Composition: foreground ${chapterDesc.composition.foreground || "main characters"}, background ${chapterDesc.composition.background || "storybook setting"}, focus ${chapterDesc.composition.focus || "character interaction"}`
    );
  }

  return buildCompleteImagePrompt({
    characters,
    scene: sceneParts.join(". "),
  });
}

/**
 * Build cover image prompt with MCP visual profiles
 */
function buildCoverImagePrompt(
  coverDesc: CoverImageDescription,
  avatarProfilesByName: Record<string, AvatarVisualProfile>
): string {
  const rawCharacters = coverDesc?.characters as any;
  const baseEntries =
    rawCharacters && typeof rawCharacters === "object" && !Array.isArray(rawCharacters)
      ? Object.entries(rawCharacters)
      : Object.entries(avatarProfilesByName).map(([name]) => [name, {} as any]);

  const characters = baseEntries
    .map(([name, rawDetails], index) => {
      const profile = avatarProfilesByName[name];
      if (!profile) {
        console.warn(`[MCP] Missing visual profile for ${name} - skipping character prompt entry`);
        return null;
      }

      const details =
        rawDetails && typeof rawDetails === "object" ? { ...rawDetails } : {};

      if (!details.position) {
        details.position =
          index === 0
            ? "foreground left"
            : index === 1
            ? "foreground right"
            : "midground";
      }

      return {
        name,
        profile,
        sceneDetails: {
          position: details.position,
          action: details.pose ?? details.action,
          expression: details.expression,
        },
      };
    })
    .filter(
      (entry): entry is {
        name: string;
        profile: AvatarVisualProfile;
        sceneDetails: { position: any; action: any; expression: any };
      } => entry !== null
    );

  if (characters.length === 0) {
    characters.push(
      ...Object.entries(avatarProfilesByName).map(([name, profile], index) => ({
        name,
        profile,
        sceneDetails: {
          position:
            index === 0
              ? "foreground left"
              : index === 1
              ? "foreground right"
              : "midground",
          action: undefined,
          expression: undefined,
        },
      }))
    );
  }

  const sceneParts: string[] = [];
  if (coverDesc?.mainScene) {
    sceneParts.push(coverDesc.mainScene);
  }
  if (coverDesc?.environment?.setting) {
    sceneParts.push(`Setting: ${coverDesc.environment.setting}`);
  }
  if (coverDesc?.environment?.mood) {
    sceneParts.push(`Mood: ${coverDesc.environment.mood}`);
  }
  if (coverDesc?.environment?.colorPalette?.length) {
    sceneParts.push(
      `Color palette: ${coverDesc.environment.colorPalette.join(", ")}`
    );
  }

  const customStyle = {
    composition:
      coverDesc?.composition
        ? `cover layout ${coverDesc.composition.layout || "balanced"}, title space ${coverDesc.composition.titleSpace || "top"}, focus ${coverDesc.composition.visualFocus || "main characters"}`
        : "story cover, title space top, all characters visible",
    style: "storybook cover, warm inviting colors",
    quality: `${characters.length} subjects, child-safe illustration`,
  };

  return buildCompleteImagePrompt({
    characters,
    scene: sceneParts.join(". "),
    customStyle,
  });
}

export const generateStoryContentWithMcp = api<
  GenerateStoryContentRequest,
  GenerateStoryContentResponse
>(
  { expose: true, method: "POST", path: "/ai/generate-story-mcp" },
  async (req) => {
    const startTime = Date.now();
    const metadata: GenerateStoryContentResponse["metadata"] = {
      tokensUsed: { prompt: 0, completion: 0, total: 0 },
      model: MODEL,
      processingTime: 0,
      imagesGenerated: 0,
      totalCost: { text: 0, images: 0, total: 0 },
    };

    try {
      console.log("📚 [ai-generation-mcp] Generate story start WITH MCP");

      // STEP 1: Fetch visual profiles from MCP Main Server
      console.log("🔍 [MCP] Fetching visual profiles for all avatars...");
      const avatarIds = req.avatarDetails.map((a) => a.id);
      const mcpProfiles = await getMultipleAvatarProfiles(
        avatarIds,
        req.clerkToken,
        mcpServerApiKey()
      ) as any[];

      // Build name -> visualProfile map
      const avatarProfilesByName: Record<string, AvatarVisualProfile> = {};
      mcpProfiles.forEach((profile: any) => {
        if (profile.visualProfile) {
          avatarProfilesByName[profile.name] = profile.visualProfile;
          console.log(`✅ [MCP] Loaded visual profile for ${profile.name}`);
        } else {
          console.warn(`⚠️ [MCP] No visual profile for ${profile.name}`);
        }
      });

      console.log(
        `📊 [MCP] Loaded ${Object.keys(avatarProfilesByName).length} visual profiles`
      );

      // STEP 2: Generate story with OpenAI (existing logic)
      const storyResult = await generateEnhancedStoryWithOpenAI(
        req.config,
        req.avatarDetails
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

      // Ensure all chapters have an 'order' field before validation
      if (storyResult.chapters && Array.isArray(storyResult.chapters)) {
        storyResult.chapters = storyResult.chapters.map((ch: any, idx: number) => ({
          ...ch,
          order: ch.order ?? idx
        }));
      }

      // Ensure description is max 500 characters (validator requirement)
      if (storyResult.description && storyResult.description.length > 500) {
        storyResult.description = storyResult.description.substring(0, 497) + '...';
        console.log('[ai-generation-mcp] ✂️ Description truncated to 500 characters');
      }

      // STEP 3: Validate story response with MCP Validator
      console.log("🔍 [MCP Validator] Validating story response...");
      const validationResult = await validateStoryResponse(storyResult, mcpServerApiKey());

      if (!validationResult.isValid) {
        console.error("❌ [MCP Validator] Story validation failed:", validationResult.errors);
        throw new Error(
          `Story validation failed: ${JSON.stringify(validationResult.errors)}`
        );
      }

      console.log("✅ [MCP Validator] Story response is valid");

      // Use normalized data if available
      const normalizedStory = validationResult.normalized || storyResult;

      // STEP 4: Generate images with MCP visual profiles
      console.log("🖼️ [ai-generation-mcp] Generating images with MCP profiles...");

      const seedBase = deterministicSeedFrom(avatarIds.join("|"));
      const coverDimensions = normalizeRunwareDimensions(1024, 1024);
      const chapterDimensions = normalizeRunwareDimensions(1024, 1024);

      // Cover image with MCP profiles
      const coverPrompt = buildCoverImagePrompt(
        normalizedStory.coverImageDescription,
        avatarProfilesByName
      );
      console.log(`🎨 [MCP] Cover prompt length: ${coverPrompt.length}`);

      const coverResponse = await runwareGenerateImage({
        prompt: coverPrompt,
        model: "runware:101@1",
        width: coverDimensions.width,
        height: coverDimensions.height,
        steps: 28,
        CFGScale: 3.5,
        seed: seedBase,
        outputFormat: "JPEG",
      });

      // Chapter images with MCP profiles
      const chapterResponses: Array<{ imageUrl?: string }> = [];
      for (let i = 0; i < normalizedStory.chapters.length; i++) {
        const chapter = normalizedStory.chapters[i];
        const chapterPrompt = buildChapterImagePrompt(
          chapter.imageDescription,
          avatarProfilesByName
        );

        console.log(
          `🎨 [MCP] Chapter ${i + 1} prompt length: ${chapterPrompt.length}`
        );

        const chapterResponse = await runwareGenerateImage({
          prompt: chapterPrompt,
          model: "runware:101@1",
          width: chapterDimensions.width,
          height: chapterDimensions.height,
          steps: 28,
          CFGScale: 3.5,
          seed: (seedBase + (i + 1) * 7) >>> 0,
          outputFormat: "JPEG",
        });

        chapterResponses.push(chapterResponse);

        // Pause between generations
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      const chaptersWithImages = normalizedStory.chapters.map((chapter: any, index: number) => ({
        ...chapter,
        imageUrl: chapterResponses[index]?.imageUrl || "",
      }));

      metadata.imagesGenerated = 1 + chapterResponses.length;
      metadata.totalCost.images = metadata.imagesGenerated * 0.0008;
      metadata.totalCost.total = metadata.totalCost.text + metadata.totalCost.images;
      metadata.processingTime = Date.now() - startTime;

      console.log("✅ [ai-generation-mcp] Story generation complete with MCP");

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
      console.error("❌ [ai-generation-mcp] ERROR:", error);
      metadata.processingTime = Date.now() - startTime;
      throw new Error(
        `Story-Generierung mit MCP fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
);

// Reuse existing OpenAI generation function
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
  tokensUsed?: any;
}> {
  const chapterCount =
    config.length === "short" ? 3 : config.length === "medium" ? 5 : 8;

  const systemPrompt = `Erstelle eine fesselnde Kindergeschichte. Kapitel enden mit Cliffhanger. Show don't tell. Halte dich an Avatar-Beschreibungen. Antworte nur mit JSON.`;

  const userPrompt = `${config.genre}-Geschichte im ${config.setting} für ${config.ageGroup}. ${chapterCount} Kapitel.

CHARAKTERE:
${avatars.map((a) => `${a.name}: ${a.description}`).join("\n")}

PERSÖNLICHKEITS-UPDATE-SYSTEM:
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
Gib nur JSON zurück mit: title, description, chapters[{title,content,order,imageDescription:{scene,characters,environment,composition}}], coverImageDescription, avatarDevelopments, learningOutcomes.

avatarDevelopments muss folgendes Format haben:
[{ "name": "Avatar-Name", "changedTraits": [{ "trait": "MERKMAL_ID", "change": PUNKTE }] }]

Beispiel: [{ "name": "Max", "changedTraits": [{ "trait": "courage", "change": 3 }, { "trait": "knowledge.history", "change": 5 }] }]`;

  const payload = {
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_completion_tokens: 16_000,  // Max fuer gpt-5-mini
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
    throw new Error(`OpenAI API Fehler: ${response.status} - ${errorText}`);
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
    throw new Error("Ungültige Antwort von OpenAI (keine 'choices')");
  }

  if (choice.finish_reason === "content_filter") {
    throw new Error("Die Anfrage wurde vom OpenAI Inhaltsfilter blockiert.");
  }

  if (choice.finish_reason === "length") {
    throw new Error(
      "Die Story-Generierung wurde wegen Token-Limit abgeschnitten."
    );
  }

  const content = choice.message?.content;

  if (!content) {
    throw new Error(
      `Leere Antwort von OpenAI erhalten (Finish Reason: ${choice.finish_reason})`
    );
  }

  let parsed;
  try {
    const cleanContent = content.replace(/```json\s*|\s*```/g, "").trim();
    parsed = JSON.parse(cleanContent);
  } catch (e) {
    console.error("JSON Parse Fehler:", e);
    throw new Error(
      `JSON Parse Fehler: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  // Unwrap if nested in storyData
  if (parsed.storyData && !parsed.title) {
    console.log('[ai-generation-mcp] Unwrapping nested storyData structure');
    parsed = parsed.storyData;
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
