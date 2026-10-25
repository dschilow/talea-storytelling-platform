/**
 * The sound library — Encore-free.
 *
 * Every spot effect and ambience bed the sound generator makes is kept for all
 * stories, with a German name, a precise English description (source, action,
 * material, room, intensity, character) and keywords with synonyms. Sol words
 * the same footsteps differently in every screenplay, so the prompt-keyed sound
 * cache alone almost never found a sound again across episodes.
 *
 * Before a recording, every sound the screenplay asks for (a "wish") is cast:
 *   1. already cast (a re-recording) or word for word in the library → taken;
 *   2. a keyword search (BM25 over prompt, description and keywords) finds the
 *      candidates — library sounds and earlier new sounds of this episode;
 *   3. Luna decides strictly whether one sounds the same in this scene, and
 *      describes every sound that has to be made, so later stories find it.
 * A taken sound plays with the entry's prompt and length, so the studio mix
 * finds its audio in the sound cache under the same key. New sounds join the
 * library once their audio exists (trackSoundCache). Blocked entries are never
 * offered again; a screenplay that still names one is cast anew.
 */

import { soundCacheKey, type SoundCachePort } from "../../../doku/sound-cache";
import { parseJsonObject, type CostLedger, type StorybookLlm } from "../../storybook/llm";
import type { AudioScript } from "../types";
import { ambiencePrompt, spotSeconds } from "./timeline";

export type SoundKind = "sfx" | "ambience";

export interface SoundEntry {
  /** The storage key's hash: one entry per prompt and length (loops: per prompt). */
  id: string;
  kind: SoundKind;
  /** The screenplay's prompt the sound was generated from (ambience: without the mix suffix). */
  prompt: string;
  /** Length of a spot effect in seconds; 0 for an ambience loop (it is looped to any length). */
  seconds: number;
  /** German name for the Studio ("Holztür fällt leise ins Schloss"). */
  label: string;
  /** One English sentence: source, action, material, room, intensity, character. */
  description: string;
  /** English keywords with synonyms, lowercase. */
  tags: string[];
  /** Key of the audio in the sound cache (bucket: `library/<key>`). */
  storageKey: string;
  uses: number;
  /** Never offered again (a bad take); screenplays that name it are cast anew. */
  blocked: boolean;
  /** Where it was made first ("Bruno und Ella S1E1"). */
  origin?: string;
  createdAt?: string;
}

/** The library's storage: a database table in production, a JSON file in live tests. */
export interface SoundLibraryPort {
  list(): Promise<SoundEntry[]>;
  /** New entries; an id that exists keeps its (possibly edited) description. */
  add(entries: SoundEntry[]): Promise<void>;
  /** One use per recording. */
  markUsed(ids: string[]): Promise<void>;
}

/** A sound the screenplay asks for. */
export interface SoundWish {
  kind: SoundKind;
  prompt: string;
  /** Spot effects: the generated length (0.5–6 s); ambience: 0. */
  seconds: number;
  /** The library entry a re-recorded screenplay already names. */
  libraryId?: string;
}

/** What a wish plays: its own new sound or a library entry. */
export interface SoundChoice {
  prompt: string;
  seconds: number;
  libraryId: string;
  /** "library": the entry existed before; "episode": the same new sound as an earlier wish; "new": generated for this recording. */
  source: "library" | "episode" | "new";
}

export interface SoundPlan {
  /** By wishKey(). */
  choices: Map<string, SoundChoice>;
  /** Sounds this recording makes, with their descriptions; they join the library once their audio exists. */
  fresh: SoundEntry[];
  /** Library entries this recording plays. */
  used: string[];
  stats: {
    wishes: number;
    /** Played from library sounds made for other episodes or stories. */
    fromLibrary: number;
    /** The same new sound as an earlier wish of this episode. */
    sameInEpisode: number;
    fresh: number;
    /** Wishes Luna decided on. */
    askedLlm: number;
  };
}

