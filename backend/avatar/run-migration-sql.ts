/**
 * Emergency migration endpoint for avatar service.
 * Used to run migrations via API when automatic Encore migrations fail in Railway.
 * Should be re-removed after successful deployment.
 */

import { api } from "encore.dev/api";
import { avatarDB } from "./db";

interface RunMigrationSQLRequest {
  migrationSql: string;
  migrationName: string;
}

interface RunMigrationSQLResponse {
  success: boolean;
  message: string;
  statementsExecuted?: number;
}

export const runMigrationSQL = api<RunMigrationSQLRequest, RunMigrationSQLResponse>(
  { expose: true, method: "POST", path: "/avatar/run-migration-sql", auth: false },
  async (req) => {
    console.log(`[Avatar Migration API] Running: ${req.migrationName}`);
    console.log(`[Avatar Migration API] SQL length: ${req.migrationSql.length} characters`);

    try {
      const statements = req.migrationSql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      console.log(`[Avatar Migration API] Executing ${statements.length} statements...`);

      let executedCount = 0;
      for (const [index, statement] of statements.entries()) {
        try {
          await avatarDB.exec`${statement}`;
          executedCount++;
          if ((index + 1) % 5 === 0) {
            console.log(`[Avatar Migration API] Progress: ${index + 1}/${statements.length}`);
          }
        } catch (error: any) {
          if (
            error.message?.includes('duplicate key') ||
            error.message?.includes('already exists')
          ) {
            console.log(`[Avatar Migration API] Statement ${index + 1} skipped (already exists)`);
            executedCount++;
            continue;
          }
          throw error;
        }
      }

      return {
        success: true,
        message: `Migration ${req.migrationName} completed. Executed ${executedCount}/${statements.length} statements.`,
        statementsExecuted: executedCount,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Migration ${req.migrationName} failed: ${error.message || String(error)}`,
      };
    }
  }
);
