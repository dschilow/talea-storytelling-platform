import { api } from "encore.dev/api";
import { generateImage } from "./image-generation";
import type { PhysicalTraits, PersonalityTraits } from "../avatar/create";

interface GenerateAvatarImageRequest {
  physicalTraits: PhysicalTraits;
  personalityTraits: PersonalityTraits;
  description?: string;
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
    const prompt = buildAvatarPrompt(req.physicalTraits, req.personalityTraits, req.description, req.style);
    
    console.log("Generating avatar with prompt:", prompt);
    
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
  description: string | undefined,
  style: string = "disney"
): string {
  const ageDescriptor = physical.age <= 5 ? "toddler" : 
                       physical.age <= 8 ? "young child" : 
                       physical.age <= 12 ? "child" : "teenager";

  const genderDescriptor = physical.gender === "male" ? "boy" : 
                          physical.gender === "female" ? "girl" : "child";

  const hairDescriptor = `${physical.hairColor} ${physical.hairType} hair`;
  const eyeDescriptor = `${physical.eyeColor} eyes`;
  const skinDescriptor = `${physical.skinTone} skin`;
  
  const personalityDescriptor = getPersonalityDescriptor(personality);
  
  const styleDescriptor = style === "disney" ? "charming Disney Pixar 3D animation style, cute and friendly" :
                         style === "anime" ? "vibrant anime manga style, colorful and expressive" : 
                         "beautiful realistic children's book illustration style, warm and inviting";

  const freeTextDescription = description ? `, ${description}` : '';

  // Constructing a more robust prompt
  return `Portrait of a cute ${ageDescriptor} ${genderDescriptor}, ${personalityDescriptor}, with ${skinDescriptor}, ${hairDescriptor} and ${eyeDescriptor}${freeTextDescription}. Style: ${styleDescriptor}. high quality, detailed, colorful, friendly expression, safe for children, clean background.`;
}

function getPersonalityDescriptor(personality: PersonalityTraits): string {
  const traits = Object.entries(personality)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([trait]) => {
      switch (trait) {
        case "courage": return "brave and confident expression";
        case "intelligence": return "smart and thoughtful look";
        case "creativity": return "creative and artistic appearance";
        case "empathy": return "kind and caring expression";
        case "strength": return "strong and determined posture";
        case "humor": return "cheerful and funny smile";
        case "adventure": return "adventurous and curious eyes";
        case "patience": return "calm and patient demeanor";
        case "curiosity": return "inquisitive and wondering expression";
        case "leadership": return "confident and leading stance";
        default: return trait;
      }
    });

  return traits.join(", ");
}
