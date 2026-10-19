import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fixture } from "../../backend/story/wonder/fixtures";
import { codexPort } from "./codex-port";
import { openRouterPort, withReplay } from "./openrouter-port";
import { CostLedger } from "../../backend/story/storybook/llm";
import { runWonderTextEngine } from "../../backend/story/wonder/engine";
import { countWords } from "../../backend/story/storybook/checks";
import { planPrompt } from "../../backend/story/wonder/prompts";
import { selectWonderPackages } from "../../backend/story/wonder/library";

const args = process.argv.slice(2);
const opt = (name: string, fallback: string) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const name = opt("--case", "magic");
if (!["magic", "space", "realistic", "dragon", "bedtime"].includes(name)) throw new Error("Unknown fixture.");
const length = opt("--length", "medium");
if (!["short", "medium", "long"].includes(length)) throw new Error("Invalid length.");
const out = resolve(opt("--out", `Logs/wonder-story/${name}-${Date.now()}`));
const provider = opt("--provider", "codex");
if (!["codex", "openrouter"].includes(provider)) throw new Error("Invalid provider.");
await mkdir(out, { recursive: true });
const brief = fixture(name, length as "short" | "medium" | "long");
await writeFile(join(out, "brief.json"), JSON.stringify(brief, null, 2));
if (args.includes("--dry")) {
  await writeFile(join(out, "plan-prompt.json"), JSON.stringify(planPrompt(brief, selectWonderPackages(brief)), null, 2));
  console.log(`Dry run: ${out}`);
} else {
  const ledger = new CostLedger();
  const model = provider === "codex" ? "gpt-6.1-sol" : "openai/gpt-6.1-sol";
  const critic = provider === "codex" ? model : "google/gemini-3.8-flash";
  let llm = provider === "codex" ? codexPort(out, model) : openRouterPort(out);
  const source = opt("--resume-from", "");
  if (source) llm = await withReplay(llm, resolve(source), out);
  try {
    const result = await runWonderTextEngine({ brief, ledger, llm, models: { writer: model, support: model, critic },
      observe: async (stage, data) => { await writeFile(join(out, `${stage}.json`), JSON.stringify(data, null, 2)); },
    });
    await writeFile(join(out, "result.json"), JSON.stringify({ transport: provider, replaySource: source || null, criticModel: critic, result, stages: ledger.all(), usage: ledger.totals() }, null, 2));
    await writeFile(join(out, "story.md"), `# ${result.title}\n\n${result.description}\n\n${result.pages.map(p => `## ${p.title}\n\n${p.content}`).join("\n\n")}\n`);
    console.log(JSON.stringify({ out, title: result.title, words: result.pages.reduce((n, p) => n + countWords(p.content), 0), chosen: result.chosen, usage: ledger.totals(), billing: provider === "codex" ? "Codex subscription quota; no OpenRouter calls" : "OpenRouter; replayed stages have no new charge", caveat: "Editorial model checks do not replace testing with children." }));
  } catch (error) {
    await writeFile(join(out, "failure.json"), JSON.stringify({ error: (error as Error).message, usage: ledger.totals(), stages: ledger.all() }, null, 2));
    throw error;
  }
}
