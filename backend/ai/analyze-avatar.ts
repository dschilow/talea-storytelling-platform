import { api } from "encore.dev/api";
import { secret } from "encore.dev/config";
import type { AvatarVisualProfile, PhysicalTraits, PersonalityTraits } from "../avatar/create";

const openAIKey = secret("OpenAIKey");

export interface AnalyzeAvatarImageRequest {
  // The avatar image to analyze; can be a data URL or https URL.
  imageUrl: string;
  // Optional hints to help with analysis.
  hints?: {
    name?: string;
    physicalTraits?: PhysicalTraits;
    personalityTraits?: PersonalityTraits;
  };
}

export interface AnalyzeAvatarImageResponse {
  visualProfile: AvatarVisualProfile;
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

// Analyzes an avatar image using OpenAI Vision and returns a canonical visual profile.
// This profile is stored with the avatar to ensure image consistency in stories.
export const analyzeAvatarImage = api<AnalyzeAvatarImageRequest, AnalyzeAvatarImageResponse>(
  { expose: true, method: "POST", path: "/ai/analyze-avatar-image" },
  async (req) => {
    const system = `You are an expert visual character profiler for children's books.
You receive one portrait-like image of a child character (avatar). 
Extract a precise, canonical visual profile to keep this character's look consistent across future illustrations.

STRICT OUTPUT: JSON object with the exact schema below. No additional text.
Be concise but specific. Use strings and arrays only.`;

    const userText = `Analyze this avatar image and describe the canonical appearance for consistent future illustrations.

Rules:
- Describe SKIN tone and undertone, and any distinctive features (freckles, birthmarks).
- Describe HAIR: color (plain words), type (straight/wavy/curly/coily), length, style details.
- Describe EYES: color (plain words), shape, relative size.
- Describe FACE: overall shape, typical eyebrows, nose, mouth, any notable features (e.g., missing tooth).
- ACCESSORIES: list consistent items (e.g., glasses) or [].
- CLOTHING_CANONICAL: If a clear consistent outfit is visible, summarize it and main colors/patterns. Keep generic, e.g., "light-blue jumpsuit".
- PALETTE: main colors present (primary, optional secondary).
- CONSISTENT_DESCRIPTORS: return 6-12 short tokens (3-6 words each) suitable to append to image prompts, focused on appearance only (hair/skin/eyes/face/accessories). No clothing here unless intrinsic (e.g., glasses).

If hints are provided, include them only when they do not contradict the image.
Avoid brand words or copyrighted characters.

Schema:
{
  "ageApprox": "string (e.g., '5-7')",
  "gender": "male | female | non-binary | unknown",
  "skin": {
    "tone": "string",
    "undertone": "string (optional)",
    "distinctiveFeatures": ["string", ...] // optional
  },
  "hair": {
    "color": "string",
    "type": "straight|wavy|curly|coily",
    "length": "short|medium|long",
    "style": "string"
  },
  "eyes": {
    "color": "string",
    "shape": "string (optional)",
    "size": "small|medium|large (optional)"
  },
  "face": {
    "shape": "string (optional)",
    "nose": "string (optional)",
    "mouth": "string (optional)",
    "eyebrows": "string (optional)",
    "freckles": false,
    "otherFeatures": ["string", ...] // optional
  },
  "accessories": ["string", ...],
  "clothingCanonical": {
    "top": "string (optional)",
    "bottom": "string (optional)",
    "outfit": "string (optional)",
    "colors": ["string", ...],
    "patterns": ["string", ...]
  },
  "palette": {
    "primary": ["string", ...],
    "secondary": ["string", ...]
  },
  "consistentDescriptors": ["string", "string", ...]
}`;

    const hintsText = req.hints ? `HINTS:
${req.hints.name ? `- Name: ${req.hints.name}` : ""}
${req.hints.physicalTraits ? `- Physical: ${JSON.stringify(req.hints.physicalTraits)}` : ""}
${req.hints.personalityTraits ? `- Personality: ${JSON.stringify(req.hints.personalityTraits)}` : ""}` : "";

    const payload = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: `${userText}\n${hintsText}`.trim() },
            { type: "image_url", image_url: { url: req.imageUrl } }
          ]
        }
      ],
      response_format: { type: "json_object" },
    };

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAIKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`OpenAI analyze error: ${res.status} - ${errorText}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty analyze response");

    let parsed: AvatarVisualProfile;
    try {
      const clean = content.replace(/```json\s*|\s*```/g, "").trim();
      parsed = JSON.parse(clean) as AvatarVisualProfile;
    } catch (e: any) {
      throw new Error(`Analyze JSON parse error: ${e?.message || String(e)}`);
    }

    return {
      visualProfile: parsed,
      tokensUsed: {
        prompt: data.usage?.prompt_tokens ?? 0,
        completion: data.usage?.completion_tokens ?? 0,
        total: data.usage?.total_tokens ?? 0,
      },
    };
  }
);
