import React, { useEffect, useRef } from "react";

import { IMG } from "../content";
import { ART } from "./art.gen";
import { loadLips, mouth } from "./lips";
import { onFrame, reducedMotion } from "./ticker";

type Pose = "kommissar" | "whisper" | "surprised" | "cheer" | "shrug";
const LIVE = "/game/tavi/live/";

/**
 * Kommissar Tavi lebendig: blinzelt in unregelmäßigen Abständen (manchmal doppelt), atmet, und bewegt beim Sprechen
 * den Mund passend zur Lautstärke der Aufnahme. Die Varianten sind pixelgleiche Ausschnitte (scripts/game-art/gen-tavi.mjs).
 * `className` setzt die Größe des Bildes (Höhe oder Breite), wie bei einem normalen <img>.
 */
export const TaviSprite: React.FC<{
  pose?: Pose;
  className?: string;
  style?: React.CSSProperties;
  alt?: string;
  /** "h": Höhe kommt von className (Breite folgt dem Bild), "w": Breite kommt von className (Höhe folgt) */
  fit?: "h" | "w";
}> = ({ pose = "kommissar", className, style, alt = "", fit = "h" }) => {
  const wrap = useRef<HTMLSpanElement>(null);
  const blink = useRef<HTMLImageElement>(null);
  const t1 = useRef<HTMLImageElement>(null);
  const t2 = useRef<HTMLImageElement>(null);
  const meta = (ART as unknown as { tavi?: Record<string, { frames: Record<string, number[]> }> }).tavi?.[pose];
  const fr = meta?.frames || {};

  useEffect(() => {
    void loadLips();
    if (reducedMotion()) return;
    let nextBlink = 1.2 + Math.random() * 2.5, blinkEnd = -1, second = false;
    let open = 0;
    return onFrame((t, dt) => {
      // Blinzeln: 2,5–6 s Abstand, ab und zu ein Doppelblinzeln; beim Sprechen seltener
      if (t > nextBlink && blinkEnd < 0) {
        blinkEnd = t + 0.12;
      }
      if (blinkEnd > 0 && t > blinkEnd) {
        blinkEnd = -1;
        if (!second && Math.random() < 0.18) {
          second = true;
          nextBlink = t + 0.16;
        } else {
          second = false;
          nextBlink = t + 2.5 + Math.random() * 3.5;
        }
      }
      if (blink.current) blink.current.style.opacity = blinkEnd > 0 ? "1" : "0";
      // Mund: Lautstärke der Aufnahme, weich (öffnet schnell, schließt etwas langsamer)
      const m = mouth("tavi");
      open += (m - open) * (1 - Math.exp(-dt * (m > open ? 30 : 16)));
      if (t1.current) t1.current.style.opacity = open > 0.22 && open <= 0.58 ? "1" : "0";
      if (t2.current) t2.current.style.opacity = open > 0.58 ? "1" : "0";
      // Atmen und ein kleines Nicken beim Sprechen
      if (wrap.current) {
        const breath = 1 + Math.sin(t * 2.2) * 0.011;
        wrap.current.style.transform = `translateY(${(-open * 1.5).toFixed(2)}px) scale(${(1 + open * 0.012).toFixed(4)}, ${(breath + open * 0.018).toFixed(4)})`;
      }
    });
  }, [pose]);

  const layer = (k: string, ref: React.RefObject<HTMLImageElement | null>) => {
    const f = fr[k];
    if (!f) return null;
    return (
      <img
        ref={ref}
        src={`${LIVE}${pose}.${k}.webp`}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="pointer-events-none absolute"
        style={{ left: `${f[0] * 100}%`, top: `${f[1] * 100}%`, width: `${f[2] * 100}%`, height: `${f[3] * 100}%`, opacity: 0 }}
      />
    );
  };
  return (
    <span ref={wrap} className={`${/absolute/.test(className || "") ? "" : "relative"} inline-block shrink-0 ${className || ""}`} style={{ transformOrigin: "50% 100%", ...style }}>
      <img src={IMG.tavi(pose)} alt={alt} draggable={false} className={fit === "h" ? "block h-full w-auto max-w-none" : "block h-auto w-full"} />
      {layer("blink", blink)}
      {layer("talk1", t1)}
      {layer("talk2", t2)}
    </span>
  );
};