/** Wishes Luna decides per request (an episode has about 60). */
const LLM_BATCH = 40;
const CANDIDATES: Record<SoundKind, number> = { sfx: 6, ambience: 4 };
/** A candidate needs at least this share of the best candidate's score. */
const RELATIVE_FLOOR = 0.35;

export function soundStorageKey(kind: SoundKind, prompt: string, seconds: number): string {
  return kind === "ambience" ? soundCacheKey("ambience", ambiencePrompt(prompt), 18, true) : soundCacheKey("sfx", prompt, spotSeconds(seconds), false);
}

export const soundIdOf = (storageKey: string): string => storageKey.split("/").pop()!.replace(/\.mp3$/, "");

const normalizePrompt = (prompt: string): string => prompt.toLowerCase().replace(/\s+/g, " ").replace(/[.\s]+$/, "").trim();

export function wishKey(wish: Pick<SoundWish, "kind" | "prompt" | "seconds">): string {
  return `${wish.kind}|${normalizePrompt(wish.prompt)}|${wish.kind === "sfx" ? spotSeconds(wish.seconds) : 0}`;
}

/** Every distinct sound of a screenplay, in order of appearance. */
export function soundWishes(script: Pick<AudioScript, "parts">): SoundWish[] {
  const wishes = new Map<string, SoundWish>();
  const add = (wish: SoundWish) => {
    const key = wishKey(wish);
    if (!wishes.has(key)) wishes.set(key, wish);
  };
  for (const part of script.parts) {
    for (const scene of part.scenes) {
      const prompt = scene.ambience?.trim();
      if (prompt) add({ kind: "ambience", prompt, seconds: 0, ...(scene.ambienceLibraryId ? { libraryId: scene.ambienceLibraryId } : {}) });
    }
    for (const line of part.lines) {
      for (const sound of line.sounds ?? []) {
        const prompt = sound.sound.trim();
        if (prompt) add({ kind: "sfx", prompt, seconds: spotSeconds(sound.seconds), ...(sound.libraryId ? { libraryId: sound.libraryId } : {}) });
      }
    }
  }
  return [...wishes.values()];
}

/**
 * A spot effect plays in full, so a stored one fits when its length is close to
 * the wish (±0.5 s, or 70–150 %). Loops fit any length.
 */
export function lengthFits(kind: SoundKind, have: number, want: number): boolean {
  if (kind === "ambience") return true;
  const ratio = have / Math.max(0.1, want);
  return Math.abs(have - want) <= 0.5 || (ratio >= 0.7 && ratio <= 1.5);
}

/* ── Keyword search ─────────────────────────────────────────────────────── */

const STOPWORDS = new Set(
  "a an the of on in into onto with without and or to from at by for its it is as are be no not very one two few some several like that this than then over under through across against while each other just small".split(" "),
);

/** "closing", "closes", "closed", "close" → "clos"; "dripping" → "drip"; "footsteps" → "footstep". */
export function stemWord(word: string): string {
  let stem = word;
  if (stem.length > 4 && stem.endsWith("ies")) stem = `${stem.slice(0, -3)}y`;
  else if (stem.length > 3 && stem.endsWith("s") && !stem.endsWith("ss")) stem = stem.slice(0, -1);
  let suffixed = false;
  if (stem.length > 5 && stem.endsWith("ing")) {
    stem = stem.slice(0, -3);
    suffixed = true;
  } else if (stem.length > 4 && stem.endsWith("ed")) {
    stem = stem.slice(0, -2);
    suffixed = true;
  }
  if (suffixed && /([^aeioulsz])\1$/.test(stem)) stem = stem.slice(0, -1);
  if (stem.length > 3 && stem.endsWith("e")) stem = stem.slice(0, -1);
  return stem;
}

export function soundTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1 && !STOPWORDS.has(word))
    .map(stemWord);
}

interface SearchDoc {
  id: string;
  kind: SoundKind;
  seconds: number;
  terms: Map<string, number>;
  length: number;
}

