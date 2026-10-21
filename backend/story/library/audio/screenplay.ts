/**
 * Audio drama screenplay (Drehbuch) for a library episode — Encore-free.
 *
 * A finished episode is read aloud like a big children's radio play: the
 * narrator (Captain Comedy) carries the prose, every figure speaks its own
 * lines with its own voice, Eleven v4 audio tags direct the acting, and the
 * script names the sounds (on the word they land on), the place of every scene
 * and where the series' music plays. Two LLM stages:
 *   1. casting — speaking guests and extras of this episode get a voice,
 *   2. adaptation — one call per chapter (in parallel), checked for fidelity
 *      (every quoted line of the book must still be there) and retried once.
 * Opening (title over the theme) and closing (teaser over the theme) are fixed.
 */

import { parseJsonObject, type CostLedger, type StorybookLlm } from "../../storybook/llm";
import type { AudioScript, EpisodeContent, ScriptLine, ScriptPart, ScriptScene, ScriptSound, ScriptSpeaker, SeriesBible, SeriesInfo, ScoreMood } from "../types";
import { SCENE_MOODS } from "../types";
import type { AccountVoice } from "./casting";

export const NARRATOR_KEY = "ERZAEHLER";

/** Speaker keys are plain upper-case ASCII: the dialogue parser and the voice map match them case-insensitively. */
export function speakerKey(value: string): string {
  return value
    .toUpperCase()
    .replace(/Ä/g, "AE").replace(/Ö/g, "OE").replace(/Ü/g, "UE").replace(/ß/g, "SS")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "FIGUR";
}

/** A member of the cast as the adaptation sees it. */
export interface CastMember {
  key: string;
  name: string;
  characterId?: string;
  /** German: who the figure is and how it talks. */
  description: string;
  persona: string;
  silent: boolean;
  voiceId?: string;
  voiceName?: string;
  source: ScriptSpeaker["source"];
}

/* ── Tags and text hygiene ──────────────────────────────────────────────── */

/** Reactions and pauses Eleven v4 performs inside a sentence. Everything else in brackets is removed. */
export const INLINE_TAGS = new Set([
  "pause", "long pause", "short pause", "laughs", "laughing", "giggles", "chuckles", "sighs", "gasps", "gulps",
  "sniffs", "sneezes", "whispers", "clears throat", "snorts", "yawns", "inhales deeply", "exhales", "groans", "hums",
]);

