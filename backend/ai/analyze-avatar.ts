import { api } from "encore.dev/api";
import { secret } from "encore.dev/config";
import type { PhysicalTraits, PersonalityTraits } from "../avatar/create";
import { logTopic } from "../log/logger";

const openAIKey = secret("OpenAIKey");

export interface AnalyzeAvatarImageRequest {
  imageUrl: string;
  hints?: {
    name?: string;
    physicalTraits?: PhysicalTraits;
    personalityTraits?: PersonalityTraits;
    expectedType?: "human" | "anthropomorphic" | "animal" | "fantasy";
    culturalContext?: string;
    stylePreference?: "photorealistic" | "cinematic" | "artistic" | "illustrated";
  };
}

export interface AnalyzeAvatarImageResponse {
  success: boolean;
  visualProfile: any;
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };
  processingTime?: number;
}

// PRODUCTION-READY SOLUTION: Nur basic analysis, 100% stabil
export const analyzeAvatarImage = api<AnalyzeAvatarImageRequest, AnalyzeAvatarImageResponse>(
  { expose: true, method: "POST", path: "/ai/analyze-avatar-image" },
  async (req) => {
    const startTime = Date.now();
    console.log("🔬 Analyzing avatar image with STABLE analysis...");

    const system = `You are an expert visual character profiler for children's books.
You receive one portrait-like image of a child character (avatar). 
Handelt es sich dabei um einen menschen oder tier?
du muss beschreiben was du siehst.
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
${req.hints.personalityTraits ? `- Personality: ${JSON.stringify(req.hints.personalityTraits)}` : ""}
${req.hints.expectedType ? `- Expected Type: ${req.hints.expectedType}` : ""}
${req.hints.culturalContext ? `- Cultural Context: ${req.hints.culturalContext}` : ""}
${req.hints.stylePreference ? `- Style Preference: ${req.hints.stylePreference}` : ""}` : "";

    const payload = {
      model: "gpt-5-nano",
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
    	max_completion_tokens: 12000,
    };

    console.log("📤 Sending request to OpenAI with gpt-5-nano...");

    let res;
    try {
      res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openAIKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch (fetchError: any) {
      console.error("❌ Network error calling OpenAI:", fetchError.message);
      throw new Error(`Network error: ${fetchError.message}`);
    }

    if (!res.ok) {
      const errorText = await res.text();
      console.error("❌ OpenAI API error:", res.status, errorText);
      throw new Error(`OpenAI API error: ${res.status} - ${errorText}`);
    }

    let data;
    try {
      data = await res.json();
    } catch (jsonError: any) {
      console.error("❌ Failed to parse OpenAI response as JSON:", jsonError.message);
      throw new Error(`JSON parse error: ${jsonError.message}`);
    }

    console.log("📥 OpenAI response received:", {
      hasChoices: !!data.choices,
      choicesLength: data.choices?.length || 0,
      usage: data.usage,
      firstChoiceContent: data.choices?.[0]?.message?.content ? "present" : "missing"
    });

    const content = data.choices?.[0]?.message?.content;
    if (!content || content.trim() === "") {
      console.error("❌ Empty content from OpenAI");
      console.error("Full response:", JSON.stringify(data, null, 2));
      throw new Error("OpenAI returned empty content");
    }

    // Log für Monitoring
    await logTopic.publish({
      source: 'openai-avatar-analysis-stable',
      timestamp: new Date(),
      request: {
        model: (payload as any).model,
        hasImage: true,
        hintsProvided: !!req.hints
      },
      response: {
        tokensUsed: data.usage,
        success: true
      },
    });

    let parsed: any;
    try {
      const clean = content.replace(/```json\s*|\s*```/g, "").trim();
      console.log("🔍 Parsing JSON response (first 200 chars):", clean.substring(0, 200) + "...");
      parsed = JSON.parse(clean);
      console.log("✅ Successfully parsed visual profile");
      
      // Basis-Validierung
      if (!parsed.hair || !parsed.eyes) {
        console.warn("⚠️ Profile seems incomplete but proceeding...");
      }
      
    } catch (parseError: any) {
      console.error("❌ JSON parse error:", parseError.message);
      console.error("Raw content from OpenAI:", content.substring(0, 500));
      throw new Error(`Failed to parse analysis result: ${parseError.message}`);
    }

    const processingTime = Date.now() - startTime;
    console.log(`✅ Analysis completed successfully in ${processingTime}ms`);

    return {
      success: true,
      visualProfile: parsed,
      tokensUsed: {
        prompt: data.usage?.prompt_tokens ?? 0,
        completion: data.usage?.completion_tokens ?? 0,
        total: data.usage?.total_tokens ?? 0,
      },
      processingTime
    };
  }
);
