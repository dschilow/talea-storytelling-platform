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
import type { BookPitch, BookPitchIdea, CatalogueEntry, ExperienceForm, SeriesMemory, StoryEngine, VillainStyle } from "./types";

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

/** One line per character, about 40-55 tokens (the bible adds a want and the marks that decide who may drive a book). */
export function catalogueLine(alias: string, entry: CatalogueEntry): string {
  const bits = [`${alias} ${entry.name}: ${clean(entry.whoTheyAre, 70)}`];
  if (entry.personality.length) bits.push(entry.personality.slice(0, 2).join(", "));
  if (entry.want) bits.push(`wants: ${clean(entry.want, 60)}`);
  if (entry.quirk) bits.push(`quirk: ${clean(entry.quirk, 60)}`);
  else if (entry.runningGag) bits.push(`gag: ${clean(entry.runningGag, 60)}`);
  if (entry.canLead) bits.push("can lead");
  if (entry.canOppose) bits.push(`can oppose${entry.villainStyle ? ` (${entry.villainStyle})` : ""}`);
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

// ---------------------------------------------------------------------------
// 2026-10-16, "Die rollende Woche": the pitch chose a heroes idea for a funny book although the catalogue offered
// opponents, cast nobody valid, and the fallback took the best genre match as a companion. The editor now decides.
// ---------------------------------------------------------------------------

/** Forms whose chosen idea must run on a villain or guest when the catalogue offers such a figure. */
export const ENGINE_FORCED_FORMS: ReadonlySet<ExperienceForm> = new Set<ExperienceForm>(["funny", "mystery"]);

/** The engine figure of an idea as a name: the pitch answers with catalogue aliases (P3) or ids, the plan needs the name. */
export function resolveEngineFigure(engineFigure: string | undefined, catalogue: CatalogueEntry[], series?: SeriesMemory | null): string | undefined {
  const key = clean(engineFigure, 80);
  if (!key || /^(null|none|kein|keine)\b/i.test(key)) return undefined;
  const byAlias = new Map(catalogueForPitch(catalogue, series).map(({ alias, entry }) => [alias.toUpperCase(), entry]));
  const entry = byAlias.get(key.toUpperCase()) || catalogue.find((candidate) => candidate.id === key) || catalogue.find((candidate) => mentionsName(key, candidate.name));
  return entry ? entry.name : key;
}

function fitsEngine(entry: Pick<CastCandidate, "canOppose" | "canLead">, engine: StoryEngine): boolean {
  return engine === "villain" ? Boolean(entry.canOppose) : engine === "guest" ? Boolean(entry.canLead) : Boolean(entry.canOppose || entry.canLead);
}

/** The best figure for an engine: the age's villain style first, then a portrait, then the one used least lately. */
export function bestEngineFigure(catalogue: CatalogueEntry[], engine: StoryEngine, options: { exclude?: Set<string>; style?: VillainStyle } = {}): CatalogueEntry | null {
  const exclude = options.exclude || new Set<string>();
  const fitting = catalogue.filter((entry) => !exclude.has(entry.id) && fitsEngine(entry, engine));
  const score = (entry: CatalogueEntry) => (engine === "villain" && options.style && entry.villainStyle === options.style ? 4 : 0) + (entry.hasImage ? 2 : 0) - Math.min(entry.recentUses, 2) * 0.5;
  return fitting.map((entry, index) => ({ entry, index })).sort((a, b) => score(b.entry) - score(a.entry) || a.index - b.index)[0]?.entry || null;
}

export interface IdeaChoiceInput {
  form: ExperienceForm;
  catalogue: CatalogueEntry[];
  series?: SeriesMemory | null;
  recentBookEngines?: StoryEngine[];
  max: number;
}

function poolOffersEngine(catalogue: CatalogueEntry[]): boolean {
  return catalogue.some((entry) => entry.canOppose || entry.canLead);
}

/**
 * The editor's choice among the three ideas: the pitch's own choice counts, but an idea that repeats the last book's
 * engine, runs on heroes in a funny or mystery book although the pool offers opponents, or casts nobody from the pool
 * loses against one that does not. A series with a star prefers the idea that gives the star its role.
 */
export function chooseIdea(pitch: BookPitch, input: IdeaChoiceInput): { index: number; notes: string[] } {
  const last = input.series ? undefined : input.recentBookEngines?.[0];
  const forced = !input.series && input.form !== "cozy" && ENGINE_FORCED_FORMS.has(input.form) && poolOffersEngine(input.catalogue);
  const starId = input.series?.starId;
  const scored = pitch.ideas.map((idea, index) => {
    const engine = idea.engine || "heroes";
    const casting = resolveCasting(idea, input.catalogue, input.max, input.series);
    const reasons: string[] = [];
    let score = index === pitch.choice - 1 ? 2 : 0;
    if (input.form === "cozy" && engine === "villain") { score -= 10; reasons.push("Gegenspieler in einem gemütlichen Buch"); }
    if (casting.cast.length > 0) score += 2; else { score -= 2; reasons.push("keine gültige Pool-Besetzung"); }
    if (last && engine === last) { score -= 3; reasons.push(`Motor ${engine} wie im letzten Buch`); }
    if (forced && engine === "heroes") { score -= 3; reasons.push(`Motor heroes in einem ${input.form}-Buch, obwohl der Pool Gegner und Gäste bietet`); }
    if (starId && (casting.roles.some((role) => role.id === starId) || (idea.engineFigure && resolveEngineFigure(idea.engineFigure, input.catalogue, input.series) === input.series?.starName))) score += 2;
    return { index, score, reasons };
  });
  if (!scored.length) return { index: 0, notes: [] };
  const best = [...scored].sort((a, b) => b.score - a.score || a.index - b.index)[0];
  const original = scored[pitch.choice - 1];
  const notes: string[] = [];
  if (original && best.index !== original.index) notes.push(`Idee ${best.index + 1} statt ${pitch.choice}: ${original.reasons.join(", ") || "die andere Idee passt besser"}.`);
  return { index: best.index, notes };
}

export interface ForcedEngine {
  idea: BookPitchIdea;
  casting: CastingResult;
  note: string;
}

/**
 * Assigns the engine when the chosen idea still breaks the rule (all three ideas came back on heroes, or on last
 * book's engine): a villain from the catalogue's "can oppose" figures, else a guest from "can lead", else nothing.
 * The planner gets engineNote and rebuilds the premise around that figure; the plan checks enforce the rest.
 */
export function forceEngine(idea: BookPitchIdea, casting: CastingResult, input: IdeaChoiceInput & { style?: VillainStyle }): ForcedEngine | null {
  if (input.series || input.form === "cozy") return null;
  const engine = idea.engine || "heroes";
  const last = input.recentBookEngines?.[0];
  const byForm = ENGINE_FORCED_FORMS.has(input.form) && engine === "heroes" && poolOffersEngine(input.catalogue);
  const byHistory = Boolean(last) && engine === last;
  if (!byForm && !byHistory) return null;
  const targets: StoryEngine[] = (engine === "heroes" ? ["villain", "guest"] : engine === "villain" ? ["guest", "villain"] : ["villain", "guest"]).filter((target) => target !== last && target !== engine) as StoryEngine[];
  const castIds = new Set(casting.roles.map((role) => role.id));
  for (const target of targets) {
    const inCast = casting.cast.find((member) => fitsEngine(member, target));
    const figure = inCast || bestEngineFigure(input.catalogue, target, { exclude: castIds, style: input.style });
    if (!figure) continue;
    const role = target === "villain" ? "opponent" : "guest";
    const why = `vom Lektorat besetzt: ${clean(figure.want ? `will ${figure.want}` : figure.quirk || figure.whoTheyAre, 120)}`;
    let roles = casting.roles.filter((entry) => entry.id !== figure.id);
    if (roles.length >= input.max) roles = roles.slice(0, input.max - 1);
    roles = [{ id: figure.id, role, why }, ...roles];
    const byId = new Map(input.catalogue.map((entry) => [entry.id, entry]));
    const cast = roles.map((entry) => byId.get(entry.id) || casting.cast.find((member) => member.id === entry.id)!).filter(Boolean);
    const reason = byForm ? `ein ${input.form}-Buch läuft nicht auf dem Helden-Motor, wenn der Pool Gegner bietet` : `Motor ${engine} wie im letzten Buch`;
    const engineNote = target === "villain"
      ? `The editor assigned the villain engine: ${figure.name} (${clean(figure.whoTheyAre, 80)}${figure.want ? `; wants ${clean(figure.want, 60)}` : ""}) has a plan of their own that causes the trouble of this idea. The heroes do not know it at first; the listening child does. Rebuild the premise around that plan without changing the wonder or the heroes' personal reason.`
      : `The editor assigned the guest engine: ${figure.name} (${clean(figure.whoTheyAre, 80)}${figure.want ? `; wants ${clean(figure.want, 60)}` : ""}) is the guest with a mission and a secret; the heroes hide and help them. Rebuild the premise around that mission without changing the wonder or the heroes' personal reason.`;
    return {
      idea: { ...idea, engine: target, engineFigure: figure.name, engineNote },
      casting: { cast, roles, notes: [...casting.notes] },
      note: `Motor erzwungen: ${target} mit ${figure.name} (${reason}).`,
    };
  }
  return null;
}

/**
 * The companion when the idea cast nobody valid: a figure that fits the engine (villain → "can oppose", guest → "can
 * lead"), else one that can carry a plot, else the best genre match. The engine figure follows when the idea has none.
 */
export function fallbackCasting(idea: BookPitchIdea, catalogue: CatalogueEntry[], casting: CastingResult, style?: VillainStyle): { idea: BookPitchIdea; casting: CastingResult } {
  if (casting.cast.length > 0 || catalogue.length === 0) return { idea, casting };
  const engine = idea.engine || "heroes";
  const figure = bestEngineFigure(catalogue, engine, { style }) || bestEngineFigure(catalogue, "heroes") || catalogue[0];
  const fits = fitsEngine(figure, engine) && engine !== "heroes";
  const role = fits ? (engine === "villain" ? "opponent" : "guest") : "Begleiter";
  const why = fits ? `passt zum Motor ${engine}: ${clean(figure.want ? `will ${figure.want}` : figure.whoTheyAre, 100)}` : "passt am besten zum Genre";
  const nextIdea = fits && (!idea.engineFigure || !catalogue.some((entry) => mentionsName(idea.engineFigure!, entry.name))) ? { ...idea, engineFigure: figure.name } : idea;
  return {
    idea: nextIdea,
    casting: { cast: [figure], roles: [{ id: figure.id, role, why }], notes: [...casting.notes, `Keine gültige Besetzung — ${fits ? `${figure.name} als ${role} für den Motor ${engine} gesetzt` : "bestpassende Pool-Figur als Begleiter gesetzt"}.`] },
  };
}
