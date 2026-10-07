/* Ein gemeinsamer Animationstakt für alles Bewegte (Figuren, Tavi, Partikel, Kartenlicht).
 * Läuft nur, solange jemand zuhört und die Seite sichtbar ist. Zeit in Sekunden. */

export type FrameFn = (t: number, dt: number) => void;

const subs = new Set<FrameFn>();
let raf = 0;
let last = 0;
let clock = 0;

function frame(now: number) {
  raf = 0;
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
  last = now;
  clock += dt;
  subs.forEach((fn) => {
    try {
      fn(clock, dt);
    } catch (e) {
      console.error("[alibi/ticker]", e);
    }
  });
  if (subs.size && !document.hidden) raf = requestAnimationFrame(frame);
}

function kick() {
  if (!raf && subs.size && typeof document !== "undefined" && !document.hidden) {
    last = 0;
    raf = requestAnimationFrame(frame);
  }
}

if (typeof document !== "undefined") document.addEventListener("visibilitychange", kick);

/** Jedes Bild aufrufen; gibt die Abmeldung zurück. */
export function onFrame(fn: FrameFn): () => void {
  subs.add(fn);
  kick();
  return () => {
    subs.delete(fn);
  };
}

/** Aktuelle Taktzeit (Sekunden seit Start). */
export const now = () => clock;

/** Deterministische Pseudozufallszahl 0..1 aus Ganzzahlen (für Phasen, Abstände, Zappeln). */
export function rnd(a: number, b = 0): number {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Bewegung reduziert? (Systemeinstellung) */
export const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
