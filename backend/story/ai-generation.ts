import { api } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { generateImage } from "../ai/image-generation";
import type { StoryConfig, Chapter } from "./generate";

// ---- OpenAI Modell & Pricing (Modul-weit gültig) ----
// Du kannst auch "gpt-5" nehmen; hier standardmäßig "gpt-5-nano" für geringere Kosten/Latenz.
const MODEL = "gpt-5-nano";

// TODO: Auf aktuelle Preise aus der Preisliste setzen.
const INPUT_COST_PER_1M = 0.15;   // Platzhalter
const OUTPUT_COST_PER_1M = 0.60;  // Platzhalter

const openAIKey = secret("OpenAIKey");

interface GenerateStoryContentRequest {
  config: StoryConfig;
  avatarDetails: Array<{
    id: string;
    name: string;
    physicalTraits: any;
    personalityTraits: any;
  }>;
}

interface GenerateStoryContentResponse {
  title: string;
  description: string;
  coverImageUrl: string;
  chapters: Omit<Chapter, "id">[];
  metadata: {
    tokensUsed: {
      prompt: number;
      completion: number;
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

export const generateStoryContent = api<GenerateStoryContentRequest, GenerateStoryContentResponse>(
  { expose: true, method: "POST", path: "/ai/generate-story" },
  async (req) => {
    const startTime = Date.now();
    const metadata: GenerateStoryContentResponse["metadata"] = {
      tokensUsed: { prompt: 0, completion: 0, total: 0 },
      model: MODEL,
      processingTime: 0,
      imagesGenerated: 0,
      totalCost: { text: 0, images: 0, total: 0 },
    };

    try {
      console.log("📚 Generating story with config:", JSON.stringify(req.config, null, 2));

      const storyContent = await generateStoryWithOpenAI(req.config, req.avatarDetails);
      console.log("✅ Generated story content:", storyContent.title);

      metadata.tokensUsed = storyContent.tokensUsed ?? { prompt: 0, completion: 0, total: 0 };
      metadata.totalCost.text =
        (metadata.tokensUsed.prompt / 1_000_000) * INPUT_COST_PER_1M +
        (metadata.tokensUsed.completion / 1_000_000) * OUTPUT_COST_PER_1M;

      // Cover
      const coverDimensions = normalizeRunwareDimensions(600, 800);
      const coverPrompt =
        `Children's book cover illustration for "${storyContent.title}", ` +
        `${req.config.genre} adventure, ${req.config.setting} setting, ` +
        `Disney Pixar 3D animation style, colorful, magical, child-friendly, high quality`;
      const coverImage = await generateImage({
        prompt: coverPrompt,
        width: coverDimensions.width,
        height: coverDimensions.height,
        steps: 25,
      });
      metadata.imagesGenerated++;

      // Kapitelbilder
      const chapterDimensions = normalizeRunwareDimensions(400, 300);
      const chaptersWithImages = await Promise.all(
        storyContent.chapters.map(async (chapter, index) => {
          const chapterPrompt =
            `Children's book illustration for chapter "${chapter.title}", ` +
            `${req.config.genre} story scene, ${req.config.setting} background, ` +
            `Disney Pixar 3D animation style, colorful, magical, child-friendly, safe for children`;
          const chapterImage = await generateImage({
            prompt: chapterPrompt,
            width: chapterDimensions.width,
            height: chapterDimensions.height,
            steps: 20,
          });
          metadata.imagesGenerated++;
          return { ...chapter, imageUrl: chapterImage.imageUrl };
        })
      );

      // (Platzhalter) Bildkosten
      const imageCostPer1 = 0.0006;
      metadata.totalCost.images = metadata.imagesGenerated * imageCostPer1;
      metadata.totalCost.total = metadata.totalCost.text + metadata.totalCost.images;

      metadata.processingTime = Date.now() - startTime;

      console.log("💰 Generation costs:", metadata.totalCost);
      console.log("📊 Tokens used:", metadata.tokensUsed);
      console.log("⏱️ Processing time:", metadata.processingTime, "ms");

      return {
        title: storyContent.title,
        description: storyContent.description,
        coverImageUrl: coverImage.imageUrl,
        chapters: chaptersWithImages,
        metadata,
      };
    } catch (error) {
      console.error("❌ Error in story generation:", error);
      metadata.processingTime = Date.now() - startTime;

      const fallbackResult = await generateFallbackStoryWithImages(req.config, req.avatarDetails);
      return { ...fallbackResult, metadata };
    }
  }
);

// -------- GPT-5-nano korrigierte LÖSUNG mit allen richtigen Parametern --------
async function generateStoryWithOpenAI(
  config: StoryConfig,
  avatars: Array<{ name: string; physicalTraits: any; personalityTraits: any }>
): Promise<{ title: string; description: string; chapters: Omit<Chapter, "id" | "imageUrl">[]; tokensUsed?: any }> {
  
  const avatarDescriptions = avatars
    .map((avatar) => `${avatar.name}: ${getAvatarDescription(avatar.physicalTraits, avatar.personalityTraits)}`)
    .join("\n");

  const chapterCount = config.length === "short" ? 3 : config.length === "medium" ? 5 : 8;

  const systemPrompt = "Du bist ein professioneller Kinderbuchautor. Erstelle Geschichten im JSON-Format basierend auf den gegebenen Parametern.";
  
  const userPrompt = `Erstelle eine ${config.genre} Geschichte in ${config.setting} für die Altersgruppe ${config.ageGroup}.

Parameter:
- Länge: ${config.length} (${chapterCount} Kapitel)
- Komplexität: ${config.complexity}
- Charaktere:
${avatarDescriptions}

${config?.learningMode?.enabled ? 
`Lernziele:
- Fächer: ${config.learningMode.subjects.join(", ")}
- Schwierigkeit: ${config.learningMode.difficulty}
- Lernziele: ${config.learningMode.learningObjectives.join(", ")}` : ""}

Antworte NUR mit einem gültigen JSON-Objekt in folgendem Format:
{
  "title": "Titel der Geschichte",
  "description": "Kurze Beschreibung der Geschichte (20-500 Zeichen)",
  "chapters": [
    {
      "title": "Kapitel Titel",
      "content": "Kapitel Inhalt (150-1200 Zeichen)",
      "order": 0
    }
  ]
}`;

  // Stufe 1: Chat Completions mit JSON Schema (beste Option für GPT-5)
  try {
    console.log("🚀 Versuch 1: Chat Completions mit JSON Schema (GPT-5 korrigiert)");
    return await tryWithJsonSchema(systemPrompt, userPrompt, chapterCount);
  } catch (error) {
    console.warn("⚠️ JSON Schema fehlgeschlagen:", error);
  }

  // Stufe 2: Chat Completions mit json_object
  try {
    console.log("🚀 Versuch 2: Chat Completions mit json_object (GPT-5 korrigiert)");
    return await tryWithJsonObject(systemPrompt, userPrompt);
  } catch (error) {
    console.warn("⚠️ JSON Object fehlgeschlagen:", error);
  }

  // Stufe 3: Chat Completions ohne response_format (manuelles Parsing)
  try {
    console.log("🚀 Versuch 3: Chat Completions ohne response_format (GPT-5 korrigiert)");
    return await tryWithManualParsing(systemPrompt, userPrompt);
  } catch (error) {
    console.warn("⚠️ Manuelles Parsing fehlgeschlagen:", error);
  }

  // Stufe 4: Fallback auf lokale Story-Generierung
  console.warn("⚠️ Alle OpenAI-Versuche fehlgeschlagen, verwende Fallback");
  throw new Error("Alle OpenAI-Methoden fehlgeschlagen - Fallback wird verwendet");
}

async function tryWithJsonSchema(systemPrompt: string, userPrompt: string, chapterCount: number) {
  const responseFormat = {
    type: "json_schema" as const,
    json_schema: {
      name: "story_response",
      strict: true,
      schema: {
        type: "object",
        properties: {
          title: { type: "string", minLength: 3, maxLength: 120 },
          description: { type: "string", minLength: 20, maxLength: 500 },
          chapters: {
            type: "array",
            minItems: chapterCount,
            maxItems: chapterCount,
            items: {
              type: "object",
              properties: {
                title: { type: "string", minLength: 3, maxLength: 120 },
                content: { type: "string", minLength: 150, maxLength: 1200 },
                order: { type: "integer", minimum: 0 }
              },
              required: ["title", "content", "order"],
              additionalProperties: false
            }
          }
        },
        required: ["title", "description", "chapters"],
        additionalProperties: false
      }
    }
  };

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
      // GEFIXT: max_completion_tokens statt max_tokens für GPT-5
      max_completion_tokens: 2400,
      temperature: 0.7,
      response_format: responseFormat,
      // GPT-5 spezifische Parameter
      reasoning_effort: "minimal", // Für Kostenoptimierung bei Story-Generierung
      verbosity: "medium"
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`JSON Schema API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  const parsed = JSON.parse(content);

  return {
    ...parsed,
    tokensUsed: {
      // GEFIXT: GPT-5 Token-Struktur berücksichtigen
      prompt: data.usage?.prompt_tokens ?? 0,
      completion: data.usage?.completion_tokens ?? 0,
      reasoning: data.usage?.reasoning_tokens ?? 0, // Neue reasoning tokens
      total: data.usage?.total_tokens ?? 0,
    }
  };
}

async function tryWithJsonObject(systemPrompt: string, userPrompt: string) {
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
        { role: "user", content: userPrompt + "\n\nWichtig: Antworte ausschließlich mit gültigem JSON, keine Erklärungen!" }
      ],
      // GEFIXT: max_completion_tokens statt max_tokens für GPT-5
      max_completion_tokens: 2400,
      temperature: 0.7,
      response_format: { type: "json_object" },
      // GPT-5 spezifische Parameter
      reasoning_effort: "minimal", // Schnelle Antwort für Fallback
      verbosity: "low" // Kompakte Ausgabe
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`JSON Object API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  const cleanContent = content.replace(/```json\s*|\s*```/g, "").trim();
  const parsed = JSON.parse(cleanContent);

  return {
    ...parsed,
    tokensUsed: {
      // GEFIXT: GPT-5 Token-Struktur
      prompt: data.usage?.prompt_tokens ?? 0,
      completion: data.usage?.completion_tokens ?? 0,
      reasoning: data.usage?.reasoning_tokens ?? 0,
      total: data.usage?.total_tokens ?? 0,
    }
  };
}

async function tryWithManualParsing(systemPrompt: string, userPrompt: string) {
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
        { 
          role: "user", 
          content: userPrompt + `

WICHTIG: 
- Antworte NUR mit gültigem JSON
- Keine zusätzlichen Texte, Erklärungen oder Markdown
- Das JSON muss direkt parsbar sein
- Beginne direkt mit { und ende mit }`
        }
      ],
      // GEFIXT: max_completion_tokens statt max_tokens für GPT-5
      max_completion_tokens: 2400,
      temperature: 0.7,
      // GPT-5 spezifische Parameter für letzten Versuch
      reasoning_effort: "low", // Etwas mehr reasoning für bessere JSON-Struktur
      verbosity: "low"
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Manual parsing API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  let content = data.choices[0].message.content;

  // Aggressive Bereinigung
  content = content
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .replace(/^[^{]*/, "")  // Alles vor der ersten {
    .replace(/[^}]*$/, "") // Alles nach der letzten }
    .trim();

  // Versuche JSON zu parsen
  const parsed = JSON.parse(content);

  // Validierung der Struktur
  if (!parsed.title || !parsed.description || !parsed.chapters) {
    throw new Error("Unvollständige Story-Struktur");
  }

  return {
    ...parsed,
    tokensUsed: {
      // GEFIXT: GPT-5 Token-Struktur
      prompt: data.usage?.prompt_tokens ?? 0,
      completion: data.usage?.completion_tokens ?? 0,
      reasoning: data.usage?.reasoning_tokens ?? 0,
      total: data.usage?.total_tokens ?? 0,
    }
  };
}

// -------- Fallback-Story inkl. Platzhalterbilder --------
async function generateFallbackStoryWithImages(
  config: StoryConfig,
  avatars: Array<{ name: string; physicalTraits: any; personalityTraits: any }>
): Promise<{ title: string; description: string; coverImageUrl: string; chapters: Omit<Chapter, "id">[] }> {
  const chapterCount = config.length === "short" ? 3 : config.length === "medium" ? 5 : 8;
  const fallbackStory = generateFallbackStory(config, avatars, chapterCount);

  const coverDimensions = normalizeRunwareDimensions(600, 800);
  const coverImage = await generateImage({
    prompt: `Children's book cover, ${config.genre} story, colorful, magical`,
    width: coverDimensions.width,
    height: coverDimensions.height,
  });

  const chapterDimensions = normalizeRunwareDimensions(400, 300);
  const chaptersWithImages = await Promise.all(
    fallbackStory.chapters.map(async (chapter, index) => {
      const chapterImage = await generateImage({
        prompt: `Children's book illustration, chapter ${index + 1}, ${config.genre} story`,
        width: chapterDimensions.width,
        height: chapterDimensions.height,
      });
      return { ...chapter, imageUrl: chapterImage.imageUrl };
    })
  );

  return {
    title: fallbackStory.title,
    description: fallbackStory.description,
    coverImageUrl: coverImage.imageUrl,
    chapters: chaptersWithImages,
  };
}

// -------- Helper --------
function getAvatarDescription(physical: any, personality: any): string {
  const age = physical?.age ?? "?";
  const gender =
    physical?.gender === "male" ? "Junge" : physical?.gender === "female" ? "Mädchen" : "Kind";
  const topTraits = Object.entries(personality ?? {})
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 2)
    .map(([trait]) => {
      switch (trait) {
        case "courage": return "mutig";
        case "intelligence": return "klug";
        case "creativity": return "kreativ";
        case "empathy": return "einfühlsam";
        case "strength": return "stark";
        case "humor": return "lustig";
        case "adventure": return "abenteuerlustig";
        case "patience": return "geduldig";
        case "curiosity": return "neugierig";
        case "leadership": return "führungsstark";
        default: return trait;
      }
    })
    .join(" und ");
  return `${age} Jahre alter ${gender}, besonders ${topTraits}`;
}

function generateFallbackStory(
  config: StoryConfig,
  avatars: Array<{ name: string; physicalTraits: any; personalityTraits: any }>,
  chapterCount: number
): { title: string; description: string; chapters: Omit<Chapter, "id" | "imageUrl">[] } {
  const genreMap: Record<string, string> = {
    adventure: "Abenteuer",
    fantasy: "Fantasy-Abenteuer",
    mystery: "Geheimnis",
    friendship: "Freundschaftsgeschichte",
    learning: "Lerngeschichte",
  };

  const firstName = avatars?.[0]?.name ?? "unserem Helden";
  const title = `Das große ${genreMap[config.genre] || "Abenteuer"} von ${firstName}`;
  const description = `Eine spannende Geschichte über ${avatars.length} Freund${avatars.length === 1 ? "" : "e"}, die ein aufregendes Abenteuer in ${config.setting} erleben und dabei wichtige Lektionen über Freundschaft und Mut lernen.`;

  const chapters = Array.from({ length: chapterCount }, (_, i) => ({
    title: `Kapitel ${i + 1}: ${getChapterTitle(i)}`,
    content: generateChapterContent(i, config, avatars),
    order: i,
  }));

  return { title, description, chapters };
}

function getChapterTitle(index: number): string {
  const titles = [
    "Der Beginn des Abenteuers",
    "Erste Herausforderungen",
    "Unerwartete Wendungen",
    "Zusammenhalt und Mut",
    "Die große Prüfung",
    "Freundschaft siegt",
    "Das große Finale",
    "Ein neuer Anfang",
  ];
  return titles[index] || `Kapitel ${index + 1}`;
}

function generateChapterContent(
  index: number,
  config: StoryConfig,
  avatars: Array<{ name: string; physicalTraits: any; personalityTraits: any }>
): string {
  const names = avatars.map((a) => a.name).join(", ");

  const baseContent = `In diesem aufregenden Kapitel erleben ${names} spannende Abenteuer in ${config.setting}. 

Die Freunde müssen zusammenarbeiten und ihre besonderen Fähigkeiten einsetzen, um die Herausforderungen zu meistern. Jeder von ihnen bringt seine eigenen Stärken mit ein, und gemeinsam sind sie unschlagbar.

Während sie ihr Abenteuer fortsetzen, lernen sie wichtige Lektionen über Freundschaft, Mut und Zusammenhalt. Die Welt um sie herum ist voller Wunder und Überraschungen, die darauf warten, entdeckt zu werden.${
    config?.learningMode?.enabled
      ? `

In diesem Kapitel lernen wir auch etwas Wichtiges: ${config.learningMode.learningObjectives.join(", ")}.`
      : ""
  }

Mit Mut, Freundschaft und einem Lächeln können unsere Helden jede Herausforderung meistern!`;

  return baseContent;
}
