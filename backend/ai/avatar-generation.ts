import { api } from "encore.dev/api";
import { runwareGenerateImage } from "./image-generation";
import type { PhysicalTraits, PersonalityTraits } from "../avatar/avatar";
import { normalizeLanguage } from "../story/avatar-image-optimization";

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
    const prompt = buildAvatarPrompt(
      req.characterType,
      req.appearance,
      req.personalityTraits,
      req.style
    );

    console.log("🎨 Generating avatar with prompt:", prompt);
    console.log("👤 Character Type:", req.characterType);
    console.log("🎨 Appearance:", req.appearance);
    console.log("🧠 Personality traits:", JSON.stringify(req.personalityTraits, null, 2));
    console.log("🎭 Style:", req.style);

    const imageResult = await runwareGenerateImage({
      prompt,
      width: 512,
      height: 512,
      steps: 25,
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
  const text = `${characterType || ""} ${appearance || ""}`.toLowerCase();

  const isCat =
    /\b(cat|kitten|feline|katze|kätzchen)\b/.test(text);
  const isDog =
    /\b(dog|puppy|canine|hund|welpe)\b/.test(text);
  const isHuman =
    /\b(human|boy|girl|child|kid|mensch|mädchen|junge)\b/.test(text);

  if (isCat) return "KITTEN - feline quadruped, natural anatomy";
  if (isDog) return "DOG - canine quadruped companion";
  if (isHuman) return "HUMAN child - no animal traits";
  return "FANTASY character - keep anatomy consistent";
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
  const normalized = normalizeLanguage(input || "");
  return normalized
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
