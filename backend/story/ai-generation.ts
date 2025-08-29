import { api } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { generateImage } from "../ai/image-generation";
import type { StoryConfig, Chapter } from "./generate";

// ---- OpenAI Modell, Tier & Pricing (Standard-Tier) ----
const MODEL = "gpt-5-nano";
const SERVICE_TIER: "standard" | "flex" = "standard";
const INPUT_COST_PER_1M = 0.05;   // $/1M Input-Token (Standard)
const OUTPUT_COST_PER_1M = 0.40;  // $/1M Output-Token (Standard)

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

// Vielfache-von-64 für Runware
function normalizeRunwareDimensions(
  width: number,
  height: number
): { width: number; height: number } {
  const round64 = (n: number) => Math.round(n / 64) * 64;
  return {
    width: Math.max(128, Math.min(2048, round64(width))),
    height: Math.max(128, Math.min(2048, round64(height))),
  };
}

export const generateStoryContent = api<
  GenerateStoryContentRequest,
  GenerateStoryContentResponse
>(
  { expose: true, method: "POST", path: "/ai/generate-story" },
  async (req) => {
    const startTime = Date.now();
    let metadata = {
      tokensUsed: { prompt: 0, completion: 0, total: 0 },
      model: MODEL,
      processingTime: 0,
      imagesGenerated: 0,
      totalCost: { text: 0, images: 0, total: 0 },
    };

    try {
      console.log("📚 Generating story with config:", JSON.stringify(req.config, null, 2));

      // 1) Story vom LLM holen
      const storyContent = await generateStoryWithOpenAI(req.config, req.avatarDetails);
      console.log("✅ Generated story content:", storyContent.title);

      // 2) Textkosten
      metadata.tokensUsed = storyContent.tokensUsed ?? { prompt: 0, completion: 0, total: 0 };
      metadata.totalCost.text =
        (metadata.tokensUsed.prompt / 1_000_000) * INPUT_COST_PER_1M +
        (metadata.tokensUsed.completion / 1_000_000) * OUTPUT_COST_PER_1M;

      // 3) Cover-Bild (600x800 → 576x832)
      const coverDimensions = normalizeRunwareDimensions(600, 800); // ✅ 576x832
      const coverPrompt = `Children's book cover illustration for "${storyContent.title}", ${req.config.genre} adventure story, ${req.config.setting} setting, Disney Pixar 3D animation style, colorful, magical, child-friendly, high quality`;
      const coverImage = await generateImage({
        prompt: coverPrompt,
        width: coverDimensions.width,
        height: coverDimensions.height,
        steps: 25,
      });
      console.log(`🖼️ Generated cover image (${coverDimensions.width}x${coverDimensions.height})`);
      metadata.imagesGenerated++;

      // 4) Kapitel-Bilder (400x300 → 384x320)
      const chapterDimensions = normalizeRunwareDimensions(400, 300); // ✅ 384x320
      const chaptersWithImages = await Promise.all(
        storyContent.chapters.map(async (chapter, index) => {
          const chapterPrompt = `Children's book illustration for chapter "${chapter.title}", ${req.config.genre} story scene, ${req.config.setting} background, Disney Pixar 3D animation style, colorful, magical, child-friendly, safe for children`;
          const chapterImage = await generateImage({
            prompt: chapterPrompt,
            width: chapterDimensions.width,
            height: chapterDimensions.height,
            steps: 20,
          });

          console.log(
            `🖼️ Generated image for chapter ${index + 1} (${chapterDimensions.width}x${chapterDimensions.height})`
          );
          metadata.imagesGenerated++;

          return {
            ...chapter,
            imageUrl: chapterImage.imageUrl,
          };
        })
      );

      // 5) Bildkosten (Runware-Schätzung)
      const IMAGE_COST = 0.0006; // $ pro Bild
      metadata.totalCost.images = metadata.imagesGenerated * IMAGE_COST;
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

      // Fallback-Story inkl. Platzhalterbilder
      metadata.processingTime = Date.now() - startTime;
      const fallbackResult = await generateFallbackStoryWithImages(req.config, req.avatarDetails);
      return { ...fallbackResult, metadata };
    }
  }
);

// -------------------- LLM-Aufruf (Responses API) --------------------

