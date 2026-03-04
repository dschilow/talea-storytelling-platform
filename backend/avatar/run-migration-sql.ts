/**
 * Emergency migration endpoint for avatar service.
 * Used to run migrations via API when automatic Encore migrations fail in Railway.
 * Keep this endpoint temporary.
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
    .filter((statement) => statement.length > 0)
    .map((statement) => statement.replace(/^\s*--.*$/gm, "").trim())
    .filter((statement) => statement.length > 0);
}

export const runMigrationSQL = api(
  { expose: true, method: "POST", path: "/avatar/run-migration-sql", auth: false },
  async (req: RunMigrationSQLRequest): Promise<RunMigrationSQLResponse> => {
    const { migrationSql, migrationName } = req;

    if (!migrationSql || !migrationSql.trim()) {
      throw APIError.invalidArgument("migrationSql is required");
    }

    console.log(`[avatar] Running migration: ${migrationName}`);

    const errors: string[] = [];
    let executed = 0;
    let total = 1;

    try {
      // Fast path: run as one SQL script.
      await (avatarDB as any).exec(migrationSql);
      executed = 1;
      console.log(`[avatar] Migration executed as full script: ${migrationName}`);
    } catch (fullScriptError: any) {
      const fullScriptMessage = fullScriptError?.message || String(fullScriptError);
      console.warn(`[avatar] Full script execution failed, using statement mode: ${fullScriptMessage}`);

      const statements = splitStatements(migrationSql);
      total = statements.length;

      for (const statement of statements) {
        try {
          await (avatarDB as any).exec(statement + ";");
        } catch (statementError: any) {
          const message = statementError?.message || String(statementError);
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
    }

    const success = errors.length === 0;
    const message = success
      ? `Migration "${migrationName}" completed: ${executed}/${total} statements executed`
      : `Migration "${migrationName}" completed with ${errors.length} errors`;

    console.log(`[avatar] ${message}`);
    return { success, message, statementsExecuted: executed, errors };
  }
);
