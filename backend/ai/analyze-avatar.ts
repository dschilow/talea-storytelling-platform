import { api } from "encore.dev/api";
import { secret } from "encore.dev/config";
import type { PhysicalTraits, PersonalityTraits } from "../avatar/avatar";
import { logTopic } from "../log/logger";
import { publishWithTimeout } from "../helpers/pubsubTimeout";
import { translateVisualProfile } from "./translate";

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

    // Check if the image is an SVG placeholder (unsupported by OpenAI)
    if (req.imageUrl.startsWith("data:image/svg+xml")) {
      console.warn("⚠️ Cannot analyze SVG placeholder images - skipping analysis");
      return {
        success: false,
        visualProfile: null,
        processingTime: Date.now() - startTime,
      };
    }

    const system = `Du bist ein Experte für visuelle Charakter-Profile in Geschichten und Illustrationen. Du erhältst ein Bild (Avatar), das ein Wesen darstellen kann – Mensch, Tier, Roboter, Fantasiefigur, Obst, Gemüse, unbelebtes Objekt oder Anime-Stil. Deine Aufgabe: Beschreibe den Avatar so präzise und konsistent wie möglich, damit er in allen zukünftigen Illustrationen gleich aussieht.

### KRITISCH: Charaktertyp-Identifikation
- Identifiziere ZUERST den Charaktertyp präzise: Mensch, Tier (welche Art?), Roboter, Obst/Gemüse, Objekt, Fantasiewesen
- Gib IMMER im "characterType" Feld den genauen Typ an (z.B. "human child", "orange tabby cat", "robot", "strawberry", "talking tree")
- Beschreibe artspezifische Merkmale: z.B. bei Tieren -> Anzahl Beine, Fell/Federn, Schwanz, Schnauze
- Bei Robotern -> Metallteile, Bildschirme, mechanische Gelenke
- Bei Obst/Gemüse -> Fruchtform, Textur, Stiel, Blätter
- Bei Menschen -> aufrecht auf zwei Beinen, menschliche Gesichtszüge, Hände mit 5 Fingern

### Regeln
- Antworte streng nur als JSON im untenstehenden Schema, ohne zusätzlichen Text.
- Beschreibe sichtbare Merkmale exakt: Haut/Fell/Federn/Schuppen/Metall/Fruchtoberfläche (Farbe, Muster, Besonderheiten), Haare/Mähne, Augen, Gesichtsform, Hörner, Schnauze usw.
- Kleidung nur beschreiben, wenn klar sichtbar; ansonsten leer lassen.
- Accessories (z. B. Brille, Schmuck, Rucksack) immer angeben, wenn vorhanden, sonst [].
- consistentDescriptors: exakt 8–10 kurze Tokens (3–6 Wörter), die die wichtigsten visuellen Merkmale festhalten. Keine Kleidung, nur konstante körperliche Eigenschaften.
- WICHTIG: Bei Tieren IMMER erwähnen: "quadruped" (4 Beine), "on four paws", "tail visible", artspezifische Merkmale
- Nutze einfache, klare Begriffe, keine Markennamen oder urheberrechtlich geschützten Bezüge.

### Stil & Qualität
- Stil: „Illustration, konsistentes Charakterdesign, kindgerecht, sauberer Zeichenstil"
- Detailgrad: „detailliert, hochauflösend, klare Linien, konsistente Proportionen"
- Licht: „weiches Umgebungslicht, natürliche Beleuchtung"
- Textur: „authentische Materialeigenschaften, natürliche Farbverläufe"
- Vermeide: „digitale Artefakte, verzerrte Proportionen, unnatürlich gesättigte Farben"`;

    const userText = `Analysiere dieses Avatar-Bild und gib die kanonische Beschreibung exakt gemäß Schema als JSON aus.

WICHTIG: Identifiziere zuerst den CHARACTER TYPE genau (Mensch/Tier/Roboter/Obst/etc) und beschreibe dann alle relevanten Merkmale.

Falls Hinweise zu Avatar-Eigenschaften bereitgestellt werden, berücksichtige diese bei der Analyse und integriere sie in die Beschreibung, wenn sie mit dem sichtbaren Bild übereinstimmen oder es ergänzen.

Schema:
{
  "characterType": "string (PFLICHT: z.B. 'human child', 'orange tabby cat', 'robot', 'strawberry', 'talking tree', 'dragon')",
  "speciesCategory": "human | animal | robot | plant | object | fantasy",
  "locomotion": "bipedal | quadruped | flying | aquatic | stationary | other",
  "ageApprox": "string (z. B. '5-7', '2-3 months old kitten', 'ancient', 'unbekannt')",
  "gender": "male | female | non-binary | unknown",
  "skin": {
    "tone": "string (z. B. 'pale beige', 'orange fur', 'metallic silver', 'red fruit skin')",
    "undertone": "string (optional)",
    "distinctiveFeatures": ["string", ...] // z.B. ["white belly patch", "striped pattern", "rust spots"]
  },
  "hair": {
    "color": "string",
    "type": "straight|wavy|curly|coily|none|fur|feathers|leaves",
    "length": "short|medium|long|none",
    "style": "string"
  },
  "eyes": {
    "color": "string",
    "shape": "string",
    "size": "small|medium|large"
  },
  "face": {
    "shape": "string",
    "nose": "string (oder 'snout', 'beak', 'button nose')",
    "mouth": "string (oder 'muzzle', 'beak')",
    "eyebrows": "string (falls vorhanden)",
    "freckles": false,
    "otherFeatures": ["string", ...] // z.B. ["long whiskers", "antenna", "screen display"]
  },
  "accessories": ["string", ...],
  "clothingCanonical": {
    "top": "string",
    "bottom": "string",
    "outfit": "string",
    "colors": ["string", ...],
    "patterns": ["string", ...]
  },
  "palette": {
    "primary": ["string", ...],
    "secondary": ["string", ...]
  },
  "consistentDescriptors": ["string", ...] // genau 8-10 Tokens - WICHTIG bei Tieren: "quadruped on four paws", "tail visible", etc.
}`;

    const hintsText = req.hints ? `AVATAR-EIGENSCHAFTEN ZUR BERÜCKSICHTIGUNG:
${req.hints.name ? `- Name des Avatars: ${req.hints.name}` : ""}
${req.hints.physicalTraits ? `- Physische Eigenschaften vom Ersteller: ${JSON.stringify(req.hints.physicalTraits, null, 2)}` : ""}
${req.hints.personalityTraits ? `- Persönlichkeitsmerkmale: ${JSON.stringify(req.hints.personalityTraits, null, 2)}` : ""}
${req.hints.expectedType ? `- Erwarteter Charakter-Typ: ${req.hints.expectedType}` : ""}
${req.hints.culturalContext ? `- Kultureller Kontext: ${req.hints.culturalContext}` : ""}
${req.hints.stylePreference ? `- Stil-Präferenz: ${req.hints.stylePreference}` : ""}

Integriere diese Informationen in deine visuelle Analyse, wenn sie mit dem Bild übereinstimmen oder es sinnvoll ergänzen.` : "";

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
    	max_completion_tokens: 12000,
    };

    console.log("📤 Sending request to OpenAI with gpt-5-mini...");

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

      // Log network errors
      await publishWithTimeout(logTopic, {
        source: 'openai-avatar-analysis-stable',
        timestamp: new Date(),
        request: {
          model: (payload as any).model,
          imageUrl: req.imageUrl,
          hints: req.hints,
          systemPrompt: system,
          userPrompt: userText,
          hintsText: hintsText,
          hasImage: true,
          hintsProvided: !!req.hints,
          maxTokens: (payload as any).max_completion_tokens
        },
        response: {
          success: false,
          errorType: 'network_error',
          errorMessage: fetchError.message,
          processingTimeMs: Date.now() - startTime
        },
      });

      throw new Error(`Network error: ${fetchError.message}`);
    }

    if (!res.ok) {
      const errorText = await res.text();
      console.error("❌ OpenAI API error:", res.status, errorText);

      // Log API errors
      await publishWithTimeout(logTopic, {
        source: 'openai-avatar-analysis-stable',
        timestamp: new Date(),
        request: {
          model: (payload as any).model,
          imageUrl: req.imageUrl,
          hints: req.hints,
          systemPrompt: system,
          userPrompt: userText,
          hintsText: hintsText,
          hasImage: true,
          hintsProvided: !!req.hints,
          maxTokens: (payload as any).max_completion_tokens
        },
        response: {
          success: false,
          errorType: 'openai_api_error',
          errorMessage: errorText,
          httpStatus: res.status,
          processingTimeMs: Date.now() - startTime
        },
      });

      throw new Error(`OpenAI API error: ${res.status} - ${errorText}`);
    }

    let data: any;
    try {
      data = await res.json();
    } catch (jsonError: any) {
      console.error("❌ Failed to parse OpenAI response as JSON:", jsonError.message);

      // Log JSON parsing errors
      await publishWithTimeout(logTopic, {
        source: 'openai-avatar-analysis-stable',
        timestamp: new Date(),
        request: {
          model: (payload as any).model,
          imageUrl: req.imageUrl,
          hints: req.hints,
          systemPrompt: system,
          userPrompt: userText,
          hintsText: hintsText,
          hasImage: true,
          hintsProvided: !!req.hints,
          maxTokens: (payload as any).max_completion_tokens
        },
        response: {
          success: false,
          errorType: 'json_parse_error',
          errorMessage: jsonError.message,
          processingTimeMs: Date.now() - startTime
        },
      });

      throw new Error(`JSON parse error: ${jsonError.message}`);
    }

    console.log("📥 OpenAI response received:", {
      hasChoices: !!data.choices,
      choicesLength: data.choices?.length || 0,
      usage: data.usage,
      firstChoiceContent: data.choices?.[0]?.message?.content ? "present" : "missing"
    });

    const content = (data as any).choices?.[0]?.message?.content;
    if (!content || content.trim() === "") {
      console.error("❌ Empty content from OpenAI");
      console.error("Full response:", JSON.stringify(data, null, 2));

      // Log empty content errors
      await publishWithTimeout(logTopic, {
        source: 'openai-avatar-analysis-stable',
        timestamp: new Date(),
        request: {
          model: (payload as any).model,
          imageUrl: req.imageUrl,
          hints: req.hints,
          systemPrompt: system,
          userPrompt: userText,
          hintsText: hintsText,
          hasImage: true,
          hintsProvided: !!req.hints,
          maxTokens: (payload as any).max_completion_tokens
        },
        response: {
          success: false,
          errorType: 'empty_content',
          errorMessage: "OpenAI returned empty content",
          fullOpenAIResponse: data,
          processingTimeMs: Date.now() - startTime
        },
      });

      throw new Error("OpenAI returned empty content");
    }

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

      // Log analysis parsing errors
      await publishWithTimeout(logTopic, {
        source: 'openai-avatar-analysis-stable',
        timestamp: new Date(),
        request: {
          model: (payload as any).model,
          imageUrl: req.imageUrl,
          hints: req.hints,
          systemPrompt: system,
          userPrompt: userText,
          hintsText: hintsText,
          hasImage: true,
          hintsProvided: !!req.hints,
          maxTokens: (payload as any).max_completion_tokens
        },
        response: {
          success: false,
          errorType: 'analysis_parse_error',
          errorMessage: parseError.message,
          rawContent: content,
          processingTimeMs: Date.now() - startTime
        },
      });

      throw new Error(`Failed to parse analysis result: ${parseError.message}`);
    }

    const processingTime = Date.now() - startTime;
    console.log(`✅ Analysis completed successfully in ${processingTime}ms`);

    // CRITICAL: Translate visual profile to English using OpenAI for Runware compatibility
    console.log(`🌐 Translating visual profile to English using OpenAI...`);
    const translatedProfile = await translateVisualProfile(parsed);
    console.log(`✅ Visual profile fully translated to English`);

    // Erweiterte Logs für bessere Analyse
    await publishWithTimeout(logTopic, {
      source: 'openai-avatar-analysis-stable',
      timestamp: new Date(),
      request: {
        model: (payload as any).model,
        imageUrl: req.imageUrl,
        hints: req.hints,
        systemPrompt: system,
        userPrompt: userText,
        hintsText: hintsText,
        hasImage: true,
        hintsProvided: !!req.hints,
        maxTokens: (payload as any).max_completion_tokens
      },
      response: {
        tokensUsed: data.usage,
        success: true,
        visualProfileOriginal: parsed,
        visualProfileTranslated: translatedProfile,
        rawContent: content,
        processingTimeMs: processingTime,
        fullOpenAIResponse: {
          choices: data.choices,
          usage: data.usage,
          model: data.model,
          id: data.id,
          created: data.created,
          object: data.object
        }
      },
    });

    return {
      success: true,
      visualProfile: translatedProfile, // Return translated version for Runware
      tokensUsed: {
        prompt: data.usage?.prompt_tokens ?? 0,
        completion: data.usage?.completion_tokens ?? 0,
        total: data.usage?.total_tokens ?? 0,
      },
      processingTime
    };
  }
);
