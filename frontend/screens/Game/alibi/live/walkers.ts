/* Wo jede Figur auf der Dorfkarte gerade ist und wohin sie läuft.
 *
 * Der Zustand lebt außerhalb von React, je Partie (World) und Spieler, damit Figuren über Bildschirmwechsel hinweg
 * dort weiterlaufen, wo sie waren: Wechselt der Akt oder die Szene des Tathergangs, laufen sie über die Wege zum
 * neuen Ort, statt zu springen. Positionen in Prozent der Kartenbreite/-höhe. */
import { MAP_POS } from "../content";
import { onFrame } from "./ticker";
import { FIG, strideH, type Gait } from "./figure";
import { Polyline, walkPath, type Pt } from "./roads";

/** Figurenhöhe in Prozent der Kartenbreite (gleicher Maßstab wie die Karte, damit Schritte zur Strecke passen) */
export const FIGURE_H = 14;

export interface Walker {
  x: number;
  y: number;
  /** Ziel, zu dem die Figur zuletzt geschickt wurde */
  tx: number;
  ty: number;
  place: string | null;
  path: Polyline | null;
  s: number;
  /** zurückgelegte Strecke gesamt (für die Gangphase) */
  dist: number;
  speed: number;
  gait: Gait;
  dirX: number;
  dirY: number;
  face: 1 | -1;
  /** 0..1 weich: steht ↔ läuft */
  move: number;
  side: number;
  /** Feder für den Mantel-Nachschwung */
  sway: number;
  swayV: number;
  /** Startverzögerung (Sekunden), damit nicht alle gleichzeitig loslaufen */
  wait: number;
  onArrive: (() => void) | null;
  seed: number;
  /** Fußabdrücke hinterlassen (Tathergang) */
  prints: boolean;
  /** Schrittzähler (für Fußabdrücke und Geräusche) */
  steps: number;
  /** laufende Geste (Zugreifen, Jubeln, Zittern) und ihr Startzeitpunkt */
  gest: Gesture | null;
  gestT: number;
}

export type Gesture = "reach" | "cheer" | "shiver";

const SPEED: Record<Gait, number> = { walk: 15, run: 27, sneak: 8.5 };
const store = new WeakMap<object, Map<number, Walker>>();

function mapOf(world: object) {
  let m = store.get(world);
  if (!m) {
    m = new Map();
    store.set(world, m);
  }
  return m;
}

export function getWalker(world: object, id: number): Walker | undefined {
  return store.get(world)?.get(id);
}
if (import.meta.env.DEV && typeof window !== "undefined") (window as unknown as Record<string, unknown>).__alibiWalkers = { store, active: () => active };

function fresh(id: number, p: Pt, place: string | null): Walker {
  return {
    x: p.x, y: p.y, tx: p.x, ty: p.y, place, path: null, s: 0, dist: 0, speed: SPEED.walk, gait: "walk", dirX: 1, dirY: 0, face: id % 2 ? -1 : 1,
    move: 0, side: 1, sway: 0, swayV: 0, wait: 0, onArrive: null, seed: ((id * 0.618) % 1 + 1) % 1, prints: false, steps: 0, gest: null, gestT: 0,
  };
}

/** Figur ohne Laufen an einen Punkt setzen (erste Anzeige). */
export function placeWalker(world: object, id: number, p: Pt, place: string | null): Walker {
  const m = mapOf(world);
  const w = m.get(id) || fresh(id, p, place);
  w.x = w.tx = p.x;
  w.y = w.ty = p.y;
  w.place = place;
  w.path = null;
  w.onArrive = null;
  m.set(id, w);
  return w;
}

export interface SendOpts {
  gait?: Gait;
  /** höchstens so lange unterwegs (Sekunden); schneller laufen, wenn der Weg lang ist */
  maxDur?: number;
  delay?: number;
  from?: Pt;
  fromPlace?: string | null;
  prints?: boolean;
  onArrive?: () => void;
}

/** Figur über die Wege zu einem Punkt schicken. Gibt die geplante Dauer (Sekunden) zurück. */
export function sendWalker(world: object, id: number, to: Pt, toPlace: string | null, o: SendOpts = {}): number {
  const m = mapOf(world);
  let w = m.get(id);
  if (!w) w = placeWalker(world, id, o.from || MAP_POS.markt, o.fromPlace ?? "markt");
  if (o.from) {
    w.x = o.from.x;
    w.y = o.from.y;
  }
  const pts = walkPath({ x: w.x, y: w.y }, to, (o.fromPlace ?? w.place) || undefined, toPlace || undefined);
  const path = new Polyline(pts);
  const gait = o.gait || "walk";
  let speed = SPEED[gait];
  if (o.maxDur && path.length / speed > o.maxDur) speed = path.length / o.maxDur;
  w.path = path.length > 0.2 ? path : null;
  w.s = 0;
  w.gait = gait;
  w.speed = speed;
  w.wait = o.delay || 0;
  w.place = toPlace;
  w.tx = to.x;
  w.ty = to.y;
  w.prints = !!o.prints;
  w.onArrive = o.onArrive || null;
  if (!w.path) {
    w.x = to.x;
    w.y = to.y;
    o.onArrive?.();
    w.onArrive = null;
  }
  m.set(id, w);
  return w.path ? (o.delay || 0) + path.length / speed : 0;
}

