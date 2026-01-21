#!/usr/bin/env bun
const BACKEND_URL = "https://backend-2-production-3de1.up.railway.app";
const API_ENDPOINT = `${BACKEND_URL}/story/run-migration-sql`;

const sql = `
CREATE TABLE IF NOT EXISTS test_table_proof (
  id TEXT PRIMARY KEY,
  test_data TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO test_table_proof (id, test_data) VALUES ('test1', 'This proves migrations work!');
INSERT INTO test_table_proof (id, test_data) VALUES ('test2', 'Created at ' || NOW()::TEXT);
`;

async function main() {
  console.log("Creating test table...\n");

  const response = await fetch(API_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sql, migrationName: "create_test_proof" }),
  });

  const result = await response.json();
  console.log(JSON.stringify(result, null, 2));

  if (result.success) {
    console.log("\n✅ Test table created!");
    console.log("\nNow check in Railway Postgres if you can see:");
    console.log("  - Table: test_table_proof");
    console.log("  - With 2 rows of data");
  }
}

main().catch(console.error);
