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

// Generates story content using OpenAI GPT-5 Nano and Runware for images.
export const generateStoryContent = api<GenerateStoryContentRequest, GenerateStoryContentResponse>(
  { expose: true, method: "POST", path: "/ai/generate-story" },
  async (req) => {
    // Generate story structure and content with OpenAI
    const storyContent = await generateStoryWithOpenAI(req.config, req.avatarDetails);
    
    // Generate cover image
    const coverPrompt = `Children's book cover for "${storyContent.title}", ${req.config.genre} genre, ${req.config.setting} setting, colorful, magical, Disney Pixar style, high quality`;
    const coverImage = await generateImage({
      prompt: coverPrompt,
      width: 600,
      height: 800,
      steps: 25,
    });

    // Generate chapter images
    const chaptersWithImages = await Promise.all(
      storyContent.chapters.map(async (chapter, index) => {
        const chapterPrompt = `Children's book illustration for chapter "${chapter.title}", ${req.config.genre} story, ${req.config.setting} setting, Disney Pixar style, colorful, magical, safe for children`;
        const chapterImage = await generateImage({
          prompt: chapterPrompt,
          width: 400,
          height: 300,
          steps: 20,
        });

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
  
  const systemPrompt = `You are a professional children's story writer. Create engaging, age-appropriate stories that are educational and entertaining. Always write in German.`;

  const userPrompt = `Create a ${config.genre} story set in ${config.setting} for age group ${config.ageGroup}.

Story parameters:
- Length: ${config.length} (${chapterCount} chapters)
- Complexity: ${config.complexity}
- Characters: ${avatarDescriptions}

${config.learningMode?.enabled ? `
Learning objectives:
- Subjects: ${config.learningMode.subjects.join(', ')}
- Difficulty: ${config.learningMode.difficulty}
- Objectives: ${config.learningMode.learningObjectives.join(', ')}
` : ''}

Please provide:
1. A compelling title
2. A brief description (2-3 sentences)
3. ${chapterCount} chapters, each with:
   - Chapter title
   - Chapter content (200-400 words depending on age group)

Format as JSON:
{
  "title": "Story Title",
  "description": "Story description",
  "chapters": [
    {
      "title": "Chapter 1 Title",
      "content": "Chapter content...",
      "order": 0
    }
  ]
}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openAIKey()}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini", // Using GPT-4o-mini as GPT-5 Nano is not yet available
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.8,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  try {
    return JSON.parse(content);
  } catch (error) {
    // Fallback if JSON parsing fails
    return generateFallbackStory(config, avatars, chapterCount);
  }
}

function getAvatarDescription(physical: any, personality: any): string {
  const age = physical.age;
  const gender = physical.gender;
  const topTraits = Object.entries(personality)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 2)
    .map(([trait]) => trait)
    .join(', ');
  
  return `${age} Jahre alt, ${gender}, besonders ${topTraits}`;
}

function generateFallbackStory(
  config: StoryConfig, 
  avatars: Array<{ name: string; physicalTraits: any; personalityTraits: any; }>,
  chapterCount: number
): { title: string; description: string; chapters: Omit<Chapter, 'id' | 'imageUrl'>[] } {
  const title = `Das große ${config.genre === 'adventure' ? 'Abenteuer' : 'Geheimnis'} von ${avatars[0]?.name || 'unserem Helden'}`;
  const description = `Eine spannende Geschichte über ${avatars.length} Freunde, die ein aufregendes Abenteuer in ${config.setting} erleben.`;
  
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
  
  return `In diesem aufregenden Kapitel erleben ${names} spannende Abenteuer in ${config.setting}. 

Die Freunde müssen zusammenarbeiten und ihre besonderen Fähigkeiten einsetzen, um die Herausforderungen zu meistern.

${config.learningMode?.enabled ? 
  `\n\nLernziel: ${config.learningMode.learningObjectives.join(', ')}` : 
  ''
}

Mit Mut und Freundschaft können sie alles schaffen!`;
}
