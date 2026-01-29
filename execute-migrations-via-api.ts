#!/usr/bin/env bun
/**
 * Execute SQL migrations via Railway API.
 *
 * Usage:
 *   bun run execute-migrations-via-api.ts artifact
 *   bun run execute-migrations-via-api.ts pipeline
 *   bun run execute-migrations-via-api.ts all
 */

import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

const BACKEND_URL = "https://backend-2-production-3de1.up.railway.app";
const API_ENDPOINT = `${BACKEND_URL}/story/run-migration-sql`;

type MigrationGroup = "artifact" | "pipeline";

const migrations: Array<{ file: string; name: string; group: MigrationGroup }> = [
  { file: "9_create_artifact_pool.up.sql", name: "9_create_artifact_pool", group: "artifact" },
  { file: "9b_create_artifact_indexes.up.sql", name: "9b_create_artifact_indexes", group: "artifact" },
  { file: "10_seed_artifact_pool.up.sql", name: "10_seed_artifact_pool", group: "artifact" },
  { file: "14_create_story_pipeline_v2_tables.up.sql", name: "14_create_story_pipeline_v2_tables", group: "pipeline" },
  { file: "15_seed_story_dna_templates.up.sql", name: "15_seed_story_dna_templates", group: "pipeline" },
  { file: "16_seed_tale_dna_base.up.sql", name: "16_seed_tale_dna_base", group: "pipeline" },
  { file: "18_add_pipeline_quality_gates.up.sql", name: "18_add_pipeline_quality_gates", group: "pipeline" },
];

async function runMigration(migrationPath: string, migrationName: string): Promise<boolean> {
  console.log(`\nRunning ${migrationName}...`);

  try {
    const sqlRaw = await readFile(migrationPath, "utf-8");
    const sql = sqlRaw
      .split("\n")
      .filter(line => !line.trim().startsWith("--"))
      .join("\n")
      .trim();
    console.log(`  SQL file size: ${sql.length} characters`);

    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sql,
        migrationName,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        console.log(`  OK: ${migrationName}`);
        if (result.message) console.log(`     ${result.message}`);
        if (result.statementsExecuted) {
          console.log(`     Executed ${result.statementsExecuted} SQL statements`);
        }
        return true;
      }
      console.log(`  ERROR: ${migrationName}`);
      console.log(`     ${result.message || ""}`);
      return false;
    }

    console.log(`  ERROR: HTTP ${response.status}`);
    const text = await response.text();
    console.log(`     ${text}`);
    return false;
  } catch (error: any) {
    console.log(`  ERROR: ${error.message}`);
    return false;
  }
}

async function testConnection(): Promise<void> {
  console.log("Testing API connection...");
  try {
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sql: "SELECT 1 as test;",
        migrationName: "connection_test",
      }),
    });

    if (response.ok) {
      console.log("  OK: API connection successful\n");
    } else {
      console.log(`  WARN: API returned status ${response.status}`);
      console.log("  Continuing anyway...\n");
    }
  } catch (error: any) {
    console.log(`  WARN: Connection test failed: ${error.message}`);
    console.log("  Continuing anyway...\n");
  }
}

async function verifyArtifacts(): Promise<void> {
  console.log("\nVerifying artifact data...");
  try {
    const verifySQL = "SELECT COUNT(*)::int as count, string_agg(DISTINCT category, ', ') as categories, string_agg(DISTINCT rarity, ', ') as rarities FROM artifact_pool;";
    const verifyResponse = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sql: verifySQL,
        migrationName: "verify_artifacts",
      }),
    });

    if (verifyResponse.ok) {
      console.log("  OK: Artifact pool verification query sent.");
      console.log("  Run this SQL to inspect:");
      console.log("     SELECT COUNT(*) as count FROM artifact_pool;");
      console.log("     SELECT name_de, category, rarity FROM artifact_pool LIMIT 5;");
    }
  } catch (error: any) {
    console.log(`  WARN: Verification query failed: ${error.message}`);
  }
}

async function verifyPipeline(): Promise<void> {
  console.log("\nVerifying pipeline DNA data...");
  try {
    const verifySQL = "SELECT COUNT(*)::int as tale_count FROM tale_dna;";
    const verifyResponse = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sql: verifySQL,
        migrationName: "verify_tale_dna",
      }),
    });

    if (verifyResponse.ok) {
      console.log("  OK: TaleDNA verification query sent.");
      console.log("  Run this SQL to inspect:");
      console.log("     SELECT COUNT(*) as tale_count FROM tale_dna;");
      console.log("     SELECT tale_id FROM tale_dna LIMIT 5;");
    }
  } catch (error: any) {
    console.log(`  WARN: Verification query failed: ${error.message}`);
  }
}

async function main() {
  const modeArg = (process.argv[2] || "artifact").toLowerCase();
  const allowed = new Set(["artifact", "pipeline", "all"]);
  if (!allowed.has(modeArg)) {
    console.log(`Unknown mode '${modeArg}'. Use: artifact | pipeline | all`);
    process.exit(1);
  }

  console.log("Talea Migration Runner (API Mode)");
  console.log(`Mode: ${modeArg}\n`);

  const selected = migrations.filter(m => modeArg === "all" || m.group === modeArg);
  const migrationsDir = join(import.meta.dir, "backend", "story", "migrations");

  await testConnection();

  let successCount = 0;
  for (const migration of selected) {
    const migrationPath = join(migrationsDir, migration.file);
    if (!existsSync(migrationPath)) {
      console.log(`\nSkipping missing migration file: ${migration.file}`);
      continue;
    }
    const success = await runMigration(migrationPath, migration.name);
    if (success) {
      successCount++;
    } else {
      console.log("\nMigration failed. Stopping here.");
      break;
    }
  }

  console.log(`\nFinal Results:`);
  console.log(`  Migrations executed: ${successCount}/${selected.length}`);

  if (successCount === selected.length) {
    if (modeArg === "artifact" || modeArg === "all") {
      console.log("\nArtifact pool system is now set up.");
    }
    if (modeArg === "pipeline" || modeArg === "all") {
      console.log("\nStory pipeline v2 tables and DNA seeds are now available.");
    }
  } else {
    console.log(`\nWarning: Only ${successCount}/${selected.length} migrations completed.`);
  }

  if (modeArg === "artifact" || modeArg === "all") {
    await verifyArtifacts();
  }
  if (modeArg === "pipeline" || modeArg === "all") {
    await verifyPipeline();
  }
}

main().catch((error) => {
  console.error("Migration runner failed:", error);
  process.exit(1);
});
