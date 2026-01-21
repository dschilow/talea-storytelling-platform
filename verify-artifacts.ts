#!/usr/bin/env bun
/**
 * Verify artifact pool exists and show sample data
 */

const BACKEND_URL = "https://backend-2-production-3de1.up.railway.app";
const API_ENDPOINT = `${BACKEND_URL}/story/run-migration-sql`;

async function main() {
  console.log("🔍 Talea Artifact Pool Verification\n");

  // Query artifact count and samples
  const sql = `
    SELECT
      (SELECT COUNT(*) FROM artifact_pool) as total_count,
      (SELECT COUNT(*) FROM artifact_pool WHERE rarity = 'common') as common_count,
      (SELECT COUNT(*) FROM artifact_pool WHERE rarity = 'uncommon') as uncommon_count,
      (SELECT COUNT(*) FROM artifact_pool WHERE rarity = 'rare') as rare_count,
      (SELECT COUNT(*) FROM artifact_pool WHERE rarity = 'legendary') as legendary_count;

    SELECT id, name_de, name_en, category, rarity FROM artifact_pool ORDER BY rarity DESC, name_de LIMIT 10;
  `;

  try {
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sql: sql,
        migrationName: "verify_artifacts",
      }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log("✅ Artifact pool exists!");
      console.log("\n📊 Summary:");
      console.log("   Run the following SQL to see artifact counts:");
      console.log("   SELECT COUNT(*) FROM artifact_pool;");
      console.log("   SELECT rarity, COUNT(*) FROM artifact_pool GROUP BY rarity;");
      console.log("\n🎁 Sample artifacts:");
      console.log("   SELECT name_de, category, rarity FROM artifact_pool LIMIT 10;");
    } else {
      console.log("❌ Error querying artifact pool");
      console.log(`   Status: ${response.status}`);
      const text = await response.text();
      console.log(`   Response: ${text}`);
    }
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}`);
  }
}

main().catch(console.error);
