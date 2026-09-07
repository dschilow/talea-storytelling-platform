/** Local research/evaluation entry point. No DB writes and no image spend.
 * bun run scripts/book-workshop.ts audit
 * bun run scripts/book-workshop.ts generate --input brief.json --output result.json [--live]
 * Input is a BookBrief, or {config, heroes, candidates?, artifacts?}.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { normalizeArtifacts, normalizePeople } from "../backend/story/book-workshop/catalog";
import { makeBrief, writerModel } from "../backend/story/book-workshop/brief";
import { generateBook } from "../backend/story/book-workshop/engine";
import { readingBudget } from "../backend/story/book-workshop/contracts";
import { planPrompt } from "../backend/story/book-workshop/prompts";
import { openRouterTransport, resolvePrices, VERIFIED_PRICES } from "../backend/story/book-workshop/openrouter";
import { reserveCost } from "../backend/story/book-workshop/budget";
import type { BookBrief } from "../backend/story/book-workshop/types";

const args = process.argv.slice(2);
const option = (name: string) => { const at = args.indexOf(name); return at >= 0 ? args[at + 1] : undefined; };
const read = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const save = async (path: string, data: unknown) => { await mkdir(dirname(resolve(path)), { recursive: true }); await writeFile(path, JSON.stringify(data, null, 2) + "\n", "utf8"); };

if (args[0] === "audit") {
  const people = await read(option("--characters") || "Logs/talea-characters-2026-08-10T08-13-38-438Z.json");
  const artifacts = await read(option("--artifacts") || "Logs/talea-artifacts-2026-04-27T11-18-00-036Z.json");
  const story = await read(option("--story") || "Logs/alexanders-kniffliger-segelschlitten-e4e9b41e-logs.json");
  const counts = new Map<string, number>();
  people.forEach((p: any) => counts.set(p.name, (counts.get(p.name) || 0) + 1));
  const report = {
    sourceStoryId: story.storyId,
    characters: { entries: people.length, normalizedUnique: normalizePeople(people).length, duplicateNames: [...counts].filter(([, n]) => n > 1), missingBackstory: people.filter((p: any) => !p.backstory).length },
    artifacts: { entries: artifacts.length, usableRules: normalizeArtifacts(artifacts, "de").length },
    stageComplete: story.logs.find((e: any) => e.metadata?.stage === "complete")?.response,
    recordedCosts: story.logs.find((e: any) => e.source === "story-generation-costs")?.response?.costs,
    qualification: "Provider costs and image estimates must be distinguished. This audit does not assign literary scores.",
  };
  const output = option("--output") || "Logs/book-workshop-audit/dna-and-costs.json";
  await save(output, report);
  console.log(JSON.stringify({ characters: report.characters.entries, uniqueCharacters: report.characters.normalizedUnique, duplicates: report.characters.duplicateNames.length, artifacts: report.artifacts.entries, costs: report.recordedCosts, output }, null, 2));
} else if (args[0] === "generate") {
  const path = option("--input");
  if (!path) throw new Error("Provide --input with a local BookBrief or Wizard fixture");
  const input = await read(path);
  const brief: BookBrief = input.config ? makeBrief(input.config, normalizePeople(input.heroes, false), input.seed || "local-evaluation", {
    candidates: normalizePeople(input.candidates || []), artifacts: normalizeArtifacts(input.artifacts || [], input.config.language || "de"), blockedTerms: input.blockedTerms || [], recentPremises: input.recentPremises || [],
  }) : input;
  const writer = option("--writer") || (input.config ? writerModel(input.config) : "moonshotai/kimi-k2.6");
  const reviewer = option("--reviewer") || (writer === "openai/gpt-5.6-luna" ? "google/gemini-3.1-flash-lite" : "openai/gpt-5.6-luna");
  const output = option("--output") || "Logs/book-workshop-audit/workshop-result.json";
  if (!args.includes("--live")) {
    const prompt = planPrompt(brief), price = VERIFIED_PRICES[reviewer];
    await save(output, { mode: "dry-run", budget: readingBudget(brief), writer, reviewer, prompt, firstStageReservationUSD: price ? reserveCost(price, prompt.system, prompt.user, 1800) : null, liveCharges: 0 });
    console.log(`Dry run written to ${output}. No provider called. Add --live to generate.`);
  } else {
    const key = process.env.OPENROUTER_API_KEY || process.env.ENCORE_SECRET_OPENROUTERAPIKEY || process.env.OpenRouterAPIKey;
    if (!key) throw new Error("OPENROUTER_API_KEY is not configured; no provider called");
    const result = await generateBook(brief, { writer, reviewer, prices: await resolvePrices([writer, reviewer]), transport: openRouterTransport(key), textBudgetUSD: Number(option("--budget") || "0.03") });
    await save(output, result);
    if (result.manuscript) await writeFile(output.replace(/\.json$/i, "") + ".md", [result.manuscript.title, ...result.manuscript.pages.map(p => `Seite ${p.order}\n\n${p.text}`)].join("\n\n"), "utf8");
    console.log(JSON.stringify({ status: result.status, textCostUSD: result.textCostUSD, providerTextCostUSD: result.providerTextCostUSD,
      estimatedTextCostUSD: result.estimatedTextCostUSD, reservedUnknownUSD: result.reservedUnknownUSD,
      accountingComplete: result.accountingComplete, calls: result.receipts.length, issues: result.issues, output }, null, 2));
    if (result.status !== "accepted") process.exitCode = 1;
  }
} else {
  console.log("Usage: bun run scripts/book-workshop.ts audit | generate --input fixture.json [--live] [--budget 0.03] [--output result.json]");
}
