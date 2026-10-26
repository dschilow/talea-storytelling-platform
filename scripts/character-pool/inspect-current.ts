import { readFile } from "node:fs/promises";

const [source, offset = "0", limit = "30"] = process.argv.slice(2);
const raw = JSON.parse(await readFile(source, "utf8"));
const rows: any[] = Array.isArray(raw) ? raw : raw.characters;
const groups = new Map<string, any[]>();
for (const row of rows) {
  const key = row.name.normalize("NFC").trim().toLocaleLowerCase("de-DE");
  groups.set(key, [...(groups.get(key) || []), row]);
}
for (const group of [...groups.values()].slice(Number(offset), Number(offset) + Number(limit))) {
  const row = group.find(r => r.imageUrl?.trim()) || group[0];
  console.log(JSON.stringify(Object.fromEntries(["name", "role", "want", "fear", "secret", "runningGag", "canLead", "canOppose", "speechStyle"].map(key => [key, row[key]]))));
}