function searchDoc(id: string, kind: SoundKind, seconds: number, text: string): SearchDoc {
  const terms = new Map<string, number>();
  const tokens = soundTokens(text);
  for (const token of tokens) terms.set(token, (terms.get(token) ?? 0) + 1);
  return { id, kind, seconds, terms, length: tokens.length };
}

/** Okapi BM25 over the given documents. */
function bm25(docs: SearchDoc[]): (query: string[], doc: SearchDoc) => { score: number; shared: number } {
  const df = new Map<string, number>();
  for (const doc of docs) for (const term of doc.terms.keys()) df.set(term, (df.get(term) ?? 0) + 1);
  const avgLength = docs.reduce((sum, doc) => sum + doc.length, 0) / Math.max(1, docs.length) || 1;
  const k1 = 1.2;
  const b = 0.75;
  return (query, doc) => {
    let score = 0;
    let shared = 0;
    for (const term of new Set(query)) {
      const tf = doc.terms.get(term);
      if (!tf) continue;
      shared += 1;
      const n = df.get(term) ?? 0;
      const idf = Math.log(1 + (docs.length - n + 0.5) / (n + 0.5));
      score += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * doc.length) / avgLength)));
    }
    return { score, shared };
  };
}

export interface SoundCandidate {
  /** Library entry id, or "w<index>" for an earlier wish of this episode. */
  ref: string;
  kind: SoundKind;
  seconds: number;
  text: string;
}

const entryText = (entry: SoundEntry): string => `${entry.prompt} ${entry.description} ${entry.tags.join(" ")} ${entry.tags.join(" ")}`;

/**
 * Candidates per wish: library sounds of the same kind and a fitting length,
 * and earlier wishes of this episode (they may become one shared new sound).
 * `open[i]` = wish i still needs a decision.
 */
export function findCandidates(wishes: SoundWish[], library: SoundEntry[], open: boolean[]): SoundCandidate[][] {
  const entries = library.filter((entry) => !entry.blocked);
  const entryDocs = entries.map((entry) => searchDoc(entry.id, entry.kind, entry.seconds, entryText(entry)));
  const wishDocs = wishes.map((wish, index) => searchDoc(`w${index}`, wish.kind, wish.seconds, wish.prompt));
  const score = bm25([...entryDocs, ...wishDocs]);
  const textOf = new Map<string, string>([
    ...entries.map((entry): [string, string] => [entry.id, `${entry.description} [${entry.tags.join(", ")}]`]),
    ...wishes.map((wish, index): [string, string] => [`w${index}`, wish.prompt]),
  ]);

  return wishes.map((wish, index) => {
    if (!open[index]) return [];
    const query = soundTokens(wish.prompt);
    if (!query.length) return [];
    const pool = [...entryDocs, ...wishDocs.slice(0, index).filter((_, earlier) => open[earlier])].filter(
      (doc) => doc.kind === wish.kind && lengthFits(wish.kind, doc.seconds, wish.seconds),
    );
    const minShared = Math.min(2, new Set(query).size);
    const scored = pool
      .map((doc) => ({ doc, ...score(query, doc) }))
      .filter((hit) => hit.score > 0 && hit.shared >= minShared)
      .sort((a, b) => b.score - a.score);
    const best = scored[0]?.score ?? 0;
    return scored
      .filter((hit) => hit.score >= best * RELATIVE_FLOOR)
      .slice(0, CANDIDATES[wish.kind])
      .map((hit) => ({ ref: hit.doc.id, kind: hit.doc.kind, seconds: hit.doc.seconds, text: textOf.get(hit.doc.id) ?? "" }));
  });
}

/* ── Luna: same sound or a new one ──────────────────────────────────────── */

