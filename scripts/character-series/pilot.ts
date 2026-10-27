/**
 * Text-only pilot of the production series prompt and Talea-Folge engine.
 * It uses fictional avatars and the checked-in pool export, never live data,
 * databases, images or production OpenRouter credentials.
 *
 * bun scripts/character-series/pilot.ts --dry
 * bun scripts/character-series/pilot.ts --run --episode 1
 * bun scripts/character-series/pilot.ts --run --episode 2
 *
 * The Codex transport consumes the signed-in Codex quota. Stage requests and
 * responses are recorded under Logs; finished manuscripts are placed in docs.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import bibles from "../../backend/story/character-series/series-bibles.json";
import { CHARACTER_SERIES_ENGINE, extractSeriesLog, validateSeriesLog, type CharacterSeriesBible, type SeriesEpisodeLog } from "../../backend/story/character-series/core";
import { episodeBudget, episodeProductionModels } from "../../backend/story/episode/craft";
import { runEpisodeTextEngine } from "../../backend/story/episode/engine";
import { oneShotSystemPrompt, oneShotUserPrompt } from "../../backend/story/episode/prompts";
import { buildBrief } from "../../backend/story/storybook/context";
import { CostLedger, type StorybookLlm } from "../../backend/story/storybook/llm";
import { toCastCandidate } from "../../backend/story/storybook/cast-selection";
import { codexPort } from "../wonder-story/codex-port";

const args = process.argv.slice(2);
const value = (name: string, fallback: string) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
if (!args.includes("--dry") && !args.includes("--run")) throw new Error("Use --dry or --run explicitly.");
if (args.includes("--dry") && args.includes("--run")) throw new Error("Choose either --dry or --run.");
const episode = Number(value("--episode", "1"));
if (episode !== 1 && episode !== 2) throw new Error("Pilot supports episode 1 or 2.");
const seriesId = value("--series", "nebelfee");
const bible = (bibles as CharacterSeriesBible[]).find((entry) => entry.id === seriesId);
if (!bible) throw new Error(`Unknown series ${seriesId}.`);
const root = resolve(value("--out", `Logs/character-series-pilot/${seriesId}`));
const published = resolve(value("--publish", `docs/figurenserien/pilot/${seriesId}`));
const stageDir = join(root, `episode-${episode}`);
await mkdir(stageDir, { recursive: true });
const poolPath = resolve("exports/character-pool/2026-10-26/talea-characters-2026-10-26-optimiert.json");
const poolBytes = await readFile(poolPath);
const pool = JSON.parse(poolBytes.toString("utf8"));
const row = pool.find((item: any) => item.id === bible.characterId);
const lead = row && toCastCandidate(row);
if (!lead) throw new Error(`Missing lead ${bible.characterId} in the local pool export.`);

const avatars = [
  { id: "fictional-nora", name: "Nora", age: 8, description: "Neugierig, praktisch, manchmal vorschnell. Plant gern und muss Ben zu Wort kommen lassen." },
  { id: "fictional-ben", name: "Ben", age: 7, description: "Beobachtet genau, stellt kurze Fragen, trockener Humor. Möchte mitentscheiden." },
];
const config: any = {
  avatarIds: avatars.map((avatar) => avatar.id), storybookMode: true, storybookEngine: CHARACTER_SERIES_ENGINE,
  characterSeriesId: seriesId, genre: "magic", setting: "forest", ageGroup: "6-8", length: "short", language: "de",
  humorLevel: 2, suspenseLevel: 2, emotionalFlavors: ["lachfreude", "warmherzigkeit"],
  requireHappyEnd: true, avatarIsHero: false, allowRhymes: false, aiProvider: "openrouter", openRouterModel: "openai/gpt-6.1-sol",
};
let logs: SeriesEpisodeLog[] = [];
if (episode === 2) {
  if (args.includes("--dry")) {
    logs = [{ episode: 1, storyId: "dry-fixture", avatarIds: avatars.map((avatar) => avatar.id), events: [{ fact: "Fixture only", quote: "Nora und Ben halfen der Nebelfee." }], relationships: [], openThreads: [] }];
  } else {
    const result = JSON.parse(await readFile(join(root, "episode-1", "result.json"), "utf8"));
    const currentBibleSHA256 = createHash("sha256").update(JSON.stringify(bible)).digest("hex");
    if (result.status !== "accepted" || result.result?.textQuality?.status === "failed" || !result.result?.finalChecks?.ok || result.seriesId !== seriesId || !result.log || result.episode !== 1 || result.bibleSHA256 !== currentBibleSHA256) throw new Error("Episode 1 result is missing, rejected or was produced with a different series bible.");
    logs = [result.log];
  }
}
const brief = buildBrief({ config, band: "6-8", budget: episodeBudget(config.length, "6-8"), heroes: avatars, candidates: [{ ...lead, canLead: true }], artifacts: [], seed: `character-series-pilot-${seriesId}-${episode}` });
brief.characterSeries = { bible, logs };
const sha256 = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");
const manifest = {
  seriesId, episode, pipeline: CHARACTER_SERIES_ENGINE, underlyingEngine: "talea-folge-v1", mode: "one-shot",
  modelRoles: episodeProductionModels(), transport: "codex-chatgpt-plan", imagesGenerated: 0, databaseCalls: 0,
  fictionalAvatars: avatars.map((avatar) => avatar.name), localPoolSHA256: sha256(poolBytes), bibleSHA256: sha256(JSON.stringify(bible)),
  note: "Text-only pilot of the production engine; no Encore request, live cast selection, images, production side effects or OpenRouter billing. Codex quota is consumed on --run.",
};
await writeFile(join(stageDir, "manifest.json"), JSON.stringify(manifest, null, 2));
await writeFile(join(stageDir, "brief.json"), JSON.stringify(brief, null, 2));
if (args.includes("--dry")) {
  const request = { system: oneShotSystemPrompt(brief), user: oneShotUserPrompt(brief) };
  await writeFile(join(stageDir, "dry-request.json"), JSON.stringify(request, null, 2));
  if (!request.user.includes(bible.bible) || !request.user.includes("VERBINDLICHE FIGURENSERIE")) throw new Error("Series bible missing from author prompt.");
  console.log(JSON.stringify({ dry: true, series: seriesId, episode, promptChars: request.system.length + request.user.length, manifest }, null, 2));
  process.exit(0);
}

const ports = new Map<string, StorybookLlm>();
let calls = 0;
let replayed = 0;
// A repair retry may replay the four successful calls from the preceding run.
// Compare the complete serialized request, not just its stage or file name.
const reusable: Record<string, { model: string; prefix: string }> = {
  "episode-oneshot": { model: "gpt-6.1-sol", prefix: "01-episode-oneshot" },
  "episode-editorial-review": { model: "gpt-6.1-terra", prefix: "01-episode-editorial-review" },
  "episode-editorial-revision": { model: "gpt-6.1-sol", prefix: "02-episode-editorial-revision" },
  "episode-editorial-recheck": { model: "gpt-6.1-terra", prefix: "02-episode-editorial-recheck" },
};
const stable = (value: any): any => Array.isArray(value) ? value.map(stable) : value && typeof value === "object"
  ? Object.fromEntries(Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => [key, stable(value[key])])) : value;
const llm: StorybookLlm = async (request) => {
  if (++calls > 8) throw new Error("Pilot call ceiling (8) reached.");
  const model = request.model.replace(/^openai\//, "");
  if (!["gpt-6.1-sol", "gpt-6.1-terra"].includes(model)) throw new Error(`Unexpected model ${model}.`);
  const prior = args.includes("--replay-existing") && episode === 1 ? reusable[request.stage] : undefined;
  if (prior) {
    if (model !== prior.model) throw new Error(`Cannot replay ${request.stage}: model changed.`);
    const base = join(stageDir, prior.model, prior.prefix);
    const saved = JSON.parse(await readFile(`${base}.request.json`, "utf8"));
    const { actualModel, transport, ...savedRequest } = saved;
    if (actualModel !== model || transport !== "codex-chatgpt-plan" || JSON.stringify(stable(savedRequest)) !== JSON.stringify(stable(request))) {
      throw new Error(`Cannot replay ${request.stage}: saved request differs.`);
    }
    const events = (await readFile(`${base}.events.jsonl`, "utf8")).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
    const completion = events.findLast((event: any) => event.type === "turn.completed");
    if (!completion || events.some((event: any) => event.type === "turn.failed")) throw new Error(`Cannot replay ${request.stage}: incomplete turn.`);
    const text = await readFile(`${base}.txt`, "utf8");
    if (!text.trim()) throw new Error(`Cannot replay ${request.stage}: empty output.`);
    replayed++;
    console.log(`  ${request.stage} · ${model} · exact saved response`);
    return { text, modelUsed: model, usage: { prompt: completion.usage?.input_tokens || 0, completion: completion.usage?.output_tokens || 0, total: (completion.usage?.input_tokens || 0) + (completion.usage?.output_tokens || 0), cachedPromptTokens: completion.usage?.cached_input_tokens || 0, costUSD: 0 }, durationMs: 0, finishReason: "stop" };
  }
  let port = ports.get(model);
  if (!port) { port = codexPort(join(stageDir, args.includes("--replay-existing") ? "new-repair-calls" : "", model), model); ports.set(model, port); }
  return port(request);
};
const ledger = new CostLedger();
try {
  const result = await runEpisodeTextEngine({ brief, llm, ledger, models: episodeProductionModels(), options: { mode: "one-shot", editorialReview: true, writeEffort: "low" },
    observe: async (stage, payload) => { await writeFile(join(stageDir, `${stage}.json`), JSON.stringify(payload, null, 2)); } });
  if (!result.pages.length || !result.finalChecks.ok || result.textQuality.status === "failed") {
    await writeFile(join(stageDir, "rejected-result.json"), JSON.stringify({ ...manifest, status: "rejected", result, calls, replayed, stages: ledger.all(), usage: ledger.totals() }, null, 2));
    if (result.pages.length) {
      await mkdir(published, { recursive: true });
      await writeFile(join(published, `folge-${episode}-abgelehnt.md`), `# ${result.title}\n\n> Abgelehnter Testentwurf: Die Produktionsprüfung wurde nicht bestanden.\n\n${result.description}\n\n${result.pages.map((page) => `## ${page.title}\n\n${page.content}`).join("\n\n")}\n`);
    }
    throw new Error(`Production quality gate rejected manuscript: ${JSON.stringify({ checks: result.finalChecks, textQuality: result.textQuality })}`);
  }
  const storyText = result.pages.map((page) => `${page.title}\n${page.content}`).join("\n\n");
  const identity = { episode, storyId: `fictional-${seriesId}-${episode}`, avatarIds: avatars.map((avatar) => avatar.id) };
  const validated = validateSeriesLog(result.episode.seriesLogCandidate, storyText, identity);
  const log = validated.events.length ? validated : extractSeriesLog({ storyText, ...identity });
  const logSource = validated.events.length ? "author-header-validated" : "literal-excerpt-fallback";
  await writeFile(join(stageDir, "result.json"), JSON.stringify({ ...manifest, status: "accepted", result, log, logSource, calls, replayed, stages: ledger.all(), usage: ledger.totals() }, null, 2));
  await mkdir(published, { recursive: true });
  const story = `# ${result.title}\n\n${result.description}\n\n${result.pages.map((page) => `## ${page.title}\n\n${page.content}`).join("\n\n")}\n`;
  await writeFile(join(published, `folge-${episode}.md`), story);
  await writeFile(join(published, `folge-${episode}-protokoll.json`), JSON.stringify({ ...manifest, status: "accepted", title: result.title, checks: result.finalChecks, textQuality: result.textQuality, log, logSource, calls, replayed }, null, 2));
  console.log(JSON.stringify({ series: seriesId, episode, title: result.title, calls, logSource, checks: result.finalChecks, output: published }));
} catch (error) {
  await writeFile(join(stageDir, "failure.json"), JSON.stringify({ ...manifest, error: String(error), calls, replayed, stages: ledger.all() }, null, 2));
  throw error;
}
