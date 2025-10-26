import { api } from "encore.dev/api";
import { storyDB } from "./db";

interface RunMigrationResponse {
  success: boolean;
  message: string;
}

// IMPORTANT: This is a one-time endpoint to manually run migration 4
// DELETE THIS FILE after running it once!
export const runMigration4 = api<void, RunMigrationResponse>(
  { expose: true, method: "POST", path: "/story/run-migration-4", auth: false },
  async () => {
    try {
      console.log("[migrate] Running migration 4_add_cost_tracking...");

      await storyDB.exec`
        ALTER TABLE stories ADD COLUMN IF NOT EXISTS tokens_input INTEGER DEFAULT 0;
      `;
      await storyDB.exec`
        ALTER TABLE stories ADD COLUMN IF NOT EXISTS tokens_output INTEGER DEFAULT 0;
      `;
      await storyDB.exec`
        ALTER TABLE stories ADD COLUMN IF NOT EXISTS tokens_total INTEGER DEFAULT 0;
      `;
      await storyDB.exec`
        ALTER TABLE stories ADD COLUMN IF NOT EXISTS cost_input_usd REAL DEFAULT 0;
      `;
      await storyDB.exec`
        ALTER TABLE stories ADD COLUMN IF NOT EXISTS cost_output_usd REAL DEFAULT 0;
      `;
      await storyDB.exec`
        ALTER TABLE stories ADD COLUMN IF NOT EXISTS cost_total_usd REAL DEFAULT 0;
      `;
      await storyDB.exec`
        ALTER TABLE stories ADD COLUMN IF NOT EXISTS cost_mcp_usd REAL DEFAULT 0;
      `;
      await storyDB.exec`
        ALTER TABLE stories ADD COLUMN IF NOT EXISTS model_used TEXT DEFAULT 'gpt-5-mini';
      `;

      console.log("[migrate] ✅ Migration 4 completed successfully!");

      return {
        success: true,
        message: "Migration 4 completed successfully. All cost tracking columns added.",
      };
    } catch (error) {
      console.error("[migrate] ❌ Migration failed:", error);
      return {
        success: false,
        message: `Migration failed: ${error}`,
      };
    }
  }
);
