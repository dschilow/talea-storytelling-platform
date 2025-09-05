import { api } from "encore.dev/api";
import { secret } from "encore.dev/config";
import type { PhysicalTraits, PersonalityTraits } from "../avatar/create";
import { logTopic } from "../log/logger";

const openAIKey = secret("OpenAIKey");

// ==========================================
// ENHANCED VISUAL PROFILE TYPES
// ==========================================

export interface TechnicalSpecifications {
  cameraSettings: {
    depthOfField: string;
    focalLength: string;
    aperture: string;
    exposureEffects: string;
  };
  resolution: {
    quality: "high_definition" | "ultra_high" | "professional_quality" | "cinematic";
    clarity: string;
  };
  rendering: {
    antiAliasing: boolean;
    noiseLevel: "minimal" | "natural" | "textured";
    colorDepth: "standard" | "enhanced" | "professional";
  };
  physicsAccuracy: {
    gravityEffects: string;
    structuralBelievability: string;
  };
}

export interface MaterialProperties {
  skinTextures: {
    pores: string;
    imperfections: string[];
    ethnicDiversity: string;
  };
  fabricDetails: {
    threadPatterns: string[];
    realisticDrape: string;
    wearIndicators: string[];
  };
  surfaces: {
    scratches: string[];
    patina: string;
    oxidation: string;
    irregularities: string[];
  };
  transparency: {
    refraction: string;
    surfaceInteractions: string;
  };
}

export interface EnvironmentalFactors {
  atmospheric: {
    conditions: string;
    distanceHaze: string;
    weatherEffects: string[];
    humidity: string;
  };
  timeAndSeason: {
    lightingConditions: string;
    seasonalElements: string[];
    temperatureCues: string[];
  };
  particleEffects: {
    dust: string;
    moisture: string;
    atmosphericDepth: string;
  };
}

export interface CompositionControls {
  perspective: {
    viewpoint: "natural_human_vision" | "artistic_angle" | "dramatic_perspective";
    compositionRules: string[];
  };
  framing: {
    ruleOfThirds: boolean;
    goldenRatio: boolean;
    professionalPositioning: string;
  };
  subjectPlacement: {
    balance: string;
    aestheticArrangement: string;
  };
}

export interface StyleDefinition {
  primaryStyle: "photorealistic" | "cinematic" | "documentary" | "artistic" | "illustrated";
  renderingQuality: "hyperrealistic" | "detailed" | "high_resolution" | "professional";
  surfaceTextures: {
    materialProperties: string[];
    naturalWearPatterns: string[];
  };
  lighting: {
    type: "natural" | "studio_quality" | "dramatic" | "soft_ambient";
    quality: string;
  };
}

export interface DetailedPhysicalAppearance {
  skin: {
    tone: string;
    undertone: string;
    texture: {
      smoothness: string;
      pores: string;
      naturalVariations: string[];
    };
    distinctiveFeatures: string[];
    lighting: {
      howLightReacts: string;
      naturalGlow: string;
    };
  };
  
  hair: {
    color: {
      primary: string;
      highlights: string[];
      naturalVariations: string[];
    };
    texture: {
      type: "straight" | "wavy" | "curly" | "coily";
      thickness: "fine" | "medium" | "thick";
      density: "sparse" | "medium" | "dense";
    };
    length: string;
    style: {
      cut: string;
      naturalFall: string;
      movement: string;
    };
    condition: {
      health: string;
      shine: string;
      naturalOils: string;
    };
  };
  
  eyes: {
    color: {
      primary: string;
      patterns: string[];
      lightReflection: string;
    };
    shape: {
      overall: string;
      lidShape: string;
      eyebrowArch: string;
    };
    size: string;
    expression: {
      naturalRest: string;
      emotionalDefault: string;
    };
    details: {
      lashes: string;
      eyebrows: string;
      surroundingArea: string;
    };
  };
  
  face: {
    shape: {
      overall: string;
      jawline: string;
      cheekbones: string;
      forehead: string;
    };
    features: {
      nose: {
        shape: string;
        size: string;
        details: string;
      };
      mouth: {
        shape: string;
        lips: string;
        naturalExpression: string;
      };
      chin: string;
      ears: string;
    };
    proportions: {
      symmetry: string;
      balance: string;
      uniqueCharacteristics: string[];
    };
    expressions: {
      neutral: string;
      smile: string;
      naturalMicro: string[];
    };
  };
  
