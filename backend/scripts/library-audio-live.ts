/**
 * Live test of the Originals audio drama — no database, no bucket. Same chain as
 * the Studio button: cast → screenplay → voices (ElevenLabs v4 or Gemini 3.8) →
 * series score → studio mix. Uses the seeded episode of a series.
 *
 *   cd backend
 *   encore exec -- bun --env-file=../.env.local scripts/library-audio-live.ts --series bruno-der-flunkerfisch [options]
 *
 *   --engine elevenlabs|gemini-lite|gemini-flash   voice engine (default: the server default, Gemini 3.8 Flash Lite)
 *   --script-only          only cast + screenplay (no voice or sound credits)
 *   --from <dir>           record the screenplay saved in <dir>/script.json again (no LLM cost)
 *   --estimate             with --from: print what every engine would cost, record nothing
 *   --budget <usd>         stop before recording when the estimate (voices + new sounds) is higher
 *   --no-sounds            leave out spot effects and ambience (music stays): voices-only test
 *   --gemini-cast a=Voice,b=Voice   fix Gemini voices by speaker id (narrator, ella, …)
 *   --chapters N           only the first N chapters (cheaper test)
 *   --plan-sounds          cast the screenplay's sounds against the sound library (Luna, ≈ 0.1 ct), print the
 *                          choices, record nothing; sounds whose audio is already in the local cache join the library
 *   --no-library           record without the sound library (every sound by its own prompt)
 *   --out Logs/library/audio/<tag>
 *
 * Score and generated sounds are cached in Logs/library/audio/score-cache and
 * …/sound-cache (instead of the bucket): recording the same screenplay again
 * with another engine buys no sound twice. The sound library lives in
 * …/sound-library.json. Gemini runs also report the real OpenRouter spend (key
 * usage before/after).
 * Output: script.json, script.md (readable screenplay), drama.mp3, stats.json.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { soundCacheKey, type SoundCachePort } from "../doku/sound-cache";
import { composeMusic, synthesizeSoundEffect } from "../tts/elevenlabs-dialogue";
import { CostLedger, withServiceTier } from "../story/storybook/llm";
import { createOpenRouterStorybookLlm } from "../story/storybook/llm-openrouter";
import { SEED_EPISODES, SEED_SERIES } from "../story/library/seed";
import type { AudioScript, EpisodeContent } from "../story/library/types";
import { VOICE_ENGINES } from "../story/library/types";
import { NARRATOR_ID, resolveSeriesCast, type AccountVoice } from "../story/library/audio/casting";
import { geminiFigures } from "../story/library/audio/cast-members";
import { renderAudioDrama, writeAudioScript, type DramaInput } from "../story/library/audio/drama";
import { defaultVoiceEngine, engineInfo, estimateVoices, normalizeEngine, scriptVolume } from "../story/library/audio/engines";
import { LIBRARY_MODELS } from "../story/library/engine";
import { geminiVoice, resolveGeminiCast } from "../story/library/audio/gemini-voices";
import { openRouterSpeech } from "../story/library/audio/openrouter-speech";
import { loadAccountVoices } from "../story/library/audio/production";
import type { ScorePorts } from "../story/library/audio/score";
import { NARRATOR_KEY } from "../story/library/audio/screenplay";
import { planSoundCasting, soundWishes, wishKey, type SoundEntry, type SoundLibraryPort } from "../story/library/audio/sound-library";
import { ambiencePrompt, spotSeconds } from "../story/library/audio/timeline";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2);
const option = (name: string) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const seriesId = option("--series") || "bruno-der-flunkerfisch";
const chapterLimit = Number(option("--chapters") || 0);
const scriptOnly = args.includes("--script-only");
const estimateOnly = args.includes("--estimate");
const withoutSounds = args.includes("--no-sounds");
const budget = option("--budget") ? Number(option("--budget")) : undefined;
const from = option("--from");
const planSounds = args.includes("--plan-sounds");
const useLibrary = !args.includes("--no-library");
const engine = normalizeEngine(option("--engine") || defaultVoiceEngine());
if (!engine) throw new Error(`--engine must be one of ${VOICE_ENGINES.join(", ")}`);
const info = engineInfo(engine);
const out = join(ROOT, option("--out") || `Logs/library/audio/${seriesId}-${engine}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}`);

const seed = SEED_SERIES.find((entry) => entry.series.id === seriesId);
const episode = SEED_EPISODES.find((entry) => entry.seriesId === seriesId);
if (!seed || !episode) throw new Error(`Unknown series ${seriesId}`);
const content: EpisodeContent = { ...episode, chapters: chapterLimit > 0 ? episode.chapters.slice(0, chapterLimit) : episode.chapters };

const cacheRoot = join(ROOT, "Logs/library/audio");
const fileCache = (folder: string) => ({
  async load(key: string) {
    const file = join(cacheRoot, folder, key);
    return existsSync(file) ? readFileSync(file) : null;
  },
  async save(key: string, audio: Buffer) {
    const file = join(cacheRoot, folder, key);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, audio);
  },
});
const scorePorts: ScorePorts = {
  ...fileCache("score-cache"),
  compose: (prompt, seconds) => composeMusic({ prompt, lengthSeconds: seconds }),
  sound: async (prompt, seconds) => (await synthesizeSoundEffect({ prompt, durationSeconds: seconds, mode: "loop", promptInfluence: 0.5 })).audio,
};
const soundCache: SoundCachePort = fileCache("sound-cache");

const libraryFile = join(cacheRoot, "sound-library.json");
const readLibrary = (): SoundEntry[] => (existsSync(libraryFile) ? JSON.parse(readFileSync(libraryFile, "utf8")) : []);
const writeLibrary = (entries: SoundEntry[]) => {
  mkdirSync(cacheRoot, { recursive: true });
  writeFileSync(libraryFile, JSON.stringify(entries, null, 2));
};
const soundLibrary: SoundLibraryPort = {
  async list() {
    return readLibrary();
  },
  async add(entries) {
    const all = readLibrary();
    const known = new Set(all.map((entry) => entry.id));
    for (const entry of entries) if (!known.has(entry.id)) all.push({ ...entry, createdAt: new Date().toISOString() });
    writeLibrary(all);
  },
  async markUsed(ids) {
    const all = readLibrary();
    for (const entry of all) if (ids.includes(entry.id)) entry.uses += 1;
    writeLibrary(all);
  },
};

const openRouterKey = process.env.OPENROUTER_API_KEY || "";
async function openRouterUsage(): Promise<number | null> {
  if (!openRouterKey) return null;
  const response = await fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${openRouterKey}` } }).catch(() => null);
  if (!response?.ok) return null;
  return Number(((await response.json()) as { data?: { usage?: number } }).data?.usage ?? NaN);
}

function writeScript(script: AudioScript) {
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "script.json"), JSON.stringify(script, null, 2));
  const names = new Map(script.speakers.map((speaker) => [speaker.key, speaker.name]));
  const md = [
    `# ${content.title} — Hörspiel-Drehbuch`,
    "",
    "## Besetzung",
    ...script.speakers.map((speaker) => `- **${speaker.key}** ${speaker.name}: ElevenLabs ${speaker.voiceName ?? (speaker.voiceId || "—")}${speaker.geminiVoice ? ` · Gemini ${speaker.geminiVoice}` : ""} — [${speaker.persona}] (${speaker.source})`),
    "",
    ...(script.notes.length ? ["## Hinweise", ...script.notes.map((note) => `- ${note}`), ""] : []),
    ...script.parts.flatMap((part) => [
      `## ${part.title}`,
      "",
      ...part.lines.flatMap((line, index) => {
        const scene = part.scenes.find((entry) => entry.startLine === index);
        return [
          ...(scene ? [`> **Szene:** ${scene.place}${scene.ambience ? ` · Atmo: _${scene.ambience}_ (${scene.ambienceLevel})` : ""}${scene.music ? ` · Musik: **${scene.music}**` : ""}`, ""] : []),
          `**${line.speaker === NARRATOR_KEY ? "Erzähler" : names.get(line.speaker) ?? line.speaker}:** ${line.text}${line.sounds?.length ? `  \n  🔊 ${line.sounds.map((sound) => `${sound.sound}${sound.at ? ` @${sound.at}` : ""}`).join(" · ")}` : ""}`,
          "",
        ];
      }),
    ]),
  ].join("\n");
  writeFileSync(join(out, "script.md"), md);
}

/** New sounds this screenplay would generate (cached ones are free), in seconds of sound — an upper bound: the library may find more. */
async function newSoundSeconds(script: AudioScript): Promise<number> {
  if (withoutSounds) return 0;
  const seen = new Set<string>();
  let seconds = 0;
  for (const part of script.parts) {
    for (const scene of part.scenes) {
      if (!scene.ambience) continue;
      const key = soundCacheKey("ambience", ambiencePrompt(scene.ambience), 18, true);
      if (seen.has(key) || (await soundCache.load(key))) continue;
      seen.add(key);
      seconds += 18;
    }
    for (const line of part.lines) {
      for (const sound of line.sounds ?? []) {
        const length = spotSeconds(sound.seconds);
        const key = soundCacheKey("sfx", sound.sound, length, false);
        if (seen.has(key) || (await soundCache.load(key))) continue;
        seen.add(key);
        seconds += length;
      }
    }
  }
  return seconds;
}

