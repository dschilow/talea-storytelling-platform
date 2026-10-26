/** Actual pure text engines, identical fictional inputs, Codex quota only. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { buildBrief } from "../../backend/story/storybook/context";
import { resolveLengthBudget } from "../../backend/story/storybook/craft";
import { CostLedger } from "../../backend/story/storybook/llm";
import { runEpisodeTextEngine } from "../../backend/story/episode/engine";
import { episodeBudget } from "../../backend/story/episode/craft";
import { runWonderTextEngine } from "../../backend/story/wonder/engine";
import { wonderBudget } from "../../backend/story/wonder/library";
import { runStorybookTextEngine } from "../../backend/story/storybook/engine";
import { generateBook } from "../../backend/story/book-workshop/engine";
import { makeBrief } from "../../backend/story/book-workshop/brief";
import { normalizePeople } from "../../backend/story/book-workshop/catalog";
import { planBook, writeBook, resolveBookPlanner, bookBatchRanges } from "../../backend/story/storybook/book/engine";
import { bookLengthBudget, resolveBookBudget } from "../../backend/story/storybook/book/budget";
import { fixture, SEED } from "./fixture";
import { quotaPort } from "./port";
import { runUnifiedTextEngine } from "../../backend/story/unified/engine";

const args = process.argv.slice(2);
const opt = (name: string, fallback: string) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const lane = opt("--lane", "episode");
const out = resolve(opt("--out", `Logs/pipeline-bakeoff/2026-10-26/${lane}`));
await mkdir(out, { recursive: true });
const input = await fixture(args.includes("--young"));
const writer = opt("--writer", "openai/gpt-6.1-sol");
const models = { writer, support: "openai/gpt-6-luna", critic: writer.includes("luna") ? "openai/gpt-6.1-sol" : "openai/gpt-6-luna" };
const port = await quotaPort(out, lane === "chapterbook" ? 90 : 45);
const ledger = new CostLedger();
const budget = lane === "episode" || lane === "unified" && !args.includes("--picture-book") ? episodeBudget("short", input.config.ageGroup) : lane === "wonder" ? wonderBudget("short", input.config.ageGroup) : resolveLengthBudget("short", input.config.ageGroup);
const brief = buildBrief({ config: input.config, heroes: input.heroes, candidates: input.candidates, artifacts: [], band: input.config.ageGroup, budget, seed: SEED });
const observe = async (stage: string, payload: unknown) => { await writeFile(join(out, `${stage}.json`), JSON.stringify(payload, null, 2)); };
if (lane === "unified") {
  const files = ["unified/engine.ts", "unified/prompts.ts", "unified/craft.ts", "unified/review.ts", "episode/engine.ts", "episode/prompts.ts", "episode/craft.ts", "episode/cast-focus.ts", "storybook/context.ts", "storybook/oneshot-prompt-en.ts"];
  const sources = await Promise.all(files.map(async file => { const source = await readFile(`backend/story/${file}`, "utf8"); return { file, sha256: createHash("sha256").update(source).digest("hex"), source }; }));
  await writeFile(join(out, "candidate-source.json"), JSON.stringify(sources, null, 2));
}
await writeFile(join(out, "input.json"), JSON.stringify(input, null, 2));
await writeFile(join(out, "manifest.json"), JSON.stringify({ lane, seed: SEED, models, transport: "codex-chatgpt-plan", images: 0, databaseCalls: 0, inputSHA256: createHash("sha256").update(JSON.stringify(input)).digest("hex"), sourceRevision: Bun.spawnSync(["git", "rev-parse", "HEAD"]).stdout.toString().trim(), caveat: "Same model family for all calls. Format-specific production budgets. One exploratory sample per lane, not a statistical ranking." }, null, 2));
const started = Date.now();
try {
  let result: any;
  let pages: Array<{ order: number; title?: string; content: string }>;
  if (lane === "workshop") {
    const wb = makeBrief(input.config, normalizePeople(input.heroes), SEED, { candidates: normalizePeople(input.rows) });
    let count = 0;
    result = await generateBook(wb, { writer, reviewer: models.critic, prices: Object.fromEntries([writer, models.critic].map(m => [m, { inputPerMillion: 0, outputPerMillion: 0 }])), textBudgetUSD: 1, timeoutMs: 420_000,
      transport: async r => {
        const response = await port.llm({ stage: `workshop-${++count}`, role: r.model === writer ? "writer" : "support", model: r.model, system: r.system, user: r.user + (r.jsonSchema ? `\nJSON SCHEMA:\n${JSON.stringify(r.jsonSchema.schema)}` : ""), json: true, effort: "low", maxTokens: r.maxTokens, timeoutMs: 420_000 });
        return { text: response.text, model: response.modelUsed, promptTokens: response.usage.prompt, completionTokens: response.usage.completion, costUSD: 0, finishReason: "stop" };
      }, onCheckpoint: r => observe("checkpoint", r) });
    if (!result.manuscript) throw new Error(`No manuscript: ${result.issues.join("; ")}`);
    pages = result.manuscript.pages.map((p: any) => ({ order: p.order, title: `Seite ${p.order}`, content: p.text }));
    result.title = result.manuscript.title; result.description = result.manuscript.description;
  } else if (lane === "chapterbook") {
    const book = resolveBookBudget(input.config.ageGroup, { chapters: 8, imagesPerChapter: 1 });
    const bb: any = { ...brief, budget: bookLengthBudget(book), book, form: "funny", catalogue: input.candidates.map(c => ({ ...c, recentUses: 0, hasImage: true })), bookExperiment: { ...resolveBookPlanner("openai/gpt-6-luna", "low") } };
    const ctx = { brief: bb, llm: port.llm, ledger, models, observe };
    const planned = await planBook(ctx);
    await observe("planned-book", planned);
    let state: import("../../backend/story/storybook/book/types").BookState = { chapters: [], facts: [], knowledge: [], curve: [], openIssues: [], openThreads: [], worldState: [], wordings: [] };
    for (const [, to] of bookBatchRanges(planned.brief)) {
      state = await writeBook(ctx, planned, state, to);
      await observe("book-checkpoint", { state, completed: state.chapters.length, total: book.chapters });
      await writeFile(join(out, "partial-story.md"), `# ${planned.plan.title}\n\nUnvollständiger Zwischenstand: ${state.chapters.length}/${book.chapters} Kapitel.\n\n${state.chapters.map(p => `## ${p.title}\n\n${p.content}`).join("\n\n")}\n`);
    }
    result = { title: planned.plan.title, description: planned.plan.logline, planned, state }; pages = state.chapters;
  } else {
    const engine = lane === "unified" ? (i: any) => runUnifiedTextEngine({ ...i, format: args.includes("--picture-book") ? "picture-book" : "read-aloud" }) : lane === "episode" ? runEpisodeTextEngine : lane === "wonder" ? runWonderTextEngine : lane === "storybook" ? runStorybookTextEngine : null;
    if (!engine) throw new Error(`Unknown lane ${lane}`);
    result = await engine({ brief, llm: port.llm, models, ledger, observe }); pages = result.pages;
  }
  const words = pages.map(p => p.content.trim().split(/\s+/).length);
  await writeFile(join(out, "result.json"), JSON.stringify({ lane, result, pages, words, calls: port.calls(), seconds: Math.round((Date.now() - started) / 1000), stages: ledger.all() }, null, 2));
  await writeFile(join(out, "story.md"), `# ${result.title}\n\n${result.description || ""}\n\n${pages.map(p => `## ${p.title || `Teil ${p.order}`}\n\n${p.content}`).join("\n\n")}\n`);
  console.log(JSON.stringify({ lane, title: result.title, words, status: result.status || result.textQuality?.status, calls: port.calls(), out }));
} catch (error) { await observe("failure", { error: String(error), calls: port.calls(), stages: ledger.all() }); throw error; }
