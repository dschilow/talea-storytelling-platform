import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { avatarDB } from "./db";
import { classifyMemory } from "./memory-ranking";

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
  { expose: false, method: "POST", path: "/avatar/memory", auth: true },
  async (req: AddMemoryRequest): Promise<AddMemoryResponse> => {
    const auth = getAuthData()!;
    const { id, storyId, storyTitle, experience, emotionalImpact, personalityChanges } = req;
    const contentType = normalizeContentType(req.contentType);

    console.log("Adding memory entry", { avatarId: id, contentId: storyId, emotionalImpact, contentType });

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
          profile_id TEXT,
          memory_tier TEXT NOT NULL DEFAULT 'episodic',
          importance SMALLINT NOT NULL DEFAULT 2,
          summary TEXT,
          tags JSONB NOT NULL DEFAULT '[]'::jsonb,
          last_recalled_at TIMESTAMP,
          recall_count INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE CASCADE
        )
      `;
      await avatarDB.exec`ALTER TABLE avatar_memories ADD COLUMN IF NOT EXISTS content_type TEXT NOT NULL DEFAULT 'story'`;
      await avatarDB.exec`ALTER TABLE avatar_memories ADD COLUMN IF NOT EXISTS profile_id TEXT`;
      await avatarDB.exec`ALTER TABLE avatar_memories ADD COLUMN IF NOT EXISTS memory_tier TEXT NOT NULL DEFAULT 'episodic'`;
      await avatarDB.exec`ALTER TABLE avatar_memories ADD COLUMN IF NOT EXISTS importance SMALLINT NOT NULL DEFAULT 2`;
      await avatarDB.exec`ALTER TABLE avatar_memories ADD COLUMN IF NOT EXISTS summary TEXT`;
      await avatarDB.exec`ALTER TABLE avatar_memories ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb`;
      await avatarDB.exec`ALTER TABLE avatar_memories ADD COLUMN IF NOT EXISTS last_recalled_at TIMESTAMP`;
      await avatarDB.exec`ALTER TABLE avatar_memories ADD COLUMN IF NOT EXISTS recall_count INTEGER NOT NULL DEFAULT 0`;
    } catch (tableError) {
      console.error("Error preparing avatar_memories table", tableError);
      throw APIError.internal("Avatar memory storage is not ready.");
    }

    const existingAvatar = await avatarDB.queryRow<{ id: string; user_id: string; profile_id: string | null }>`
      SELECT id, user_id, profile_id FROM avatars WHERE id = ${id}
    `;

    if (!existingAvatar) {
      throw APIError.notFound("Avatar not found");
    }


    if (existingAvatar.user_id !== auth.userID && auth.role !== "admin") {
      throw APIError.permissionDenied("You do not have permission to add memories to this avatar.");
    }

    const classification = classifyMemory({
      storyTitle,
      experience,
      emotionalImpact,
      personalityChanges,
      developmentDescription: req.developmentDescription,
      contentType,
    });
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
        content_type,
        profile_id,
        memory_tier,
        importance,
        summary,
        tags
      )
      VALUES (
        ${memoryId},
        ${id},
        ${storyId},
        ${storyTitle},
        ${experience},
        ${emotionalImpact},
        ${JSON.stringify(personalityChanges)},
        ${contentType},
        ${existingAvatar.profile_id},
        ${classification.tier},
        ${classification.importance},
        ${classification.summary},
        ${JSON.stringify(classification.tags)}::jsonb
      )
    `;

    return {
      success: true,
      memoryId,
    };
  }
);
