#!/usr/bin/env bun
/**
 * Execute Tale DNA Seeding Migrations via Railway API.
 * Ref: execute-migrations-via-api.ts
 */

import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

const BACKEND_URL = "https://backend-2-production-3de1.up.railway.app";
const API_ENDPOINT = `${BACKEND_URL}/story/run-migration-sql`;

const migrations = [
    { file: "21_seed_all_tale_dna.up.sql", name: "21_seed_grimm_tale_dna" },
    { file: "21b_seed_andersen_tale_dna.sql", name: "21b_seed_andersen_tale_dna" },
    { file: "21c_seed_russian_tale_dna.sql", name: "21c_seed_russian_tale_dna" },
    { file: "21d_seed_classics_tale_dna.sql", name: "21d_seed_classics_tale_dna" }
];

async function runMigration(migrationPath: string, migrationName: string): Promise<boolean> {
    console.log(`\nRunning ${migrationName}...`);

    try {
        const content = await readFile(migrationPath, "utf-8");
        // Remove comments and process
        const sql = content
            .split("\n")
            .filter(line => !line.trim().startsWith("--"))
            .join("\n")
            .trim();
        console.log(`  SQL file size: ${sql.length} characters`);

        const response = await fetch(API_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                sql,
                migrationName,
            }),
        });

        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                console.log(`  OK: ${migrationName}`);
                if (result.message) console.log(`     ${result.message}`);
                if (result.statementsExecuted) {
                    console.log(`     Executed ${result.statementsExecuted} SQL statements`);
                }
                return true;
            }
            console.log(`  ERROR: ${migrationName}`);
            console.log(`     ${result.message || ""}`);
            return false;
        }

        console.log(`  ERROR: HTTP ${response.status}`);
        const text = await response.text();
        console.log(`     ${text}`);
        return false;
    } catch (error: any) {
        console.log(`  ERROR: ${error.message}`);
        return false;
    }
}

async function verifyTaleDNA(): Promise<void> {
    console.log("\nVerifying tale_dna count...");
    try {
        const verifySQL = "SELECT COUNT(*)::int as count FROM tale_dna;";
        const verifyResponse = await fetch(API_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                sql: verifySQL,
                migrationName: "verify_tale_dna_count",
            }),
        });

        if (verifyResponse.ok) {
            const json = await verifyResponse.json();
            console.log("  Verification Result:", json);
        }
    } catch (error: any) {
        console.log(`  WARN: Verification query failed: ${error.message}`);
    }
}

async function main() {
    console.log("Talea TaleDNA Seeding Runner");
    const migrationsDir = join(import.meta.dir, "backend", "story", "migrations");

    let successCount = 0;
    for (const migration of migrations) {
        const migrationPath = join(migrationsDir, migration.file);
        if (!existsSync(migrationPath)) {
            console.log(`\nSkipping missing migration file: ${migration.file}`);
            continue;
        }
        const success = await runMigration(migrationPath, migration.name);
        if (success) {
            successCount++;
        } else {
            console.log("\nMigration failed. Stopping here.");
            break;
        }
    }

    console.log(`\nFinal Results:`);
    console.log(`  Migrations executed: ${successCount}/${migrations.length}`);

    await verifyTaleDNA();
}

main().catch((error) => {
    console.error("Runner failed:", error);
    process.exit(1);
});
