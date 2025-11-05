// Emergency fix: Add usage_count column manually
import { api } from "encore.dev/api";
import { fairytalesDB } from "../fairytales/db";

export const fixUsageCountColumn = api(
  { expose: true, method: "POST", path: "/health/fix-usage-count-column" },
  async (): Promise<{ 
    success: boolean; 
    steps: { step: string; success: boolean; error?: string }[];
  }> => {
    const steps: { step: string; success: boolean; error?: string }[] = [];

    try {
      // Step 1: Check if column exists
      console.log("[Fix] Checking if usage_count column exists...");
      const columnCheck = await fairytalesDB.queryAll<any>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'fairy_tale_usage_stats' 
        AND column_name = 'usage_count'
      `;

      if (columnCheck.length > 0) {
        steps.push({ 
          step: "Check column existence", 
          success: true, 
          error: "Column already exists" 
        });
        
        // Verify it's working
        const test = await fairytalesDB.queryAll<any>`
          SELECT tale_id, usage_count FROM fairy_tale_usage_stats LIMIT 1
        `;
        
        steps.push({ 
          step: "Verify column is readable", 
          success: true 
        });
        
        return { success: true, steps };
      }

      steps.push({ 
        step: "Check column existence", 
        success: true, 
        error: "Column does not exist, proceeding with fix" 
      });

      // Step 2: Drop column if it exists in invalid state
      try {
        await fairytalesDB.exec`
          ALTER TABLE fairy_tale_usage_stats 
          DROP COLUMN IF EXISTS usage_count CASCADE
        `;
        steps.push({ step: "Drop invalid column", success: true });
      } catch (error: any) {
        steps.push({ 
          step: "Drop invalid column", 
          success: false, 
          error: error.message 
        });
      }

      // Step 3: Add usage_count column
      try {
        await fairytalesDB.exec`
          ALTER TABLE fairy_tale_usage_stats 
          ADD COLUMN usage_count INTEGER NOT NULL DEFAULT 0
        `;
        steps.push({ step: "Add usage_count column", success: true });
      } catch (error: any) {
        steps.push({ 
          step: "Add usage_count column", 
          success: false, 
          error: error.message 
        });
        return { success: false, steps };
      }

      // Step 4: Set initial values from total_generations
      try {
        await fairytalesDB.exec`
          UPDATE fairy_tale_usage_stats 
          SET usage_count = COALESCE(total_generations, 0)
        `;
        steps.push({ step: "Set initial values", success: true });
      } catch (error: any) {
        steps.push({ 
          step: "Set initial values", 
          success: false, 
          error: error.message 
        });
      }

      // Step 5: Add index
      try {
        await fairytalesDB.exec`
          CREATE INDEX IF NOT EXISTS idx_fairy_tale_usage_count 
          ON fairy_tale_usage_stats(usage_count)
        `;
        steps.push({ step: "Create index", success: true });
      } catch (error: any) {
        steps.push({ 
          step: "Create index", 
          success: false, 
          error: error.message 
        });
      }

      // Step 6: Verify it's working
      try {
        const test = await fairytalesDB.queryAll<any>`
          SELECT tale_id, usage_count FROM fairy_tale_usage_stats LIMIT 3
        `;
        steps.push({ 
          step: "Verify column works", 
          success: true, 
          error: `Found ${test.length} rows with usage_count` 
        });
      } catch (error: any) {
        steps.push({ 
          step: "Verify column works", 
          success: false, 
          error: error.message 
        });
        return { success: false, steps };
      }

      console.log("[Fix] usage_count column successfully added and verified");
      return { success: true, steps };

    } catch (error: any) {
      console.error("[Fix] Critical error:", error);
      steps.push({ 
        step: "Critical error", 
        success: false, 
        error: error.message 
      });
      return { success: false, steps };
    }
  }
);
