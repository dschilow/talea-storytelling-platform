/**
 * Erzeugt die Geräusche und Ambiente-Schleifen des Mitternachts-Alibi über ElevenLabs sound-generation.
 *
 *   bun scripts/game-voices/sfx.mjs --dry
 *   bun scripts/game-voices/sfx.mjs                 # fx.*, fx.sight.*, amb.* (ohne music.*)
 *   bun scripts/game-voices/sfx.mjs --music         # zusätzlich music.* (im Spiel noch nicht eingebunden)
 *   bun scripts/game-voices/sfx.mjs --only fx.bell --force
 *
 * Prompts: docs/games/mitternachts-alibi-v2/Effekte.json (+ Ergänzungen unten für pop/swoosh/sparkle).
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { REPO_ROOT, sfxClip } from "./eleven.mjs";
import { master } from "./master.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(REPO_ROOT, "frontend", "public", "game", "alibi", "voices");
const RAW_DIR = path.join(HERE, ".cache", "raw-sfx");
const LEDGER = path.join(HERE, ".cache", "ledger-sfx.json");

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : d;
};

/** Zusätzliche Klänge, die im Spiel vorkommen, aber nicht in Effekte.json stehen. */
const EXTRA = {
  "fx.pop": "A tiny bubble pop, bright and cute, very short",
  "fx.swoosh": "A quick light swoosh of a card sliding across a table, airy",
  "fx.sparkle": "A short magical sparkle glissando, tiny bells, bright and sweet",
  // Mitternachts-Alibi 3
  "fx.seal": "A hard red wax seal cracking and breaking in two, crisp snap, close",
  "fx.sneak": "Soft sneaky tiptoe footsteps on wooden floor, four steps, playful cartoon",
  "fx.clock": "One deep heavy grandfather clock tick tock, resonant, close",
  "fx.loot": "A magical treasure reveal, shimmering chimes rising into a bright warm sparkle, short and joyful",
  "fx.feather": "A light feather fluttering down through the air, soft whoosh and flutter",
  "fx.poster": "A paper poster slapped onto a wooden board and pinned with a nail tap",
  "fx.dawn": "A rooster crowing at dawn followed by a short bright orchestral chord, cartoon",
  // Tathergang: Geräusche der Tat je Fall und Erzähl-Effekte
  "fx.th.laterne": "Footsteps climbing a creaky wooden spiral staircase inside a stone tower, echoing, then a soft glass clink",
  "fx.th.kuchen": "Someone sneakily munching a big fluffy cake, comical chewing sounds and a tiny happy burp",
  "fx.th.rezept": "An old wooden tavern door creaking open slowly, then a heavy wooden chest lid creaking open",
  "fx.th.mondstein": "A glass dome lifted off with a delicate clink, then a soft magical humming tone that fades away",
  "fx.th.glocke": "A rope being cut with a snip, then a heavy brass bell caught in arms with a muffled clong",
  "fx.th.honig": "Two little bees snoring softly with tiny buzzing snores, then a sticky slurping lick",
  "fx.th.hufeisen": "A wooden stool scraping on cobblestones, then a metal horseshoe lifted off a nail with a clink",
  "fx.th.spieluhr": "A delicate music box melody playing and abruptly stopping mid tune",
  "fx.rewind": "A magical rewind whoosh like time spinning backwards, sparkly and swirling",
  "fx.drop": "A small cloth sack dropped onto straw, soft thud and rustle",
  "fx.ooh": "A small group of excited children gasping ooh in surprise",
};
/** Dauer in Sekunden je Klang (Standard 2). */
const DURATION = { "fx.type": 0.8, "fx.tick": 0.8, "fx.stamp": 1.2, "fx.gavel": 1.2, "fx.chime": 2.2, "fx.knock": 1.2, "fx.pop": 0.8, "fx.swoosh": 0.8, "fx.sparkle": 1.5, "fx.page": 1.2, "fx.whoosh": 1.0, "fx.sting": 2.5, "fx.drum": 3, "fx.fanfare": 3.5, "fx.sad": 2.5, "fx.cheer": 3, "fx.boo": 2, "fx.creak": 3, "fx.ring": 3, "fx.bell": 5, "fx.rooster": 3, "fx.seal": 1.2, "fx.sneak": 2.2, "fx.clock": 1.6, "fx.loot": 2.6, "fx.feather": 2, "fx.poster": 1.2, "fx.dawn": 3, "fx.rewind": 1.6, "fx.drop": 1.2, "fx.ooh": 1.8, "fx.th.laterne": 3.5, "fx.th.kuchen": 3, "fx.th.rezept": 3.5, "fx.th.mondstein": 3, "fx.th.glocke": 3, "fx.th.honig": 3.5, "fx.th.hufeisen": 3, "fx.th.spieluhr": 3.5 };
const LUFS = (id) => (id.startsWith("amb.") ? -34 : id.startsWith("music.") ? -26 : -23);

