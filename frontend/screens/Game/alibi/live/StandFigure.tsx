import React, { useEffect, useRef } from "react";

import { drawFigure, FIG, loadFigureParts, partsReady, strideH, type FigureLook, type Gait } from "./figure";
import { onFrame, reducedMotion } from "./ticker";

/**
 * Eine einzelne große Figur außerhalb der Karte (Enthüllung, Abspann): Körper mit Gelenken, Kopf als DOM darüber.
 * Steht (Atmen), zittert, jubelt oder greift – je nach `pose`, weich überblendet.
 */
export const StandFigure: React.FC<{
  H: number;
  look: FigureLook;
  head?: React.ReactNode;
  /** über dem Kopf (z. B. Kapuze), gleiche Position wie der Kopf */
  overHead?: React.ReactNode;
  pose?: { shiver?: number; cheer?: number; reach?: number };
  face?: 1 | -1;
  className?: string;
}> = ({ H, look, head, overHead, pose, face = 1, className }) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const overRef = useRef<HTMLDivElement>(null);
  const poseRef = useRef(pose);
  poseRef.current = pose;
  const lookRef = useRef(look);
  lookRef.current = look;
  const W = Math.round(H * 0.95), BOX = Math.round(H * 1.05), hp = Math.round(FIG.head * H);

  useEffect(() => {
    void loadFigureParts();
    const cv = canvas.current;
    const g = cv?.getContext("2d");
    if (!cv || !g) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(BOX * dpr);
    const cur = { shiver: 0, cheer: 0, reach: 0 };
    const still = reducedMotion();
    return onFrame((t, dt) => {
      if (!partsReady()) return;
      const p = poseRef.current || {};
      const k = 1 - Math.exp(-dt * 8);
      cur.shiver += ((p.shiver || 0) - cur.shiver) * k;
      cur.cheer += ((p.cheer || 0) - cur.cheer) * k;
      cur.reach += ((p.reach || 0) - cur.reach) * k;
      const out = drawFigure(g, cv.width, cv.height, H * dpr, cv.height - 0.03 * H * dpr, { phase: 0, move: 0, side: 1, face, t: still ? 0 : t, seed: 0.4, gait: "walk", sway: 0, ...cur }, lookRef.current);
      const tf = `translate(${out.headX / dpr - hp / 2}px, ${out.headY / dpr - hp / 2}px) rotate(${out.headRot.toFixed(2)}deg)`;
      if (headRef.current) headRef.current.style.transform = tf;
      if (overRef.current) overRef.current.style.transform = tf;
    });
  }, [H, W, BOX, hp, face]);

  return (
    <div className={`relative ${className || ""}`} style={{ width: W, height: BOX }}>
      <canvas ref={canvas} className="absolute inset-0" style={{ width: W, height: BOX }} />
      {head ? (
        <div ref={headRef} className="absolute left-0 top-0" style={{ width: hp, height: hp }}>
          {head}
        </div>
      ) : null}
      {overHead ? (
        <div ref={overRef} className="pointer-events-none absolute left-0 top-0" style={{ width: hp, height: hp }}>
          {overHead}
        </div>
      ) : null}
    </div>
  );
};

/**
 * Eine Figur läuft quer durch einen Streifen (z. B. der Dieb um Mitternacht). Füße stehen fest: die Gangphase
 * kommt aus der zurückgelegten Strecke. Läuft einmal durch, wartet `pause` Sekunden und beginnt von vorn.
 */
export const StripWalker: React.FC<{ H: number; look: FigureLook; gait?: Gait; speed?: number; pause?: number; className?: string; onStep?: () => void }> = ({ H, look, gait = "sneak", speed = 0.55, pause = 3, className, onStep }) => {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stepRef = useRef(onStep);
  stepRef.current = onStep;
  const lookRef = useRef(look);
  lookRef.current = look;
  const W = Math.round(H * 0.95), BOX = Math.round(H * 1.05);
  useEffect(() => {
    void loadFigureParts();
    const cv = canvas.current, el = wrap.current;
    const g = cv?.getContext("2d");
    if (!cv || !g || !el) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(BOX * dpr);
    let x = -W, wait = 0, dist = 0, steps = 0, move = 0;
    const still = reducedMotion();
    return onFrame((t, dt) => {
      const width = el.clientWidth || 360;
      const v = speed * H; // px/s
      if (wait > 0) {
        wait -= dt;
        move += (0 - move) * (1 - Math.exp(-dt * 8));
      } else if (!still) {
        x += v * dt;
        dist += v * dt;
        move += (1 - move) * (1 - Math.exp(-dt * 8));
        const st = Math.floor((dist / (strideH(gait) * H)) * 2);
        if (st > steps) {
          steps = st;
          stepRef.current?.();
        }
        if (x > width + W) {
          x = -W;
          wait = pause;
        }
      }
      if (!partsReady()) return;
      cv.style.transform = `translateX(${x.toFixed(1)}px)`;
      drawFigure(g, cv.width, cv.height, H * dpr, cv.height - 0.03 * H * dpr, { phase: dist / (strideH(gait) * H), move, side: 1, face: 1, t, seed: 0.7, gait, sway: move * 0.08 }, lookRef.current);
    });
  }, [H, W, BOX, gait, speed, pause]);
  return (
    <div ref={wrap} className={`pointer-events-none relative overflow-hidden ${className || ""}`} style={{ height: BOX }}>
      <canvas ref={canvas} className="absolute bottom-0 left-0" style={{ width: W, height: BOX }} />
    </div>
  );
};
