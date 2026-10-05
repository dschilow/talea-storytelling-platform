/* Mitternachts-Alibi: gemeinsame Typen für Engine, Inhalte und Oberfläche. */

export interface AlibiCharacterText {
  /** normalisierter Name, verbindet die Spieltexte mit dem Charakter-Pool */
  key: string;
  s: string;
  n: string;
  /** Kennfarbe (Blau, Braun, Gelb, Weiß, Rot, Grau, Grün, Lila, Schwarz, Rosa, Orange) */
  fam: string;
  /** Größe: klein, mittel, groß */
  szc: string;
  /** Art: Mensch, Tier, Zauberwesen */
  spc: string;
  /** Geschlecht: männlich, weiblich, neutral */
  gdr: string;
  q: string;
  story: string;
  intro: string;
  stmt: string;
  deny: string;
  confess: string;
  smug: string;
  /** Zeugen-Zeile für den Tathergang */
  witness: string;
}

export interface AlibiCharacter extends AlibiCharacterText {
  img: string;
}

export type SpurKey = "fam" | "szc" | "spc" | "gdr";
export interface Spur {
  k: SpurKey;
  v: string;
}

export type LevelId = "mini" | "junior" | "detektiv" | "meister";
export interface Level {
  n: string;
  acts: 2 | 3;
  loners: number;
  spuren: number;
  flags: boolean;
  talk: number;
  tries: number;
  keys: SpurKey[];
}

export interface Player {
  id: number;
  name: string;
  ch: AlibiCharacter;
}

export interface Claim {
  place: string;
  comp: number[];
  /** versiegelte Beobachtung (Sight-ID): Unschuldige die Wahrheit, der Dieb um Mitternacht geraten */
  sight?: string;
}

export interface World {
  N: number;
  T: number;
  level: LevelId;
  places: string[];
  crimePlace: string;
  culprit: number;
  pos: string[][];
  comp: number[][][];
  loners: number[];
  players: Player[];
  attempts?: number;
}

export interface Conflict {
  t: number;
  a: number;
  b: number;
}

export interface DuelOffer {
  place: string;
  t: number;
  who: number[];
}

export type Rng = () => number;
