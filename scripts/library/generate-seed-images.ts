/**
 * Draws the pictures of the pre-produced library seed with FLUX 3 Image Klein
 * (same code as the admin pipeline: backend/story/library/images.ts).
 *
 *   bun --env-file=.env.local run scripts/library/generate-seed-images.ts [options]
 *
 *   --only portraits|scenes      just one stage (default: both, portraits first)
 *   --ids ella,s1e1-ch2          only these portraits (character/guest id) or pictures (<episodeKey>-cover|-ch1…, series-cover)
 *   --force                      redraw even if the file exists
 *   --seed 7                     fixed seed (default: random)
 *   --dry                        print prompts, call nothing
 *
 * Output lands in frontend/public (served as /library/…); prompts, seeds and
 * costs in Logs/library/seed-images.json. Every picture still needs a look by a human.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  buildScenePrompt,
  createRunwareCaller,
  drawPortrait,
  drawScene,
  figuresFor,
  type DrawnImage,
  type RunwareCaller,
} from "../../backend/story/library/images";
import type { EpisodeSeed, ImageSlot, SeriesSeed } from "../../backend/story/library/types";

const ROOT = join(import.meta.dir, "..", "..");
const SEED = join(ROOT, "backend", "story", "library", "seed");
const PUBLIC = join(ROOT, "frontend", "public");
const LOG = join(ROOT, "Logs", "library", "seed-images.json");

const args = process.argv.slice(2);
const option = (name: string) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const only = option("--only");
const ids = new Set((option("--ids") || "").split(",").map((value) => value.trim()).filter(Boolean));
const force = args.includes("--force");
const dry = args.includes("--dry");
const fixedSeed = option("--seed") ? Number(option("--seed")) : undefined;

const apiKey = process.env.RUNWARE_API_KEY || "";
if (!apiKey && !dry) throw new Error("RUNWARE_API_KEY is not set (bun --env-file=.env.local …).");
const call: RunwareCaller = dry
  ? async (task) => {
      console.log(`\n--- ${task.width}x${task.height}, refs ${task.inputs?.referenceImages.length ?? 0}\n${task.positivePrompt}`);
      return { imageURL: "", cost: 0, seed: task.seed };
    }
  : createRunwareCaller(apiKey);

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;
const series = readdirSync(join(SEED, "series"))
  .filter((name) => name.endsWith(".bible.json"))
  .map((name) => readJson<SeriesSeed>(join(SEED, "series", name)));
const episodes = readdirSync(join(SEED, "episodes"))
  .filter((name) => name.endsWith(".json"))
  .map((name) => readJson<EpisodeSeed>(join(SEED, "episodes", name)));

/** Key art for the shelf; one picture per series. */
const SERIES_COVERS: Record<string, ImageSlot> = {
  "bruno-der-flunkerfisch": {
    url: "/library/series/bruno-der-flunkerfisch/cover.webp",
    sceneEn:
      "Sunny living room of a small-town apartment. [ella] and [mats] kneel on a striped rug in side view, noses almost touching the glass of the round fish tank on the low windowsill, and look at [bruno], who swims in the tank and peers back at them with grumpy half-closed eyes. Around the door frame on the left edge, [kater-kaiser] peeks in, his narrowed eyes fixed on the fish",
    characterIds: ["ella", "mats", "bruno", "kater-kaiser"],
    boxes: { "kater-kaiser": [300, 0, 900, 190], ella: [330, 210, 1000, 470], mats: [400, 440, 1000, 680], bruno: [120, 640, 600, 960] },
  },
  "die-monster-muellabfuhr": {
    url: "/library/series/die-monster-muellabfuhr/cover.webp",
    sceneEn:
      "Quiet town street at night under a big moon. [gertrud] is parked by the curb with glowing headlights. [oma-hilde] lifts a round monster bin off the back of the truck and grins at [jona]. [jona], in his orange vest, crouches on the pavement and shines a flashlight on a trail of single socks that leads up to a front door. [flusi] sits beside him and sniffs at the first sock",
    characterIds: ["gertrud", "oma-hilde", "jona", "flusi"],
    boxes: { gertrud: [150, 0, 900, 420], "oma-hilde": [200, 360, 1000, 580], jona: [450, 560, 1000, 800], flusi: [700, 790, 1000, 930] },
  },
};