const LEADING_TAG = /^\[([^\]\n]{1,60})\]\s*/;
const TAG_WORDS = /^[a-z][a-z ,'-]{0,58}$/;

/** Text Eleven v4 speaks: no quote marks, no stray stage directions, one line, the leading tag kept. */
export function cleanLineText(raw: string, persona: string): string {
  let text = String(raw || "").replace(/\s+/g, " ").trim();
  let lead = "";
  const leading = text.match(LEADING_TAG);
  if (leading) {
    const tag = leading[1].trim().toLowerCase();
    text = text.slice(leading[0].length);
    if (TAG_WORDS.test(tag) && tag.split(/[ ,]+/).filter(Boolean).length <= 5) lead = tag;
  }
  text = text
    .replace(/\[([^\]\n]{1,60})\]/g, (_full, inner: string) => {
      const tag = inner.trim().toLowerCase();
      return INLINE_TAGS.has(tag) ? ` [${tag}] ` : " ";
    })
    .replace(/\(([^)]{1,80})\)/g, " ")
    .replace(/[„“”"«»]/g, "")
    .replace(/[‚‘’]/g, "'")
    .replace(/\s+([,.!?;:…])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  if (!spokenWords(text).length) return "";
  return `[${lead || persona || "warm"}] ${text}`;
}

/** The words a line actually says (tags removed). */
export function spokenWords(text: string): string[] {
  return String(text || "")
    .replace(/\[[^\]]*\]/g, " ")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

const MAX_LINE_CHARS = 520;

/** Very long lines are split at sentence ends (same speaker, same tag) — long inputs drift in v4. */
export function splitLongLine(line: ScriptLine): ScriptLine[] {
  if (line.text.length <= MAX_LINE_CHARS) return [line];
  const tag = line.text.match(LEADING_TAG)?.[0] ?? "";
  const body = line.text.slice(tag.length);
  const sentences = body.match(/[^.!?…]+[.!?…]+["')\]]*\s*|[^.!?…]+$/g) ?? [body];
  const out: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (current && (current + sentence).length > MAX_LINE_CHARS - tag.length) {
      out.push(current.trim());
      current = "";
    }
    current += sentence;
  }
  if (current.trim()) out.push(current.trim());
  const sounds = line.sounds ?? [];
  return out.map((part, index) => ({
    speaker: line.speaker,
    text: `${tag}${part}`,
    ...(() => {
      const mine = sounds.filter((sound) => (sound.at ? containsWord(`${tag}${part}`, sound.at) : index === 0));
      return mine.length ? { sounds: mine } : {};
    })(),
  }));
}

const normalizeWord = (word: string): string => word.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

export function containsWord(text: string, word: string): boolean {
  const target = normalizeWord(word);
  if (!target) return false;
  return spokenWords(text).some((candidate) => normalizeWord(candidate) === target || normalizeWord(candidate).startsWith(target));
}

/* ── Fidelity ───────────────────────────────────────────────────────────── */

/** Every quoted line of the prose („…“), in reading order. */
export function quotedLines(prose: string): string[] {
  return [...String(prose || "").matchAll(/„([^“]+)“/g)].map((match) => match[1].trim()).filter((quote) => spokenWords(quote).length > 0);
}

export interface FidelityReport {
  wordRatio: number;
  quoteCoverage: number;
  missingQuotes: string[];
  passed: boolean;
}

/**
 * The adaptation must keep the book: nearly every quote still spoken (allowing tiny
 * radio-play edits), and the narration only tightened, not rewritten into a summary.
 */
export function checkFidelity(prose: string, lines: ScriptLine[]): FidelityReport {
  const proseWords = spokenWords(prose.replace(/[„“]/g, " ")).length || 1;
  const scriptWords = lines.reduce((sum, line) => sum + spokenWords(line.text).length, 0);
  const haystack = ` ${lines.map((line) => spokenWords(line.text).map(normalizeWord).join(" ")).join(" | ")} `;
  const quotes = quotedLines(prose);
  const missing = quotes.filter((quote) => {
    const words = spokenWords(quote).map(normalizeWord).filter(Boolean);
    // A quote counts when its longest run of words survives: the first four, or the whole line if shorter.
    const probe = words.slice(0, Math.min(4, words.length)).join(" ");
    const tail = words.slice(-Math.min(4, words.length)).join(" ");
    return !(haystack.includes(` ${probe} `) || haystack.includes(` ${probe}`) || haystack.includes(` ${tail} `) || haystack.includes(`${tail} `));
  });
  const quoteCoverage = quotes.length ? (quotes.length - missing.length) / quotes.length : 1;
  const wordRatio = scriptWords / proseWords;
  return { wordRatio, quoteCoverage, missingQuotes: missing, passed: quoteCoverage >= 0.85 && wordRatio >= 0.7 && wordRatio <= 1.45 };
}

/* ── Fixed parts ────────────────────────────────────────────────────────── */

const NUMBER_WORDS = ["null", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf", "dreizehn", "vierzehn", "fünfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn", "zwanzig"];
const spokenNumber = (value: number): string => NUMBER_WORDS[value] ?? String(value);

export function openingPart(series: Pick<SeriesInfo, "title">, season: number, episode: number, title: string): ScriptPart {
  const label = season > 1 ? `Staffel ${spokenNumber(season)}, Folge ${spokenNumber(episode)}` : `Folge ${spokenNumber(episode)}`;
  return {
    kind: "opening",
    title: "Titel",
    lines: [{ speaker: NARRATOR_KEY, text: `[warm, playful] ${series.title}. [pause] ${label}: ${title.replace(/[„“"]/g, "")}.` }],
    scenes: [],
  };
}

export function closingPart(teaser: string): ScriptPart | null {
  const text = String(teaser || "").replace(/[„“"]/g, "").trim();
  if (!text) return null;
  return { kind: "closing", title: "Vorschau", lines: [{ speaker: NARRATOR_KEY, text: `[warm, mysterious] ${text}` }], scenes: [] };
}

/* ── Cast table for the prompts ─────────────────────────────────────────── */

export function castTable(cast: CastMember[]): string {
  return cast
    .map((member) => {
      if (member.key === NARRATOR_KEY) return `${member.key} — Erzähler. Grundton: ${member.persona}.`;
      if (member.silent) return `${member.key} — ${member.name}: STUMM, spricht nie. Nur Geräusche (${member.persona}). ${member.description}`;
      return `${member.key} — ${member.name}. ${member.description} Grundton-Tag: ${member.persona}.`;
    })
    .join("\n");
}

function seriesDigest(series: SeriesInfo, bible: SeriesBible): string {
  return [
    `REIHE: ${series.title} — ${series.logline}`,
    `Ton: ${bible.world.tone}`,
    `Ort: ${bible.world.setting}`,
    bible.runningGags.length ? `Running Gags: ${bible.runningGags.join(" · ")}` : "",
    bible.catchphrases.length ? `Sprüche: ${bible.catchphrases.join(" · ")}` : "",
  ].filter(Boolean).join("\n");
}

/* ── Stage 1: casting the episode's own speakers ────────────────────────── */

export interface EpisodeSpeakerDraft {
  key: string;
  name: string;
  guestId?: string;
  speaks: boolean;
  persona: string;
  voiceId?: string;
  gender?: "female" | "male";
  age?: "child" | "adult" | "old";
}

function voiceCatalog(voices: AccountVoice[]): string {
  return voices
    .map((voice) => {
      const labels = voice.labels ?? {};
      const meta = [labels.gender, labels.age, labels.use_case, labels.language, labels.descriptive].filter(Boolean).join(", ");
      return `${voice.voiceId} | ${voice.name.trim()} | ${meta} | ${(voice.description || "").replace(/\s+/g, " ").slice(0, 140)}`;
    })
    .join("\n");
}

export async function castEpisodeSpeakers(input: {
  series: SeriesInfo;
  bible: SeriesBible;
  content: EpisodeContent;
  seriesCast: CastMember[];
  freeVoices: AccountVoice[];
  llm: StorybookLlm;
  ledger: CostLedger;
  model: string;
}): Promise<EpisodeSpeakerDraft[]> {
  const { content } = input;
  const system = [
    "Du bist Casting-Direktorin für eine deutsche Kinder-Hörspielreihe. Du besetzt nur Figuren, die NICHT zur festen Besetzung gehören.",
    "",
    seriesDigest(input.series, input.bible),
    "",
    "FESTE BESETZUNG (nicht neu besetzen, nicht aufführen):",
    castTable(input.seriesCast),
  ].join("\n");
  const user = [
    `GÄSTE DIESER FOLGE: ${content.guests.map((guest) => `${guest.id} = ${guest.name}${guest.role ? ` (${guest.role})` : ""}`).join("; ") || "keine"}`,
    "",
    `FOLGE: ${content.title}`,
    content.chapters.map((chapter, index) => `KAPITEL ${index + 1}: ${chapter.title}\n${chapter.text}`).join("\n\n"),
    "",
    "FREIE STIMMEN (voiceId | Name | Merkmale | Beschreibung):",
    voiceCatalog(input.freeVoices),
    "",
    "Aufgabe: Liste ALLE Figuren, die in dieser Folge vorkommen, aber nicht zur festen Besetzung gehören: jeden Gast und jede Nebenfigur mit wörtlicher Rede (z. B. ein Verkäufer).",
    "- speaks: false für Figuren ohne wörtliche Rede oder die nur Laute machen (bellen, brüllen, hupen); sie bekommen keine Stimme.",
    "- Für sprechende Figuren: wähle die Stimme aus der Liste, die am besten zu Alter, Geschlecht und Wesen passt. Kinder- und Monsterfiguren bevorzugt mit deutschen Charakterstimmen (characters_animation), Erwachsene mit deutschen Erzähl- oder Gesprächsstimmen. Jede Stimme nur einmal.",
    "- persona: 1–4 englische Wörter, wie die Figur klingt (wird Audio-Tag), z. B. \"sniffly, shy, nasal\".",
    "- key: Kurzname in GROSSBUCHSTABEN ohne Umlaute, Bindestrich statt Leerzeichen (z. B. SOCKEN-SCHNUEFFLER).",
    "",
    'Antworte nur als JSON: {"speakers":[{"key":"…","name":"…","guestId":"<id oder weglassen>","speaks":true,"persona":"…","voiceId":"…","gender":"female|male","age":"child|adult|old"}]}',
  ].join("\n");
  const result = await input.llm({ stage: "library-audio-cast", role: "support", model: input.model, system, user, json: true, maxTokens: 4000, effort: "low", timeoutMs: 120_000 });
  input.ledger.recordCall("library-audio-cast", result, "support");
  const parsed = parseJsonObject<{ speakers?: unknown[] }>(result.text);
  const taken = new Set(input.seriesCast.map((member) => member.key));
  const drafts: EpisodeSpeakerDraft[] = [];
  for (const raw of parsed?.speakers ?? []) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as Record<string, unknown>;
    const name = String(entry.name || "").trim();
    if (!name) continue;
    const key = speakerKey(String(entry.key || name));
    if (taken.has(key)) continue;
    taken.add(key);
    const guestId = content.guests.find((guest) => guest.id === entry.guestId)?.id;
    drafts.push({
      key,
      name: name.slice(0, 60),
      ...(guestId ? { guestId } : {}),
      speaks: entry.speaks !== false,
      persona: String(entry.persona || "").trim().toLowerCase().replace(/[^a-z ,'-]/g, "").slice(0, 50) || "lively",
      ...(typeof entry.voiceId === "string" && entry.voiceId ? { voiceId: entry.voiceId } : {}),
      ...(entry.gender === "female" || entry.gender === "male" ? { gender: entry.gender } : {}),
      ...(entry.age === "child" || entry.age === "adult" || entry.age === "old" ? { age: entry.age } : {}),
    });
  }
  // Every guest is part of the cast, even when the casting forgot it (silent by default).
  for (const guest of content.guests) {
    if (drafts.some((draft) => draft.guestId === guest.id)) continue;
    const key = speakerKey(guest.id);
    if (taken.has(key)) continue;
    taken.add(key);
    drafts.push({ key, name: guest.name, guestId: guest.id, speaks: false, persona: "creature sounds" });
  }
  return drafts;
}

/* ── Stage 2: adapting one chapter ──────────────────────────────────────── */

const ADAPTATION_RULES = `Du bist Hörspiel-Dramaturgin und Regisseurin einer hochwertigen deutschen Kinder-Hörspielreihe (Kino im Kopf, Niveau der großen Kinderhörspiele). Du machst aus einem fertigen Kapitel ein Hörspiel-Drehbuch: ein Erzähler und Figuren mit eigenen Stimmen, Regie-Tags für ElevenLabs Eleven v4, Geräusche und Orts-Atmosphären.

TREUE (wichtigste Regel)
- Handlung, jede Pointe, jeder Gag und JEDE wörtliche Rede des Kapitels bleiben erhalten, in derselben Reihenfolge. Nichts dazuerfinden, was die Handlung ändert.
- Wörtliche Rede spricht die Figur selbst, wortgetreu. Kleine Hörspiel-Ergänzungen sind erlaubt: ein „Hä?“, ein Lachen, ein Name als Anrede, damit Zuhörer wissen, wer spricht.
- Redebegleitsätze („sagte Ella“, „flüsterte Mats“) fallen weg, wenn Stimme und Tag es zeigen. Es bleibt nur, was Handlung trägt („Ella schob ihre Brille hoch.“).
- Erzähltext bleibt beim Erzähler, in der Sprache der Vorlage. Kürze nur, was ein Zuhörer nicht braucht (rein Optisches ohne Erzählwert, Dopplungen). Sinneseindrücke, Witz und Stimme der Reihe bleiben.
- Steht etwas in der Vorlage nur indirekt („Papa sagte jedes Mal, das gehe nicht“), darf die Figur es direkt sagen, wenn es lebendiger wird.

ZEILEN
- Eine Zeile = ein Sprecher. Erzähler-Zeilen höchstens drei Sätze; lange Absätze in mehrere Erzähler-Zeilen teilen. Das gibt Luft für Geräusche.
- Sprecher nur aus der Besetzungsliste, Kennung exakt. STUMME Figuren sprechen nie, ihre Laute sind Geräusche.
- Umlaute und ß normal schreiben, Zahlen ausschreiben, keine Anführungszeichen, keine Regieanweisungen in runden Klammern.

AUDIO-TAGS (Eleven v4, Englisch, werden nicht gesprochen)
- Jede Zeile beginnt mit GENAU einem Tag in eckigen Klammern: Grundton der Figur plus Gefühl dieses Moments, 1 bis 4 englische Wörter, z. B. [grumpy, offended], [excited, fast], [whispers], [strict], [nervous], [giggling], [proud].
- Der Erzähler ist ein lebendiger, verschmitzter Geschichtenerzähler: meist [warm, playful]; bei Spannung [hushed, suspenseful]; bei Pointen [amused] oder [deadpan]; bei Gefühl [gentle]. Er führt, er spielt nicht über.
- Im Satz erlaubt, sparsam und nur wo es wirklich passiert: [pause], [long pause] (höchstens zwei pro Kapitel), [laughs], [giggles], [chuckles], [sighs], [gasps], [gulps], [sniffs], [sneezes], [whispers], [clears throat], [snorts], [yawns].
- Keine Geräusch-Tags im Text wie [door creaks]. Geräusche gehören in "fx".

GERÄUSCHE ("fx" pro Zeile, 0 bis 3)
- Jedes hörbare Ereignis: Tür, Schritte, Klingel, Platschen, Bellen, Glöckchen, Rumpeln, Zauber, Hupe, Niesen eines Monsters.
- "sound": konkreter ENGLISCHER Prompt für einen Soundeffekt-Generator mit Quelle, Material, Raum und Stärke, z. B. "heavy wooden thud in a stairwell", "small brass bell jingling on a cat collar". Keine Stimmen, keine Musik, kindgerecht, nichts wirklich Erschreckendes.
- "at": das Wort aus DIESER Zeile, auf das der Klang fällt, genau so geschrieben. Lautmalereien der Vorlage (RUMMS, WUFF) im Text behalten und als "at" nutzen.
- "sec": Länge in Sekunden, 0.5 bis 6.
- Stumme Figuren und Tiere werden so hörbar: Glöckchen, Fauchen, Schnurren, Hupen, Bellen.

SZENEN ("scene" an der ersten Zeile einer Szene)
- Die erste Zeile des Kapitels trägt immer ein "scene". Ein neues "scene" steht genau an der Zeile, mit der ein neuer Ort oder eine neue Zeit beginnt, oder an der eine Musik einsetzen soll (dann derselbe Ort noch einmal).
- "place": deutsch, kurz, z. B. "Flohmarkt am Rathausplatz, Nachmittag".
- "ambience": ENGLISCHER Prompt für eine leise, durchgehende Orts-Atmosphäre mit 1 bis 3 ruhigen Quellen, z. B. "quiet apartment living room, faint street traffic through a window, soft aquarium bubbling". Keine verständlichen Stimmen, keine Musik, keine auffälligen Einzelgeräusche. Leer, wenn der Ort keinen eigenen Klang hat.
- "level": "low", "normal" oder "high".
- "music": Musikbett der Reihe ab dieser Zeile oder null. Stimmungen: mischief (Unfug, Schleichen), adventure (Jagd, Eile), mystery (Rätsel, Geheimnis, etwas Unerklärliches beginnt), heart (Gefühl, Versöhnung), spooky (Gruseln mit Augenzwinkern), finale (gutes Ende). Die Musik setzt genau an der Zeile ein, an der der Moment beginnt. Sparsam: höchstens zwei Musikeinsätze pro Kapitel; normale Gespräche ohne Musik.

AUSGABE: nur JSON
{"lines":[{"scene":{"place":"…","ambience":"…","level":"normal","music":null},"s":"ERZAEHLER","t":"[warm, playful] …","fx":[{"sound":"…","at":"…","sec":1.5}]},{"s":"MATS","t":"[excited, fast] …"}]}`;

export interface ChapterAdaptation {
  part: ScriptPart;
  fidelity: FidelityReport;
  notes: string[];
}

function parseChapterJson(raw: string, cast: CastMember[], chapterIndex: number, title: string): { part: ScriptPart; notes: string[] } {
  const parsed = parseJsonObject<{ lines?: unknown[]; scenes?: unknown[] }>(raw);
  if (!parsed || !Array.isArray(parsed.lines)) throw new Error(`Kapitel ${chapterIndex + 1}: Drehbuch ohne Zeilen.`);
  const notes: string[] = [];
  const byKey = new Map(cast.map((member) => [member.key, member]));
  const byName = new Map(cast.map((member) => [member.name.toLowerCase(), member]));
  const narrator = byKey.get(NARRATOR_KEY)!;

  // A scene starts at the line that carries it; on a dropped line it moves to the next kept one.
  const scenes: ScriptScene[] = [];
  let pendingScene: Omit<ScriptScene, "startLine"> | null = null;
  const lines: ScriptLine[] = [];
  parsed.lines.forEach((rawLine) => {
    if (!rawLine || typeof rawLine !== "object") return;
    const entry = rawLine as Record<string, unknown>;
    if (entry.scene && typeof entry.scene === "object") pendingScene = parseScene(entry.scene as Record<string, unknown>);
    const said = String(entry.s ?? entry.speaker ?? "").trim();
    let member = byKey.get(speakerKey(said)) ?? byName.get(said.toLowerCase());
    if (!member) {
      notes.push(`Kapitel ${chapterIndex + 1}: unbekannter Sprecher „${said}“ → Erzähler.`);
      member = narrator;
    }
    const sounds = parseSounds(entry.fx);
    if (member.silent) {
      // A silent figure "spoke": its sound stays, the words go.
      const previous = lines[lines.length - 1];
      const sound = sounds[0] ?? { sound: member.persona, seconds: 1.5 };
      if (previous) previous.sounds = [...(previous.sounds ?? []), { sound: sound.sound, seconds: sound.seconds }];
      notes.push(`Kapitel ${chapterIndex + 1}: ${member.name} ist stumm — Zeile wurde zum Geräusch.`);
      return;
    }
    const text = cleanLineText(String(entry.t ?? entry.text ?? ""), member.persona);
    if (!text) return;
    const kept = sounds
      .map((sound) => (sound.at && !containsWord(text, sound.at) ? { sound: sound.sound, seconds: sound.seconds } : sound))
      .slice(0, 3);
    if (pendingScene) {
      scenes.push({ ...(pendingScene as Omit<ScriptScene, "startLine">), startLine: lines.length });
      pendingScene = null;
    }
    for (const piece of splitLongLine({ speaker: member.key, text, ...(kept.length ? { sounds: kept } : {}) })) lines.push(piece);
  });
  if (lines.length === 0) throw new Error(`Kapitel ${chapterIndex + 1}: Drehbuch ohne sprechbare Zeilen.`);

  // Older shape: scenes listed apart with a 1-based line number.
  if (!scenes.length && Array.isArray(parsed.scenes)) {
    for (const rawScene of parsed.scenes) {
      if (!rawScene || typeof rawScene !== "object") continue;
      const entry = rawScene as Record<string, unknown>;
      const line = Math.round(Number(entry.line));
      if (!Number.isFinite(line)) continue;
      scenes.push({ ...parseScene(entry), startLine: Math.min(lines.length - 1, Math.max(0, line - 1)) });
    }
  }
  scenes.sort((a, b) => a.startLine - b.startLine);
  for (let index = scenes.length - 1; index > 0; index -= 1) {
    if (scenes[index].startLine === scenes[index - 1].startLine) scenes.splice(index - 1, 1);
  }
  if (!scenes.length || scenes[0].startLine !== 0) scenes.unshift({ startLine: 0, place: title, ambience: "", ambienceLevel: "normal", music: null });
  // Music is the exception: at most two beds per chapter, the first ones the director asked for.
  let beds = 0;
  for (const scene of scenes) {
    if (scene.music && ++beds > 2) scene.music = null;
  }
  return { part: { kind: "chapter", chapterIndex, title, lines, scenes }, notes };
}

function parseScene(entry: Record<string, unknown>): Omit<ScriptScene, "startLine"> {
  return {
    place: String(entry.place || "").trim().slice(0, 120),
    ambience: String(entry.ambience || "").trim().slice(0, 220),
    ambienceLevel: entry.level === "low" || entry.level === "high" ? entry.level : "normal",
    music: SCENE_MOODS.includes(entry.music as ScoreMood) ? (entry.music as ScoreMood) : null,
  };
}

function parseSounds(value: unknown): ScriptSound[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const entry = raw as Record<string, unknown>;
      const sound = String(entry.sound || "").replace(/\s+/g, " ").trim().slice(0, 200);
      if (!sound) return null;
      const seconds = Number(entry.sec ?? entry.seconds);
      const at = String(entry.at || "").trim();
      return { sound, ...(at ? { at: at.slice(0, 40) } : {}), seconds: Number.isFinite(seconds) ? Math.max(0.5, Math.min(6, seconds)) : 1.5 } as ScriptSound;
    })
    .filter((sound): sound is ScriptSound => sound !== null);
}

export async function adaptChapter(input: {
  series: SeriesInfo;
  bible: SeriesBible;
  content: EpisodeContent;
  chapterIndex: number;
  cast: CastMember[];
  llm: StorybookLlm;
  ledger: CostLedger;
  model: string;
}): Promise<ChapterAdaptation> {
  const { content, chapterIndex } = input;
  const chapter = content.chapters[chapterIndex];
  const previous = chapterIndex > 0 ? content.chapters[chapterIndex - 1].text.split(/\n\n+/).slice(-2).join("\n\n") : "";
  const system = [ADAPTATION_RULES, "", seriesDigest(input.series, input.bible), "", "BESETZUNG (Kennung — Figur):", castTable(input.cast)].join("\n");
  const baseUser = [
    `FOLGE: ${content.title} — ${content.summary}`,
    `Das ist Kapitel ${chapterIndex + 1} von ${content.chapters.length}: „${chapter.title}“. Titel und Teaser spricht der Erzähler an anderer Stelle, beginne direkt mit der Handlung.`,
    previous ? `\nSO ENDETE DAS VORIGE KAPITEL (nur zur Orientierung, nicht bearbeiten):\n${previous}` : "",
    `\nKAPITELTEXT:\n${chapter.text}`,
  ].join("\n");

  let best: ChapterAdaptation | null = null;
  let feedback = "";
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const user = feedback ? `${baseUser}\n\nDEIN LETZTER ENTWURF HAT DIE VORLAGE NICHT GETREU GENUG ÜBERNOMMEN:\n${feedback}\nSchreib das ganze Kapitel noch einmal, vollständig.` : baseUser;
    const stage = `library-audio-adapt-${chapterIndex + 1}${attempt > 1 ? "-retry" : ""}`;
    const result = await input.llm({ stage, role: "writer", model: input.model, system, user, json: true, maxTokens: 16000, effort: "low", timeoutMs: 300_000 });
    input.ledger.recordCall(stage, result, "writer");
    let adaptation: ChapterAdaptation;
    try {
      const { part, notes } = parseChapterJson(result.text, input.cast, chapterIndex, chapter.title);
      adaptation = { part, notes, fidelity: checkFidelity(chapter.text, part.lines) };
    } catch (error) {
      if (attempt === 2 && best) break;
      if (attempt === 2) throw error;
      feedback = `- Die Antwort war kein gültiges Drehbuch-JSON (${(error as Error).message}).`;
      continue;
    }
    if (!best || score(adaptation.fidelity) > score(best.fidelity)) best = adaptation;
    if (adaptation.fidelity.passed) break;
    const f = adaptation.fidelity;
    feedback = [
      f.quoteCoverage < 0.85 ? `- Es fehlen wörtliche Reden der Vorlage, z. B.: ${f.missingQuotes.slice(0, 8).map((quote) => `„${quote}“`).join(" · ")}` : "",
      f.wordRatio < 0.7 ? `- Zu stark gekürzt (nur ${Math.round(f.wordRatio * 100)} % der Wörter). Erzähle das Kapitel vollständig nach, kürze nur Dopplungen.` : "",
      f.wordRatio > 1.45 ? `- Zu viel dazugeschrieben (${Math.round(f.wordRatio * 100)} % der Wörter). Bleib bei der Vorlage.` : "",
    ].filter(Boolean).join("\n");
  }
  const chosen = best!;
  if (!chosen.fidelity.passed) {
    chosen.notes.push(
      `Kapitel ${chapterIndex + 1}: Treue-Prüfung nicht ganz bestanden (Zitate ${Math.round(chosen.fidelity.quoteCoverage * 100)} %, Wörter ${Math.round(chosen.fidelity.wordRatio * 100)} %). Bitte im Drehbuch prüfen.`,
    );
  }
  return chosen;
}

const score = (report: FidelityReport): number => report.quoteCoverage * 2 + Math.min(1, report.wordRatio) - Math.max(0, report.wordRatio - 1.45);

/** Opening, the adapted chapters in order, closing. */
export function assembleScript(input: {
  series: SeriesInfo;
  season: number;
  episode: number;
  content: EpisodeContent;
  speakers: ScriptSpeaker[];
  chapters: ChapterAdaptation[];
  notes: string[];
}): AudioScript {
  const parts: ScriptPart[] = [openingPart(input.series, input.season, input.episode, input.content.title)];
  for (const chapter of [...input.chapters].sort((a, b) => (a.part.chapterIndex ?? 0) - (b.part.chapterIndex ?? 0))) parts.push(chapter.part);
  const closing = closingPart(input.content.teaser);
  if (closing) parts.push(closing);
  const used = new Set(parts.flatMap((part) => part.lines.map((line) => line.speaker)));
  return {
    version: 1,
    speakers: input.speakers.filter((speaker) => used.has(speaker.key) || speaker.key === NARRATOR_KEY),
    parts,
    notes: [...input.notes, ...input.chapters.flatMap((chapter) => chapter.notes)],
  };
}

/** The "SPEAKER: text" script ElevenLabs text-to-dialogue renders for one part. */
export function dialogueScript(part: ScriptPart): string {
  return part.lines.map((line) => `${line.speaker}: ${line.text}`).join("\n");
}

/** Characters billed by ElevenLabs for a script (tags count). */
export function billedCharacters(script: AudioScript): number {
  return script.parts.reduce((sum, part) => sum + part.lines.reduce((inner, line) => inner + line.text.length, 0), 0);
}
