
import { readFile } from "fs/promises";
import { join } from "path";

const BACKEND_URL = "https://backend-2-production-3de1.up.railway.app";
const API_ENDPOINT = `${BACKEND_URL}/story/run-migration-sql`;

async function getCount() {
    try {
        const verifySQL = "SELECT COUNT(*)::int as count FROM tale_dna;";
        const response = await fetch(API_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sql: verifySQL, migrationName: "check_count" }),
        });
        const json = await response.json();
        console.log("Current tale_dna count:", json);
    } catch (e) {
        console.error(e);
    }
}

getCount();
