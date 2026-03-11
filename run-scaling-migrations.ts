#!/usr/bin/env bun

import { readFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const BACKEND_URL = "https://backend-2-production-3de1.up.railway.app";

type MigrationTarget = {
  service: "story" | "doku";
  endpoint: string;
  file: string;
  migrationName: string;
};

const MIGRATIONS: MigrationTarget[] = [
  {
    service: "story",
    endpoint: `${BACKEND_URL}/story/run-migration-sql`,
    file: "backend/story/migrations/26_add_scaling_indexes.up.sql",
    migrationName: "26_add_scaling_indexes",
  },
  {
    service: "doku",
    endpoint: `${BACKEND_URL}/doku/run-migration-sql`,
    file: "backend/doku/migrations/6_add_scaling_indexes.up.sql",
    migrationName: "6_add_scaling_indexes",
  },
];

async function runMigration(target: MigrationTarget): Promise<boolean> {
  const migrationPath = join(scriptDir, target.file);
  const sql = await readFile(migrationPath, "utf-8");

  console.log(`\nRunning ${target.service}:${target.migrationName}`);
  console.log(`  Endpoint: ${target.endpoint}`);
  console.log(`  File: ${migrationPath}`);

  const response = await fetch(target.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sql,
      migrationName: target.migrationName,
    }),
  });

  const responseText = await response.text();
  let responseBody: any = null;
  try {
    responseBody = JSON.parse(responseText);
  } catch {
    responseBody = responseText;
  }

  if (!response.ok) {
    console.log(`  HTTP ${response.status}`);
    console.log(`  Response: ${typeof responseBody === "string" ? responseBody : JSON.stringify(responseBody)}`);
    return false;
  }

  console.log(`  Response: ${JSON.stringify(responseBody)}`);
  return Boolean(responseBody?.success);
}

async function main() {
  console.log("Talea scaling migration runner");

  let successCount = 0;
  for (const migration of MIGRATIONS) {
    try {
      const success = await runMigration(migration);
      if (success) {
        successCount += 1;
      }
    } catch (error) {
      console.log(`  Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(`\nCompleted ${successCount}/${MIGRATIONS.length} migrations successfully.`);

  if (successCount !== MIGRATIONS.length) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
