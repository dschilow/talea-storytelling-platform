import { api } from "encore.dev/api";
import { secret } from "encore.dev/config";
import type { StoryConfig, Chapter } from "./generate";
import type { AvatarVisualProfile } from "../avatar/create";
import { ai } from "~encore/clients";
import { logTopic } from "../log/logger";
import { callOpenAIWithCache } from "../ai/openai-cache";

// ---- OpenAI Modell & Pricing (GPT-4o) ----
const MODEL = "gpt-5-nano";
const INPUT_COST_PER_1M = 5.0;
const OUTPUT_COST_PER_1M = 15.0;

const openAIKey = secret("OpenAIKey");

interface ExtendedAvatarDetails {
  id: string;
  name: string;
  description?: string;
  physicalTraits: any;
  personalityTraits: any;
  imageUrl?: string | null;
  visualProfile?: AvatarVisualProfile;
  memory?: {
    experiences: string[];
    learnedSkills: string[];
    personalGrowth: string[];
    relationships: Record<string, string>;
  };
  currentLevel?: {
    knowledge: number;
    emotional: number;
    social: number;
    creativity: number;
  };
}

interface GenerateStoryContentRequest {
  config: StoryConfig;
  avatarDetails: ExtendedAvatarDetails[];
}

interface ChapterImageDescription {
  scene: string;
  characters: {
    [name: string]: {
      position: string;
      expression: string;
      action: string;
      clothing: string;
    };
  };
  environment: {
    setting: string;
    lighting: string;
    atmosphere: string;
    objects: string[];
  };
  composition?: {
    foreground: string;
    background: string;
    focus: string;
  };
}

interface CoverImageDescription {
  mainScene: string;
  characters: {
    [name: string]: {
      position: string;
      expression: string;
      pose: string;
    };
  };
  environment: {
    setting: string;
    mood: string;
    colorPalette: string[];
  };
  composition?: {
    layout: string;
    titleSpace: string;
    visualFocus: string;
  };
}

interface AvatarDevelopment {
  avatarId: string;
  name: string;
  changedTraits: {
    [trait: string]: {
      before: number;
      after: number;
      reason: string;
    };
  };
  newSkills: string[];
  personalGrowth: string[];
  memoryAdditions: {
    experiences: string[];
    relationships: Record<string, string>;
  };
}

interface LearningOutcome {
  subject: string;
  newConcepts: string[];
  reinforcedSkills: string[];
  difficulty_mastered: string;
  practical_applications: string[];
}

interface GenerateStoryContentResponse {
  title: string;
  description: string;
  coverImageUrl: string;
  coverImageDescription: CoverImageDescription;
  chapters: (Omit<Chapter, "id"> & {
    imageDescription: ChapterImageDescription;
  })[];
  avatarDevelopments: AvatarDevelopment[];
  learningOutcomes: LearningOutcome[];
  metadata: {
    tokensUsed: {
      prompt: number;
      completion: number;
      reasoning: number;
      total: number;
    };
    model: string;
    processingTime: number;
    imagesGenerated: number;
    totalCost: {
      text: number;
      images: number;
      total: number;
    };
  };
}

// Vielfache-von-64 Hilfsfunktion für Runware
function normalizeRunwareDimensions(width: number, height: number): { width: number; height: number } {
  const roundToMultiple64 = (n: number) => Math.round(n / 64) * 64;
  const normalizedWidth = Math.max(128, Math.min(2048, roundToMultiple64(width)));
  const normalizedHeight = Math.max(128, Math.min(2048, roundToMultiple64(height)));
  return { width: normalizedWidth, height: normalizedHeight };
}

// Deterministischer Seed
function deterministicSeedFrom(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash >>> 0) * 0x01000193;
  }
  return Math.abs(hash >>> 0);
}