const prompts = { ...JSON.parse(readFileSync(path.join(REPO_ROOT, "docs", "games", "mitternachts-alibi-v2", "Effekte.json"), "utf8")), ...EXTRA };
const only = opt("only", "");
const jobs = Object.entries(prompts)
  .filter(([id]) => (flag("music") || !id.startsWith("music.")) && (!only || id.includes(only)))
  .map(([id, prompt]) => ({
    id,
    prompt: prompt.replace(/\s*\((?:about two seconds|used twelve times)[^)]*\)/, "").replace(/,?\s*loopable,?\s*30 seconds/, ", seamless loop"),
    seconds: id.startsWith("amb.") ? 30 : id.startsWith("music.") ? 30 : DURATION[id] ?? 2.2,
    loop: id.startsWith("amb.") || id.startsWith("music.bed") || id.startsWith("music.tension"),
  }));

mkdirSync(RAW_DIR, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });
const ledger = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, "utf8")) : {};
const todo = jobs.filter((j) => flag("force") || flag("remaster") || !existsSync(path.join(OUT_DIR, `${j.id}.mp3`)));
const seconds = todo.reduce((s, j) => s + j.seconds, 0);
console.log(`Klänge im Plan: ${jobs.length} | zu erzeugen: ${todo.length} | Sekunden: ${seconds.toFixed(0)}`);
if (flag("dry")) process.exit(0);

let failures = 0;
const queue = [...todo];
async function worker() {
  while (queue.length) {
    const j = queue.shift();
    try {
      const raw = path.join(RAW_DIR, `${j.id}.mp3`);
      if (!existsSync(raw) || flag("force")) {
        const r = await sfxClip({ prompt: j.prompt, durationSeconds: j.seconds, loop: j.loop, promptInfluence: 0.5 });
        writeFileSync(raw, r.audio);
      }
      const amb = j.id.startsWith("amb.") || j.id.startsWith("music.");
      const m = master(raw, path.join(OUT_DIR, `${j.id}.mp3`), { target: LUFS(j.id), trim: amb ? false : "sfx", peakCap: amb ? -12 : -4, fadeOut: amb ? 0.01 : 0.08, bitrate: amb ? "96k" : "64k", maxGain: 40 });
      ledger[j.id] = { prompt: j.prompt, seconds: j.seconds, duration: m.duration, gain: m.gain };
      console.log(`${j.id} · ${m.duration.toFixed(1)} s · Gain ${m.gain} dB`);
    } catch (e) {
      failures++;
      console.log(`FEHLER ${j.id}: ${String(e.message).slice(0, 200)}`);
      if (/quota_exceeded|invalid_api_key|missing_permissions/i.test(String(e.message))) queue.length = 0;
    }
  }
}
await Promise.all(Array.from({ length: 3 }, worker));
writeFileSync(LEDGER, JSON.stringify(ledger, null, 1));
const present = readdirSync(OUT_DIR).filter((f) => f.endsWith(".mp3")).map((f) => f.slice(0, -4)).sort();
writeFileSync(path.join(OUT_DIR, "manifest.json"), JSON.stringify({ ids: present }));
console.log(`Fertig, Fehler: ${failures}, Manifest ${present.length} IDs.`);
process.exit(failures ? 1 : 0);
