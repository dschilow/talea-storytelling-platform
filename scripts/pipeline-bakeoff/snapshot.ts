import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
const root = "backend/story";
const dirs = ["episode", "wonder", "storybook", "book-workshop", "pipeline"];
const files = ["generate.ts", "standard-mode-generation.ts", "dev-mode-generation.ts", "storybook-mode-generation.ts", "book-generation.ts", "book-workshop-generation.ts"].map(p => join(root, p));
async function walk(dir: string) { for (const p of await readdir(dir, { withFileTypes: true })) if (p.isDirectory()) await walk(join(dir, p.name)); else if (p.name.endsWith(".ts")) files.push(join(dir, p.name)); }
for (const dir of dirs) await walk(join(root, dir));
const hashes = [];
for (const path of files.sort()) { const content = await readFile(path); hashes.push({ path: path.replaceAll("\\", "/"), sha256: createHash("sha256").update(content).digest("hex") }); }
await mkdir("Logs/pipeline-bakeoff/2026-10-26", { recursive: true });
await writeFile("Logs/pipeline-bakeoff/2026-10-26/baseline-sources.json", JSON.stringify({ created: new Date().toISOString(), files: hashes }, null, 2));
console.log(`Captured ${hashes.length} source hashes before unification.`);
