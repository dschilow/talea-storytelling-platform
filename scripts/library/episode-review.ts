/**
 * Counter-reader for a hand-written Originals episode: GPT-6.1 Sol reads it with
 * the pipeline's own series context and score sheet (8 dimensions + canon
 * checks) plus a child check — what a 6-year-old does not understand, which
 * jokes fall flat, where it drags, where the magic rules break.
 *
 *   bun --env-file=.env.local run scripts/library/episode-review.ts --series bruno-der-flunkerfisch --episode 3 --file draft.txt [options]
 *
 *   --file <path>         the draft: "KAPITEL 1: Titel" blocks, paragraphs separated by a blank line
 *   --provider openai     call OpenAI directly (OPENAI_API_KEY) instead of OpenRouter (OPENROUTER_API_KEY)
 *   --provider codex      run Sol through the Codex CLI (`codex exec`): the ChatGPT subscription, no API key, no per-token bill
 *   --codex-bin <path>    Codex CLI to use (default: CODEX_BIN, else `codex` on PATH; the npm build may be too old for Sol 6.1,
 *                         the Codex desktop app ships a current one in …\WindowsApps\OpenAI.Codex_*\app\resources\codex.exe)
 *   --model <id>          default gpt-6.1-sol (OpenRouter: openai/gpt-6.1-sol)
 *   --effort <level>      reasoning effort, default medium (high ≈ 2× the price, measured 2026-10-21: 0.16–0.23 $ vs 0.10 $)
 *   --revise              Sol also rewrites the episode: fixes every mustFix itself and returns the complete text
 *                         (written to <out>.txt); the author still decides what to keep
 *   --max-words <n>       word ceiling for the revision (default 1950; the seed test rejects 2100 and more)
 *   --out <path>          JSON result (default: next to the draft, <draft>.review.json)
 *
 * Canon = the seeded episodes before the target (summaries + facts, plus every earlier
 * episode in full with its collectible). Sol grades hard: 7 = good, 8 = very good; the
 * review is a hole-finder for the author, not a release gate.
 */

import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSeriesContext, parseChapters, SCORE_DIMENSIONS, type EpisodeBrief } from "../../backend/story/library/engine";
import { SEED_EPISODES, SEED_SEASONS, SEED_SERIES } from "../../backend/story/library/seed";