// Build a short canonical appearance string from a visual profile.
function canonicalFromVisualProfile(vp?: AvatarVisualProfile): string | null {
  if (!vp) return null;
  const parts: string[] = [];
  parts.push(`${vp.skin?.tone ?? ""} skin`.trim());
  if (vp.hair?.color && vp.hair?.type) parts.push(`${vp.hair.color} ${vp.hair.type} hair`);
  if (vp.hair?.length) parts.push(`${vp.hair.length} length`);
  if (vp.hair?.style) parts.push(vp.hair.style);
  if (vp.eyes?.color) parts.push(`${vp.eyes.color} eyes`);
  if (vp.face?.freckles) parts.push("freckles");
  if (vp.accessories && vp.accessories.length > 0) parts.push(...vp.accessories);
  return parts.filter(Boolean).join(", ");
}

// Konvertiere strukturierte Bildbeschreibung in natürlichen Prompt und injiziere Avatar-Kanon
function convertImageDescriptionToPrompt(
  description: ChapterImageDescription | CoverImageDescription,
  isChapter: boolean = true,
  avatarProfilesByName?: Record<string, AvatarVisualProfile>
): string {
  const canonicalAppendix: string[] = [];

  if (isChapter) {
    const chapterDesc = description as ChapterImageDescription;
    
    let prompt = `Professionelle Kinderbuch-Illustration: ${chapterDesc.scene}. `;

    // Charaktere beschreiben, inkl. kanonischer Merkmale
    const characterDescriptions = Object.entries(chapterDesc.characters ?? {})
      .map(([name, details]) => {
        const canon = canonicalFromVisualProfile(avatarProfilesByName?.[name]);
        const canonTokens = avatarProfilesByName?.[name]?.consistentDescriptors?.slice(0, 6)?.join(", ");
        if (canonTokens) {
          canonicalAppendix.push(`${name}: ${canonTokens}`);
        }
        return `${name} ist ${details.position}, zeigt ${details.expression}, ${details.action}, trägt ${details.clothing}${canon ? `, konsistente Merkmale: ${canon}` : ""}`;
      }).join(". ");
    
    prompt += `Charaktere: ${characterDescriptions}. `;
    
    // Umgebung
    prompt += `Umgebung: ${chapterDesc.environment?.setting} mit ${chapterDesc.environment?.lighting}. `;
    prompt += `Atmosphäre: ${chapterDesc.environment?.atmosphere}. `;
    if (chapterDesc.environment?.objects?.length > 0) {
      prompt += `Sichtbare Objekte: ${chapterDesc.environment.objects.join(", ")}. `;
    }
    
    // Komposition
    prompt += `Bildkomposition: Im Vordergrund ${chapterDesc.composition?.foreground}, `;
    prompt += `im Hintergrund ${chapterDesc.composition?.background}, `;
    prompt += `Fokus liegt auf ${chapterDesc.composition?.focus}. `;
    
    // Stil
    prompt += `Disney-Pixar-Stil, kindgerecht, hochwertige digitale Illustration, warme Farben, ausdrucksstarke Gesichter. `;

    // Kanonische Kurz-Tokens für absolute Konsistenz
    if (canonicalAppendix.length > 0) {
      prompt += `Kanonische Erscheinung beibehalten — Profile: ${canonicalAppendix.join(" | ")}. `;
    }

    // Anti-Drift
    prompt += `Wichtig: Gesichter nicht verzerren, Augenfarbe korrekt, Haarfarbe/-stil konsistent, Proportionen kindgerecht.`;

    return prompt;
  } else {
    const coverDesc = description as CoverImageDescription;
    
    let prompt = `Kinderbuch-Cover-Illustration: ${coverDesc.mainScene}. `;
    
    // Charaktere für Cover inkl. kanonischer Merkmale
    const characterDescriptions = Object.entries(coverDesc.characters ?? {})
      .map(([name, details]) => {
        const canon = canonicalFromVisualProfile(avatarProfilesByName?.[name]);
        const canonTokens = avatarProfilesByName?.[name]?.consistentDescriptors?.slice(0, 6)?.join(", ");
        if (canonTokens) {
          canonicalAppendix.push(`${name}: ${canonTokens}`);
        }
        return `${name} ist ${details.position} und zeigt ${details.expression}, in ${details.pose}${canon ? `, konsistente Merkmale: ${canon}` : ""}`;
      }).join(". ");
    
    prompt += `Charaktere: ${characterDescriptions}. `;
    
    // Cover-Umgebung
    prompt += `Umgebung: ${coverDesc.environment?.setting} mit ${coverDesc.environment?.mood} Stimmung. `;
    prompt += `Farbpalette: ${coverDesc.environment?.colorPalette?.join(", ")}. `;
    
    // Cover-Komposition
    prompt += `Layout: ${coverDesc.composition?.layout}, `;
    prompt += `Platz für Titel: ${coverDesc.composition?.titleSpace}, `;
    prompt += `visueller Fokus: ${coverDesc.composition?.visualFocus}. `;
    
    prompt += `Professionelles Kinderbuch-Cover, Disney-Pixar-Stil, ansprechend für Kinder und Eltern, hochwertige Illustration. `;

    if (canonicalAppendix.length > 0) {
      prompt += `Kanonische Erscheinung beibehalten — Profile: ${canonicalAppendix.join(" | ")}. `;
    }
    prompt += `Wichtig: Gesichter nicht verzerren, Augen-/Haarfarben korrekt, Proportionen kindgerecht.`;

    return prompt;
  }
}

