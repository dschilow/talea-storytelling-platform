/**
 * Gemini voices of the audio dramas — Encore-free.
 *
 * Gemini 3.8 TTS has 30 prebuilt voices (no clones, no child voices). A figure is
 * made by voice plus direction: Gemini follows age and mood in the instructions
 * closely (measured 2026-10-24: Fenrir speaks at 131 Hz as a father and at 308 Hz
 * as "a seven-year-old boy"), so a boy keeps a male voice and an old woman a
 * mature one. Every figure keeps its Gemini voice from episode to episode, like
 * with ElevenLabs: admin choice → stored automatic pick → new automatic pick.
 *
 * The screenplay is written for Eleven v4. Gemini performs the reaction tags in
 * the text ([laughs], [pause], [whispers] — measured: performed, not read aloud);
 * the leading tone tag and the figure's persona go into `instructions`, the
 * documented place for delivery (OpenRouter sends it as Gemini's speech style).
 */

import type { ScriptLine, VoiceFamily } from "../types";
import { splitLeadingTag } from "./screenplay";

export type VoiceGender = "female" | "male";
export type VoiceAge = "child" | "adult" | "old";

export interface GeminiVoice {
  /** API voice name. */
  name: string;
  gender: VoiceGender;
  /** Google's one-word character of the voice. */
  trait: string;
  /** German, for the Studio. */
  traitDe: string;
  /** Ages the voice plays convincingly with the right direction (Google's traits plus the 2026-10-24 audition). */
  ages: VoiceAge[];
}

export const GEMINI_VOICES: readonly GeminiVoice[] = [
  { name: "Zephyr", gender: "female", trait: "bright", traitDe: "hell", ages: ["child", "adult"] },
  { name: "Puck", gender: "male", trait: "upbeat", traitDe: "gut gelaunt", ages: ["child", "adult"] },
  { name: "Charon", gender: "male", trait: "informative", traitDe: "sachlich", ages: ["adult", "old"] },
  { name: "Kore", gender: "female", trait: "firm", traitDe: "bestimmt", ages: ["adult"] },
  { name: "Fenrir", gender: "male", trait: "excitable", traitDe: "aufgekratzt", ages: ["child", "adult"] },
  { name: "Leda", gender: "female", trait: "youthful", traitDe: "jugendlich", ages: ["child", "adult"] },
  { name: "Orus", gender: "male", trait: "firm", traitDe: "bestimmt", ages: ["adult"] },
  { name: "Aoede", gender: "female", trait: "breezy", traitDe: "luftig", ages: ["adult"] },
  { name: "Callirrhoe", gender: "female", trait: "easy-going", traitDe: "locker", ages: ["adult"] },
  { name: "Autonoe", gender: "female", trait: "bright", traitDe: "hell", ages: ["child", "adult"] },
  { name: "Enceladus", gender: "male", trait: "breathy", traitDe: "hauchig", ages: ["adult", "old"] },
  { name: "Iapetus", gender: "male", trait: "clear", traitDe: "klar", ages: ["adult"] },
  { name: "Umbriel", gender: "male", trait: "easy-going", traitDe: "locker", ages: ["adult"] },
  { name: "Algieba", gender: "male", trait: "smooth", traitDe: "weich", ages: ["adult"] },
  { name: "Despina", gender: "female", trait: "smooth", traitDe: "weich", ages: ["adult"] },
  { name: "Erinome", gender: "female", trait: "clear", traitDe: "klar", ages: ["child", "adult"] },
  { name: "Algenib", gender: "male", trait: "gravelly", traitDe: "rau", ages: ["adult", "old"] },
  { name: "Rasalgethi", gender: "male", trait: "informative", traitDe: "sachlich", ages: ["adult", "old"] },
  { name: "Laomedeia", gender: "female", trait: "upbeat", traitDe: "gut gelaunt", ages: ["child", "adult"] },
  { name: "Achernar", gender: "female", trait: "soft", traitDe: "sanft", ages: ["adult"] },
  { name: "Alnilam", gender: "male", trait: "firm", traitDe: "bestimmt", ages: ["adult"] },
  { name: "Schedar", gender: "male", trait: "even", traitDe: "ausgeglichen", ages: ["adult", "old"] },
  { name: "Gacrux", gender: "female", trait: "mature", traitDe: "reif", ages: ["old"] },
  { name: "Pulcherrima", gender: "female", trait: "forward", traitDe: "direkt", ages: ["adult"] },
  { name: "Achird", gender: "male", trait: "friendly", traitDe: "freundlich", ages: ["adult"] },
  { name: "Zubenelgenubi", gender: "male", trait: "casual", traitDe: "lässig", ages: ["adult"] },
  { name: "Vindemiatrix", gender: "female", trait: "gentle", traitDe: "behutsam", ages: ["adult", "old"] },
  { name: "Sadachbia", gender: "male", trait: "lively", traitDe: "lebhaft", ages: ["child", "adult"] },
  { name: "Sadaltager", gender: "male", trait: "knowledgeable", traitDe: "kundig", ages: ["adult", "old"] },
  { name: "Sulafat", gender: "female", trait: "warm", traitDe: "warm", ages: ["adult", "old"] },
];

