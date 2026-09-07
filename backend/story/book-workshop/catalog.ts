import type { Artifact, Person } from "./types";

type Row = Record<string, any>;
const string = (value: unknown, max = 350): string => typeof value === "string" ? value.trim().slice(0, max) : "";
const list = (value: unknown): string[] => Array.isArray(value) ? value.filter(v => typeof v === "string").slice(0, 8) : [];
function object(value: unknown): Row {
  if (typeof value === "string") { try { return object(JSON.parse(value)); } catch { return {}; } }
  return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
}
export const identityKey = (name: string): string => name.normalize("NFKC").trim().toLocaleLowerCase("de");

/** Supports both DB snake_case and the user's exported camelCase DNA. */
export function normalizePeople(rows: Row[], deduplicateNames = true): Person[] {
  const byName = new Map<string, Person>();
  for (const row of rows) {
    if (row.isActive === false || row.is_active === false) continue;
    const visual = object(row.visualProfile ?? row.visual_profile);
    const person: Person = {
      id: string(row.id), name: string(row.name, 100),
      description: string(row.backstory || row.description || row.physical_description),
      voice: list(row.speechStyle ?? row.speech_style),
      motivation: string(row.backstory || row.dominantPersonality || row.dominant_personality),
      quirk: string(row.quirk, 120),
      settings: list(row.canonSettings ?? row.canon_settings),
      imageUrl: string(row.imageUrl ?? row.image_url, 2000) || undefined,
      appearance: string(visual.imagePrompt || visual.description || row.physical_description || row.description, 500),
    };
    if (!person.id || !person.name) continue;
    const key = deduplicateNames ? identityKey(person.name) : person.id;
    const existing = byName.get(key);
    // Do not merge identities or modify DB rows. Pick the richest canonical
    // candidate deterministically; expose duplicates in the audit tool.
    const richness = (p: Person) => p.description.length + p.motivation.length + p.voice.length * 20 + (p.imageUrl ? 20 : 0);
    if (!existing || richness(person) > richness(existing) || (richness(person) === richness(existing) && person.id < existing.id)) byName.set(key, person);
  }
  return [...byName.values()];
}
export function normalizeArtifacts(rows: Row[], language: string): Artifact[] {
  return rows.filter(r => r.isActive !== false && r.is_active !== false).map(row => {
    const names = object(row.name);
    const rule = row.storyRole ?? row.story_role;
    return {
      id: string(row.id), name: string(names[language] || row[`name_${language}`] || names.de || names.en || row.name_de || row.name_en || row.name),
      // Never cut off a capability limit at the end of an artifact's DNA.
      rule: typeof rule === "string" ? rule.trim() : "",
      imageUrl: string(row.imageUrl ?? row.image_url, 2000) || undefined,
      appearance: list(row.visualKeywords ?? row.visual_keywords).join(", "),
    };
  }).filter(a => a.id && a.name && a.rule);
}
/** Shortlist for the planner; no preassigned villain/helper roles. */
export function shortlistPeople(people: Person[], heroes: Person[], setting: string, seed: string): Person[] {
  const excluded = new Set(heroes.map(p => identityKey(p.name)));
  const stable = (id: string) => [...seed + id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 0);
  return people.filter(p => !excluded.has(identityKey(p.name)))
    .sort((a, b) => Number(b.settings.includes(setting)) - Number(a.settings.includes(setting)) || stable(a.id) - stable(b.id))
    .slice(0, Math.max(2, 7 - heroes.length));
}
