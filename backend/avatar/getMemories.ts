import { api, APIError } from "encore.dev/api";
import { avatarDB } from "./db";

export interface AvatarMemory {
  id: string;
  storyId: string;
  storyTitle: string;
  experience: string;
  emotionalImpact: 'positive' | 'negative' | 'neutral';
  personalityChanges: Array<{
    trait: string;
    change: number;
  }>;
  createdAt: string;
}

export interface GetMemoriesRequest {
  id: string; // avatar ID from path
}

export interface GetMemoriesResponse {
  memories: AvatarMemory[];
}

// Gets all memories for an avatar
export const getMemories = api(
  { expose: true, method: "GET", path: "/avatar/:id/memories", auth: true },
  async (req: GetMemoriesRequest): Promise<GetMemoriesResponse> => {
    try {
      const { id } = req;

      console.log(`🔍 Getting memories for avatar ${id}`);

      // Check if avatar exists
      const existingAvatar = await avatarDB.queryRow<{ id: string }>`
        SELECT id FROM avatars WHERE id = ${id}
      `;

      if (!existingAvatar) {
        console.log(`❌ Avatar ${id} not found`);
        throw APIError.notFound("Avatar not found");
      }

      console.log(`✅ Avatar ${id} exists, checking for memories...`);

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
        
        await avatarDB.exec`
          CREATE INDEX IF NOT EXISTS idx_avatar_memories_avatar_id ON avatar_memories(avatar_id)
        `;
        
        console.log(`✅ avatar_memories table ready`);
      } catch (tableError) {
        console.error(`❌ Error creating table:`, tableError);
        return { memories: [] };
      }

      // Get memories: last 5 stories + last 5 dokus (max 10 total), ordered by creation date (newest first)
      // Stories contain "aktiver Teilnehmer" or "Geschichte", Dokus contain "Doku"
      const memoryRowsGenerator = await avatarDB.query<{
        id: string;
        story_id: string;
        story_title: string;
        experience: string;
        emotional_impact: 'positive' | 'negative' | 'neutral';
        personality_changes: string;
        created_at: string;
      }>`
        WITH stories AS (
          SELECT id, story_id, story_title, experience, emotional_impact, personality_changes, created_at
          FROM avatar_memories
          WHERE avatar_id = ${id}
            AND (experience LIKE '%aktiver Teilnehmer%' OR experience LIKE '%Geschichte%')
            AND experience NOT LIKE '%Doku%'
          ORDER BY created_at DESC
          LIMIT 5
        ),
        dokus AS (
          SELECT id, story_id, story_title, experience, emotional_impact, personality_changes, created_at
          FROM avatar_memories
          WHERE avatar_id = ${id}
            AND experience LIKE '%Doku%'
          ORDER BY created_at DESC
          LIMIT 5
        )
        SELECT * FROM stories
        UNION ALL
        SELECT * FROM dokus
        ORDER BY created_at DESC
      `;

      // Convert AsyncGenerator to Array
      const memoryRows: any[] = [];
      for await (const row of memoryRowsGenerator) {
        memoryRows.push(row);
      }

      console.log(`📊 Found ${memoryRows.length} memory rows for avatar ${id}`, memoryRows);

      const memories: AvatarMemory[] = memoryRows.map(row => {
        console.log(`🔄 Processing memory row:`, { id: row.id, storyTitle: row.story_title });
        return {
          id: row.id,
          storyId: row.story_id,
          storyTitle: row.story_title,
          experience: row.experience,
          emotionalImpact: row.emotional_impact,
          personalityChanges: JSON.parse(row.personality_changes),
          createdAt: row.created_at
        };
      });

      console.log(`✅ Retrieved ${memories.length} memories for avatar ${id}`);

      return { memories };
    } catch (error) {
      console.error(`❌ Error in getMemories for avatar ${req.id}:`, error);
      throw error;
    }
  }
);