#!/usr/bin/env bun
import { readFile } from "fs/promises";
import { join } from "path";

const BACKEND_URL = "https://backend-2-production-3de1.up.railway.app";
const API_ENDPOINT = `${BACKEND_URL}/story/run-migration-sql`;

async function runMigration(migrationPath: string, migrationName: string): Promise<boolean> {
  console.log(`\n🔄 Running ${migrationName}...`);

  try {
    const sql = await readFile(migrationPath, "utf-8");
    console.log(`  📄 SQL file size: ${sql.length} characters`);

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
  console.log("🚀 Talea Tale DNA Migration Runner\n");
  console.log("Seeding tale_dna for Andersen, Russian, 1001 Nights, Classics, Legends & Aesop\n");

  const migrationsDir = join(process.cwd(), "backend", "story", "migrations", "data");
  
  const migrations = [
    { file: "seed_andersen_tale_dna.sql", name: "seed_andersen_tale_dna" },
    { file: "seed_russian_tale_dna.sql", name: "seed_russian_tale_dna" },
    { file: "seed_classics_tale_dna.sql", name: "seed_classics_tale_dna" },
  ];

  let successCount = 0;
  for (const migration of migrations) {
    const migrationPath = join(migrationsDir, migration.file);
    const success = await runMigration(migrationPath, migration.name);
    if (success) {
      successCount++;
    } else {
      console.log(`\n⚠️  Migration failed. Continuing with next...`);
    }
  }

  console.log(`\n📊 Final Results:`);
  console.log(`  Migrations executed: ${successCount}/${migrations.length}`);

  if (successCount === migrations.length) {
    console.log("\n🎉 SUCCESS! All tale_dna migrations completed!");
    console.log("\n📋 Tales added:");
    console.log("  • 9 Andersen tales (Meerjungfrau, Schneekönigin, etc.)");
    console.log("  • 11 Russian + 1001 Nights tales (Baba Jaga, Aladin, etc.)");
    console.log("  • 15 Classics, Legends & Aesop tales (Alice, Robin Hood, etc.)");
  } else {
    console.log(`\n⚠️  Warning: Only ${successCount}/${migrations.length} migrations completed.`);
  }
}

main().catch(console.error);