let script: AudioScript | undefined = from ? JSON.parse(readFileSync(join(ROOT, from, "script.json"), "utf8")) : undefined;

if (script && (estimateOnly || budget !== undefined)) {
  const volume = scriptVolume(script);
  const sounds = (await newSoundSeconds(script)) / 60 * 0.12;
  console.log(`screenplay: ${volume.lines} lines, ${volume.billedChars} billed / ${volume.spokenChars} spoken characters; new sounds ≈ $${sounds.toFixed(3)}${withoutSounds ? " (--no-sounds)" : ""}`);
  for (const candidate of VOICE_ENGINES) {
    const estimate = estimateVoices(candidate, volume);
    console.log(`  ${engineInfo(candidate).label.padEnd(24)} voices ≈ $${estimate.usd.toFixed(3)}${estimate.seconds ? ` (${(estimate.seconds / 60).toFixed(1)} min speech)` : ""}${candidate === engine ? "  ← --engine" : ""}`);
  }
  if (estimateOnly) process.exit(0);
  const planned = estimateVoices(engine, volume).usd + sounds;
  if (planned > budget!) {
    console.log(`stop: estimate $${planned.toFixed(3)} is above --budget $${budget!.toFixed(3)}`);
    process.exit(2);
  }
}

mkdirSync(out, { recursive: true });
const ledger = new CostLedger();
const llm = withServiceTier(createOpenRouterStorybookLlm(), "flex");
const voices: AccountVoice[] = await loadAccountVoices().catch((error) => {
  if (info.family === "elevenlabs") throw error;
  console.warn(`ElevenLabs voices unavailable (${(error as Error).message}); Gemini casts without their labels.`);
  return [];
});
const { cast } = resolveSeriesCast({ bible: seed.bible, characters: seed.bible.characters, overrides: [], voices });
console.log(`engine: ${info.label} (${info.model}); ElevenLabs voices in account: ${voices.length}`);

