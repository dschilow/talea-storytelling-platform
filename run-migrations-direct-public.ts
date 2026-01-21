#!/usr/bin/env bun
import { readFile } from "fs/promises";
import { join } from "path";
import postgres from "postgres";

// Use Railway PUBLIC URL (TCP Proxy)
// Format: postgresql://USER:PASSWORD@PROXY_DOMAIN:PROXY_PORT/DATABASE
const sql = postgres("postgresql://postgres:HqJVXXiJiVtiCOJuOmEatCjuTEULvpjr@junction.proxy.rlwy.net:10945/railway", {
  max: 1,
  ssl: false,
});

async function main() {
  console.log("🚀 Running migrations directly via TCP proxy...\n");

  const migrations = [
    "9_create_artifact_pool.up.sql",
    "9b_create_artifact_indexes.up.sql",
    "10_seed_artifact_pool.up.sql",
  ];

  for (const file of migrations) {
    console.log(`\n🔄 Running ${file}...`);
    const sqlContent = await readFile(join(import.meta.dir, "backend/story/migrations", file), "utf-8");
    
    try {
      await sql.unsafe(sqlContent);
      console.log(`  ✅ ${file} completed`);
    } catch (error: any) {
      console.log(`  ❌ ${file} failed: ${error.message}`);
      if (!error.message.includes("already exists")) {
        break;
      }
    }
  }

  const count = await sql`SELECT COUNT(*) as count FROM artifact_pool`;
  console.log(`\n📊 Final count: ${count[0].count} artifacts`);

  await sql.end();
  console.log("\n🎉 Done!");
}

main().catch(console.error);
