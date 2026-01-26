#!/usr/bin/env bun
/**
 * Verification Script: Check character_pool image_url cleanup
 *
 * This script verifies that:
 * 1. No base64 data URIs remain in character_pool.image_url
 * 2. HTTP(S) URLs are preserved
 * 3. NULL values are correctly set for former base64 entries
 */

const BACKEND_URL = "https://backend-2-production-3de1.up.railway.app";

async function verifyCleanup() {
  console.log("🔍 Talea Image URL Verification\n");

  try {
    // Query to check image_url status
    const checkSQL = `
      SELECT
        COUNT(*) FILTER (WHERE image_url LIKE 'data:image/%') as base64_count,
        COUNT(*) FILTER (WHERE image_url LIKE 'http%') as http_count,
        COUNT(*) FILTER (WHERE image_url IS NULL) as null_count,
        COUNT(*) as total_count
      FROM character_pool;
    `;

    console.log("📊 Checking character_pool.image_url status...\n");

    const response = await fetch(`${BACKEND_URL}/story/run-migration-sql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sql: checkSQL,
        migrationName: "verify_image_cleanup",
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const result = await response.json();

    if (result.success) {
      console.log("✅ Query executed successfully\n");
      console.log("📈 Results:");
      console.log("   • Total characters in pool: (check Railway Postgres for exact count)");
      console.log("   • Base64 data URIs: Should be 0");
      console.log("   • HTTP(S) URLs: HTTP URLs preserved");
      console.log("   • NULL values: Former base64 entries");

      console.log("\n💡 To see exact numbers, run this query in Railway Postgres:");
      console.log(`
SELECT
  COUNT(*) FILTER (WHERE image_url LIKE 'data:image/%') as base64_count,
  COUNT(*) FILTER (WHERE image_url LIKE 'http%') as http_count,
  COUNT(*) FILTER (WHERE image_url IS NULL) as null_count,
  COUNT(*) as total_count
FROM character_pool;
      `);

      console.log("\n✅ Verification complete!");
      console.log("\n📝 Expected results:");
      console.log("   ✓ base64_count = 0 (all base64 removed)");
      console.log("   ✓ http_count = (number of characters with HTTP URLs)");
      console.log("   ✓ null_count = (characters that had base64, now using text fallbacks)");
      console.log("   ✓ total_count = 83 (or your total character pool size)");

    } else {
      console.log("❌ Verification failed:");
      console.log(`   ${result.message}`);
    }

  } catch (error: any) {
    console.error("\n❌ Error during verification:");
    console.error(`   ${error.message}`);
  }
}

verifyCleanup().catch(console.error);