  physique: {
    build: string;
    height: string;
    posture: {
      natural: string;
      shoulderPosition: string;
      spineAlignment: string;
    };
    proportions: string[];
    movement: {
      naturalGait: string;
      gestureStyle: string;
      energyLevel: string;
    };
  };
}

export interface EnhancedClothing {
  style: {
    overall: string;
    era: string;
    culturalInfluence: string;
  };
  pieces: {
    top: string;
    bottom: string;
    outerwear: string;
    footwear: string;
  };
  materials: {
    fabrics: string[];
    textures: string[];
    wearPatterns: string[];
  };
  colors: {
    primary: string[];
    secondary: string[];
    accents: string[];
  };
  fit: {
    overall: string;
    specific: string[];
  };
  condition: {
    newness: string;
    wearSigns: string[];
  };
}

export interface EnhancedAccessories {
  jewelry: string[];
  functional: string[];
  decorative: string[];
  personal: string[];
}

export interface ConsistencyProfile {
  coreIdentifiers: string[];
  visualAnchors: string[];
  criticalFeatures: string[];
  styleMarkers: string[];
  lightingPreferences: string[];
  compositionNotes: string[];
}

export interface GenerationPrompts {
  positivePrompt: string;
  negativePrompt: string;
  styleModifiers: string[];
  technicalModifiers: string[];
}

export interface EnhancedAvatarVisualProfile {
  basicInfo: {
    ageApprox: string;
    gender: "male" | "female" | "non-binary" | "unknown";
    species: "human" | "anthropomorphic" | "animal" | "fantasy" | "other";
    characterType: "realistic" | "stylized" | "cartoon" | "anime" | "other";
  };
  
  physicalAppearance: DetailedPhysicalAppearance;
  clothing: EnhancedClothing;
  accessories: EnhancedAccessories;
  technicalSpecs: TechnicalSpecifications;
  materialProps: MaterialProperties;
  environmental: EnvironmentalFactors;
  composition: CompositionControls;
  style: StyleDefinition;
  
  quality: {
    include: string[];
    avoid: string[];
    reference: string[];
  };
  
  consistencyProfile: ConsistencyProfile;
  generationPrompts: GenerationPrompts;
}

// ==========================================
// REQUEST/RESPONSE INTERFACES
// ==========================================

export interface AnalyzeAvatarImageRequest {
  imageUrl: string;
  analysisType?: "basic" | "enhanced";
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
  analysisType: "basic" | "enhanced";
  visualProfile: any; // Can be AvatarVisualProfile or EnhancedAvatarVisualProfile
  generatedPrompts?: {
    compact: string;
    detailed: {
      positive: string;
      negative: string;
      style: string[];
      technical: string[];
    };
    variants: {
      story: string;
      portrait: string;
      fullBody: string;
      expression: string;
      clothing: string;
    };
  };
  consistency?: {
    coreIdentifiers: string[];
    criticalFeatures: string[];
    styleMarkers: string[];
  };
  validation?: {
    isValid: boolean;
    missingFields: string[];
    warnings: string[];
  };
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };
  processingTime?: number;
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function generateCompactPrompt(profile: EnhancedAvatarVisualProfile): string {
  const parts: string[] = [];

  if (profile.basicInfo) {
    parts.push(`${profile.basicInfo.characterType} ${profile.basicInfo.species}`);
    if (profile.basicInfo.ageApprox !== "unknown") {
      parts.push(`age ${profile.basicInfo.ageApprox}`);
    }
    if (profile.basicInfo.gender !== "unknown") {
      parts.push(profile.basicInfo.gender);
    }
  }

  if (profile.physicalAppearance) {
    const { skin, hair, eyes, face } = profile.physicalAppearance;
    
    if (skin) {
      parts.push(`${skin.tone} skin`);
      if (skin.distinctiveFeatures.length > 0) {
        parts.push(skin.distinctiveFeatures.join(", "));
      }
    }
    
    if (hair) {
      parts.push(`${hair.color.primary} ${hair.texture.type} hair`);
      parts.push(`${hair.length} ${hair.style.cut}`);
    }
    
    if (eyes) {
      parts.push(`${eyes.color.primary} ${eyes.shape.overall} eyes`);
    }
    
    if (face) {
      parts.push(`${face.shape.overall} face`);
    }
  }

  if (profile.style) {
    parts.push(profile.style.primaryStyle);
    parts.push(profile.style.renderingQuality);
    if (profile.style.lighting) {
      parts.push(`${profile.style.lighting.type} lighting`);
    }
  }

  if (profile.quality?.include) {
    parts.push(...profile.quality.include);
  }

  return parts.filter(Boolean).join(", ");
}