const SYSTEM = `Du bist Tonmeister einer Hörspiel-Werkstatt für Kinder. Alle Geschichten teilen sich eine Geräusche-Bibliothek. Für jeden Geräusch-Wunsch aus einem Drehbuch entscheidest du: Klingt ein vorhandenes Geräusch (aus der Bibliothek oder ein früherer Wunsch dieser Folge, der neu erzeugt wird) in dieser Szene GLEICH, nimmst du es. Sonst wird der Wunsch neu erzeugt — dann beschreibst du ihn so genau, dass spätere Geschichten ihn finden.

Ein Treffer braucht ALLES davon:
- dieselbe Quelle und dieselbe Handlung (Tür geht auf ≠ Tür fällt zu; Hund bellt ≠ Hund hechelt; Schritte auf Holz ≠ Schritte im Kies; ein Glöckchen ≠ eine Kirchenglocke),
- ähnliches Material, ähnliche Größe und Stärke (leise ≠ laut, winzig ≠ riesig),
- dieselbe Stimmung (komisch ≠ unheimlich ≠ neutral),
- einen passenden Raum, wenn man ihn hört (Hall im Treppenhaus, weite Wiese, enges Zimmer); bei nahen, trockenen Geräuschen zählt der Raum kaum.
Atmosphären: derselbe Ortstyp, dieselbe Tageszeit, dasselbe Wetter, dieselben Hauptquellen; eine fehlende leise Nebenquelle ist egal.
Im Zweifel: neu. Ein falsches Geräusch stört das Kind mehr als ein paar Cent für ein neues.

Für einen neuen Wunsch schreibst du:
- "label": deutscher Kurzname, höchstens 60 Zeichen, z. B. "Holztür fällt leise ins Schloss".
- "description": EIN englischer Satz, der genau sagt, was man hört: Quelle, Handlung, Material oder Oberfläche, Raum, Stärke, Charakter. Z. B. "A wooden interior door swings shut softly and the metal latch clicks, dry small room, gentle, everyday."
- "tags": 6 bis 12 englische Stichwörter, klein geschrieben, mit Synonymen, z. B. ["door","wooden","close","shut","latch","click","indoor","room"].

Antworte nur als JSON: {"sounds":[{"i":0,"use":"L1"},{"i":1,"label":"…","description":"…","tags":["…"]}]}
"use" darf nur eine der beim Wunsch genannten Kennungen sein.`;

interface LlmVerdict {
  use?: string;
  label?: string;
  description?: string;
  tags?: string[];
}

export interface SoundCastingInput {
  script: Pick<AudioScript, "parts">;
  library: SoundEntry[];
  llm?: StorybookLlm;
  ledger?: CostLedger;
  model: string;
  /** "Bruno und Ella S1E1". */
  origin: string;
  log?: (message: string) => void;
}

function describeFallback(wish: SoundWish): Pick<SoundEntry, "label" | "description" | "tags"> {
  const words = wish.prompt.toLowerCase().split(/[^a-z]+/).filter((word) => word.length > 2 && !STOPWORDS.has(word));
  return { label: wish.prompt.slice(0, 60), description: wish.prompt, tags: [...new Set(words)].slice(0, 10) };
}

