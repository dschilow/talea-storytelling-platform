#!/usr/bin/env bun
import { readFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const BACKEND_URL = process.env.BACKEND_URL || "https://backend-2-production-3de1.up.railway.app";
const API_ENDPOINT = `${BACKEND_URL}/story/run-migration-sql`;
const SQL_FILES = [
  join(scriptDir, "backend", "story", "migrations", "37_story_quality_repair_guards.up.sql"),
  join(scriptDir, "backend", "story", "migrations", "38_story_quality_target_95.up.sql"),
];

const VERIFY_SQL = `
SELECT 1 / CASE WHEN EXISTS (
  SELECT 1
  FROM pipeline_config
  WHERE key = 'default'
    AND value->>'strictReleaseGateMode' = 'warn'
    AND (value->>'wholeStoryEditMode')::boolean = false
    AND (value->>'maxStoryTokens')::integer = 26000
    AND (value->>'maxRewritePasses')::integer = 0
    AND (value->>'maxExpandCalls')::integer = 5
    AND (value->>'maxWarningPolishCalls')::integer = 2
    AND (value->>'maxSelectiveSurgeryEdits')::integer = 5
    AND (value->>'pass3TargetScore')::numeric = 9.5
    AND (value->>'criticMinScore')::numeric = 9.5
    AND (value->>'pass3WarnFloor')::numeric = 7.8
    AND (value->>'enableAdaptiveSecondCandidate')::boolean = true
    AND (value->>'soulStageDisabled')::boolean = true
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
  console.log("Talea story quality repair guards migration");
  console.log(`Backend: ${BACKEND_URL}`);
  console.log(`SQL files: ${SQL_FILES.join(", ")}`);

  for (const sqlFile of SQL_FILES) {
    const rawSql = await readFile(sqlFile, "utf-8");
    const sql = stripSqlLineComments(rawSql);
    const migrationName = sqlFile.endsWith("38_story_quality_target_95.up.sql")
      ? "38_story_quality_target_95"
      : "37_story_quality_repair_guards";
    await postSql(sql, migrationName);
  }
  await postSql(VERIFY_SQL.trim(), "verify_story_quality_repair_guards_target_95");

  console.log("\nSUCCESS: Story quality repair guards and 9.5 target are active and verified.");
}

main().catch((error) => {
  console.error("\nFAILED: story quality repair guards migration failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
