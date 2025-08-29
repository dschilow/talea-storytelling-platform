import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { secret } from "encore.dev/config";

const storyDB = new SQLDatabase("story", {
  migrations: "./migrations",
});

const openAIKey = secret("OpenAIKey");

export interface StoryConfig {
  avatarIds: string[];
  genre: string;
  setting: string;
  length: "short" | "medium" | "long";
  complexity: "simple" | "medium" | "complex";
  learningMode?: LearningMode;
  ageGroup: "3-5" | "6-8" | "9-12" | "13+";
}

export interface LearningMode {
  enabled: boolean;
  subjects: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  learningObjectives: string[];
  assessmentType: "quiz" | "interactive" | "discussion";
}

export interface Chapter {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  order: number;
}

export interface Story {
  id: string;
  userId: string;
  title: string;
  description: string;
  coverImageUrl?: string;
  config: StoryConfig;
  chapters: Chapter[];
  status: "generating" | "complete" | "error";
  createdAt: Date;
  updatedAt: Date;
}

interface GenerateStoryRequest {
  userId: string;
  config: StoryConfig;
}

// Generates a new story based on the provided configuration.
export const generate = api<GenerateStoryRequest, Story>(
  { expose: true, method: "POST", path: "/story/generate" },
  async (req) => {
    const id = crypto.randomUUID();
    const now = new Date();

    // Create initial story record
    await storyDB.exec`
      INSERT INTO stories (
        id, user_id, title, description, config, status, created_at, updated_at
      ) VALUES (
        ${id}, ${req.userId}, 'Generating...', 'Story is being generated...', 
        ${JSON.stringify(req.config)}, 'generating', ${now}, ${now}
      )
    `;

    // Simulate AI story generation (in real implementation, this would call OpenAI)
    const generatedStory = await generateStoryContent(req.config);

    // Update story with generated content
    await storyDB.exec`
      UPDATE stories 
      SET title = ${generatedStory.title}, 
          description = ${generatedStory.description},
          cover_image_url = ${generatedStory.coverImageUrl},
          status = 'complete',
          updated_at = ${new Date()}
      WHERE id = ${id}
    `;

    // Insert chapters
    for (const chapter of generatedStory.chapters) {
      const chapterId = crypto.randomUUID();
      await storyDB.exec`
        INSERT INTO chapters (
          id, story_id, title, content, image_url, chapter_order, created_at
        ) VALUES (
          ${chapterId}, ${id}, ${chapter.title}, ${chapter.content}, 
          ${chapter.imageUrl}, ${chapter.order}, ${now}
        )
      `;
    }

    return {
      id,
      userId: req.userId,
      title: generatedStory.title,
      description: generatedStory.description,
      coverImageUrl: generatedStory.coverImageUrl,
      config: req.config,
      chapters: generatedStory.chapters.map(ch => ({ ...ch, id: crypto.randomUUID() })),
      status: "complete",
      createdAt: now,
      updatedAt: new Date(),
    };
  }
);

async function generateStoryContent(config: StoryConfig): Promise<{
  title: string;
  description: string;
  coverImageUrl?: string;
  chapters: Omit<Chapter, 'id'>[];
}> {
  // This is a simplified mock implementation
  // In production, this would use OpenAI API with the secret key
  
  const genres = {
    adventure: "Abenteuer",
    fantasy: "Fantasy",
    mystery: "Geheimnis",
    friendship: "Freundschaft",
    learning: "Lernen"
  };

  const title = `Das große ${genres[config.genre as keyof typeof genres] || "Abenteuer"}`;
  const description = `Eine spannende Geschichte über ${config.avatarIds.length} Freunde in einer ${config.setting} Welt.`;

  const chapterCount = config.length === "short" ? 3 : config.length === "medium" ? 5 : 8;
  const chapters: Omit<Chapter, 'id'>[] = [];

  for (let i = 0; i < chapterCount; i++) {
    chapters.push({
      title: `Kapitel ${i + 1}: ${getChapterTitle(i, config.genre)}`,
      content: generateChapterContent(i, config),
      order: i,
      imageUrl: `https://picsum.photos/400/300?random=${i}`,
    });
  }

  return {
    title,
    description,
    coverImageUrl: "https://picsum.photos/600/800?random=cover",
    chapters,
  };
}

function getChapterTitle(index: number, genre: string): string {
  const titles = {
    0: "Der Beginn",
    1: "Erste Herausforderungen",
    2: "Unerwartete Wendung",
    3: "Zusammenhalt",
    4: "Die große Prüfung",
    5: "Mut und Freundschaft",
    6: "Das Finale",
    7: "Ein neuer Anfang"
  };
  return titles[index as keyof typeof titles] || `Kapitel ${index + 1}`;
}

function generateChapterContent(index: number, config: StoryConfig): string {
  return `Dies ist der Inhalt von Kapitel ${index + 1}. 

In diesem Kapitel erleben unsere Helden spannende Abenteuer in der ${config.setting} Welt. 

Die Geschichte entwickelt sich weiter und die Charaktere wachsen an ihren Herausforderungen.

${config.learningMode?.enabled ? 
  `\n\nLernziel: ${config.learningMode.learningObjectives.join(', ')}` : 
  ''
}

Das war ein aufregendes Kapitel! Lass uns sehen, was als nächstes passiert...`;
}
