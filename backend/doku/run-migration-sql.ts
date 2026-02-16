import { api } from "encore.dev/api";
import { dokuDB } from "./db";

interface RunMigrationSqlRequest {
  sql: string;
}

interface RunMigrationSqlResponse {
  success: boolean;
  message: string;
  statementsExecuted: number;
}

// Emergency endpoint to run raw SQL migrations on the doku database
export const runMigrationSql = api<RunMigrationSqlRequest, RunMigrationSqlResponse>(
  { expose: true, method: "POST", path: "/doku/run-migration-sql", auth: false },
  async (req) => {
    try {
      console.log("[doku.runMigrationSql] Starting migration execution");

      const statements = req.sql
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith("--"));

      console.log(`[doku.runMigrationSql] Found ${statements.length} statements to execute`);

      let executedCount = 0;
      for (const statement of statements) {
        try {
          await dokuDB.query(statement);
          executedCount++;
        } catch (err: any) {
          if (err.message?.includes("already exists") || err.message?.includes("duplicate")) {
            console.log(`[doku.runMigrationSql] Skipping duplicate: ${err.message}`);
            executedCount++;
            continue;
          }
          throw err;
        }
      }

      console.log(`[doku.runMigrationSql] Migration completed: ${executedCount} statements executed`);

      return {
        success: true,
        message: `Successfully executed ${executedCount} SQL statements`,
        statementsExecuted: executedCount,
      };
    } catch (error: any) {
      console.error("[doku.runMigrationSql] Migration failed:", error);
      return {
        success: false,
        message: `Migration failed: ${error.message}`,
        statementsExecuted: 0,
      };
    }
  }
);
