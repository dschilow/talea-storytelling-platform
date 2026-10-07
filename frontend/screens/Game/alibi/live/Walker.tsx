import React, { useEffect, useRef } from "react";

import { drawFigure, FIG, loadFigureParts, partsReady, strideH, type FigureLook, type FigureOut } from "./figure";
import { onFrame } from "./ticker";
import { FIGURE_H, getWalker, gestureAmount, type Walker } from "./walkers";

/** Gelenkspur für Prüfungen (nur in der Entwicklung): Sohlen je Bild in Kartenkoordinaten. */
export interface TraceFrame {
  t: number;
  id: number;
  x: number;
  y: number;
  feet: { x: number; y: number; down: boolean }[];
  move: number;
  side: number;
  face: number;
}
const TRACE: TraceFrame[] = [];
if (import.meta.env.DEV && typeof window !== "undefined") (window as unknown as { __alibiTrace: TraceFrame[] }).__alibiTrace = TRACE;

/**
 * Eine laufende Figur auf der Dorfkarte. Liegt in der geneigten Kartenebene: Schatten am Boden, darüber ein
 * Aufsteller (senkrecht zur Karte) mit Körper (Leinwand) und Kopf (`head`, meist das Porträt-Medaillon).
 * Position und Haltung kommen jedes Bild aus dem Laufzustand (walkers.ts), ohne React neu zu zeichnen.
 */
export const WalkerFigure: React.FC<{
  world: object;
  id: number;
  /** Kartenbreite in px (Maßstab der Figur) */
  boardPx: number;
  tilt: number;
  look: FigureLook;
  head: React.ReactNode;
  /** zusätzlich in der Hand (z. B. Beute) */
  carry?: React.ReactNode;
  pose?: { reach?: number; shiver?: number; cheer?: number };
  dim?: boolean;
  className?: string;
}> = ({ world, id, boardPx, tilt, look, head, carry, pose, dim, className }) => {
  const outer = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const carryRef = useRef<HTMLDivElement>(null);
  const shadow = useRef<HTMLSpanElement>(null);
  const lookRef = useRef(look);
  const poseRef = useRef(pose);
  lookRef.current = look;
  poseRef.current = pose;

  const H = Math.max(24, (FIGURE_H / 100) * boardPx);
  const W = Math.round(H * 0.95);
  const BOX_H = Math.round(H * 1.05);
  const headPx = Math.round(FIG.head * H);

  useEffect(() => {
    void loadFigureParts();
    const cv = canvas.current;
    if (!cv) return;
    const g = cv.getContext("2d");
    if (!g) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(BOX_H * dpr);
    let last: FigureOut | null = null;
    let lastX = NaN, lastY = NaN;
    // Fuß-Anker in Kartenprozent (x), solange der Fuß steht
    const planted: [boolean, boolean] = [false, false];
    const anchor: [number, number] = [0, 0];
    return onFrame((t) => {
      const w: Walker | undefined = getWalker(world, id);
      if (!w || !outer.current) return;
      if (w.x !== lastX || w.y !== lastY) {
        outer.current.style.left = `${w.x}%`;
        outer.current.style.top = `${w.y}%`;
        outer.current.style.zIndex = String(Math.round(w.y * 10) + 2);
        lastX = w.x;
        lastY = w.y;
      }
      if (!partsReady()) return;
      const p = poseRef.current || {};
      const toLocal = (k: number) => (planted[k] && w.move > 0.5 ? ((anchor[k] - w.x) / 100) * boardPx * dpr * w.face : null);
      last = drawFigure(
        g,
        cv.width,
        cv.height,
        H * dpr,
        cv.height - 0.03 * H * dpr,
        {
          // Phase aus der Strecke: ein Zyklus = Schrittweite des Gangs (in Figurenhöhen)
          phase: w.dist / (strideH(w.gait) * FIGURE_H),
          move: w.move,
          side: w.side,
          face: w.face,
          t,
          seed: w.seed,
          gait: w.gait,
          sway: w.sway,
          reach: Math.max(p.reach || 0, gestureAmount(w, "reach")),
          shiver: Math.max(p.shiver || 0, gestureAmount(w, "shiver")),
          cheer: Math.max(p.cheer || 0, gestureAmount(w, "cheer")),
          lock: [toLocal(0), toLocal(1)],
        },
        lookRef.current
      );
      // Aufsetzen merken, Abheben lösen
      last.feet.forEach((f, k) => {
        if (f.down && !planted[k]) anchor[k] = w.x + ((f.x - cv.width / 2) / dpr / boardPx) * 100;
        planted[k] = f.down;
      });
      if (headRef.current) headRef.current.style.transform = `translate(${last.headX / dpr - headPx / 2}px, ${last.headY / dpr - headPx / 2}px) rotate(${last.headRot.toFixed(2)}deg)`;
      if (carryRef.current) carryRef.current.style.transform = `translate(${last.handX / dpr}px, ${last.handY / dpr}px)`;
      if (shadow.current) shadow.current.style.transform = `translate(-50%, -50%) scale(${(1 - w.move * 0.06).toFixed(3)})`;
      if (import.meta.env.DEV && TRACE.length < 20000 && w.move > 0.01) {
        // Sohlen zurück in Kartenprozent: Leinwand-Mitte = Fußpunkt der Figur
        const k = 100 / boardPx / dpr;
        TRACE.push({ t, id, x: w.x, y: w.y, move: w.move, side: w.side, face: w.face, feet: last.feet.map((f) => ({ x: w.x + (f.x - cv.width / 2) * k, y: f.y * k, down: f.down })) });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, id, W, BOX_H, H, headPx, boardPx]);

  const init = getWalker(world, id);
  return (
    <div
      ref={outer}
      className={className}
      style={{ position: "absolute", left: `${init?.x ?? 50}%`, top: `${init?.y ?? 50}%`, transformStyle: "preserve-3d", zIndex: Math.round((init?.y ?? 50) * 10) + 2 }}
    >
      <span ref={shadow} className="alibi-token-shadow absolute left-0 top-0" style={{ width: H * 0.5, height: H * 0.17, transform: "translate(-50%, -50%)" }} />
      <div className="absolute left-0 top-0" style={{ transform: `translate(-50%, -100%) rotateX(${-tilt}deg)`, transformOrigin: "50% 100%" }}>
        <div className={dim ? "alibi-standee is-dim relative" : "alibi-standee relative"} style={{ width: W, height: BOX_H }}>
          <canvas ref={canvas} className="pointer-events-none absolute left-0 top-0" style={{ width: W, height: BOX_H }} />
          <div ref={headRef} className="absolute left-0 top-0" style={{ width: headPx, height: headPx, transform: `translate(${W / 2 - headPx / 2}px, ${BOX_H - H * 0.85}px)`, willChange: "transform" }}>
            {head}
          </div>
          {carry ? (
            <div ref={carryRef} className="pointer-events-none absolute left-0 top-0" style={{ willChange: "transform" }}>
              <div style={{ transform: "translate(-50%, -60%)" }}>{carry}</div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
