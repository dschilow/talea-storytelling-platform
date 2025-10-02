import { api } from "encore.dev/api";
import { runwareGenerateImage } from "./image-generation";
import type { PhysicalTraits, PersonalityTraits } from "../avatar/avatar";

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
    const prompt = buildAvatarPrompt(req.characterType, req.appearance, req.personalityTraits, req.style);

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
  const personalityDescriptor = getPersonalityDescriptor(personality);

  const styleDescriptor =
    style === "disney" ? "charming Disney Pixar 3D animation style, cute and friendly" :
    style === "anime" ? "vibrant anime manga style, colorful and expressive" :
    "beautiful realistic children's book illustration style, warm and inviting";

  return `Portrait of a ${characterType}, ${personalityDescriptor}, with the following appearance: ${appearance}. Style: ${styleDescriptor}. high quality, detailed, colorful, friendly expression, safe for children, clean background.`;
}

function getPersonalityDescriptor(personality: PersonalityTraits): string {
  const traits = Object.entries(personality)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([trait]) => {
      switch (trait) {
        case "courage":
          return "brave and confident expression";
        case "intelligence":
          return "smart and thoughtful look";
        case "creativity":
          return "creative and artistic appearance";
        case "empathy":
          return "kind and caring expression";
        case "strength":
          return "strong and determined posture";
        case "humor":
          return "cheerful and funny smile";
        case "adventure":
          return "adventurous and curious eyes";
        case "patience":
          return "calm and patient demeanor";
        case "curiosity":
          return "inquisitive and wondering expression";
        case "leadership":
          return "confident and leading stance";
        default:
          return trait;
      }
    });

  return traits.join(", ");
}