/** Fußabdrücke (Tathergang): bleiben eine Weile auf dem Boden */
export interface Print {
  x: number;
  y: number;
  ang: number;
  side: number;
  born: number;
}
export const prints: Print[] = [];
let clock = 0;
type StepListener = (id: number, w: Walker) => void;
const stepListeners = new Set<StepListener>();
export const onStep = (fn: StepListener): (() => void) => {
  stepListeners.add(fn);
  return () => {
    stepListeners.delete(fn);
  };
};

const active = new Map<Map<number, Walker>, number>();
let unsub: (() => void) | null = null;
/** Ein Brett meldet seine Partie an, solange es sichtbar ist (nur dann werden Figuren bewegt). */
export function trackWorld(world: object): () => void {
  const m = mapOf(world);
  active.set(m, (active.get(m) || 0) + 1);
  if (!unsub) unsub = onFrame(tick);
  return () => {
    const n = (active.get(m) || 1) - 1;
    if (n > 0) active.set(m, n);
    else active.delete(m);
    if (!active.size && unsub) {
      unsub();
      unsub = null;
    }
  };
}

function step(w: Walker, id: number, dt: number) {
  const moving = !!w.path && w.wait <= 0;
  if (w.wait > 0) w.wait -= dt;
  if (moving && w.path) {
    const before = w.s;
    w.s = Math.min(w.path.length, w.s + w.speed * dt);
    const ds = w.s - before;
    const { p, dir } = w.path.at(w.s);
    w.x = p.x;
    w.y = p.y;
    // Richtung weich nachführen (keine harten Drehungen an Ecken)
    const k = 1 - Math.exp(-dt * 10);
    w.dirX += (dir.x - w.dirX) * k;
    w.dirY += (dir.y - w.dirY) * k;
    const dl = Math.hypot(w.dirX, w.dirY) || 1;
    if (Math.abs(w.dirX / dl) > 0.12) w.face = w.dirX > 0 ? 1 : -1;
    // Gangphase aus der Strecke: ein Zyklus = strideH · Figurenhöhe
    const stride = strideH(w.gait) * FIGURE_H;
    const prevSteps = Math.floor((w.dist / stride) * 2);
    w.dist += ds;
    const steps = Math.floor((w.dist / stride) * 2);
    if (steps > prevSteps) {
      w.steps++;
      if (w.prints) prints.push({ x: w.x, y: w.y, ang: Math.atan2(w.dirY, w.dirX), side: w.steps % 2 ? 1 : -1, born: clock });
      stepListeners.forEach((fn) => fn(id, w));
    }
    if (w.s >= w.path.length - 1e-3) {
      w.path = null;
      const cb = w.onArrive;
      w.onArrive = null;
      cb?.();
    }
  }
  const target = moving ? 1 : 0;
  // Stehenbleiben: die Phase läuft bis zum nächsten Doppelstand weiter, dann ruht sie
  w.move += (target - w.move) * (1 - Math.exp(-dt * (moving ? 9 : 7)));
  const dl = Math.hypot(w.dirX, w.dirY) || 1;
  w.side = Math.abs(w.dirX / dl);
  // Mantel-Feder: zieht beim Loslaufen nach hinten, schwingt beim Anhalten nach
  const targetSway = moving ? w.speed * 0.006 * w.side : 0;
  const acc = (targetSway - w.sway) * 60 - w.swayV * 9;
  w.swayV += acc * dt;
  w.sway += w.swayV * dt;
}

function tick(_t: number, dt: number) {
  clock += dt;
  active.forEach((_n, m) => m.forEach((w, id) => step(w, id, dt)));
  // alte Fußabdrücke nach 40 s entfernen
  while (prints.length && clock - prints[0].born > 40) prints.shift();
}

export const walkerClock = () => clock;

/** Eine Geste der Figur auslösen (klingt von selbst ab). */
export function gesture(world: object, id: number, g: Gesture) {
  const w = getWalker(world, id);
  if (!w) return;
  w.gest = g;
  w.gestT = clock;
}
const GEST_LEN: Record<Gesture, number> = { reach: 0.75, cheer: 2.2, shiver: 1.8 };
/** Stärke der laufenden Geste 0..1 (weich hin und zurück) */
export function gestureAmount(w: Walker, g: Gesture): number {
  if (w.gest !== g) return 0;
  const x = (clock - w.gestT) / GEST_LEN[g];
  if (x >= 1) return 0;
  return Math.sin(Math.PI * Math.max(0, x));
}
/** Hilfswert für Darstellungen: Kopfgröße in Prozent der Kartenbreite */
export const HEAD_PCT = FIGURE_H * FIG.head;
