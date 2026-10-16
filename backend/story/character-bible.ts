/**
 * The character bible of the pool — the Encore side (2026-10-16, "Die Türlaunische").
 *
 * The pure part (reading a bible off a row, the prompt, the parser, the loop over rows) lives in
 * character-bible-core.ts so the tests can load it. This file holds the admin endpoint that fills the
 * missing bibles with one cheap support-model call each (about 0.1 ct a figure), idempotent on bible_version.
 */

import { api } from "encore.dev/api";
import { ensureAdmin } from "../admin/authz";
import { storyDB } from "./db";
import { enrichBibleRows, type CharacterBible, type EnrichBiblesResult } from "./character-bible-core";
import { createOpenRouterStorybookLlm } from "./storybook/llm-openrouter";

export interface EnrichBiblesRequest {
  /** Only these pool ids; default: every active figure without a bible. */
  ids?: string[];
  /** At most this many figures in one call (default 40). */
  limit?: number;
  /** Also rewrite figures that already have a bible. */
  force?: boolean;
}

async function ensureBibleColumns(): Promise<void> {
  await storyDB.exec`
    ALTER TABLE character_pool
      ADD COLUMN IF NOT EXISTS want TEXT,
      ADD COLUMN IF NOT EXISTS fear TEXT,
      ADD COLUMN IF NOT EXISTS secret TEXT,
      ADD COLUMN IF NOT EXISTS running_gag TEXT,
      ADD COLUMN IF NOT EXISTS gesture TEXT,
      ADD COLUMN IF NOT EXISTS comic_role TEXT,
      ADD COLUMN IF NOT EXISTS can_lead BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS can_oppose BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS villain_style TEXT,
      ADD COLUMN IF NOT EXISTS intro_line TEXT,
      ADD COLUMN IF NOT EXISTS signature_visual TEXT,
      ADD COLUMN IF NOT EXISTS bible_version INTEGER NOT NULL DEFAULT 0
  `;
}

export async function writeBible(id: string, bible: CharacterBible): Promise<void> {
  await storyDB.exec`
    UPDATE character_pool SET
      want = ${bible.want}, fear = ${bible.fear}, secret = ${bible.secret || null}, running_gag = ${bible.runningGag},
      gesture = ${bible.gesture}, comic_role = ${bible.comicRole}, can_lead = ${bible.canLead}, can_oppose = ${bible.canOppose},
      villain_style = ${bible.villainStyle || null}, intro_line = ${bible.introLine}, signature_visual = ${bible.signatureVisual},
      bible_version = 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
  `;
}

/**
 * Fills the character bible of every active figure that has none (bible_version 0), one support-model call each.
 * Idempotent; `force` rewrites, `ids` narrows, `limit` bounds one call. Admin only.
 */
export const enrichCharacterBibles = api<EnrichBiblesRequest, EnrichBiblesResult>(
  { expose: true, method: "POST", path: "/story/character-pool/enrich-bibles", auth: true },
  async (req): Promise<EnrichBiblesResult> => {
    ensureAdmin();
    await ensureBibleColumns();
    const limit = Math.max(1, Math.min(200, Math.round(Number(req.limit)) || 40));
    const ids = (req.ids || []).map((id) => String(id).trim()).filter(Boolean);
    const force = req.force === true;
    const all = ids.length === 0;
    const rows = await storyDB.queryAll<Record<string, any>>`
      SELECT * FROM character_pool
      WHERE is_active = TRUE
        AND (${force} OR COALESCE(bible_version, 0) = 0)
        AND (${all} OR id = ANY(${ids}))
      ORDER BY total_usage_count DESC NULLS LAST, name
      LIMIT ${limit}
    `;
    console.log(`[CharacterBible] enriching ${rows.length} figure(s)${force ? " (force)" : ""}`);
    const result = await enrichBibleRows(rows, createOpenRouterStorybookLlm(), writeBible);
    console.log(`[CharacterBible] enriched ${result.enriched.length}, failed ${result.failed.length}, cost $${result.costUSD}`);
    return result;
  }
);
