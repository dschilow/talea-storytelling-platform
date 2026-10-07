/* Spielfigur mit Gelenken: Mantel (in der Kennfarbe eingefärbt), zwei Beine mit Knie (Zwei-Knochen-IK) und flachem
 * Stiefel, zwei Arme. Der Kopf (Porträt-Medaillon) ist ein DOM-Element darüber; drawFigure liefert, wo er sitzt.
 *
 * Gang nach den Regeln aus ref2game (animation.md §5, §12):
 *  - Phase aus der Strecke, nicht aus der Zeit: In der Standphase gleitet der Fuß relativ zum Körper genau mit der
 *    Körpergeschwindigkeit zurück (steht also fest am Boden), in der Schwungphase hebt er sich im Bogen nach vorn.
 *  - Die Hüfte reitet auf dem Standbein (am höchsten über dem gestreckten Bein, am tiefsten im Doppelstand).
 *  - Knie beugen sich in der Schwungphase, Arme schwingen gegengleich und schwächer als die Beine.
 *  - Seiten- und Frontansicht werden nach Laufrichtung gemischt (Front: Beine heben sich abwechselnd).
 * Längen relativ zur Figurenhöhe H (Sohle bis Scheitel). */
import { ART } from "./art.gen";

const BASE = "/game/alibi/live/parts/";
type PartName = "cloak" | "leg" | "arm" | "thiefcloak" | "hood";
const imgs: Partial<Record<PartName, HTMLImageElement>> = {};
const dark: Partial<Record<PartName, HTMLCanvasElement>> = {};
const tinted = new Map<string, HTMLCanvasElement>();
let loading: Promise<void> | null = null;

function load(name: PartName): Promise<void> {
  return new Promise((res) => {
    const im = new Image();
    im.decoding = "async";
    im.onload = () => {
      imgs[name] = im;
      res();
    };
    im.onerror = () => res();
    im.src = `${BASE}${name}.webp`;
  });
}

/** Teile einmal laden (alle Figuren teilen sie). */
export function loadFigureParts(): Promise<void> {
  if (!loading) loading = Promise.all((["cloak", "leg", "arm", "thiefcloak", "hood"] as PartName[]).map(load)).then(() => undefined);
  return loading;
}
export const partsReady = () => !!imgs.cloak && !!imgs.leg && !!imgs.arm;
export const partSrc = (n: PartName) => `${BASE}${n}.webp`;

