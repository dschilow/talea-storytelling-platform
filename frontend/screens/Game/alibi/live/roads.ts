/* Wegenetz der Dorfkarte. Gleiche Geometrie wie scripts/game-art/map-layout.py (Platzmitten = MAP_POS).
 * Koordinaten in Prozent der Kartenbreite/-höhe. */
import { MAP_POS } from "../content";

export interface Pt {
  x: number;
  y: number;
}

/** Wege als quadratische Kurven: von, nach, Kontrollpunkt */
const ROADS: [string, string, Pt][] = [
  ["markt", "turm", { x: 55.1, y: 30.2 }],
  ["markt", "bibliothek", { x: 37.0, y: 34.3 }],
  ["markt", "wirtshaus", { x: 65.2, y: 36.8 }],
  ["markt", "baeckerei", { x: 31.3, y: 51.1 }],
  ["markt", "schmiede", { x: 67.3, y: 50.5 }],
  ["markt", "garten", { x: 39.9, y: 67.2 }],
  ["markt", "bruecke", { x: 61.0, y: 63.9 }],
  ["turm", "bibliothek", { x: 35.2, y: 15.7 }],
  ["turm", "wirtshaus", { x: 64.6, y: 17.1 }],
  ["bibliothek", "baeckerei", { x: 18.7, y: 36.7 }],
  ["wirtshaus", "schmiede", { x: 83.9, y: 36.0 }],
  ["baeckerei", "garten", { x: 19.8, y: 64.2 }],
  ["schmiede", "bruecke", { x: 77.7, y: 64.4 }],
  ["garten", "bruecke", { x: 47.6, y: 87.9 }],
];

/** Radius eines Platzes (Prozent): innerhalb davon laufen Figuren frei, außerhalb nur auf Wegen. */
export const PLAZA_R = 6.4;

const bez = (a: Pt, c: Pt, b: Pt, t: number): Pt => ({
  x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x,
  y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y,
});

/** Kurve als Punktfolge von a nach b */
function curve(a: string, b: string): Pt[] {
  const r = ROADS.find(([p, q]) => (p === a && q === b) || (p === b && q === a));
  if (!r) return [MAP_POS[a], MAP_POS[b]];
  const [p, , c] = r;
  const A = MAP_POS[p], B = MAP_POS[r[1]];
  const pts = Array.from({ length: 25 }, (_, k) => bez(A, c, B, k / 24));
  return p === a ? pts : pts.reverse();
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const plen = (pts: Pt[]) => pts.reduce((s, p, i) => (i ? s + dist(pts[i - 1], p) : 0), 0);

const ADJ: Record<string, string[]> = {};
ROADS.forEach(([a, b]) => {
  (ADJ[a] ||= []).push(b);
  (ADJ[b] ||= []).push(a);
});

/** Kürzeste Ortsfolge (Dijkstra über die Weglängen). */
export function route(from: string, to: string): string[] {
  if (from === to) return [from];
  const d: Record<string, number> = {}, prev: Record<string, string | null> = {};
  const open = new Set(Object.keys(MAP_POS));
  Object.keys(MAP_POS).forEach((k) => {
    d[k] = Infinity;
    prev[k] = null;
  });
  d[from] = 0;
  while (open.size) {
    let u: string | null = null;
    open.forEach((k) => {
      if (u === null || d[k] < d[u]) u = k;
    });
    if (u === null || d[u] === Infinity) break;
    open.delete(u);
    if (u === to) break;
    for (const v of ADJ[u] || []) {
      const alt = d[u] + plen(curve(u, v));
      if (alt < d[v]) {
        d[v] = alt;
        prev[v] = u;
      }
    }
  }
  const out: string[] = [];
  for (let k: string | null = to; k; k = prev[k]) out.unshift(k);
  return out[0] === from ? out : [from, to];
}

/** Nächster Ort zu einem Punkt */
export function nearestPlace(p: Pt): string {
  let best = "markt", bd = Infinity;
  Object.entries(MAP_POS).forEach(([k, q]) => {
    const dd = dist(p, q);
    if (dd < bd) {
      bd = dd;
      best = k;
    }
  });
  return best;
}

/** Punkt am Platzrand in Richtung eines anderen Punktes */
function rim(place: string, toward: Pt): Pt {
  const c = MAP_POS[place];
  const dx = toward.x - c.x, dy = toward.y - c.y, l = Math.hypot(dx, dy) || 1;
  return { x: c.x + (dx / l) * PLAZA_R * 0.75, y: c.y + (dy / l) * PLAZA_R * 0.75 };
}

/**
 * Laufweg von einem Punkt zu einem anderen über die Wege: vom Start zum Rand des nächsten Platzes,
 * über die Wegkurven von Platz zu Platz, vom Rand des Zielplatzes zum Ziel.
 */
export function walkPath(from: Pt, to: Pt, fromPlace?: string, toPlace?: string): Pt[] {
  const a = fromPlace || nearestPlace(from), b = toPlace || nearestPlace(to);
  if (a === b) return [from, to];
  const r = route(a, b);
  let pts: Pt[] = [from];
  for (let i = 0; i < r.length - 1; i++) {
    let seg = curve(r[i], r[i + 1]);
    // Kurvenstücke innerhalb der Plätze weglassen: dort läuft man direkt
    seg = seg.filter((p, k) => (k > 0 && k < seg.length - 1 ? dist(p, MAP_POS[r[i]]) > PLAZA_R * 0.75 && dist(p, MAP_POS[r[i + 1]]) > PLAZA_R * 0.75 : false));
    if (i === 0) pts.push(rim(r[0], seg[0] || MAP_POS[r[1]]));
    pts = pts.concat(seg);
    if (i < r.length - 2) {
      const next = curve(r[i + 1], r[i + 2]).find((p) => dist(p, MAP_POS[r[i + 1]]) > PLAZA_R * 0.75);
      pts.push(rim(r[i + 1], pts[pts.length - 1]));
      if (next) pts.push(rim(r[i + 1], next));
    }
  }
  pts.push(rim(b, pts[pts.length - 1]));
  pts.push(to);
  return pts;
}

/** Punktfolge mit kumulierter Länge, zum Abfahren nach Strecke */
export class Polyline {
  pts: Pt[];
  acc: number[];
  length: number;
  constructor(pts: Pt[]) {
    this.pts = pts.length ? pts : [{ x: 50, y: 50 }];
    this.acc = [0];
    for (let i = 1; i < this.pts.length; i++) this.acc.push(this.acc[i - 1] + dist(this.pts[i - 1], this.pts[i]));
    this.length = this.acc[this.acc.length - 1];
  }
  /** Punkt und Richtung nach Strecke s */
  at(s: number): { p: Pt; dir: Pt } {
    const L = this.length;
    if (L <= 0) return { p: this.pts[this.pts.length - 1], dir: { x: 1, y: 0 } };
    const v = Math.max(0, Math.min(L, s));
    let i = 1;
    while (i < this.acc.length - 1 && this.acc[i] < v) i++;
    const a = this.pts[i - 1], b = this.pts[i], seg = this.acc[i] - this.acc[i - 1] || 1, f = (v - this.acc[i - 1]) / seg;
    const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
    return { p: { x: a.x + dx * f, y: a.y + dy * f }, dir: { x: dx / l, y: dy / l } };
  }
}

/** Alle Wege (für Zeichnungen, Fußspuren, Prüfungen) */
export const ALL_ROADS = ROADS.map(([a, b]) => ({ a, b, pts: curve(a, b) }));
