/* Mitternachts-Alibi: Asservatenkammer (Sammlung über alle Partien auf diesem Gerät).
 * Gelöste Fälle bringen das Beutestück und eine schwarze Feder (Elster-Akte), entkommene Diebe einen Steckbrief.
 * Sind alle acht Beutestücke gesammelt, wird die Elster enttarnt. Speicher: localStorage, Fehler werden geschluckt. */
import { CASES } from "./content";

const KEY = "talea.alibi.vault.v1";

export interface Vault {
  /** Beutestück je Fall-ID: wie oft zurückgeholt */
  loot: Record<string, number>;
  /** Steckbriefe je Figuren-Slug: wie oft entkommen */
  wanted: Record<string, number>;
  games: number;
  solved: number;
  escaped: number;
  /** Elster bereits enttarnt */
  elster: boolean;
}

export interface Rank {
  min: number;
  name: string;
  icon: string;
}

export const RANKS: Rank[] = [
  { min: 0, name: "Detektiv-Anwärter", icon: "🔰" },
  { min: 1, name: "Spürnase", icon: "👃" },
  { min: 3, name: "Detektiv", icon: "🔎" },
  { min: 6, name: "Oberdetektiv", icon: "🕵️" },
  { min: 10, name: "Meisterdetektiv", icon: "🎖️" },
  { min: 20, name: "Legende von Kicherwald", icon: "👑" },
];

export interface GameRecord {
  caught: boolean;
  /** Beutestück zum ersten Mal in der Sammlung */
  newLoot: boolean;
  /** wie oft dieses Beutestück jetzt in der Sammlung liegt */
  copies: number;
  /** verschiedene Beutestücke = schwarze Federn (Elster-Akte) */
  feathers: number;
  newFeather: boolean;
  /** Steckbrief des Diebs ist neu */
  newWanted: boolean;
  /** Mit dieser Partie wurden alle acht Beutestücke gesammelt: Die Elster wird enttarnt */
  elsterNow: boolean;
  rank: Rank;
  rankUp: boolean;
}

const empty = (): Vault => ({ loot: {}, wanted: {}, games: 0, solved: 0, escaped: 0, elster: false });

export function loadVault(): Vault {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return empty();
    const v = JSON.parse(raw) as Partial<Vault>;
    return { ...empty(), ...v, loot: { ...(v.loot || {}) }, wanted: { ...(v.wanted || {}) } };
  } catch {
    return empty();
  }
}

function saveVault(v: Vault) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* Sammlung ist ein Komfort */
  }
}

export const rankFor = (solved: number): Rank => RANKS.reduce((r, x) => (solved >= x.min ? x : r), RANKS[0]);
export const nextRank = (solved: number): Rank | null => RANKS.find((x) => x.min > solved) || null;
export const featherCount = (v: Vault) => CASES.filter((c) => (v.loot[c.id] || 0) > 0).length;

/** Trägt eine beendete Partie ein und meldet, was neu ist. */
export function recordGame(o: { caseId: string; caught: boolean; thief: string }): GameRecord {
  const v = loadVault(), before = featherCount(v), rankBefore = rankFor(v.solved);
  v.games += 1;
  let newLoot = false, newWanted = false;
  if (o.caught) {
    v.solved += 1;
    newLoot = !v.loot[o.caseId];
    v.loot[o.caseId] = (v.loot[o.caseId] || 0) + 1;
  } else {
    v.escaped += 1;
    newWanted = !v.wanted[o.thief];
    v.wanted[o.thief] = (v.wanted[o.thief] || 0) + 1;
  }
  const feathers = featherCount(v), elsterNow = !v.elster && feathers >= CASES.length;
  if (elsterNow) v.elster = true;
  saveVault(v);
  const rank = rankFor(v.solved);
  return { caught: o.caught, newLoot, copies: v.loot[o.caseId] || 0, feathers, newFeather: feathers > before, newWanted, elsterNow, rank, rankUp: rank !== rankBefore };
}
