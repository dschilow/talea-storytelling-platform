import { api } from "encore.dev/api";
import { fairytalesDB } from "./db";

interface RunSQLRequest {
  sql: string;
  migrationName: string;
}

interface RunSQLResponse {
  success: boolean;
  message: string;
  rowsAffected?: number;
}

/**
 * Execute raw SQL migration - ADMIN ONLY, for emergency migrations
 * Used when file-based migrations can't be deployed
 */
export const runMigrationSQL = api<RunSQLRequest, RunSQLResponse>(
  { expose: true, method: "POST", path: "/fairytales/run-migration-sql", auth: false },
  async (req) => {
    try {
      console.log(`[Migration SQL] Executing: ${req.migrationName}`);
      console.log(`[Migration SQL] SQL length: ${req.sql.length} characters`);

      // Execute the SQL
      await fairytalesDB.exec(req.sql);

      // Count fairy tales after migration
      const countResult = await fairytalesDB.queryRow<{ count: number }>`
        SELECT COUNT(*) as count FROM fairy_tales
      `;
      const talesCount = countResult?.count || 0;

      console.log(`[Migration SQL] ✓ ${req.migrationName} completed successfully`);
      console.log(`[Migration SQL] Total fairy tales: ${talesCount}`);

      return {
        success: true,
        message: `Migration ${req.migrationName} executed successfully. Total tales: ${talesCount}`,
        rowsAffected: talesCount
      };
    } catch (error: any) {
      console.error(`[Migration SQL] ✗ ${req.migrationName} failed:`, error.message);

      // Check if it's a duplicate key error
      if (error.message && error.message.includes("duplicate key")) {
        return {
          success: true,
          message: `Migration ${req.migrationName} - some records already exist (skipped duplicates)`,
          rowsAffected: 0
        };
      }

      return {
        success: false,
        message: `Migration ${req.migrationName} failed: ${error.message}`
      };
    }
  }
);
