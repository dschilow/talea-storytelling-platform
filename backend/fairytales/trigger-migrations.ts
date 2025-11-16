import { api } from "encore.dev/api";
import { fairytalesDB } from "./db";

/**
 * Trigger fairy tales migrations by accessing the database
 * This forces Encore to run pending migrations
 */
export const triggerMigrations = api(
  { expose: true, method: "GET", path: "/fairytales/trigger-migrations", auth: false },
  async (): Promise<{ success: boolean; taleCount: number; message: string }> => {
    try {
      console.log("🔄 Triggering fairy tales migrations by accessing database...");

      // Access the database - this will trigger Encore to run migrations
      const result = await fairytalesDB.queryRow<{ count: number }>`
        SELECT COUNT(*) as count FROM fairy_tales
      `;

      const count = result?.count || 0;

      console.log(`✅ Database accessible. Current fairy tale count: ${count}`);

      return {
        success: true,
        taleCount: count,
        message: `Migrations triggered. Found ${count} fairy tales in database.`
      };
    } catch (error: any) {
      console.error("❌ Error accessing fairy tales database:", error);

      return {
        success: false,
        taleCount: 0,
        message: `Error: ${error.message}`
      };
    }
  }
);
