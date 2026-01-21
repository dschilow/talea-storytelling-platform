#!/usr/bin/env bun
/**
 * Connect directly to Railway Postgres and show all tables
 */

import postgres from "postgres";

// Railway Postgres credentials (from environment variables you shared)
const RAILWAY_TCP_PROXY_DOMAIN = "junction.proxy.rlwy.net";
const RAILWAY_TCP_PROXY_PORT = "10945";
const POSTGRES_USER = "postgres";
const POSTGRES_PASSWORD = "HqJVXXiJiVtiCOJuOmEatCjuTEULvpjr";
const POSTGRES_DB = "railway";

const DATABASE_PUBLIC_URL = `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${RAILWAY_TCP_PROXY_DOMAIN}:${RAILWAY_TCP_PROXY_PORT}/${POSTGRES_DB}`;

async function main() {
  console.log("🔍 Connecting to Railway Postgres Database...\n");
  console.log(`Host: ${RAILWAY_TCP_PROXY_DOMAIN}:${RAILWAY_TCP_PROXY_PORT}`);
  console.log(`Database: ${POSTGRES_DB}`);
  console.log(`User: ${POSTGRES_USER}\n`);

  let sql;
  try {
    sql = postgres(DATABASE_PUBLIC_URL, {
      ssl: "require",
      connect_timeout: 10,
    });

    console.log("✅ Connected!\n");

    // List all tables
    console.log("📋 ALL TABLES IN DATABASE:");
    console.log("=".repeat(80));
    const allTables = await sql`
      SELECT table_schema, table_name,
             (SELECT COUNT(*) FROM information_schema.columns WHERE columns.table_name = tables.table_name AND columns.table_schema = tables.table_schema) as column_count
      FROM information_schema.tables
      WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name
    `;

    for (const table of allTables) {
      console.log(
        `  ${table.table_schema}.${table.table_name} (${table.column_count} columns)`
      );
    }

    // Search for artifact tables
    console.log("\n🔍 SEARCHING FOR ARTIFACT TABLES:");
    console.log("=".repeat(80));
    const artifactTables = await sql`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_name LIKE '%artifact%'
      ORDER BY table_name
    `;

    if (artifactTables.length > 0) {
      console.log("✅ Found artifact tables:");
      for (const table of artifactTables) {
        console.log(`  ${table.table_schema}.${table.table_name}`);

        // Count rows
        try {
          const countResult = await sql`
            SELECT COUNT(*) as count
            FROM ${sql(table.table_schema)}.${sql(table.table_name)}
          `;
          console.log(`     → ${countResult[0].count} rows`);
        } catch (error) {
          console.log(`     → Could not count rows`);
        }
      }
    } else {
      console.log("❌ No tables with 'artifact' in the name found!");
    }

    // Search for story tables
    console.log("\n📖 STORY-RELATED TABLES:");
    console.log("=".repeat(80));
    const storyTables = await sql`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_name LIKE '%story%' OR table_name LIKE '%stories%'
      ORDER BY table_name
    `;

    for (const table of storyTables) {
      console.log(`  ${table.table_schema}.${table.table_name}`);
    }

    // Show all schemas
    console.log("\n📁 ALL SCHEMAS IN DATABASE:");
    console.log("=".repeat(80));
    const schemas = await sql`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY schema_name
    `;

    for (const schema of schemas) {
      console.log(`  ${schema.schema_name}`);
    }

    await sql.end();
    console.log("\n✅ Database inspection complete!");
  } catch (error: any) {
    console.error("\n❌ Error connecting to database:");
    console.error(error.message);
    console.error("\nFull error:", error);
  }
}

main().catch(console.error);
