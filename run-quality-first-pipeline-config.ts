#!/usr/bin/env bun
import { readFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const BACKEND_URL = process.env.BACKEND_URL || "https://backend-2-production-3de1.up.railway.app";
const API_ENDPOINT = `${BACKEND_URL}/story/run-migration-sql`;
const SQL_FILE = join(scriptDir, "update-pipeline-config.sql");

const VERIFY_SQL = `
SELECT 1 / CASE WHEN EXISTS (
  SELECT 1
  FROM pipeline_config
  WHERE key = 'default'
    AND (value->>'runwareSteps')::int = 4
    AND (value->>'runwareCfgScale')::int = 4
    AND (value->>'releaseCandidateCount')::int = 1
    AND value->>'criticModel' = 'gpt-5.4-nano'
    AND (value->>'criticMinScore')::numeric = 7.8
    AND (value->>'maxSelectiveSurgeryEdits')::int = 0
    AND (value->>'blueprintRetryMax')::int = 0
    AND (value->>'pass3TargetScore')::numeric = 7.8
    AND (value->>'pass3WarnFloor')::numeric = 6.4
    AND (value->>'soulStageEnabled')::boolean = true
    AND (value->>'soulRetryMax')::int = 0
    AND (value->>'soulAllowOnReject')::boolean = true
    AND (value->>'soulAwareCriticMinScore')::numeric = 7.8
    AND (value->>'soulApprovedSingleCandidate')::boolean = true
    AND (value->>'soulGeneratorMaxOutputTokens')::int = 2500
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
  console.log(`\nRunning ${migrationName}...`);
  console.log(`  Endpoint: ${API_ENDPOINT}`);
  console.log(`  SQL size: ${sql.length} characters`);

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

  console.log(`  OK: ${result.message || migrationName}`);
  if (result.statementsExecuted !== undefined) {
    console.log(`  Statements executed: ${result.statementsExecuted}`);
  }
}

async function main(): Promise<void> {
  console.log("Talea quality-first pipeline config runner");
  console.log(`Backend: ${BACKEND_URL}`);
  console.log(`SQL file: ${SQL_FILE}`);

  const rawSql = await readFile(SQL_FILE, "utf-8");
  const sql = stripSqlLineComments(rawSql);

  await postSql(sql, "update_quality_first_pipeline_config");
  await postSql(VERIFY_SQL.trim(), "verify_quality_first_pipeline_config");

  console.log("\nSUCCESS: quality-first pipeline config is applied and verified.");
}

main().catch((error) => {
  console.error("\nFAILED: quality-first pipeline config runner failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});