async function generateStoryWithOpenAI(
  config: StoryConfig,
  avatars: Array<{ name: string; physicalTraits: any; personalityTraits: any }>
): Promise<{
  title: string;
  description: string;
  chapters: Omit<Chapter, "id" | "imageUrl">[];
  tokensUsed?: any;
}> {
  try {
    const avatarDescriptions = avatars
      .map((a) => `${a.name}: ${getAvatarDescription(a.physicalTraits, a.personalityTraits)}`)
      .join("\n");

    const chapterCount = config.length === "short" ? 3 : config.length === "medium" ? 5 : 8;

    const systemPrompt =
      "Du bist ein professioneller Kinderbuchautor. Erstelle fesselnde, altersgerechte Geschichten, die sowohl lehrreich als auch unterhaltsam sind. Schreibe immer auf Deutsch und verwende eine kindgerechte, warme Sprache. Antworte ausschließlich als JSON (ohne Markdown).";

    const userPrompt = `Erstelle eine ${config.genre} Geschichte in ${config.setting} für die Altersgruppe ${config.ageGroup}.

Geschichte Parameter:
- Länge: ${config.length} (${chapterCount} Kapitel)
- Komplexität: ${config.complexity}
- Charaktere: ${avatarDescriptions}
${
  config.learningMode?.enabled
    ? `
Lernziele:
- Fächer: ${(config.learningMode?.subjects ?? []).join(", ")}
- Schwierigkeit: ${config.learningMode?.difficulty ?? "beginner"}
- Lernziele: ${(config.learningMode?.learningObjectives ?? []).join(", ")}
`
    : ""
}

Bitte erstelle:
1. Einen fesselnden Titel
2. Eine kurze Beschreibung (2-3 Sätze)
3. ${chapterCount} Kapitel, jedes mit:
   - Kapiteltitel
   - Kapitelinhalt (200-300 Wörter je nach Altersgruppe)

Formatiere als JSON:
{
  "title": "Geschichte Titel",
  "description": "Geschichte Beschreibung",
  "chapters": [
    { "title": "Kapitel 1 Titel", "content": "Kapitelinhalt...", "order": 0 }
  ]
}`;

    console.log("🤖 Sending request to OpenAI (Responses API)...");
    console.log(`🧪 Using MODEL: ${MODEL} | TIER: ${SERVICE_TIER}`);

    // JSON Schema für Strict-Output
    const storySchema = {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        chapters: {
          type: "array",
          minItems: chapterCount,
          maxItems: chapterCount,
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              content: { type: "string" },
              order: { type: "integer" },
            },
            required: ["title", "content", "order"],
            additionalProperties: false,
          },
        },
      },
      required: ["title", "description", "chapters"],
      additionalProperties: false,
    };

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAIKey()}`,
      },
      body: JSON.stringify({
        model: MODEL,
        // System als separate Message (kompatibel & klar)
        input: [
          {
            role: "system",
            content: [{ type: "text", text: systemPrompt }],
          },
          {
            role: "user",
            content: [{ type: "input_text", text: userPrompt }],
          },
        ],
        // <- WICHTIG: text.format IST EIN OBJEKT (kein String)
        text: {
          format: {
            type: "json_schema",
            name: "story_content",
            schema: storySchema,
            strict: true,
          },
        },
        max_output_tokens: 1500,
        temperature: 0.8,
        service_tier: SERVICE_TIER,
      }),
    });

    if (!response || !response.ok) {
      const errorText = response ? await response.text() : "Request failed";
      console.error("❌ OpenAI API error:", response?.status, errorText);
      throw new Error(`OpenAI API error: ${response?.status || "No response"} ${response?.statusText || errorText}`);
    }

    const data = await response.json();
    console.log("✅ OpenAI response received");
    console.log("📊 Usage:", data?.usage);

    // Robust extrahieren
    const text: string =
      (typeof data.output_text === "string" && data.output_text.trim())
        ? data.output_text
        : (Array.isArray(data.output)
            ? data.output
                .flatMap((o: any) => o?.content ?? [])
                .map((c: any) => (c?.text ?? "").toString())
                .join("")
            : "");

    const parsedContent = JSON.parse(text);

    const tokensUsed = {
      prompt: data?.usage?.input_tokens ?? 0,
      completion: data?.usage?.output_tokens ?? 0,
      total: (data?.usage?.input_tokens ?? 0) + (data?.usage?.output_tokens ?? 0),
    };

    console.log("✅ Successfully parsed OpenAI response");
    return { ...parsedContent, tokensUsed };
  } catch (error) {
    console.error("❌ OpenAI generation failed, using fallback");
    throw error;
  }
}

// -------------------- Fallback --------------------

async function generateFallbackStoryWithImages(
  config: StoryConfig,
  avatars: Array<{ name: string; physicalTraits: any; personalityTraits: any }>
): Promise<{ title: string; description: string; coverImageUrl: string; chapters: Omit<Chapter, "id">[] }> {
  const chapterCount = config.length === "short" ? 3 : config.length === "medium" ? 5 : 8;
  const fallbackStory = generateFallbackStory(config, avatars, chapterCount);

  const coverDimensions = normalizeRunwareDimensions(600, 800); // 600x800 -> 576x832
  const coverImage = await generateImage({
    prompt: `Children's book cover, ${config.genre} story, colorful, magical`,
    width: coverDimensions.width,
    height: coverDimensions.height,
  });

  const chapterDimensions = normalizeRunwareDimensions(400, 300); // 400x300 -> 384x320
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

// -------------------- Hilfsfunktionen --------------------

function getAvatarDescription(physical: any, personality: any): string {
  const age = physical.age;
  const gender =
    physical.gender === "male" ? "Junge" :
    physical.gender === "female" ? "Mädchen" : "Kind";

  const topTraits = Object.entries(personality)
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
    comedy: "Lachabenteuer",
    sciFi: "Weltraumabenteuer",
  };

  const title = `Das große ${genreMap[config.genre] || "Abenteuer"} von ${avatars[0]?.name || "unserem Helden"}`;
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
  const learningBit = config.learningMode?.enabled
    ? `

In diesem Kapitel lernen wir auch etwas Wichtiges: ${(config.learningMode?.learningObjectives ?? []).join(", ")}. Das hilft uns, die Welt besser zu verstehen und klüger zu werden.`
    : "";

  return `In diesem aufregenden Kapitel erleben ${names} spannende Abenteuer in ${config.setting}. 

Die Freunde müssen zusammenarbeiten und ihre besonderen Fähigkeiten einsetzen, um die Herausforderungen zu meistern. Jeder von ihnen bringt seine eigenen Stärken mit ein, und gemeinsam sind sie unschlagbar.

Während sie ihr Abenteuer fortsetzen, lernen sie wichtige Lektionen über Freundschaft, Mut und Zusammenhalt. Die Welt um sie herum ist voller Wunder und Überraschungen, die darauf warten, entdeckt zu werden.${learningBit}

Mit Mut, Freundschaft und einem Lächeln können unsere Helden jede Herausforderung meistern!`;
}
