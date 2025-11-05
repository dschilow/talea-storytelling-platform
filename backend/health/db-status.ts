import { api } from "encore.dev/api";
import { storyDB } from "../story/db";
import { avatarDB } from "../avatar/db";
import { fairytalesDB } from "../fairytales/db";

export interface DatabaseStatusResponse {
  status: string;
  timestamp: string;
  tables: {
    stories: boolean;
    avatars: boolean;
    fairyTales: boolean;
    fairyTaleRoles: boolean;
    fairyTaleScenes: boolean;
  };
  counts: {
    stories?: number;
    avatars?: number;
    fairyTales?: number;
  };
  error?: string;
}

/**
 * Database status check endpoint
 * Shows which tables exist and basic counts
 */
export const dbStatus = api(
  { expose: true, method: "GET", path: "/health/db-status", auth: false },
  async (): Promise<DatabaseStatusResponse> => {
    const tables = {
      stories: false,
      avatars: false,
      fairyTales: false,
      fairyTaleRoles: false,
      fairyTaleScenes: false,
    };

    const counts: {
      stories?: number;
      avatars?: number;
      fairyTales?: number;
    } = {};

    let error: string | undefined;

    try {
      // Check stories table
      try {
        const storiesResult = await storyDB.queryRow<{ count: string }>`SELECT COUNT(*) as count FROM stories`;
        tables.stories = true;
        counts.stories = storiesResult ? parseInt(storiesResult.count) : 0;
      } catch (err) {
        console.log('Stories table not found:', err);
      }

      // Check avatars table
      try {
        const avatarsResult = await avatarDB.queryRow<{ count: string }>`SELECT COUNT(*) as count FROM avatars`;
        tables.avatars = true;
        counts.avatars = avatarsResult ? parseInt(avatarsResult.count) : 0;
      } catch (err) {
        console.log('Avatars table not found:', err);
      }

      // Check fairy_tales table
      try {
        const fairyTalesResult = await fairytalesDB.queryRow<{ count: string }>`SELECT COUNT(*) as count FROM fairy_tales`;
        tables.fairyTales = true;
        counts.fairyTales = fairyTalesResult ? parseInt(fairyTalesResult.count) : 0;
      } catch (err: any) {
        console.error('Fairy tales table error:', err.message);
        error = error ? `${error}; fairy_tales: ${err.message}` : `fairy_tales: ${err.message}`;
      }

      // Check fairy_tale_roles table
      try {
        await fairytalesDB.query`SELECT 1 FROM fairy_tale_roles LIMIT 1`;
        tables.fairyTaleRoles = true;
      } catch (err) {
        console.log('Fairy tale roles table not found:', err);
      }

      // Check fairy_tale_scenes table
      try {
        await fairytalesDB.query`SELECT 1 FROM fairy_tale_scenes LIMIT 1`;
        tables.fairyTaleScenes = true;
      } catch (err) {
        console.log('Fairy tale scenes table not found:', err);
      }

    } catch (err: any) {
      error = err.message;
    }

    return {
      status: Object.values(tables).some(t => t) ? 'partial' : 'no-tables',
      timestamp: new Date().toISOString(),
      tables,
      counts,
      error,
    };
  }
);
