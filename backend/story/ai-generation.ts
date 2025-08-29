import { api } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { generateImage } from "../ai/image-generation";
import type { StoryConfig, Chapter } from "./generate";

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
  chapters: Omit<Chapter, 'id'>[];
}

// Generates story content using OpenAI GPT-4 and Runware for images.
export const generateStoryContent = api<GenerateStoryContentRequest, GenerateStoryContentResponse>(
  { expose: true, method: "POST", path: "/ai/generate-story" },
  async (req) => {
    console.log("Generating story with config:", JSON.stringify(req.config, null, 2));
    
    // Generate story structure and content with OpenAI
    const storyContent = await generateStoryWithOpenAI(req.config, req.avatarDetails);
    
    console.log("Generated story content:", storyContent.title);
    
    // Generate cover image
    const coverPrompt = `Children's book cover illustration for "${storyContent.title}", ${req.config.genre} adventure story, ${req.config.setting} setting, Disney Pixar 3D animation style, colorful, magical, child-friendly, high quality`;
    const coverImage = await generateImage({
      prompt: coverPrompt,
      width: 600,
      height: 800,
      steps: 25,
    });

    console.log("Generated cover image");

    // Generate chapter images
    const chaptersWithImages = await Promise.all(
      storyContent.chapters.map(async (chapter, index) => {
        const chapterPrompt = `Children's book illustration for chapter "${chapter.title}", ${req.config.genre} story scene, ${req.config.setting} background, Disney Pixar 3D animation style, colorful, magical, child-friendly, safe for children`;
        const chapterImage = await generateImage({
          prompt: chapterPrompt,
          width: 400,
          height: 300,
          steps: 20,
        });

        console.log(`Generated image for chapter ${index + 1}`);

        return {
          ...chapter,
          imageUrl: chapterImage.imageUrl,
        };
      })
    );

    return {
      title: storyContent.title,
      description: storyContent.description,
      coverImageUrl: coverImage.imageUrl,
      chapters: chaptersWithImages,
    };
  }
);

async function generateStoryWithOpenAI(
  config: StoryConfig, 
  avatars: Array<{ name: string; physicalTraits: any; personalityTraits: any; }>
): Promise<{ title: string; description: string; chapters: Omit<Chapter, 'id' | 'imageUrl'>[] }> {
  const avatarDescriptions = avatars.map(avatar => 
    `${avatar.name}: ${getAvatarDescription(avatar.physicalTraits, avatar.personalityTraits)}`
  ).join('\n');

  const chapterCount = config.length === "short" ? 3 : config.length === "medium" ? 5 : 8;
  
  const systemPrompt = `Du bist ein professioneller Kinderbuchautor. Erstelle fesselnde, altersgerechte Geschichten, die sowohl lehrreich als auch unterhaltsam sind. Schreibe immer auf Deutsch und verwende eine kindgerechte, warme Sprache.`;

  const userPrompt = `Erstelle eine ${config.genre} Geschichte in ${config.setting} für die Altersgruppe ${config.ageGroup}.

Geschichte Parameter:
- Länge: ${config.length} (${chapterCount} Kapitel)
- Komplexität: ${config.complexity}
- Charaktere: ${avatarDescriptions}

${config.learningMode?.enabled ? `
Lernziele:
- Fächer: ${config.learningMode.subjects.join(', ')}
- Schwierigkeit: ${config.learningMode.difficulty}
- Lernziele: ${config.learningMode.learningObjectives.join(', ')}
` : ''}

Bitte erstelle:
1. Einen fesselnden Titel
2. Eine kurze Beschreibung (2-3 Sätze)
3. ${chapterCount} Kapitel, jedes mit:
   - Kapiteltitel
   - Kapitelinhalt (200-400 Wörter je nach Altersgruppe)

Formatiere als JSON:
{
  "title": "Geschichte Titel",
  "description": "Geschichte Beschreibung",
  "chapters": [
    {
      "title": "Kapitel 1 Titel",
      "content": "Kapitelinhalt...",
      "order": 0
    }
  ]
}`;

  console.log("Sending request to OpenAI...");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openAIKey()}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.8,
      max_tokens: 4000,
      response_format: { type: "json_object" }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenAI API error:", response.status, errorText);
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log("OpenAI response received");
  
  const content = data.choices[0].message.content;
  
  try {
    const parsedContent = JSON.parse(content);
    console.log("Successfully parsed OpenAI response");
    return parsedContent;
  } catch (error) {
    console.error("Failed to parse OpenAI response, using fallback");
    // Fallback if JSON parsing fails
    return generateFallbackStory(config, avatars, chapterCount);
  }
}

function getAvatarDescription(physical: any, personality: any): string {
  const age = physical.age;
  const gender = physical.gender === "male" ? "Junge" : physical.gender === "female" ? "Mädchen" : "Kind";
  const topTraits = Object.entries(personality)
    .sort(([,a], [,b]) => (b as number) - (a as number))
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
    .join(' und ');
  
  return `${age} Jahre alter ${gender}, besonders ${topTraits}`;
}

function generateFallbackStory(
  config: StoryConfig, 
  avatars: Array<{ name: string; physicalTraits: any; personalityTraits: any; }>,
  chapterCount: number
): { title: string; description: string; chapters: Omit<Chapter, 'id' | 'imageUrl'>[] } {
  const genreMap: { [key: string]: string } = {
    adventure: "Abenteuer",
    fantasy: "Fantasy-Abenteuer",
    mystery: "Geheimnis",
    friendship: "Freundschaftsgeschichte",
    learning: "Lerngeschichte"
  };

  const title = `Das große ${genreMap[config.genre] || "Abenteuer"} von ${avatars[0]?.name || "unserem Helden"}`;
  const description = `Eine spannende Geschichte über ${avatars.length} Freunde, die ein aufregendes Abenteuer in ${config.setting} erleben und dabei wichtige Lektionen über Freundschaft und Mut lernen.`;
  
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
    "Ein neuer Anfang"
  ];
  return titles[index] || `Kapitel ${index + 1}`;
}

function generateChapterContent(
  index: number, 
  config: StoryConfig, 
  avatars: Array<{ name: string; physicalTraits: any; personalityTraits: any; }>
): string {
  const names = avatars.map(a => a.name).join(', ');
  
  const baseContent = `In diesem aufregenden Kapitel erleben ${names} spannende Abenteuer in ${config.setting}. 

Die Freunde müssen zusammenarbeiten und ihre besonderen Fähigkeiten einsetzen, um die Herausforderungen zu meistern. Jeder von ihnen bringt seine eigenen Stärken mit ein, und gemeinsam sind sie unschlagbar.

Während sie ihr Abenteuer fortsetzen, lernen sie wichtige Lektionen über Freundschaft, Mut und Zusammenhalt. Die Welt um sie herum ist voller Wunder und Überraschungen, die darauf warten, entdeckt zu werden.

${config.learningMode?.enabled ? 
  `\n\nIn diesem Kapitel lernen wir auch etwas Wichtiges: ${config.learningMode.learningObjectives.join(', ')}. Das hilft uns, die Welt besser zu verstehen und klüger zu werden.` : 
  ''
}

Mit Mut, Freundschaft und einem Lächeln können unsere Helden jede Herausforderung meistern!`;

  return baseContent;
}
