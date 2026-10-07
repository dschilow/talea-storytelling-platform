import React, { useEffect, useRef } from "react";

import { director } from "../audio";
import { onFrame, reducedMotion, rnd } from "./ticker";

/**
 * Leben über der Dorfkarte, selten und unregelmäßig (keine sichtbaren Schleifen, ref2game gamefeel.md §5):
 * die Elster überfliegt das Dorf (Flügel als Gelenk), nachts flattern Fledermäuse, am Tag zieht ein Vogelschwarm.
 * Fliegendes schwebt über der Kartenebene (translateZ) und wirft einen Schatten. Antippen: die Elster schreckt auf.
 */
export const BoardLife: React.FC<{ act: number; boardPx: number; tilt: number }> = ({ act, boardPx, tilt }) => {
  const magpie = useRef<HTMLDivElement>(null);
  const wing = useRef<HTMLImageElement>(null);
  const mShadow = useRef<HTMLSpanElement>(null);
  const bats = useRef<HTMLDivElement>(null);
  const actRef = useRef(act);
  actRef.current = act;
  const scared = useRef(0);
  const clockRef = useRef(0);

  useEffect(() => {
    if (reducedMotion()) return;
    // Flugplan: Start nach 6–14 s, dann alle 26–60 s; jeder Flug eine andere Bahn
    let nextM = 6 + rnd(1, 7) * 8, mStart = -1, mN = 0, mProg = 0;
    let nextB = 3 + rnd(2, 3) * 6, bStart = -1, bN = 0;
    let clock = 0;
    return onFrame((_t, dt) => {
      clock += dt;
      clockRef.current = clock;
      // Elster
      const el = magpie.current, sh = mShadow.current;
      if (el && sh) {
        if (mStart < 0 && clock > nextM) {
          mStart = clock;
          mProg = 0;
          mN++;
          director.sfx("flap");
        }
        if (mStart >= 0) {
          // erschreckt (angetippt): schneller und hektischer
          mProg += dt / (scared.current > clock ? 2.4 : 6.5);
          const f = Math.min(1, mProg);
          const dir = rnd(mN, 11) > 0.5 ? 1 : -1;
          const y0 = 18 + rnd(mN, 12) * 55, y1 = y0 + (rnd(mN, 13) - 0.5) * 30;
          const x = dir > 0 ? -15 + f * 130 : 115 - f * 130;
          const y = y0 + (y1 - y0) * f + Math.sin(f * Math.PI) * -6;
          const z = 34 + Math.sin(f * Math.PI * 2 + mN) * 6;
          el.style.opacity = "1";
          el.style.left = sh.style.left = `${x}%`;
          el.style.top = sh.style.top = `${y}%`;
          el.style.transform = `translateZ(${(z / 100) * boardPx}px) rotateX(${-tilt}deg) scaleX(${dir})`;
          sh.style.opacity = "0.35";
          const flap = Math.sin(clock * (scared.current > clock ? 26 : 15));
          if (wing.current) wing.current.style.transform = `rotate(${(-35 + flap * 48).toFixed(1)}deg)`;
          if (f >= 1) {
            mStart = -1;
            nextM = clock + 26 + rnd(mN, 5) * 34;
            el.style.opacity = sh.style.opacity = "0";
          }
        }
      }
      // Fledermäuse (nachts) oder Vögel (abends/morgens)
      const b = bats.current;
      if (b) {
        if (bStart < 0 && clock > nextB) {
          bStart = clock;
          bN++;
          if (actRef.current === 1) director.sfx("bats");
        }
        if (bStart >= 0) {
          const f = Math.min(1, (clock - bStart) / 7);
          const night = actRef.current === 1;
          const dir = rnd(bN, 21) > 0.5 ? 1 : -1;
          const y0 = 10 + rnd(bN, 22) * 40;
          b.style.opacity = f < 0.05 ? String(f * 20) : f > 0.95 ? String((1 - f) * 20) : "1";
          Array.from(b.children).forEach((c, k) => {
            const e = c as HTMLElement;
            const lag = k * 0.05;
            const ff = Math.max(0, Math.min(1, f - lag));
            const x = dir > 0 ? -12 + ff * 125 : 112 - ff * 125;
            const y = y0 + k * 3.5 + Math.sin(ff * 9 + k) * (night ? 4 : 1.5);
            e.style.left = `${x}%`;
            e.style.top = `${y}%`;
            const flap = Math.sin(clock * (night ? 22 : 11) + k * 1.7);
            e.style.transform = `translateZ(${(0.42 + k * 0.03) * boardPx}px) rotateX(${-tilt}deg) scaleX(${dir}) scaleY(${(0.55 + 0.45 * Math.abs(flap)).toFixed(2)})`;
            e.dataset.kind = night ? "bat" : "bird";
          });
          if (f >= 1) {
            bStart = -1;
            nextB = clock + 18 + rnd(bN, 9) * 30;
            b.style.opacity = "0";
          }
        }
      }
    });
  }, [boardPx, tilt]);

  const mw = boardPx * 0.11;
  return (
    <div className="pointer-events-none absolute inset-0" style={{ transformStyle: "preserve-3d", zIndex: 1990 }} aria-hidden="true">
      <span ref={mShadow} className="alibi-fly-shadow absolute" style={{ width: mw * 0.7, height: mw * 0.2, opacity: 0 }} />
      <div
        ref={magpie}
        className="pointer-events-auto absolute"
        style={{ width: mw, height: mw * 0.5, opacity: 0, transformStyle: "preserve-3d", marginLeft: -mw / 2, marginTop: -mw * 0.25 }}
        onPointerDown={() => {
          scared.current = clockRef.current + 4;
          director.sfx("caw");
        }}
      >
        <img src="/game/alibi/live/parts/magpie_body.webp" alt="" className="absolute inset-0 h-full w-full object-contain" draggable={false} />
        <img ref={wing} src="/game/alibi/live/parts/magpie_wing.webp" alt="" className="absolute" style={{ width: mw * 0.62, left: mw * 0.28, top: -mw * 0.1, transformOrigin: "8% 70%" }} draggable={false} />
      </div>
      <div ref={bats} className="absolute inset-0" style={{ opacity: 0, transformStyle: "preserve-3d" }}>
        {[0, 1, 2, 3].map((k) => (
          <svg key={k} viewBox="0 0 40 20" className="alibi-flyer absolute" style={{ width: boardPx * (0.035 - k * 0.003), marginLeft: -boardPx * 0.017 }}>
            <path d="M20 12 C16 4 9 3 1 7 C6 8 8 11 9 14 C12 11 15 12 20 15 C25 12 28 11 31 14 C32 11 34 8 39 7 C31 3 24 4 20 12 Z" />
          </svg>
        ))}
      </div>
    </div>
  );
};