/** The narrator of every Talea Original on Gemini (Captain Comedy has no Gemini twin): upbeat, playful, male. */
export const GEMINI_NARRATOR = "Puck";

const BY_NAME = new Map(GEMINI_VOICES.map((voice) => [voice.name.toLowerCase(), voice]));

/** The catalog entry of a voice name, case-insensitive ("puck" → Puck). */
export function geminiVoice(name?: string | null): GeminiVoice | undefined {
  return name ? BY_NAME.get(name.trim().toLowerCase()) : undefined;
}

/** "Puck · männlich · gut gelaunt" for pickers. */
export function geminiVoiceLabel(voice: GeminiVoice): string {
  return `${voice.gender === "female" ? "weiblich" : "männlich"} · ${voice.traitDe}`;
}

/* ── Hints: who a figure is ────────────────────────────────────────────── */

export interface FigureHint {
  gender?: VoiceGender;
  age?: VoiceAge;
  ageYears?: number;
  creature?: boolean;
}

const FEMALE_NAME = /\b(oma|mama|mutter|frau|tante|königin|prinzessin|mädchen|hexe|fee|lehrerin|nachbarin)\b/i;
const MALE_NAME = /\b(opa|papa|vater|herr|onkel|könig|prinz|mann|junge|zauberer|kater)\b/i;
/** Whole words only: "der Mann mit dem Fischhut" is no fish. */
const CREATURE_DE = /\b((gold)?fisch|kater|katze|hund|drache|geist|wesen|tier|kobold|troll|vogel|maus|ungeheuer)\b|monster/i;
const CREATURE_EN = /\b(goldfish|fish|cat|tomcat|kitten|dog|puppy|dragon|ghost|monster|creature|animal|bird|mouse|troll|goblin|bunny|truck|robot)\b/i;
const FEMALE_EN = /\b(girl|woman|grandmother|grandma|mother|mom|lady|queen|princess|witch)\b/i;
const MALE_EN = /\b(boy|man|grandfather|grandpa|father|dad|gentleman|king|prince|tomcat|wizard)\b/i;

/** The head of an English visual profile ("chubby orange goldfish", not the fish-shaped hat after "with"). */
function visualHead(visual: string): string {
  return visual.split(/\s(?:with|wearing|holding|in a|and a)\s|[,;.]/i)[0] ?? "";
}

/**
 * Gender, age and kind of a figure from what is known about it: the explicit hint
 * wins, then the hand-picked ElevenLabs voice (its labels were chosen to fit), then
 * the English visual profile ("6-year-old boy", "woman around 70", "chubby orange
 * goldfish"), then German name words and the pronouns of the description.
 */
export function figureHint(input: {
  name: string;
  personality?: string;
  /** English visual profile of the series character. */
  visual?: string;
  ageYears?: number;
  gender?: VoiceGender;
  age?: VoiceAge;
  creature?: boolean;
  /** Labels of the figure's ElevenLabs voice (gender, age). */
  labels?: Record<string, string>;
}): FigureHint {
  const head = visualHead(input.visual ?? "");
  const labelGender = String(input.labels?.gender ?? "").toLowerCase();
  const pronounGender: VoiceGender | undefined = /\b(er|ihn|ihm|seine?)\b/i.test(input.personality ?? "")
    ? "male"
    : /\b(ihre?)\b/i.test(input.personality ?? "")
      ? "female"
      : undefined;
  const gender =
    input.gender ??
    (labelGender === "female" || labelGender === "male" ? labelGender : undefined) ??
    (FEMALE_EN.test(head) ? "female" : MALE_EN.test(head) ? "male" : undefined) ??
    (FEMALE_NAME.test(input.name) ? "female" : MALE_NAME.test(input.name) ? "male" : undefined) ??
    pronounGender;

  const visualYears = Number(head.match(/(\d{1,2})-year-old/)?.[1] ?? input.visual?.match(/around (\d{2})\b/)?.[1] ?? 0);
  const ageYears = input.ageYears || visualYears || undefined;
  const age: VoiceAge | undefined =
    input.age ??
    (ageYears ? (ageYears <= 13 ? "child" : ageYears >= 60 ? "old" : "adult") : undefined) ??
    (/\b(grandmother|grandfather|grandma|grandpa|old (man|woman|lady))\b/i.test(head) || /\b(oma|opa)\b/i.test(input.name) || /old|senior/.test(String(input.labels?.age ?? "").toLowerCase())
      ? "old"
      : /\b(girl|boy|child|kid)\b/i.test(head)
        ? "child"
        : /\b(woman|man|mother|father|grown-up)\b/i.test(head)
          ? "adult"
          : undefined);

  const creature = input.creature ?? (CREATURE_EN.test(head) || (!ageYears && CREATURE_DE.test(`${input.name} ${input.personality ?? ""}`)));
  return { ...(gender ? { gender } : {}), ...(age ? { age } : {}), ...(ageYears ? { ageYears } : {}), creature };
}

