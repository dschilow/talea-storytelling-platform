import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";

const personalityDB = new SQLDatabase("personality_tracking", {
  migrations: "./migrations",
});

export interface TrackPersonalityUpdateRequest {
  avatarId: string;
  contentId: string; // story or doku ID
  contentType: "story" | "doku" | "quiz";
  contentTitle: string;
  changes: Array<{
    trait: string;
    oldValue: number;
    newValue: number;
    change: number;
    reason: string;
  }>;
}

export interface CheckPersonalityUpdateRequest {
  avatarId: string;
  contentId: string;
  contentType: "story" | "doku" | "quiz";
}

// Track that an avatar received personality updates from content
export const trackPersonalityUpdate = api<TrackPersonalityUpdateRequest, { success: boolean }>(
  { expose: true, method: "POST", path: "/ai/track-personality-update" },
  async (req) => {
    try {
      const now = new Date();
      const updateId = crypto.randomUUID();
      
      await personalityDB.exec`
        INSERT INTO personality_updates (
          id, avatar_id, content_id, content_type, content_title, 
          changes_json, created_at
        ) VALUES (
          ${updateId}, ${req.avatarId}, ${req.contentId}, ${req.contentType}, 
          ${req.contentTitle}, ${JSON.stringify(req.changes)}, ${now}
        )
      `;
      
      console.log(`✅ Tracked personality update: Avatar ${req.avatarId} from ${req.contentType} ${req.contentId}`);
      
      return { success: true };
    } catch (error) {
      console.error("❌ Error tracking personality update:", error);
      return { success: false };
    }
  }
);

// Check if avatar already received updates from this content
export const checkPersonalityUpdate = api<CheckPersonalityUpdateRequest, { hasUpdates: boolean; lastUpdate?: Date }>(
  { expose: true, method: "GET", path: "/ai/check-personality-update" },
  async (req) => {
    const { avatarId, contentId, contentType } = req;
    try {
      const existing = await personalityDB.queryRow<{
        created_at: Date;
      }>`
        SELECT created_at 
        FROM personality_updates 
        WHERE avatar_id = ${avatarId} 
          AND content_id = ${contentId} 
          AND content_type = ${contentType}
        ORDER BY created_at DESC 
        LIMIT 1
      `;
      
      if (existing) {
        console.log(`⚠️ Avatar ${avatarId} already has updates from ${contentType} ${contentId}`);
        return { 
          hasUpdates: true, 
          lastUpdate: existing.created_at 
        };
      }
      
      return { hasUpdates: false };
    } catch (error) {
      console.error("❌ Error checking personality update:", error);
      return { hasUpdates: false };
    }
  }
);

// Get all personality updates for an avatar (for history/debugging)
export const getPersonalityHistory = api<{ avatarId: string }, { 
  updates: Array<{
    id: string;
    contentId: string;
    contentType: string;
    contentTitle: string;
    changes: Array<{
      trait: string;
      oldValue: number;
      newValue: number; 
      change: number;
      reason: string;
    }>;
    createdAt: Date;
  }>
}>(
  { expose: true, method: "GET", path: "/ai/personality-history/:avatarId" },
  async (req) => {
    try {
      const updates = await personalityDB.queryAll<{
        id: string;
        content_id: string;
        content_type: string;
        content_title: string;
        changes_json: string;
        created_at: Date;
      }>`
        SELECT id, content_id, content_type, content_title, changes_json, created_at
        FROM personality_updates 
        WHERE avatar_id = ${req.avatarId}
        ORDER BY created_at DESC
      `;
      
      return {
        updates: updates.map(update => ({
          id: update.id,
          contentId: update.content_id,
          contentType: update.content_type,
          contentTitle: update.content_title,
          changes: JSON.parse(update.changes_json),
          createdAt: update.created_at
        }))
      };
    } catch (error) {
      console.error("❌ Error getting personality history:", error);
      return { updates: [] };
    }
  }
);