/**
 * Live test for text dokus — no database, no Encore, no images.
 *
 *   bun --env-file=.env.local run scripts/doku-live-test.ts --topic "Wie wird aus Milch Käse?" [options]
 *   bun --env-file=.env.local run scripts/doku-live-test.ts --recheck Logs/doku-live/<run>/result.json
 *
 * Options:
 *   --topic "…"             required unless --recheck
 *   --age 6-8               3-5 | 6-8 | 9-12 | 13+
 *   --length medium         short | medium | long
 *   --depth standard        basic | standard | deep
 *   --perspective science   science | history | technology | nature | culture
 *   --tone curious          fun | curious | neutral
 *   --quiz 3  --activities 1
 *   --language de
 *   --model <openrouter id> default: the model the backend uses
 *   --effort low            reasoning effort (none | minimal | low | medium | high | off = send none); omit for the backend default
 *   --factcheck             run the fact check (doku-factcheck.ts) after writing, like production
 *   --recheck <result.json> only run the fact check on a saved run
 *   --prompt-module <path>  alternative prompt module (e.g. a saved legacy prompt) exporting buildOpenRouterPayload
 *   --out Logs/doku-live/<name>
 *
 * Output: doku.md (readable, with quiz answers and stats) and result.json.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { applyFactCheck, buildFactCheckPayload, parseFactCheckIssues, resolveFactCheckModel } from "../backend/doku/doku-factcheck";

const args = process.argv.slice(2);
const option = (name: string, fallback?: string) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : fallback;
};
const flag = (name: string) => args.includes(name);

const openRouterKey = process.env.OPENROUTER_API_KEY || process.env.OpenRouterAPIKey || "";
if (!openRouterKey) throw new Error("OPENROUTER_API_KEY is not set — no provider called.");

async function callOpenRouter(input: { model: string; effort?: string; messages: unknown; maxTokens: number }) {
  const body: Record<string, unknown> = {
    model: input.model,
    messages: input.messages,
    max_tokens: input.maxTokens,
    response_format: { type: "json_object" },
    usage: { include: true },
  };
  if (input.effort && input.effort !== "off") {
    body.reasoning = { effort: input.effort, exclude: true };
    body.include_reasoning = false;
  }
  const started = Date.now();
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openRouterKey}`, "X-Title": "Talea doku live test" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(300_000),
  });
  const raw = await response.text();
  const seconds = (Date.now() - started) / 1000;
  if (!response.ok) throw new Error(`OpenRouter ${response.status}: ${raw.slice(0, 400)}`);
  const data = JSON.parse(raw);
  return {
    data,
    seconds,
    content: String(data.choices?.[0]?.message?.content || ""),
    finish: data.choices?.[0]?.finish_reason as string | undefined,
    cost: Number(data.usage?.cost ?? 0),
  };
}

async function runFactCheck(doku: any, config: any, writerModel: string) {
  const checker = resolveFactCheckModel(writerModel);
  checker.effort = (option("--check-effort", checker.effort) as typeof checker.effort);
  const payload = buildFactCheckPayload(doku, config);
  const result = await callOpenRouter({ model: checker.model, effort: checker.effort, messages: payload.messages, maxTokens: payload.maxTokens });
  let issues: any[] = [];
  try {
    issues = parseFactCheckIssues(JSON.parse(result.content.replace(/```json\s*|\s*```/g, "").trim()));
  } catch {
    console.warn(`fact check returned unparseable JSON (finish=${result.finish})`);
  }
  const outcome = applyFactCheck(doku, issues);
  return { model: checker.model, effort: checker.effort, seconds: result.seconds, cost: result.cost, issues, outcome };
}

function renderMarkdown(doku: any, header: string[], factCheck?: Awaited<ReturnType<typeof runFactCheck>>): string {
  const words = (text: unknown) => String(text || "").split(/\s+/).filter(Boolean).length;
  const sections: any[] = Array.isArray(doku.sections) ? doku.sections : [];
  const quizItems = sections.flatMap((section) => (section?.interactive?.quiz?.enabled ? section.interactive.quiz.questions || [] : []));
  const answerSpread = quizItems.reduce((acc: Record<string, number>, q: any) => {
    acc[String(q.answerIndex)] = (acc[String(q.answerIndex)] || 0) + 1;
    return acc;
  }, {});

  const lines: string[] = [`# ${doku.title}`, ""];
  lines.push(...header.map((line) => `> ${line}`));
  lines.push(`> Wörter gesamt ${sections.reduce((sum, s) => sum + words(s.content), 0)} · pro Kapitel ${sections.map((s) => words(s.content)).join("/")} · ` +
    `Quiz-Antwortpositionen ${JSON.stringify(answerSpread)}`, "");
  if (factCheck) {
    lines.push(`**Faktencheck** (${factCheck.model} ${factCheck.effort}, ${factCheck.seconds.toFixed(1)} s, $${factCheck.cost.toFixed(4)}): ${factCheck.issues.length} Befund(e)`);
    for (const issue of factCheck.issues) lines.push(`- [${issue.ref}] ${issue.kind}: ${issue.problem}${issue.quote ? `\n  - alt: ${issue.quote}` : ""}${issue.fix ? `\n  - neu: ${issue.fix}` : ""}`);
    for (const entry of factCheck.outcome.skipped) lines.push(`- ⚠️ übersprungen [${entry.ref}]: ${entry.reason}`);
    lines.push("");
  }
  if (doku.summary) lines.push(`**Summary:** ${doku.summary}`, "");
  if (doku.hook) lines.push(`**Hook:** ${doku.hook}`, "");
  if (doku.mainQuestion) lines.push(`**Leitfrage:** ${doku.mainQuestion}`, "");
  if (doku.guess) {
    lines.push(`**Rate mal:** ${doku.guess.question}`);
    (doku.guess.options || []).forEach((entry: string, i: number) => lines.push(`- ${i === doku.guess.answerIndex ? "✅" : "▫️"} ${entry}`));
    lines.push(`Auflösung: ${doku.guess.reveal}`, "");
  }
  sections.forEach((section, index) => {
    lines.push(`## ${index + 1}. ${section.title}${section.place ? ` — 📍 ${section.place}` : ""}${section.kind ? ` [${section.kind}]` : ""}`);
    if (section.expert) lines.push(`*Fachperson: ${section.expert.role} ${section.expert.name ?? ""}*`);
    if (section.miniQuestion) lines.push(`*Mini-Frage: ${section.miniQuestion}*`);
    lines.push("", String(section.content || ""), "");
    for (const fact of section.keyFacts || []) {
      lines.push(`- 💡 **${fact.title}** — ${fact.fact}${fact.comparison ? ` _(${fact.comparison})_` : ""}${fact.whyItMatters ? ` _(Warum: ${fact.whyItMatters})_` : ""}`);
    }
    for (const q of section.interactive?.quiz?.enabled ? section.interactive.quiz.questions || [] : []) {
      lines.push("", `❓ **${q.question}** _(Skill ${q.skillType}, Schwierigkeit ${q.difficulty})_`);
      (q.options || []).forEach((entry: string, i: number) => lines.push(`- ${i === q.answerIndex ? "✅" : "▫️"} ${entry}`));
      if (q.explanation) lines.push(`  ↳ ${q.explanation}`);
    }
    for (const item of section.interactive?.activities?.enabled ? section.interactive.activities.items || [] : []) {
      lines.push("", `🧪 **${item.title}** (${item.durationMinutes ?? "?"} min; ${(item.materials || []).join(", ")})`, item.description);
      (item.steps || []).forEach((step: string, i: number) => lines.push(`  ${i + 1}. ${step}`));
      if (item.observe) lines.push(`  Beobachte: ${item.observe}`);
      if (item.safetyNote) lines.push(`  ⚠️ ${item.safetyNote}`);
    }
    if (section.sectionImagePrompt) lines.push("", `🖼️ ${section.sectionImagePrompt}`);
    lines.push("");
  });
  if (doku.twist) lines.push(`**twist:** ${doku.twist}`, "");
  for (const key of ["finale", "activity"]) {
    if (doku[key]) lines.push(`**${key}:** ${typeof doku[key] === "string" ? doku[key] : JSON.stringify(doku[key])}`, "");
  }
  if (Array.isArray(doku.recap)) {
    lines.push("**Das hab ich heute gecheckt:**");
    doku.recap.forEach((point: string) => lines.push(`- ✔️ ${point}`));
    lines.push("");
  }
  if (doku.closingLine) lines.push(`**Schlusszeile:** ${doku.closingLine}`, "");
  for (const key of ["wowFacts", "comparisons"]) {
    if (Array.isArray(doku[key])) lines.push(`**${key}:**`, ...doku[key].map((item: string) => `- ${item}`), "");
  }
  if (doku.coverImagePrompt) lines.push(`🖼️ Cover: ${doku.coverImagePrompt}`, "");
  return lines.join("\n");
}

const recheckPath = option("--recheck");
if (recheckPath) {
  const saved = JSON.parse(await readFile(recheckPath, "utf8"));
  const factCheck = await runFactCheck(saved.doku, saved.config, saved.model);
  const outDir = dirname(recheckPath);
  await writeFile(join(outDir, "doku.checked.md"), renderMarkdown(saved.doku, [`Recheck von ${saved.model}`], factCheck));
  await writeFile(join(outDir, "result.checked.json"), JSON.stringify({ ...saved, factCheck }, null, 2));
  console.log(`${outDir}: ${factCheck.issues.length} Befund(e), ${factCheck.outcome.applied.length} angewendet · ${factCheck.seconds.toFixed(1)} s · $${factCheck.cost.toFixed(4)}`);
  process.exit(0);
}

const topic = option("--topic");
if (!topic) throw new Error("--topic is required");

const promptModulePath = option("--prompt-module");
const promptModule: any = promptModulePath
  ? await import(pathToFileURL(resolve(promptModulePath)).href)
  : await import("../backend/doku/doku-prompt");

const config: any = {
  topic,
  ageGroup: option("--age", "6-8"),
  depth: option("--depth", "standard"),
  perspective: option("--perspective", "science"),
  tone: option("--tone", "curious"),
  length: option("--length", "medium"),
  includeInteractive: true,
  quizQuestions: Number(option("--quiz", "3")),
  handsOnActivities: Number(option("--activities", "1")),
  language: option("--language", "de"),
};

const payload = promptModule.buildDokuPayload
  ? promptModule.buildDokuPayload(config)
  : promptModule.buildOpenRouterPayload(config);
const model = option("--model", payload.model || "google/gemini-3.1-flash-lite")!;
const effort = option("--effort", payload.reasoningEffort);
const outDir = option("--out", `Logs/doku-live/${Date.now()}`)!;
await mkdir(outDir, { recursive: true });

const writer = await callOpenRouter({ model, effort, messages: payload.messages, maxTokens: payload.maxTokens });
let parsed: any;
try {
  parsed = JSON.parse(writer.content.replace(/```json\s*|\s*```/g, "").trim());
} catch {
  await writeFile(join(outDir, "raw.txt"), writer.content);
  throw new Error(`Unparseable JSON (finish=${writer.finish}, ${writer.content.length} chars) — raw written to ${outDir}/raw.txt`);
}
const doku = promptModule.normalizeDokuOutput ? promptModule.normalizeDokuOutput(parsed, config) : parsed;
const factCheck = flag("--factcheck") ? await runFactCheck(doku, config, model) : undefined;

const header = [
  `Modell ${model}${effort ? ` (${effort})` : ""} · ${writer.seconds.toFixed(1)} s · finish ${writer.finish} · ` +
    `Tokens ${writer.data.usage?.prompt_tokens}/${writer.data.usage?.completion_tokens} · Kosten $${writer.cost.toFixed(4)}`,
];
await writeFile(join(outDir, "doku.md"), renderMarkdown(doku, header, factCheck));
await writeFile(join(outDir, "result.json"), JSON.stringify({ config, model, effort, seconds: writer.seconds, usage: writer.data.usage, finish: writer.finish, doku, factCheck }, null, 2));
const total = writer.cost + (factCheck?.cost ?? 0);
console.log(`${outDir}: ${doku.title} · ${(writer.seconds + (factCheck?.seconds ?? 0)).toFixed(1)} s · $${total.toFixed(4)} · finish ${writer.finish}` +
  (factCheck ? ` · Faktencheck ${factCheck.issues.length} Befund(e), ${factCheck.outcome.applied.length} angewendet` : ""));