function cleanDescription(verdict: LlmVerdict | undefined, wish: SoundWish): Pick<SoundEntry, "label" | "description" | "tags"> {
  const fallback = describeFallback(wish);
  const label = String(verdict?.label ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  const description = String(verdict?.description ?? "").replace(/\s+/g, " ").trim().slice(0, 320);
  const tags = Array.isArray(verdict?.tags)
    ? [...new Set(verdict!.tags.map((tag) => String(tag).toLowerCase().replace(/[^a-z -]/g, "").trim()).filter((tag) => tag.length > 1 && tag.length <= 30))].slice(0, 12)
    : [];
  return { label: label || fallback.label, description: description || fallback.description, tags: tags.length >= 3 ? tags : [...new Set([...tags, ...fallback.tags])].slice(0, 12) };
}

const secondsLabel = (kind: SoundKind, seconds: number): string => (kind === "ambience" ? "Schleife" : `${seconds} s`);

async function askLuna(
  input: SoundCastingInput,
  batch: number[],
  wishes: SoundWish[],
  candidates: SoundCandidate[][],
): Promise<Map<number, LlmVerdict>> {
  const verdicts = new Map<number, LlmVerdict>();
  if (!input.llm) return verdicts;
  // Short aliases (L1, L2 …) instead of 20-character ids: fewer tokens, no typos.
  const aliasToRef = new Map<string, string>();
  const refToAlias = new Map<string, string>();
  const aliasOf = (ref: string) => {
    if (ref.startsWith("w")) return `W${ref.slice(1)}`;
    let alias = refToAlias.get(ref);
    if (!alias) {
      alias = `L${refToAlias.size + 1}`;
      refToAlias.set(ref, alias);
      aliasToRef.set(alias, ref);
    }
    return alias;
  };
  const lines = batch.map((index) => {
    const wish = wishes[index];
    const offered = candidates[index].map((candidate) => `   ${aliasOf(candidate.ref)} (${secondsLabel(candidate.kind, candidate.seconds)}${candidate.ref.startsWith("w") ? ", früherer Wunsch dieser Folge" : ""}): ${candidate.text}`);
    return [`#${index} ${wish.kind === "ambience" ? "Atmosphäre" : "Effekt"}, ${secondsLabel(wish.kind, wish.seconds)}: ${wish.prompt}`, ...(offered.length ? offered : ["   (kein Kandidat — neu beschreiben)"])].join("\n");
  });
  const user = `Geräusch-Wünsche aus dem Drehbuch von ${input.origin}:\n\n${lines.join("\n\n")}`;
  const result = await input.llm({ stage: "library-audio-sounds", role: "support", model: input.model, system: SYSTEM, user, json: true, maxTokens: 12000, effort: "low", timeoutMs: 180_000 });
  input.ledger?.recordCall("library-audio-sounds", result, "support");
  const parsed = parseJsonObject<{ sounds?: unknown[] }>(result.text);
  for (const raw of parsed?.sounds ?? []) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as Record<string, unknown>;
    const index = Number(entry.i);
    if (!batch.includes(index)) continue;
    const alias = String(entry.use ?? "").trim().toUpperCase();
    const ref = alias.startsWith("W") ? `w${alias.slice(1)}` : aliasToRef.get(alias);
    const offered = ref && candidates[index].some((candidate) => candidate.ref === ref);
    verdicts.set(index, {
      ...(offered ? { use: ref } : {}),
      label: typeof entry.label === "string" ? entry.label : undefined,
      description: typeof entry.description === "string" ? entry.description : undefined,
      tags: Array.isArray(entry.tags) ? entry.tags.map(String) : undefined,
    });
  }
  return verdicts;
}

/**
 * Decides what every sound of the screenplay plays. Does not touch the
 * screenplay (applySoundPlan does), so it can run while the voices record.
 * Never throws for the model: without an answer every open wish is new.
 */
