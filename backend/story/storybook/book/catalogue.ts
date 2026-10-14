/**
 * Chapter book — idea-first casting.
 *
 * The picture book shortlists six pool characters BEFORE the idea exists
 * (cast-selection.ts), so the story is built around whoever was drawn. A book
 * carries its cast for twelve evenings: the writer first invents the idea and
 * the roles it needs, then casts each role from a compact catalogue of the
 * pool, saying which quirk makes that character funny or troublesome in THIS
 * story. The full profiles reach only the plan, for the chosen few.
 *
 * First live run (2026-10-14): 88 entries with UUIDs cost 10.7k prompt tokens
 * (2 ¢ of Sol input). Short aliases (P1 …) and the best-fitting 48 entries
 * keep the catalogue near 2k tokens.
 */

import { mentions } from "../checks";
import { shortlistCastCandidates } from "../cast-selection";
import type { AgeBand } from "../craft";
import type { CastCandidate } from "../types";
import type { BookPitchIdea, CatalogueEntry, SeriesMemory } from "./types";

type Row = Record<string, any>;

export const CATALOGUE_LIMIT = 48;

function clean(value: unknown, max = 200): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Pool data spells umlauts as ae/oe/ue ("Geraeusche-Fresser"); the writer spells them properly. */
export function foldUmlauts(value: string): string {
  return String(value || "")
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae").replace(/Ö/g, "Oe").replace(/Ü/g, "Ue").replace(/ß/g, "ss");
}

/** `mentions` that does not care how umlauts are spelled. */
export function mentionsName(text: string, name: string): boolean {
  return mentions(foldUmlauts(text), foldUmlauts(name));
}

/** Every active, non-duplicate pool character that does not clash with a hero's name; best genre fit first. */
export function buildCatalogue(input: {
  rows: Row[];
  genre?: string;
  setting?: string;
  band: AgeBand;
  excludeNames: Set<string>;
  seed: string;
}): CatalogueEntry[] {
  const candidates = shortlistCastCandidates({ ...input, limit: 500 });
  const byId = new Map(input.rows.map((row) => [String(row.id), row]));
  return candidates.map((candidate) => {
    const row = byId.get(candidate.id) || {};
    return {
      ...candidate,
      recentUses: Number(row.recent_usage_count ?? row.recentUsageCount) || 0,
      hasImage: Boolean(candidate.imageUrl),
    };
  });
}

/** The entries the casting call sees: series members first, then the best fit, each with a short alias. */
export function catalogueForPitch(catalogue: CatalogueEntry[], series?: SeriesMemory | null, limit = CATALOGUE_LIMIT): Array<{ alias: string; entry: CatalogueEntry }> {
  const seriesIds = new Set(series?.castIds || []);
  const ordered = [...catalogue.filter((entry) => seriesIds.has(entry.id)), ...catalogue.filter((entry) => !seriesIds.has(entry.id))];
  return ordered.slice(0, limit).map((entry, index) => ({ alias: `P${index + 1}`, entry }));
}

/** One line per character, about 40 tokens. */
export function catalogueLine(alias: string, entry: CatalogueEntry): string {
  const bits = [`${alias} ${entry.name}: ${clean(entry.whoTheyAre, 70)}`];
  if (entry.personality.length) bits.push(entry.personality.slice(0, 2).join(", "));
  if (entry.quirk) bits.push(`quirk: ${clean(entry.quirk, 60)}`);
  if (entry.recentUses >= 2) bits.push("used often lately");
  if (!entry.hasImage) bits.push("no portrait");
  return bits.join(" | ");
}

export interface CastingResult {
  cast: CastCandidate[];
  roles: Array<{ id: string; role: string; why: string }>;
  notes: string[];
}

/**
 * Turns the chosen idea's roles into a cast. Aliases and ids both count;
 * series members come first (a sequel keeps its friends), at most one new face
 * joins a series, and the volume never exceeds `max` pool characters.
 */
export function resolveCasting(idea: BookPitchIdea | undefined, catalogue: CatalogueEntry[], max: number, series?: SeriesMemory | null): CastingResult {
  const notes: string[] = [];
  const byId = new Map(catalogue.map((entry) => [entry.id, entry]));
  const byAlias = new Map(catalogueForPitch(catalogue, series).map(({ alias, entry }) => [alias.toUpperCase(), entry]));
  const lookup = (key: string) => byAlias.get(key.toUpperCase()) || byId.get(key);
  const roles: CastingResult["roles"] = [];
  const add = (id: string, role: string, why: string) => {
    if (!roles.some((entry) => entry.id === id)) roles.push({ id, role, why });
  };
  const seriesIds = (series?.castIds || []).filter((id) => byId.has(id));
  for (const id of seriesIds) add(id, "Figur der Reihe", "gehört schon zur Reihe");
  let newcomers = 0;
  for (const role of idea?.roles || []) {
    const key = clean(role.castId, 80);
    if (!key || /^(null|none|neu|new|keine?)$/i.test(key)) continue;
    const entry = lookup(key);
    if (!entry) {
      notes.push(`Unbekannte Figur „${key}“ für die Rolle „${clean(role.role, 60)}“ verworfen.`);
      continue;
    }
    if (seriesIds.includes(entry.id)) {
      const existing = roles.find((item) => item.id === entry.id);
      if (existing) Object.assign(existing, { role: clean(role.role, 80), why: clean(role.why, 200) });
      continue;
    }
    if (seriesIds.length > 0 && newcomers >= 1) {
      notes.push(`${entry.name} nicht besetzt: Eine Reihe bekommt pro Band höchstens eine neue Figur.`);
      continue;
    }
    if (roles.some((item) => item.id === entry.id)) continue;
    add(entry.id, clean(role.role, 80), clean(role.why, 200));
    newcomers += 1;
  }
  if (roles.length > max) notes.push(`Besetzung auf ${max} Pool-Figuren gekürzt.`);
  const kept = roles.slice(0, max);
  return { cast: kept.map((entry) => byId.get(entry.id)!).filter(Boolean), roles: kept, notes };
}
