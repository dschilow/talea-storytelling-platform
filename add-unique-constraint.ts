#!/usr/bin/env bun
/**
 * Add UNIQUE constraint to story_artifacts table
 */

import { readFile } from "fs/promises";
import { join } from "path";

const BACKEND_URL = "https://backend-2-production-3de1.up.railway.app";
const API_ENDPOINT = `${BACKEND_URL}/story/run-migration-sql`;

async function main() {
  console.log("🔧 Adding UNIQUE constraint to story_artifacts table...\n");

  const migrationPath = join(import.meta.dir, "backend", "story", "migrations", "11_add_story_artifacts_unique_constraint.up.sql");
  const sql = await readFile(migrationPath, "utf-8");

  console.log("📄 SQL to execute:");
  console.log(sql);
  console.log();

  const response = await fetch(API_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sql: sql,
      migrationName: "11_add_unique_constraint",
    }),
  });

  const result = await response.json();

  if (result.success) {
    console.log("✅ Migration completed successfully!");
    console.log(`   ${result.message}`);
    console.log("\n🎉 UNIQUE constraint added! Future artifact recordings will use ON CONFLICT.");
  } else {
    console.log("❌ Migration failed:");
    console.log(`   ${result.message}`);
  }
}

main().catch(console.error);
