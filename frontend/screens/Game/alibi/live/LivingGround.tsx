import React, { useEffect, useRef, useState } from "react";

import { IMG } from "../content";
import { Ground, type GroundLight } from "./ground";
import { director } from "../audio";
import { now, onFrame, reducedMotion } from "./ticker";

const MASK = "/game/alibi/map/village.mask.png";

/**
 * Kartenboden: WebGL-Shader (lebendig) oder, ohne WebGL2, das stille Bild.
 * `act` 0 Abend, 1 Mitternacht, 2 Morgengrauen, 3 Tag; Wechsel werden über 2 s überblendet.
 */
export const LivingGround: React.FC<{ act: number; lights: GroundLight[]; onTap?: (x: number, y: number) => void; className?: string }> = ({ act, lights, onTap, className }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const ground = useRef<Ground | null>(null);
  const actRef = useRef(act);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    actRef.current = act;
  }, [act]);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    let g: Ground;
    try {
      g = new Ground(c, IMG.map, MASK, () => setReady(true));
    } catch {
      setFailed(true);
      return;
    }
    g.act = actRef.current;
    ground.current = g;
    const still = reducedMotion();
    g.motion = still ? 0 : 1;
    // Auflösung passt sich dem Gerät an: kommt es nicht mit (lange Bildzeiten), wird die Leinwand kleiner
    let quality = 1;
    const size = () => {
      const r = c.clientWidth || 360;
      const px = Math.round(Math.min(1400, r * Math.min(2, window.devicePixelRatio || 1) * quality));
      g.resize(px, px);
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(c);
    // Nicht sichtbar (weggescrollt): nicht zeichnen
    let visible = true;
    const io = new IntersectionObserver((es) => (visible = es.some((e) => e.isIntersecting)), { threshold: 0 });
    io.observe(c);
    let frozen = 0, slow = 0, frames = 0;
    const off = onFrame((t, dt) => {
      // Akt-Wechsel weich überblenden
      const want = actRef.current;
      g.act += (want - g.act) * (1 - Math.exp(-dt * 1.8));
      if (Math.abs(want - g.act) < 0.002) g.act = want;
      if (!visible) return;
      // Bei reduzierter Bewegung nur bei Änderungen neu zeichnen
      if (still && Math.abs(want - g.act) < 0.002 && frozen++ > 2) return;
      frames++;
      if (dt > 0.028) slow++;
      if (frames >= 90) {
        if (slow > 45 && quality > 0.5) {
          quality = Math.max(0.5, quality - 0.2);
          size();
        }
        frames = slow = 0;
      }
      g.render(still ? 12 : t);
    });
    const onLost = (e: Event) => {
      e.preventDefault();
      setFailed(true);
    };
    c.addEventListener("webglcontextlost", onLost);
    return () => {
      off();
      ro.disconnect();
      io.disconnect();
      c.removeEventListener("webglcontextlost", onLost);
      g.destroy();
      ground.current = null;
    };
  }, []);

  useEffect(() => {
    ground.current?.setLights(lights);
  }, [lights, ready]);

  if (failed) return <img src={IMG.map} alt="" className={className} draggable={false} />;
  return (
    <>
      {!ready ? <img src={IMG.map} alt="" className={className} draggable={false} /> : null}
      <canvas
        ref={ref}
        className={className}
        style={{ opacity: ready ? 1 : 0, transition: "opacity 400ms" }}
        onPointerDown={(e) => {
          const c = e.currentTarget;
          const u = e.nativeEvent.offsetX / (c.clientWidth || 1), v = e.nativeEvent.offsetY / (c.clientHeight || 1);
          ground.current?.tapAt(u, v, now());
          director.sfx(ground.current?.isWater(u, v) ? "splash" : "twinkle");
          onTap?.(u * 100, v * 100);
        }}
      />
    </>
  );
};
