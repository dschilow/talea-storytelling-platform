import { api } from "encore.dev/api";
import { storyDB } from "./db";

interface TestArtifactsResponse {
  count: number;
  sampleArtifacts: Array<{
    id: string;
    name_de: string;
    category: string;
    rarity: string;
  }>;
}

/**
 * Test endpoint to verify artifact_pool table exists and has data
 */
export const testArtifacts = api<void, TestArtifactsResponse>(
  { expose: true, method: "GET", path: "/story/test-artifacts", auth: false },
  async () => {
    try {
      // Count total artifacts
      const countResult = await storyDB.queryRow<{ count: number }>`
        SELECT COUNT(*)::int as count FROM artifact_pool
      `;

      // Get 5 sample artifacts
      const samples = await storyDB.queryAll<{
        id: string;
        name_de: string;
        category: string;
        rarity: string;
      }>`
        SELECT id, name_de, category, rarity
        FROM artifact_pool
        LIMIT 5
      `;

      return {
        count: countResult?.count || 0,
        sampleArtifacts: samples,
      };
    } catch (error: any) {
      console.error("[Test Artifacts] Error:", error);
      throw new Error(`Failed to test artifacts: ${error.message}`);
    }
  }
);
