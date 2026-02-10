#!/usr/bin/env node

/**
 * Run avatar migrations via backend API.
 *
 * Usage:
 *   node run-avatar-migration-api.cjs
 *   node run-avatar-migration-api.cjs 9
 *   node run-avatar-migration-api.cjs 9_add_memory_content_type
 *   node run-avatar-migration-api.cjs 9_add_memory_content_type.up.sql
 */

const fs = require("fs");
const path = require("path");

const BACKEND_URL = process.env.BACKEND_URL || "https://backend-2-production-3de1.up.railway.app";
const MIGRATIONS_DIR = path.join(__dirname, "backend", "avatar", "migrations");

function parseVersion(fileName) {
  const match = /^(\d+)_/.exec(fileName);
  return match ? Number.parseInt(match[1], 10) : -1;
}

function resolveMigrationFile(input) {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".up.sql"))
    .sort((a, b) => {
      const versionDiff = parseVersion(a) - parseVersion(b);
      return versionDiff !== 0 ? versionDiff : a.localeCompare(b);
    });

  if (files.length === 0) {
    throw new Error(`No .up.sql files found in ${MIGRATIONS_DIR}`);
  }

  if (!input) {
    return files[files.length - 1];
  }

  const normalizedInput = input.trim().toLowerCase();
  const exact = files.find((file) => file.toLowerCase() === normalizedInput);
  if (exact) {
    return exact;
  }

  const withSuffix = `${normalizedInput}.up.sql`;
  const suffixed = files.find((file) => file.toLowerCase() === withSuffix);
  if (suffixed) {
    return suffixed;
  }

  const prefixed = files.find((file) => file.toLowerCase().startsWith(`${normalizedInput}_`));
  if (prefixed) {
    return prefixed;
  }

  throw new Error(`Could not resolve migration '${input}'. Available: ${files.join(", ")}`);
}

async function runMigration(fileName) {
  const migrationPath = path.join(MIGRATIONS_DIR, fileName);
  const migrationName = fileName.replace(/\.up\.sql$/i, "");

  if (!fs.existsSync(migrationPath)) {
    throw new Error(`Migration file not found: ${migrationPath}`);
  }

  const sql = fs.readFileSync(migrationPath, "utf8");
  console.log(`\nRunning ${migrationName}...`);
  console.log(`SQL size: ${sql.length} characters`);

  const response = await fetch(`${BACKEND_URL}/avatar/run-migration-sql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      migrationSql: sql,
      migrationName,
    }),
  });

  const raw = await response.text();
  let result;
  try {
    result = JSON.parse(raw);
  } catch {
    throw new Error(`Unexpected response (${response.status}): ${raw}`);
  }

  if (!response.ok || !result.success) {
    const detail = result.error || result.message || raw;
    throw new Error(`Migration failed (${response.status}): ${detail}`);
  }

  console.log(`OK: ${result.message}`);
}

async function main() {
  const selection = process.argv[2];
  console.log("Talea Avatar Migration Runner (API Mode)");
  console.log(`Backend URL: ${BACKEND_URL}`);
  console.log(`Migrations dir: ${MIGRATIONS_DIR}`);

  const fileName = resolveMigrationFile(selection);
  await runMigration(fileName);
}

main().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
});
