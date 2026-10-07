/* Spielgefühl: Partikel, Wackeln, Blitz. Eine Zeichenfläche über der Bühne (FxLayer) zeichnet alles.
 * Regeln aus ref2game gamefeel.md §4: jede Aktion antwortet auf drei Zeitebenen (sofort, kurz, lang);
 * die sofortige Ebene landet im selben Bild wie die Aktion. Ziele sind DOM-Anker ([data-fx="…"]) oder Punkte. */

export type FxKind = "shard" | "spark" | "dust" | "ring" | "star" | "feather" | "coin" | "ink" | "confetti";

interface Particle {
  kind: FxKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  life: number;
  age: number;
  color: string;
  g: number;
  drag: number;
  seed: number;
}

export type At = string | Element | { x: number; y: number } | null | undefined;

const parts: Particle[] = [];
let shakeAmp = 0;
let shakeT = 0;
let flashColor = "";
let flashLife = 0;
let flashAge = 0;
let freeze = 0;
let pulse: { color: string; period: number } | null = null;

/** Mittelpunkt eines Ankers in Bildschirm-Pixeln */
export function anchor(at: At): { x: number; y: number } | null {
  if (!at) return null;
  if (typeof at === "object" && "x" in at && "y" in at && !(at instanceof Element)) return at;
  const el = typeof at === "string" ? document.querySelector(at.startsWith("[") || at.startsWith(".") || at.startsWith("#") ? at : `[data-fx="${at}"]`) : at;
  if (!el) return null;
  const r = (el as Element).getBoundingClientRect();
  if (!r.width && !r.height) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export interface BurstOpts {
  n?: number;
  color?: string | string[];
  speed?: [number, number];
  size?: [number, number];
  life?: [number, number];
  spread?: number; // Radiant um die Richtung
  dir?: number; // Radiant, 0 = rechts, -π/2 = hoch
  g?: number;
  drag?: number;
  jitter?: number; // Startversatz in px
}

/** Partikel aus einem Punkt oder Anker */
export function burst(kind: FxKind, at: At, o: BurstOpts = {}) {
  const p = anchor(at);
  if (!p) return;
  const n = o.n ?? 16;
  const cols = Array.isArray(o.color) ? o.color : [o.color || "#ffd36e"];
  const [s0, s1] = o.speed ?? [120, 420];
  const [z0, z1] = o.size ?? [3, 8];
  const [l0, l1] = o.life ?? [0.5, 1.1];
  const spread = o.spread ?? Math.PI * 2;
  const dir = o.dir ?? -Math.PI / 2;
  for (let i = 0; i < n; i++) {
    const a = dir + (Math.random() - 0.5) * spread, sp = rand(s0, s1);
    parts.push({
      kind,
      x: p.x + rand(-1, 1) * (o.jitter ?? 4),
      y: p.y + rand(-1, 1) * (o.jitter ?? 4),
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      rot: rand(0, Math.PI * 2),
      vr: rand(-9, 9),
      size: rand(z0, z1),
      life: rand(l0, l1),
      age: 0,
      color: cols[i % cols.length],
      g: o.g ?? (kind === "spark" || kind === "star" ? 260 : kind === "feather" ? 60 : kind === "dust" || kind === "ring" ? 0 : 900),
      drag: o.drag ?? (kind === "dust" ? 3 : kind === "feather" ? 2.2 : 0.6),
      seed: Math.random() * 100,
    });
  }
  if (parts.length > 900) parts.splice(0, parts.length - 900);
}

/** Ein Ring (Stoßwelle) */
export function ring(at: At, color = "rgba(255,240,190,0.9)", size = 120, life = 0.6) {
  const p = anchor(at);
  if (!p) return;
  parts.push({ kind: "ring", x: p.x, y: p.y, vx: 0, vy: 0, rot: 0, vr: 0, size, life, age: 0, color, g: 0, drag: 0, seed: 0 });
}

/** Bildschirm wackeln (Stärke in px, klingt ab) */
export function shake(amp = 8, dur = 0.35) {
  shakeAmp = Math.max(shakeAmp, amp);
  shakeT = Math.max(shakeT, dur);
}

/** Kurzer Blitz über der Bühne */
export function flash(color = "rgba(255,255,255,0.75)", ms = 140) {
  flashColor = color;
  flashLife = ms / 1000;
  flashAge = 0;
}

/** Trefferpause: Partikel und Wackeln halten kurz an (der Moment „sitzt“) */
export function hitstop(ms = 90) {
  freeze = Math.max(freeze, ms / 1000);
}

/** Dauerpuls am Rand (Spannung, z. B. Fluchtuhr fast abgelaufen); null beendet ihn */
export function setPulse(p: { color: string; period: number } | null) {
  pulse = p;
}

let featherImg: HTMLImageElement | null = null;
function feather() {
  if (!featherImg) {
    featherImg = new Image();
    featherImg.src = "/game/alibi/icons/feather.webp";
  }
  return featherImg.complete ? featherImg : null;
}

let clock = 0;
/** Ein Schritt: Bewegung, dann Zeichnen. Gibt den Wackel-Versatz zurück (px, Grad). */
export function stepFx(g: CanvasRenderingContext2D, w: number, h: number, dpr: number, dt: number) {
  clock += dt;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const frozen = freeze > 0;
  if (frozen) freeze -= dt;
  const sdt = frozen ? 0 : dt;
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.age += sdt;
    if (p.age >= p.life) {
      parts.splice(i, 1);
      continue;
    }
    const k = Math.exp(-p.drag * sdt);
    p.vx *= k;
    p.vy = p.vy * k + p.g * sdt;
    if (p.kind === "feather") p.vx += Math.sin(clock * 3 + p.seed) * 40 * sdt;
    p.x += p.vx * sdt;
    p.y += p.vy * sdt;
    p.rot += p.vr * sdt;
    const f = p.age / p.life;
    const fade = f < 0.1 ? f / 0.1 : 1 - Math.max(0, (f - 0.55) / 0.45);
    g.save();
    g.globalAlpha = Math.max(0, Math.min(1, fade));
    g.translate(p.x, p.y);
    switch (p.kind) {
      case "shard": {
        g.rotate(p.rot);
        g.fillStyle = p.color;
        g.beginPath();
        g.moveTo(-p.size, -p.size * 0.4);
        g.lineTo(p.size * 0.8, -p.size * 0.7);
        g.lineTo(p.size * 0.5, p.size * 0.6);
        g.closePath();
        g.fill();
        g.fillStyle = "rgba(255,255,255,0.35)";
        g.fillRect(-p.size * 0.5, -p.size * 0.5, p.size * 0.5, p.size * 0.2);
        break;
      }
      case "spark": {
        g.globalCompositeOperation = "lighter";
        const tail = Math.hypot(p.vx, p.vy) * 0.035;
        const a = Math.atan2(p.vy, p.vx);
        g.rotate(a);
        const grd = g.createLinearGradient(-tail, 0, p.size, 0);
        grd.addColorStop(0, "rgba(255,160,60,0)");
        grd.addColorStop(1, p.color);
        g.fillStyle = grd;
        g.beginPath();
        g.ellipse(0, 0, tail + p.size, p.size * 0.5, 0, 0, Math.PI * 2);
        g.fill();
        break;
      }
      case "star": {
        g.globalCompositeOperation = "lighter";
        g.rotate(p.rot * 0.3);
        const s = p.size * (1 + 0.3 * Math.sin(clock * 20 + p.seed));
        g.fillStyle = p.color;
        g.beginPath();
        for (let k = 0; k < 8; k++) {
          const r = k % 2 ? s * 0.28 : s;
          const an = (k * Math.PI) / 4;
          g.lineTo(Math.cos(an) * r, Math.sin(an) * r);
        }
        g.closePath();
        g.fill();
        break;
      }
      case "dust": {
        const r = p.size * (1 + f * 2.2);
        const grd = g.createRadialGradient(0, 0, 0, 0, 0, r);
        grd.addColorStop(0, p.color);
        grd.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = grd;
        g.beginPath();
        g.arc(0, 0, r, 0, Math.PI * 2);
        g.fill();
        break;
      }
      case "ring": {
        const r = p.size * (0.15 + 0.85 * (1 - Math.pow(1 - f, 3)));
        g.strokeStyle = p.color;
        g.lineWidth = Math.max(1, 6 * (1 - f));
        g.beginPath();
        g.arc(0, 0, r, 0, Math.PI * 2);
        g.stroke();
        break;
      }
      case "feather": {
        const im = feather();
        g.rotate(Math.sin(clock * 2.4 + p.seed) * 0.8);
        if (im) g.drawImage(im, -p.size, -p.size, p.size * 2, p.size * 2);
        break;
      }
      case "coin": {
        g.scale(Math.cos(clock * 8 + p.seed), 1);
        const grd = g.createRadialGradient(-p.size * 0.3, -p.size * 0.3, 0, 0, 0, p.size);
        grd.addColorStop(0, "#fff6c4");
        grd.addColorStop(0.5, "#f2b04a");
        grd.addColorStop(1, "#9a5b12");
        g.fillStyle = grd;
        g.beginPath();
        g.arc(0, 0, p.size, 0, Math.PI * 2);
        g.fill();
        break;
      }
      case "ink": {
        g.fillStyle = p.color;
        g.beginPath();
        g.arc(0, 0, p.size * (1 - f * 0.3), 0, Math.PI * 2);
        g.fill();
        break;
      }
      case "confetti": {
        g.rotate(p.rot);
        g.scale(1, Math.cos(clock * 9 + p.seed));
        g.fillStyle = p.color;
        g.fillRect(-p.size, -p.size * 0.45, p.size * 2, p.size * 0.9);
        break;
      }
    }
    g.restore();
  }
  // Blitz und Randpuls
  if (flashLife > 0) {
    flashAge += dt;
    const f = flashAge / flashLife;
    if (f < 1) {
      g.globalAlpha = 1 - f;
      g.fillStyle = flashColor;
      g.fillRect(0, 0, w, h);
      g.globalAlpha = 1;
    } else flashLife = 0;
  }
  if (pulse) {
    const k = 0.5 + 0.5 * Math.sin((clock * Math.PI * 2) / pulse.period);
    const grd = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    grd.addColorStop(0, "rgba(0,0,0,0)");
    grd.addColorStop(1, pulse.color);
    g.globalAlpha = 0.25 + 0.45 * k * k;
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    g.globalAlpha = 1;
  }
  // Wackeln (abklingendes Rauschen)
  let sx = 0, sy = 0, sr = 0;
  if (shakeT > 0 && !frozen) {
    shakeT -= dt;
    const a = shakeAmp * Math.max(0, shakeT) / 0.35;
    sx = Math.sin(clock * 73) * a;
    sy = Math.cos(clock * 61) * a * 0.7;
    sr = Math.sin(clock * 47) * a * 0.08;
    if (shakeT <= 0) shakeAmp = 0;
  }
  return { sx, sy, sr, busy: parts.length > 0 || flashLife > 0 || !!pulse || shakeT > 0 };
}

export const fxIdle = () => !parts.length && !flashLife && !pulse && shakeT <= 0;
