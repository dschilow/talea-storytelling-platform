/* Gebäude auf der Dorfkarte: Größe und lebendige Stellen (in Anteilen des Bildes, gemessen an den Bildern in
 * public/game/alibi/live/landmarks). Rauch, Funken und Licht sind Code, nie ins Bild gemalt (ref2game: „AI paints, code rules“). */
import { ART } from "./art.gen";

export interface LandmarkFx {
  /** Breite auf der Karte in Prozent der Kartenbreite */
  w: number;
  /** Schornsteine: Rauch steigt auf */
  smoke?: [number, number][];
  /** Dampf (Kakao) */
  steam?: [number, number][];
  /** Funken aus der Esse */
  sparks?: [number, number][];
  /** Licht: u, v, Radius (Anteil der Breite), Farbe */
  glow: [number, number, number, string][];
  /** Glocke schwingt (Turm) */
  bell?: [number, number];
  /** Wasser glitzert */
  water?: [number, number, number][];
}

const WARM = "255,190,110";
export const LANDMARK: Record<string, LandmarkFx> = {
  baeckerei: { w: 25, smoke: [[0.745, 0.03]], glow: [[0.2, 0.55, 0.2, "255,150,70"], [0.6, 0.6, 0.12, WARM], [0.34, 0.38, 0.08, WARM]] },
  bibliothek: { w: 21, glow: [[0.55, 0.38, 0.14, "190,140,255"], [0.6, 0.72, 0.1, WARM]] },
  markt: { w: 26, glow: [[0.5, 0.34, 0.16, "190,230,255"], [0.22, 0.2, 0.08, WARM], [0.8, 0.2, 0.08, WARM]], water: [[0.5, 0.42, 0.1]] },
  garten: { w: 25, glow: [[0.8, 0.22, 0.12, "220,255,190"]] },
  turm: { w: 13.5, glow: [[0.45, 0.27, 0.22, "255,230,170"], [0.47, 0.15, 0.2, WARM]], bell: [0.47, 0.13] },
  bruecke: { w: 26, glow: [[0.25, 0.06, 0.09, WARM], [0.36, 0.04, 0.09, WARM], [0.72, 0.04, 0.09, WARM]], water: [[0.5, 0.55, 0.22]] },
  wirtshaus: { w: 22, steam: [[0.5, 0.02]], glow: [[0.67, 0.6, 0.12, WARM], [0.4, 0.53, 0.1, WARM]] },
  schmiede: { w: 24, smoke: [[0.735, 0.04]], sparks: [[0.45, 0.6]], glow: [[0.45, 0.6, 0.22, "255,110,40"], [0.24, 0.55, 0.08, WARM], [0.86, 0.55, 0.08, WARM]] },
};

export const landmarkSrc = (id: string) => `/game/alibi/live/landmarks/${id}.webp`;
export const landmarkSize = (id: string) => {
  const m = ART.landmarks[id as keyof typeof ART.landmarks];
  const fx = LANDMARK[id];
  return { w: fx.w, h: (fx.w * m.h) / m.w, foot: m.foot };
};

/** Abstand (Prozent der Kartenhöhe) von der Platzmitte bis zur Vorderkante des Aufstellers. */
export const landmarkFront = (id: string, tilt: number) => {
  const sz = landmarkSize(id);
  return ((1 - sz.foot) * sz.h) / Math.cos((tilt * Math.PI) / 180);
};
