/**
 * Storybook Pipeline — repeat protection.
 *
 * A child who recognises the story stops listening. So the pipeline remembers
 * what this family already got — not by fuzzy motif keywords (which is what the
 * old engine did, and which produced 39 banned words and premises contorted
 * around them) but by the exact premise id and variant key it dealt last time.
 *
 * Exact keys mean the exclusion can be hard instead of a soft penalty, and the
 * planner never has to be told "avoid the word Laterne".
 */

import { storyDB } from "../db";

export interface StorybookHistory {
  /** Premise ids used in this user's recent stories, newest first. */
  premiseIds: string[];
  /** Exact variant keys already dealt — never repeated while unused ones exist. */
  variantKeys: Set<string>;
  /** Titles, used only for a final "too similar" sanity check. */
  recentTitles: string[];
}

const EMPTY_HISTORY: StorybookHistory = {
  premiseIds: [],
  variantKeys: new Set<string>(),
  recentTitles: [],
};

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

/**
 * Loads what this user has already read. Best-effort: a failure here must never
 * block generation, it only weakens the rotation for one story.
 */
export async function loadStorybookHistory(input: {
  userId?: string;
  currentStoryId?: string;
  limit?: number;
}): Promise<StorybookHistory> {
  if (!input.userId) return EMPTY_HISTORY;

  try {
    const currentStoryId = input.currentStoryId || "";
    const rows = await storyDB.queryAll<{ id: string; title: string | null; metadata: any }>`
      SELECT id, title, metadata
      FROM stories
      WHERE user_id = ${input.userId}
        AND (${currentStoryId} = '' OR id <> ${currentStoryId})
      ORDER BY created_at DESC
      LIMIT ${Math.max(10, Math.min(120, input.limit ?? 60))}
    `;

    const premiseIds: string[] = [];
    const variantKeys = new Set<string>();
    const recentTitles: string[] = [];

    for (const row of rows) {
      const metadata = parseMetadata(row.metadata);
      const premiseId = String(metadata?.storybook?.premiseId || "").trim();
      const variantKey = String(metadata?.storybook?.variantKey || "").trim();
      if (premiseId) premiseIds.push(premiseId);
      if (variantKey) variantKeys.add(variantKey);
      const title = String(row.title || "").trim();
      if (title) recentTitles.push(title);
    }

    return { premiseIds, variantKeys, recentTitles: recentTitles.slice(0, 20) };
  } catch (err) {
    console.warn("[storybook/history] could not load story history, continuing without it:", err);
    return EMPTY_HISTORY;
  }
}

/**
 * The premise ids to keep out of the current draw. We block the last N rather
 * than everything ever used: with 22 premises, blocking all history would empty
 * the bank for a heavy user. Blocking the most recent third guarantees a child
 * never meets the same structure twice in a row, while the variant layer keeps
 * even the eventual return unrecognisable.
 */
export function recentlyUsedPremiseIds(history: StorybookHistory, bankSize: number): string[] {
  const blockCount = Math.max(3, Math.floor(bankSize / 3));
  return history.premiseIds.slice(0, blockCount);
}
