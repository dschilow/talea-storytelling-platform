#!/usr/bin/env bun
/**
 * Direct database migration runner
 * Connects directly to Railway PostgreSQL database and runs artifact migrations
 *
 * Usage: bun run run-artifact-migrations-direct.ts
 */

import { readFile } from "fs/promises";
import { join } from "path";
import postgres from "postgres";

// Railway Database Connection
// Get this from Railway dashboard > Variables > DATABASE_URL
const DATABASE_URL = process.env.DATABASE_URL || process.env.RAILWAY_DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ ERROR: DATABASE_URL not found!");
  console.error("\n💡 To fix this:");
  console.error("   1. Go to Railway dashboard");
  console.error("   2. Select your 'story' service database");
  console.error("   3. Copy the DATABASE_URL from Variables");
  console.error("   4. Run: export DATABASE_URL='postgres://...'");
  console.error("   5. Then run this script again");
  process.exit(1);
}

console.log("🚀 Talea Artifact Pool Migration Runner (Direct DB Mode)\n");
console.log("📡 Connecting to Railway PostgreSQL...");

const sql = postgres(DATABASE_URL, {
  max: 1, // Single connection
  idle_timeout: 20,
  connect_timeout: 10,
});

async function runMigration(migrationPath: string, migrationName: string): Promise<boolean> {
  console.log(`\n🔄 Running ${migrationName}...`);

  try {
    // Read SQL file
    const sqlContent = await readFile(migrationPath, "utf-8");
    console.log(`  📄 SQL file size: ${sqlContent.length} characters`);

    // Split into individual statements
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`  📝 Executing ${statements.length} SQL statements...`);

    let executedCount = 0;
    for (const [index, statement] of statements.entries()) {
      try {
        // Log progress every 10 statements
        if (index % 10 === 0 && index > 0) {
          console.log(`     Progress: ${index}/${statements.length} statements`);
        }

        // Execute statement
        await sql.unsafe(statement);
        executedCount++;
      } catch (error: any) {
        // Check if it's a duplicate key error (already exists)
        if (error.message?.includes('duplicate key') ||
            error.message?.includes('already exists') ||
            error.code === '23505') {
          console.log(`     Statement ${index + 1} skipped (already exists)`);
          executedCount++;
          continue;
        }

        // Log other errors
        console.error(`  ❌ Error in statement ${index + 1}:`, error.message);
        console.error(`     Failed SQL: ${statement.substring(0, 200)}...`);
        throw error;
      }
    }

    console.log(`  ✅ ${migrationName} completed successfully!`);
    console.log(`     Executed ${executedCount}/${statements.length} statements`);
    return true;
  } catch (error: any) {
    console.log(`  ❌ ${migrationName} failed: ${error.message}`);
    return false;
  }
}

async function checkArtifactCount(): Promise<number> {
  try {
    const result = await sql`SELECT COUNT(*) as count FROM artifact_pool`;
    return parseInt(result[0].count as string);
  } catch (error) {
    // Table doesn't exist yet
    return -1;
  }
}

async function main() {
  try {
    // Define migrations in order
    const migrationsDir = join(import.meta.dir, "backend", "story", "migrations");
    const migrations = [
      { file: "9_create_artifact_pool.up.sql", name: "9_create_artifact_pool" },
      { file: "10_seed_artifact_pool.up.sql", name: "10_seed_artifact_pool" },
    ];

    // Check if artifact_pool table exists
    console.log("\n📊 Checking current artifact pool...");
    const count = await checkArtifactCount();
    if (count >= 0) {
      console.log(`  Found ${count} artifacts in database`);
      if (count >= 100) {
        console.log("  ⚠️  Database already has 100+ artifacts.");
        console.log("  Continuing anyway - duplicates will be skipped.\n");
      }
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

    // Check final count
    console.log(`\n📊 Final Results:`);
    console.log(`  Migrations executed: ${successCount}/${migrations.length}`);

    if (successCount === migrations.length) {
      const finalCount = await checkArtifactCount();
      console.log(`  Final artifact count: ${finalCount}`);

      console.log("\n🎉 SUCCESS! Artifact pool system is now set up!");
      console.log("\n📦 The system includes:");
      console.log("   - artifact_pool table with 100 predefined artifacts");
      console.log("   - story_artifacts table for tracking assignments");
      console.log("   - Bilingual support (German & English)");
      console.log("   - 4 rarity tiers: common, uncommon, rare, legendary");
      console.log("\n🚀 Next steps:");
      console.log("   1. Generate a new story on talea.website");
      console.log("   2. Read the story to the end");
      console.log("   3. See the artifact celebration modal! 🎁");
    } else {
      console.log(`\n⚠️  Only ${successCount}/${migrations.length} migrations completed.`);
    }

    // Close connection
    await sql.end();
  } catch (error: any) {
    console.error("\n❌ Fatal error:", error.message);
    await sql.end();
    process.exit(1);
  }
}

main().catch(console.error);
