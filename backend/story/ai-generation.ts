import { api } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { generateImage } from "../ai/image-generation";
import type { StoryConfig, Chapter } from "./generate";

// ---- OpenAI Modell & Pricing (Modul-weit gültig) ----
// Du kannst "gpt-5" verwenden, aber für geringe Latenz/Kosten ist "gpt-5-nano" ideal.
const MODEL = "gpt-5-nano";

// TODO: Passe die Preise an die aktuelle Preisliste an.
const INPUT_COST_PER_1M = 0.15;   // $/1M Input-Token (Platzhalter)
const OUTPUT_COST_PER_1M = 0.60;  // $/1M Output-Token (Platzhalter)

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

// Utility: Runware-Dimensionen auf Vielfache von 64 normalisieren
function normalizeRunwareDimensions(width: number, height: number): { width: number; height: number } {
  const roundToMultiple64 = (n: number) => Math.round(n / 64) * 64;
  const normalizedWidth = Math.max(128, Math.min(2048, roundToMultiple64(width)));
  const normalizedHeight = Math.max(128, Math.min(2048, roundToMultiple64(height)));
  return { width: normalizedWidth, height: normalizedHeight };
}

// --- Public API: Story generieren ---
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

      // 1) Story über OpenAI erzeugen (Responses API + json_schema)
      const storyContent = await generateStoryWithOpenAI(req.config, req.avatarDetails);

      console.log("✅ Generated story content:", storyContent.title);

      // 2) Textkosten berechnen
      metadata.tokensUsed = storyContent.tokensUsed ?? { prompt: 0, completion: 0, total: 0 };
      metadata.totalCost.text =
        (metadata.tokensUsed.prompt / 1_000_000) * INPUT_COST_PER_1M +
        (metadata.tokensUsed.completion / 1_000_000) * OUTPUT_COST_PER_1M;

      // 3) Cover generieren
      const coverDimensions = normalizeRunwareDimensions(600, 800); // z. B. 576x768
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

      // 4) Kapitelbilder generieren
      const chapterDimensions = normalizeRunwareDimensions(400, 300); // z. B. 384x320
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

      // 5) Bildkosten (Schätzwert/Platzhalter)
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

      // Fallback: simple Story + Platzhalterbilder
      const fallbackResult = await generateFallbackStoryWithImages(req.config, req.avatarDetails);
      return { ...fallbackResult, metadata };
    }
  }
);

