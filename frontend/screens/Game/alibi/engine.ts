/* Mitternachts-Alibi: Rätsel-Engine (ohne DOM).
 *
 * Modell: N Verdächtige, 2 oder 3 Akte (Abend, Mitternacht, Morgengrauen), mehrere Orte.
 * Jeder weiß nur, wo er selbst war und wer dort war. Der Täter war um Mitternacht allein am Tatort
 * und erfindet dafür ein Alibi. Alle anderen sagen die Wahrheit.
 * Der Löser prüft für jeden Verdächtigen: "Wenn er es war, passen dann alle anderen Aussagen?"
 * Portiert aus dem per Simulation geprüften Prototyp (docs/games/mitternachts-alibi-v2/source/engine.js). */
import type { AlibiCharacter, Claim, Conflict, DuelOffer, Level, LevelId, Player, Rng, Spur, SpurKey, World } from "./types";

/** Tatzeit: Mitternacht (Akt 2) */
export const TC = 1;

export const LEVELS: Record<LevelId, Level> = {
  mini: { n: "Mini-Detektive", acts: 2, loners: 1, spuren: 2, flags: true, talk: 180, tries: 2, keys: ["fam", "szc", "spc"] },
  junior: { n: "Junior-Detektive", acts: 3, loners: 1, spuren: 2, flags: true, talk: 180, tries: 2, keys: ["fam", "szc", "spc"] },
  detektiv: { n: "Detektiv", acts: 3, loners: 1, spuren: 2, flags: false, talk: 180, tries: 1, keys: ["fam", "szc", "spc", "gdr"] },
  meister: { n: "Meisterdetektiv", acts: 3, loners: 2, spuren: 3, flags: false, talk: 150, tries: 1, keys: ["fam", "szc", "spc", "gdr"] },
};

export const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

export function shuffle<T>(a: T[], rng: Rng = Math.random): T[] {
  const c = a.slice();
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c;
}

export function pick<T>(a: T[], rng: Rng = Math.random): T {
  return a[Math.floor(rng() * a.length)];
}

function same(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const x = a.slice().sort(), y = b.slice().sort();
  return x.every((v, i) => v === y[i]);
}

/* ---------- Besetzung ---------- */
export function cast(names: string[], pool: AlibiCharacter[], rng: Rng): Player[] {
  const chosen = shuffle(pool, rng).slice(0, names.length);
  return names.map((name, i) => ({ id: i, name, ch: chosen[i] }));
}

/** Zerlegt eine Anzahl in Gruppen der Größe 2–3 (keine Einzelnen). */
function groupSizes(r: number, rng: Rng): number[] {
  const out: number[] = [];
  while (r > 0) {
    if (r === 2 || r === 3) {
      out.push(r);
      break;
    }
    let s = rng() < 0.55 ? 2 : 3;
    if (r - s === 1) s = s === 2 ? 3 : 2;
    out.push(s);
    r -= s;
  }
  return out;
}

/** Zerlegt Personen in Gruppen der Größe 1–3 (für die freien Akte). */
function looseGroups(ids: number[], rng: Rng): number[][] {
  const left = shuffle(ids, rng), groups: number[][] = [];
  while (left.length) {
    const x = rng();
    let s = x < 0.18 ? 1 : x < 0.68 ? 2 : 3;
    s = Math.min(s, left.length);
    groups.push(left.splice(0, s));
  }
  return groups;
}

