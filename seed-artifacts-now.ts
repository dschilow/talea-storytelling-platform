#!/usr/bin/env bun
/**
 * Seed the artifact_pool table with 100 artifacts
 */

import { readFile } from "fs/promises";
import { join } from "path";

const BACKEND_URL = "https://backend-2-production-3de1.up.railway.app";
const API_ENDPOINT = `${BACKEND_URL}/story/run-migration-sql`;

async function main() {
  console.log("🌱 Seeding artifact_pool with 100 artifacts...\n");

  // Read the seed SQL file
  const seedPath = join(import.meta.dir, "backend", "story", "migrations", "10_seed_artifact_pool.up.sql");
  console.log(`📄 Reading seed file: ${seedPath}`);

  const sql = await readFile(seedPath, "utf-8");
  console.log(`   File size: ${sql.length} characters`);
  console.log(`   Contains ${sql.split('INSERT INTO').length - 1} INSERT statements\n`);

  // Execute the seed migration
  console.log("🔄 Executing seed migration...");
  const response = await fetch(API_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sql: sql,
      migrationName: "10_seed_artifact_pool",
    }),
  });

  const result = await response.json();

  if (result.success) {
    console.log(`✅ ${result.message}`);
    console.log(`   Executed ${result.statementsExecuted} statements`);

    console.log("\n🔍 Verifying data...");

    // Verify the count
    const verifyResponse = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sql: "SELECT COUNT(*) as count FROM artifact_pool;",
        migrationName: "verify_count",
      }),
    });

    const verifyResult = await verifyResponse.json();
    if (verifyResult.success) {
      console.log("✅ Verification successful!");
      console.log("\n📊 Check in Railway Postgres:");
      console.log("   SELECT COUNT(*) FROM artifact_pool;  -- Should show 100");
      console.log("   SELECT name_de, category, rarity FROM artifact_pool LIMIT 10;");
      console.log("\n🎉 SUCCESS! 100 artifacts are now in the database!");
    }
  } else {
    console.log(`❌ Failed: ${result.message}`);
  }
}

main().catch(console.error);
