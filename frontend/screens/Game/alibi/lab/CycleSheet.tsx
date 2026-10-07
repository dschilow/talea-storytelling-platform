/* Werkstatt: Zyklusbogen der Spielfigur (ref2game animation.md §10: Bewegung Bild für Bild prüfen).
 * Zeilen: Gangart × Ansicht, Spalten: 8 Phasen eines Zyklus. Rote Linie = Boden, Punkte = Sohlen (grün = Standphase). */
import React, { useEffect, useRef } from "react";

import { drawFigure, loadFigureParts, type Gait } from "../live/figure";

const ROWS: { gait: Gait; side: number; face: 1 | -1; label: string; thief?: boolean; color: string }[] = [
  { gait: "walk", side: 1, face: 1, label: "Gehen seitlich", color: "#4a78d8" },
  { gait: "walk", side: 0, face: 1, label: "Gehen frontal", color: "#d24b45" },
  { gait: "run", side: 1, face: -1, label: "Rennen seitlich (links)", color: "#4f9b60" },
  { gait: "sneak", side: 1, face: 1, label: "Schleichen", color: "#353b5c" },
  { gait: "walk", side: 1, face: 1, label: "Dieb (Kapuze)", color: "#000", thief: true },
];

export const CycleSheet: React.FC = () => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    void loadFigureParts().then(() => {
      const c = ref.current!;
      const g = c.getContext("2d")!;
      const H = 150, cw = 140, ch = 180;
      c.width = cw * 8 + 160;
      c.height = ch * ROWS.length;
      g.fillStyle = "#e9e4d6";
      g.fillRect(0, 0, c.width, c.height);
      const tile = document.createElement("canvas");
      tile.width = cw;
      tile.height = ch;
      const tg = tile.getContext("2d")!;
      ROWS.forEach((r, row) => {
        g.fillStyle = "#333";
        g.font = "bold 14px sans-serif";
        g.fillText(r.label, 8, row * ch + 24);
        for (let k = 0; k < 8; k++) {
          const out = drawFigure(tg, cw, ch, H, ch - 12, { phase: k / 8, move: 1, side: r.side, face: r.face, t: 0, seed: 0.3, gait: r.gait, sway: 0 }, { color: r.color, thief: r.thief });
          const x0 = 160 + k * cw, y0 = row * ch;
          g.drawImage(tile, x0, y0);
          g.strokeStyle = "rgba(200,40,40,0.6)";
          g.beginPath();
          g.moveTo(x0, y0 + ch - 12);
          g.lineTo(x0 + cw, y0 + ch - 12);
          g.stroke();
          out.feet.forEach((f) => {
            g.fillStyle = f.down ? "#1a9a40" : "#d0302a";
            g.beginPath();
            g.arc(x0 + f.x, y0 + f.y, 3, 0, 7);
            g.fill();
          });
          // Kopfposition
          g.strokeStyle = "rgba(0,0,0,0.35)";
          g.beginPath();
          g.arc(x0 + out.headX, y0 + out.headY, H * 0.25, 0, 7);
          g.stroke();
        }
      });
    });
  }, []);
  return <canvas ref={ref} style={{ display: "block" }} />;
};
