import { api, APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";

const dokuDB = SQLDatabase.named("doku");

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

export const runMigrationSql = api(
  { expose: true, method: "POST", path: "/doku/run-migration-sql", auth: false },
  async (req: RunMigrationRequest): Promise<RunMigrationResponse> => {
    const { sql, migrationName } = req;

    if (!sql || !sql.trim()) {
      throw APIError.invalidArgument("sql is required");
    }

    console.log(`[doku] Running migration: ${migrationName || "unnamed"}`);

    const statements = sql
      .split(";")
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0 && !statement.startsWith("--"));

    let executed = 0;
    const errors: string[] = [];

    for (const statement of statements) {
      try {
        await dokuDB.exec(statement + ";");
        executed++;
        if (executed % 10 === 0) {
          console.log(`[doku] Progress: ${executed}/${statements.length} statements`);
        }
      } catch (err: any) {
        const message = err?.message || String(err);
        if (message.includes("already exists") || message.includes("duplicate key")) {
          console.log(`[doku] Skipped existing object: ${message.substring(0, 100)}`);
        } else {
          errors.push(`Statement ${executed + 1}: ${message.substring(0, 200)}`);
          console.error(`[doku] Statement failed: ${message.substring(0, 200)}`);
        }
        executed++;
      }
    }

    const success = errors.length === 0;
    const message = success
      ? `Migration "${migrationName || "unnamed"}" completed: ${executed} statements executed`
      : `Migration "${migrationName || "unnamed"}" completed with ${errors.length} errors`;

    console.log(`[doku] ${message}`);

    return {
      success,
      message,
      statementsExecuted: executed,
      errors,
    };
  }
);
