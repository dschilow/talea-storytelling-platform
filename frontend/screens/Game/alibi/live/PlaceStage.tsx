import React, { useEffect, useRef } from "react";

import { IMG } from "../content";
import { onFrame, reducedMotion } from "./ticker";
import "./live.css";

/** Wie sich eine Beobachtung bewegt (Tiere leben, Dinge wippen, glänzen oder rappeln). */
const MOTION: Record<string, string> = {
  frosch: "hop", huhn: "waddle", maus: "peek", enten: "waddle", ziege: "chew", pferd: "waddle", kaefer: "crawl", schnecke: "crawl",
  wurm: "wiggle", teddy: "sway", katze: "breathe", fledermaus: "flutter", taube: "flutter", schmetterling: "flutter", eule: "owl",
  ballon: "float", kekse: "bob", gold: "shine", hoernchen: "bob", kaese: "bob", kerze: "flicker", ofen: "bob", schild: "shine",
  geige: "sway", wecker: "ring", netz: "sway", sonnenblume: "sway", angel: "sway", aepfel: "bob", tanz: "hop", funken: "bob", fisch: "jump",
};
const FLYING = new Set(["fledermaus", "taube", "schmetterling", "ballon"]);
/** Ortseffekte, die den Ort sofort erkennbar machen: Art und Bereich im Szenenbild [x0, x1, y0, y1] in Prozent */
type Fx = { k: string; box: [number, number, number, number] };
const PLACE_FX: Record<string, Fx[]> = {
  baeckerei: [{ k: "embers", box: [10, 34, 48, 66] }, { k: "smoke", box: [62, 70, 6, 12] }, { k: "dust", box: [0, 100, 20, 90] }],
  schmiede: [{ k: "sparks", box: [44, 66, 55, 68] }, { k: "smoke", box: [62, 72, 6, 12] }, { k: "embers", box: [45, 65, 58, 70] }],
  bruecke: [{ k: "water", box: [10, 90, 68, 92] }, { k: "fireflies", box: [0, 100, 30, 80] }],
  garten: [{ k: "fireflies", box: [0, 100, 20, 85] }, { k: "pollen", box: [0, 100, 10, 70] }],
  turm: [{ k: "stars", box: [0, 100, 0, 30] }, { k: "fireflies", box: [0, 100, 55, 90] }],
  markt: [{ k: "lanterns", box: [15, 85, 25, 40] }, { k: "pollen", box: [0, 100, 30, 80] }],
  wirtshaus: [{ k: "steam", box: [45, 55, 8, 16] }, { k: "lanterns", box: [30, 75, 45, 65] }],
  bibliothek: [{ k: "candles", box: [40, 70, 30, 45] }, { k: "dust", box: [0, 100, 15, 85] }],
};

/**
 * Ortsbühne: das Szenenbild des Ortes mit Tiefe (Parallaxe zu Finger oder sanftem Schweben), Licht des Akts,
 * Ortseffekten und – wenn angegeben – der Beobachtung als lebendem Tier oder Ding im Vordergrund.
 */
export const PlaceStage: React.FC<{ place: string; sight?: string | null; act?: number; className?: string; children?: React.ReactNode }> = ({ place, sight, act = 1, className, children }) => {
  const root = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLImageElement>(null);
  const mid = useRef<HTMLDivElement>(null);
  const front = useRef<HTMLImageElement>(null);
  const target = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (reducedMotion()) return;
    const cur = { x: 0, y: 0 };
    return onFrame((t, dt) => {
      // ohne Finger: sanftes Schweben, mit Finger: folgt
      const tx = target.current.x || Math.sin(t * 0.37) * 0.35, ty = target.current.y || Math.sin(t * 0.29 + 1) * 0.25;
      cur.x += (tx - cur.x) * (1 - Math.exp(-dt * 4));
      cur.y += (ty - cur.y) * (1 - Math.exp(-dt * 4));
      if (back.current) back.current.style.transform = `translate(${(-cur.x * 1.6).toFixed(2)}%, ${(-cur.y * 1.2).toFixed(2)}%) scale(1.08)`;
      if (mid.current) mid.current.style.transform = `translate(${(-cur.x * 3).toFixed(2)}%, ${(-cur.y * 2).toFixed(2)}%)`;
      if (front.current) front.current.style.transform = `translate(${(-cur.x * 5.5).toFixed(2)}%, ${(-cur.y * 3).toFixed(2)}%)`;
    });
  }, []);

  const move = (e: React.PointerEvent) => {
    const r = root.current?.getBoundingClientRect();
    if (!r) return;
    target.current = { x: ((e.clientX - r.left) / r.width - 0.5) * 2, y: ((e.clientY - r.top) / r.height - 0.5) * 2 };
  };
  const motion = sight ? MOTION[sight] || "bob" : null;
  const flying = sight ? FLYING.has(sight) : false;
  return (
    <div
      ref={root}
      className={`alibi-placestage relative overflow-hidden ${className || ""}`}
      onPointerMove={move}
      onPointerLeave={() => (target.current = { x: 0, y: 0 })}
    >
      <img ref={back} src={IMG.place(place)} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" style={{ transform: "scale(1.08)" }} />
      <div className={`ps-tint t${act}`} />
      <div className="pointer-events-none absolute inset-0">
        {(PLACE_FX[place] || []).map((f) => (
          <PlaceFx key={f.k} kind={f.k} box={f.box} />
        ))}
      </div>
      {sight ? (
        <div ref={mid} className="pointer-events-none absolute inset-0">
          <div className={`ps-critter ${flying ? "fly" : "ground"}`}>
            <img src={`/game/alibi/live/sights/${sight}.webp`} alt="" draggable={false} className={`crit-${motion}`} />
            {!flying ? <span className="ps-critter-shadow" /> : null}
            {sight === "geige" || sight === "frosch" ? <span className="ps-notes">♪</span> : null}
          </div>
        </div>
      ) : null}
      <img ref={front} src="/game/alibi/live/parts/foliage.webp" alt="" draggable={false} className="pointer-events-none absolute bottom-[-6%] left-[-8%] w-[116%] max-w-none opacity-95" />
      <div className="ps-vignette" />
      {children}
    </div>
  );
};

const N = { embers: 10, sparks: 12, smoke: 4, steam: 3, water: 1, fireflies: 9, pollen: 8, stars: 10, lanterns: 3, candles: 3, dust: 9 } as Record<string, number>;
const PlaceFx: React.FC<{ kind: string; box: [number, number, number, number] }> = ({ kind, box }) => {
  const [x0, x1, y0, y1] = box;
  const n = N[kind] || 6;
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        // gleichmäßig gestreut, aber nicht im Raster (goldener Schnitt)
        const fx = (i * 0.618 + 0.13) % 1, fy = (i * 0.382 + 0.29) % 1;
        return (
          <span
            key={i}
            className={`psfx-${kind}`}
            style={{ left: `${x0 + (x1 - x0) * fx}%`, top: `${y0 + (y1 - y0) * fy}%`, animationDelay: `${-((i * 0.73) % 5)}s`, animationDuration: `${2.4 + (i % 4) * 0.85}s` } as React.CSSProperties}
          />
        );
      })}
    </>
  );
};
