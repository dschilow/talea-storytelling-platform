/**
 * Emergency migration endpoint for avatar service.
 * Used to run migrations via API when automatic Encore migrations fail in Railway.
 * Should be removed after rollout is stable.
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

function splitStatements(sql: string): string[] {
  return sql
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0 && !statement.startsWith("--"));
}

export const runMigrationSQL = api(
  { expose: true, method: "POST", path: "/avatar/run-migration-sql", auth: false },
  async (req: RunMigrationSQLRequest): Promise<RunMigrationSQLResponse> => {
    const { migrationSql, migrationName } = req;

    if (!migrationSql || !migrationSql.trim()) {
      throw APIError.invalidArgument("migrationSql is required");
    }

    console.log(`[avatar] Running migration: ${migrationName}`);

    const statements = splitStatements(migrationSql);
    let executed = 0;
    const errors: string[] = [];

    for (const statement of statements) {
      try {
        // Intentionally run raw statement string for emergency migrations.
        await avatarDB.exec(statement + ";");
      } catch (err: any) {
        const message = err?.message || String(err);
        if (!message.includes("already exists") && !message.includes("duplicate key")) {
          errors.push(`Statement ${executed + 1}: ${message.substring(0, 250)}`);
          console.error(`[avatar] Statement failed: ${message.substring(0, 250)}`);
        }
      } finally {
        executed += 1;
        if (executed % 5 === 0 || executed === statements.length) {
          console.log(`[avatar] Progress: ${executed}/${statements.length} statements`);
        }
      }
    }

    const success = errors.length === 0;
    const message = success
      ? `Migration "${migrationName}" completed: ${executed} statements executed`
      : `Migration "${migrationName}" completed with ${errors.length} errors`;

    console.log(`[avatar] ${message}`);
    return { success, message, statementsExecuted: executed, errors };
  }
);