export async function planSoundCasting(input: SoundCastingInput): Promise<SoundPlan> {
  const say = input.log ?? (() => undefined);
  const wishes = soundWishes(input.script);
  const byId = new Map(input.library.filter((entry) => !entry.blocked).map((entry) => [entry.id, entry]));
  const byPrompt = new Map<string, SoundEntry>();
  for (const entry of byId.values()) byPrompt.set(wishKey(entry), entry);

  const choices: Array<SoundChoice | null> = wishes.map((wish) => {
    const entry = (wish.libraryId ? byId.get(wish.libraryId) : undefined) ?? byPrompt.get(wishKey(wish));
    // A re-recording keeps the sounds its screenplay names (as long as they are not blocked).
    return entry ? { prompt: entry.prompt, seconds: entry.seconds, libraryId: entry.id, source: "library" } : null;
  });
  const open = choices.map((choice) => choice === null);
  const candidates = findCandidates(wishes, input.library, open);
  const openIndexes = wishes.map((_, index) => index).filter((index) => open[index]);

  const verdicts = new Map<number, LlmVerdict>();
  for (let from = 0; from < openIndexes.length; from += LLM_BATCH) {
    const batch = openIndexes.slice(from, from + LLM_BATCH);
    try {
      for (const [index, verdict] of await askLuna(input, batch, wishes, candidates)) verdicts.set(index, verdict);
    } catch (error) {
      say(`sound library: casting call failed, ${batch.length} sounds count as new: ${(error as Error).message}`);
    }
  }

  const fresh: SoundEntry[] = [];
  for (const index of openIndexes) {
    const wish = wishes[index];
    const verdict = verdicts.get(index);
    const use = verdict?.use;
    if (use?.startsWith("w")) {
      const earlier = choices[Number(use.slice(1))];
      if (earlier) {
        choices[index] = { ...earlier, source: earlier.source === "library" ? "library" : "episode" };
        continue;
      }
    } else if (use) {
      const entry = byId.get(use)!;
      choices[index] = { prompt: entry.prompt, seconds: entry.seconds, libraryId: entry.id, source: "library" };
      continue;
    }
    const storageKey = soundStorageKey(wish.kind, wish.prompt, wish.seconds);
    const id = soundIdOf(storageKey);
    choices[index] = { prompt: wish.prompt, seconds: wish.seconds, libraryId: id, source: "new" };
    fresh.push({ id, kind: wish.kind, prompt: wish.prompt, seconds: wish.seconds, ...cleanDescription(verdict, wish), storageKey, uses: 0, blocked: false, origin: input.origin });
  }

  const final = choices as SoundChoice[];
  // A re-recording plays the sounds made for this episode from the library too; only the others count as found.
  const foreign = (choice: SoundChoice) => choice.source === "library" && byId.get(choice.libraryId)?.origin !== input.origin;
  const plan: SoundPlan = {
    choices: new Map(wishes.map((wish, index) => [wishKey(wish), final[index]])),
    fresh,
    used: [...new Set(final.filter((choice) => choice.source === "library").map((choice) => choice.libraryId))],
    stats: {
      wishes: wishes.length,
      fromLibrary: final.filter(foreign).length,
      sameInEpisode: final.filter((choice) => choice.source === "episode").length,
      fresh: fresh.length,
      askedLlm: openIndexes.length,
    },
  };
  const own = final.filter((choice) => choice.source === "library").length - plan.stats.fromLibrary;
  say(`sound library: ${plan.stats.wishes} sounds — ${plan.stats.fromLibrary} found in the library${own ? `, ${own} made for this episode before` : ""}, ${plan.stats.sameInEpisode} shared within the episode, ${plan.stats.fresh} new (${input.library.length} in the library)`);
  return plan;
}

/** The screenplay plays what the plan chose: prompt, length and library id of every sound and bed. */
export function applySoundPlan(script: Pick<AudioScript, "parts">, plan: SoundPlan): void {
  for (const part of script.parts) {
    for (const scene of part.scenes) {
      const prompt = scene.ambience?.trim();
      if (!prompt) continue;
      const choice = plan.choices.get(wishKey({ kind: "ambience", prompt, seconds: 0 }));
      if (!choice) continue;
      scene.ambience = choice.prompt;
      scene.ambienceLibraryId = choice.libraryId;
    }
    for (const line of part.lines) {
      for (const sound of line.sounds ?? []) {
        const choice = plan.choices.get(wishKey({ kind: "sfx", prompt: sound.sound, seconds: spotSeconds(sound.seconds) }));
        if (!choice) continue;
        sound.sound = choice.prompt;
        sound.seconds = choice.seconds;
        sound.libraryId = choice.libraryId;
      }
    }
  }
}

/** The cache as before, noting every key whose audio exists after the mix (loaded or generated). */
export function trackSoundCache(cache: SoundCachePort, present: Set<string>): SoundCachePort {
  return {
    async load(key) {
      const audio = await cache.load(key);
      if (audio?.length) present.add(key);
      return audio;
    },
    async save(key, audio) {
      await cache.save(key, audio);
      present.add(key);
    },
  };
}
