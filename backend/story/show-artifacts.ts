import { api } from "encore.dev/api";
import { storyDB } from "./db";

interface ArtifactSummary {
  totalCount: number;
  byRarity: { rarity: string; count: number }[];
  byCategory: { category: string; count: number }[];
  sampleLegendary: Array<{
    id: string;
    name_de: string;
    name_en: string;
    category: string;
    emoji: string | null;
  }>;
  sampleRare: Array<{
    id: string;
    name_de: string;
    name_en: string;
    category: string;
    emoji: string | null;
  }>;
  allTables: { table_name: string }[];
}

/**
 * Show comprehensive artifact pool data
 * Public endpoint (no auth) to verify database contents
 */
export const showArtifacts = api<void, ArtifactSummary>(
  { expose: true, method: "GET", path: "/story/show-artifacts", auth: false },
  async () => {
    try {
      // Total count
      const countResult = await storyDB.queryRow<{ count: number }>`
        SELECT COUNT(*)::int as count FROM artifact_pool
      `;

      // Count by rarity
      const byRarity = await storyDB.queryAll<{ rarity: string; count: number }>`
        SELECT rarity, COUNT(*)::int as count
        FROM artifact_pool
        GROUP BY rarity
        ORDER BY count DESC
      `;

      // Count by category
      const byCategory = await storyDB.queryAll<{ category: string; count: number }>`
        SELECT category, COUNT(*)::int as count
        FROM artifact_pool
        GROUP BY category
        ORDER BY count DESC
      `;

      // Sample legendary artifacts
      const sampleLegendary = await storyDB.queryAll<{
        id: string;
        name_de: string;
        name_en: string;
        category: string;
        emoji: string | null;
      }>`
        SELECT id, name_de, name_en, category, emoji
        FROM artifact_pool
        WHERE rarity = 'legendary'
        ORDER BY name_de
        LIMIT 5
      `;

      // Sample rare artifacts
      const sampleRare = await storyDB.queryAll<{
        id: string;
        name_de: string;
        name_en: string;
        category: string;
        emoji: string | null;
      }>`
        SELECT id, name_de, name_en, category, emoji
        FROM artifact_pool
        WHERE rarity = 'rare'
        ORDER BY name_de
        LIMIT 5
      `;

      // All tables in database
      const allTables = await storyDB.queryAll<{ table_name: string }>`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `;

      return {
        totalCount: countResult?.count || 0,
        byRarity,
        byCategory,
        sampleLegendary,
        sampleRare,
        allTables,
      };
    } catch (error: any) {
      console.error("[Show Artifacts] Error:", error);
      throw new Error(`Failed to show artifacts: ${error.message}`);
    }
  }
);
