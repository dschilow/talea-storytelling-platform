
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const BACKEND_URL = "https://backend-2-production-3de1.up.railway.app";
const API_ENDPOINT = `${BACKEND_URL}/story/run-migration-sql`;

const migrations = [
    { file: "21d_seed_classics_tale_dna.sql", name: "21d_seed_classics_tale_dna" }
];

async function runMigration(migrationPath: string, migrationName: string) {
    console.log(`\nRunning ${migrationName}...`);
    try {
        const content = await readFile(migrationPath, "utf-8");
        const sql = content.split("\n").filter(line => !line.trim().startsWith("--")).join("\n").trim();

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
}

main();
