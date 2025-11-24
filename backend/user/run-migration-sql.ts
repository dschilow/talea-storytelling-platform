import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";

const userDB = new SQLDatabase("user", {
  migrations: "./migrations",
});

interface RunMigrationSqlRequest {
  sql: string;
}

interface RunMigrationSqlResponse {
  success: boolean;
  message: string;
  statementsExecuted: number;
}

// Emergency endpoint to run raw SQL migrations
// Used when migration files aren't copied to Railway container
export const runMigrationSql = api<RunMigrationSqlRequest, RunMigrationSqlResponse>(
  { expose: true, method: "POST", path: "/user/run-migration-sql", auth: false },
  async (req) => {
    try {
      console.log("[user.runMigrationSql] Starting migration execution");

      // Split SQL by semicolons to handle multiple statements
      const statements = req.sql
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith("--"));

      console.log(`[user.runMigrationSql] Found ${statements.length} statements to execute`);

      let executedCount = 0;
      for (const statement of statements) {
        try {
          // Use raw SQL execution via query
          await userDB.query(statement);
          executedCount++;

          if (executedCount % 5 === 0) {
            console.log(`[user.runMigrationSql] Progress: ${executedCount}/${statements.length} statements executed`);
          }
        } catch (err: any) {
          // Ignore duplicate column errors (migration already ran)
          if (err.message?.includes("already exists") || err.message?.includes("duplicate")) {
            console.log(`[user.runMigrationSql] Skipping duplicate: ${err.message}`);
            executedCount++;
            continue;
          }
          throw err;
        }
      }

      console.log(`[user.runMigrationSql] Migration completed: ${executedCount} statements executed`);

      return {
        success: true,
        message: `Successfully executed ${executedCount} SQL statements`,
        statementsExecuted: executedCount,
      };
    } catch (error: any) {
      console.error("[user.runMigrationSql] Migration failed:", error);
      return {
        success: false,
        message: `Migration failed: ${error.message}`,
        statementsExecuted: 0,
      };
    }
  }
);