/* ---------- Welt ---------- */
export function makeWorld(o: { players: Player[]; level: LevelId; places: string[]; crimePlace: string; culprit: number; rng: Rng }): World {
  const { players, rng, places, crimePlace: Pc, culprit } = o;
  const N = players.length, L = LEVELS[o.level], T = L.acts;
  const Q = places.filter((p) => p !== Pc);
  const innocents = players.map((p) => p.id).filter((i) => i !== culprit);
  let loners = L.loners;
  while (loners > 0 && (innocents.length - loners === 1 || innocents.length - loners < 0)) loners--;
  const shuffled = shuffle(innocents, rng), lonerIds = shuffled.slice(0, loners), rest = shuffled.slice(loners);
  const groups: number[][] = [];
  let idx = 0;
  groupSizes(rest.length, rng).forEach((s) => {
    groups.push(rest.slice(idx, idx + s));
    idx += s;
  });
  lonerIds.forEach((l) => groups.push([l]));
  if (groups.length > Q.length) throw new Error("zu wenige Orte");
  const pos: string[][] = players.map(() => range(T).map(() => ""));
  const qs = shuffle(Q, rng);
  groups.forEach((g, gi) => g.forEach((m) => (pos[m][TC] = qs[gi])));
  pos[culprit][TC] = Pc;
  (T === 3 ? [0, 2] : [0]).forEach((t) => {
    const gs = looseGroups(players.map((p) => p.id), rng);
    while (gs.length > places.length) {
      gs.sort((a, b) => a.length - b.length);
      const a = gs.shift() as number[];
      gs[0] = gs[0].concat(a);
    }
    const ps = shuffle(places, rng);
    gs.forEach((g, gi) => g.forEach((m) => (pos[m][t] = ps[gi])));
  });
  const ids = players.map((q) => q.id);
  const comp = pos.map((row, s) => row.map((p, t) => ids.filter((u) => u !== s && pos[u][t] === p)));
  return { N, T, level: o.level, places, crimePlace: Pc, culprit, pos, comp, loners: lonerIds, players };
}

/** Wahre Aussage eines Verdächtigen für alle Akte */
export function truthClaim(W: World, s: number): Claim[] {
  return range(W.T).map((t) => ({ place: W.pos[s][t], comp: W.comp[s][t].slice() }));
}

/* ---------- Spuren ---------- */
export const matches = (ch: AlibiCharacter, sp: Spur): boolean => (ch as unknown as Record<string, string>)[sp.k] === sp.v;
export const keysFor = (level: LevelId): SpurKey[] => LEVELS[level].keys;

/* ---------- Löser ---------- */
/** claims: pro Spieler die Aussagen aller Akte oder null (noch nicht vollständig). */
export function consistent(W: World, claims: (Claim[] | null)[], k: number, spuren: Spur[]): boolean {
  const P = W.players, O = P.map((p) => p.id).filter((i) => i !== k && claims[i]);
  for (const sp of spuren) if (!matches(P[k].ch, sp)) return false;
  for (let t = 0; t < W.T; t++) {
    const mentions: number[] = [];
    for (const s of O) {
      const cs = (claims[s] as Claim[])[t];
      const expected = O.filter((u) => u !== s && (claims[u] as Claim[])[t].place === cs.place);
      const listed = cs.comp.filter((u) => u !== k && claims[u]);
      if (!same(expected, listed)) return false;
      if (cs.comp.indexOf(k) >= 0) mentions.push(s);
    }
    const placeSet = new Set(mentions.map((s) => (claims[s] as Claim[])[t].place));
    if (placeSet.size > 1) return false;
    if (placeSet.size === 1) {
      const p = [...placeSet][0];
      for (const u of O) if ((claims[u] as Claim[])[t].place === p && (claims[u] as Claim[])[t].comp.indexOf(k) < 0) return false;
      if (t === TC) return false;
    }
  }
  for (const d of O) if ((claims[d] as Claim[])[TC].place === W.crimePlace) return false;
  return true;
}

export function candidates(W: World, claims: (Claim[] | null)[], spuren: Spur[] = []): number[] {
  return range(W.N).filter((k) => consistent(W, claims, k, spuren));
}

function subsets<T>(arr: T[], maxSize: number): T[][] {
  const out: T[][] = [[]];
  const rec = (start: number, cur: T[]) => {
    for (let i = start; i < arr.length; i++) {
      cur.push(arr[i]);
      if (cur.length <= maxSize) {
        out.push(cur.slice());
        rec(i + 1, cur);
      }
      cur.pop();
    }
  };
  rec(0, []);
  return out;
}

