#!/usr/bin/env bun
/**
 * Run fairy tale migrations via API
 * Reads SQL files and sends them to the backend API endpoint
 */

import { readFile } from "fs/promises";
import { join } from "path";

// Backend API URL
const BACKEND_URL = "https://backend-2-production-3de1.up.railway.app";
const API_ENDPOINT = `${BACKEND_URL}/fairytales/run-migration-sql`;

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

async function main() {
  console.log("🚀 Talea Fairy Tales Migration Runner (API Mode)\n");

  // Define migrations in order
  const migrationsDir = join(import.meta.dir, "backend", "fairytales", "migrations");
  const migrations = [
    { file: "10_add_47_classic_fairy_tales.up.sql", name: "10_add_47_classic_fairy_tales" },
    { file: "11_add_andersen_fairy_tales.up.sql", name: "11_add_andersen_fairy_tales" },
    { file: "12_add_russian_arabian_fairy_tales.up.sql", name: "12_add_russian_arabian_fairy_tales" },
    { file: "13_add_classics_legends_fables.up.sql", name: "13_add_classics_legends_fables" },
  ];

  // Check current count
  console.log("📊 Checking current fairy tale count...");
  try {
    const response = await fetch(`${BACKEND_URL}/fairytales/trigger-migrations`);
    if (response.ok) {
      const data = await response.json();
      const currentCount = data.taleCount || 0;
      console.log(`  Current count: ${currentCount} tales\n`);

      if (currentCount >= 50) {
        console.log("✅ Database already has 50+ fairy tales. No migrations needed.");
        return;
      }
    } else {
      console.log(`  ⚠️  Could not check current count (continuing anyway)`);
    }
  } catch (error: any) {
    console.log(`  ⚠️  Error checking count: ${error.message} (continuing anyway)\n`);
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

  // Check final count
  console.log(`\n📊 Final Results:`);
  console.log(`  Migrations executed: ${successCount}/${migrations.length}`);

  try {
    const response = await fetch(`${BACKEND_URL}/fairytales/trigger-migrations`);
    if (response.ok) {
      const data = await response.json();
      const finalCount = data.taleCount || 0;
      console.log(`  Final fairy tale count: ${finalCount}`);

      if (finalCount === 50) {
        console.log("\n🎉 SUCCESS! Database now has exactly 50 fairy tales!");
        console.log("\n🌐 Check them out at: https://www.talea.website/fairytales");
      } else if (finalCount > 50) {
        console.log(`\n⚠️  Warning: Database has ${finalCount} tales (expected 50)`);
      } else {
        console.log(`\n⚠️  Warning: Only ${finalCount} tales found (expected 50)`);
      }
    }
  } catch (error: any) {
    console.log(`\n⚠️  Could not check final count: ${error.message}`);
  }
}

main().catch(console.error);
