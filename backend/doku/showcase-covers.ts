/**
 * Cover catalog for marketing material (promo video cover wall).
 *
 * Read-only, served behind the automation key (see audio-automation.ts). Only
 * content that may appear in public advertising is listed:
 *   - audio dokus and text dokus that are published (is_public = true);
 *   - stories only from the accounts named in SHOWCASE_STORY_USER_IDS
 *     (comma separated user ids, e.g. the operator's own account). Stories of
 *     other families are never listed, even when they are public in the app.
 */

import { SQLDatabase } from "encore.dev/storage/sqldb";

import { resolveImageUrlForClient } from "../helpers/bucket-storage";

const dokuDB = SQLDatabase.named("doku");
const storyDB = SQLDatabase.named("story");

const MAX_PER_KIND = 300;
// Long enough for a download script to fetch every image in one go.
const COVER_URL_TTL_SECONDS = 6 * 60 * 60;

export interface ShowcaseCover {
  id: string;
  title: string;
  coverImageUrl: string;
  category?: string;
  createdAt: Date;
}

export interface ShowcaseCovers {
  audioDokus: ShowcaseCover[];
  dokus: ShowcaseCover[];
  stories: ShowcaseCover[];
}

interface CoverRow {
  id: string;
  title: string;
  cover_image_url: string;
  category: string | null;
  created_at: Date;
}

function showcaseStoryUserIds(): string[] {
  return (process.env.SHOWCASE_STORY_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

async function toCovers(rows: CoverRow[]): Promise<ShowcaseCover[]> {
  const covers: ShowcaseCover[] = [];
  for (const row of rows) {
    const coverImageUrl = await resolveImageUrlForClient(row.cover_image_url, COVER_URL_TTL_SECONDS);
    if (!coverImageUrl) continue;
    covers.push({
      id: row.id,
      title: row.title,
      coverImageUrl,
      category: row.category ?? undefined,
      createdAt: row.created_at,
    });
  }
  return covers;
}

export async function loadShowcaseCovers(): Promise<ShowcaseCovers> {
  const audioDokus = await dokuDB.queryAll<CoverRow>`
    SELECT id, title, cover_image_url, category, created_at
    FROM audio_dokus
    WHERE is_public = true AND cover_image_url IS NOT NULL AND cover_image_url <> ''
    ORDER BY created_at DESC
    LIMIT ${MAX_PER_KIND}
  `;
  const dokus = await dokuDB.queryAll<CoverRow>`
    SELECT id, title, cover_image_url, NULL::text AS category, created_at
    FROM dokus
    WHERE is_public = true AND status = 'complete'
      AND cover_image_url IS NOT NULL AND cover_image_url <> ''
    ORDER BY created_at DESC
    LIMIT ${MAX_PER_KIND}
  `;

  const storyUserIds = showcaseStoryUserIds();
  const stories = storyUserIds.length === 0
    ? []
    : await storyDB.queryAll<CoverRow>`
        SELECT id, title, cover_image_url, NULL::text AS category, created_at
        FROM stories
        WHERE user_id = ANY(${storyUserIds}) AND status = 'complete'
          AND cover_image_url IS NOT NULL AND cover_image_url <> ''
        ORDER BY created_at DESC
        LIMIT ${MAX_PER_KIND}
      `;

  return {
    audioDokus: await toCovers(audioDokus),
    dokus: await toCovers(dokus),
    stories: await toCovers(stories),
  };
}
