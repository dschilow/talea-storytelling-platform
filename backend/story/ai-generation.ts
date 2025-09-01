import { api } from "encore.dev/api";
import { secret } from "encore.dev/config";
import type { StoryConfig, Chapter } from "./generate";
import { ai } from "~encore/clients";

// ---- OpenAI Modell & Pricing (GPT-5-nano) ----
const MODEL = "gpt-5-nano";
const INPUT_COST_PER_1M = 0.05;   // $/1M Input-Token (GPT-5-nano offizieller Preis)
const OUTPUT_COST_PER_1M = 0.40;  // $/1M Output-Token (GPT-5-nano offizieller Preis)

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

// Erstelle detaillierte Charakterbeschreibung für Prompts
function createDetailedCharacterDescription(avatar: any): string {
  const physical = avatar.physicalTraits || {};
  const personality = avatar.personalityTraits || {};
  
  // Alter und Geschlecht
  const age = physical.age || 8;
  const gender = physical.gender === "male" ? "boy" : physical.gender === "female" ? "girl" : "child";
  
  // Physische Merkmale
  const hairColor = physical.hairColor || "brown";
  const hairStyle = physical.hairStyle || "short";
  const eyeColor = physical.eyeColor || "brown";
  const height = physical.height || "average height";
  const build = physical.build || "slim";
  
  // Besondere Merkmale
  const specialFeatures = [];
  if (physical.glasses) specialFeatures.push("wearing glasses");
  if (physical.freckles) specialFeatures.push("with freckles");
  if (physical.dimples) specialFeatures.push("with dimples");
  if (physical.gap_teeth) specialFeatures.push("with gap between front teeth");
  if (physical.scar) specialFeatures.push(`with small scar on ${physical.scar_location || "face"}`);
  
  // Kleidungsstil
  const clothing = physical.clothingStyle || "casual comfortable clothes";
  
  // Persönlichkeitsmerkmale für Ausdruck
  const topPersonality = Object.entries(personality)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 3)
    .map(([trait]) => trait)
    .join(", ");
  
  const description = `${avatar.name}: ${age}-year-old ${gender} with ${hairStyle} ${hairColor} hair, ${eyeColor} eyes, ${height}, ${build} build${specialFeatures.length > 0 ? ', ' + specialFeatures.join(', ') : ''}, wearing ${clothing}, personality: ${topPersonality}`;
  
  return description;
}

// Erstelle Genre- und Setting-spezifische Umgebungsdetails
function createEnvironmentDescription(config: StoryConfig): string {
  const genreElements: Record<string, string> = {
    adventure: "exciting outdoor adventure elements, hiking gear, maps, compass, backpacks, natural obstacles",
    fantasy: "magical elements, glowing crystals, mystical creatures, enchanted forests, floating objects, sparkles",
    mystery: "mysterious atmosphere, magnifying glass, clues, detective equipment, shadowy corners, question marks",
    friendship: "warm cozy environments, shared activities, group interactions, comfortable settings",
    learning: "educational elements, books, learning tools, discovery objects, bright cheerful classrooms"
  };
  
  const settingElements: Record<string, string> = {
    forest: "dense woodland, tall trees, forest floor with leaves, woodland creatures, dappled sunlight",
    city: "urban environment, buildings, streets, parks, city landmarks, modern architecture",
    school: "classrooms, desks, blackboards, school supplies, hallways, playground equipment",
    home: "cozy interior, furniture, family photos, comfortable living spaces, kitchen, garden",
    fantasy_world: "magical landscape, floating islands, crystal caves, rainbow bridges, talking animals",
    beach: "sandy shore, ocean waves, seashells, beach umbrellas, sandcastles, seabirds",
    mountains: "rocky peaks, hiking trails, mountain wildlife, scenic vistas, camping equipment"
  };
  
  const genre = genreElements[config.genre] || "general adventure elements";
  const setting = settingElements[config.setting] || "outdoor natural environment";
  
  return `${setting}, ${genre}`;
}

