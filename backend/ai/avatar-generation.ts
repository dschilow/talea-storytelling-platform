import { api } from "encore.dev/api";
import { generateImage } from "./image-generation";
import type { PhysicalTraits, PersonalityTraits } from "../avatar/create";

interface GenerateAvatarImageRequest {
  physicalTraits: PhysicalTraits;
  personalityTraits: PersonalityTraits;
  style?: "realistic" | "disney" | "anime";
}

interface GenerateAvatarImageResponse {
  imageUrl: string;
  prompt: string;
}

// Generates an avatar image based on physical and personality traits.
export const generateAvatarImage = api<GenerateAvatarImageRequest, GenerateAvatarImageResponse>(
  { expose: true, method: "POST", path: "/ai/generate-avatar" },
  async (req) => {
    const prompt = buildAvatarPrompt(req.physicalTraits, req.personalityTraits, req.style);
    
    const imageResult = await generateImage({
      prompt,
      width: 512,
      height: 512,
      steps: 25,
    });

    return {
      imageUrl: imageResult.imageUrl,
      prompt,
    };
  }
);

function buildAvatarPrompt(
  physical: PhysicalTraits, 
  personality: PersonalityTraits, 
  style: string = "disney"
): string {
  const ageDescriptor = physical.age <= 5 ? "toddler" : 
                       physical.age <= 8 ? "young child" : 
                       physical.age <= 12 ? "child" : "teenager";

  const genderDescriptor = physical.gender === "male" ? "boy" : 
                          physical.gender === "female" ? "girl" : "child";

  const hairDescriptor = `${physical.hairColor} ${physical.hairType} hair`;
  
  const personalityDescriptor = getPersonalityDescriptor(personality);
  
  const styleDescriptor = style === "disney" ? "Disney Pixar style" :
                         style === "anime" ? "anime manga style" : 
                         "realistic children's book illustration style";

  return `A ${ageDescriptor} ${genderDescriptor} with ${hairDescriptor}, ${personalityDescriptor}, ${styleDescriptor}, high quality, detailed, colorful, friendly, safe for children`;
}

function getPersonalityDescriptor(personality: PersonalityTraits): string {
  const traits = Object.entries(personality)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([trait]) => {
      switch (trait) {
        case "courage": return "brave and confident";
        case "intelligence": return "smart and thoughtful";
        case "creativity": return "creative and artistic";
        case "empathy": return "kind and caring";
        case "strength": return "strong and determined";
        case "humor": return "cheerful and funny";
        case "adventure": return "adventurous and curious";
        case "patience": return "calm and patient";
        case "curiosity": return "inquisitive and wondering";
        case "leadership": return "confident and leading";
        default: return trait;
      }
    });

  return traits.join(", ");
}
