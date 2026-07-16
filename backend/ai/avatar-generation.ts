import { api, APIError } from "encore.dev/api";
import { runwareGenerateImage } from "./image-generation";
import { maybeUploadImageUrlToBucket, resolveImageUrlForClient } from "../helpers/bucket-storage";
import type { PhysicalTraits, PersonalityTraits } from "../avatar/avatar";
import { translateToEnglish } from "./translate";
import { getAuthData } from "~encore/auth";
import { claimMeteredUsage } from "../helpers/billing";

interface GenerateAvatarImageRequest {
  characterType: string;
  appearance: string;
  personalityTraits: any; // Make this flexible to accept any personality trait structure
  style?: "realistic" | "disney" | "anime";
  /** Optional reference image URL (uploaded photo/camera) for character consistency */
  referenceImageUrl?: string;
}

interface GenerateAvatarImageResponse {
  imageUrl: string;
  prompt: string;
  debugInfo?: any;
}
function isStructuredEnglishVisualText(value: string): boolean {
  const text = String(value || "").trim();
  return /^[\x20-\x7E]+$/.test(text) &&
    /\b(human|child|boy|girl|man|woman|animal|cat|dog|robot|creature|eyes|hair|skin|fur|build|old|bald|wearing|has|character)\b/i.test(text) &&
    !/\b(und|oder|mit|ist|hat|mensch|kind|junge|maedchen|auge|augen|haar|haare|haut)\b/i.test(text);
}


// Generates an avatar image based on physical and personality traits.
export const generateAvatarImage = api<GenerateAvatarImageRequest, GenerateAvatarImageResponse>(
  { expose: true, method: "POST", path: "/ai/generate-avatar", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    if ((req.characterType || "").length > 120 || (req.appearance || "").length > 2_000) {
      throw APIError.invalidArgument("Avatar description is too long.");
    }
    await claimMeteredUsage({
      userId: auth.userID,
      kind: "image",
      units: 1,
      clerkToken: auth.clerkToken,
    });

    // Structured profiles are already English; only free-form localized fields need translation.
    const rawCharacterType = req.characterType || "";
    const rawAppearance = req.appearance || "";
    const characterIsEnglish = isStructuredEnglishVisualText(rawCharacterType);
    const appearanceIsEnglish = isStructuredEnglishVisualText(rawAppearance);
    console.info("[ai.avatar-generation] Preparing visual prompt", {
      characterTranslationNeeded: !characterIsEnglish,
      appearanceTranslationNeeded: !appearanceIsEnglish,
    });
    const [translatedCharacterType, translatedAppearance] = await Promise.all([
      characterIsEnglish ? rawCharacterType : translateToEnglish(rawCharacterType),
      appearanceIsEnglish ? rawAppearance : translateToEnglish(rawAppearance),
    ]);

    const prompt = buildAvatarPrompt(
      translatedCharacterType,
      translatedAppearance,
      req.personalityTraits,
      req.style
    );

    console.info("[ai.avatar-generation] Requesting image", {
      style: req.style || "disney",
      hasReferenceImage: Boolean(req.referenceImageUrl),
      promptLength: prompt.length,
    });

    // OPTIMIZATION v4.0: Use runware:400@4 with optimized parameters
    // FEATURE: Support reference image for character consistency
    const imageResult = await runwareGenerateImage({
      prompt,
      width: 1024,
      height: 1024,
      steps: 4,  // runware:400@4 uses fewer steps
      CFGScale: 4,
      outputFormat: "WEBP",
      referenceImages: req.referenceImageUrl ? [req.referenceImageUrl] : undefined,
    });

    console.info("[ai.avatar-generation] Image generation completed", {
      success: Boolean(imageResult.debugInfo?.success),
      hasImage: Boolean(imageResult.imageUrl),
      contentType: imageResult.debugInfo?.contentType,
    });

    let finalImageUrl = imageResult.imageUrl;
    if (finalImageUrl) {
      const uploaded = await maybeUploadImageUrlToBucket(finalImageUrl, {
        prefix: "images/avatars",
        filenameHint: "avatar-preview",
        uploadMode: "always",
      });
      finalImageUrl = uploaded?.url ?? finalImageUrl;
    }
    const resolvedImageUrl = await resolveImageUrlForClient(finalImageUrl);

    return {
      imageUrl: resolvedImageUrl || finalImageUrl || imageResult.imageUrl,
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
    "Hand-inked European children's storybook watercolor portrait",
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
  if (isHuman) return "human with no animal traits";
  return "character with consistent anatomy";
}

function getStyleDescriptor(style: string | undefined): string {
  switch (style) {
    case "anime":
      return "hand-inked watercolor storybook style with playful animation energy, crisp contours, vibrant palettes";
    case "realistic":
      return "hand-inked watercolor storybook realism, gentle shading, authentic proportions, handcrafted texture";
    case "disney":
    default:
      return "classic hand-inked watercolor storybook charm, expressive features, cozy color harmony";
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
