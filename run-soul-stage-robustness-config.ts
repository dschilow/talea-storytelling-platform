#!/usr/bin/env bun
import { readFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const BACKEND_URL = process.env.BACKEND_URL || "https://backend-2-production-3de1.up.railway.app";
const API_ENDPOINT = `${BACKEND_URL}/story/run-migration-sql`;
const SQL_FILE = join(scriptDir, "backend", "story", "migrations", "34_soul_stage_robustness.up.sql");

const VERIFY_SQL = `
SELECT 1 / CASE WHEN EXISTS (
  SELECT 1
  FROM pipeline_config
  WHERE key = 'default'
    AND (value->>'soulRetryMax')::int = 1
    AND (value->>'soulAllowOnReject')::boolean = true
    AND (value->>'soulGeneratorMaxOutputTokens')::int = 3000
    AND (value->>'soulGateEnabled')::boolean = true
    AND (value->>'soulRescueEnabled')::boolean = false
) THEN 1 ELSE 0 END AS verified;
`;

function stripSqlLineComments(sql: string): string {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .trim();
}

async function postSql(sql: string, migrationName: string): Promise<void> {
  console.log(`\nRunning ${migrationName}`);
  console.log(`Endpoint: ${API_ENDPOINT}`);
  console.log(`SQL size: ${sql.length} chars`);

  const response = await fetch(API_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sql, migrationName }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  const result = await response.json() as {
    success?: boolean;
    message?: string;
    statementsExecuted?: number;
    errors?: string[];
  };

  if (!result.success) {
    const details = result.errors?.length ? `\n${result.errors.join("\n")}` : "";
    throw new Error(`${result.message || "Migration failed"}${details}`);
  }

  console.log(result.message || `OK: ${migrationName}`);
  if (result.statementsExecuted !== undefined) {
    console.log(`Statements executed: ${result.statementsExecuted}`);
  }
}

async function main(): Promise<void> {
  console.log("Talea Soul stage robustness migration");
  console.log(`Backend: ${BACKEND_URL}`);
  console.log(`SQL file: ${SQL_FILE}`);

  const rawSql = await readFile(SQL_FILE, "utf-8");
  const sql = stripSqlLineComments(rawSql);

  await postSql(sql, "34_soul_stage_robustness");
  await postSql(VERIFY_SQL.trim(), "verify_34_soul_stage_robustness");

  console.log("\nSUCCESS: Soul stage robustness config is applied and verified.");
}

main().catch((error) => {
  console.error("\nFAILED: Soul stage robustness migration failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