export const generateStoryContent = api<GenerateStoryContentRequest, GenerateStoryContentResponse>(
  { expose: true, method: "POST", path: "/ai/generate-story" },
  async (req) => {
    const startTime = Date.now();
    const metadata: GenerateStoryContentResponse["metadata"] = {
      tokensUsed: { prompt: 0, completion: 0, reasoning: 0, total: 0 },
      model: MODEL,
      processingTime: 0,
      imagesGenerated: 0,
      totalCost: { text: 0, images: 0, total: 0 },
    };

    try {
      console.log("📚 Generiere Geschichte mit allen verfügbaren Parametern...");

      const storyResult = await generateEnhancedStoryWithOpenAI(req.config, req.avatarDetails);
      console.log("✅ Geschichte generiert:", storyResult.title);

      metadata.tokensUsed = storyResult.tokensUsed ?? { prompt: 0, completion: 0, reasoning: 0, total: 0 };
      
      const outputTokens = metadata.tokensUsed.completion + (metadata.tokensUsed.reasoning ?? 0);
      metadata.totalCost.text =
        (metadata.tokensUsed.prompt / 1_000_000) * INPUT_COST_PER_1M +
        (outputTokens / 1_000_000) * OUTPUT_COST_PER_1M;

      console.log("🖼️ Generiere Bilder basierend auf präzisen Beschreibungen...");

      const seedBase = deterministicSeedFrom(req.avatarDetails.map(a => a.id).join("|"));
      const coverDimensions = normalizeRunwareDimensions(600, 800);
      const chapterDimensions = normalizeRunwareDimensions(512, 512);

      // Build name->visualProfile map for consistency injection
      const avatarMap: Record<string, AvatarVisualProfile> = {};
      for (const a of req.avatarDetails) {
        if (a.visualProfile) avatarMap[a.name] = a.visualProfile;
      }
      
      // Cover-Bild generieren
      const coverPrompt = convertImageDescriptionToPrompt(storyResult.coverImageDescription, false, avatarMap);
      console.log("🎨 Cover-Prompt:", coverPrompt);
      
      const coverResponse = await ai.generateImage({
        prompt: coverPrompt,
        model: "runware:101@1",
        width: coverDimensions.width,
        height: coverDimensions.height,
        steps: 30,
        CFGScale: 8.0,
        seed: seedBase,
        outputFormat: "WEBP",
        negativePrompt: "realistische Fotografie, Live-Action, Erwachseneninhalte, gruselig, dunkel, Horror, unscharf, niedrige Qualität, verzerrte Gesichter, schlechte Anatomie, Text, Wasserzeichen"
      });

      // Kapitel-Bilder generieren
      const chapterResponses = [];
      for (let i = 0; i < storyResult.chapters.length; i++) {
        const chapter = storyResult.chapters[i];
        const chapterPrompt = convertImageDescriptionToPrompt(chapter.imageDescription, true, avatarMap);
        
        console.log(`🎨 Kapitel ${i + 1} Prompt:`, chapterPrompt);
        
        const chapterResponse = await ai.generateImage({
          prompt: chapterPrompt,
          model: "runware:101@1", 
          width: chapterDimensions.width,
          height: chapterDimensions.height,
          steps: 25,
          CFGScale: 8.0,
          seed: (seedBase + i * 101) >>> 0,
          outputFormat: "WEBP",
          negativePrompt: "realistische Fotografie, Live-Action, Erwachseneninhalte, gruselig, dunkel, Horror, unscharf, niedrige Qualität, verzerrte Gesichter, schlechte Anatomie, inkonsistentes Charakteraussehen, Text, Wasserzeichen"
        });
        
        chapterResponses.push(chapterResponse);
        
        // Kurze Pause zwischen Generierungen
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const chaptersWithImages = storyResult.chapters.map((chapter, index) => ({
        ...chapter,
        imageUrl: chapterResponses[index]?.imageUrl || ""
      }));

      metadata.imagesGenerated = 1 + chapterResponses.length;
      metadata.totalCost.images = metadata.imagesGenerated * 0.0008;
      metadata.totalCost.total = metadata.totalCost.text + metadata.totalCost.images;
      metadata.processingTime = Date.now() - startTime;

      return {
        title: storyResult.title,
        description: storyResult.description,
        coverImageUrl: coverResponse.imageUrl,
        coverImageDescription: storyResult.coverImageDescription,
        chapters: chaptersWithImages,
        avatarDevelopments: storyResult.avatarDevelopments,
        learningOutcomes: storyResult.learningOutcomes,
        metadata,
      };
    } catch (error) {
      console.error("❌ Fehler bei Story-Generierung:", error);
      metadata.processingTime = Date.now() - startTime;
      throw new Error(`Story-Generierung fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}. Bitte später erneut versuchen.`);
    }
  }
);

async function generateEnhancedStoryWithOpenAI(
  config: StoryConfig,
  avatars: ExtendedAvatarDetails[]
): Promise<{
  title: string;
  description: string;
  chapters: (Omit<Chapter, "id" | "imageUrl"> & { imageDescription: ChapterImageDescription })[];
  coverImageDescription: CoverImageDescription;
  avatarDevelopments: AvatarDevelopment[];
  learningOutcomes: LearningOutcome[];
  tokensUsed?: any;
}> {
  
  const chapterCount = config.length === "short" ? 3 : config.length === "medium" ? 5 : 8;

  // Detaillierte Avatar-Beschreibungen für Prompt inkl. visueller Kanon
  const avatarDescriptions = avatars.map(avatar => {
    const physical = avatar.physicalTraits || {};
    const personality = avatar.personalityTraits || {};
    const memory = avatar.memory || { experiences: [], learnedSkills: [], personalGrowth: [], relationships: {} };
    const level = avatar.currentLevel || { knowledge: 1, emotional: 1, social: 1, creativity: 1 };
    const vp = avatar.visualProfile;

    const canon = vp ? [
      `- Kanonische Erscheinung:`,
      `  - Haut: ${vp.skin?.tone}${vp.skin?.undertone ? ` (${vp.skin.undertone})` : ""}${vp.skin?.distinctiveFeatures && vp.skin.distinctiveFeatures.length ? `; Merkmale: ${vp.skin.distinctiveFeatures.join(", ")}` : ""}`,
      `  - Haare: ${vp.hair?.color} ${vp.hair?.type}, ${vp.hair?.length}, Stil: ${vp.hair?.style}`,
      `  - Augen: ${vp.eyes?.color}${vp.eyes?.shape ? `, Form: ${vp.eyes.shape}` : ""}${vp.eyes?.size ? `, Größe: ${vp.eyes.size}` : ""}`,
      `  - Gesicht: ${[
        vp.face?.shape ? `Form: ${vp.face.shape}` : "",
        vp.face?.nose ? `Nase: ${vp.face.nose}` : "",
        vp.face?.mouth ? `Mund: ${vp.face.mouth}` : "",
        vp.face?.eyebrows ? `Augenbrauen: ${vp.face.eyebrows}` : "",
        vp.face?.freckles ? "Sommersprossen: ja" : "",
        vp.face?.otherFeatures?.length ? `Weitere: ${vp.face.otherFeatures.join(", ")}` : "",
      ].filter(Boolean).join("; ")}`,
      `  - Accessoires: ${vp.accessories?.length ? vp.accessories.join(", ") : "keine"}`,
      `  - Prompt-Tokens: ${vp.consistentDescriptors?.slice(0, 8).join(", ") || "-"}`,
    ].join("\n") : `- Kanonische Erscheinung: (noch nicht festgelegt)`;

    return `
**${avatar.name}:**
- Basis-Info: ${physical.age || 8} Jahre alt, ${physical.height || 130} cm groß, ${physical.gender === "male" ? "Junge" : physical.gender === "female" ? "Mädchen" : "Kind"}.
- Aussehen (Basis): ${physical.hairColor || "braune"} Haare, ${physical.eyeColor || "braune"} Augen, ${physical.skinTone || "helle"} Haut.
- Besondere Merkmale: ${avatar.description || "keine"}.
- Persönlichkeit: ${Object.entries(personality).map(([trait, value]) => `${trait}: ${value}/10`).join(", ")}
- Bisherige Erfahrungen: ${memory.experiences.join(", ") || "Erste Geschichte"}
${canon}`;
  }).join("\n");

  const systemPrompt = `Du bist ein preisgekrönter Kinderbuchautor mit Sinn für Spannung, Humor und Herz.
Deine Aufgabe ist es, eine fesselnde, altersgerechte Geschichte zu erschaffen, die sich wie ein echtes Buch liest.
Halte dich strikt an die folgenden Regeln:
1.  **Spannungsbogen (HOOK):** Jedes Kapitel MUSS mit einem Cliffhanger, einer offenen Frage oder einer überraschenden Wendung enden, die neugierig auf das nächste Kapitel macht. Vermeide abgeschlossene, moralisierende Kapitelenden.
2.  **Show, Don't Tell:** Zeige Charakterentwicklung und Emotionen durch Handlungen, Dialoge und innere Gedanken, anstatt sie nur zu benennen. (FALSCH: "Sie lernte, mutig zu sein." RICHTIG: "Obwohl ihr Herz hämmerte, machte sie einen Schritt nach vorn.")
3.  **Avatar-Konsistenz:** Halte dich exakt an die visuellen Beschreibungen der Avatare (Haare, Augen, Haut, Accessoires, Größe, besondere Merkmale), die im User-Prompt unter "AVATARE" bereitgestellt werden. Diese Merkmale dürfen sich nicht ändern und müssen in den Bildbeschreibungen berücksichtigt werden.
4.  **Strukturierte Ausgabe:** Antworte ausschließlich mit einem gültigen JSON-Objekt, das dem im User-Prompt gezeigten Schema entspricht. Kein einleitender oder abschließender Text.`;

  const userPrompt = `Erstelle eine ${config.genre}-Geschichte in ${config.setting} für Kinder im Alter ${config.ageGroup}.

GESCHICHTE-PARAMETER:
- Genre: ${config.genre}
- Setting: ${config.setting}  
- Länge: ${config.length} (${chapterCount} Kapitel)
- Komplexität: ${config.complexity}
- Zielgruppe: ${config.ageGroup} Jahre

AVATARE (alle bisherigen Erfahrungen berücksichtigen, Erscheinung KONSTANT halten!):
${avatarDescriptions}

${config?.learningMode?.enabled ? `
LERNMODUS (subtil integrieren, KEINE Moral-Floskeln am Schluss!):
- Fächer: ${config.learningMode.subjects.join(", ")}
- Schwierigkeit: ${config.learningMode.difficulty}
- Lernziele: ${config.learningMode.learningObjectives.join(", ")}
- Bewertungsart: ${config.learningMode.assessmentType}` : ""}

WICHTIG:
- Jede Szene und Bildbeschreibung muss die kanonische AVATAR-ERSCHEINUNG (inkl. Größe, Statur, besondere Merkmale) beachten.
- Kapitel enden mit einem spannenden HOOK, nicht mit einem Lern-Fazit.
- Bildbeschreibungen enthalten für jeden Charakter konkrete Hinweise auf Haare, Augen, Haut, Accessoires (kurz), plus Kleidung der Szene.

ERWARTETE JSON-STRUKTUR:
{
  "title": "Spannender Titel der Geschichte",
  "description": "Packende Kurzbeschreibung (50-200 Zeichen)",
  "chapters": [
    {
      "title": "Kapitel-Titel",
      "content": "Lebhafter, detaillierter Kapitel-Inhalt (ca. 150-250 Wörter) mit Dialogen und Handlungen. Das Ende MUSS einen spannenden Hook für das nächste Kapitel enthalten.",
      "order": 0,
      "imageDescription": {
        "scene": "Präzise Szenen-Beschreibung",
        "characters": {
          "AvatarName": {
            "position": "genaue Position im Bild",
            "expression": "Gesichtsausdruck",
            "action": "was macht der Charakter",
            "clothing": "Kleidungsbeschreibung (nur für Szene, Erscheinung sonst kanonisch)"
          }
        },
        "environment": {
          "setting": "Ort der Handlung",
          "lighting": "Lichtstimmung",
          "atmosphere": "Atmosphäre",
          "objects": ["sichtbare", "Objekte", "im", "Bild"]
        },
        "composition": {
          "foreground": "Was ist vorne im Bild",
          "background": "Was ist hinten im Bild", 
          "focus": "Worauf liegt der Fokus"
        }
      }
    }
  ],
  "coverImageDescription": {
    "mainScene": "Hauptszene des Covers",
    "characters": {
      "AvatarName": {
        "position": "Position auf dem Cover",
        "expression": "Gesichtsausdruck",
        "pose": "Körperhaltung"
      }
    },
    "environment": {
      "setting": "Cover-Setting",
      "mood": "Stimmung",
      "colorPalette": ["Farbe1", "Farbe2", "Farbe3"]
    },
    "composition": {
      "layout": "Anordnung der Elemente",
      "titleSpace": "Wo ist Platz für den Titel",
      "visualFocus": "Visueller Schwerpunkt"
    }
  },
  "avatarDevelopments": [
    {
      "avatarId": "ID des Avatars",
      "name": "Name",
      "changedTraits": {
        "Eigenschaft": {
          "before": 5,
          "after": 7,
          "reason": "Grund für Veränderung"
        }
      },
      "newSkills": ["neue", "Fähigkeiten"],
      "personalGrowth": ["Persönlichkeits", "Entwicklungen"],
      "memoryAdditions": {
        "experiences": ["neue Erfahrungen"],
        "relationships": {"Name": "Beziehungsart"}
      }
    }
  ],
  "learningOutcomes": [
    {
      "subject": "Lernbereich",
      "newConcepts": ["neue", "Konzepte"],
      "reinforcedSkills": ["verstärkte", "Fähigkeiten"],
      "difficulty_mastered": "gemeisterte Schwierigkeit",
      "practical_applications": ["praktische", "Anwendungen"]
    }
  ]
}

Antworte NUR mit gültigem JSON. Keine zusätzlichen Erklärungen.`;

  const payload = {
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    max_completion_tokens: 12000,
    response_format: { type: "json_object" },
    reasoning_effort: "medium",
    verbosity: "high"
  };

  const promptId = `story-generation-prompt-v3`;
  const data = await callOpenAIWithCache(promptId, payload);

  const content = data.choices[0].message.content;

  if (!content) {
    throw new Error("Leere Antwort von OpenAI erhalten");
  }

  await logTopic.publish({
    source: 'openai-story-generation',
    timestamp: new Date(),
    request: payload,
    response: data,
  });

  let parsed;
  try {
    const cleanContent = content.replace(/```json\s*|\s*```/g, "").trim();
    parsed = JSON.parse(cleanContent);
  } catch (e) {
    console.error("JSON Parse Fehler:", e);
    console.error("Raw content:", content);
    throw new Error(`JSON Parse Fehler: ${e instanceof Error ? e.message : String(e)}`);
  }

  return {
    ...parsed,
    tokensUsed: {
      prompt: data.usage?.prompt_tokens ?? 0,
      completion: data.usage?.completion_tokens ?? 0,
      reasoning: data.usage?.reasoning_tokens ?? 0,
      total: data.usage?.total_tokens ?? 0,
    }
  };
}
