import { api, APIError } from "encore.dev/api";
import { runwareGenerateImage } from "./image-generation";
import { FLUX3_KLEIN_MODEL, FLUX3_KLEIN_STEPS } from "./runware-image-model-options";
import { TALEA_IMAGE_STYLE } from "./image-style";
import { maybeUploadImageUrlToBucket, resolveImageUrlForClient } from "../helpers/bucket-storage";
import type { PhysicalTraits, PersonalityTraits } from "../avatar/avatar";
import { translateToEnglish } from "./translate";
import { getAuthData } from "~encore/auth";
import { claimMeteredUsage, refundMeteredUsage } from "../helpers/billing";

interface GenerateAvatarImageRequest {
  characterType: string;
  appearance: string;
  personalityTraits: any; // Make this flexible to accept any personality trait structure
  /** Legacy clients may send a style; all portraits use the shared Talea Originals medium. */
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
    const usageClaim = await claimMeteredUsage({
      userId: auth.userID,
      kind: "image",
      units: 1,
      clerkToken: auth.clerkToken,
    });

    try {
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
        req.personalityTraits
      );

      console.info("[ai.avatar-generation] Requesting image", {
        style: "talea-originals",
        hasReferenceImage: Boolean(req.referenceImageUrl),
        promptLength: prompt.length,
      });

      // The shared adapter supplies FLUX 3's safety check and supported parameters.
      const imageResult = await runwareGenerateImage({
        prompt,
        model: FLUX3_KLEIN_MODEL,
        width: 1024,
        height: 1024,
        steps: FLUX3_KLEIN_STEPS,
        outputFormat: "WEBP",
        referenceImages: req.referenceImageUrl ? [req.referenceImageUrl] : undefined,
      });

      console.info("[ai.avatar-generation] Image generation completed", {
        success: Boolean(imageResult.debugInfo?.success),
        hasImage: Boolean(imageResult.imageUrl),
        contentType: imageResult.debugInfo?.contentType,
      });

      let finalImageUrl = imageResult.imageUrl;
      if (!finalImageUrl || imageResult.debugInfo?.success === false) {
        // A placeholder or empty result is not a delivered image.
        await refundMeteredUsage(usageClaim);
      }
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
    } catch (error) {
      await refundMeteredUsage(usageClaim);
      throw error;
    }
  }
);

function buildAvatarPrompt(
  characterType: string,
  appearance: string,
  personality: PersonalityTraits
): string {
  const subject = sanitizeSegment(characterType || "storybook character");
  const appearanceDetails = sanitizeSegment(appearance || "");
  const speciesTag = inferSpeciesTag(characterType, appearance);
  const personalityDescriptor = getPersonalityDescriptor(personality);

  const sections = [
    TALEA_IMAGE_STYLE,
    `SUBJECT ${subject} (${speciesTag})`,
    personalityDescriptor ? `PERSONALITY cues ${personalityDescriptor}` : "",
    appearanceDetails ? `APPEARANCE ${appearanceDetails}` : "",
    "COMPOSITION centered waist-up portrait, gentle three-quarter angle, direct eye contact",
    "LIGHTING warm morning rim light, soft bounced fill",
    "BACKGROUND plain warm ivory with subtle paper texture",
    "QUALITY child-safe, clear readable silhouette, consistent hand-drawn gouache medium"
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

function clampPromptLength(prompt: string, maxLength = 4000): string {
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