/* ── Picking a voice ───────────────────────────────────────────────────── */

/** Persona words that fit a voice's character. */
const TRAIT_FIT: Record<string, RegExp> = {
  gravelly: /grump|gruff|gravel|rasp|rough|growl|grumbl|deep|grouch|cranky/,
  excitable: /excit|fast|loud|hyper|eager|wild|squeak|giggl|tiny|jumpy/,
  upbeat: /cheer|happy|upbeat|bright|playful|laugh|bubbly/,
  lively: /lively|playful|energetic|cheer|bouncy/,
  youthful: /young|child|kid|tiny|squeak|giggl/,
  bright: /bright|curious|cheer|squeak|tiny|clever/,
  firm: /strict|firm|stern|curt|bossy|determined|suspicious|stubborn/,
  clear: /precise|clear|calm|careful|thoughtful|grown-up/,
  even: /calm|steady|even|careful|patient/,
  breathy: /quiet|mysterious|whisper|breathy|secret|out of breath|sad|slow/,
  soft: /soft|shy|gentle|quiet|sad|timid/,
  gentle: /gentle|kind|tender|careful|warm|loving/,
  smooth: /smooth|sly|knowing|charming|velvet/,
  warm: /warm|loving|cosy|cozy|kind|motherly|hearty|cheerful/,
  friendly: /friendly|warm|kind|cosy|cozy|relaxed/,
  "easy-going": /relaxed|cosy|cozy|easy|laid-back/,
  casual: /relaxed|casual|cool|laid-back/,
  mature: /old|wise|mature|strict|grandm|elder|stern/,
  knowledgeable: /wise|knowing|clever|mysterious|riddl/,
  informative: /explain|matter-of-fact|informative|serious|dry/,
  forward: /bossy|loud|direct|confident|brash|hearty/,
  breezy: /breezy|light|airy|dreamy/,
};

