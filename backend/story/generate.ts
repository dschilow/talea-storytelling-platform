import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { generateStoryContent } from "./ai-generation";
import { avatar } from "~encore/clients";

const storyDB = new SQLDatabase("story", {
  migrations: "./migrations",
});

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
  metadata?: {
    tokensUsed?: {
      prompt: number;
      completion: number;
      total: number;
    };
    model?: string;
    processingTime?: number;
    imagesGenerated?: number;
    totalCost?: {
      text: number;
      images: number;
      total: number;
    };
  };
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
        ${id}, ${req.userId}, 'Wird generiert...', 'Deine Geschichte wird erstellt...', 
        ${JSON.stringify(req.config)}, 'generating', ${now}, ${now}
      )
    `;

    try {
      // Fetch avatar details
      const avatarDetails = await Promise.all(
        req.config.avatarIds.map(async (avatarId) => {
          const avatarData = await avatar.get({ id: avatarId });
          return {
            id: avatarData.id,
            name: avatarData.name,
            physicalTraits: avatarData.physicalTraits,
            personalityTraits: avatarData.personalityTraits,
          };
        })
      );

      // Generate story content using AI
      const generatedStory = await generateStoryContent({
        config: req.config,
        avatarDetails,
      });

      // Update story with generated content
      await storyDB.exec`
        UPDATE stories 
        SET title = ${generatedStory.title}, 
            description = ${generatedStory.description},
            cover_image_url = ${generatedStory.coverImageUrl},
            metadata = ${JSON.stringify(generatedStory.metadata)},
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

      // Return the complete story
      const story = await getCompleteStory(id);
      return story;

    } catch (error) {
      // Update story status to error
      await storyDB.exec`
        UPDATE stories 
        SET status = 'error',
            updated_at = ${new Date()}
        WHERE id = ${id}
      `;
      
      throw error;
    }
  }
);

async function getCompleteStory(storyId: string): Promise<Story> {
  const storyRow = await storyDB.queryRow<{
    id: string;
    user_id: string;
    title: string;
    description: string;
    cover_image_url: string | null;
    config: string;
    metadata: string | null;
    status: "generating" | "complete" | "error";
    created_at: Date;
    updated_at: Date;
  }>`
    SELECT * FROM stories WHERE id = ${storyId}
  `;

  if (!storyRow) {
    throw new Error("Story not found");
  }

  const chapterRows = await storyDB.queryAll<{
    id: string;
    title: string;
    content: string;
    image_url: string | null;
    chapter_order: number;
  }>`
    SELECT id, title, content, image_url, chapter_order 
    FROM chapters 
    WHERE story_id = ${storyId} 
    ORDER BY chapter_order
  `;

  return {
    id: storyRow.id,
    userId: storyRow.user_id,
    title: storyRow.title,
    description: storyRow.description,
    coverImageUrl: storyRow.cover_image_url || undefined,
    config: JSON.parse(storyRow.config),
    metadata: storyRow.metadata ? JSON.parse(storyRow.metadata) : undefined,
    chapters: chapterRows.map(ch => ({
      id: ch.id,
      title: ch.title,
      content: ch.content,
      imageUrl: ch.image_url || undefined,
      order: ch.chapter_order,
    })),
    status: storyRow.status,
    createdAt: storyRow.created_at,
    updatedAt: storyRow.updated_at,
  };
}
