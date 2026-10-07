import React, { useEffect, useRef } from "react";

import { fxIdle, stepFx } from "./fx";
import { onFrame, reducedMotion } from "./ticker";

/** Zeichenfläche für Partikel, Blitz und Randpuls über der ganzen Bühne; wackelt die Bühne (`target`). */
export const FxLayer: React.FC<{ target: React.RefObject<HTMLElement | null> }> = ({ target }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext("2d");
    if (!g) return;
    const still = reducedMotion();
    const size = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.round(window.innerWidth * dpr);
      c.height = Math.round(window.innerHeight * dpr);
    };
    size();
    window.addEventListener("resize", size);
    let shaking = false;
    let clean = true;
    const off = onFrame((_t, dt) => {
      // Nichts zu tun: einmal leeren, dann ruhen
      if (fxIdle()) {
        if (!clean) {
          g.setTransform(1, 0, 0, 1, 0, 0);
          g.clearRect(0, 0, c.width, c.height);
          clean = true;
        }
        if (shaking && target.current) {
          target.current.style.transform = "";
          shaking = false;
        }
        return;
      }
      clean = false;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = stepFx(g, window.innerWidth, window.innerHeight, dpr, dt);
      const el = target.current;
      if (el) {
        if ((r.sx || r.sy) && !still) {
          el.style.transform = `translate(${r.sx.toFixed(2)}px, ${r.sy.toFixed(2)}px) rotate(${r.sr.toFixed(3)}deg)`;
          shaking = true;
        } else if (shaking) {
          el.style.transform = "";
          shaking = false;
        }
      }
    });
    return () => {
      off();
      window.removeEventListener("resize", size);
    };
  }, [target]);
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-[60] h-full w-full" aria-hidden="true" />;
};
