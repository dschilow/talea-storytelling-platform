/**
 * Replay of the critic roles on SAVED books — no new story is written.
 *
 *   bun --env-file=.env.local run scripts/support-model-replay.ts [--reps 1] [--only critique|plan]
 *
 * Question: can a cheaper model replace gemini-3.8-flash ($0.75/$3.75) as chapter critic and
 * plan reviewer? Same prompts and parsers as the engine, saved material of earlier runs:
 *   - chapter critique: the Sol text (good), the Haiku text (known weaker), the Argon text
 *     of the same plan — a critic must tell them apart, find a real laugh and hook in the good
 *     text (every false "no laugh" costs a 2.7 ¢ rewrite) and quote them verbatim;
 *   - plan review: five saved plans, one of them known to be illogical (gemini as planner, 5/10).
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { LlmCallResult, type LlmRequest } from "../backend/story/storybook/llm";
import { acceptsTemperature, extractStorybookChoiceContent, isTruncatedFinishReason, resolveStorybookReasoning } from "../backend/story/storybook/llm-guards";
import { parseChapterCritique } from "../backend/story/storybook/book/chapters";
import { parsePlanReview } from "../backend/story/storybook/book/plan";
import { parseJsonObject } from "../backend/story/storybook/llm";
import { buildChapterCritiquePrompt, buildPlanReviewPrompt } from "../backend/story/storybook/book/prompts";
import { emptyBookState, type BookState } from "../backend/story/storybook/book/types";

const key = process.env.OPENROUTER_API_KEY || process.env.OpenRouterAPIKey || "";
if (!key) throw new Error("OPENROUTER_API_KEY is not set");
const args = process.argv.slice(2);
const option = (name: string, fallback?: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const reps = Number(option("--reps", "1"));
const only = option("--only");
const out = "Logs/book-v1/support-replay";
await mkdir(out, { recursive: true });

const MODELS = [
  { id: "google/gemini-3.8-flash", label: "gemini-3.8-flash (heute)", price: "0.75/3.75" },
  { id: "google/gemini-3.5-flash-lite", label: "gemini-3.5-flash-lite", price: "0.30/2.50" },
  { id: "anthropic/claude-haiku-5.5", label: "claude-haiku-5.5", price: "0.10/0.50" },
  { id: "openai/gpt-6-luna", label: "gpt-6-luna low (Sol-Familie!)", price: "0.10/0.50" },
];

async function call(request: LlmRequest, model: string): Promise<LlmCallResult & { ms: number }> {
  const started = Date.now();
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "system", content: request.system }, { role: "user", content: request.user }],
    max_tokens: request.maxTokens,
    usage: { include: true },
    reasoning: resolveStorybookReasoning(model, request.effort, request.role),
    include_reasoning: false,
    response_format: { type: "json_object" },
  };
  if (typeof request.temperature === "number" && acceptsTemperature(model)) body.temperature = request.temperature;
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "X-Title": "Talea support model replay" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(240_000),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`OpenRouter ${response.status} (${model}): ${raw.slice(0, 200)}`);
  const data = JSON.parse(raw);
  const choice = data.choices?.[0];
  const text = extractStorybookChoiceContent(choice);
  if (!text || isTruncatedFinishReason(choice?.finish_reason)) throw new Error(`${!text ? "empty" : "truncated"} (${model}, finish ${choice?.finish_reason})`);
  return {
    text, modelUsed: data.model || model, durationMs: Date.now() - started, ms: Date.now() - started, finishReason: choice?.finish_reason,
    usage: { prompt: data.usage?.prompt_tokens || 0, completion: data.usage?.completion_tokens || 0, total: data.usage?.total_tokens || 0, costUSD: Number(data.usage?.cost || 0), reasoningTokens: data.usage?.completion_tokens_details?.reasoning_tokens || 0 },
  };
}

/** The saved brief is slim (heroes as names, no cast); the prompts only need names. */
const load = async (dir: string) => {
  const run = JSON.parse(await readFile(join("Logs/book-v1", dir, "result.json"), "utf8"));
  const heroNames: string[] = (run.brief.heroes || []).map((hero: any) => (typeof hero === "string" ? hero : hero.name));
  const characters: Array<{ name: string }> = run.plan?.bible?.characters || [];
  run.brief = {
    ...run.brief,
    heroes: heroNames.map((name) => ({ name })),
    candidates: characters.filter((entry) => !heroNames.includes(entry.name)).map((entry) => ({ name: entry.name })),
  };
  return run;
};
const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);
const mean1 = (values: number[]) => avg(values).toFixed(1);
const summary: Record<string, unknown> = {};