const fileFor = (url: string) => join(PUBLIC, ...url.replace(/^\//, "").split("/"));
const loadReference = async (url: string): Promise<Buffer> => {
  if (/^https?:\/\//.test(url)) return Buffer.from(await (await fetch(url)).arrayBuffer());
  const path = fileFor(url);
  if (!existsSync(path)) throw new Error(`Reference picture missing: ${url} (draw portraits first)`);
  return readFileSync(path);
};

const log: Record<string, unknown> = existsSync(LOG) ? readJson(LOG) : {};
let totalCost = 0;

async function save(key: string, url: string, drawn: DrawnImage) {
  totalCost += drawn.costUSD;
  log[key] = { url, seed: drawn.seed, costUSD: drawn.costUSD, prompt: drawn.prompt, references: drawn.referenceCount, at: new Date().toISOString() };
  if (dry || !drawn.imageUrl) return;
  const bytes = Buffer.from(await (await fetch(drawn.imageUrl)).arrayBuffer());
  mkdirSync(dirname(fileFor(url)), { recursive: true });
  writeFileSync(fileFor(url), bytes);
  console.log(`✓ ${key} → ${url} ($${drawn.costUSD.toFixed(4)}, seed ${drawn.seed})`);
}

const wanted = (key: string, url: string) => (ids.size ? ids.has(key) : true) && (force || !existsSync(fileFor(url)));

if (!only || only === "portraits") {
  const jobs: Array<Promise<void>> = [];
  for (const { bible } of series) {
    for (const character of bible.characters) {
      if (!wanted(character.id, character.referenceStripKey)) continue;
      jobs.push(drawPortrait({ id: character.id, name: character.name, visualProfileEn: character.visualProfileEn }, bible.imageStyleEn, call, fixedSeed)
        .then((drawn) => save(character.id, character.referenceStripKey, drawn)));
    }
  }
  for (const episode of episodes) {
    const style = series.find((entry) => entry.series.id === episode.seriesId)!.bible.imageStyleEn;
    for (const guest of episode.guests) {
      if (!guest.referenceUrl || !wanted(guest.id, guest.referenceUrl)) continue;
      jobs.push(drawPortrait(guest, style, call, fixedSeed).then((drawn) => save(guest.id, guest.referenceUrl!, drawn)));
    }
  }
  await Promise.all(jobs);
}

if (!only || only === "scenes") {
  const jobs: Array<Promise<void>> = [];
  for (const { series: info, bible } of series) {
    const cover = SERIES_COVERS[info.id];
    if (cover?.url && wanted(`${info.id}-cover`, cover.url)) {
      jobs.push(drawScene(cover, { style: bible.imageStyleEn, characters: bible.characters, guests: [], load: loadReference, call, seed: fixedSeed })
        .then((drawn) => save(`${info.id}-cover`, cover.url!, drawn)));
    }
  }
  for (const episode of episodes) {
    const { bible } = series.find((entry) => entry.series.id === episode.seriesId)!;
    const episodeKey = `s${episode.season}e${episode.episode}`;
    const slots: Array<[string, ImageSlot]> = [[`${episodeKey}-cover`, episode.cover]];
    episode.chapters.forEach((chapter, index) => chapter.image && slots.push([`${episodeKey}-ch${index + 1}`, chapter.image]));
    for (const [key, slot] of slots) {
      const fullKey = `${episode.seriesId}-${key}`;
      if (!slot.url || !(ids.size ? ids.has(key) || ids.has(fullKey) : true) || (!force && existsSync(fileFor(slot.url)))) continue;
      if (dry) console.log(buildScenePrompt(slot.sceneEn, bible.imageStyleEn, figuresFor(slot.characterIds, bible.characters, episode.guests)));
      jobs.push(drawScene(slot, { style: bible.imageStyleEn, characters: bible.characters, guests: episode.guests, load: loadReference, call, seed: fixedSeed })
        .then((drawn) => save(fullKey, slot.url!, drawn)));
    }
  }
  await Promise.all(jobs);
}

mkdirSync(dirname(LOG), { recursive: true });
writeFileSync(LOG, JSON.stringify(log, null, 2));
console.log(`\nTotal this run: $${totalCost.toFixed(4)}`);
