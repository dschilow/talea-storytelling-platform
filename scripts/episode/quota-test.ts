/**
 * The Talea-Folge text engine used by the wizard tile, with Codex quota.
 * No Encore, database, image generation, or API-key transport is imported.
 * bun scripts/episode/quota-test.ts --case magic --out Logs/episode-quota/baseline
 * bun scripts/episode/quota-test.ts --review Logs/episode-quota/baseline --out Logs/episode-quota/review
 */
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { buildBrief } from "../../backend/story/storybook/context";
import { countWords } from "../../backend/story/storybook/checks";
import { CostLedger, type LlmRequest, type StorybookLlm } from "../../backend/story/storybook/llm";
import { episodeBudget } from "../../backend/story/episode/craft";
import { EPISODE_PIPELINE_ID, runEpisodeTextEngine } from "../../backend/story/episode/engine";
import { codexPort } from "../wonder-story/codex-port";
import { toCastCandidate } from "../../backend/story/storybook/cast-selection";

const args = process.argv.slice(2);
const opt = (name: string, fallback: string) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const name = opt("--case", "magic");
if (!["magic", "fairytale", "bedtime"].includes(name)) throw new Error("Unknown case.");
const out = resolve(opt("--out", `Logs/episode-quota/${name}-${Date.now()}`));
const effort = opt("--effort", "low");
if (!["low", "medium", "high"].includes(effort)) throw new Error("Invalid writing effort.");
await mkdir(out, { recursive: true });
const ports = new Map<string, StorybookLlm>();
// Reconstruct the pre-experiment user prompt for held-out comparisons. The
// transformation is checked byte-for-byte against saved baseline requests.
const beforeWantAnchor = args.includes("--before-want-anchor");
const authorUser = (user: string) => beforeWantAnchor ? user.split("\n").filter(line =>
  !line.startsWith("THE STORY ENGINE IS THIS FIGURE'S SUPPLIED WANT:") &&
  !line.startsWith("Today's child-situation choices may complicate that objective;")
).join("\n") : user;
let calls = 0;
const maxCalls = Number(opt("--max-calls", "6"));
if (!Number.isInteger(maxCalls) || maxCalls < 1) throw new Error("Invalid call ceiling.");
const llm: StorybookLlm = async (request: LlmRequest) => {
  if (request.stage.startsWith("episode-oneshot")) request = { ...request, user: authorUser(request.user) };
  if (++calls > maxCalls) throw new Error(`Call ceiling reached (${maxCalls}).`);
  const model = request.model.replace(/^openai\//, "");
  if (!["gpt-6-luna", "gpt-6.1-sol"].includes(model)) throw new Error(`Unauthorized model: ${model}`);
  if (request.imageInputs?.length) throw new Error("This test is text only.");
  // Resume an interrupted review without calling an already completed judge
  // again. Only an exactly matching request and its saved response qualify.
  const responsePath = join(out, `${String(calls).padStart(2, "0")}-${request.stage}.response.json`);
  if (args.includes("--review")) {
    try {
      const previous = JSON.parse(await readFile(join(out, model, `01-${request.stage}.request.json`), "utf8"));
      const key = (r: LlmRequest) => JSON.stringify([r.model, r.system, r.user, r.json, r.effort, r.maxTokens]);
      const response = JSON.parse(await readFile(responsePath, "utf8"));
      if (key(previous) === key(request) && previous.actualModel === model && response.text?.trim() && response.modelUsed === model) {
        console.log(`  ${request.stage} · ${model} · exact saved review`);
        return { ...response, durationMs: 0, usage: { prompt: 0, completion: 0, total: 0, costUSD: 0 } };
      }
    } catch { /* no complete matching response: run this judge */ }
  }
  let port = ports.get(model);
  if (!port) { port = codexPort(join(out, model), model); ports.set(model, port); }
  const result = await port(request);
  await writeFile(responsePath, JSON.stringify(result, null, 2));
  return result;
};

if (args.includes("--review")) {
  const source = resolve(opt("--review", ""));
  const manifest = JSON.parse(await readFile(join(source, "manifest.json"), "utf8"));
  if (manifest.pipeline !== EPISODE_PIPELINE_ID) throw new Error("Refusing to review a different pipeline as Talea-Folge.");
  const { evaluateStory } = await import("../story-quality/evaluation");
  await evaluateStory(source, out, llm);
  await writeFile(join(out, "manifest.json"), JSON.stringify({ pipeline: EPISODE_PIPELINE_ID, operation: "blind-editorial-review", source }, null, 2));
  process.exit(0);
}

const young = name === "bedtime";
const band = young ? "3-5" as const : "6-8" as const;
const length = opt("--length", "short") as "short" | "medium" | "long";
if (!["short", "medium", "long"].includes(length)) throw new Error("Invalid length.");
const avatars = [
  { id: "fictional-nora", name: "Nora", age: young ? 5 : 8, description: "Neugierig, praktisch, manchmal vorschnell. Plant gern und muss Ben zu Wort kommen lassen." },
  { id: "fictional-ben", name: "Ben", age: young ? 5 : 8, description: "Beobachtet genau, stellt kurze Fragen, trockener Humor. Möchte mitentscheiden." },
];
let candidates: NonNullable<ReturnType<typeof toCastCandidate>>[] = [{ id: "fictional-bo", name: "Bo Bücherfuchs", species: "fox", whoTheyAre: "Ein Fuchs, der in seiner kleinen Waldbibliothek wohnt.", personality: ["bedacht", "eigenwillig"], speechStyle: ["trocken", "knappe Rückfragen"], quirk: "Ordnet Lesezeichen, auch wenn gerade keine Bücher da sind", catchphrase: "Eine gute Frage braucht kein Lesezeichen.", physicalDescription: "Ein roter Fuchs mit Brille und blauer Büchertasche." }];
let poolProvenance: Record<string, string> | undefined;
if (args.includes("--pool")) {
  const file = resolve(opt("--pool", ""));
  const bytes = await readFile(file);
  const records = JSON.parse(bytes.toString("utf8"));
  if (!Array.isArray(records)) throw new Error("Expected an exported pool array.");
  const names = name === "bedtime" ? ["Morpheus", "Lumi Nachtlicht", "Bo Bücherfuchs"]
    : name === "fairytale" ? ["Die Nebelhexe", "Hexe Griselda", "Hexe Kräuterweis"]
    : ["Kobold Kicher", "Pip", "Bäcker Braun"];
  candidates = names.map(name => {
    const row = records.find((row: any) => row.name === name && row.isActive && row.imageUrl);
    const candidate = row && toCastCandidate(row);
    if (!candidate) throw new Error(`Missing test character: ${name}`);
    return candidate;
  });
  poolProvenance = { file, sha256: createHash("sha256").update(bytes).digest("hex") };
}
const config: any = {
  avatarIds: avatars.map(a => a.id), storybookMode: true, storybookEngine: EPISODE_PIPELINE_ID,
  genre: name === "fairytale" ? "fairy_tales" : "magic", setting: name === "fairytale" ? "fantasy" : "forest",
  ageGroup: band, length, language: "de", humorLevel: young ? 1 : 2, suspenseLevel: young ? 0 : 1,
  emotionalFlavors: young ? ["warmherzigkeit"] : ["lachfreude", "warmherzigkeit"],
  requireHappyEnd: true, avatarIsHero: !args.includes("--pool-lead"), allowRhymes: false,
  aiProvider: "openrouter", openRouterModel: "openai/gpt-6.1-sol",
  customPrompt: young ? "Eine leise, geborgene Geschichte vor dem Einschlafen. Keine Gefahr, kein Erschrecken und kein Zeitdruck. Ein kleines, sofort verständliches Wunder und etwas zum Schmunzeln."
    : name === "fairytale" ? "Ein richtiges, lustiges Märchen mit einem sichtbaren Wunder, einem eigenwilligen Gegenspieler und einem überraschenden guten Ende. Keine grausamen Strafen, kein Fest und keine Prophezeiung."
    : "Ein lustiges magisches Abenteuer. Ein Wunder mit einer verständlichen Regel, eigenwillige Figuren, ein stiller Moment und ein überraschender Schlussgag. Beide Kinder sollen wichtig werden. Kein Fest und keine Prophezeiung.",
};
const brief = buildBrief({ config, band, budget: episodeBudget(length, band), heroes: avatars, candidates, artifacts: [], seed: opt("--seed", `talea-folge-quality-${name}-2026-10-26`) });
const input = { config, avatars, poolCharacters: candidates };
const promptSource = (await Promise.all(["engine.ts", "prompts.ts", "cast-focus.ts", "craft.ts"].map(file => readFile(resolve("backend/story/episode", file), "utf8")))).join("\n");
const manifest = { pipeline: EPISODE_PIPELINE_ID, operation: "generation", mode: "one-shot", fixture: name, seed: brief.seed,
  avatarIsHero: config.avatarIsHero, poolProvenance, inputSHA256: createHash("sha256").update(JSON.stringify(input)).digest("hex"),
  pipelineSHA256: createHash("sha256").update(promptSource).digest("hex"), effort,
  focusPrompt: beforeWantAnchor ? "before-want-anchor" : "current",
  transport: "codex-chatgpt-plan", writer: "gpt-6.1-sol", reviewModels: ["gpt-6-luna", "gpt-6.1-sol"], imagesGenerated: 0, databaseCalls: 0 };
await writeFile(join(out, "manifest.json"), JSON.stringify(manifest, null, 2));
await writeFile(join(out, "input.json"), JSON.stringify(input, null, 2));
await writeFile(join(out, "brief.json"), JSON.stringify(brief, null, 2));
await writeFile(join(out, "pipeline-source.txt"), promptSource);
if (args.includes("--dry")) {
  const { oneShotSystemPrompt, oneShotUserPrompt } = await import("../../backend/story/episode/prompts");
  await writeFile(join(out, "request.json"), JSON.stringify({ system: oneShotSystemPrompt(brief), user: authorUser(oneShotUserPrompt(brief)) }, null, 2));
  console.log(JSON.stringify(manifest));
  process.exit(0);
}
const ledger = new CostLedger();
const started = Date.now();
try {
  const result = await runEpisodeTextEngine({ brief, llm, ledger, models: { writer: "openai/gpt-6.1-sol", support: "openai/gpt-6-luna", critic: "openai/gpt-6-luna" },
    options: { mode: "one-shot", writeEffort: effort as "low" | "medium" | "high" },
    observe: async (stage, payload) => { await writeFile(join(out, `${stage}.json`), JSON.stringify(payload, null, 2)); },
  });
  if (result.engineIds.length !== 1 || result.engineIds[0] !== EPISODE_PIPELINE_ID) throw new Error("Wrong pipeline executed.");
  const words = result.pages.map(p => countWords(p.content));
  await writeFile(join(out, "result.json"), JSON.stringify({ ...manifest, result, words, calls, seconds: Math.round((Date.now() - started) / 1000), stages: ledger.all(), usage: ledger.totals() }, null, 2));
  await writeFile(join(out, "story.md"), `# ${result.title}\n\n${result.description}\n\n${result.pages.map(p => `## ${p.title}\n\n${p.content}`).join("\n\n")}\n`);
  await rm(join(out, "failure.json"), { force: true });
  console.log(JSON.stringify({ pipeline: EPISODE_PIPELINE_ID, mode: result.episode.mode, title: result.title, words, checks: result.episode.checks, calls, out }));
} catch (error) {
  await writeFile(join(out, "failure.json"), JSON.stringify({ ...manifest, error: String(error), calls, stages: ledger.all() }, null, 2));
  throw error;
}