// --- OpenAI: Story via Responses API + Structured Outputs ---
async function generateStoryWithOpenAI(
  config: StoryConfig,
  avatars: Array<{ name: string; physicalTraits: any; personalityTraits: any }>
): Promise<{ title: string; description: string; chapters: Omit<Chapter, "id" | "imageUrl">[]; tokensUsed?: any }> {
  const avatarDescriptions = avatars
    .map((avatar) => `${avatar.name}: ${getAvatarDescription(avatar.physicalTraits, avatar.personalityTraits)}`)
    .join("\n");

  const chapterCount = config.length === "short" ? 3 : config.length === "medium" ? 5 : 8;

  const systemPrompt =
    "Du bist ein professioneller Kinderbuchautor. Antworte NUR mit JSON, ohne zusätzliche Texte.";
  const userPrompt = `Erstelle eine ${config.genre} Geschichte in ${config.setting} für die Altersgruppe ${config.ageGroup}.

Parameter:
- Länge: ${config.length} (${chapterCount} Kapitel)
- Komplexität: ${config.complexity}
- Charaktere:
${avatarDescriptions}

${
  config?.learningMode?.enabled
    ? `Lernziele:
- Fächer: ${config.learningMode.subjects.join(", ")}
- Schwierigkeit: ${config.learningMode.difficulty}
- Lernziele: ${config.learningMode.learningObjectives.join(", ")}`
    : ""
}

Gib NUR ein JSON-Objekt gemäß Schema zurück (ohne Codefences, Kommentare oder Erklärtexte).`;

  // Strenges JSON-Schema (Structured Outputs)
  const storySchema = {
    name: "StoryPayload",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string", minLength: 3, maxLength: 120 },
        description: { type: "string", minLength: 20, maxLength: 500 },
        chapters: {
          type: "array",
          minItems: chapterCount,
          maxItems: chapterCount,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string", minLength: 3, maxLength: 120 },
              content: { type: "string", minLength: 150, maxLength: 1200 },
              order: { type: "integer", minimum: 0 },
            },
            required: ["title", "content", "order"],
          },
        },
      },
      required: ["title", "description", "chapters"],
    },
  };

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAIKey()}`,
    },
    body: JSON.stringify({
      model: MODEL,
      input: [
        { role: "developer", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      // Wichtig: Responses API -> max_output_tokens
      max_output_tokens: 2400,
      temperature: 0.8,
      // Keine frequency/presence_penalty verwenden; einige gpt-5(-nano) varianten unterstützen das nicht.
      response_format: { type: "json_schema", json_schema: storySchema },
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    console.error("❌ OpenAI API error:", res.status, t);
    throw new Error(`OpenAI API error: ${res.status} ${res.statusText} - ${t}`);
  }

  const data = await res.json();
  console.log("✅ OpenAI response received");

  // Output-Text robust extrahieren
  const outputText: string | undefined =
    data.output_text ??
    (Array.isArray(data.output?.[0]?.content) ? data.output[0].content.find((c: any) => typeof c?.text === "string")?.text : undefined) ??
    (typeof data.output === "string" ? data.output : undefined);

  if (!outputText || typeof outputText !== "string") {
    throw new Error("OpenAI: Konnte output_text nicht extrahieren.");
  }

  // Structured Outputs => sollte valides JSON sein
  const parsed = JSON.parse(outputText);

  // Usage normalisieren (Responses API verwendet input_tokens/output_tokens)
  const usage = data.usage ?? data.response?.usage ?? {};
  const tokensUsed = {
    prompt: usage.input_tokens ?? usage.prompt_tokens ?? 0,
    completion: usage.output_tokens ?? usage.completion_tokens ?? 0,
    total: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
  };

  return { ...parsed, tokensUsed };
}

// --- Fallback-Story inkl. Platzhalterbilder ---
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

// --- Helper: Avatarbeschreibung kurz ---
function getAvatarDescription(physical: any, personality: any): string {
  const age = physical?.age ?? "?";
  const gender =
    physical?.gender === "male" ? "Junge" : physical?.gender === "female" ? "Mädchen" : "Kind";
  const topTraits = Object.entries(personality ?? {})
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 2)
    .map(([trait]) => {
      switch (trait) {
        case "courage":
          return "mutig";
        case "intelligence":
          return "klug";
        case "creativity":
          return "kreativ";
        case "empathy":
          return "einfühlsam";
        case "strength":
          return "stark";
        case "humor":
          return "lustig";
        case "adventure":
          return "abenteuerlustig";
        case "patience":
          return "geduldig";
        case "curiosity":
          return "neugierig";
        case "leadership":
          return "führungsstark";
        default:
          return trait;
      }
    })
    .join(" und ");

  return `${age} Jahre alter ${gender}, besonders ${topTraits}`;
}

// --- Fallback-Story (Text) ---
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
  const description = `Eine spannende Geschichte über ${avatars.length} Freund${
    avatars.length === 1 ? "" : "e"
  }, die ein aufregendes Abenteuer in ${config.setting} erleben und dabei wichtige Lektionen über Freundschaft und Mut lernen.`;

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

In diesem Kapitel lernen wir auch etwas Wichtiges: ${config.learningMode.learningObjectives.join(
          ", "
        )}.`
      : ""
  }

Mit Mut, Freundschaft und einem Lächeln können unsere Helden jede Herausforderung meistern!`;

  return baseContent;
}
