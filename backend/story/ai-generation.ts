import { api } from "encore.dev/api";
import { secret } from "encore.dev/config";
import type { StoryConfig, Chapter } from "./generate";
import type { Avatar, AvatarVisualProfile } from "../avatar/avatar";
import { ai } from "~encore/clients";
import { logTopic } from "../log/logger";
import { publishWithTimeout } from "../helpers/pubsubTimeout";

// ---- OpenAI Modell & Pricing ----
const MODEL = "gpt-5-nano";
const INPUT_COST_PER_1M = 5.00;
const OUTPUT_COST_PER_1M = 15.00;

const openAIKey = secret("OpenAIKey");

type ExtendedAvatarDetails = Omit<Avatar, 'userId' | 'isShared' | 'originalAvatarId' | 'createdAt' | 'updatedAt'> & {
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
function normalizeRunwareDimensions(width: number, height: number): { width: number; height: number } {
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

// Build a short canonical appearance string from a visual profile.
function canonicalFromVisualProfile(vp?: AvatarVisualProfile): string | null {
  if (!vp) return null;
  const parts: string[] = [];
  parts.push(`${vp.skin?.tone ?? ""} skin`.trim());
  if (vp.hair?.color && vp.hair?.type) parts.push(`${vp.hair.color} ${vp.hair.type} hair`);
  if (vp.hair?.length) parts.push(`${vp.hair.length} length`);
  if (vp.hair?.style) parts.push(vp.hair.style);
  if (vp.eyes?.color) parts.push(`${vp.eyes.color} eyes`);
  if (vp.face?.freckles) parts.push("freckles");
  if (vp.accessories && vp.accessories.length > 0) parts.push(...vp.accessories);
  return parts.filter(Boolean).join(", ");
}

// Erstelle strukturierten Bildprompt mit vollständigen Visual Profile Details
function convertImageDescriptionToPrompt(
  description: ChapterImageDescription | CoverImageDescription,
  isChapter: boolean = true,
  avatarProfilesByName?: Record<string, AvatarVisualProfile>,
  req?: any
): string {
  if (isChapter) {
    return buildChapterImagePrompt(description as ChapterImageDescription, avatarProfilesByName, req);
  } else {
    return buildCoverImagePrompt(description as CoverImageDescription, avatarProfilesByName, req);
  }
}

// Strukturierter Kapitel-Bildprompt
function buildChapterImagePrompt(
  chapterDesc: ChapterImageDescription,
  avatarProfilesByName?: Record<string, AvatarVisualProfile>,
  req?: any
): string {
  const sections: string[] = [];
  
  // 1. QUALITÄTS-HEADER
  sections.push([
    "masterpiece",
    "best quality", 
    "ultra detailed",
    "professional children's book illustration",
    "Disney Pixar 3D style",
    "vibrant colors",
    "perfect lighting"
  ].join(", "));

  // 2. SZENEN-BESCHREIBUNG
  sections.push(`SCENE: ${chapterDesc.scene}`);

  // 3. CHARAKTERE (getrennt für jeden Avatar)
  const characterSections: string[] = [];
  Object.entries(chapterDesc.characters ?? {}).forEach(([name, details]) => {
    const charSection = buildDetailedCharacterDescription(name, details, avatarProfilesByName, req);
    if (charSection) {
      characterSections.push(`CHARACTER ${name.toUpperCase()}: ${charSection}`);
    }
  });
  
  if (characterSections.length > 0) {
    sections.push(characterSections.join(" || "));
  }

  // 4. HANDLUNG & INTERAKTION
  const actions = Object.entries(chapterDesc.characters ?? {})
    .map(([name, details]) => `${name} ${details.action}, shows ${details.expression} expression`)
    .join(", ");
  if (actions) {
    sections.push(`ACTION: ${actions}`);
  }

  // 5. UMGEBUNG
  const environmentDesc = [
    `setting: ${chapterDesc.environment?.setting || "beautiful scene"}`,
    `lighting: ${chapterDesc.environment?.lighting || "warm natural lighting"}`,
    `atmosphere: ${chapterDesc.environment?.atmosphere || "cheerful mood"}`
  ];
  if (chapterDesc.environment?.objects?.length) {
    environmentDesc.push(`objects: ${chapterDesc.environment.objects.join(", ")}`);
  }
  sections.push(`ENVIRONMENT: ${environmentDesc.join(", ")}`);

  // 6. BILDKOMPOSITION
  const compositionDesc = [
    `foreground: ${chapterDesc.composition?.foreground || "main characters"}`,
    `background: ${chapterDesc.composition?.background || "scene setting"}`,
    `focus: ${chapterDesc.composition?.focus || "character interaction"}`
  ];
  sections.push(`COMPOSITION: ${compositionDesc.join(", ")}`);

  // 7. STIL & QUALITÄT
  sections.push([
    "child-friendly illustration",
    "expressive facial features", 
    "anatomically correct proportions",
    "high resolution details",
    "clean composition",
    "Disney animation quality"
  ].join(", "));

  // 8. KONSISTENZ-VERSTÄRKUNG
  const consistencyTokens = extractConsistencyTokens(avatarProfilesByName);
  if (consistencyTokens.length > 0) {
    sections.push(`CHARACTER CONSISTENCY CRITICAL: ${consistencyTokens.join(" || ")}`);
    sections.push("IMPORTANT: Each character must be visually distinct, maintain unique hair color, eye color, face shape, skin tone, all distinctive features exactly as specified");
  }

  return sections.join(". ");
}

// Detaillierte Charakter-Beschreibung basierend auf Visual Profile
function buildDetailedCharacterDescription(
  name: string,
  details: any,
  avatarProfilesByName?: Record<string, AvatarVisualProfile>,
  req?: any
): string {
  const vp = avatarProfilesByName?.[name];
  const parts: string[] = [];
  
  // Position & Aktion
  parts.push(`positioned ${details.position}`);
  
  if (vp) {
    // DETAILLIERTE VISUAL PROFILE BESCHREIBUNG
    console.log(`✅ Verwende vollständiges Visual Profile für ${name}`);
    
    // Alter & Geschlecht
    if (vp.ageApprox) parts.push(`age ${vp.ageApprox} years old`);
    if (vp.gender && vp.gender !== 'unknown') parts.push(`${vp.gender} character`);
    
    // Haut (vollständig)
    const skinDesc: string[] = [];
    if (vp.skin?.tone) skinDesc.push(`${vp.skin.tone} skin tone`);
    if (vp.skin?.undertone) skinDesc.push(`${vp.skin.undertone} undertones`);
    if (vp.skin?.distinctiveFeatures?.length) skinDesc.push(vp.skin.distinctiveFeatures.join(" and "));
    if (skinDesc.length) parts.push(`skin: ${skinDesc.join(", ")}`);
    
    // Haare (sehr detailliert)
    const hairDesc: string[] = [];
    if (vp.hair?.color) hairDesc.push(`${vp.hair.color} color`);
    if (vp.hair?.type) hairDesc.push(`${vp.hair.type} texture`);
    if (vp.hair?.length) hairDesc.push(`${vp.hair.length} length`);
    if (vp.hair?.style) hairDesc.push(`styled: ${vp.hair.style}`);
    if (hairDesc.length) parts.push(`hair: ${hairDesc.join(", ")}`);
    
    // Augen (vollständig)
    const eyeDesc: string[] = [];
    if (vp.eyes?.color) eyeDesc.push(`${vp.eyes.color} colored`);
    if (vp.eyes?.shape) eyeDesc.push(`${vp.eyes.shape} shaped`);
    if (vp.eyes?.size) eyeDesc.push(`${vp.eyes.size} sized`);
    if (eyeDesc.length) parts.push(`eyes: ${eyeDesc.join(", ")}`);
    
    // Gesicht (detailliert)
    const faceDesc: string[] = [];
    if (vp.face?.shape) faceDesc.push(`${vp.face.shape} face shape`);
    if (vp.face?.nose) faceDesc.push(`nose: ${vp.face.nose}`);
    if (vp.face?.mouth) faceDesc.push(`mouth: ${vp.face.mouth}`);
    if (vp.face?.eyebrows) faceDesc.push(`eyebrows: ${vp.face.eyebrows}`);
    if (vp.face?.freckles) faceDesc.push("with freckles");
    if (vp.face?.otherFeatures?.length) faceDesc.push(vp.face.otherFeatures.join(" and "));
    if (faceDesc.length) parts.push(`facial features: ${faceDesc.join(", ")}`);
    
    // Accessoires
    if (vp.accessories?.length) parts.push(`accessories: ${vp.accessories.join(", ")}`);
    
    // Kleidung aus Visual Profile wenn vorhanden
    if (vp.clothingCanonical?.outfit) {
      parts.push(`canonical outfit: ${vp.clothingCanonical.outfit}`);
    } else if (vp.clothingCanonical?.top || vp.clothingCanonical?.bottom) {
      const clothingParts = [];
      if (vp.clothingCanonical.top) clothingParts.push(`top: ${vp.clothingCanonical.top}`);
      if (vp.clothingCanonical.bottom) clothingParts.push(`bottom: ${vp.clothingCanonical.bottom}`);
      parts.push(`clothing: ${clothingParts.join(", ")}`);
    }
    
    // Szenen-spezifische Kleidung ergänzen
    if (details.clothing) {
      parts.push(`scene clothing: ${details.clothing}`);
    }
    
  } else {
    // FALLBACK: Verwende Basis-Avatar Informationen
    console.warn(`⚠️ Kein Visual Profile für ${name} - verwende Fallback`);
    
    const avatarDetail = req?.avatarDetails?.find((a: any) => a.name === name);
    if (avatarDetail) {
      const physicalTraits = avatarDetail.physicalTraits;
      if (physicalTraits?.characterType) parts.push(`character type: ${physicalTraits.characterType}`);
      if (physicalTraits?.appearance) parts.push(`appearance: ${physicalTraits.appearance}`);
      if (avatarDetail.description) parts.push(`description: ${avatarDetail.description}`);
    }
    
    // Szenen-Kleidung
    if (details.clothing) parts.push(`wearing: ${details.clothing}`);
  }
  
  return parts.join(", ");
}

// Extrahiere Konsistenz-Token für alle Charaktere
function extractConsistencyTokens(avatarProfilesByName?: Record<string, AvatarVisualProfile>): string[] {
  const tokens: string[] = [];
  
  if (avatarProfilesByName) {
    Object.entries(avatarProfilesByName).forEach(([name, vp]) => {
      const charTokens = vp.consistentDescriptors?.slice(0, 10) || [];
      if (charTokens.length) {
        tokens.push(`${name}: [${charTokens.join(", ")}]`);
      }
    });
  }
  
  return tokens;
}

// Strukturierter Cover-Bildprompt
function buildCoverImagePrompt(
  coverDesc: CoverImageDescription,
  avatarProfilesByName?: Record<string, AvatarVisualProfile>,
  req?: any
): string {
  const sections: string[] = [];
  const canonicalAppendix: string[] = [];
  
  // 1. QUALITÄTS-HEADER FÜR COVER
  sections.push([
    "masterpiece",
    "best quality",
    "ultra detailed",
    "professional book cover illustration",
    "Disney Pixar style",
    "3D rendered cover art",
    "children's book cover",
    "vibrant colors",
    "perfect lighting"
  ].join(", "));

  // 2. HAUPTSZENE
  sections.push(`MAIN SCENE: ${coverDesc.mainScene}`);

  // 3. CHARAKTERE (detailliert für Cover)
  const characterSections: string[] = [];
  Object.entries(coverDesc.characters ?? {}).forEach(([name, details]) => {
    const vp = avatarProfilesByName?.[name];
    const charParts: string[] = [];
    
    // Position & Pose
    charParts.push(`positioned ${details.position}`);
    charParts.push(`${details.expression} expression`);
    charParts.push(`${details.pose} pose`);
    
    if (vp) {
      // VOLLSTÄNDIGES VISUAL PROFILE FÜR COVER
      console.log(`✅ Verwende vollständiges Visual Profile für Cover-Charakter ${name}`);
      
      // Alter & Geschlecht
      if (vp.ageApprox) charParts.push(`age ${vp.ageApprox} years old`);
      if (vp.gender && vp.gender !== 'unknown') charParts.push(`${vp.gender} character`);
      
      // Detaillierte Haut-Beschreibung
      const skinDesc: string[] = [];
      if (vp.skin?.tone) skinDesc.push(`${vp.skin.tone} skin tone`);
      if (vp.skin?.undertone) skinDesc.push(`${vp.skin.undertone} undertones`);
      if (vp.skin?.distinctiveFeatures?.length) skinDesc.push(vp.skin.distinctiveFeatures.join(" and "));
      if (skinDesc.length) charParts.push(`skin: ${skinDesc.join(", ")}`);
      
      // Detaillierte Haar-Beschreibung
      const hairDesc: string[] = [];
      if (vp.hair?.color) hairDesc.push(`${vp.hair.color} color`);
      if (vp.hair?.type) hairDesc.push(`${vp.hair.type} texture`);
      if (vp.hair?.length) hairDesc.push(`${vp.hair.length} length`);
      if (vp.hair?.style) hairDesc.push(`styled: ${vp.hair.style}`);
      if (hairDesc.length) charParts.push(`hair: ${hairDesc.join(", ")}`);
      
      // Detaillierte Augen-Beschreibung
      const eyeDesc: string[] = [];
      if (vp.eyes?.color) eyeDesc.push(`${vp.eyes.color} colored`);
      if (vp.eyes?.shape) eyeDesc.push(`${vp.eyes.shape} shaped`);
      if (vp.eyes?.size) eyeDesc.push(`${vp.eyes.size} sized`);
      if (eyeDesc.length) charParts.push(`eyes: ${eyeDesc.join(", ")}`);
      
      // Detaillierte Gesichts-Beschreibung
      const faceDesc: string[] = [];
      if (vp.face?.shape) faceDesc.push(`${vp.face.shape} face shape`);
      if (vp.face?.nose) faceDesc.push(`nose: ${vp.face.nose}`);
      if (vp.face?.mouth) faceDesc.push(`mouth: ${vp.face.mouth}`);
      if (vp.face?.eyebrows) faceDesc.push(`eyebrows: ${vp.face.eyebrows}`);
      if (vp.face?.freckles) faceDesc.push("with freckles");
      if (vp.face?.otherFeatures?.length) faceDesc.push(vp.face.otherFeatures.join(" and "));
      if (faceDesc.length) charParts.push(`facial features: ${faceDesc.join(", ")}`);
      
      // Accessoires
      if (vp.accessories?.length) charParts.push(`accessories: ${vp.accessories.join(", ")}`);
      
      // Kleidung aus Visual Profile
      if (vp.clothingCanonical?.outfit) {
        charParts.push(`canonical outfit: ${vp.clothingCanonical.outfit}`);
      } else if (vp.clothingCanonical?.top || vp.clothingCanonical?.bottom) {
        const clothingParts = [];
        if (vp.clothingCanonical.top) clothingParts.push(`top: ${vp.clothingCanonical.top}`);
        if (vp.clothingCanonical.bottom) clothingParts.push(`bottom: ${vp.clothingCanonical.bottom}`);
        charParts.push(`clothing: ${clothingParts.join(", ")}`);
      }
      
      // Konsistenz-Token für Cover
      const tokens = vp.consistentDescriptors?.slice(0, 10)?.join(", ");
      if (tokens) {
        canonicalAppendix.push(`${name}: [${tokens}]`);
      }
      
    } else {
      // FALLBACK für Cover
      console.warn(`⚠️ Kein Visual Profile für Cover-Charakter '${name}' - verwende Fallback`);
      
      const avatarDetail = req?.avatarDetails?.find((a: any) => a.name === name);
      if (avatarDetail) {
        const physicalTraits = avatarDetail.physicalTraits;
        if (physicalTraits?.characterType) charParts.push(`character type: ${physicalTraits.characterType}`);
        if (physicalTraits?.appearance) charParts.push(`appearance: ${physicalTraits.appearance}`);
        if (avatarDetail.description) charParts.push(`description: ${avatarDetail.description}`);
      }
    }
    
    if (charParts.length > 0) {
      characterSections.push(`CHARACTER ${name.toUpperCase()}: ${charParts.join(", ")}`);
    }
  });
  
  if (characterSections.length > 0) {
    sections.push(characterSections.join(" || "));
  }

  // 4. UMGEBUNG & STIMMUNG
  const environmentDesc = [
    `setting: ${coverDesc.environment?.setting || "magical environment"}`,
    `mood: ${coverDesc.environment?.mood || "joyful and inviting"}`
  ];
  if (coverDesc.environment?.colorPalette?.length) {
    environmentDesc.push(`color palette: ${coverDesc.environment.colorPalette.join(", ")}`);
  }
  sections.push(`ENVIRONMENT: ${environmentDesc.join(", ")}`);

  // 5. COVER-KOMPOSITION
  const compositionDesc = [
    `layout: ${coverDesc.composition?.layout || "balanced layout"}`,
    `title space: ${coverDesc.composition?.titleSpace || "at top"}`,
    `visual focus: ${coverDesc.composition?.visualFocus || "main character"}`
  ];
  sections.push(`COMPOSITION: ${compositionDesc.join(", ")}`);

  // 6. COVER-SPEZIFISCHE STIL-TAGS
  sections.push([
    "eye-catching cover design",
    "appealing to children and parents",
    "professional typography space",
    "perfect facial features",
    "expressive characters",
    "high-quality finish",
    "marketable children's book cover"
  ].join(", "));

  // 7. KONSISTENZ-VERSTÄRKUNG FÜR COVER
  if (canonicalAppendix.length > 0) {
    sections.push(`CHARACTER CONSISTENCY CRITICAL: ${canonicalAppendix.join(" || ")}`);
    sections.push("IMPORTANT: Each character must be visually distinct and recognizable on cover, maintain all unique features like hair color, eye color, face shape, skin tone, distinctive marks");
  }

  return sections.join(". ");
}

export const generateStoryContent = api<GenerateStoryContentRequest, GenerateStoryContentResponse>(
  { expose: true, method: "POST", path: "/ai/generate-story" },
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
      console.log("📚 [ai-generation] Generate story start");
      console.log("🧾 [ai-generation] Config:", {
        genre: req.config?.genre,
        setting: req.config?.setting,
        length: req.config?.length,
        complexity: req.config?.complexity,
        ageGroup: req.config?.ageGroup,
        learningMode: req.config?.learningMode ? {
          enabled: req.config.learningMode.enabled,
          subjectsCount: req.config.learningMode.subjects?.length ?? 0,
          objectivesCount: req.config.learningMode.learningObjectives?.length ?? 0,
          assessmentType: req.config.learningMode.assessmentType,
        } : undefined
      });
      console.log("🧾 [ai-generation] Avatar details (count):", req.avatarDetails?.length);

      const storyResult = await generateEnhancedStoryWithOpenAI(req.config, req.avatarDetails);
      console.log("✅ [ai-generation] Story generated:", { title: storyResult?.title, chapters: storyResult?.chapters?.length });

      metadata.tokensUsed = storyResult.tokensUsed ?? { prompt: 0, completion: 0, total: 0 };
      
      const outputTokens = metadata.tokensUsed.completion;
      metadata.totalCost.text =
        (metadata.tokensUsed.prompt / 1_000_000) * INPUT_COST_PER_1M +
        (outputTokens / 1_000_000) * OUTPUT_COST_PER_1M;

      console.log("🖼️ [ai-generation] Generating images (cover + chapters)...");

      const seedBase = deterministicSeedFrom(req.avatarDetails.map(a => a.id).join("|"));
      const coverDimensions = normalizeRunwareDimensions(600, 800);
      const chapterDimensions = normalizeRunwareDimensions(512, 512);

      // Build name->visualProfile map for consistency injection
      const avatarMap: Record<string, AvatarVisualProfile> = {};
      for (const a of req.avatarDetails) {
        if (a.visualProfile) {
          avatarMap[a.name] = a.visualProfile;
          console.log(`✅ Visual Profile für ${a.name} geladen:`, {
            hair: a.visualProfile.hair,
            eyes: a.visualProfile.eyes,
            skin: a.visualProfile.skin,
            tokens: a.visualProfile.consistentDescriptors?.slice(0, 5)
          });
        } else {
          console.warn(`❌ KEIN Visual Profile für Avatar ${a.name} (ID: ${a.id}) gefunden!`);
        }
      }
      
      console.log(`📊 Avatar Map Summary: ${Object.keys(avatarMap).length} von ${req.avatarDetails.length} Avataren haben Visual Profiles`);
      console.log(`📋 Avatar Namen mit Profiles: [${Object.keys(avatarMap).join(', ')}]`);
      
      // Cover-Bild generieren
      const coverPrompt = convertImageDescriptionToPrompt(storyResult.coverImageDescription, false, avatarMap, req);
      console.log("🎨 [ai-generation] Cover prompt length:", coverPrompt?.length);
      
      const coverResponse = await ai.generateImage({
        prompt: coverPrompt,
        model: "runware:101@1",
        width: coverDimensions.width,
        height: coverDimensions.height,
        steps: 35,
        CFGScale: 9.0,
        seed: seedBase,
        outputFormat: "WEBP",
        negativePrompt: "blurry, low quality, poor quality, bad quality, pixelated, amateur art, bad anatomy, wrong anatomy, distorted faces, deformed faces, extra limbs, missing limbs, malformed hands, extra fingers, bad proportions, asymmetric features, realistic photography, photorealistic, live action, real person, adult content, mature content, scary, horror, dark themes, violence, weapons, text, words, letters, watermark, signature, logo, cropped, cut off, out of frame, duplicate, multiple heads, inconsistent character, wrong hair color, wrong eye color, different appearance, style inconsistency"
      });

      // Kapitel-Bilder generieren
      const chapterResponses: Array<{ imageUrl?: string }> = [];
      for (let i = 0; i < storyResult.chapters.length; i++) {
        const chapter = storyResult.chapters[i];
        const chapterPrompt = convertImageDescriptionToPrompt(chapter.imageDescription, true, avatarMap, req);
        
        console.log(`🎨 [ai-generation] Chapter ${i + 1} prompt length:`, chapterPrompt?.length);
        
        const chapterResponse = await ai.generateImage({
          prompt: chapterPrompt,
          model: "runware:101@1", 
          width: chapterDimensions.width,
          height: chapterDimensions.height,
          steps: 32,
          CFGScale: 8.5,
          seed: (seedBase + i * 101) >>> 0,
          outputFormat: "WEBP",
          negativePrompt: "blurry, low quality, poor quality, bad quality, pixelated, amateur art, bad anatomy, wrong anatomy, distorted faces, deformed faces, extra limbs, missing limbs, malformed hands, extra fingers, bad proportions, asymmetric features, realistic photography, photorealistic, live action, real person, adult content, mature content, scary, horror, dark themes, violence, weapons, text, words, letters, watermark, signature, logo, cropped, cut off, out of frame, duplicate, multiple heads, inconsistent character, wrong hair color, wrong eye color, different appearance, style inconsistency, cluttered background, distracting background, busy composition"
        });
        
        chapterResponses.push(chapterResponse);
        
        // Kurze Pause zwischen Generierungen
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const chaptersWithImages = storyResult.chapters.map((chapter, index) => ({
        ...chapter,
        imageUrl: chapterResponses[index]?.imageUrl || ""
      }));

      metadata.imagesGenerated = 1 + chapterResponses.length;
      metadata.totalCost.images = metadata.imagesGenerated * 0.0008;
      metadata.totalCost.total = metadata.totalCost.text + metadata.totalCost.images;
      metadata.processingTime = Date.now() - startTime;

      return {
        title: storyResult.title,
        description: storyResult.description,
        coverImageUrl: coverResponse.imageUrl,
        coverImageDescription: storyResult.coverImageDescription,
        chapters: chaptersWithImages,
        avatarDevelopments: storyResult.avatarDevelopments,
        learningOutcomes: storyResult.learningOutcomes,
        metadata,
      };
    } catch (error) {
      console.error("❌ [ai-generation] ERROR:", error);
      metadata.processingTime = Date.now() - startTime;
      throw new Error(`Story-Generierung fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}. Bitte später erneut versuchen.`);
    }
  }
);

async function generateEnhancedStoryWithOpenAI(
  config: StoryConfig,
  avatars: ExtendedAvatarDetails[]
): Promise<{
  title: string;
  description: string;
  chapters: (Omit<Chapter, "id" | "imageUrl"> & { imageDescription: ChapterImageDescription })[];
  coverImageDescription: CoverImageDescription;
  avatarDevelopments: AvatarDevelopment[];
  learningOutcomes: LearningOutcome[];
  tokensUsed?: any;
}> {
  
  const chapterCount = config.length === "short" ? 3 : config.length === "medium" ? 5 : 8;

  // Kurze Avatar-Beschreibungen für Prompt
  const avatarDescriptions = avatars.map(avatar => {
    return `${avatar.name}: ${avatar.description || "Kind"}`;
  }).join("\n");

  const systemPrompt = `Erstelle eine fesselnde Kindergeschichte. Kapitel enden mit Cliffhanger. Show don't tell. Halte dich an Avatar-Beschreibungen. Antworte nur mit JSON.`;

  const userPrompt = `${config.genre}-Geschichte im ${config.setting} für ${config.ageGroup}. ${chapterCount} Kapitel. 

CHARAKTERE:
${avatars.map(a => `${a.name}: ${a.description}`).join('\n')}

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
      { role: "user", content: userPrompt }
    ],
    max_completion_tokens: 24000,
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
    source: 'openai-story-generation',
    timestamp: new Date(),
    request: payload,
    response: data,
  });

  const choice = data.choices?.[0];

  if (!choice) {
    console.error("OpenAI-Antwort enthält keine 'choices'. Vollständige Antwort:", JSON.stringify(data));
    throw new Error("Ungültige Antwort von OpenAI (keine 'choices')");
  }

  if (choice.finish_reason === 'content_filter') {
    console.error("Anfrage vom OpenAI Inhaltsfilter blockiert. Details:", JSON.stringify(choice));
    throw new Error("Die Anfrage wurde vom OpenAI Inhaltsfilter blockiert.");
  }

  if (choice.finish_reason === 'length') {
    console.error("OpenAI-Antwort wurde wegen Token-Limit abgeschnitten. Details:", JSON.stringify(choice));
    throw new Error("Die Story-Generierung wurde wegen Token-Limit abgeschnitten. Bitte versuchen Sie es mit kürzeren Einstellungen erneut.");
  }

  const content = choice.message?.content;

  if (!content) {
    console.error("Leere Inhaltsantwort von OpenAI. Finish Reason:", choice.finish_reason, "Full choice:", JSON.stringify(choice));
    throw new Error(`Leere Antwort von OpenAI erhalten (Finish Reason: ${choice.finish_reason})`);
  }

  let parsed;
  try {
    const cleanContent = content.replace(/```json\s*|\s*```/g, "").trim();
    parsed = JSON.parse(cleanContent);
  } catch (e) {
    console.error("JSON Parse Fehler:", e);
    console.error("Raw content:", content);
    throw new Error(`JSON Parse Fehler: ${e instanceof Error ? e.message : String(e)}`);
  }

  return {
    ...parsed,
    tokensUsed: {
      prompt: data.usage?.prompt_tokens ?? 0,
      completion: data.usage?.completion_tokens ?? 0,
      total: data.usage?.total_tokens ?? 0,
    }
  };
}
