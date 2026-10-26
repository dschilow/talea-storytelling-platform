import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { leadNames } from "./editorial-2026-10-26";

const base = "exports/character-pool/2026-10-26";
const bytes = await readFile(`${base}/talea-characters-2026-10-26-optimiert.json`);
const output = JSON.parse(bytes.toString("utf8"));
const original = JSON.parse(await readFile(`${base}/original-unveraendert.json`, "utf8"));
const manifest = JSON.parse(await readFile(`${base}/pruefprotokoll.json`, "utf8"));
const byId = new Map(original.map((r: any) => [r.id, r]));
if (output.length !== 85 || new Set(output.map((r: any) => r.id)).size !== 85 || new Set(output.map((r: any) => r.name)).size !== 85) throw new Error("Unexpected count or duplicates");
if (output.filter((r: any) => r.canLead).length !== 25 || !output.every((r: any) => r.isActive && r.imageUrl)) throw new Error("Unexpected roles or activation");
if (output.filter((r: any) => /^Bäcker\s/.test(r.name)).length !== 1) throw new Error("More than one baker");
for (const row of output) {
  const before: any = byId.get(row.id);
  for (const field of ["name", "imageUrl", "visualProfile", "physical_description", "createdAt", "recentUsageCount", "totalUsageCount", "lastUsedAt"]) {
    if (JSON.stringify(row[field]) !== JSON.stringify(before[field])) throw new Error(`Identity or usage changed: ${row.name}.${field}`);
  }
  if (row.canLead !== leadNames.has(row.name)) throw new Error(`Wrong prominence: ${row.name}`);
}
for (const row of original.filter((r: any) => r.imageUrl && /hexe|magier|zauberer|kobold|fee|drache/i.test(r.name))) {
  if (!output.some((r: any) => r.id === row.id && r.isActive)) throw new Error(`Missing protected fantasy figure: ${row.name}`);
}
if (createHash("sha256").update(bytes).digest("hex") !== manifest.outputSHA256) throw new Error("Output hash differs from the audit");
const files = [
  "backend/story/character-pool-api.ts", "backend/story/character-pool-import.ts", "backend/story/storybook-mode-generation.ts",
  "backend/story/storybook/casting.ts", "backend/story/storybook/cast-selection.ts", "backend/story/episode/cast-focus.ts",
  "backend/story/episode/prompts.ts", "backend/story/episode/engine.ts", "frontend/screens/CharacterPool/CharacterPoolScreen.tsx",
];
for (const file of files) {
  const code = await readFile(file, "utf8");
  new Bun.Transpiler({ loader: file.endsWith(".tsx") ? "tsx" : "ts", target: "bun" }).transformSync(code);
}
console.log(JSON.stringify({ validJSON: true, uniqueFigures: 85, leads: 25, supporting: 60, bakers: 1,
  protectedFantasyFiguresKept: true, identitiesAndImagesPreserved: true, sourceCountersPreserved: true,
  syntaxCheckedFiles: files.length, fullBuild: "not run: directory traversal blocked by sandbox", hashMatchesAudit: true }));