// Extrahiere Hauptaktion aus Kapitelinhalt
function extractMainAction(content: string): string {
  // Vereinfachte Extraktion der Haupthandlung
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const actionWords = ["entdecken", "finden", "helfen", "retten", "lernen", "spielen", "bauen", "erkunden", "begegnen", "lösen"];
  
  for (const sentence of sentences) {
    for (const action of actionWords) {
      if (sentence.toLowerCase().includes(action)) {
        return sentence.trim();
      }
    }
  }
  
  // Fallback: ersten bedeutungsvollen Satz verwenden
  return sentences[0]?.trim() || "having an adventure together";
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
      console.log("📚 Generating story with config:", JSON.stringify(req.config, null, 2));

      const storyContent = await generateStoryWithOpenAI(req.config, req.avatarDetails);
      console.log("✅ Generated story content:", storyContent.title);

      metadata.tokensUsed = storyContent.tokensUsed ?? { prompt: 0, completion: 0, reasoning: 0, total: 0 };
      
      // GPT-5-nano Kostenberechnung (berücksichtigt reasoning_tokens)
      const outputTokens = metadata.tokensUsed.completion + metadata.tokensUsed.reasoning;
      metadata.totalCost.text =
        (metadata.tokensUsed.prompt / 1_000_000) * INPUT_COST_PER_1M +
        (outputTokens / 1_000_000) * OUTPUT_COST_PER_1M;

      // Keine Referenzbilder mehr verwenden - Runware hat Probleme damit
      console.log("🖼️ Generating images without reference images (relying on detailed prompts)");

      // Gemeinsamer Seed für die Geschichte (konsistente Charaktere)
      const seedBase = deterministicSeedFrom(req.avatarDetails.map(a => a.id).join("|"));

      // Detaillierte Charakterbeschreibungen erstellen
      const characterDescriptions = req.avatarDetails
        .map(avatar => createDetailedCharacterDescription(avatar))
        .join(". ");

      // Umgebungsbeschreibung basierend auf Genre und Setting
      const environmentDescription = createEnvironmentDescription(req.config);

      // Prompts & Dimensionen vorbereiten (Cover + Kapitel)
      const coverDimensions = normalizeRunwareDimensions(600, 800);
      
      // DETAILLIERTER COVER-PROMPT (ohne Referenzbilder)
      const coverPrompt = 
        `Children's book cover illustration: "${storyContent.title}". ` +
        `Main characters: ${characterDescriptions}. ` +
        `Story setting: ${environmentDescription}. ` +
        `Cover scene: The characters are positioned prominently in the foreground, showing their characteristic expressions and poses that reflect their personalities. ` +
        `Background shows the main story environment with ${req.config.genre} adventure elements. ` +
        `Art style: Disney Pixar 3D animation style, vibrant colors, magical lighting, child-friendly, professional children's book cover quality, ` +
        `expressive character faces, detailed clothing and hair, warm emotional atmosphere, age-appropriate for ${req.config.ageGroup}. ` +
        `High quality, detailed, sharp focus, consistent character design.`;

      // DETAILLIERTE KAPITEL-PROMPTS (ohne Referenzbilder)
      const chapterPrompts = storyContent.chapters.map((chapter, index) => {
        const mainAction = extractMainAction(chapter.content);
        
        return 
          `Children's book illustration for chapter "${chapter.title}". ` +
          `Characters: ${characterDescriptions}. ` +
          `Scene action: ${mainAction}. ` +
          `Setting: ${environmentDescription}. ` +
          `Specific scene: The characters are actively engaged in the chapter's main activity, ` +
          `showing appropriate emotions and interactions based on the story content. ` +
          `Environment details match the story's ${req.config.setting} setting with ${req.config.genre} elements. ` +
          `Art style: Disney Pixar 3D animation, warm colorful lighting, child-friendly, detailed character expressions, ` +
          `consistent character appearance (same faces, hair, eye colors, clothing), ` +
          `age-appropriate content for ${req.config.ageGroup}, professional children's book illustration quality. ` +
          `Focus on storytelling through visual composition and character positioning. ` +
          `High quality, detailed, sharp focus, vibrant colors, consistent character design.`;
      });

      console.log("🎨 Generating cover image...");
      
      // Cover-Bild einzeln generieren
      const coverResponse = await ai.generateImage({
        prompt: coverPrompt,
        model: "runware:101@1",
        width: coverDimensions.width,
        height: coverDimensions.height,
        steps: 30,
        CFGScale: 8.5,
        seed: seedBase,
        outputFormat: "WEBP",
        negativePrompt: "realistic photography, live action, adult content, scary, dark, horror, blurry, low quality, distorted faces, bad anatomy, inconsistent character appearance, text, watermarks, copyright"
      });

      console.log("📚 Generating chapter images...");
      
      // Kapitel-Bilder einzeln generieren
      const chapterResponses = [];
      for (let i = 0; i < chapterPrompts.length; i++) {
        console.log(`🎨 Generating chapter ${i + 1}/${chapterPrompts.length}...`);
        
        const chapterResponse = await ai.generateImage({
          prompt: chapterPrompts[i],
          model: "runware:101@1", 
          width: chapterDimensions.width,
          height: chapterDimensions.height,
          steps: 25,
          CFGScale: 8.0,
          seed: (seedBase + i * 101) >>> 0,
          outputFormat: "WEBP",
          negativePrompt: "realistic photography, live action, adult content, scary, dark, horror, blurry, low quality, distorted faces, bad anatomy, inconsistent character appearance, text, watermarks"
        });
        
        chapterResponses.push(chapterResponse);
      }

      const coverImageUrl = coverResponse.imageUrl;
      const chaptersWithImages = storyContent.chapters.map((chapter, index) => ({
        ...chapter,
        imageUrl: chapterResponses[index]?.imageUrl || ""
      }));

      metadata.imagesGenerated = 1 + chapterResponses.length;
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

  const systemPrompt = `Du bist ein professioneller Kinderbuchautor. Erstelle detaillierte, bildreiche Geschichten im JSON-Format. 
Jedes Kapitel soll konkrete, visuelle Szenen enthalten, die sich gut für Illustrationen eignen. 
Verwende lebendige Beschreibungen von Orten, Handlungen und Charakterinteraktionen.`;

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

WICHTIGE ANFORDERUNGEN:
1. Jedes Kapitel soll eine konkrete, visuelle Szene beschreiben
2. Charaktere sollen konsistent bleiben (Aussehen, Merkmale, Persönlichkeit)
3. Beschreibe spezifische Handlungen, Orte und Gegenstände für bessere Bildgenerierung
4. Verwende lebendige, kindgerechte Sprache
5. Jedes Kapitel soll zwischen 200-800 Zeichen haben

Antworte NUR mit einem gültigen JSON-Objekt in folgendem Format:
{
  "title": "Titel der Geschichte",
  "description": "Kurze Beschreibung der Geschichte (20-500 Zeichen)",
  "chapters": [
    {
      "title": "Kapitel Titel",
      "content": "Detaillierter Kapitel Inhalt mit konkreten visuellen Szenen und Handlungen (200-800 Zeichen)",
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
      // GPT-5-nano spezifische Parameter
      max_completion_tokens: 3000,  // Erhöht für detailliertere Inhalte
      response_format: { type: "json_object" },
      reasoning_effort: "minimal",   // Für Kostenoptimierung bei GPT-5-nano
      verbosity: "medium"            // Ausgewogene Ausgabelänge für GPT-5-nano
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
      reasoning: data.usage?.reasoning_tokens ?? 0,  // GPT-5-nano reasoning tokens
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

  const seedBase = deterministicSeedFrom(avatars.map(a => (a as any).id ?? a.name).join("|"));
  const characterDescriptions = avatars.map(avatar => createDetailedCharacterDescription(avatar)).join(". ");
  const environmentDescription = createEnvironmentDescription(config);

  const coverDimensions = normalizeRunwareDimensions(600, 800);
  const chapterDimensions = normalizeRunwareDimensions(400, 300);

  // Cover einzeln generieren
  const coverPrompt = `Children's book cover: ${fallbackStory.title}. Characters: ${characterDescriptions}. Setting: ${environmentDescription}. Disney Pixar style, colorful, magical, professional quality.`;
  
  console.log("🎨 Generating fallback cover...");
  const coverResponse = await ai.generateImage({
    prompt: coverPrompt,
    model: "runware:101@1",
    width: coverDimensions.width,
    height: coverDimensions.height,
    steps: 25,
    seed: seedBase,
    outputFormat: "WEBP",
    negativePrompt: "realistic photography, live action, dark, scary, blurry, low quality, distorted faces"
  });

  // Kapitel einzeln generieren  
  console.log("📚 Generating fallback chapter images...");
  const chapterImages = [];
  for (let i = 0; i < fallbackStory.chapters.length; i++) {
    const chapter = fallbackStory.chapters[i];
    const chapterPrompt = `Children's book illustration: ${chapter.title}. Characters: ${characterDescriptions} in ${environmentDescription}. Scene: ${extractMainAction(chapter.content)}. Disney Pixar style, detailed, colorful.`;
    
    console.log(`🎨 Generating fallback chapter ${i + 1}/${fallbackStory.chapters.length}...`);
    
    const chapterResponse = await ai.generateImage({
      prompt: chapterPrompt,
      model: "runware:101@1",
      width: chapterDimensions.width,
      height: chapterDimensions.height,
      steps: 20,
      seed: (seedBase + i * 101) >>> 0,
      outputFormat: "WEBP",
      negativePrompt: "realistic photography, live action, dark, scary, blurry, low quality, distorted faces"
    });
    
    chapterImages.push(chapterResponse);
  }

  const chaptersWithImages = fallbackStory.chapters.map((chapter, i) => ({
    ...chapter,
    imageUrl: chapterImages[i]?.imageUrl || "",
  }));

  return {
    title: fallbackStory.title,
    description: fallbackStory.description,
    coverImageUrl: coverResponse.imageUrl,
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
    content: generateDetailedChapterContent(i, config, avatars),
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

function generateDetailedChapterContent(
  index: number,
  config: StoryConfig,
  avatars: Array<{ name: string; physicalTraits: any; personalityTraits: any }>
): string {
  const names = avatars.map((a) => a.name).join(" und ");

  // Kapitel-spezifische Szenen für bessere Bildgenerierung
  const scenes = [
    `${names} stehen vor einem großen, alten Baum mit einer geheimnisvollen Tür im Stamm. Sie schauen sich neugierig an und fassen sich an den Händen, bevor sie mutig durch die Tür treten.`,
    `Die Freunde entdecken eine funkelnde Höhle voller bunter Kristalle. ${names} halten kleine Taschenlampen in den Händen und bestaunen staunend die glitzernden Wände um sie herum.`,
    `Plötzlich hören sie ein leises Wimmern. ${names} folgen dem Geräusch und finden ein kleines, verletztes Waldtier zwischen den Büschen. Vorsichtig nähern sie sich, um zu helfen.`,
    `Gemeinsam bauen ${names} eine kleine Brücke aus Ästen und Steinen über einen Bach. Sie arbeiten Hand in Hand und ermutigen sich gegenseitig bei der schwierigen Aufgabe.`,
    `Die größte Herausforderung wartet auf sie: Ein steiler Berg versperrt den Weg. ${names} schauen hinauf, packen ihre Rucksäcke fester und beginnen gemeinsam den Aufstieg.`,
    `Oben angekommen, umarmen sich ${names} glücklich und schauen über die wunderschöne Landschaft. Sie haben es geschafft und sind stolz aufeinander.`,
    `Bei Sonnenuntergang sitzen ${names} um ein kleines Lagerfeuer und erzählen sich von ihrem großen Abenteuer. Die Sterne beginnen zu funkeln und sie lächeln zufrieden.`,
    `Zurück zu Hause angekommen, zeigen ${names} ihren Eltern stolz die Schätze und Erinnerungen, die sie mitgebracht haben. Ein neues Abenteuer wartet schon auf sie.`
  ];

  const baseScene = scenes[index] || scenes[index % scenes.length];

  return baseScene + (config?.learningMode?.enabled 
    ? ` Dabei lernen sie wichtiges über ${config.learningMode.learningObjectives.join(" und ")}.` 
    : " Mit Mut und Freundschaft können sie jede Herausforderung meistern!");
}