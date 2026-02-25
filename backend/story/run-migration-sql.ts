import { api, APIError } from "encore.dev/api";
import { storyDB } from "./db";

interface RunMigrationRequest {
  sql: string;
  migrationName?: string;
}

interface RunMigrationResponse {
  success: boolean;
  message: string;
  statementsExecuted: number;
  errors: string[];
}

/**
 * Execute raw SQL against the story database.
 * Used for manual migrations when Encore auto-migrations don't work in Railway Docker.
 * 
 * POST /story/run-migration-sql
 */
export const runMigrationSql = api(
  { expose: true, method: "POST", path: "/story/run-migration-sql", auth: false },
  async (req: RunMigrationRequest): Promise<RunMigrationResponse> => {
    const { sql, migrationName } = req;

    if (!sql || !sql.trim()) {
      throw APIError.invalidArgument("sql is required");
    }

    console.log(`🔄 [story] Running migration: ${migrationName || "unnamed"}`);

    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    let executed = 0;
    const errors: string[] = [];

    for (const statement of statements) {
      try {
        await storyDB.exec(statement + ";");
        executed++;
        if (executed % 10 === 0) {
          console.log(`  📊 Progress: ${executed}/${statements.length} statements`);
        }
      } catch (err: any) {
        const msg = err.message || String(err);
        // Skip duplicate key / already exists errors
        if (msg.includes("already exists") || msg.includes("duplicate key")) {
          console.log(`  ⚠️ Skipped (already exists): ${msg.substring(0, 100)}`);
        } else {
          errors.push(`Statement ${executed + 1}: ${msg.substring(0, 200)}`);
          console.error(`  ❌ Error: ${msg.substring(0, 200)}`);
        }
        executed++;
      }
    }

    const success = errors.length === 0;
    const message = success
      ? `✅ Migration "${migrationName || "unnamed"}" completed: ${executed} statements executed`
      : `⚠️ Migration "${migrationName || "unnamed"}" completed with ${errors.length} errors`;

    console.log(message);

    return { success, message, statementsExecuted: executed, errors };
  }
);
