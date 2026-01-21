import { api } from "encore.dev/api";
import { storyDB } from "./db";

interface RunMigrationSQLRequest {
  sql: string;
  migrationName: string;
}

interface RunMigrationSQLResponse {
  success: boolean;
  message: string;
  statementsExecuted?: number;
}

/**
 * Emergency endpoint to run raw SQL migrations when Docker container doesn't have migration files.
 * IMPORTANT: This endpoint has no authentication for emergency access.
 */
export const runMigrationSQL = api<RunMigrationSQLRequest, RunMigrationSQLResponse>(
  { expose: true, method: "POST", path: "/story/run-migration-sql", auth: false },
  async (req) => {
    console.log(`[Migration API] Received migration request: ${req.migrationName}`);
    console.log(`[Migration API] SQL length: ${req.sql.length} characters`);

    try {
      // Execute entire SQL as one statement to preserve transaction integrity
      // This ensures CREATE TABLE and CREATE INDEX run together
      console.log(`[Migration API] Executing SQL as single transaction...`);

      let executedCount = 1; // Assume 1 if executed as single block

      try {
        await storyDB.exec([req.sql] as any);
        console.log(`[Migration API] ✅ SQL executed successfully as single transaction`);
      } catch (error: any) {
        // If execution as single block fails, try splitting by semicolon
        console.log(`[Migration API] Single execution failed, trying statement-by-statement...`);

        const statements = req.sql
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));

        console.log(`[Migration API] Executing ${statements.length} SQL statements...`);

        executedCount = 0;
        for (const [index, statement] of statements.entries()) {
          try {
            // Log progress every 10 statements
            if (index % 10 === 0 && index > 0) {
              console.log(`[Migration API] Progress: ${index}/${statements.length} statements executed`);
            }

            // Execute the statement
            await storyDB.exec([statement] as any);
            executedCount++;
          } catch (error: any) {
            // Check if it's a duplicate key error (already exists)
            if (error.message?.includes('duplicate key') || error.message?.includes('already exists')) {
              console.log(`[Migration API] Statement ${index + 1} skipped (already exists): ${statement.substring(0, 100)}...`);
              executedCount++; // Count as executed since it's idempotent
              continue;
            }

            // Log other errors but continue
            console.error(`[Migration API] Error in statement ${index + 1}:`, error.message);
            console.error(`[Migration API] Failed statement: ${statement.substring(0, 200)}...`);
            throw error;
          }
        }
      }

      const message = `Migration ${req.migrationName} completed successfully. Executed ${executedCount} statements.`;
      console.log(`[Migration API] ✅ ${message}`);

      return {
        success: true,
        message,
        statementsExecuted: executedCount,
      };
    } catch (error: any) {
      const errorMessage = `Migration ${req.migrationName} failed: ${error.message || error.toString()}`;
      console.error(`[Migration API] ❌ ${errorMessage}`);
      console.error(`[Migration API] Full error:`, error);

      return {
        success: false,
        message: errorMessage,
      };
    }
  }
);
