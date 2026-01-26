import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { ensureAdmin } from "./authz";
import { isBucketImageUrl, maybeUploadImageUrlToBucket } from "../helpers/bucket-storage";

const avatarDB = SQLDatabase.named("avatar");
const storyDB = SQLDatabase.named("story");
const dokuDB = SQLDatabase.named("doku");

interface MigrateImagesRequest {
  dryRun?: boolean;
  include?: string[];
  limitPerTable?: number;
  batchSize?: number;
}

interface TableMigrationError {
  id: string;
  error: string;
}

interface TableMigrationResult {
  table: string;
  scanned: number;
  migrated: number;
  skipped: number;
  failed: number;
  hasMore: boolean;
  errors: TableMigrationError[];
}

interface MigrateImagesResponse {
  dryRun: boolean;
  tables: TableMigrationResult[];
  totals: {
    scanned: number;
    migrated: number;
    skipped: number;
    failed: number;
  };
}

type RowWithImage = { id: string; image_url: string | null; [key: string]: any };

async function migrateTableRows(options: {
  table: string;
  batchSize: number;
  maxRowsPerTable: number | null;
  dryRun: boolean;
  fetchPage: (cursor: string | null, limit: number) => Promise<RowWithImage[]>;
  updateRow: (row: RowWithImage, newUrl: string) => Promise<void>;
  prefix: string;
  filenameHint: (row: RowWithImage) => string;
}): Promise<TableMigrationResult> {
  const result: TableMigrationResult = {
    table: options.table,
    scanned: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
    hasMore: false,
    errors: [],
  };

  let cursor: string | null = null;
  let processed = 0;

  while (true) {
    const remaining = options.maxRowsPerTable !== null
      ? options.maxRowsPerTable - processed
      : null;
    if (remaining !== null && remaining <= 0) {
      result.hasMore = true;
      break;
    }

    const limit = remaining !== null
      ? Math.min(options.batchSize, remaining)
      : options.batchSize;

    const rows = await options.fetchPage(cursor, limit);
    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      if (options.maxRowsPerTable !== null && processed >= options.maxRowsPerTable) {
        result.hasMore = true;
        break;
      }

      processed += 1;
      result.scanned += 1;

      const imageUrl = row.image_url;
      if (!imageUrl) {
        result.skipped += 1;
        continue;
      }

      if (await isBucketImageUrl(imageUrl)) {
        result.skipped += 1;
        continue;
      }

      if (options.dryRun) {
        result.migrated += 1;
        continue;
      }

      const uploaded = await maybeUploadImageUrlToBucket(imageUrl, {
        prefix: options.prefix,
        filenameHint: options.filenameHint(row),
        uploadMode: "always",
      });

      if (!uploaded) {
        result.failed += 1;
        result.errors.push({
          id: row.id,
          error: "Upload failed or bucket not configured",
        });
        continue;
      }

      try {
        await options.updateRow(row, uploaded.url);
        result.migrated += 1;
      } catch (error) {
        result.failed += 1;
        result.errors.push({
          id: row.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (options.maxRowsPerTable !== null && processed >= options.maxRowsPerTable) {
      result.hasMore = true;
      break;
    }

    cursor = rows[rows.length - 1]?.id ?? cursor;
  }

  return result;
}

export const migrateImages = api<MigrateImagesRequest, MigrateImagesResponse>(
  { expose: true, method: "POST", path: "/admin/migrate-images", auth: true },
  async (req) => {
    ensureAdmin();

    const requestedInclude = (req.include ?? []).map((entry) => entry.trim().toLowerCase()).filter(Boolean);
    const defaultInclude = ["character_pool", "artifact_pool"];
    const include = new Set((requestedInclude.length > 0 ? requestedInclude : defaultInclude));
    const shouldRun = (name: string) => include.size === 0 || include.has(name);

    const batchSize = Math.max(1, Math.min(req.batchSize ?? 50, 500));
    const maxRowsPerTable = req.limitPerTable && req.limitPerTable > 0 ? req.limitPerTable : null;
    const dryRun = Boolean(req.dryRun);

    const results: TableMigrationResult[] = [];

    if (shouldRun("avatars")) {
      results.push(await migrateTableRows({
        table: "avatars.image_url",
        batchSize,
        maxRowsPerTable,
        dryRun,
        fetchPage: async (cursor, limit) => avatarDB.queryAll<RowWithImage>`
          SELECT id, image_url
          FROM avatars
          WHERE image_url IS NOT NULL
            AND (${cursor} IS NULL OR id > ${cursor})
          ORDER BY id
          LIMIT ${limit}
        `,
        updateRow: async (row, newUrl) => {
          await avatarDB.exec`
            UPDATE avatars
            SET image_url = ${newUrl}, updated_at = CURRENT_TIMESTAMP
            WHERE id = ${row.id}
          `;
        },
        prefix: "images/avatars",
        filenameHint: (row) => `avatar-${row.id}`,
      }));
    }

    if (shouldRun("stories")) {
      results.push(await migrateTableRows({
        table: "stories.cover_image_url",
        batchSize,
        maxRowsPerTable,
        dryRun,
        fetchPage: async (cursor, limit) => storyDB.queryAll<RowWithImage>`
          SELECT id, cover_image_url as image_url
          FROM stories
          WHERE cover_image_url IS NOT NULL
            AND (${cursor} IS NULL OR id > ${cursor})
          ORDER BY id
          LIMIT ${limit}
        `,
        updateRow: async (row, newUrl) => {
          await storyDB.exec`
            UPDATE stories
            SET cover_image_url = ${newUrl}, updated_at = CURRENT_TIMESTAMP
            WHERE id = ${row.id}
          `;
        },
        prefix: "images/stories",
        filenameHint: (row) => `story-cover-${row.id}`,
      }));
    }

    if (shouldRun("chapters")) {
      results.push(await migrateTableRows({
        table: "chapters.image_url",
        batchSize,
        maxRowsPerTable,
        dryRun,
        fetchPage: async (cursor, limit) => storyDB.queryAll<RowWithImage>`
          SELECT id, story_id, chapter_order, image_url
          FROM chapters
          WHERE image_url IS NOT NULL
            AND (${cursor} IS NULL OR id > ${cursor})
          ORDER BY id
          LIMIT ${limit}
        `,
        updateRow: async (row, newUrl) => {
          await storyDB.exec`
            UPDATE chapters
            SET image_url = ${newUrl}
            WHERE id = ${row.id}
          `;
        },
        prefix: "images/chapters",
        filenameHint: (row) => `story-${row.story_id}-chapter-${row.chapter_order ?? row.id}`,
      }));
    }

    if (shouldRun("character_pool") || shouldRun("characters")) {
      results.push(await migrateTableRows({
        table: "character_pool.image_url",
        batchSize,
        maxRowsPerTable,
        dryRun,
        fetchPage: async (cursor, limit) => storyDB.queryAll<RowWithImage>`
          SELECT id, image_url
          FROM character_pool
          WHERE image_url IS NOT NULL
            AND (${cursor} IS NULL OR id > ${cursor})
          ORDER BY id
          LIMIT ${limit}
        `,
        updateRow: async (row, newUrl) => {
          await storyDB.exec`
            UPDATE character_pool
            SET image_url = ${newUrl}, updated_at = CURRENT_TIMESTAMP
            WHERE id = ${row.id}
          `;
        },
        prefix: "images/characters",
        filenameHint: (row) => `character-${row.id}`,
      }));
    }

    if (shouldRun("artifact_pool") || shouldRun("artifacts")) {
      results.push(await migrateTableRows({
        table: "artifact_pool.image_url",
        batchSize,
        maxRowsPerTable,
        dryRun,
        fetchPage: async (cursor, limit) => storyDB.queryAll<RowWithImage>`
          SELECT id, image_url
          FROM artifact_pool
          WHERE image_url IS NOT NULL
            AND (${cursor} IS NULL OR id > ${cursor})
          ORDER BY id
          LIMIT ${limit}
        `,
        updateRow: async (row, newUrl) => {
          await storyDB.exec`
            UPDATE artifact_pool
            SET image_url = ${newUrl}, updated_at = CURRENT_TIMESTAMP
            WHERE id = ${row.id}
          `;
        },
        prefix: "images/artifacts",
        filenameHint: (row) => `artifact-${row.id}`,
      }));
    }

    if (shouldRun("dokus")) {
      results.push(await migrateTableRows({
        table: "dokus.cover_image_url",
        batchSize,
        maxRowsPerTable,
        dryRun,
        fetchPage: async (cursor, limit) => dokuDB.queryAll<RowWithImage>`
          SELECT id, cover_image_url as image_url
          FROM dokus
          WHERE cover_image_url IS NOT NULL
            AND (${cursor} IS NULL OR id > ${cursor})
          ORDER BY id
          LIMIT ${limit}
        `,
        updateRow: async (row, newUrl) => {
          await dokuDB.exec`
            UPDATE dokus
            SET cover_image_url = ${newUrl}, updated_at = CURRENT_TIMESTAMP
            WHERE id = ${row.id}
          `;
        },
        prefix: "images/dokus",
        filenameHint: (row) => `doku-${row.id}`,
      }));
    }

    const totals = results.reduce(
      (acc, table) => ({
        scanned: acc.scanned + table.scanned,
        migrated: acc.migrated + table.migrated,
        skipped: acc.skipped + table.skipped,
        failed: acc.failed + table.failed,
      }),
      { scanned: 0, migrated: 0, skipped: 0, failed: 0 }
    );

    return {
      dryRun,
      tables: results,
      totals,
    };
  }
);
