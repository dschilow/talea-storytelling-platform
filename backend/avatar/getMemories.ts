import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { avatarDB } from "./db";

type MemoryContentType = "story" | "doku" | "quiz" | "activity";
type MemoryTier = "working" | "episodic" | "core";

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
  memoryTier: MemoryTier;
  importance: number;
  summary: string;
  tags: string[];
  isPinned: boolean;
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

function normalizeMemoryTier(value?: string): MemoryTier {
  if (value === "working" || value === "core") {
    return value;
  }
  return "episodic";
}

function parsePersonalityChanges(source: string | null): Array<{ trait: string; change: number }> {
  if (!source) return [];

  try {
    const parsed = JSON.parse(source);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const rawTrait = (entry as { trait?: unknown }).trait;
        const rawChange = (entry as { change?: unknown }).change;
        if (typeof rawTrait !== "string") return null;

        return {
          trait: rawTrait,
          change: typeof rawChange === "number" && Number.isFinite(rawChange) ? rawChange : 0,
        };
      })
      .filter((entry): entry is { trait: string; change: number } => entry !== null);
  } catch {
    return [];
  }
}

function parseTags(source: unknown): string[] {
  if (Array.isArray(source)) {
    return source.filter((entry): entry is string => typeof entry === "string").slice(0, 8);
  }
  if (typeof source !== "string") return [];

  try {
    const parsed = JSON.parse(source);
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string").slice(0, 8)
      : [];
  } catch {
    return [];
  }
}

async function ensureMemoryReadSchema(): Promise<void> {
  await avatarDB.exec`
    CREATE TABLE IF NOT EXISTS avatar_memories (
      id TEXT PRIMARY KEY,
      avatar_id TEXT NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
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
      is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await avatarDB.exec`ALTER TABLE avatar_memories ADD COLUMN IF NOT EXISTS content_type TEXT NOT NULL DEFAULT 'story'`;
  await avatarDB.exec`ALTER TABLE avatar_memories ADD COLUMN IF NOT EXISTS profile_id TEXT`;
  await avatarDB.exec`ALTER TABLE avatar_memories ADD COLUMN IF NOT EXISTS memory_tier TEXT NOT NULL DEFAULT 'episodic'`;
  await avatarDB.exec`ALTER TABLE avatar_memories ADD COLUMN IF NOT EXISTS importance SMALLINT NOT NULL DEFAULT 2`;
  await avatarDB.exec`ALTER TABLE avatar_memories ADD COLUMN IF NOT EXISTS summary TEXT`;
  await avatarDB.exec`ALTER TABLE avatar_memories ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb`;
  await avatarDB.exec`ALTER TABLE avatar_memories ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE`;
  await avatarDB.exec`
    CREATE INDEX IF NOT EXISTS idx_avatar_memories_retrieval
    ON avatar_memories(avatar_id, is_pinned DESC, importance DESC, created_at DESC)
  `;
}

export const getMemories = api(
  { expose: true, method: "GET", path: "/avatar/:id/memories", auth: true },
  async (req: GetMemoriesRequest): Promise<GetMemoriesResponse> => {
    const auth = getAuthData()!;
    const existingAvatar = await avatarDB.queryRow<{ id: string; user_id: string }>`
      SELECT id, user_id
      FROM avatars
      WHERE id = ${req.id}
      LIMIT 1
    `;

    if (!existingAvatar) {
      throw APIError.notFound("Avatar not found");
    }

    if (existingAvatar.user_id !== auth.userID && auth.role !== "admin") {
      throw APIError.permissionDenied("You do not have permission to view this avatar's memories.");
    }

    try {
      await ensureMemoryReadSchema();
    } catch (tableError) {
      console.error("Error preparing avatar_memories table", tableError);
      throw APIError.internal("Avatar memory storage is not ready.");
    }

    const rows = await avatarDB.queryAll<{
      id: string;
      story_id: string | null;
      story_title: string | null;
      experience: string | null;
      emotional_impact: "positive" | "negative" | "neutral" | null;
      personality_changes: string | null;
      content_type: string | null;
      memory_tier: string | null;
      importance: number | null;
      summary: string | null;
      tags: unknown;
      is_pinned: boolean | null;
      created_at: Date | string;
    }>`
      SELECT
        id,
        story_id,
        story_title,
        experience,
        emotional_impact,
        personality_changes,
        content_type,
        memory_tier,
        importance,
        summary,
        tags,
        is_pinned,
        created_at
      FROM avatar_memories
      WHERE avatar_id = ${req.id}
      ORDER BY is_pinned DESC, importance DESC, created_at DESC
      LIMIT 100
    `;

    return {
      memories: rows.map((row) => ({
        id: row.id,
        storyId: row.story_id || "",
        storyTitle: row.story_title || "Erinnerung",
        experience: row.experience || row.summary || "",
        emotionalImpact: row.emotional_impact || "neutral",
        personalityChanges: parsePersonalityChanges(row.personality_changes),
        contentType: normalizeContentType(row.content_type || undefined),
        memoryTier: normalizeMemoryTier(row.memory_tier || undefined),
        importance: Math.max(1, Math.min(5, Number(row.importance || 2))),
        summary: row.summary || row.experience || "",
        tags: parseTags(row.tags),
        isPinned: Boolean(row.is_pinned),
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      })),
    };
  }
);
