#!/usr/bin/env bun

const BACKEND_URL = process.env.BACKEND_URL || "https://backend-2-production-3de1.up.railway.app";
const API_ENDPOINT = `${BACKEND_URL}/story/run-migration-sql`;

const SQL = `
INSERT INTO pipeline_config (key, value)
VALUES ('default', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

UPDATE pipeline_config
SET value = value || '{
  "releaseCandidateCount": 1,
  "criticModel": "gpt-5.4-nano",
  "maxSelectiveSurgeryEdits": 0,
  "blueprintRetryMax": 0,
  "pass3TargetScore": 7.8,
  "pass3WarnFloor": 6.4,
  "soulStageEnabled": true,
  "soulRetryMax": 0,
  "soulAllowOnReject": true,
  "soulAwareCriticMinScore": 7.8,
  "soulApprovedSingleCandidate": true,
  "soulGeneratorMaxOutputTokens": 2500,
  "imageRetryMax": 1
}'::jsonb,
updated_at = CURRENT_TIMESTAMP
WHERE key = 'default';
`;

const VERIFY_SQL = `
SELECT 1 / CASE WHEN EXISTS (
  SELECT 1
  FROM pipeline_config
  WHERE key = 'default'
    AND (value->>'releaseCandidateCount')::int = 1
    AND value->>'criticModel' = 'gpt-5.4-nano'
    AND (value->>'maxSelectiveSurgeryEdits')::int = 0
    AND (value->>'blueprintRetryMax')::int = 0
    AND (value->>'pass3TargetScore')::numeric = 7.8
    AND (value->>'pass3WarnFloor')::numeric = 6.4
    AND (value->>'soulAllowOnReject')::boolean = true
    AND (value->>'soulRetryMax')::int = 0
    AND (value->>'soulApprovedSingleCandidate')::boolean = true
    AND (value->>'soulGeneratorMaxOutputTokens')::int = 2500
) THEN 1 ELSE 0 END AS verified;
`;

async function postSql(sql: string, migrationName: string): Promise<void> {
  console.log(`\nRunning ${migrationName}...`);
  const response = await fetch(API_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sql: sql.trim(), migrationName }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  const result = await response.json() as { success?: boolean; message?: string; errors?: string[] };
  if (!result.success) {
    throw new Error(`${result.message || "SQL execution failed"}\n${(result.errors || []).join("\n")}`);
  }
  console.log(`  OK: ${result.message || migrationName}`);
}

async function main(): Promise<void> {
  console.log("Talea timeout-safe pipeline config runner");
  console.log(`Backend: ${BACKEND_URL}`);

  await postSql(SQL, "timeout_safe_pipeline_config");
  await postSql(VERIFY_SQL, "verify_timeout_safe_pipeline_config");

  console.log("\nSUCCESS: timeout-safe pipeline config is applied and verified.");
}

main().catch((error) => {
  console.error("\nFAILED: timeout-safe pipeline config runner failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});