function generateDetailedPrompts(profile: EnhancedAvatarVisualProfile): {
  positive: string;
  negative: string;
  styleModifiers: string[];
  technicalModifiers: string[];
} {
  const positive: string[] = [];
  const negative: string[] = [];
  const styleModifiers: string[] = [];
  const technicalModifiers: string[] = [];

  if (profile.basicInfo) {
    positive.push(`${profile.basicInfo.characterType} ${profile.basicInfo.species} character`);
  }

  if (profile.physicalAppearance) {
    const { skin, hair, eyes, face, physique } = profile.physicalAppearance;
    
    if (skin) {
      positive.push(`${skin.tone} skin with ${skin.texture.smoothness} texture`);
      positive.push(`${skin.texture.pores} pores, ${skin.texture.naturalVariations.join(", ")}`);
      if (skin.distinctiveFeatures.length > 0) {
        positive.push(skin.distinctiveFeatures.join(", "));
      }
    }
    
    if (hair) {
      positive.push(`${hair.color.primary} ${hair.texture.type} hair`);
      positive.push(`${hair.length} length, ${hair.style.cut} cut`);
      positive.push(`hair texture: ${hair.texture.thickness}, density: ${hair.texture.density}`);
      positive.push(`hair condition: ${hair.condition.health}, ${hair.condition.shine} shine`);
      if (hair.color.highlights.length > 0) {
        positive.push(`hair highlights: ${hair.color.highlights.join(", ")}`);
      }
    }
    
    if (eyes) {
      positive.push(`${eyes.color.primary} ${eyes.shape.overall} eyes`);
      positive.push(`eye size: ${eyes.size}, ${eyes.expression.naturalRest} expression`);
      if (eyes.color.patterns.length > 0) {
        positive.push(`eye patterns: ${eyes.color.patterns.join(", ")}`);
      }
      positive.push(`eyebrows: ${eyes.details.eyebrows}, lashes: ${eyes.details.lashes}`);
    }
    
    if (face) {
      positive.push(`${face.shape.overall} face shape`);
      positive.push(`${face.features.nose.shape} ${face.features.nose.size} nose`);
      positive.push(`${face.features.mouth.shape} mouth with ${face.features.mouth.lips} lips`);
      positive.push(`jawline: ${face.shape.jawline}, cheekbones: ${face.shape.cheekbones}`);
    }
    
    if (physique) {
      positive.push(`${physique.build} build, ${physique.height} height`);
      positive.push(`posture: ${physique.posture.natural}`);
    }
  }

  if (profile.style) {
    styleModifiers.push(profile.style.primaryStyle);
    styleModifiers.push(profile.style.renderingQuality);
    if (profile.style.lighting) {
      styleModifiers.push(`${profile.style.lighting.type} lighting`);
      styleModifiers.push(profile.style.lighting.quality);
    }
    if (profile.style.surfaceTextures) {
      styleModifiers.push(...profile.style.surfaceTextures.materialProperties);
    }
  }

  if (profile.technicalSpecs) {
    const { cameraSettings, resolution, rendering } = profile.technicalSpecs;
    
    if (cameraSettings) {
      technicalModifiers.push(`depth of field: ${cameraSettings.depthOfField}`);
      technicalModifiers.push(`focal length: ${cameraSettings.focalLength}`);
      technicalModifiers.push(`aperture: ${cameraSettings.aperture}`);
    }
    
    if (resolution) {
      technicalModifiers.push(`${resolution.quality} resolution`);
      technicalModifiers.push(resolution.clarity);
    }
    
    if (rendering) {
      if (rendering.antiAliasing) {
        technicalModifiers.push("anti-aliasing enabled");
      }
      technicalModifiers.push(`noise level: ${rendering.noiseLevel}`);
      technicalModifiers.push(`color depth: ${rendering.colorDepth}`);
    }
  }

  if (profile.quality) {
    if (profile.quality.include) {
      positive.push(...profile.quality.include);
    }
    if (profile.quality.avoid) {
      negative.push(...profile.quality.avoid);
    }
  }

  return {
    positive: positive.join(", "),
    negative: negative.join(", "),
    styleModifiers,
    technicalModifiers
  };
}

