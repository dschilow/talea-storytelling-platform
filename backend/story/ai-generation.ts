import { api } from "encore.dev/api";
import { secret } from "encore.dev/config";
import type { StoryConfig, Chapter } from "./generate";
import { ai } from "~encore/clients";

// ---- OpenAI Modell & Pricing (Modul-weit gültig) ----
const MODEL = "gpt-4o-mini";
const INPUT_COST_PER_1M = 0.15;   // $/1M Input-Token
const OUTPUT_COST_PER_1M = 0.60;  // $/1M Output-Token

const openAIKey = secret("OpenAIKey");

interface GenerateStoryContentRequest {
  config: StoryConfig;
  avatarDetails: Array<{
    id: string;
    name: string;
    physicalTraits: any;
    personalityTraits: any;
    imageUrl?: string | null;
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

// Deterministischer Seed basierend auf Avatar-IDs, damit Charaktere konsistent aussehen
function deterministicSeedFrom(str: string): number {
  // FNV-1a 32-bit
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash >>> 0) * 0x01000193;
  }
  return Math.abs(hash >>> 0);
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

      // Referenzbilder (Avatare) zusammenstellen
      const referenceImages = req.avatarDetails
        .map(a => a.imageUrl)
        .filter((u): u is string => !!u && u.length > 0);

      // Gemeinsamer Seed für die Geschichte (konsistente Charaktere)
      const seedBase = deterministicSeedFrom(req.avatarDetails.map(a => a.id).join("|"));

      // Prompts & Dimensionen vorbereiten (Cover + Kapitel)
      const coverDimensions = normalizeRunwareDimensions(600, 800);
      const coverPrompt =
        `Children's book cover illustration for "${storyContent.title}". ` +
        `Keep character identity consistent with the provided reference images (same faces, hair, and outfits). ` +
        `${req.config.genre} adventure, ${req.config.setting} setting, ` +
        `Disney Pixar 3D animation style, colorful, magical, child-friendly, high quality, safe for children.`;

      const chapterDimensions = normalizeRunwareDimensions(400, 300);
      const chapterInputs = storyContent.chapters.map((chapter, index) => ({
        prompt:
          `Children's book illustration for the scene "${chapter.title}". ` +
          `The main characters must look identical to the reference images (same child identity, hairstyle, hair color, skin tone, eye color, clothing style). ` +
          `${req.config.genre} story scene, ${req.config.setting} background, ` +
          `Disney Pixar 3D animation style, colorful, magical, child-friendly, safe for children, high quality.`,
        width: chapterDimensions.width,
        height: chapterDimensions.height,
        steps: 20,
        seed: (seedBase + index * 101) >>> 0,
        referenceImages,
      }));

      // Batch Request: Cover + Kapitel gemeinsam in EINEM Call generieren
      const batchReq = {
        images: [
          {
            prompt: coverPrompt,
            width: coverDimensions.width,
            height: coverDimensions.height,
            steps: 25,
            seed: seedBase,
            referenceImages,
          },
          ...chapterInputs,
        ],
      };

      const batchResp = await ai.generateImagesBatch(batchReq);
      const allImages = batchResp.images;
      if (!allImages || allImages.length !== batchReq.images.length) {
        console.warn("⚠️ Batch response size mismatch, falling back to available results");
      }

      const coverImageUrl = allImages[0]?.imageUrl ?? "";
      const chaptersWithImages = storyContent.chapters.map((chapter, index) => {
        const img = allImages[index + 1];
        return { ...chapter, imageUrl: img?.imageUrl };
      });

      metadata.imagesGenerated = allImages.length;
      const imageCostPer1 = 0.0006; // Placeholder cost
      metadata.totalCost.images = metadata.imagesGenerated * imageCostPer1;
      metadata.totalCost.total = metadata.totalCost.text + metadata.totalCost.images;
      metadata.processingTime = Date.now() - startTime;

