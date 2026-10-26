/** Exercises both standard and developer adapters with fixture infrastructure. */
import { mock } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fixture, SEED, NOVELTY } from "./fixture";
import { quotaPort } from "./port";
const args = process.argv.slice(2);
const lane = args.includes("--standard") ? "standard" : "developer";
const out = resolve(`Logs/pipeline-bakeoff/2026-10-26/${lane}`);
await mkdir(out, { recursive: true });
const input = await fixture();
const port = await quotaPort(out, 36);
const forbidden = (kind: string): never => { throw new Error(`Offline text test forbids ${kind}`); };
const db = { queryAll: async () => [], queryRow: async () => null, exec: async () => undefined };
mock.module("encore.dev/config", () => ({ secret: () => () => forbidden("secret access") }));
mock.module("~encore/clients", () => ({ ai: { generateImage: () => forbidden("images") } }));
mock.module("../../backend/story/db", () => ({ storyDB: db }));
mock.module("../../backend/avatar/db", () => ({ avatarDB: db }));
mock.module("../../backend/story/artifact-matcher", () => ({ artifactMatcher: { match: async () => null }, recordStoryArtifact: async () => undefined }));
mock.module("../../backend/story/artifact-treasury", () => ({ getOwnedPoolIdsUnion: async () => new Set(), loadCrownArtifactIds: async () => new Set(), loadArtifactTemplateById: async () => null, recordBroughtArtifact: async () => undefined }));
mock.module("../../backend/helpers/bucket-storage", () => ({ resolveImageUrlForClient: () => forbidden("storage") }));
mock.module("../../backend/helpers/image-proxy", () => ({ buildArtifactImageUrlForClient: async () => undefined }));
mock.module("../../backend/log/logger", () => ({ logTopic: {} }));
mock.module("../../backend/helpers/pubsubTimeout", () => ({ publishWithTimeout: async () => undefined }));
mock.module("../../backend/story/gemini-generation", () => ({ generateWithGemini: () => forbidden("Gemini"), isGeminiConfigured: () => false }));
mock.module("../../backend/story/pipeline/llm-client", () => ({ callAnthropicCompletion: () => forbidden("Anthropic") }));
let call = 0;
mock.module("../../backend/story/openrouter-generation", () => ({
  DEFAULT_OPENROUTER_STORY_MODEL: "openai/gpt-6.1-sol", normalizeOpenRouterModel: (m?: string) => m || "openai/gpt-6.1-sol", extractOpenRouterCostUSD: () => 0,
  callOpenRouterChatCompletion: async (r: any) => {
    const response = await port.llm({ stage: `screenplay-${++call}`, model: r.model, role: r.model.includes("luna") ? "support" : "writer", system: r.messages.filter((m: any) => m.role === "system").map((m: any) => m.content).join("\n\n"), user: r.messages.filter((m: any) => m.role !== "system").map((m: any) => m.content).join("\n\n"), json: r.responseFormat === "json_object", maxTokens: r.maxTokens, effort: "low", timeoutMs: 420_000 });
    return { model: r.model, request: {}, data: { model: r.model, choices: [{ message: { content: response.text }, finish_reason: "stop" }], usage: { prompt_tokens: response.usage.prompt, completion_tokens: response.usage.completion, total_tokens: response.usage.total, cost: 0 } } };
  },
}));
globalThis.fetch = (() => forbidden("HTTP outside Codex")) as typeof fetch;
await writeFile(join(out, "input.json"), JSON.stringify(input, null, 2));
await writeFile(join(out, "manifest.json"), JSON.stringify({ lane, seed: SEED, transport: "codex-chatgpt-plan", writer: "gpt-6.1-sol", support: "gpt-6-luna", images: 0, databaseCalls: 0, fixtureInfrastructure: "Empty memories, artifacts and history. Supplied canonical pool. Debug skips images; persistence disabled. Production prompts and text checks unchanged." }, null, 2));
try {
  const dev = await import("../../backend/story/dev-mode-generation");
  const generateCore = dev.generateStoryDevMode;
  const poolCharacters = input.rows.map((r: any) => ({ ...r, dominantPersonality: r.personality?.[0] || r.dominantPersonality }));
  const coreInput: any = { config: input.config, avatars: input.heroes, poolCharacters, userId: "fictional-offline", storyId: SEED, noveltyBrief: NOVELTY, primaryProfileAge: 8, qualityMode: "premium", debug: true, disableArtifactSelection: true, disablePersistenceSideEffects: true };
  let result: any;
  if (lane === "standard") {
    mock.module("../../backend/story/dev-mode-generation", () => ({ ...dev,
      generateStoryDevMode: (r: any) => generateCore({ ...r, noveltyBrief: NOVELTY, debug: true, disableArtifactSelection: true, disablePersistenceSideEffects: true }),
      pickDevModePoolCharacters: async () => poolCharacters, recordDevModePoolCharacterUsage: async () => undefined,
    }));
    const { generateStoryStandardMode } = await import("../../backend/story/standard-mode-generation");
    result = await generateStoryStandardMode(coreInput);
  } else result = await generateCore(coreInput);
  const pages = result.chapters.map((p: any, i: number) => ({ ...p, order: i + 1 }));
  await writeFile(join(out, "result.json"), JSON.stringify({ lane, result, pages, words: pages.map((p: any) => p.content.trim().split(/\s+/).length), calls: port.calls() }, null, 2));
  await writeFile(join(out, "story.md"), `# ${result.title}\n\n${result.description}\n\n${pages.map((p: any) => `## ${p.title}\n\n${p.content}`).join("\n\n")}\n`);
  console.log(JSON.stringify({ lane, title: result.title, calls: port.calls(), out }));
} catch (error) { await writeFile(join(out, "failure.json"), JSON.stringify({ error: String(error), calls: port.calls() })); throw error; }
