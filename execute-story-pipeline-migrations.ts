#!/usr/bin/env bun
import { readFile } from "fs/promises";
import { join } from "path";

const BACKEND_URL = process.env.BACKEND_URL || "https://backend-2-production-3de1.up.railway.app";
const API_ENDPOINT = `${BACKEND_URL}/story/run-migration-sql`;

async function runMigration(migrationPath: string, migrationName: string): Promise<boolean> {
  console.log(`\nRunning ${migrationName}...`);
  try {
    const sql = await readFile(migrationPath, "utf-8");
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sql, migrationName }),
    });

    if (!response.ok) {
      console.log(`Migration failed: ${response.status}`);
      console.log(await response.text());
      return false;
    }

    const result = await response.json();
    if (!result.success) {
      console.log(`Migration failed: ${result.message}`);
      return false;
    }

    console.log(`OK: ${migrationName}`);
    return true;
  } catch (error: any) {
    console.log(`Migration error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log("Story Pipeline v2 Migration Runner\n");

  const migrationsDir = join(import.meta.dir, "backend", "story", "migrations");
  const migrations = [
    { file: "14_create_story_pipeline_v2_tables.up.sql", name: "14_create_story_pipeline_v2_tables" },
    { file: "15_seed_story_dna_templates.up.sql", name: "15_seed_story_dna_templates" },
  ];

  let successCount = 0;
  for (const migration of migrations) {
    const migrationPath = join(migrationsDir, migration.file);
    const success = await runMigration(migrationPath, migration.name);
    if (!success) break;
    successCount++;
  }

  console.log(`\nCompleted ${successCount}/${migrations.length} migrations.`);
}

main().catch(console.error);
