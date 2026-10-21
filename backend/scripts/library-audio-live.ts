/**
 * Live test of the Originals audio drama — no database, no bucket. Same chain as
 * the Studio button: cast → screenplay → ElevenLabs v4 voices → series score →
 * studio mix. Uses the seeded episode of a series.
 *
 *   cd backend
 *   encore exec -- bun --env-file=../.env.local scripts/library-audio-live.ts --series bruno-der-flunkerfisch [options]
 *
 *   --script-only          only cast + screenplay (no ElevenLabs credits)
 *   --from <dir>           record the screenplay saved in <dir>/script.json again
 *   --chapters N           only the first N chapters (cheaper test)
 *   --out Logs/library/audio/<tag>
 *
 * The score is cached in Logs/library/audio/score-cache (instead of the bucket).
 * Output: script.json, script.md (readable screenplay), drama.mp3, stats.json.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { composeMusic, synthesizeSoundEffect } from "../tts/elevenlabs-dialogue";
import { CostLedger, withServiceTier } from "../story/storybook/llm";
import { createOpenRouterStorybookLlm } from "../story/storybook/llm-openrouter";
import { SEED_EPISODES, SEED_SERIES } from "../story/library/seed";
import type { AudioScript, EpisodeContent } from "../story/library/types";
import { resolveSeriesCast } from "../story/library/audio/casting";
import { renderAudioDrama, writeAudioScript, type DramaInput } from "../story/library/audio/drama";
import { loadAccountVoices } from "../story/library/audio/production";
import type { ScorePorts } from "../story/library/audio/score";
import { NARRATOR_KEY } from "../story/library/audio/screenplay";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2);
const option = (name: string) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const seriesId = option("--series") || "bruno-der-flunkerfisch";
const chapterLimit = Number(option("--chapters") || 0);
const scriptOnly = args.includes("--script-only");
const from = option("--from");
const out = join(ROOT, option("--out") || `Logs/library/audio/${seriesId}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}`);
mkdirSync(out, { recursive: true });

const seed = SEED_SERIES.find((entry) => entry.series.id === seriesId);
const episode = SEED_EPISODES.find((entry) => entry.seriesId === seriesId);
if (!seed || !episode) throw new Error(`Unknown series ${seriesId}`);
const content: EpisodeContent = { ...episode, chapters: chapterLimit > 0 ? episode.chapters.slice(0, chapterLimit) : episode.chapters };

const scoreDir = join(ROOT, "Logs/library/audio/score-cache");
const scorePorts: ScorePorts = {
  async load(key) {
    const file = join(scoreDir, key);
    return existsSync(file) ? readFileSync(file) : null;
  },
  async save(key, audio) {
    const file = join(scoreDir, key);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, audio);
  },
  compose: (prompt, seconds) => composeMusic({ prompt, lengthSeconds: seconds }),
  sound: async (prompt, seconds) => (await synthesizeSoundEffect({ prompt, durationSeconds: seconds, mode: "loop", promptInfluence: 0.5 })).audio,
};

const ledger = new CostLedger();
const llm = withServiceTier(createOpenRouterStorybookLlm(), "flex");
const voices = await loadAccountVoices();
const { cast } = resolveSeriesCast({ bible: seed.bible, characters: seed.bible.characters, overrides: [], voices });
console.log(`voices in account: ${voices.length}`);
console.log(cast.map((voice) => `  ${voice.speakerId}: ${voice.silent ? "(stumm)" : `${voice.voiceName ?? voice.voiceId} [${voice.persona}] ${voice.source}`}`).join("\n"));

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
  report: async (step) => console.log(`— ${step} (${new Date().toLocaleTimeString("de-DE")})`),
};

function writeScript(script: AudioScript) {
  writeFileSync(join(out, "script.json"), JSON.stringify(script, null, 2));
  const names = new Map(script.speakers.map((speaker) => [speaker.key, speaker.name]));
  const md = [
    `# ${content.title} — Hörspiel-Drehbuch`,
    "",
    "## Besetzung",
    ...script.speakers.map((speaker) => `- **${speaker.key}** ${speaker.name}: ${speaker.voiceName ?? speaker.voiceId} — [${speaker.persona}] (${speaker.source})`),
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

let script: AudioScript;
if (from) {
  script = JSON.parse(readFileSync(join(ROOT, from, "script.json"), "utf8"));
} else {
  script = await writeAudioScript(input);
  writeScript(script);
  console.log(`screenplay: ${script.parts.reduce((sum, part) => sum + part.lines.length, 0)} lines, $${ledger.totals().costUSD.toFixed(4)} → ${join(out, "script.md")}`);
}
if (script.notes.length) console.log(`notes:\n  ${script.notes.join("\n  ")}`);

if (!scriptOnly) {
  const result = await renderAudioDrama({ ...input, script });
  writeFileSync(join(out, "drama.mp3"), result.audio);
  writeFileSync(join(out, "stats.json"), JSON.stringify({ seconds: result.seconds, chapterStarts: result.chapterStarts, stats: result.stats, llm: ledger.all() }, null, 2));
  writeScript(result.script);
  console.log(`drama: ${(result.seconds / 60).toFixed(1)} min → ${join(out, "drama.mp3")}`);
  console.log(JSON.stringify(result.stats));
}
process.exit(0);