      console.log("💰 Generation costs:", metadata.totalCost);
      console.log("📊 Tokens used:", metadata.tokensUsed);
      console.log("⏱️ Processing time:", metadata.processingTime, "ms");

      return {
        title: storyContent.title,
        description: storyContent.description,
        coverImageUrl,
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

async function generateStoryWithOpenAI(
  config: StoryConfig,
  avatars: Array<{ name: string; physicalTraits: any; personalityTraits: any; imageUrl?: string | null }>
): Promise<{ title: string; description: string; chapters: Omit<Chapter, "id" | "imageUrl">[]; tokensUsed?: any }> {
  const avatarDescriptions = avatars
    .map((avatar) => `${avatar.name}: ${getAvatarDescription(avatar.physicalTraits, avatar.personalityTraits)}`)
    .join("\n");

  const chapterCount = config.length === "short" ? 3 : config.length === "medium" ? 5 : 8;

  const systemPrompt = "Du bist ein professioneller Kinderbuchautor. Erstelle Geschichten im JSON-Format basierend auf den gegebenen Parametern. Halte die Inhalte kindgerecht und sicher.";

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

Wichtig: Die Charaktere sollen über die Kapitel hinweg konsistent bleiben (Aussehen, Merkmale, Persönlichkeit).

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
      max_tokens: 2400,
      temperature: 0.7,
      response_format: { type: "json_object" }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenAI API Fehler:", errorText);
    throw new Error("OpenAI API Fehler - verwende Fallback");
  }

  const data = await response.json();
  const content = data.choices[0].message.content;

  let parsed;
  try {
    const cleanContent = content.replace(/```json\s*|\s*```/g, "").trim();
    parsed = JSON.parse(cleanContent);
  } catch (e) {
    console.error("JSON Parse Fehler:", e);
    throw new Error("JSON Parse Fehler - verwende Fallback");
  }

  return {
    ...parsed,
    tokensUsed: {
      prompt: data.usage?.prompt_tokens ?? 0,
      completion: data.usage?.completion_tokens ?? 0,
      total: data.usage?.total_tokens ?? 0,
    }
  };
}

async function generateFallbackStoryWithImages(
  config: StoryConfig,
  avatars: Array<{ name: string; physicalTraits: any; personalityTraits: any; imageUrl?: string | null }>
): Promise<{ title: string; description: string; coverImageUrl: string; chapters: Omit<Chapter, "id">[] }> {
  const chapterCount = config.length === "short" ? 3 : config.length === "medium" ? 5 : 8;
  const fallbackStory = generateFallbackStory(config, avatars, chapterCount);

  const referenceImages = avatars.map(a => a.imageUrl).filter((u): u is string => !!u);
  const seedBase = deterministicSeedFrom(avatars.map(a => (a as any).id ?? a.name).join("|"));

  const coverDimensions = normalizeRunwareDimensions(600, 800);
  const chapterDimensions = normalizeRunwareDimensions(400, 300);

  const batchReq = {
    images: [
      {
        prompt: `Children's book cover, ${config.genre} story, colorful, magical. Keep characters consistent with reference images.`,
        width: coverDimensions.width,
        height: coverDimensions.height,
        seed: seedBase,
        referenceImages,
      },
      ...fallbackStory.chapters.map((chapter, index) => ({
        prompt: `Children's book illustration, chapter ${index + 1}, ${config.genre} story. Match reference characters.`,
        width: chapterDimensions.width,
        height: chapterDimensions.height,
        seed: (seedBase + index * 101) >>> 0,
        referenceImages,
      })),
    ],
  };

  const batchResp = await ai.generateImagesBatch(batchReq);
  const all = batchResp.images;
  const coverImageUrl = all[0]?.imageUrl ?? "";
  const chaptersWithImages = fallbackStory.chapters.map((chapter, i) => ({
    ...chapter,
    imageUrl: all[i + 1]?.imageUrl,
  }));

  return {
    title: fallbackStory.title,
    description: fallbackStory.description,
    coverImageUrl,
    chapters: chaptersWithImages,
  };
}

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
