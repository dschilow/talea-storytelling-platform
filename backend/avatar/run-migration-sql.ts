/**
 * Emergency migration endpoint for avatar service.
 * Used to run migrations via API when automatic Encore migrations fail in Railway.
 * Should be re-removed after successful deployment.
 */

import { api, APIError } from "encore.dev/api";
import { avatarDB } from "./db";

interface RunMigrationSQLRequest {
  migrationSql: string;
  migrationName: string;
}

interface RunMigrationSQLResponse {
  success: boolean;
  message: string;
  statementsExecuted: number;
  errors: string[];
}

export const runMigrationSQL = api(
  { expose: true, method: "POST", path: "/avatar/run-migration-sql", auth: false },
  async (req: RunMigrationSQLRequest): Promise<RunMigrationSQLResponse> => {
    const { migrationSql, migrationName } = req;

    if (!migrationSql || !migrationSql.trim()) {
      throw APIError.invalidArgument("migrationSql is required");
    }

    console.log(`🔄 [avatar] Running migration: ${migrationName}`);

    const statements = migrationSql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    let executed = 0;
    const errors: string[] = [];

    for (const statement of statements) {
      try {
        // Use function call syntax (not template literal) for raw dynamic SQL
        await avatarDB.exec(statement + ";");
        executed++;
        if (executed % 5 === 0) {
          console.log(`  📊 Progress: ${executed}/${statements.length} statements`);
        }
      } catch (err: any) {
        const msg = err.message || String(err);
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
      ? `✅ Migration "${migrationName}" completed: ${executed} statements executed`
      : `⚠️ Migration "${migrationName}" completed with ${errors.length} errors`;

    console.log(message);

    return { success, message, statementsExecuted: executed, errors };
  }
);
