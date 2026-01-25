import { api } from "encore.dev/api";
import { runwareGenerateImage } from "./image-generation";
import type { PhysicalTraits, PersonalityTraits } from "../avatar/avatar";
import { translateToEnglish } from "./translate";

interface GenerateAvatarImageRequest {
  characterType: string;
  appearance: string;
  personalityTraits: any; // Make this flexible to accept any personality trait structure
  style?: "realistic" | "disney" | "anime";
}

interface GenerateAvatarImageResponse {
  imageUrl: string;
  prompt: string;
  debugInfo?: any;
}

// Generates an avatar image based on physical and personality traits.
export const generateAvatarImage = api<GenerateAvatarImageRequest, GenerateAvatarImageResponse>(
  { expose: true, method: "POST", path: "/ai/generate-avatar" },
  async (req) => {
    // CRITICAL: Validate and translate user input to English using OpenAI for Runware compatibility
    console.log("🌐 Translating user input to English using OpenAI GPT-5-mini...");
    const translatedCharacterType = await translateToEnglish(req.characterType || "");
    const translatedAppearance = await translateToEnglish(req.appearance || "");

    console.log("Original character type:", req.characterType);
    console.log("Translated character type:", translatedCharacterType);
    console.log("Original appearance:", req.appearance);
    console.log("Translated appearance:", translatedAppearance);

    const prompt = buildAvatarPrompt(
      translatedCharacterType,
      translatedAppearance,
      req.personalityTraits,
      req.style
    );

    console.log("🎨 Generating avatar with translated prompt:", prompt);
    console.log("👤 Character Type:", translatedCharacterType);
    console.log("🎨 Appearance:", translatedAppearance);
    console.log("🧠 Personality traits:", JSON.stringify(req.personalityTraits, null, 2));
    console.log("🎭 Style:", req.style);

    // OPTIMIZATION v4.0: Use runware:400@4 with optimized parameters
    const imageResult = await runwareGenerateImage({
      prompt,
      width: 512,
      height: 512,
      steps: 4,  // runware:400@4 uses fewer steps
      CFGScale: 4,
      outputFormat: "WEBP",
    });

    console.log("🖼️ Image generation result:");
    console.log("✅ Success:", imageResult.debugInfo?.success);
    console.log("📏 Image URL length:", imageResult.imageUrl?.length);
    console.log("🔍 Extracted from:", imageResult.debugInfo?.extractedFromPath);
    console.log("🔍 Content-Type:", imageResult.debugInfo?.contentType);

    return {
      imageUrl: imageResult.imageUrl,
      prompt,
      debugInfo: imageResult.debugInfo,
    };
  }
);

function buildAvatarPrompt(
  characterType: string,
  appearance: string,
  personality: PersonalityTraits,
  style: string = "disney"
): string {
  const subject = sanitizeSegment(characterType || "storybook character");
  const appearanceDetails = sanitizeSegment(appearance || "");
  const speciesTag = inferSpeciesTag(characterType, appearance);
  const personalityDescriptor = getPersonalityDescriptor(personality);
  const styleDescriptor = getStyleDescriptor(style);

  const sections = [
    "Axel Scheffler watercolor storybook portrait illustration",
    `SUBJECT ${subject} (${speciesTag})`,
    personalityDescriptor ? `PERSONALITY cues ${personalityDescriptor}` : "",
    appearanceDetails ? `APPEARANCE ${appearanceDetails}` : "",
    `STYLE ${styleDescriptor}`,
    "COMPOSITION centered waist-up portrait, gentle three-quarter angle, direct eye contact",
    "LIGHTING warm morning rim light, soft bounced fill",
    "BACKGROUND soft storybook wash, subtle gouache texture, no text",
    "QUALITY child-safe, clean ink outlines, traditional watercolor pigments, no photographic artifacts"
  ];

  const prompt = sections
    .map((section) => sanitizeSegment(section))
    .filter(Boolean)
    .map((section) => (section.endsWith(".") ? section.slice(0, -1) : section))
    .join(". ");

  return clampPromptLength(prompt);
}

function inferSpeciesTag(characterType?: string, appearance?: string): string {
  // CRITICAL FIX: Use characterType directly if provided, don't hardcode species names
  if (characterType && characterType.trim().length > 0) {
    return characterType.trim();
  }

  const text = `${characterType || ""} ${appearance || ""}`.toLowerCase();

  const isCat =
    /\b(cat|kitten|feline|katze|kätzchen)\b/.test(text);
  const isDog =
    /\b(dog|puppy|canine|hund|welpe)\b/.test(text);
  const isHuman =
    /\b(human|boy|girl|child|kid|mensch|mädchen|junge)\b/.test(text);
  const isAnthro =
    /\b(anthropomorphic|hybrid|monster|creature|fantasie|fabel)\b/.test(text);

  // Anthropomorphic/hybrid creatures should NOT be classified as cat/dog
  if (isAnthro) return "fantasy creature with unique anatomy";
  if (isCat) return "feline quadruped with natural anatomy";
  if (isDog) return "canine quadruped companion";
  if (isHuman) return "human child with no animal traits";
  return "character with consistent anatomy";
}

function getStyleDescriptor(style: string | undefined): string {
  switch (style) {
    case "anime":
      return "Axel Scheffler inspired watercolor with playful anime energy, crisp ink contours, vibrant palettes";
    case "realistic":
      return "Axel Scheffler inspired watercolor realism, gentle shading, authentic proportions, handcrafted texture";
    case "disney":
    default:
      return "Axel Scheffler inspired watercolor charm, expressive storybook features, cozy color harmony";
  }
}

function getPersonalityDescriptor(personality: PersonalityTraits): string {
  const traitScores = Object.entries(personality || {}).map(([trait, value]) => {
    const numeric =
      typeof value === "number"
        ? value
        : typeof value === "object" && value !== null
        ? Number((value as any).value ?? 0)
        : 0;
    return { trait, score: numeric };
  });

  const topTraits = traitScores
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ trait }) => {
      switch (trait) {
        case "courage":
          return "brave, confident energy";
        case "intelligence":
          return "thoughtful, clever mindset";
        case "creativity":
          return "imaginative, artistic spirit";
        case "empathy":
          return "gentle, compassionate warmth";
        case "strength":
          return "strong, steady posture";
        case "humor":
          return "playful, joyful sparkle";
        case "adventure":
          return "curious, explorer vibe";
        case "patience":
          return "calm, patient demeanor";
        case "curiosity":
          return "wide-eyed wonder";
        case "leadership":
          return "confident, guiding presence";
        default:
          return sanitizeSegment(trait);
      }
    })
    .filter(Boolean);

  return topTraits.length > 0 ? topTraits.join(", ") : "friendly, kind-hearted aura";
}

function sanitizeSegment(input: string): string {
  // Just clean up special characters, translation already done by translateToEnglish
  return (input || "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clampPromptLength(prompt: string, maxLength = 900): string {
  if (prompt.length <= maxLength) {
    return prompt;
  }
  const truncated = prompt.slice(0, maxLength - 1);
  const lastPeriod = truncated.lastIndexOf(".");
  if (lastPeriod > maxLength * 0.6) {
    return truncated.slice(0, lastPeriod + 1).trim();
  }
  return truncated.trim();
}
