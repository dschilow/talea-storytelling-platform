import { api, APIError } from "encore.dev/api";
import { avatarDB } from "./db";

type MemoryContentType = "story" | "doku" | "quiz" | "activity";

export interface PersonalityChange {
  trait: string;
  change: number;
  description?: string;
}

export interface AddMemoryRequest {
  id: string;
  storyId: string;
  storyTitle: string;
  experience: string;
  emotionalImpact: "positive" | "negative" | "neutral";
  personalityChanges: PersonalityChange[];
  developmentDescription?: string;
  contentType?: MemoryContentType;
}

export interface AddMemoryResponse {
  success: boolean;
  memoryId: string;
}

function normalizeContentType(value?: string): MemoryContentType {
  if (value === "doku" || value === "quiz" || value === "activity") {
    return value;
  }
  return "story";
}

export const addMemory = api(
  { expose: true, method: "POST", path: "/avatar/memory", auth: true },
  async (req: AddMemoryRequest): Promise<AddMemoryResponse> => {
    const { id, storyId, storyTitle, experience, emotionalImpact, personalityChanges } = req;
    const contentType = normalizeContentType(req.contentType);

    console.log("Adding memory entry", { id, storyId, storyTitle, emotionalImpact, contentType });

    try {
      await avatarDB.exec`
        CREATE TABLE IF NOT EXISTS avatar_memories (
          id TEXT PRIMARY KEY,
          avatar_id TEXT NOT NULL,
          story_id TEXT,
          story_title TEXT,
          experience TEXT,
          emotional_impact TEXT CHECK (emotional_impact IN ('positive', 'negative', 'neutral')),
          personality_changes TEXT,
          content_type TEXT NOT NULL DEFAULT 'story',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE CASCADE
        )
      `;

      await avatarDB.exec`
        ALTER TABLE avatar_memories
        ADD COLUMN IF NOT EXISTS content_type TEXT NOT NULL DEFAULT 'story'
      `;
    } catch (tableError) {
      console.error("Error preparing avatar_memories table", tableError);
    }

    const existingAvatar = await avatarDB.queryRow<{ id: string }>`
      SELECT id FROM avatars WHERE id = ${id}
    `;

    if (!existingAvatar) {
      throw APIError.notFound("Avatar not found");
    }

    const existingMemory = await avatarDB.queryRow<{ id: string }>`
      SELECT id
      FROM avatar_memories
      WHERE avatar_id = ${id}
        AND content_type = ${contentType}
        AND story_id = ${storyId}
    `;

    if (existingMemory) {
      return {
        success: true,
        memoryId: existingMemory.id,
      };
    }

    const memoryId = `memory_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    await avatarDB.exec`
      INSERT INTO avatar_memories (
        id,
        avatar_id,
        story_id,
        story_title,
        experience,
        emotional_impact,
        personality_changes,
        content_type
      )
      VALUES (
        ${memoryId},
        ${id},
        ${storyId},
        ${storyTitle},
        ${experience},
        ${emotionalImpact},
        ${JSON.stringify(personalityChanges)},
        ${contentType}
      )
    `;

    return {
      success: true,
      memoryId,
    };
  }
);
