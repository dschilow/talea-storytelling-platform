/**
 * Text-only live test of the Talea-Folge engine — no database, no Encore, no pictures.
 *
 *   bun --env-file=.env.local run scripts/episode/run.ts --genre magic --age 6-8 --length medium --flavors lachfreude --out Logs/episode/m1
 *
 * Options: --mode one-shot|two-step (default TALEA_EPISODE_MODE, else one-shot)
 *          --genre --setting --age --length --flavors a,b --wish "…" --brought <artifactId> --learning science
 *          --twist --rhymes --famous --moral --writer openai/gpt-6.1-sol --planner openai/gpt-6-luna
 *          --plan-effort low --write-effort low --flex --hero-file Logs/test-heroes-alexander-adrian.json
 *          --history <json {stories: []}> --seed <seed> --max-calls 6 --allow-openrouter
 *
 * Sol and Luna run over api.openai.com with OPENAI_API_KEY; OpenRouter only with --allow-openrouter.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { normalizeAgeBand } from "../../backend/story/storybook/craft";
import { buildBrief } from "../../backend/story/storybook/context";
import { CostLedger } from "../../backend/story/storybook/llm";
import { selectRewardArtifacts, shortlistCastCandidates, toArtifactOption } from "../../backend/story/storybook/cast-selection";
import { countWords } from "../../backend/story/storybook/checks";
import { episodeBudget } from "../../backend/story/episode/craft";
import { runEpisodeTextEngine } from "../../backend/story/episode/engine";
import { createTestPort } from "./openai-port";

const args = process.argv.slice(2);
const option = (name: string, fallback?: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const flag = (name: string) => args.includes(name);

const pool: any[] = JSON.parse(await readFile(option("--characters", "Logs/talea-characters-2026-08-10T08-13-38-438Z.json")!, "utf8"));
const artifactRows: any[] = JSON.parse(await readFile(option("--artifacts", "Logs/talea-artifacts-2026-04-27T11-18-00-036Z.json")!, "utf8"));
const heroes: any[] = JSON.parse(await readFile(option("--hero-file", "Logs/test-heroes-alexander-adrian.json")!, "utf8"));

const flavors = (option("--flavors", "lachfreude") || "").split(",").filter(Boolean);
const learningSubjects = (option("--learning", "") || "").split(",").map((s) => s.trim()).filter(Boolean);
const genre = option("--genre", "magic")!;
const config: any = {
  avatarIds: heroes.map((hero) => hero.id),
  genre,
  setting: option("--setting", genre === "fairy_tales" ? "fantasy" : "varied"),
  ageGroup: option("--age", "6-8"),
  length: option("--length", "medium"),
  language: option("--language", "de"),
  // Same mapping as the wizard: humour and suspense follow the chosen feelings.
  humorLevel: flavors.includes("lachfreude") ? 2 : 1,
  suspenseLevel: flavors.includes("prickeln") ? 2 : 1,
  emotionalFlavors: flavors,
  requireHappyEnd: true,
  requireMoral: flag("--moral") || undefined,
  hasTwist: flag("--twist") || undefined,
  allowRhymes: flag("--rhymes"),
  allowFamousCharacters: flag("--famous") || undefined,
  avatarIsHero: true,
  customPrompt: option("--wish"),
  learningMode: learningSubjects.length ? { enabled: true, subjects: learningSubjects, difficulty: "beginner", learningObjectives: [], assessmentType: "interactive" } : undefined,
  aiProvider: "openrouter",
  openRouterModel: option("--writer", "openai/gpt-6.1-sol"),
};
const band = normalizeAgeBand(config.ageGroup);
const budget = episodeBudget(config.length, band);
const seed = option("--seed", `episode-${Date.now()}`)!;
const candidates = shortlistCastCandidates({ rows: pool, genre: config.genre, setting: config.setting, band, excludeNames: new Set(heroes.map((hero) => String(hero.name).toLocaleLowerCase("de-DE"))), seed });
const broughtId = option("--brought");
const artifacts = broughtId
  ? [{ ...toArtifactOption(artifactRows.find((row) => row.id === broughtId), config.language)!, broughtBy: heroes[0].id }]
  : selectRewardArtifacts({ rows: artifactRows, genre: config.genre, excludeIds: new Set(), seed, language: config.language });
const historyPath = option("--history");
const history: { stories?: string[] } = historyPath ? JSON.parse(await readFile(historyPath, "utf8")) : {};
const brief = buildBrief({ config, band, budget, heroes, candidates, artifacts, seed, recentStories: history.stories });

const out = option("--out", join("Logs", "episode", new Date().toISOString().replace(/[:.]/g, "-")))!;
await mkdir(out, { recursive: true });
const writer = option("--writer", "openai/gpt-6.1-sol")!;
const models = { writer, support: "openai/gpt-6-luna", critic: "openai/gpt-6-luna" };
console.log(`▶ Talea-Folge → ${out}`);
console.log(`  ${genre} | ${band} | ${config.length} (${budget.pages} chapters, ${budget.totalWordsMin}–${budget.totalWordsMax} words) | ${flavors.join(", ")}`);
console.log(`  heroes ${heroes.map((hero) => hero.name).join(", ")} | pool ${candidates.map((c) => c.name).join(", ")}`);
console.log(`  artifacts ${artifacts.map((a) => a.name).join(", ") || "—"}`);

if (flag("--dry")) {
  const { planSystemPrompt, planUserPrompt, writerSystemPrompt } = await import("../../backend/story/episode/prompts");
  await writeFile(join(out, "plan-prompt.md"), `# SYSTEM\n\n${planSystemPrompt(brief)}\n\n# USER\n\n${planUserPrompt(brief)}\n`);
  await writeFile(join(out, "writer-system.md"), writerSystemPrompt(brief));
  console.log(`Dry run: prompts in ${out}`);
  process.exit(0);
}

const llm = createTestPort({ out, maxCalls: Number(option("--max-calls", "6")), allowOpenRouter: flag("--allow-openrouter"), serviceTier: flag("--flex") ? "flex" : undefined });
const ledger = new CostLedger();
const started = Date.now();
try {
  const result = await runEpisodeTextEngine({
    llm, brief, models, ledger,
    observe: async (stage, payload) => { await writeFile(join(out, `${stage}.json`), JSON.stringify(payload, null, 2)); },
    options: { mode: option("--mode") as any, plannerModel: option("--planner"), planEffort: option("--plan-effort") as any, writeEffort: option("--write-effort") as any },
  });
  const words = result.pages.map((page) => countWords(page.content));
  const totals = ledger.totals();
  await writeFile(join(out, "plan.json"), JSON.stringify(result.episode.plan, null, 2));
  await writeFile(join(out, "result.json"), JSON.stringify({ config, mode: result.episode.mode, candidates: candidates.map((c) => c.name), artifacts: artifacts.map((a) => a.name), cast: result.episode.plan.cast, artifact: result.episode.plan.artifact, renamed: result.episode.renamed, words, checks: result.episode.checks, revised: result.episode.revised, stages: ledger.all(), totals, seconds: Math.round((Date.now() - started) / 1000) }, null, 2));
  await writeFile(join(out, "story.md"), `# ${result.title}\n\n_${result.description}_\n\n${result.pages.map((page) => `## ${page.title}\n\n${page.content}`).join("\n\n")}\n`);
  console.log(`■ „${result.title}“ — ${words.join("+")} = ${words.reduce((a, b) => a + b, 0)} words, ${totals.calls} calls, $${totals.costUSD.toFixed(4)}, ${Math.round((Date.now() - started) / 1000)} s`);
  if (result.episode.checks.hard.length || result.episode.checks.soft.length) console.log("  checks:", JSON.stringify(result.episode.checks));
} catch (error) {
  await writeFile(join(out, "failure.json"), JSON.stringify({ error: String((error as Error)?.message || error), stages: ledger.all(), totals: ledger.totals() }, null, 2));
  console.error("✗", (error as Error)?.message || error, `— spent $${llm.spent().toFixed(4)}`);
  process.exit(1);
}
