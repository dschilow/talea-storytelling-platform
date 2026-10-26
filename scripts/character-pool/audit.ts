/** Read-only inventory. Local seed previews are explicitly not live DB data. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { shortlistCastCandidates } from "../../backend/story/storybook/cast-selection";

const args = process.argv.slice(2);
const opt = (name: string, fallback: string) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const source = resolve(opt("--source", "Logs/talea-characters-2026-08-10T08-13-38-438Z.json"));
const out = resolve(opt("--out", "Logs/character-pool-audit/2026-10-26"));
const sourceData = JSON.parse(await readFile(source, "utf8"));
const rows: any[] = Array.isArray(sourceData) ? sourceData : sourceData.characters;
if (!Array.isArray(rows)) throw new Error("Expected a character array or {characters: []}.");
const sql = await readFile("backend/story/migrations/44_character_bible.up.sql", "utf8");
const declared = new Map<string, Record<string, unknown>>();
for (const match of sql.matchAll(/UPDATE character_pool SET([\s\S]*?)WHERE id = '([^']+)' AND bible_version = 0;/g)) {
  const values: Record<string, unknown> = {};
  for (const field of ["want", "fear", "secret", "running_gag", "gesture", "comic_role", "intro_line", "signature_visual"]) {
    const value = match[1].match(new RegExp(`\\b${field}\\s*=\\s*'((?:''|[^'])*)'`));
    if (value) values[field] = value[1].replace(/''/g, "'");
  }
  for (const field of ["can_lead", "can_oppose"]) values[field] = new RegExp(`\\b${field}\\s*=\\s*TRUE`, "i").test(match[1]);
  declared.set(match[2], values);
}
const group = (key: (r: any) => string) => {
  const result = new Map<string, any[]>();
  for (const row of rows) { const k = key(row); result.set(k, [...(result.get(k) || []), row]); }
  return result;
};
const groups = (key: (r: any) => string) => [...group(key)].map(([value, members]) => ({ value, count: members.length, names: members.map(r => r.name) })).sort((a, b) => b.count - a.count);
const duplicates = [...group(r => String(r.name || "").trim().toLocaleLowerCase("de-DE"))].filter(([, members]) => members.length > 1).map(([name, members]) => ({ name, ids: members.map(r => r.id), records: members.map(r => ({ id: r.id, name: r.name, activeAtExport: r.isActive, hasBackstory: Boolean(r.backstory), updatedAt: r.updatedAt })) }));
// This is a source-only scenario: August rows plus the declared October seed.
// It cannot establish which rows or bibles are present in the live pool today.
const seedPreview = rows.map(row => ({ ...row, ...declared.get(row.id) }));
const selectedPreview = shortlistCastCandidates({ rows: seedPreview, band: "6-8", excludeNames: new Set(), seed: "pool-audit", limit: rows.length });
const selectedByName = new Map(selectedPreview.map(row => [row.name.toLocaleLowerCase("de-DE"), row]));
const bibleShadowingPreview = seedPreview.filter(row => declared.has(row.id)).flatMap(row => {
  const selected = selectedByName.get(String(row.name).toLocaleLowerCase("de-DE"));
  return selected && selected.id !== row.id && !selected.want ? [{ name: row.name, bibleId: row.id, selectedId: selected.id, selectedHasImage: Boolean(selected.imageUrl) }] : [];
});
const fields = ["want", "fear", "secret", "runningGag", "gesture", "comicRole", "canLead", "canOppose", "bibleVersion"];
const summary = {
  source, observedAt: "2026-10-26", caveat: "Export is dated 2026-08-10. Declared seed bibles are an October source preview, not evidence of a production migration or current active state.",
  total: rows.length, activeAtExport: rows.filter(r => r.isActive).length,
  declaredBibleCount: declared.size, declaredBibleMatches: rows.filter(r => declared.has(r.id)).length,
  duplicateNames: duplicates,
  bibleShadowingPreview,
  fieldsPresentInExport: Object.fromEntries(fields.map(field => [field, rows.filter(r => r[field] !== undefined && r[field] !== null && r[field] !== "").length])),
  roles: groups(r => r.role || "unknown"), archetypes: groups(r => r.archetype || "unknown"),
  dominantPersonalities: groups(r => r.dominantPersonality || "unknown"),
  withoutBackstory: rows.filter(r => !r.backstory).map(r => ({ id: r.id, name: r.name })),
};
const profiles = rows.map(r => ({ id: r.id, name: r.name, activeAtExport: r.isActive, role: r.role, archetype: r.archetype,
  species: r.species_category || r.visualProfile?.species, dominant: r.dominantPersonality, secondary: r.secondaryTraits,
  catchphrase: r.catchphrase, quirk: r.quirk, speechStyle: r.speechStyle, backstory: r.backstory,
  settings: r.canonSettings, usageAtExport: r.totalUsageCount, maxScreenTime: r.maxScreenTime,
  declaredOctoberBible: declared.get(r.id) || null,
}));
await mkdir(out, { recursive: true });
await writeFile(join(out, "inventory.json"), JSON.stringify({ summary, profiles }, null, 2));
await writeFile(join(out, "profiles.md"), profiles.map((r, i) => `## ${i + 1}. ${r.name} [${r.id}]\n\nRolle: ${r.role}; Archetyp: ${r.archetype}; Wesen: ${r.species}; Orte: ${(r.settings || []).join(", ")}.\nNatur: ${[r.dominant, ...(r.secondary || [])].filter(Boolean).join(", ")}. Stimme: ${(r.speechStyle || []).join(", ")}.\nSpruch: ${r.catchphrase || "—"}\nMacke: ${r.quirk || "—"}\nVorgeschichte: ${r.backstory || "—"}\n${r.declaredOctoberBible ? `Oktober-Bibel (Seed, Live-Status ungeprüft): ${JSON.stringify(r.declaredOctoberBible)}\n` : ""}`).join("\n"));
console.log(JSON.stringify({ total: summary.total, uniqueNames: group(r => String(r.name || "").trim().toLocaleLowerCase("de-DE")).size,
  activeAtExport: summary.activeAtExport, duplicateNameGroups: duplicates.length,
  duplicateRecordsBeyondFirst: duplicates.reduce((n, d) => n + d.ids.length - 1, 0),
  declaredBibleCount: declared.size, declaredBibleMatches: summary.declaredBibleMatches,
  bibleShadowingPreviewCount: bibleShadowingPreview.length,
  fieldsPresentInExport: summary.fieldsPresentInExport, roles: summary.roles.map(({ value, count }) => ({ value, count })),
  duplicateNames: duplicates.map(d => ({ name: d.name, count: d.ids.length })), out }, null, 2));
