/**
 * Storybook Pipeline — repeat protection and continuity.
 *
 * A child who recognises the story stops listening. The concept stage gets
 * one line per recent story of this family (title + logline) and the engines
 * used last, so it can steer away from both the surface and the structure.
 * Each hero's last adventure titles allow at most one small callback.
 */

import { storyDB } from "../db";
import { avatarDB } from "../../avatar/db";

export interface StorybookHistory {
  recentStories: string[];
  recentEngineIds: string[];
}

function parseMetadata(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === "object") return raw as Record<string, any>;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

export async function loadStorybookHistory(input: { userId?: string; currentStoryId?: string }): Promise<StorybookHistory> {
  if (!input.userId) return { recentStories: [], recentEngineIds: [] };
  try {
    const currentStoryId = input.currentStoryId || "";
    const rows = await storyDB.queryAll<{ title: string | null; description: string | null; metadata: any }>`
      SELECT title, description, metadata
      FROM stories
      WHERE user_id = ${input.userId}
        AND (${currentStoryId} = '' OR id <> ${currentStoryId})
      ORDER BY created_at DESC
      LIMIT 8
    `;
    const recentStories: string[] = [];
    const recentEngineIds: string[] = [];
    for (const row of rows) {
      const metadata = parseMetadata(row.metadata);
      const logline = String(metadata?.storybook?.logline || metadata?.bookWorkshop?.premise || row.description || "").replace(/\s+/g, " ").trim();
      const title = String(row.title || "").trim();
      if (title || logline) recentStories.push([title && `„${title}“`, logline].filter(Boolean).join(": ").slice(0, 220));
      const engine = String(metadata?.storybook?.engine || "").trim();
      if (engine) recentEngineIds.push(engine);
    }
    return { recentStories, recentEngineIds };
  } catch (err) {
    console.warn("[storybook/history] could not load story history, continuing without it:", err);
    return { recentStories: [], recentEngineIds: [] };
  }
}

/** The last two story titles each hero remembers. Best-effort. */
export async function loadHeroMemories(avatarIds: string[]): Promise<Record<string, string[]>> {
  const ids = avatarIds.filter(Boolean);
  if (ids.length === 0) return {};
  try {
    const rows = await avatarDB.queryAll<{ avatar_id: string; story_title: string | null }>`
      SELECT avatar_id, story_title FROM (
        SELECT avatar_id, story_title,
               ROW_NUMBER() OVER (PARTITION BY avatar_id ORDER BY created_at DESC) AS n
        FROM avatar_memories
        WHERE avatar_id = ANY(${ids}) AND story_title IS NOT NULL
      ) ranked
      WHERE n <= 2
    `;
    const result: Record<string, string[]> = {};
    for (const row of rows) {
      const title = String(row.story_title || "").trim();
      if (!title) continue;
      (result[row.avatar_id] ||= []).push(title.slice(0, 80));
    }
    return result;
  } catch (err) {
    console.warn("[storybook/history] could not load hero memories:", err);
    return {};
  }
}
