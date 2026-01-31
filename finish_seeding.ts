
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const BACKEND_URL = "https://backend-2-production-3de1.up.railway.app";
const API_ENDPOINT = `${BACKEND_URL}/story/run-migration-sql`;

const migrations = [
    { file: "21c_seed_russian_tale_dna.sql", name: "21c_seed_russian_tale_dna" },
    { file: "21d_seed_classics_tale_dna.sql", name: "21d_seed_classics_tale_dna" }
];

async function runMigration(migrationPath: string, migrationName: string) {
    console.log(`\nRunning ${migrationName}...`);
    try {
        const content = await readFile(migrationPath, "utf-8");
        const sql = content.split("\n").filter(line => !line.trim().startsWith("--")).join("\n").trim();

        // Split lengthy SQL into smaller chunks if it's too large, or send as is if endpoint helps.
        // The previous runs suggest sending the whole block usually works unless it times out.
        // We will try sending it.

        const response = await fetch(API_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sql, migrationName }),
        });

        if (response.ok) {
            const result = await response.json();
            console.log(`  Result:`, result);
        } else {
            const txt = await response.text();
            console.log(`  Error (${response.status}):`, txt);
        }
    } catch (e: any) {
        console.error(`  Failed: ${e.message}`);
    }
}

async function main() {
    const migrationsDir = join(import.meta.dir, "backend", "story", "migrations");
    for (const m of migrations) {
        const path = join(migrationsDir, m.file);
        if (existsSync(path)) {
            await runMigration(path, m.name);
        } else {
            console.error(`Missing file: ${path}`);
        }
    }

    // Verify count at the end
    console.log("\nVerifying final count...");
    const verifySQL = "SELECT COUNT(*)::int as count FROM tale_dna;";
    const resp = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: verifySQL, migrationName: "verify_final" }),
    });
    console.log("Count:", await resp.json());
}

main();
