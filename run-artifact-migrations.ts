#!/usr/bin/env bun
/**
 * Run artifact pool migrations via API
 * Reads SQL files and sends them to the backend API endpoint
 */

import { readFile } from "fs/promises";
import { join } from "path";

// Backend API URL
const BACKEND_URL = "https://backend-2-production-3de1.up.railway.app";
const API_ENDPOINT = `${BACKEND_URL}/story/run-migration-sql`;

async function runMigration(migrationPath: string, migrationName: string): Promise<boolean> {
  console.log(`\n🔄 Running ${migrationName}...`);

  try {
    // Read SQL file
    const sql = await readFile(migrationPath, "utf-8");
    console.log(`  📄 SQL file size: ${sql.length} characters`);

    // Send to API
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sql: sql,
        migrationName: migrationName,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        console.log(`  ✅ ${migrationName} completed successfully`);
        console.log(`     ${result.message || ""}`);
        return true;
      } else {
        console.log(`  ❌ ${migrationName} failed`);
        console.log(`     ${result.message || ""}`);
        return false;
      }
    } else {
      console.log(`  ❌ HTTP Error ${response.status}`);
      const text = await response.text();
      console.log(`     ${text}`);
      return false;
    }
  } catch (error: any) {
    console.log(`  ❌ Error: ${error.message}`);
    return false;
  }
}

async function checkArtifactCount(): Promise<number> {
  try {
    // Simple query to count artifacts (if table exists)
    const checkSql = "SELECT COUNT(*) as count FROM artifact_pool;";

    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sql: checkSql,
        migrationName: "check_artifact_count",
      }),
    });

    if (response.ok) {
      // Note: We can't actually get query results from the exec endpoint
      // So we just return 0 if successful (table exists) or -1 if not
      return 0;
    }
    return -1;
  } catch (error) {
    return -1;
  }
}

async function main() {
  console.log("🚀 Talea Artifact Pool Migration Runner (API Mode)\n");
  console.log("This will create the artifact_pool system with 100 predefined artifacts.\n");

  // Define migrations in order
  const migrationsDir = join(import.meta.dir, "backend", "story", "migrations");
  const migrations = [
    { file: "9_create_artifact_pool.up.sql", name: "9_create_artifact_pool" },
    { file: "10_seed_artifact_pool.up.sql", name: "10_seed_artifact_pool" },
  ];

  // Check if artifact_pool table already exists
  console.log("📊 Checking if artifact_pool table exists...");
  const count = await checkArtifactCount();
  if (count >= 0) {
    console.log("  ⚠️  artifact_pool table might already exist.");
    console.log("  Continuing anyway - duplicate entries will be skipped.\n");
  } else {
    console.log("  artifact_pool table does not exist yet.\n");
  }

  // Run each migration
  let successCount = 0;
  for (const migration of migrations) {
    const migrationPath = join(migrationsDir, migration.file);

    const success = await runMigration(migrationPath, migration.name);
    if (success) {
      successCount++;
    } else {
      console.log(`\n⚠️  Migration failed. Stopping here.`);
      break;
    }
  }

  // Final summary
  console.log(`\n📊 Final Results:`);
  console.log(`  Migrations executed: ${successCount}/${migrations.length}`);

  if (successCount === migrations.length) {
    console.log("\n🎉 SUCCESS! Artifact pool system is now set up with 100 artifacts!");
    console.log("\n📦 The artifact system includes:");
    console.log("   - artifact_pool table with 100 predefined artifacts");
    console.log("   - story_artifacts table for tracking artifact assignments");
    console.log("   - Bilingual support (German & English)");
    console.log("   - 4 rarity tiers: common, uncommon, rare, legendary");
    console.log("   - 11 categories: weapon, magic, tool, clothing, book, potion, jewelry, etc.");
    console.log("\n🚀 Next steps:");
    console.log("   1. Generate a new story to test artifact matching");
    console.log("   2. Complete reading the story to unlock the artifact");
    console.log("   3. See the artifact celebration modal!");
  } else {
    console.log(`\n⚠️  Warning: Only ${successCount}/${migrations.length} migrations completed.`);
    console.log("   Please check the error messages above.");
  }
}

main().catch(console.error);