function canvasOf(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** Abgedunkelte Kopie (ferne Seite liegt im Schatten des Körpers). */
function darkened(name: PartName): CanvasImageSource | undefined {
  const im = imgs[name];
  if (!im) return undefined;
  let c = dark[name];
  if (!c) {
    c = canvasOf(im.naturalWidth, im.naturalHeight);
    const g = c.getContext("2d")!;
    g.drawImage(im, 0, 0);
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = "rgba(20,14,30,0.3)";
    g.fillRect(0, 0, c.width, c.height);
    dark[name] = c;
  }
  return c;
}

/** Mantel in der Kennfarbe: Farbe multiplizieren (Schattierung und Tusche bleiben), dann Alpha zurückholen. */
function tintedCloak(color: string): CanvasImageSource | undefined {
  const im = imgs.cloak;
  if (!im) return undefined;
  let c = tinted.get(color);
  if (!c) {
    c = canvasOf(im.naturalWidth, im.naturalHeight);
    const g = c.getContext("2d")!;
    g.drawImage(im, 0, 0);
    g.globalCompositeOperation = "multiply";
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    // sehr dunkle Kennfarben (Schwarz) behalten etwas Stoff
    g.globalCompositeOperation = "screen";
    g.fillStyle = "rgba(58,50,46,0.16)";
    g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = "destination-in";
    g.drawImage(im, 0, 0);
    tinted.set(color, c);
  }
  return c;
}

/** Ärmel in der Mantelfarbe, Fäustling bleibt hell (unterer Teil des Bildes). */
const armTint = new Map<string, HTMLCanvasElement>();
function tintedArm(color: string, far: boolean): CanvasImageSource | undefined {
  const im = imgs.arm;
  if (!im) return undefined;
  const key = `${color}|${far ? 1 : 0}`;
  let c = armTint.get(key);
  if (!c) {
    const w = im.naturalWidth, h = im.naturalHeight, cut = Math.round(h * 0.74);
    c = canvasOf(w, h);
    const g = c.getContext("2d")!;
    g.drawImage(im, 0, 0);
    g.globalCompositeOperation = "multiply";
    g.fillStyle = color;
    g.fillRect(0, 0, w, cut);
    g.globalCompositeOperation = "destination-in";
    g.drawImage(im, 0, 0);
    if (far) {
      g.globalCompositeOperation = "source-atop";
      g.fillStyle = "rgba(20,14,30,0.3)";
      g.fillRect(0, 0, w, h);
    }
    armTint.set(key, c);
  }
  return c;
}

export type Gait = "walk" | "run" | "sneak";

export interface FigurePose {
  /** Gangphase in Zyklen (wächst mit der Strecke) */
  phase: number;
  /** 0 = steht, 1 = läuft (weich überblendet) */
  move: number;
  /** Anteil der Seitenansicht: |Laufrichtung.x| */
  side: number;
  /** Blickrichtung: 1 rechts, -1 links */
  face: 1 | -1;
  /** Taktzeit (Atmen, Zappeln) */
  t: number;
  /** eigener Versatz der Figur (0..1) */
  seed: number;
  gait: Gait;
  /** Mantel-Nachschwung (Feder, vom Aufrufer geführt), Radiant */
  sway: number;
  /** Greifen 0..1 (naher Arm nach vorn, z. B. Beute schnappen) */
  reach?: number;
  /** Zittern 0..1 (Trommelwirbel) */
  shiver?: number;
  /** Jubeln 0..1 (Arme hoch) */
  cheer?: number;
  /** Fuß-Anker: gewünschte Sohlen-x (Leinwand-Pixel relativ zur Mitte, vorwärts positiv) für Fuß A/B in der Standphase */
  lock?: [number | null, number | null];
}

export interface FigureLook {
  color: string;
  thief?: boolean;
}

export interface FigureOut {
  /** Mitte des Kopfes in Leinwand-Pixeln */
  headX: number;
  headY: number;
  /** Neigung des Kopfes (Grad) */
  headRot: number;
  /** Hand des nahen Arms (für getragene Beute) */
  handX: number;
  handY: number;
  /** Sohlen (für die Fußgleit-Prüfung) */
  feet: { x: number; y: number; down: boolean }[];
}

/** Proportionen relativ zu H */
export const FIG = {
  head: 0.5, // Kopfdurchmesser (Wackelkopf-Proportion: Gesichter bleiben erkennbar)
  leg: 0.3, // Hüfte bis Sohle, gestreckt
  cloakH: 0.3,
  shoulderAboveHip: 0.19,
  arm: 0.18,
};

const GAIT = {
  walk: { step: 0.62, duty: 0.6, lift: 0.075, lean: 0.07, drop: 0.012, arm: 0.45 },
  run: { step: 0.95, duty: 0.42, lift: 0.11, lean: 0.14, drop: 0.02, arm: 0.65 },
  sneak: { step: 0.46, duty: 0.55, lift: 0.1, lean: 0.24, drop: 0.06, arm: 0.18 },
} as const;

/** Strecke eines ganzen Gangzyklus (zwei Schritte) in Einheiten von H. */
export const strideH = (g: Gait) => (GAIT[g].step * FIG.leg) / GAIT[g].duty;

const smooth = (x: number) => x * x * (3 - 2 * x);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** Fußweg: u = vor/zurück relativ zur Hüfte (in H), lift = Höhe (in H), down = Standphase */
function footPath(ph: number, g: Gait) {
  const G = GAIT[g], L = G.step * FIG.leg, p = ph - Math.floor(ph);
  if (p < G.duty) return { u: L * (0.5 - p / G.duty), lift: 0, down: true, s: 0 };
  const s = (p - G.duty) / (1 - G.duty);
  return { u: L * (-0.5 + smooth(s)), lift: G.lift * Math.sin(Math.PI * s), down: false, s };
}

/** Zwei-Knochen-IK Hüfte → Knöchel; das Knie zeigt nach vorn (+x). Winkel: 0 = senkrecht nach unten, + = Ende nach vorn. */
function ik(hx: number, hy: number, ax: number, ay: number, L1: number, L2: number) {
  let dx = ax - hx, dy = ay - hy;
  let d = Math.hypot(dx, dy);
  const max = (L1 + L2) * 0.999;
  if (d > max) {
    dx *= max / d;
    dy *= max / d;
    d = max;
  }
  d = Math.max(d, Math.abs(L1 - L2) + 1e-3);
  const phi = Math.atan2(dx, dy);
  const alpha = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
  const a1 = phi + alpha;
  const kx = hx + L1 * Math.sin(a1), ky = hy + L1 * Math.cos(a1);
  const ex = hx + dx, ey = hy + dy;
  return { a1, a2: Math.atan2(ex - kx, ey - ky), kx, ky, ax: ex, ay: ey };
}

/** Streifen [v0, v1] eines senkrechten Teilbildes zeichnen, gedreht um den Drehpunkt (pu, pv), der bei (x, y) liegt. */
function strip(g: CanvasRenderingContext2D, src: CanvasImageSource, iw: number, ih: number, v0: number, v1: number, pu: number, pv: number, x: number, y: number, ang: number, s: number) {
  g.save();
  g.translate(x, y);
  g.rotate(-ang);
  g.drawImage(src, 0, v0 * ih, iw, (v1 - v0) * ih, -pu * iw * s, (v0 - pv) * ih * s, iw * s, (v1 - v0) * ih * s);
  g.restore();
}

/**
 * Zeichnet die Figur ohne Kopf in eine Leinwand (w × h Gerätepixel), Sohlen auf `groundY`, Mitte bei w/2.
 * Gibt zurück, wo Kopf, Hand und Füße sitzen.
 */
export function drawFigure(g: CanvasRenderingContext2D, w: number, h: number, H: number, groundY: number, pose: FigurePose, look: FigureLook): FigureOut {
  g.clearRect(0, 0, w, h);
  const cx = w / 2;
  const G = GAIT[pose.gait];
  const LM = ART.parts.leg, AM = ART.parts.arm;
  const leg = imgs.leg, arm = imgs.arm;
  const move = pose.move, side = pose.side;
  const sh = (pose.shiver || 0) * Math.sin(pose.t * 57) * 0.008 * H;
  const cheer = pose.cheer || 0;

  // Beingeometrie aus dem Bild: Hüfte, Knie, Knöchel, Sohle
  const hipV = LM.hip[1], kneeV = LM.knee, ankleV = LM.ankle[1];
  const ls = (FIG.leg * H) / ((1 - hipV) * LM.h);
  const L1 = (kneeV - hipV) * LM.h * ls, L2 = (ankleV - kneeV) * LM.h * ls, sole = (1 - ankleV) * LM.h * ls;
  const reachLeg = (L1 + L2) * 0.985;

  const fA = footPath(pose.phase, pose.gait), fB = footPath(pose.phase + 0.5, pose.gait);
  const uA = fA.u * H * move, uB = fB.u * H * move;
  // Hüfte über dem Standbein (bei Doppelstand das weiter ausgestellte)
  const stanceU = fA.down && fB.down ? Math.max(Math.abs(uA), Math.abs(uB)) : fA.down ? Math.abs(uA) : Math.abs(uB);
  const breath = Math.sin(pose.t * 2.1 + pose.seed * 6.3) * 0.005 * H * (1 - move);
  const hipH = Math.sqrt(Math.max(0, reachLeg * reachLeg - stanceU * stanceU)) + sole - G.drop * H * move - 0.006 * H;
  const hipY = groundY - hipH + breath;
  const lean = G.lean * move * side;
  const spread = lerp(0.075, 0.018, side) * H;
  const hipA = { x: cx + sh - spread * 0.5 + 0.01 * H * side, y: hipY };
  const hipB = { x: cx + sh + spread * 0.5 - 0.01 * H * side, y: hipY };
  // Sohlen: Vor/Zurück nur in der Seitenansicht sichtbar, Anheben immer
  // Verankerte Füße (Standphase) bleiben genau dort stehen, wo sie aufgesetzt wurden – auch in Kurven
  const lk = pose.lock;
  const soleA = { x: fA.down && lk && lk[0] !== null ? cx + lk[0] : hipA.x + uA * side, y: groundY - fA.lift * H * move };
  const soleB = { x: fB.down && lk && lk[1] !== null ? cx + lk[1] : hipB.x + uB * side, y: groundY - fB.lift * H * move };

  // Seite: Knie beugt sich nach vorn (IK). Front: das gehobene Bein wird perspektivisch kürzer statt seitlich zu knicken.
  const sideK = smooth(Math.max(0, Math.min(1, (side - 0.15) / 0.7)));
  const legDraw = (hip: { x: number; y: number }, s: { x: number; y: number }, f: ReturnType<typeof footPath>, far: boolean) => {
    if (!leg) return;
    const src = (far && darkened("leg")) || leg;
    const k = ik(hip.x, hip.y, s.x, s.y - sole, L1, L2);
    const a1 = k.a1 * sideK, a2 = k.a2 * sideK;
    const ext = L1 * Math.cos(a1) + L2 * Math.cos(a2);
    const fz = Math.max(0.45, Math.min(1, (k.ay - hip.y) / Math.max(1e-3, ext)));
    const kx = hip.x + L1 * Math.sin(a1), ky = hip.y + L1 * Math.cos(a1) * fz;
    const ax = kx + L2 * Math.sin(a2), ay = ky + L2 * Math.cos(a2) * fz;
    const bone = (v0: number, v1: number, pu: number, pv: number, x: number, y: number, ang: number) => {
      g.save();
      g.translate(x, y);
      g.scale(1, fz);
      g.rotate(-ang);
      g.drawImage(src, 0, v0 * LM.h, LM.w, (v1 - v0) * LM.h, -pu * LM.w * ls, (v0 - pv) * LM.h * ls, LM.w * ls, (v1 - v0) * LM.h * ls);
      g.restore();
    };
    bone(kneeV - 0.035, ankleV + 0.02, LM.ankle[0], kneeV, kx, ky, a2);
    bone(hipV, kneeV + 0.045, LM.hip[0], hipV, hip.x, hip.y, a1);
    const toe = f.down ? 0 : Math.sin(Math.PI * f.s) * 0.3 * move * sideK;
    strip(g, src, LM.w, LM.h, ankleV, 1, LM.ankle[0], ankleV, ax, ay, -toe, ls);
  };

  // Arme: Schulter oben am Mantel, Pendel gegengleich zu den Beinen
  const as = (FIG.arm * H) / ((1 - AM.shoulder[1]) * AM.h);
  const shoulderY = hipY - FIG.shoulderAboveHip * H;
  // gegen das gleichseitige Bein: nahes Bein vorn → naher Arm hinten
  const swingFar = -(uB / (FIG.leg * H)) * G.arm * 2.2 * side;
  const swingNear = -(uA / (FIG.leg * H)) * G.arm * 2.2 * side;
  const idle = Math.sin(pose.t * 1.3 + pose.seed * 3.1) * 0.05 * (1 - move);
  const sneakArm = pose.gait === "sneak" ? 1.0 * move : 0;
  const reach = pose.reach || 0;
  const farX = cx + sh + lerp(-0.115, 0.02, side) * H;
  const nearX = cx + sh + lerp(0.115, -0.012, side) * H;
  const angFar = swingFar + idle + sneakArm * 0.8 - 0.09 * (1 - side) - cheer * 2.6 * (1 - side) + cheer * 2.4 * side;
  const angNear = swingNear - idle + sneakArm + reach * 1.5 + 0.09 * (1 - side) + cheer * 2.6;
  const armColor = look.thief ? "#3a4258" : look.color;
  const armDraw = (x: number, ang: number, far: boolean) => {
    if (!arm) return;
    strip(g, tintedArm(armColor, far) || arm, AM.w, AM.h, AM.shoulder[1], 1, AM.shoulder[0], AM.shoulder[1], x, shoulderY, ang, as);
  };

  g.save();
  if (pose.face < 0) {
    g.translate(w, 0);
    g.scale(-1, 1);
  }
  armDraw(farX, angFar, true);
  if (side > 0.5) {
    legDraw(hipB, soleB, fB, true);
    legDraw(hipA, soleA, fA, false);
  } else if (soleA.y < soleB.y) {
    legDraw(hipB, soleB, fB, false);
    legDraw(hipA, soleA, fA, false);
  } else {
    legDraw(hipA, soleA, fA, false);
    legDraw(hipB, soleB, fB, false);
  }
  if (side <= 0.5) armDraw(nearX, angNear, false);

  // Mantel um den Hals gedreht: Vorneigung und Nachschwung (Feder), leichtes Stauchen beim Aufsetzen
  const thief = !!look.thief;
  const cloak = thief ? imgs.thiefcloak : tintedCloak(look.color);
  const CM = thief ? ART.parts.thiefcloak : ART.parts.cloak;
  // Dieb: die Kapuze ist der Kopf, der Mantel reicht von der Kapuzenspitze bis unter die Hüfte
  const chH = thief ? 0.78 * H : FIG.cloakH * H;
  const cw = (chH * CM.w) / CM.h;
  const neckY = shoulderY - 0.03 * H;
  const tilt = lean * 0.55 - pose.sway;
  if (cloak) {
    const squash = 1 + 0.03 * move * Math.cos(pose.phase * Math.PI * 4);
    g.save();
    if (thief) {
      // Drehpunkt an den Schultern, Kapuzenspitze bei ~0.95 H
      g.translate(cx + sh, shoulderY);
      g.rotate(tilt);
      g.scale(1 / Math.sqrt(squash), squash);
      g.drawImage(cloak, -0.5 * cw, -0.5 * chH, cw, chH);
    } else {
      g.translate(cx + sh, neckY);
      g.rotate(tilt);
      g.scale(1 / Math.sqrt(squash), squash);
      g.drawImage(cloak, -CM.neck[0] * cw, -CM.neck[1] * chH, cw, chH);
    }
    g.restore();
  }
  if (side > 0.5) armDraw(nearX, angNear, false);
  g.restore();

  const mirror = (x: number) => (pose.face < 0 ? w - x : x);
  const headLocalX = cx + sh + Math.sin(tilt) * FIG.head * H * 0.5;
  const headY = neckY - FIG.head * H * 0.43 + (thief ? -0.02 * H : 0);
  const nod = Math.sin(pose.t * 1.7 + pose.seed * 5) * 2 * (1 - move) + Math.sin(pose.phase * Math.PI * 4) * 2.5 * move;
  const hx = nearX + Math.sin(angNear) * FIG.arm * H, hy = shoulderY + Math.cos(angNear) * FIG.arm * H;
  return {
    headX: mirror(headLocalX),
    headY,
    headRot: (pose.face < 0 ? -1 : 1) * ((tilt * 180) / Math.PI * 0.7) + nod,
    handX: mirror(hx),
    handY: hy,
    feet: [
      { x: mirror(soleA.x), y: soleA.y, down: fA.down },
      { x: mirror(soleB.x), y: soleB.y, down: fB.down },
    ],
  };
}