let geminiCast: DramaInput["geminiCast"];
if (info.family === "gemini") {
  if (!openRouterKey) throw new Error("OPENROUTER_API_KEY missing in .env.local");
  const fixed = (option("--gemini-cast") ?? "").split(",").map((pair) => pair.split("=")).filter(([id, voice]) => id && geminiVoice(voice));
  const resolved = resolveGeminiCast({
    figures: geminiFigures(seed.bible.characters, cast, voices),
    overrides: fixed.map(([speakerId, voice]) => ({ speakerId: speakerId.trim(), voiceId: geminiVoice(voice)!.name, source: "admin" as const })),
    narratorId: NARRATOR_ID,
  });
  geminiCast = resolved.cast;
  console.log(geminiCast.map((entry) => `  ${entry.speakerId}: ${entry.silent ? "(stumm)" : `${entry.voice} [${entry.persona}] ${entry.source}`} — ${JSON.stringify(entry.hint)}`).join("\n"));
} else {
  console.log(cast.map((voice) => `  ${voice.speakerId}: ${voice.silent ? "(stumm)" : `${voice.voiceName ?? voice.voiceId} [${voice.persona}] ${voice.source}`}`).join("\n"));
}

const input: DramaInput = {
  series: seed.series,
  bible: seed.bible,
  season: episode.season,
  episode: episode.episode,
  content,
  characters: seed.bible.characters,
  seriesCast: cast,
  voices,
  llm,
  ledger,
  scorePorts,
  engine,
  ...(geminiCast ? { geminiCast, speech: openRouterSpeech({ apiKey: openRouterKey }) } : {}),
  soundCache,
  ...(useLibrary ? { soundLibrary } : {}),
  withoutSounds,
  report: async (step) => console.log(`— ${step} (${new Date().toLocaleTimeString("de-DE")})`),
};

