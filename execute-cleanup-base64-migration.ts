#!/usr/bin/env bun
/**
 * Migration Script: Clean up base64 images from character_pool
 *
 * Problem: character_pool.image_url contains base64 data URIs which are:
 * - Too large for image prompts (thousands of characters)
 * - Not usable by Runware API (expects HTTP URLs)
 * - Causing story generation to fail
 *
 * Solution: Remove all base64 data URIs, keep only HTTP(S) URLs
 */

import { readFile } from "fs/promises";
import { join } from "path";

const BACKEND_URL = "https://backend-2-production-3de1.up.railway.app";
const API_ENDPOINT = `${BACKEND_URL}/story/run-migration-sql`;

async function runMigration(migrationPath: string, migrationName: string): Promise<boolean> {
  console.log(`\n🔄 Running ${migrationName}...`);

  try {
    // SQL-Datei lesen
    const sql = await readFile(migrationPath, "utf-8");
    console.log(`  📄 SQL file size: ${sql.length} characters`);

    // An API senden
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
        if (result.statementsExecuted) {
          console.log(`     Executed ${result.statementsExecuted} SQL statements`);
        }
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
  console.log("🚀 Talea Base64 Cleanup Migration\n");
  console.log("📋 This migration will:");
  console.log("   • Remove all base64 data URIs from character_pool.image_url");
  console.log("   • Keep HTTP(S) URLs intact");
  console.log("   • Enable text-based fallback descriptions for characters without images\n");

  // Migrations-Pfad
  const migrationsDir = join(import.meta.dir, "backend", "story", "migrations");
  const migrations = [
    { file: "13_cleanup_base64_images.up.sql", name: "13_cleanup_base64_images" },
  ];

  // Migration ausführen
  let successCount = 0;
  for (const migration of migrations) {
    const migrationPath = join(migrationsDir, migration.file);

    const success = await runMigration(migrationPath, migration.name);
    if (success) {
      successCount++;
    } else {
      console.log(`\n⚠️  Migration failed. Please check the error message above.`);
      break;
    }
  }

  // Zusammenfassung
  console.log(`\n📊 Final Results:`);
  console.log(`  Migrations executed: ${successCount}/${migrations.length}`);

  if (successCount === migrations.length) {
    console.log("\n🎉 SUCCESS! Base64 cleanup completed!");
    console.log("\n✅ Next steps:");
    console.log("   1. Characters will now use text-based fallback descriptions");
    console.log("   2. Story generation should work without base64-related errors");
    console.log("   3. To add character reference images: Upload HTTP URLs to character_pool.image_url");
  } else {
    console.log(`\n⚠️  Warning: Migration failed. Please check the logs above.`);
  }
}

main().catch(console.error);