function generatePromptVariants(profile: EnhancedAvatarVisualProfile): {
  story: string;
  portrait: string;
  fullBody: string;
  expression: string;
  clothing: string;
} {
  const base = generateCompactPrompt(profile);
  const detailed = generateDetailedPrompts(profile);
  
  return {
    story: `${base}, storytelling scene, narrative context, ${detailed.styleModifiers.join(", ")}`,
    
    portrait: `close-up portrait, ${base}, detailed facial features, ${profile.style?.lighting?.type || "natural"} lighting, ${detailed.technicalModifiers.filter(m => m.includes("depth of field")).join(", ")}`,
    
    fullBody: `full body view, ${base}, complete figure, standing pose, ${profile.physicalAppearance?.physique?.posture?.natural || "natural posture"}, environmental context`,
    
    expression: `${base}, ${profile.physicalAppearance?.face?.expressions?.naturalMicro?.join(", ") || "natural expression"}, emotional depth, character personality showing`,
    
    clothing: `${base}, detailed clothing, ${profile.clothing?.style?.overall || "casual style"}, ${profile.clothing?.materials?.fabrics?.join(", ") || "natural fabrics"}, outfit coordination`
  };
}

function extractConsistencyFeatures(profile: EnhancedAvatarVisualProfile): {
  coreIdentifiers: string[];
  criticalFeatures: string[];
  styleMarkers: string[];
} {
  const coreIdentifiers: string[] = [];
  const criticalFeatures: string[] = [];
  const styleMarkers: string[] = [];

  if (profile.basicInfo) {
    coreIdentifiers.push(`${profile.basicInfo.species} ${profile.basicInfo.characterType}`);
    if (profile.basicInfo.gender !== "unknown") {
      coreIdentifiers.push(profile.basicInfo.gender);
    }
  }

  if (profile.physicalAppearance) {
    const { skin, hair, eyes, face } = profile.physicalAppearance;
    
    if (skin) {
      coreIdentifiers.push(`${skin.tone} skin`);
      if (skin.distinctiveFeatures) {
        criticalFeatures.push(...skin.distinctiveFeatures);
      }
    }
    
    if (hair) {
      coreIdentifiers.push(`${hair.color.primary} ${hair.texture.type} hair`);
    }
    
    if (eyes) {
      coreIdentifiers.push(`${eyes.color.primary} eyes`);
      if (eyes.details) {
        criticalFeatures.push(`eyebrows: ${eyes.details.eyebrows}`);
      }
    }
    
    if (face) {
      coreIdentifiers.push(`${face.shape.overall} face`);
      if (face.features) {
        criticalFeatures.push(`nose: ${face.features.nose.shape}`);
        criticalFeatures.push(`mouth: ${face.features.mouth.shape}`);
      }
    }
  }

  if (profile.style) {
    styleMarkers.push(profile.style.primaryStyle);
    styleMarkers.push(profile.style.renderingQuality);
    if (profile.style.lighting) {
      styleMarkers.push(`${profile.style.lighting.type} lighting`);
    }
  }

  return {
    coreIdentifiers,
    criticalFeatures,
    styleMarkers
  };
}

function validateProfile(profile: Partial<EnhancedAvatarVisualProfile>): {
  isValid: boolean;
  missingFields: string[];
  warnings: string[];
} {
  const missing: string[] = [];
  const warnings: string[] = [];

  if (!profile.basicInfo) {
    missing.push("basicInfo");
  } else {
    if (!profile.basicInfo.species) missing.push("basicInfo.species");
    if (!profile.basicInfo.characterType) missing.push("basicInfo.characterType");
  }

  if (!profile.physicalAppearance) {
    missing.push("physicalAppearance");
  } else {
    if (!profile.physicalAppearance.skin) missing.push("physicalAppearance.skin");
    if (!profile.physicalAppearance.hair) missing.push("physicalAppearance.hair");
    if (!profile.physicalAppearance.eyes) missing.push("physicalAppearance.eyes");
    if (!profile.physicalAppearance.face) missing.push("physicalAppearance.face");
  }

  if (!profile.style) {
    warnings.push("style definition missing - may affect generation quality");
  }

  if (!profile.technicalSpecs) {
    warnings.push("technicalSpecs missing - may affect rendering quality");
  }

  if (!profile.consistencyProfile) {
    warnings.push("consistencyProfile missing - may affect future regeneration");
  }

  return {
    isValid: missing.length === 0,
    missingFields: missing,
    warnings
  };
}

