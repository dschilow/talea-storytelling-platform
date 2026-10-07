/* Mitternachts-Alibi: Inhalte, Bildpfade und die gesamte Sprechliste (clips).
 * Die Texte selbst liegen in data/content-data.ts (aus dem geprüften Prototyp übernommen). */
import * as D from "./data/content-data";
import type { AlibiCharacter, LevelId, SpurKey } from "./types";

export interface Slot { id: number; name: string; time: string; icon: string; pub: string; whisper: string }
export interface Place { name: string; at: string; icon: string; short: string; color: string }
export interface Sight { id: string; icon: string; name: string; sfx: string }
export interface CaseDef { id: string; title: string; crime: string; loot: string; lootIcon: string; intro: string; solved: string; escaped: string }
export interface Prompt { icon: string; text: string }
export interface LevelInfo { icon: string; n: string; age: string; d: string }

export const SLOTS = D.SLOTS as unknown as Slot[];
export const PLACES = D.PLACES as unknown as Record<string, Place>;
export const SIGHTS = D.SIGHTS as unknown as Record<string, Sight[]>;
export const CASES = D.CASES as unknown as CaseDef[];
export const KOM = D.KOM as unknown as Record<string, string>;
export const WHISPER = D.WHISPER as unknown as Record<string, string>;
export const PROMPTS = D.PROMPTS as unknown as Prompt[];
export const SPUR_LABEL = D.SPUR_LABEL as unknown as Record<SpurKey, string>;
export const SPC_ICON = D.SPC_ICON as unknown as Record<string, string>;
export const GDR_ICON = D.GDR_ICON as unknown as Record<string, string>;
export const LEVEL_INFO = D.LEVEL_INFO as unknown as Record<LevelId, LevelInfo>;
export const NUM_WORDS = D.NUM_WORDS as unknown as string[];

export const COLORS: Record<string, string> = {
  Blau: "#4a78d8", Braun: "#8a6240", Gelb: "#e2b93b", Weiß: "#f2efe6", Rot: "#d24b45", Grau: "#9aa1a8",
  Grün: "#4f9b60", Lila: "#8d62c9", Schwarz: "#2a2a30", Rosa: "#eb8fb4", Orange: "#ee8a3c",
};

/** Reihenfolge der Fälle: Jeder Epilog endet mit einem Cliffhanger auf den nächsten. */
export const CASE_CHAIN = ["laterne", "kuchen", "rezept", "mondstein", "glocke", "honig", "hufeisen", "spieluhr"];
export const nextCaseId = (id: string) => CASE_CHAIN[(CASE_CHAIN.indexOf(id) + 1) % CASE_CHAIN.length];

/** Lage der Orte auf der Dorfkarte (Prozent der Kartenbreite/-höhe, Mittelpunkt der Lichtung). */
export const MAP_POS: Record<string, { x: number; y: number }> = {
  turm: { x: 49.9, y: 11.7 },
  bibliothek: { x: 22.0, y: 22.8 },
  wirtshaus: { x: 79.0, y: 23.1 },
  markt: { x: 49.7, y: 48.7 },
  baeckerei: { x: 13.7, y: 50.0 },
  schmiede: { x: 85.2, y: 50.1 },
  garten: { x: 23.9, y: 79.4 },
  bruecke: { x: 71.8, y: 79.4 },
};