const args = process.argv.slice(2);
const option = (name: string) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const seriesId = option("--series") || "bruno-der-flunkerfisch";
const episode = Number(option("--episode") || 0);
const file = option("--file");
const providerOption = option("--provider");
const provider = providerOption === "openai" ? "openai" : providerOption === "codex" ? "codex" : "openrouter";
const model = (option("--model") || "gpt-6.1-sol").replace(/^openai\//, "");
const effort = option("--effort") || "medium";
const revise = args.includes("--revise");
const maxWords = Number(option("--max-words") || 1950);
if (!file || !episode) throw new Error("--file and --episode are required.");
const out = option("--out") || file.replace(/\.[^.]+$/, "") + ".review.json";

const key = provider === "openai" ? process.env.OPENAI_API_KEY : provider === "openrouter" ? process.env.OPENROUTER_API_KEY : "subscription";
if (!key) throw new Error(`${provider === "openai" ? "OPENAI_API_KEY" : "OPENROUTER_API_KEY"} is not set (bun --env-file=.env.local …).`);

const seed = SEED_SERIES.find((entry) => entry.series.id === seriesId);
const season = SEED_SEASONS.find((entry) => entry.seriesId === seriesId && entry.season === 1);
const plan = season?.episodes.find((entry) => entry.episode === episode);
if (!seed || !plan) throw new Error(`No season plan for ${seriesId} episode ${episode}.`);
const next = season!.episodes.find((entry) => entry.episode === episode + 1);
const earlier = SEED_EPISODES.filter((entry) => entry.seriesId === seriesId && entry.episode < episode).sort((a, b) => a.episode - b.episode);
const brief: EpisodeBrief = {
  series: seed.series,
  bible: seed.bible,
  target: { season: 1, episode, title: plan.title, logline: plan.logline, fields: plan.plan, clue: plan.clue, next: next ? { title: next.title, logline: next.logline } : null },
  canon: earlier.map((entry) => ({
    season: entry.season,
    episode: entry.episode,
    title: entry.title,
    summary: entry.summary,
    facts: entry.canonFactsAdded,
  })),
};

const chapters = parseChapters(readFileSync(file, "utf8"));
if (chapters.length !== 3) throw new Error(`Expected 3 chapters, found ${chapters.length}.`);
const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

const system = [
  "You are the demanding editor of a top German children's book publisher AND you test every text on real 6-year-olds in your head. You read one episode of a series and judge it honestly. Answer with ONE JSON object.",
  "Calibration: 10 = could be printed unchanged in the best series on the market; 9 = excellent, at most one tiny polish; 7–8 = good but generic or with a real flaw; 5–6 = clear problems; below 5 = broken.",
  "A score of 9 or 10 needs a reason you can quote from the text. Logic gaps (who is where, why something works), chance solutions, characters out of character, moralising, a missing season clue or a broken invariant cap the related dimension at 7.",
  "The teaser line for the next episode and the collectible card are stored separately and shown after the text: never ask for the teaser inside the text.",
  "Be a hole-finder: hunt for every sentence a 6–8-year-old would not understand, every joke that does not land, every stretch that drags, every logic gap in the magic rules. Do not be polite — a vague or generous review is useless.",
  "",
  buildSeriesContext(brief),
  ...(earlier.length ? [
    "",
    "FULL TEXT OF EVERY EARLIER EPISODE — this is canon: whatever happens there (including details missing from the fact lists) is established. The last one is the exact state the new episode continues from.",
    ...earlier.map((entry) => [
      `=== S1E${entry.episode} „${entry.title}“ ===`,
      entry.chapters.map((chapter, index) => `KAPITEL ${index + 1}: ${chapter.title}\n${chapter.text}`).join("\n\n"),
      `Sammelobjekt (${entry.collectible.title}): ${entry.collectible.fields.map((field) => `${field.label}: ${field.value}`).join(" | ")}`,
    ].join("\n")),
  ] : []),
].join("\n");

const dimensions = SCORE_DIMENSIONS.map((d) => `"${d.key}": {"score": 0-10, "why": "German, with a short quote"}  // ${d.label}: ${d.question}`).join(",\n  ");
const revisionRequest = revise
  ? [
      "",
      "AFTER THE REVIEW, REVISE THE EPISODE YOURSELF (field \"revision\"):",
      "- Fix every mustFix and every real logic gap directly in the text. Keep the author's plot, voice, figures' speech styles and every joke that works; do not rewrite what is good. Change as little as needed, but as much as needed.",
      "- Sharpen jokes that land only halfway, simplify sentences a 6-year-old would stumble over, cut stretches that drag. Maximum humour, maximum clarity, professional finish.",
      `- Hard limits: exactly 3 chapters with the markers „KAPITEL 1: Titel“, „KAPITEL 2: …“, „KAPITEL 3: …“; paragraphs separated by one blank line; ${maxWords} words or fewer in total; no teaser in the text; German typographic quotes „…“.`,
      "- The series ritual stays in the story as in the earlier episodes (Flunker-Karte pinned / Steckbrief written, Grimmbach's entry, running gags); only the card's fields and the teaser are stored separately.",
      "- Do not shorten for its own sake: a working joke, image or beat is worth its words as long as the limit holds.",
      "- In \"changes\" list every change you made (German, one line each, with the old and the new wording where it matters).",
    ].join("\n")
  : "";
const user = [
  `THIS EPISODE: Season 1, episode ${episode}: „${plan.title}“`,
  `Planned logline: ${plan.logline}`,
  `Planned details:\n${Object.entries(plan.plan).map(([field, value]) => `- ${field}: ${value}`).join("\n")}`,
  `Season clue of this episode (plant it casually, never explain it): ${plan.clue}`,
  "",
  "EPISODE TEXT:",
  chapters.map((chapter, index) => `KAPITEL ${index + 1}: ${chapter.title}\n${chapter.text}`).join("\n\n"),
  revisionRequest,
  "",
  "JSON:",
  `{"canonChecks": [{"quote": "German sentence from the text that touches an earlier canon fact, rule or invariant", "fact": "the fact/rule", "agrees": true}] (check EVERY such sentence),`,
  ` "dimensions": {\n  ${dimensions}\n},`,
  ` "kinderCheck": {`,
  `   "verstaendlichkeit": {"score": 0-10, "stolpersteine": [{"quote": "…", "warum": "why a 6-year-old stumbles", "vorschlag": "simpler German wording"}]},`,
  `   "humor": {"score": 0-10, "witze": [{"quote": "…", "zuendet": "ja|halb|nein", "warum": "German", "besser": "German, only if not ja"}]},`,
  `   "unterhaltung": {"score": 0-10, "durchhaenger": [{"stelle": "quote or chapter", "warum": "German", "vorschlag": "German"}]},`,
  `   "logikLuecken": [{"quote": "…", "problem": "German", "fix": "German"}],`,
  `   "schulhofSatz": "the one line kids will retell",`,
  `   "staerksteMomente": ["German"]`,
  ` },`,
  ` "mustFix": ["German: concrete problem with a quote → what exactly has to change"],`,
  ` "notes": ["German: what is especially good and must be kept"],`,
  revise ? ` "revision": {"changes": ["German"], "text": "KAPITEL 1: …\\n\\n…"},` : "",
  ` "gesamtnote": 0-10}`,
].filter((line) => line !== "").join("\n");

const started = Date.now();
let text = "";
let usage: { cost: number | null; prompt?: number; completion?: number; model: string } = { cost: null, model };

if (provider === "codex") {
  const bin = option("--codex-bin") || process.env.CODEX_BIN || "codex";
  const work = mkdtempSync(join(tmpdir(), "talea-sol-review-"));
  const answer = join(work, "answer.json");
  const prompt = [
    "This is an editorial task, not a coding task. Do not run commands, do not read or write files and do not browse: everything you need is in this message.",
    "Your final message must be exactly one JSON object (no Markdown fence, no text before or after it).",
    "",
    "=== ROLE AND SERIES CONTEXT ===",
    system,
    "",
    "=== TASK ===",
    user,
  ].join("\n");
  writeFileSync(join(work, "prompt.txt"), prompt);
  const proc = Bun.spawn([
    bin, "exec", "-m", model, "-c", `model_reasoning_effort="${effort}"`,
    "--sandbox", "read-only", "--skip-git-repo-check", "--ephemeral", "--ignore-rules",
    "-C", work, "-o", answer, "-",
  ], { stdin: new TextEncoder().encode(prompt), stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, exitCode] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  writeFileSync(join(work, "codex.log"), `${stdout}\n--- stderr ---\n${stderr}`);
  if (exitCode !== 0) throw new Error(`codex exec failed (${exitCode}), log: ${join(work, "codex.log")}\n${stderr.slice(-800)}`);
  text = readFileSync(answer, "utf8");
  const tokens = /tokens used[^\d]*([\d.,]+)/i.exec(stdout + stderr)?.[1];
  usage = { cost: null, model: `${model} (codex)`, completion: tokens ? Number(tokens.replace(/[.,]/g, "")) : undefined };
} else {
  const messages = [{ role: "system", content: system }, { role: "user", content: user }];
  const maxTokens = revise ? 48000 : 24000;
  const request = provider === "openai"
    ? { url: "https://api.openai.com/v1/chat/completions", body: { model, messages, max_completion_tokens: maxTokens, response_format: { type: "json_object" }, reasoning_effort: effort } }
    : { url: "https://openrouter.ai/api/v1/chat/completions", body: { model: `openai/${model}`, messages, max_tokens: maxTokens, response_format: { type: "json_object" }, reasoning: { effort }, usage: { include: true } } };
  const response = await fetch(request.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(900_000),
    body: JSON.stringify(request.body),
  });
  const data: any = await response.json();
  if (!response.ok) throw new Error(`${provider} ${response.status}: ${JSON.stringify(data?.error || data).slice(0, 400)}`);
  text = data?.choices?.[0]?.message?.content || "";
  usage = { cost: data?.usage?.cost ?? null, prompt: data?.usage?.prompt_tokens, completion: data?.usage?.completion_tokens, model: data?.model || model };
}

const review = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
const revised = revise && typeof review?.revision?.text === "string" ? parseChapters(review.revision.text) : [];
review._meta = {
  provider,
  model: usage.model,
  effort,
  costUSD: usage.cost,
  tokens: { prompt: usage.prompt, completion: usage.completion },
  seconds: Math.round((Date.now() - started) / 1000),
  words: chapters.map((chapter) => words(chapter.text)),
  ...(revised.length ? { revisedWords: revised.map((chapter) => words(chapter.text)) } : {}),
};
writeFileSync(out, JSON.stringify(review, null, 2));
if (revised.length) writeFileSync(out.replace(/\.json$/, "") + ".txt", revised.map((chapter, index) => `KAPITEL ${index + 1}: ${chapter.title}\n\n${chapter.text}`).join("\n\n") + "\n");

const kids = review.kinderCheck || {};
const total = (list: number[] | undefined) => (list || []).reduce((sum, value) => sum + value, 0);
const lines = [
  `Gesamtnote ${review.gesamtnote}/10 — Verständlich ${kids.verstaendlichkeit?.score}, Humor ${kids.humor?.score}, Unterhaltung ${kids.unterhaltung?.score}`,
  ...SCORE_DIMENSIONS.map((d) => `  ${d.label}: ${review.dimensions?.[d.key]?.score}`),
  "",
  "Kanon-Widersprüche:",
  ...(review.canonChecks || []).filter((check: any) => check?.agrees === false).map((check: any) => `  - „${check.quote}“ → ${check.fact}`),
  "Logiklücken:",
  ...(kids.logikLuecken || []).map((gap: any) => `  - „${gap.quote}“ → ${gap.problem} | Fix: ${gap.fix}`),
  "Muss geändert werden:",
  ...(review.mustFix || []).map((item: string) => `  - ${item}`),
  `Schulhof-Satz: ${kids.schulhofSatz || "–"}`,
  ...(revised.length ? ["", `Überarbeitung: ${revised.length} Kapitel, ${total(review._meta.revisedWords)} Wörter (vorher ${total(review._meta.words)}) → ${out.replace(/\.json$/, "")}.txt`, ...(review.revision.changes || []).map((change: string) => `  · ${change}`)] : revise ? ["", "Überarbeitung fehlt oder hat keine Kapitelmarken."] : []),
  "",
  `${review._meta.model}, ${effort}: ${review._meta.costUSD != null ? `$${Number(review._meta.costUSD).toFixed(3)}` : review._meta.tokens.completion ? `${review._meta.tokens.completion} Tokens` : "Abo-Kontingent"}, ${review._meta.seconds} s → ${out}`,
];
console.log(lines.join("\n"));
