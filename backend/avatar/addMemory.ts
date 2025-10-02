import { api, APIError } from "encore.dev/api";
import { avatarDB } from "./db";

export interface PersonalityChange {
  trait: string;
  change: number;
  description?: string; // Why this trait developed
}

export interface AddMemoryRequest {
  id: string; // avatar ID
  storyId: string;
  storyTitle: string;
  experience: string;
  emotionalImpact: 'positive' | 'negative' | 'neutral';
  personalityChanges: PersonalityChange[];
  developmentDescription?: string; // Overall description of character development
  contentType?: 'story' | 'doku'; // Type of content that caused this memory
}

export interface AddMemoryResponse {
  success: boolean;
  memoryId: string;
}

// Adds a new memory entry for an avatar
export const addMemory = api(
  { expose: true, method: "POST", path: "/avatar/memory", auth: true },
  async (req: AddMemoryRequest): Promise<AddMemoryResponse> => {
    const { id } = req;
    const { storyId, storyTitle, experience, emotionalImpact, personalityChanges } = req;

    console.log(`🧠 Adding memory for avatar ${id}:`, { storyId, storyTitle, emotionalImpact });

    // Create avatar_memories table if it doesn't exist
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
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE CASCADE
        )
      `;
      console.log(`✅ avatar_memories table ready for addMemory`);
    } catch (tableError) {
      console.error(`❌ Error creating table in addMemory:`, tableError);
    }

    // Check if avatar exists
    const existingAvatar = await avatarDB.queryRow<{ id: string }>`
      SELECT id FROM avatars WHERE id = ${id}
    `;

    if (!existingAvatar) {
      throw APIError.notFound("Avatar not found");
    }

    // Check for duplicate memory (same avatar + story combination)
    const existingMemory = await avatarDB.queryRow<{ id: string }>`
      SELECT id FROM avatar_memories WHERE avatar_id = ${id} AND story_id = ${storyId}
    `;

    if (existingMemory) {
      console.log(`⚠️ Memory already exists for avatar ${id} and story ${storyId}`);
      return {
        success: true,
        memoryId: existingMemory.id
      };
    }

    // Generate unique memory ID
    const memoryId = `memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Insert memory record
    await avatarDB.exec`
      INSERT INTO avatar_memories (id, avatar_id, story_id, story_title, experience, emotional_impact, personality_changes)
      VALUES (${memoryId}, ${id}, ${storyId}, ${storyTitle}, ${experience}, ${emotionalImpact}, ${JSON.stringify(personalityChanges)})
    `;

    console.log(`✅ Memory added successfully for avatar ${id}: ${memoryId}`);

    return {
      success: true,
      memoryId
    };
  }
);