function hash(text: string): number {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

export function scoreGeminiVoice(voice: GeminiVoice, hint: FigureHint & { persona?: string }, used: Set<string>): number {
  let score = 0;
  if (hint.gender) score += voice.gender === hint.gender ? 10 : hint.creature ? -4 : -12;
  if (hint.age) score += voice.ages.includes(hint.age) ? 4 : hint.age === "child" ? -6 : -3;
  const persona = (hint.persona ?? "").toLowerCase();
  if (persona && TRAIT_FIT[voice.trait]?.test(persona)) score += 3;
  if (hint.creature && /gravelly|excitable|breathy|bright/.test(voice.trait)) score += 2;
  if (used.has(voice.name)) score -= 30;
  return score;
}

/** The best free voice for a figure; deterministic for the same seed. */
export function pickGeminiVoice(hint: FigureHint & { persona?: string; seed: string }, used: Set<string>): GeminiVoice {
  return [...GEMINI_VOICES].sort(
    (a, b) => scoreGeminiVoice(b, hint, used) - scoreGeminiVoice(a, hint, used) || hash(hint.seed + a.name) - hash(hint.seed + b.name),
  )[0];
}

/* ── The series cast on Gemini ─────────────────────────────────────────── */

/** A row of library_voice_engine_cast. */
export interface EngineVoiceOverride {
  speakerId: string;
  family: Exclude<VoiceFamily, "elevenlabs">;
  voiceId: string;
  source: "admin" | "auto";
}

export interface GeminiCastEntry {
  speakerId: string;
  name: string;
  voice?: string;
  persona: string;
  silent: boolean;
  source: "admin" | "series" | "auto";
  hint: FigureHint;
}

/**
 * The Gemini voice of the narrator and every figure of the series. Persona and
 * silence come from the series cast (they belong to the figure, not to an engine);
 * a figure the admin gave a Gemini voice speaks even if the bible keeps it silent.
 * `autoPicks` are the voices chosen right now; the caller stores them so they stay.
 */
export function resolveGeminiCast(input: {
  /** Narrator and figures in casting order (resolveSeriesCast). */
  figures: Array<{ speakerId: string; name: string; persona: string; silent: boolean; hint: FigureHint }>;
  overrides: Array<Pick<EngineVoiceOverride, "speakerId" | "voiceId" | "source">>;
  narratorId: string;
}): { cast: GeminiCastEntry[]; autoPicks: EngineVoiceOverride[] } {
  const overrides = new Map(input.overrides.map((row) => [row.speakerId, row]));
  const used = new Set<string>();
  const autoPicks: EngineVoiceOverride[] = [];
  const cast: GeminiCastEntry[] = [];
  // Configured voices claim their place before automatic picks fill the gaps; the narrator always first.
  const ordered = [...input.figures].sort((a, b) => {
    if (a.speakerId === input.narratorId) return -1;
    if (b.speakerId === input.narratorId) return 1;
    return Number(Boolean(geminiVoice(overrides.get(b.speakerId)?.voiceId))) - Number(Boolean(geminiVoice(overrides.get(a.speakerId)?.voiceId)));
  });
  for (const figure of ordered) {
    const row = overrides.get(figure.speakerId);
    const stored = geminiVoice(row?.voiceId);
    const admin = row?.source === "admin" ? stored : undefined;
    if (figure.silent && !admin) {
      cast.push({ speakerId: figure.speakerId, name: figure.name, persona: figure.persona, silent: true, source: "series", hint: figure.hint });
      continue;
    }
    let voice = admin ?? (stored && !used.has(stored.name) ? stored : undefined);
    let source: GeminiCastEntry["source"] = admin ? "admin" : "auto";
    if (!voice && figure.speakerId === input.narratorId && !used.has(GEMINI_NARRATOR)) {
      voice = geminiVoice(GEMINI_NARRATOR);
      source = "series";
    }
    if (!voice) {
      voice = pickGeminiVoice({ ...figure.hint, persona: figure.persona, seed: figure.speakerId }, used);
      autoPicks.push({ speakerId: figure.speakerId, family: "gemini", voiceId: voice.name, source: "auto" });
    }
    used.add(voice!.name);
    cast.push({ speakerId: figure.speakerId, name: figure.name, voice: voice!.name, persona: figure.persona, silent: false, source, hint: figure.hint });
  }
  const order = new Map(input.figures.map((figure, index) => [figure.speakerId, index]));
  cast.sort((a, b) => (order.get(a.speakerId) ?? 0) - (order.get(b.speakerId) ?? 0));
  return { cast, autoPicks };
}

/* ── Directing a line ──────────────────────────────────────────────────── */

export interface SpeakerDirection {
  name: string;
  persona: string;
  narrator: boolean;
  hint: FigureHint;
}

const NUMBER_WORDS_EN = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen"];

/** "a seven-year-old boy", "an old woman", "a talking creature with a male voice". */
export function describeFigure(hint: FigureHint): string {
  if (hint.creature) return `a talking creature${hint.gender ? ` with a ${hint.gender} voice` : ""}`;
  const noun = hint.age === "child" ? (hint.gender === "female" ? "girl" : hint.gender === "male" ? "boy" : "child") : hint.gender === "female" ? "woman" : hint.gender === "male" ? "man" : "person";
  if (hint.age === "child" && hint.ageYears && hint.ageYears < NUMBER_WORDS_EN.length) return `a ${NUMBER_WORDS_EN[hint.ageYears]}-year-old ${noun}`;
  if (hint.age === "old") return `an old ${noun}`;
  if (hint.age === "child") return `a young ${noun}`;
  return `a${/^[aeiou]/.test(noun) ? "n" : ""} ${noun}`;
}

export interface GeminiLine {
  /** What Gemini reads: the line without its tone tag, reaction tags kept (Gemini performs them). */
  text: string;
  /** Delivery for this line: who speaks, the figure's base tone, the mood of the moment. */
  instructions: string;
}

export function geminiLine(line: Pick<ScriptLine, "text">, speaker: SpeakerDirection): GeminiLine {
  const { tag, body } = splitLeadingTag(line.text);
  const persona = speaker.persona.trim();
  const who = speaker.narrator
    ? `You are the narrator of a German children's radio play: a ${persona || "warm, playful storyteller"} who tells the story with life, humour and clear diction.`
    : `You are ${speaker.name}, ${describeFigure(speaker.hint)}, in a German children's radio play.${persona ? ` Voice: ${persona}.` : ""}`;
  const mood = tag && tag.toLowerCase() !== persona.toLowerCase() ? ` Tone of this line: ${tag}.` : "";
  return { text: body, instructions: `${who}${mood} Speak natural standard German.` };
}
