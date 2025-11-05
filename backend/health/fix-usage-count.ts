// Emergency endpoint to fix usage_count column on production
import { api } from "encore.dev/api";
import { fairytalesDB } from "../fairytales/db";

interface FixResponse {
  success: boolean;
  message: string;
  error?: string;
}

// GET endpoint (easier to call from browser for quick testing)
export const fixUsageCount = api(
  { expose: true, method: "GET", path: "/health/fix-usage-count" },
  async (): Promise<FixResponse> => {
    try {
      console.log("[fix-usage-count] Starting emergency fix...");

      // Check if column exists using SQLDatabase query
      const rows: any[] = [];
      for await (const row of fairytalesDB.query`
        SELECT EXISTS (
          SELECT 1 
          FROM information_schema.columns 
          WHERE table_name = 'fairy_tale_usage_stats' 
          AND column_name = 'usage_count'
        ) as column_exists
      `) {
        rows.push(row);
      }

      const columnExists = rows[0]?.column_exists;
      console.log(`[fix-usage-count] Column exists: ${columnExists}`);

      if (columnExists) {
        return {
          success: true,
          message: "Column usage_count already exists - no fix needed",
        };
      }

      // Add column
      console.log("[fix-usage-count] Adding usage_count column...");
      await fairytalesDB.exec`
        ALTER TABLE fairy_tale_usage_stats 
        ADD COLUMN usage_count INTEGER NOT NULL DEFAULT 0
      `;

      // Set initial values
      console.log("[fix-usage-count] Setting initial values from total_generations...");
      await fairytalesDB.exec`
        UPDATE fairy_tale_usage_stats 
        SET usage_count = COALESCE(total_generations, 0)
      `;

      // Add index
      console.log("[fix-usage-count] Creating index...");
      await fairytalesDB.exec`
        CREATE INDEX IF NOT EXISTS idx_fairy_tale_usage_count 
        ON fairy_tale_usage_stats(usage_count)
      `;

      console.log("[fix-usage-count] ✅ Fix completed successfully!");

      return {
        success: true,
        message: "Column usage_count successfully added and initialized",
      };
    } catch (error) {
      console.error("[fix-usage-count] ❌ Error:", error);
      return {
        success: false,
        message: "Failed to fix usage_count column",
        error: String(error),
      };
    }
  }
);
