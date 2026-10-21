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
 *   --model <id>          default gpt-6.1-sol (OpenRouter: openai/gpt-6.1-sol)
 *   --effort <level>      reasoning effort, default medium (high ≈ 2× the price, measured 2026-10-21: 0.16–0.23 $ vs 0.10 $)
 *   --out <path>          JSON result (default: next to the draft, <draft>.review.json)
 *
 * Canon = the seeded episodes before the target. Sol grades hard: 7 = good, 8 =
 * very good; the review is a hole-finder for the author, not a release gate.
 */

import { readFileSync, writeFileSync } from "node:fs";
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
const provider = option("--provider") === "openai" ? "openai" : "openrouter";
const model = (option("--model") || "gpt-6.1-sol").replace(/^openai\//, "");
const effort = option("--effort") || "medium";
if (!file || !episode) throw new Error("--file and --episode are required.");
const out = option("--out") || file.replace(/\.[^.]+$/, "") + ".review.json";

const key = provider === "openai" ? process.env.OPENAI_API_KEY : process.env.OPENROUTER_API_KEY;
if (!key) throw new Error(`${provider === "openai" ? "OPENAI_API_KEY" : "OPENROUTER_API_KEY"} is not set (bun --env-file=.env.local …).`);

const seed = SEED_SERIES.find((entry) => entry.series.id === seriesId);
const season = SEED_SEASONS.find((entry) => entry.seriesId === seriesId && entry.season === 1);
const plan = season?.episodes.find((entry) => entry.episode === episode);
if (!seed || !plan) throw new Error(`No season plan for ${seriesId} episode ${episode}.`);
const next = season!.episodes.find((entry) => entry.episode === episode + 1);
const brief: EpisodeBrief = {
  series: seed.series,
  bible: seed.bible,
  target: { season: 1, episode, title: plan.title, logline: plan.logline, fields: plan.plan, clue: plan.clue, next: next ? { title: next.title, logline: next.logline } : null },
  canon: SEED_EPISODES.filter((entry) => entry.seriesId === seriesId && entry.episode < episode).map((entry) => ({
    season: entry.season,
    episode: entry.episode,
    title: entry.title,
    summary: entry.summary,
    facts: entry.canonFactsAdded,
  })),
};

const chapters = parseChapters(readFileSync(file, "utf8"));
if (chapters.length !== 3) throw new Error(`Expected 3 chapters, found ${chapters.length}.`);

const system = [
  "You are the demanding editor of a top German children's book publisher AND you test every text on real 6-year-olds in your head. You read one episode of a series and judge it honestly. Answer with ONE JSON object.",
  "Calibration: 10 = could be printed unchanged in the best series on the market; 9 = excellent, at most one tiny polish; 7–8 = good but generic or with a real flaw; 5–6 = clear problems; below 5 = broken.",
  "A score of 9 or 10 needs a reason you can quote from the text. Logic gaps (who is where, why something works), chance solutions, characters out of character, moralising, a missing season clue or a broken invariant cap the related dimension at 7.",
  "The teaser line for the next episode and the collectible card are stored separately and shown after the text: never ask for the teaser inside the text.",
  "Be a hole-finder: hunt for every sentence a 6–8-year-old would not understand, every joke that does not land, every stretch that drags, every logic gap in the magic rules. Do not be polite — a vague or generous review is useless.",
  "",
  buildSeriesContext(brief),
].join("\n");

const dimensions = SCORE_DIMENSIONS.map((d) => `"${d.key}": {"score": 0-10, "why": "German, with a short quote"}  // ${d.label}: ${d.question}`).join(",\n  ");
const user = [
  `THIS EPISODE: Season 1, episode ${episode}: „${plan.title}“`,
  `Planned logline: ${plan.logline}`,
  `Planned details:\n${Object.entries(plan.plan).map(([field, value]) => `- ${field}: ${value}`).join("\n")}`,
  `Season clue of this episode (plant it casually, never explain it): ${plan.clue}`,
  "",
  "EPISODE TEXT:",
  chapters.map((chapter, index) => `KAPITEL ${index + 1}: ${chapter.title}\n${chapter.text}`).join("\n\n"),
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
  ` "gesamtnote": 0-10}`,
].join("\n");

const messages = [{ role: "system", content: system }, { role: "user", content: user }];
const request = provider === "openai"
  ? { url: "https://api.openai.com/v1/chat/completions", body: { model, messages, max_completion_tokens: 24000, response_format: { type: "json_object" }, reasoning_effort: effort } }
  : { url: "https://openrouter.ai/api/v1/chat/completions", body: { model: `openai/${model}`, messages, max_tokens: 24000, response_format: { type: "json_object" }, reasoning: { effort }, usage: { include: true } } };

const started = Date.now();
const response = await fetch(request.url, {
  method: "POST",
  headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  signal: AbortSignal.timeout(600_000),
  body: JSON.stringify(request.body),
});
const data: any = await response.json();
if (!response.ok) throw new Error(`${provider} ${response.status}: ${JSON.stringify(data?.error || data).slice(0, 400)}`);
const text: string = data?.choices?.[0]?.message?.content || "";
const review = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
review._meta = {
  provider,
  model: data?.model || model,
  effort,
  costUSD: data?.usage?.cost ?? null,
  tokens: { prompt: data?.usage?.prompt_tokens, completion: data?.usage?.completion_tokens },
  seconds: Math.round((Date.now() - started) / 1000),
  words: chapters.map((chapter) => chapter.text.split(/\s+/).filter(Boolean).length),
};
writeFileSync(out, JSON.stringify(review, null, 2));

const kids = review.kinderCheck || {};
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
  "",
  `${review._meta.model}, ${effort}: ${review._meta.costUSD != null ? `$${Number(review._meta.costUSD).toFixed(3)}` : `${review._meta.tokens.completion} Ausgabe-Tokens`}, ${review._meta.seconds} s → ${out}`,
];
console.log(lines.join("\n"));