// ---------------------------------------------------------------------------
// 1) Chapter critique
// ---------------------------------------------------------------------------
if (only !== "plan") {
  const texts = [
    { id: "sol", dir: "journey-rules-full", note: "Sol (gut)" },
    { id: "haiku", dir: "journey-haiku", note: "Haiku (schwächer)" },
    { id: "argon", dir: "journey-argon", note: "Argon" },
  ];
  type Row = { model: string; text: string; cost: number; ms: number; failed: number; humor: number[]; suspense: number[]; laugh: number; hook: number; chapters: number; noProgress: number; plants: number; mustFix: number; lang: number; unmatched: number; samples: string[] };
  const rows: Row[] = [];
  for (const model of MODELS) {
    for (const text of texts) {
      const run = await load(text.dir);
      const st: BookState = run.state || run;
      const row: Row = { model: model.id, text: text.id, cost: 0, ms: 0, failed: 0, humor: [], suspense: [], laugh: 0, hook: 0, chapters: 0, noProgress: 0, plants: 0, mustFix: 0, lang: 0, unmatched: 0, samples: [] };
      for (let rep = 0; rep < reps; rep += 1) {
        for (const from of [1, 4, 7, 10]) {
          const chapters = st.chapters.filter((chapter) => chapter.order >= from && chapter.order < from + 3);
          const before: BookState = { ...emptyBookState(), chapters: st.chapters.filter((chapter) => chapter.order < from), facts: st.facts.filter((fact) => fact.chapter < from), knowledge: st.knowledge.filter((entry) => entry.chapter < from) };
          const prompt = buildChapterCritiquePrompt(run.brief, run.plan, before, chapters);
          try {
            const result = await call({ stage: `critique-${from}`, role: "critic", model: model.id, system: prompt.system, user: prompt.user, json: true, maxTokens: 6000, effort: "low", temperature: 0.2 } as LlmRequest, model.id);
            row.cost += result.usage.costUSD; row.ms += result.ms;
            const parsed = parseChapterCritique(result.text, chapters);
            if (!parsed) { row.failed += 1; continue; }
            for (const entry of parsed.chapters) {
              row.chapters += 1; row.humor.push(entry.humor); row.suspense.push(entry.suspense);
              if (entry.laugh) row.laugh += 1;
              if (entry.hook) row.hook += 1;
              if (!entry.progress) row.noProgress += 1;
              row.plants += entry.missingPlants.length;
              if (entry.unmatched) row.unmatched += 1;
            }
            row.mustFix += parsed.mustFix.length; row.lang += parsed.languageErrors.length;
            if (text.id === "sol" && rep === 0) row.samples.push(...parsed.languageErrors.slice(0, 3).map((e) => `K${e.chapter} Sprache: „${e.quote}“ → ${e.correction}`), ...parsed.mustFix.slice(0, 2).map((m) => `K${m.chapter} Muss: ${m.problem}`));
          } catch (err) {
            row.failed += 1; console.warn(`  ! ${model.id} ${text.id} ${from}: ${(err as Error).message.slice(0, 160)}`);
          }
        }
      }
      rows.push(row);
      console.log(`${model.id.padEnd(30)} ${text.id.padEnd(6)} humor ${mean1(row.humor)} spannung ${mean1(row.suspense)} | Lacher ${row.laugh}/${row.chapters} Haken ${row.hook}/${row.chapters} (nicht im Text: ${row.unmatched}) | ohne Fortschritt ${row.noProgress} fehlende Hinweise ${row.plants} MussFix ${row.mustFix} Sprachfehler ${row.lang} | $${row.cost.toFixed(4)} ${(row.ms / 1000).toFixed(0)} s${row.failed ? ` | FEHLER ${row.failed}` : ""}`);
    }
  }
  summary.critique = rows;
  console.log("\nSol-Text, gemeldete Fehler je Modell:");
  for (const row of rows.filter((r) => r.text === "sol")) console.log(` ${row.model}:\n   ${row.samples.join("\n   ") || "—"}`);
  for (const model of MODELS) {
    const mine = rows.filter((r) => r.model === model.id);
    console.log(`Σ ${model.id.padEnd(30)} $${mine.reduce((s, r) => s + r.cost, 0).toFixed(4)} für ${mine.length * 4 * reps} Aufrufe → pro Buch (4 Aufrufe) $${(mine.reduce((s, r) => s + r.cost, 0) / (mine.length * reps)).toFixed(4)}`);
  }
}

// ---------------------------------------------------------------------------
// 2) Plan review
// ---------------------------------------------------------------------------
if (only !== "critique") {
  const plans = [
    { dir: "plan-gemini", note: "Gemini als Planer (unlogisch, 5/10)" },
    { dir: "plan-luna", note: "Luna als Planer (schwächere Lacher)" },
    { dir: "plan-journey-rules", note: "Sol, neue Regeln" },
    { dir: "plan-sol", note: "Sol, 1. Messung" },
    { dir: "plan-only-1", note: "Sol, Schmatzen" },
  ];
  const table: Array<Record<string, unknown>> = [];
  console.log("\nPlan-Lektorat (Gesamtnote | falsche Prüfpunkte | Muss | Schwächen high/alle | Kosten):");
  for (const plan of plans) {
    const run = await load(plan.dir);
    const base = run.planReview?.scores?.overall;
    console.log(`\n${plan.dir} — ${plan.note} (damalige Note ${base})`);
    const prompt = buildPlanReviewPrompt(run.brief, run.plan);
    for (const model of MODELS) {
      try {
        const result = await call({ stage: "plan-review", role: "critic", model: model.id, system: prompt.system, user: prompt.user, json: true, maxTokens: 6000, effort: "low", temperature: 0.2 } as LlmRequest, model.id);
        const review = parsePlanReview(parseJsonObject<any>(result.text));
        if (!review) { console.log(`  ${model.id.padEnd(30)} nicht lesbar`); continue; }
        const falseChecks = Object.entries(review.checks).filter(([, ok]) => ok === false).map(([name]) => name);
        console.log(`  ${model.id.padEnd(30)} ${String(review.scores.overall).padStart(4)} | ${(falseChecks.join(",") || "—").padEnd(40)} | ${review.mustFix.length} | ${review.weaknesses.filter((w) => w.severity === "high").length}/${review.weaknesses.length} | $${result.usage.costUSD.toFixed(4)}`);
        table.push({ plan: plan.dir, model: model.id, overall: review.scores.overall, falseChecks, mustFix: review.mustFix.length, weaknesses: review.weaknesses.length, cost: result.usage.costUSD });
      } catch (err) {
        console.log(`  ${model.id.padEnd(30)} FEHLER ${(err as Error).message.slice(0, 120)}`);
      }
    }
  }
  summary.plans = table;
}

await writeFile(join(out, "results.json"), JSON.stringify(summary, null, 2), "utf8");
console.log(`\n→ ${out}/results.json`);
