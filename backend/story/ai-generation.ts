import { api } from "encore.dev/api";
import { secret } from "encore.dev/config";
import type { StoryConfig, Chapter } from "./generate";
import { ai } from "~encore/clients";

// ---- OpenAI Modell & Pricing (GPT-5-nano) ----
const MODEL = "gpt-5-nano";
const INPUT_COST_PER_1M = 0.05;
const OUTPUT_COST_PER_1M = 0.40;

const openAIKey = secret("OpenAIKey");

interface ExtendedAvatarDetails {
  id: string;
  name: string;
  physicalTraits: any;
  personalityTraits: any;
  imageUrl?: string | null;
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
  composition: {
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
  composition: {
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

// Konvertiere strukturierte Bildbeschreibung in natürlichen deutschen Prompt
function convertImageDescriptionToPrompt(description: ChapterImageDescription | CoverImageDescription, isChapter: boolean = true): string {
  if (isChapter) {
    const chapterDesc = description as ChapterImageDescription;
    
    let prompt = `Professionelle Kinderbuch-Illustration: ${chapterDesc.scene}. `;
    
    // Charaktere beschreiben
    const characterDescriptions = Object.entries(chapterDesc.characters)
      .map(([name, details]) => 
        `${name} ist ${details.position}, zeigt ${details.expression}, ${details.action}, trägt ${details.clothing}`
      ).join('. ');
    
    prompt += `Charaktere: ${characterDescriptions}. `;
    
    // Umgebung
    prompt += `Umgebung: ${chapterDesc.environment.setting} mit ${chapterDesc.environment.lighting}. `;
    prompt += `Atmosphäre: ${chapterDesc.environment.atmosphere}. `;
    if (chapterDesc.environment.objects.length > 0) {
      prompt += `Sichtbare Objekte: ${chapterDesc.environment.objects.join(', ')}. `;
    }
    
    // Komposition
    prompt += `Bildkomposition: Im Vordergrund ${chapterDesc.composition.foreground}, `;
    prompt += `im Hintergrund ${chapterDesc.composition.background}, `;
    prompt += `Fokus liegt auf ${chapterDesc.composition.focus}. `;
    
    prompt += `Disney-Pixar-Stil, kindgerecht, hochwertige digitale Illustration, warme Farben, ausdrucksstarke Gesichter.`;
    
    return prompt;
  } else {
    const coverDesc = description as CoverImageDescription;
    
    let prompt = `Kinderbuch-Cover-Illustration: ${coverDesc.mainScene}. `;
    
    // Charaktere für Cover
    const characterDescriptions = Object.entries(coverDesc.characters)
      .map(([name, details]) => 
        `${name} ist ${details.position} und zeigt ${details.expression}, in ${details.pose}`
      ).join('. ');
    
    prompt += `Charaktere: ${characterDescriptions}. `;
    
    // Cover-Umgebung
    prompt += `Umgebung: ${coverDesc.environment.setting} mit ${coverDesc.environment.mood} Stimmung. `;
    prompt += `Farbpalette: ${coverDesc.environment.colorPalette.join(', ')}. `;
    
    // Cover-Komposition
    prompt += `Layout: ${coverDesc.composition.layout}, `;
    prompt += `Platz für Titel: ${coverDesc.composition.titleSpace}, `;
    prompt += `visueller Fokus: ${coverDesc.composition.visualFocus}. `;
    
    prompt += `Professionelles Kinderbuch-Cover, Disney-Pixar-Stil, ansprechend für Kinder und Eltern, hochwertige Illustration.`;
    
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
      
      const outputTokens = metadata.tokensUsed.completion + metadata.tokensUsed.reasoning;
      metadata.totalCost.text =
        (metadata.tokensUsed.prompt / 1_000_000) * INPUT_COST_PER_1M +
        (outputTokens / 1_000_000) * OUTPUT_COST_PER_1M;

      console.log("🖼️ Generiere Bilder basierend auf präzisen Beschreibungen...");

      const seedBase = deterministicSeedFrom(req.avatarDetails.map(a => a.id).join("|"));
      const coverDimensions = normalizeRunwareDimensions(600, 800);
      const chapterDimensions = normalizeRunwareDimensions(512, 512);
      
      // Cover-Bild generieren
      const coverPrompt = convertImageDescriptionToPrompt(storyResult.coverImageDescription, false);
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
        const chapterPrompt = convertImageDescriptionToPrompt(chapter.imageDescription, true);
        
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

  // Detaillierte Avatar-Beschreibungen für Prompt
  const avatarDescriptions = avatars.map(avatar => {
    const physical = avatar.physicalTraits || {};
    const personality = avatar.personalityTraits || {};
    const memory = avatar.memory || { experiences: [], learnedSkills: [], personalGrowth: [], relationships: {} };
    const level = avatar.currentLevel || { knowledge: 1, emotional: 1, social: 1, creativity: 1 };
    
    return `
**${avatar.name}:**
- Aussehen: ${physical.age || 8} Jahre, ${physical.gender === "male" ? "Junge" : "Mädchen"}, ${physical.hairColor || "braune"} Haare, ${physical.eyeColor || "braune"} Augen, ${physical.skinTone || "helle"} Haut
- Persönlichkeit: ${Object.entries(personality).map(([trait, value]) => `${trait}: ${value}/10`).join(", ")}
- Bisherige Erfahrungen: ${memory.experiences.join(", ") || "Erste Geschichte"}
- Gelernte Fähigkeiten: ${memory.learnedSkills.join(", ") || "Keine besonderen"}
- Persönliche Entwicklung: ${memory.personalGrowth.join(", ") || "Am Anfang der Entwicklung"}
- Beziehungen: ${Object.entries(memory.relationships).map(([name, rel]) => `${name}: ${rel}`).join(", ") || "Neue Freundschaften"}
- Aktuelles Level: Wissen ${level.knowledge}, Emotional ${level.emotional}, Sozial ${level.social}, Kreativität ${level.creativity}`;
  }).join("\n");

  const systemPrompt = `Du bist ein Experte für Kinderliteratur und Charakterentwicklung. Du erstellst hochwertige Geschichten die:

1. **CHARAKTERENTWICKLUNG**: Jeder Avatar entwickelt sich realistisch basierend auf seinen bisherigen Erfahrungen
2. **LERNZIELE**: Subtile aber effektive Integration der gewünschten Lernziele
3. **PRÄZISE BILDBESCHREIBUNGEN**: Jede Szene wird detailliert für die Bildgenerierung beschrieben
4. **EMOTIONALE TIEFE**: Kinder können sich mit den Charakteren identifizieren
5. **PÄDAGOGISCHEN WERT**: Vermittlung wichtiger Werte und Fähigkeiten

Du gibst strukturierte JSON-Antworten zurück mit allen erforderlichen Feldern.`;

  const userPrompt = `Erstelle eine ${config.genre}-Geschichte in ${config.setting} für Kinder im Alter ${config.ageGroup}.

**GESCHICHTE-PARAMETER:**
- Genre: ${config.genre}
- Setting: ${config.setting}  
- Länge: ${config.length} (${chapterCount} Kapitel)
- Komplexität: ${config.complexity}
- Zielgruppe: ${config.ageGroup} Jahre

**AVATARE (alle bisherigen Erfahrungen berücksichtigen):**
${avatarDescriptions}

${config?.learningMode?.enabled ? `
**LERNZIELE (subtil integrieren):**
- Fächer: ${config.learningMode.subjects.join(", ")}
- Schwierigkeit: ${config.learningMode.difficulty}
- Lernziele: ${config.learningMode.learningObjectives.join(", ")}` : ""}

**ERWARTETE JSON-STRUKTUR:**
{
  "title": "Spannender Titel der Geschichte",
  "description": "Packende Kurzbeschreibung (50-200 Zeichen)",
  "chapters": [
    {
      "title": "Kapitel-Titel",
      "content": "Detaillierter Kapitel-Inhalt mit Charakterentwicklung (400-1000 Zeichen)",
      "order": 0,
      "imageDescription": {
        "scene": "Präzise Szenen-Beschreibung",
        "characters": {
          "Charaktername": {
            "position": "genaue Position im Bild",
            "expression": "Gesichtsausdruck",
            "action": "was macht der Charakter",
            "clothing": "Kleidungsbeschreibung"
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
      "Charaktername": {
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

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAIKey()}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_completion_tokens: 12000,
      response_format: { type: "json_object" },
      reasoning_effort: "medium",
      verbosity: "high"
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API Fehler: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;

  if (!content) {
    throw new Error("Leere Antwort von OpenAI erhalten");
  }

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