// ==========================================
// MAIN API ENDPOINT
// ==========================================

export const analyzeAvatarImage = api<AnalyzeAvatarImageRequest, AnalyzeAvatarImageResponse>(
  { expose: true, method: "POST", path: "/ai/analyze-avatar-image" },
  async (req) => {
    const startTime = Date.now();
    const analysisType = req.analysisType || "enhanced";
    
    console.log(`🔬 Analyzing avatar image with ${analysisType} analysis...`);

    // Enhanced Analysis
    if (analysisType === "enhanced") {
      const systemPrompt = `Du bist ein Experte für detaillierte visuelle Charakteranalyse und Bildbeschreibung nach dem Nano Banana JSON-Standard.

Du analysierst Avatar-Bilder mit höchster Präzision und erstellst umfassende visuelle Profile für professionelle Bild-Generierung.

WICHTIG: Analysiere zunächst ob es sich um einen Menschen, ein Tier oder eine andere Kreatur handelt.

CORE STRUCTURE:
- Organisiere die Analyse in logische JSON-Sektionen
- Verwende korrekte Syntax mit Klammern, Kommas und Anführungszeichen
- Trenne visuelle Elemente in spezifische Objekte für präzise Kontrolle
- Validiere die JSON-Struktur vor der Ausgabe

STYLE DEFINITION:
- Definiere den primären Stil: "photorealistic", "cinematic", "documentary", "artistic", "illustrated"
- Bestimme die Rendering-Qualität: "hyperrealistic", "detailed", "high_resolution", "professional"
- Beschreibe Oberflächentexturen: "authentische Materialeigenschaften", "natürliche Abnutzungsmuster"
- Analysiere die Beleuchtung: "natural", "studio_quality", "dramatic", "soft_ambient"

TECHNICAL SPECIFICATIONS:
- Kamera-Einstellungen: Schärfentiefe, Brennweite, Blenden-Effekte, Belichtung
- Auflösung: "high_definition", "ultra_high", "professional_quality", "cinematic"
- Rendering: Anti-Aliasing, Rausch-Level, Farbtiefe-Standards
- Physik-Genauigkeit: Schwerkraft-Effekte, strukturelle Glaubwürdigkeit

AUSGABE: Gültiges JSON nach EnhancedAvatarVisualProfile Schema. Kein zusätzlicher Text.`;

      const userPrompt = `Analysiere dieses Avatar-Bild und erstelle ein umfassendes visuelles Profil.

DETAILLIERTE ANALYSE-REGELN:

GRUNDLEGENDE IDENTIFIKATION:
- Bestimme Species: Mensch, anthropomorphes Wesen, Tier, Fantasy-Kreatur
- Schätze Alter und Geschlecht
- Identifiziere Charakter-Typ: realistisch, stilisiert, cartoon, anime

PHYSISCHE ERSCHEINUNG (EXTREM DETAILLIERT):
- Haut: Ton, Unterton, Textur, besondere Merkmale, Lichtreaktion
- Haare: Farbe (primär, highlights), Textur, Länge, Stil, Zustand
- Augen: Farbe, Form, Größe, Ausdruck, Details
- Gesicht: Form, Features, Proportionen, Ausdrücke
- Körperbau: Build, Größe, Haltung, Bewegung

TECHNISCHE SPEZIFIKATIONEN:
- Kamera-Einstellungen und Rendering-Qualität
- Material-Eigenschaften für alle sichtbaren Oberflächen
- Umgebungsfaktoren und Beleuchtung
- Komposition und Perspektive

KONSISTENZ-PROFIL:
- Kern-Identifikatoren für Wiedererkennung
- Kritische Features für Konsistenz
- Stil-Marker und Beleuchtungs-Präferenzen

Das JSON muss vollständig der EnhancedAvatarVisualProfile Struktur folgen.`;

      const hintsText = req.hints ? `
HINWEISE:
${req.hints.name ? `- Name: ${req.hints.name}` : ""}
${req.hints.expectedType ? `- Erwarteter Typ: ${req.hints.expectedType}` : ""}
${req.hints.culturalContext ? `- Kultureller Kontext: ${req.hints.culturalContext}` : ""}
${req.hints.stylePreference ? `- Stil-Präferenz: ${req.hints.stylePreference}` : ""}
${req.hints.physicalTraits ? `- Physische Merkmale: ${JSON.stringify(req.hints.physicalTraits)}` : ""}
${req.hints.personalityTraits ? `- Persönlichkeit: ${JSON.stringify(req.hints.personalityTraits)}` : ""}` : "";

      const payload = {
        model: "gpt-5-nano",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: `${userPrompt}\n${hintsText}`.trim() },
              { type: "image_url", image_url: { url: req.imageUrl } }
            ]
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 4000,
        temperature: 0.3,
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
        console.error("❌ OpenAI enhanced analysis error:", errorText);
        throw new Error(`OpenAI enhanced analysis error: ${res.status} - ${errorText}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      
      if (!content) {
        console.error("❌ Empty enhanced analysis response from OpenAI");
        throw new Error("Empty enhanced analysis response");
      }

      let parsed: EnhancedAvatarVisualProfile;
      try {
        const clean = content.replace(/```json\s*|\s*```/g, "").trim();
        console.log("🔍 Parsing JSON response...", clean.substring(0, 200) + "...");
        parsed = JSON.parse(clean) as EnhancedAvatarVisualProfile;
        console.log("✅ Successfully parsed enhanced visual profile.");
        
        // Basis-Validierung
        if (!parsed.basicInfo || !parsed.physicalAppearance) {
          console.warn("⚠️ Enhanced profile incomplete, falling back to basic...");
          return analyzeWithBasic(req, startTime);
        }
        
      } catch (e: any) {
        console.error("❌ Enhanced analysis JSON parse error:", e.message);
        console.error("Raw content (first 500 chars):", content.substring(0, 500));
        
        // Fallback zu basic analysis bei JSON Parse Fehlern
        console.log("🔄 Falling back to basic analysis due to parse error...");
        return analyzeWithBasic(req, startTime);
      }

      // Log für Monitoring
      await logTopic.publish({
        source: 'openai-enhanced-avatar-analysis',
        timestamp: new Date(),
        request: {
          ...payload,
          messages: payload.messages.map(msg => 
            msg.role === 'user' && Array.isArray(msg.content) 
              ? { ...msg, content: msg.content.filter(c => c.type !== 'image_url') }
              : msg
          )
        },
        response: {
          tokensUsed: data.usage,
          analysisType: 'enhanced'
        },
      });

      // Generiere zusätzliche Daten
      const validation = validateProfile(parsed);
      const consistency = extractConsistencyFeatures(parsed);
      const compactPrompt = generateCompactPrompt(parsed);
      const detailedPrompts = generateDetailedPrompts(parsed);
      const variants = generatePromptVariants(parsed);

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        analysisType: "enhanced",
        visualProfile: parsed,
        generatedPrompts: {
          compact: compactPrompt,
          detailed: detailedPrompts,
          variants
        },
        consistency,
        validation,
        tokensUsed: {
          prompt: data.usage?.prompt_tokens ?? 0,
          completion: data.usage?.completion_tokens ?? 0,
          total: data.usage?.total_tokens ?? 0,
        },
        processingTime
      };

    } else {
      // Basic Analysis (original implementation für explizite basic requests)
      return analyzeWithBasic(req, startTime);
    }
  }
);

// ==========================================
// ALTERNATIVE: EINFACHE LÖSUNG
// ==========================================

// Wenn du willst, können wir auch erstmal die enhanced analysis komplett deaktivieren
// und nur basic analysis verwenden bis das Problem gelöst ist:

export const analyzeAvatarImageSimple = api<AnalyzeAvatarImageRequest, AnalyzeAvatarImageResponse>(
  { expose: true, method: "POST", path: "/ai/analyze-avatar-image-simple" },
  async (req) => {
    const startTime = Date.now();
    console.log("🔬 Analyzing avatar image with BASIC analysis only...");
    
    // Immer basic analysis verwenden - stable und funktioniert
    return analyzeWithBasic(req, startTime);
  }
);