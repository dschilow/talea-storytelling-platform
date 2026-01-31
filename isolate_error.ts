
import { readFile } from "fs/promises";
import { join } from "path";

const BACKEND_URL = "https://backend-2-production-3de1.up.railway.app";
const API_ENDPOINT = `${BACKEND_URL}/story/run-migration-sql`;

async function runSQL(sql: string, name: string) {
    if (!sql.trim()) return;
    console.log(`Running: ${name} (length ${sql.length})`);
    try {
        const response = await fetch(API_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sql, migrationName: name }),
        });
        const json = await response.json();
        if (!json.success) {
            console.error(`  FAILED: ${json.message}`);
        } else {
            console.log(`  SUCCESS`);
        }
    } catch (e: any) {
        console.error(`  ERROR: ${e.message}`);
    }
}

async function main() {
    const path = join(import.meta.dir, "backend", "story", "migrations", "21d_seed_classics_tale_dna.sql");
    const content = await readFile(path, "utf-8");

    // Split by "INSERT INTO" manually, assuming standard formatting
    const chunks = content.split("INSERT INTO");

    for (let i = 1; i < chunks.length; i++) { // Skip first empty chunk before first INSERT
        const chunk = "INSERT INTO" + chunks[i];
        // Remove trailing semicolons/comments if splitting logic is needed, but here we just send the statement
        // Important: each chunk ends with ; usually.
        // We trim whitespace.
        const sql = chunk.trim();
        await runSQL(sql, `chunk_${i}`);
    }
}

main();