/* ---------- Bilder (frontend/public/game) ---------- */
const ACT_FILES = ["abend", "mitternacht", "morgengrauen"];
export const IMG = {
  keyart: "/game/keyart/alibi.webp",
  place: (id: string) => `/game/alibi/places/${id}.webp`,
  sight: (id: string) => `/game/alibi/sights/${id}.webp`,
  loot: (caseId: string) => `/game/alibi/loot/${caseId}.webp`,
  act: (t: number) => `/game/alibi/acts/${ACT_FILES[t]}.webp`,
  tavi: (pose: "kommissar" | "whisper" | "surprised" | "cheer" | "shrug") => `/game/tavi/${pose}.webp`,
  icon: (name: "phone" | "lab" | "duel" | "vote" | "map" | "file" | "clue" | "bell" | "seal" | "feather" | "clock" | "vault" | "story" | "seek") => `/game/alibi/icons/${name}.webp`,
  map: "/game/alibi/map/village.webp",
  elster: "/game/alibi/elster/elster.webp",
  nest: "/game/alibi/elster/nest.webp",
};

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const placeWhisper = (id: string) => `Du warst ${PLACES[id].at}.`;
const placePublic = (id: string) => `${cap(PLACES[id].at)}.`;

/** Varianten: kom.act.0.1, kom.act.0.2 … */
export function variants(prefix: string): string[] {
  const out: string[] = [];
  for (let i = 1; KOM[`${prefix}.${i}`]; i++) out.push(`${prefix}.${i}`);
  return out;
}
export const pickVar = (prefix: string) => {
  const v = variants(prefix);
  return v[Math.floor(Math.random() * v.length)];
};

/** Eigenschaften-Vorschau für das Talea-Eigenschaftensystem (Beispiel, wird nicht gespeichert) */
export function traitFor(role: "culprit" | "innocent", won: boolean) {
  if (role === "culprit")
    return won
      ? { trait: "Kreativität", icon: "🎨", why: "hat ein Alibi erfunden, das bis zum Schluss gehalten hat" }
      : { trait: "Mut", icon: "🦁", why: "hat sich dem Verhör gestellt und die Wahrheit gestanden" };
  return won
    ? { trait: "Logik", icon: "🔢", why: "hat mit den anderen Widersprüche aufgedeckt und den Täter gefunden" }
    : { trait: "Ausdauer", icon: "🧗", why: "hat bis zum Schluss mitgerätselt, auch als es schwer wurde" };
}

/* ---------- Sprechliste ---------- */
export interface Clip {
  text: string;
  /** "tavi" = Erzähler, sonst der Name der Figur */
  voice: string;
  whisper: boolean;
}

/** Alle Clips, die das Spiel sprechen kann. Gleiche IDs wie in Stimmen.json (ElevenLabs). */
export function buildClips(chars: AlibiCharacter[]): Record<string, Clip> {
  const R: Record<string, Clip> = {};
  const put = (id: string, text: string, whisper = false, voice = "tavi") => (R[id] = { text, voice, whisper });
  Object.keys(KOM).forEach((id) => put(id, KOM[id]));
  NUM_WORDS.forEach((w, i) => {
    put(`num.${i + 1}`, `Nummer ${w}.`);
    put(`w.num.${i + 1}`, `Nummer ${w}.`, true);
    put(`numc.${i + 1}`, `Nummer ${w},`);
    put(`w.numc.${i + 1}`, `Nummer ${w},`, true);
  });
  SLOTS.forEach((s) => {
    put(`act.${s.id}`, s.pub);
    put(`w.act.${s.id}`, s.whisper, true);
  });
  Object.keys(PLACES).forEach((id) => {
    put(`place.${id}`, placePublic(id));
    put(`w.place.${id}`, placeWhisper(id), true);
  });
  Object.keys(SIGHTS).forEach((pid) =>
    SIGHTS[pid].forEach((s) => {
      put(`sight.${s.id}`, `${cap(s.name)}.`);
      put(`w.sight.${s.id}`, `${cap(s.name)}.`, true);
    })
  );
  Object.keys(WHISPER).forEach((id) => put(id, WHISPER[id], true));
  chars.forEach((c) => {
    put(`name.${c.s}`, `${c.n}.`);
    put(`character.${c.s}.quirk`, `${cap(c.q)}.`);
    (["intro", "stmt", "deny", "confess", "smug", "witness"] as const).forEach((k) => put(`character.${c.s}.${k}`, c[k], false, c.n));
  });
  return R;
}
