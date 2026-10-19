import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { openRouterPort } from "./openrouter-port";
import { planProblems } from "../../backend/story/wonder/checks";
import { planReviewPrompt, setupRepairPrompt } from "../../backend/story/wonder/prompts";
import { parseJsonObject } from "../../backend/story/storybook/llm";
import type { StoryBrief } from "../../backend/story/storybook/context";
import type { WonderPlan } from "../../backend/story/wonder/types";

// Explicit paid regression probe: repair a recorded plan's deliberately broken
// chapter references and ask the independent reader to check the resulting plan.
const args = process.argv.slice(2);
const opt = (name: string) => args[args.indexOf(name) + 1];
if (!args.includes("--source") || !args.includes("--out")) throw new Error("Usage: bun scripts/wonder-story/repair-probe.ts --source <run-directory> --out <new-directory>");
const source = resolve(opt("--source")), out = resolve(opt("--out"));
await mkdir(out, { recursive: true });
const saved = JSON.parse(await readFile(join(source, "result.json"), "utf8"));
const brief: StoryBrief = JSON.parse(await readFile(join(source, "brief.json"), "utf8"));
const original: WonderPlan = saved.result.wonder.plan;
const packageIds = original.packageId ? [original.packageId] : [];
const broken = { ...original, setups: original.setups.map(s => ({ ...s, paysOffOnPage: s.plantedOnPage })) };
const errors = planProblems(broken, brief, packageIds);
if (!errors.length || !errors.every(e => e.startsWith("setups"))) throw new Error("Probe must break only setup references.");
const llm = openRouterPort(out, 2);
const repaired = await llm({ stage: "wonder-plan-setups-repair", ...setupRepairPrompt(broken, brief.budget.pages, errors),
  role: "writer", model: "openai/gpt-6.1-sol", json: true, maxTokens: 1600, effort: "low", timeoutMs: 90_000 });
const patch = parseJsonObject<{ setups: WonderPlan["setups"] }>(repaired.text);
const plan = { ...original, setups: patch?.setups };
const remaining = planProblems(plan, brief, packageIds);
if (remaining.length) throw new Error(remaining.join(" "));
const read = await llm({ stage: "wonder-plan-read", ...planReviewPrompt(brief, plan as WonderPlan),
  role: "critic", model: "google/gemini-3.8-flash", json: true, maxTokens: 2000, effort: "low", timeoutMs: 90_000 });
const verdict = parseJsonObject<{ issues: string[]; keep: string[] }>(read.text);
const passed = Array.isArray(verdict?.issues) && verdict.issues.length === 0;
const result = { passed, deliberatelyInjectedFault: "Every setup paid off in its introduction chapter.", originalErrors: errors, repairedSetups: plan.setups,
  unchangedFields: "All fields except setups retain the saved values.", verdict, durationMs: repaired.durationMs + read.durationMs,
  costUSD: repaired.usage.costUSD + read.usage.costUSD, models: [repaired.modelUsed, read.modelUsed] };
await writeFile(join(out, "probe-result.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
if (!passed) process.exitCode = 1;