/** Wählt höchstens n Spuren, die den Täter eindeutig machen. Füllspuren zuerst, die entscheidende zuletzt. */
export function pickSpuren(W: World, claims: (Claim[] | null)[], n: number, rng: Rng = Math.random): Spur[] | null {
  const P = W.players, cul = P[W.culprit].ch as unknown as Record<string, string>;
  const all: Spur[] = keysFor(W.level).map((k) => ({ k, v: cul[k] }));
  const base = candidates(W, claims, []);
  if (base.indexOf(W.culprit) < 0) return null;
  let best: { set: Spur[]; score: number } | null = null;
  subsets(all, n).forEach((set) => {
    const rem = base.filter((c) => set.every((sp) => matches(P[c].ch, sp)));
    if (rem.length !== 1) return;
    let elim = 0;
    P.forEach((p) => {
      if (!set.every((sp) => matches(p.ch, sp))) elim++;
    });
    const score = (base.length > 1 ? -100 * set.length : 0) + elim + rng() * 0.01;
    if (!best || score > best.score) best = { set, score };
  });
  if (!best) return null;
  const decisive = (best as { set: Spur[] }).set.slice(), fillers: Spur[] = [], fallback: Spur[] = [];
  let curr = base.slice();
  const rest = shuffle(all.filter((a) => !decisive.some((c) => c.k === a.k)), rng);
  while (decisive.length + fillers.length < n && rest.length) {
    const f = rest.shift() as Spur, after = curr.filter((c) => matches(P[c].ch, f));
    if (base.length > 1 && after.length < 2) {
      fallback.push(f);
      continue;
    }
    fillers.push(f);
    curr = after;
  }
  while (decisive.length + fillers.length < n && fallback.length) fillers.push(fallback.shift() as Spur);
  return fillers.concat(shuffle(decisive, rng));
}

/** Kann man im schlimmsten Fall (Täter und alle Einzelnen unentdeckt) mit n Spuren eindeutig lösen? */
function resolvable(players: Player[], culprit: number, loners: number[], n: number, keys: SpurKey[]): boolean {
  const cul = players[culprit].ch as unknown as Record<string, string>;
  const all: Spur[] = keys.map((k) => ({ k, v: cul[k] }));
  const cand = [culprit].concat(loners);
  if (cand.length === 1) return true;
  return subsets(all, n).some((set) => cand.filter((c) => set.every((sp) => matches(players[c].ch, sp))).length === 1);
}

/* ---------- Hilfen ---------- */
export function conflicts(W: World, claims: (Claim[] | null)[]): Conflict[] {
  const out: Conflict[] = [], seen = new Set<string>();
  for (let t = 0; t < W.T; t++)
    for (let s = 0; s < W.N; s++)
      for (let u = s + 1; u < W.N; u++) {
        const cs = claims[s], cu = claims[u];
        if (!cs || !cu) continue;
        const a = cs[t], b = cu[t], aU = a.comp.indexOf(u) >= 0, bS = b.comp.indexOf(s) >= 0, samePlace = a.place === b.place;
        const bad = (aU && !(samePlace && bS)) || (bS && !(samePlace && aU)) || (samePlace && !(aU && bS));
        const key = `${t}:${s}:${u}`;
        if (bad && !seen.has(key)) {
          seen.add(key);
          out.push({ t, a: s, b: u });
        }
      }
  return out;
}

/** Wer wird im Akt t von niemandem genannt? */
export function unvouched(W: World, claims: (Claim[] | null)[], t: number): number[] {
  return range(W.N).filter((s) => !range(W.N).some((u) => u !== s && claims[u] && (claims[u] as Claim[])[t].comp.indexOf(s) >= 0));
}

/** Orte, an denen laut Aussagen mindestens zwei zusammen waren. */
export function duels(W: World, claims: (Claim[] | null)[], t: number, rng: Rng = Math.random): DuelOffer[] {
  const byPlace: Record<string, number[]> = {};
  for (let s = 0; s < W.N; s++) {
    const c = claims[s];
    if (c) (byPlace[c[t].place] = byPlace[c[t].place] || []).push(s);
  }
  return shuffle(
    Object.keys(byPlace)
      .filter((p) => byPlace[p].length >= 2)
      .map((p) => ({ place: p, t, who: byPlace[p] })),
    rng
  );
}

/* ---------- Fall erzeugen (mit Prüfung) ---------- */
export function generate(o: { names: string[]; pool: AlibiCharacter[]; level: LevelId; places: string[]; crimePlace: string; rng?: Rng }): World {
  const rng = o.rng || Math.random, L = LEVELS[o.level], N = o.names.length;
  for (let attempt = 0; attempt < 400; attempt++) {
    const players = cast(o.names, o.pool, rng), culprit = Math.floor(rng() * N);
    let W: World;
    try {
      W = makeWorld({ players, level: o.level, places: o.places, crimePlace: o.crimePlace, culprit, rng });
    } catch {
      continue;
    }
    if (!resolvable(players, culprit, W.loners, L.spuren, L.keys)) continue;
    W.attempts = attempt + 1;
    return W;
  }
  throw new Error("kein lösbarer Fall gefunden");
}
