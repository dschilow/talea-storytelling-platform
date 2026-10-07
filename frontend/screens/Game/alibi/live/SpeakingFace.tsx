import React, { useEffect, useRef } from "react";

import { mouth } from "./lips";
import { onFrame, reducedMotion } from "./ticker";

/** Spricht eine Figur, wippt ihr Porträt mit der Lautstärke ihrer Stimme (Kopf nickt leicht mit). */
export function useSpeakingPulse(ref: React.RefObject<HTMLElement | null>, who: string) {
  useEffect(() => {
    if (!who || reducedMotion()) return;
    let v = 0;
    return onFrame((t, dt) => {
      const m = mouth(who);
      v += (m - v) * (1 - Math.exp(-dt * 18));
      const el = ref.current;
      if (!el) return;
      el.style.transform = v > 0.01 ? `scale(${(1 + v * 0.07).toFixed(3)}) rotate(${(Math.sin(t * 9) * v * 3).toFixed(2)}deg)` : "";
    });
  }, [ref, who]);
}

export const SpeakingFace: React.FC<{ src: string; who: string; className?: string }> = ({ src, who, className }) => {
  const ref = useRef<HTMLImageElement>(null);
  useSpeakingPulse(ref, who);
  return <img ref={ref} src={src} alt="" className={`object-cover ${className || ""}`} draggable={false} />;
};