if (!script) {
  script = await writeAudioScript(input);
  writeScript(script);
  console.log(`screenplay: ${script.parts.reduce((sum, part) => sum + part.lines.length, 0)} lines, $${ledger.totals().costUSD.toFixed(4)} → ${join(out, "script.md")}`);
}
if (script.notes.length) console.log(`notes:\n  ${script.notes.join("\n  ")}`);

if (planSounds) {
  const library = readLibrary();
  const plan = await planSoundCasting({ script, library, llm, ledger, model: LIBRARY_MODELS.support, origin: `${seed.series.title} S${episode.season}E${episode.episode}`, log: console.log });
  const byId = new Map([...library, ...plan.fresh].map((entry) => [entry.id, entry]));
  const tags = { library: "BIBLIOTHEK", episode: "WIE OBEN  ", new: "NEU       " };
  for (const wish of soundWishes(script)) {
    const choice = plan.choices.get(wishKey(wish))!;
    const entry = byId.get(choice.libraryId);
    const what = choice.source === "new" ? `„${entry?.label}“ — ${entry?.description} [${entry?.tags.join(", ")}]` : `${choice.prompt}${entry ? ` („${entry.label}“)` : ""}`;
    console.log(`${tags[choice.source]} ${wish.kind === "ambience" ? "Atmo" : `${wish.seconds}s`.padEnd(4)} ${wish.prompt}\n           → ${what}`);
  }
  // Sounds an earlier recording already generated have audio: they join the library without costing anything.
  const present: SoundEntry[] = [];
  for (const entry of plan.fresh) if (await soundCache.load(entry.storageKey)) present.push({ ...entry, uses: 1 });
  if (present.length) await soundLibrary.add(present);
  console.log(`casting: $${ledger.totals().costUSD.toFixed(4)}; ${present.length} sounds with audio in the local cache joined the library (${readLibrary().length} entries)`);
  process.exit(0);
}

if (!scriptOnly) {
  const usageBefore = info.family === "gemini" ? await openRouterUsage() : null;
  const result = await renderAudioDrama({ ...input, script });
  // OpenRouter books requests with a delay: wait up to a minute for the key's usage to move.
  let usageAfter: number | null = null;
  for (let waited = 0; usageBefore !== null && waited < 60_000; waited += 5000) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    usageAfter = await openRouterUsage();
    if (usageAfter !== null && usageAfter > usageBefore) break;
  }
  const measured = usageBefore !== null && usageAfter !== null ? Number((usageAfter - usageBefore).toFixed(4)) : undefined;
  writeFileSync(join(out, "drama.mp3"), result.audio);
  writeFileSync(join(out, "stats.json"), JSON.stringify({ engine, seconds: result.seconds, chapterStarts: result.chapterStarts, stats: result.stats, openRouterSpendUSD: measured, withoutSounds, llm: ledger.all() }, null, 2));
  writeScript(result.script);
  console.log(`drama: ${(result.seconds / 60).toFixed(1)} min → ${join(out, "drama.mp3")}`);
  console.log(JSON.stringify(result.stats));
  if (measured !== undefined) console.log(`OpenRouter spend measured on the key: $${measured.toFixed(4)} (computed voices: $${result.stats.costs?.voicesUSD.toFixed(4)})`);
}
process.exit(0);
