/**
 * Runs the production screenplay-first text engine with Codex quota.
 * bun scripts/story-quality/run.ts --out Logs/story-quality/baseline
 * bun scripts/story-quality/run.ts --smoke --out Logs/story-quality/smoke
 *
 * Only the external transport and Encore infrastructure are replaced. The
 * actual idea, planning, writing, repair and validation code runs unchanged.
 * No API key, database, image provider, or production service is contacted.
 */
import { mock } from "bun:test";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { codexPort } from "../wonder-story/codex-port";
import type { LlmCallResult, LlmRequest } from "../../backend/story/storybook/llm";

const args = process.argv.slice(2);
const option = (name: string, fallback: string) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const out = resolve(option("--out", `Logs/story-quality/${Date.now()}`));
const maxCalls = Number(option("--max-calls", "32"));
if (!Number.isInteger(maxCalls) || maxCalls < 1) throw new Error("--max-calls must be a positive integer.");
await mkdir(out, { recursive: true });

const ports = new Map<string, ReturnType<typeof codexPort>>();
const calls: Array<{ stage: string; model: string; durationMs: number; usage: LlmCallResult["usage"]; replayedFrom?: string }> = [];
const replay = new Map<string, { file: string; text: string; modelUsed: string }>();
const requestKey = (r: Pick<LlmRequest, "model" | "system" | "user" | "json" | "effort" | "maxTokens">) => JSON.stringify([r.model.replace(/^openai\//, ""), r.system, r.user, r.json, r.effort, r.maxTokens]);
if (args.includes("--resume-from")) {
  for (const model of ["gpt-6-luna", "gpt-6.1-sol"]) {
    const folder = resolve(option("--resume-from", ""), model);
    for (const file of await readdir(folder).catch(() => [] as string[])) {
      if (!file.endsWith(".request.json")) continue;
      const path = join(folder, file);
      const request = JSON.parse(await readFile(path, "utf8"));
      const textPath = path.replace(/\.request\.json$/, ".txt");
      const text = await readFile(textPath, "utf8").catch(() => "");
      if (text.trim() && request.actualModel === model) replay.set(requestKey({ ...request, model }), { file: path, text, modelUsed: model });
    }
  }
}
let nextCall = 0;
let imageCalls = 0;
let databaseCalls = 0;
const forbidden = (operation: string): never => { throw new Error(`Text-only evaluation forbids ${operation}.`); };

async function complete(request: LlmRequest): Promise<LlmCallResult> {
  if (++nextCall > maxCalls) throw new Error(`Codex call ceiling reached (${maxCalls}).`);
  const model = request.model.replace(/^openai\//, "");
  if (!["gpt-6-luna", "gpt-6.1-sol"].includes(model)) return forbidden(`model ${model}`);
  const cached = replay.get(requestKey(request));
  if (cached) {
    const response = { text: cached.text, modelUsed: cached.modelUsed, durationMs: 0, finishReason: "stop", usage: { prompt: 0, completion: 0, total: 0, costUSD: 0 } };
    calls.push({ stage: request.stage, model, durationMs: 0, usage: response.usage, replayedFrom: cached.file });
    await writeFile(join(out, "calls.json"), JSON.stringify(calls, null, 2));
    console.log(`  ${request.stage} · identical request replayed · ${model}`);
    return response;
  }
  let port = ports.get(model);
  if (!port) { port = codexPort(join(out, model), model); ports.set(model, port); }
  const response = await port(request);
  calls.push({ stage: request.stage, model, durationMs: response.durationMs, usage: response.usage });
  await writeFile(join(out, "calls.json"), JSON.stringify(calls, null, 2));
  return response;
}

if (args.includes("--smoke")) {
  for (const model of ["gpt-6-luna", "gpt-6.1-sol"]) {
    const result = await complete({ stage: "access-check", model, role: "support", system: "Return only the requested JSON.", user: 'Return exactly {"ok":true}.', json: true, maxTokens: 50, effort: "low", timeoutMs: 60_000 });
    if (JSON.parse(result.text).ok !== true) throw new Error(`Invalid access-check response from ${model}.`);
    console.log(`Access verified: ${result.modelUsed}`);
  }
  process.exit(0);
}

if (args.includes("--evaluate")) {
  const { evaluateStory } = await import("./evaluation");
  await evaluateStory(option("--evaluate", ""), out, complete);
  process.exit(0);
}

// The production provider facade keeps the exact prompts and model routing;
// this stub replaces only its HTTP call with a text-only Codex invocation.
mock.module("../../backend/story/openrouter-generation", () => ({
  DEFAULT_OPENROUTER_STORY_MODEL: "moonshotai/kimi-k2.6",
  normalizeOpenRouterModel: (model?: string) => model || "moonshotai/kimi-k2.6",
  extractOpenRouterCostUSD: () => 0,
  callOpenRouterChatCompletion: async (request: any) => {
    if (request.imageInputs?.length) return forbidden("image inputs");
    if (request.signal?.aborted) throw new Error("Pipeline request already aborted.");
    const result = await complete({
      stage: `pipeline-${String(nextCall + 1).padStart(2, "0")}`,
      model: request.model,
      role: /luna/.test(request.model) ? "support" : "writer",
      system: request.messages.filter((m: any) => m.role === "system").map((m: any) => m.content).join("\n\n"),
      user: request.messages.filter((m: any) => m.role !== "system").map((m: any) => m.content).join("\n\n"),
      json: request.responseFormat === "json_object", maxTokens: request.maxTokens,
      effort: "low", timeoutMs: 360_000,
    });
    return { model: request.model, request: {}, data: {
      model: request.model,
      choices: [{ message: { content: result.text }, finish_reason: result.finishReason }],
      usage: { prompt_tokens: result.usage.prompt, completion_tokens: result.usage.completion, total_tokens: result.usage.total, cost: 0 },
    } };
  },
}));
mock.module("encore.dev/config", () => ({ secret: () => () => forbidden("API key access") }));
mock.module("~encore/clients", () => ({ ai: { generateImage: async () => { imageCalls++; return forbidden("image generation"); } } }));
mock.module("../../backend/story/gemini-generation", () => ({ generateWithGemini: () => forbidden("Gemini"), isGeminiConfigured: () => false }));
mock.module("../../backend/story/pipeline/llm-client", () => ({ callAnthropicCompletion: () => forbidden("Anthropic") }));
mock.module("../../backend/story/db", () => ({ storyDB: new Proxy({}, { get: () => () => { databaseCalls++; return forbidden("database access"); } }) }));
mock.module("../../backend/helpers/bucket-storage", () => ({ resolveImageUrlForClient: () => forbidden("image storage") }));
mock.module("../../backend/log/logger", () => ({ logTopic: {} }));
mock.module("../../backend/helpers/pubsubTimeout", () => ({
  publishWithTimeout: async (_topic: unknown, event: any) => {
    const stage = event.metadata?.stage || event.response?.stage;
    if (stage) await writeFile(join(out, `${stage}.stage.json`), JSON.stringify(event, null, 2));
  },
}));
globalThis.fetch = (() => forbidden("HTTP calls outside Codex")) as typeof fetch;

const input = {
  config: {
    avatarIds: ["fixture-nela", "fixture-jaro"], genre: "magic", setting: "nature",
    ageGroup: option("--age", "6-8"), length: option("--length", "medium"), language: "de",
    aiProvider: "openrouter", aiModel: "openai/gpt-6.1-sol", openRouterModel: "openai/gpt-6.1-sol",
    emotionalFlavors: ["lachfreude", "prickeln"], humorLevel: 2, suspenseLevel: 1,
    requireHappyEnd: true, avatarIsHero: true, allowRhymes: false,
    customPrompt: "Ein lustiges magisches Abenteuer im verwilderten Garten. Kein Fest, keine Krone und keine Prophezeiung. Beide Kinder sollen durch unterschiedliche eigene Entscheidungen wichtig werden.",
  },
  storyId: "quality-garden-fixed-seed-2026-10-25", qualityMode: "premium", debug: true,
  primaryProfileAge: 7, disablePersistenceSideEffects: true, disableArtifactSelection: true,
  // Captured from the first baseline's actual request. Production normally
  // mixes the clock into this brief even when storyId is fixed.
  noveltyBrief: {
    seed: "ddsq5j",
    shelfPromise: "The story feels like a discoverable book on a library display, not a generic fantasy quest.",
    creativeLane: "social comedy: a rule at school, a club, a birthday, a queue, a contest, a secret job",
    emotionalEngine: "thinking a mistake ruined everything until the mistake becomes a tool",
    wonderMechanic: "a helper can only help badly until the child gives a precise instruction",
    keyMomentLens: "Wonder + Mystery: odd encounter -> pattern clue -> false explanation -> rule reveal -> earned solution",
    titleEnergy: "ordinary place + secret job",
    hardAvoidMotifs: ["Glöckchen", "Gloeckchen", "Geräusche-Fresser", "Geraeusche-Fresser", "lautlose Stadt", "müdes Kissen", "muedes Kissen", "gestohlene Geräusche", "gestohlene Geraeusche"],
    recentStories: [],
  },
  avatars: [
    { id: "fixture-nela", name: "Nela", age: 7, description: "Ein neugieriges Mädchen. Sie schaut genau hin, probiert vorsichtig aus und stellt genaue Fragen. Sie kann keine Magie.", personalityTraits: { curiosity: { value: 75 }, logic: { value: 55 }, courage: { value: 25 } }, narrativeProfile: { quirk: "Sammelt eigenartig geformte Steine", speechStyle: "kurze, genaue Fragen" } },
    { id: "fixture-jaro", name: "Jaro", age: 7, description: "Ein tatkräftiger Junge. Er probiert sofort etwas aus, improvisiert gern und gibt ungern zu, wenn er sich geirrt hat. Er kann keine Magie.", personalityTraits: { creativity: { value: 70 }, courage: { value: 65 }, persistence: { value: 50 } }, narrativeProfile: { quirk: "Erfindet Namen für seine Einfälle", speechStyle: "schnell, konkret, manchmal voreilig" } },
  ],
  poolCharacters: [
    { id: "fixture-fritzi", name: "Fritzi", species: "mole", role: "helper", physicalDescription: "Ein kleiner Maulwurf mit erdigen Pfoten.", dominantPersonality: "stolz", speechStyle: ["knapp", "nimmt Redewendungen wörtlich"], quirk: "Putzt seine Pfoten sofort nach dem Graben", catchphrase: "Unterirdisch gut." },
    { id: "fixture-tilda", name: "Tilda", species: "squirrel", role: "helper", physicalDescription: "Ein rotes Eichhörnchen.", dominantPersonality: "ungeduldig", speechStyle: ["schnell", "stellt Gegenfragen"], quirk: "Vergisst, wo sie Dinge versteckt hat" },
  ],
};
await writeFile(join(out, "input.json"), JSON.stringify(input, null, 2));
const started = Date.now();
try {
  const { generateStoryDevMode } = await import("../../backend/story/dev-mode-generation");
  const result = await generateStoryDevMode(input as any);
  if (imageCalls || databaseCalls || result.metadata.imagesGenerated || result.metadata.imageCalls) forbidden("unexpected image or database side effects");
  const words = result.chapters.map(c => c.content.trim().split(/\s+/).length);
  const report = { transport: "codex-chatgpt-plan", models: [...ports.keys()], images: imageCalls, databaseCalls, seconds: Math.round((Date.now() - started) / 1000), words, calls, result };
  await writeFile(join(out, "result.json"), JSON.stringify(report, null, 2));
  await writeFile(join(out, "story.md"), `# ${result.title}\n\n${result.description}\n\n${result.chapters.map(c => `## ${c.title}\n\n${c.content}`).join("\n\n")}\n`);
  console.log(JSON.stringify({ out, title: result.title, words: words.reduce((a, b) => a + b, 0), calls: calls.length, images: imageCalls, status: result.metadata.status, pipelineScore: result.metadata.rawQualityScore }));
} catch (error) {
  await writeFile(join(out, "failure.json"), JSON.stringify({ error: String(error), calls, imageCalls, databaseCalls }, null, 2));
  throw error;
}
