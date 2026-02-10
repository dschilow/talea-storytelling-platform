import { api, APIError } from "encore.dev/api";
import { avatarDB } from "./db";

type MemoryContentType = "story" | "doku" | "quiz" | "activity";

export interface AvatarMemory {
  id: string;
  storyId: string;
  storyTitle: string;
  experience: string;
  emotionalImpact: "positive" | "negative" | "neutral";
  personalityChanges: Array<{
    trait: string;
    change: number;
  }>;
  contentType: MemoryContentType;
  createdAt: string;
}

export interface GetMemoriesRequest {
  id: string;
}

export interface GetMemoriesResponse {
  memories: AvatarMemory[];
}

function normalizeContentType(value?: string): MemoryContentType {
  if (value === "doku" || value === "quiz" || value === "activity") {
    return value;
  }
  return "story";
}

function parsePersonalityChanges(source: string | null): Array<{ trait: string; change: number }> {
  if (!source) {
    return [];
  }

  try {
    const parsed = JSON.parse(source);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return null;
        }

        const rawTrait = (entry as { trait?: unknown }).trait;
        const rawChange = (entry as { change?: unknown }).change;

        if (typeof rawTrait !== "string") {
          return null;
        }

        const numericChange = typeof rawChange === "number" && Number.isFinite(rawChange) ? rawChange : 0;
        return {
          trait: rawTrait,
          change: numericChange,
        };
      })
      .filter((entry): entry is { trait: string; change: number } => entry !== null);
  } catch {
    return [];
  }
}

export const getMemories = api(
  { expose: true, method: "GET", path: "/avatar/:id/memories", auth: true },
  async (req: GetMemoriesRequest): Promise<GetMemoriesResponse> => {
    const { id } = req;

    const existingAvatar = await avatarDB.queryRow<{ id: string }>`
      SELECT id FROM avatars WHERE id = ${id}
    `;

    if (!existingAvatar) {
      throw APIError.notFound("Avatar not found");
    }

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

      await avatarDB.exec`
        CREATE INDEX IF NOT EXISTS idx_avatar_memories_avatar_id ON avatar_memories(avatar_id)
      `;
    } catch (tableError) {
      console.error("Error preparing avatar_memories table", tableError);
      return { memories: [] };
    }

    const memoryRowsGenerator = await avatarDB.query<{
      id: string;
      story_id: string;
      story_title: string;
      experience: string;
      emotional_impact: "positive" | "negative" | "neutral";
      personality_changes: string;
      content_type: string;
      created_at: string;
    }>`
      SELECT
        id,
        story_id,
        story_title,
        experience,
        emotional_impact,
        personality_changes,
        content_type,
        created_at
      FROM avatar_memories
      WHERE avatar_id = ${id}
      ORDER BY created_at DESC
      LIMIT 40
    `;

    const memoryRows: Array<{
      id: string;
      story_id: string;
      story_title: string;
      experience: string;
      emotional_impact: "positive" | "negative" | "neutral";
      personality_changes: string;
      content_type: string;
      created_at: string;
    }> = [];

    for await (const row of memoryRowsGenerator) {
      memoryRows.push(row);
    }

    const memories: AvatarMemory[] = memoryRows.map((row) => ({
      id: row.id,
      storyId: row.story_id,
      storyTitle: row.story_title,
      experience: row.experience,
      emotionalImpact: row.emotional_impact,
      personalityChanges: parsePersonalityChanges(row.personality_changes),
      contentType: normalizeContentType(row.content_type),
      createdAt: row.created_at,
    }));

    return { memories };
  }
);
