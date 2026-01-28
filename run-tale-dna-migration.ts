#!/usr/bin/env bun
/**
 * Run tale_dna migrations via API
 * Adds more classic fairy tale TaleDNA entries to the story database
 */

import { readFile } from "fs/promises";
import { join } from "path";

// Backend API URL - uses the story service endpoint
const BACKEND_URL = process.env.BACKEND_URL || "https://backend-2-production-3de1.up.railway.app";
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
      console.log(`     ${text.slice(0, 500)}`);
      return false;
    }
  } catch (error: any) {
    console.log(`  ❌ Error: ${error.message}`);
    return false;
  }
}

async function checkTaleDnaCount(): Promise<number> {
  try {
    // Use a simple query endpoint to count tales
    const sql = "SELECT COUNT(*) as count FROM tale_dna";
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sql, migrationName: "count-check" }),
    });

    if (response.ok) {
      const result = await response.json();
      // Parse the count from the message if available
      const match = result.message?.match(/(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    }
  } catch {
    // Ignore errors
  }
  return 0;
}

async function main() {
  console.log("🚀 Talea Tale DNA Migration Runner\n");
  console.log(`📡 Using backend: ${BACKEND_URL}\n`);

  // Define migrations in order
  const migrationsDir = join(import.meta.dir, "backend", "story", "migrations");
  const migrations = [
    { file: "17_seed_more_tale_dna.up.sql", name: "17_seed_more_tale_dna" },
  ];

  // Run each migration
  let successCount = 0;
  for (const migration of migrations) {
    const migrationPath = join(migrationsDir, migration.file);

    const success = await runMigration(migrationPath, migration.name);
    if (success) {
      successCount++;
    } else {
      console.log(`\n⚠️  Migration failed. Check the error above.`);
      break;
    }
  }

  // Summary
  console.log(`\n📊 Final Results:`);
  console.log(`  Migrations executed: ${successCount}/${migrations.length}`);

  if (successCount === migrations.length) {
    console.log("\n🎉 SUCCESS! Tale DNA entries have been added!");
    console.log("\n📚 Added the following fairy tales:");
    console.log("   - grimm-053: Schneewittchen (Snow White)");
    console.log("   - grimm-015: Hänsel und Gretel");
    console.log("   - grimm-050: Dornröschen (Sleeping Beauty)");
    console.log("   - grimm-055: Rumpelstilzchen");
    console.log("   - grimm-001: Der Froschkönig (The Frog Prince)");
    console.log("   - grimm-027: Die Bremer Stadtmusikanten");
    console.log("   - grimm-021: Aschenputtel (Cinderella)");
    console.log("   - grimm-012: Rapunzel");
    console.log("   - grimm-005: Der Wolf und die sieben Geißlein");
  } else {
    console.log(`\n⚠️  Some migrations failed. Please check the errors above.`);
  }
}

main().catch(console.error);
