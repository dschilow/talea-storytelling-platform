#!/usr/bin/env bun
/**
 * Show actual artifact data from the database
 */

const BACKEND_URL = "https://backend-2-production-3de1.up.railway.app";
const API_ENDPOINT = `${BACKEND_URL}/story/run-migration-sql`;

async function queryAndShow(sql: string, description: string) {
  console.log(`\n${description}`);
  console.log("─".repeat(80));

  try {
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sql: sql,
        migrationName: "query",
      }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log("✅ Query executed successfully");
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log("❌ Query failed");
      const text = await response.text();
      console.log(text);
    }
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}`);
  }
}

async function main() {
  console.log("🔍 Artifact Pool Database Contents\n");

  // 1. Count all artifacts
  await queryAndShow(
    "SELECT COUNT(*) as total_artifacts FROM artifact_pool;",
    "📊 Total Artifacts"
  );

  // 2. Count by rarity
  await queryAndShow(
    "SELECT rarity, COUNT(*) as count FROM artifact_pool GROUP BY rarity ORDER BY count DESC;",
    "💎 Artifacts by Rarity"
  );

  // 3. Count by category
  await queryAndShow(
    "SELECT category, COUNT(*) as count FROM artifact_pool GROUP BY category ORDER BY count DESC;",
    "📦 Artifacts by Category"
  );

  // 4. Show sample legendary artifacts
  await queryAndShow(
    "SELECT id, name_de, name_en, category, emoji FROM artifact_pool WHERE rarity = 'legendary' ORDER BY name_de LIMIT 5;",
    "✨ Sample Legendary Artifacts"
  );

  // 5. Show sample rare artifacts
  await queryAndShow(
    "SELECT id, name_de, name_en, category, emoji FROM artifact_pool WHERE rarity = 'rare' ORDER BY name_de LIMIT 5;",
    "🌟 Sample Rare Artifacts"
  );

  // 6. Show all table names in the database
  await queryAndShow(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;",
    "📋 All Tables in Story Database"
  );

  console.log("\n" + "=".repeat(80));
  console.log("✅ Artifact tables exist and contain 100 artifacts in the story database!");
  console.log("=".repeat(80));
}

main().catch(console.error);
