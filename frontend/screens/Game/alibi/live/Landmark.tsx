import React from "react";

import { LANDMARK, landmarkFront, landmarkSize, landmarkSrc } from "./landmarks";

/**
 * Ein Gebäude als Aufsteller auf der geneigten Karte: Bild, Licht in Fenstern und Feuer (nach Akt stärker),
 * Rauch aus dem Schornstein, Funken aus der Esse, Dampf über dem Kakao, Klangringe der Glocke.
 * Positioniert über `left/top` (Fußpunkt = Platzmitte). Kinder in der Zeichnung (`children`) liegen im Bildrahmen.
 */
export const LandmarkStandee: React.FC<{
  id: string;
  x: number;
  y: number;
  boardPx: number;
  tilt: number;
  dim?: boolean;
  /** Zähler: bei jeder Erhöhung schlägt die Glocke (Klangringe) */
  bell?: number;
  className?: string;
  children?: React.ReactNode;
  below?: React.ReactNode;
}> = ({ id, x, y, boardPx, tilt, dim, bell, className, children, below }) => {
  const fx = LANDMARK[id];
  const sz = landmarkSize(id);
  const w = (sz.w / 100) * boardPx, h = (sz.h / 100) * boardPx;
  const u = (a: number) => `${a * 100}%`;
  // Der Aufsteller steht mit der Bildunterkante auf dem Boden (vorderer Rand des gemalten Sockels), sonst würde der
  // Sockel unter dem Drehpunkt in die Kartenebene hineingedreht und abgeschnitten. Aufsteller stehen parallel zum
  // Bildschirm, der Boden ist um `tilt` geneigt: damit die Sockelmitte auf der Platzmitte sitzt, liegt die Unterkante
  // um (1 − foot) · h / cos(tilt) davor.
  const front = landmarkFront(id, tilt);
  const yy = y + front;
  return (
    <div className="absolute" style={{ left: `${x}%`, top: `${yy}%`, transformStyle: "preserve-3d", zIndex: Math.round(yy * 10) }}>
      <span className="alibi-landmark-shadow absolute left-0 top-0" style={{ width: w * 0.95, height: w * 0.42, marginTop: -((front / 100) * boardPx) }} />
      <div className="absolute left-0 top-0" style={{ transform: `translate(-50%, -100%) rotateX(${-tilt}deg)`, transformOrigin: "50% 100%" }}>
        <div className={`alibi-standee alibi-landmark relative ${dim ? "is-dim" : ""} ${className || ""}`} style={{ width: w, height: h }}>
          <img src={landmarkSrc(id)} alt="" className="absolute inset-0 h-full w-full select-none" draggable={false} />
          {fx.glow.map(([gu, gv, r, col], k) => (
            <span
              key={`g${k}`}
              className="alibi-lglow"
              style={{ left: u(gu), top: u(gv), width: r * 2 * w, height: r * 2 * w, background: `radial-gradient(circle, rgba(${col},0.95) 0%, rgba(${col},0.35) 38%, rgba(${col},0) 70%)`, animationDelay: `${-k * 1.37}s` }}
            />
          ))}
          {(fx.smoke || []).map(([su, sv], k) =>
            [0, 1, 2, 3].map((n) => <span key={`s${k}${n}`} className="alibi-smoke" style={{ left: u(su), top: u(sv), width: w * 0.12, height: w * 0.12, animationDelay: `${-n * 1.1 - k * 0.5}s` }} />)
          )}
          {(fx.steam || []).map(([su, sv], k) =>
            [0, 1, 2].map((n) => <span key={`st${k}${n}`} className="alibi-steam" style={{ left: u(su), top: u(sv), width: w * 0.09, height: w * 0.09, animationDelay: `${-n * 0.9}s` }} />)
          )}
          {(fx.sparks || []).map(([su, sv], k) =>
            [0, 1, 2, 3, 4, 5].map((n) => (
              <span
                key={`sp${k}${n}`}
                className="alibi-spark"
                style={{ left: u(su), top: u(sv), ["--dx" as string]: `${(n % 2 ? 1 : -1) * (6 + n * 3)}px`, ["--dy" as string]: `${-18 - (n % 3) * 7}px`, animationDelay: `${-n * 0.27}s`, animationDuration: `${0.9 + (n % 3) * 0.25}s` } as React.CSSProperties}
              />
            ))
          )}
          {fx.bell && bell ? (
            <React.Fragment key={`bell${bell}`}>
              <span className="alibi-bellring" style={{ left: u(fx.bell[0]), top: u(fx.bell[1]), width: w * 0.9, height: w * 0.9 }} />
              <span className="alibi-bellring" style={{ left: u(fx.bell[0]), top: u(fx.bell[1]), width: w * 0.9, height: w * 0.9, animationDelay: "0.25s" }} />
            </React.Fragment>
          ) : null}
          {children}
          {/* Schild über dem Dach: Figuren, die davor stehen, verdecken es nicht */}
          {below ? (
            <div className="pointer-events-none absolute left-1/2 top-0" style={{ transform: "translate(-50%, -55%)" }}>
              {below}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
