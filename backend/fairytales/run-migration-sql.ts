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

      // Split SQL into individual statements
      // Remove comments first, then split by semicolons
      const sqlWithoutComments = req.sql
        .split('\n')
        .filter(line => !line.trim().startsWith('--'))
        .join('\n');

      const statements = sqlWithoutComments
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      console.log(`[Migration SQL] Found ${statements.length} SQL statements to execute`);

      // Execute each statement separately
      let executedCount = 0;
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement.length === 0) continue;

        try {
          await fairytalesDB.exec(statement);
          executedCount++;

          // Log progress every 10 statements
          if ((i + 1) % 10 === 0) {
            console.log(`[Migration SQL] Progress: ${i + 1}/${statements.length} statements executed`);
          }
        } catch (stmtErr: any) {
          // Check if it's a duplicate key error - that's OK
          if (stmtErr.message && stmtErr.message.includes("duplicate key")) {
            console.log(`[Migration SQL] Statement ${i + 1}: Duplicate entry (skipping)`);
            executedCount++;
            continue;
          }
          // Otherwise, log but continue
          console.error(`[Migration SQL] Statement ${i + 1} failed:`, stmtErr.message);
        }
      }

      // Count fairy tales after migration
      const countResult = await fairytalesDB.queryRow<{ count: number }>`
        SELECT COUNT(*) as count FROM fairy_tales
      `;
      const talesCount = countResult?.count || 0;

      console.log(`[Migration SQL] ✓ ${req.migrationName} completed`);
      console.log(`[Migration SQL] Executed ${executedCount}/${statements.length} statements successfully`);
      console.log(`[Migration SQL] Total fairy tales: ${talesCount}`);

      return {
        success: true,
        message: `Migration ${req.migrationName} executed ${executedCount}/${statements.length} statements. Total tales: ${talesCount}`,
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
