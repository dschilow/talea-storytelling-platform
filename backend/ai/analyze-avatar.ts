import { api, APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";
import type { PhysicalTraits, PersonalityTraits } from "../avatar/avatar";
import { logTopic } from "../log/logger";
import { publishWithTimeout } from "../helpers/pubsubTimeout";
import { translateVisualProfile } from "./translate";
import { resolveImageUrlForClient } from "../helpers/bucket-storage";
import { getAuthData } from "~encore/auth";
import { claimMeteredUsage } from "../helpers/billing";

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
  { expose: true, method: "POST", path: "/ai/analyze-avatar-image", auth: true },
  async (req) => {
    const auth = getAuthData()!;
    if (!req.imageUrl || req.imageUrl.length > 8_000) {
      throw APIError.invalidArgument("Invalid image URL.");
    }
    await claimMeteredUsage({
      userId: auth.userID,
      kind: "chat",
      units: 1,
      clerkToken: auth.clerkToken,
    });

    const startTime = Date.now();
    console.log("🔬 Analyzing avatar image with STABLE analysis...");

    // Resolve bucket:// URLs to HTTP URLs before sending to OpenAI
    const resolvedImageUrl = await resolveImageUrlForClient(req.imageUrl);
    if (!resolvedImageUrl) {
      console.error("[ai.avatar-analysis] Could not resolve image URL");
      return {
        success: false,
        visualProfile: null,
        processingTime: Date.now() - startTime,
      };
    }

    // Check if the image is an SVG placeholder (unsupported by OpenAI)
    if (resolvedImageUrl.startsWith("data:image/svg+xml")) {
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
- Schreibe ausnahmslos alle JSON-Stringwerte auf Englisch; Eigennamen gehören nicht in das visuelle Profil.
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
${req.hints.physicalTraits ? `- Physische Eigenschaften vom Ersteller: ${JSON.stringify(req.hints.physicalTraits, null, 2)}` : ""}
${req.hints.expectedType ? `- Erwarteter Charakter-Typ: ${req.hints.expectedType}` : ""}
${req.hints.stylePreference ? `- Stil-Präferenz: ${req.hints.stylePreference}` : ""}

Nutze nur visuell relevante Hinweise und übernimm nichts, das dem Bild widerspricht.` : "";

    const payload = {
      model: "gpt-5.4-mini",
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: `${userText}\n${hintsText}`.trim() },
            { type: "image_url", image_url: { url: resolvedImageUrl } }
          ]
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 4000,
    };

    const analysisRequestLog = {
      model: payload.model,
      hasImage: true,
      hasPhysicalHints: Boolean(req.hints?.physicalTraits),
      expectedType: req.hints?.expectedType ?? null,
      stylePreference: req.hints?.stylePreference ?? null,
      maxTokens: payload.max_completion_tokens,
    };
    console.info("[ai.avatar-analysis] Sending vision request", analysisRequestLog);

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
      console.error("[ai.avatar-analysis] Vision provider network error", { errorName: fetchError?.name });

      // Log network errors
      await publishWithTimeout(logTopic, {
        source: 'openai-avatar-analysis-stable',
        timestamp: new Date(),
        request: analysisRequestLog,
        response: {
          success: false,
          errorType: 'network_error',
          processingTimeMs: Date.now() - startTime
        },
      });

      throw new Error("Avatar image analysis provider is temporarily unavailable.");
    }

    if (!res.ok) {
      console.error("[ai.avatar-analysis] Vision provider API error", { status: res.status });

      // Log API errors
      await publishWithTimeout(logTopic, {
        source: 'openai-avatar-analysis-stable',
        timestamp: new Date(),
        request: analysisRequestLog,
        response: {
          success: false,
          errorType: 'openai_api_error',
          httpStatus: res.status,
          processingTimeMs: Date.now() - startTime
        },
      });

      throw new Error(`Avatar image analysis failed with status ${res.status}.`);
    }

    let data: any;
    try {
      data = await res.json();
    } catch (jsonError: any) {
      console.error("[ai.avatar-analysis] Invalid provider response envelope", { errorName: jsonError?.name });

      // Log JSON parsing errors
      await publishWithTimeout(logTopic, {
        source: 'openai-avatar-analysis-stable',
        timestamp: new Date(),
        request: analysisRequestLog,
        response: {
          success: false,
          errorType: 'json_parse_error',
          processingTimeMs: Date.now() - startTime
        },
      });

      throw new Error("Avatar image analysis returned an invalid response.");
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

      // Log empty content errors
      await publishWithTimeout(logTopic, {
        source: 'openai-avatar-analysis-stable',
        timestamp: new Date(),
        request: analysisRequestLog,
        response: {
          success: false,
          errorType: 'empty_content',
          errorMessage: "OpenAI returned empty content",
          processingTimeMs: Date.now() - startTime
        },
      });

      throw new Error("OpenAI returned empty content");
    }

    let parsed: any;
    try {
      const clean = content.replace(/```json\s*|\s*```/g, "").trim();
      parsed = JSON.parse(clean);
      console.log("✅ Successfully parsed visual profile");
      
      // Basis-Validierung
      if (!parsed.hair || !parsed.eyes) {
        console.warn("⚠️ Profile seems incomplete but proceeding...");
      }
      
    } catch (parseError: any) {
      console.error("[ai.avatar-analysis] Invalid visual profile JSON", { errorName: parseError?.name });

      // Log analysis parsing errors
      await publishWithTimeout(logTopic, {
        source: 'openai-avatar-analysis-stable',
        timestamp: new Date(),
        request: analysisRequestLog,
        response: {
          success: false,
          errorType: 'analysis_parse_error',
          processingTimeMs: Date.now() - startTime
        },
      });

      throw new Error("Avatar image analysis returned invalid profile JSON.");
    }

    const processingTime = Date.now() - startTime;

    // The vision prompt requests English. Translation is a defensive fallback for localized fields only.
    const translatedProfile = await translateVisualProfile(parsed);
    console.info("[ai.avatar-analysis] Analysis completed", {
      processingTimeMs: processingTime,
      totalTokens: data.usage?.total_tokens ?? 0,
    });

    // Erweiterte Logs für bessere Analyse
    await publishWithTimeout(logTopic, {
      source: 'openai-avatar-analysis-stable',
      timestamp: new Date(),
      request: analysisRequestLog,
      response: {
        tokensUsed: data.usage,
        success: true,
        processingTimeMs: processingTime
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
