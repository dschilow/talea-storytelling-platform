/**
 * Live test of the library episode pipeline — no database, no Encore. Runs the
 * same code as the admin button: blueprint → writer → scorer (→ revision) →
 * finalizer → pictures (FLUX 3 Image Klein).
 *
 *   bun --env-file=.env.local run scripts/library/episode-live-test.ts --series bruno-der-flunkerfisch --episode 2 [options]
 *
 *   --idea "…"          the editor's own idea for the episode
 *   --no-images         text only
 *   --out Logs/library/live/<tag>
 *
 * Canon = the seeded episodes before the target. Output: episode.md (readable,
 * with scores and costs), episode.json, pictures as files.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CostLedger, retryRequestFor, serviceTierTimeoutMs, withServiceTier, type LlmCallResult, type StorybookLlm } from "../../backend/story/storybook/llm";
import { acceptsTemperature, extractStorybookChoiceContent, isTruncatedFinishReason, resolveStorybookReasoning } from "../../backend/story/storybook/llm-guards";
import { generateEpisodeText, LIBRARY_MODELS, SCORE_DIMENSIONS, type EpisodeBrief } from "../../backend/story/library/engine";
import { createRunwareCaller } from "../../backend/story/library/images";
import { illustrateEpisode } from "../../backend/story/library/production";
import { chapterImages } from "../../backend/story/library/image-slots";
import { SEED_EPISODES, SEED_SEASONS, SEED_SERIES } from "../../backend/story/library/seed";

const ROOT = join(import.meta.dir, "..", "..");
const args = process.argv.slice(2);
const option = (name: string) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const seriesId = option("--series") || "bruno-der-flunkerfisch";
const episodeNumber = Number(option("--episode") || 2);
const idea = option("--idea") || null;
const withImages = !args.includes("--no-images");
const out = join(ROOT, option("--out") || `Logs/library/live/${seriesId}-s1e${episodeNumber}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}`);

const openRouterKey = process.env.OPENROUTER_API_KEY || "";
const runwareKey = process.env.RUNWARE_API_KEY || "";
if (!openRouterKey) throw new Error("OPENROUTER_API_KEY is not set (bun --env-file=.env.local …).");

/** OpenRouter port with the production retry policy (same as llm-openrouter.ts, but with the env key). */
const llm: StorybookLlm = async (request) => {
  const once = async (model: string, req = request): Promise<LlmCallResult> => {
    const started = Date.now();
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openRouterKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(serviceTierTimeoutMs(req.timeoutMs ?? 180_000, req.serviceTier)),
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: req.system }, { role: "user", content: req.user }],
        max_tokens: req.maxTokens,
        ...(req.json ? { response_format: { type: "json_object" } } : {}),
        ...(acceptsTemperature(model) && req.temperature !== undefined ? { temperature: req.temperature } : {}),
        reasoning: resolveStorybookReasoning(model, req.effort, req.role),
        ...(req.serviceTier ? { service_tier: req.serviceTier } : {}),
        usage: { include: true },
      }),
    });
    const data: any = await response.json();
    if (!response.ok) throw new Error(`OpenRouter ${response.status}: ${JSON.stringify(data?.error || data).slice(0, 300)}`);
    const choice = data?.choices?.[0];
    const text = extractStorybookChoiceContent(choice);
    const result: LlmCallResult = {
      text,
      modelUsed: data?.model || model,
      usage: {
        prompt: Number(data?.usage?.prompt_tokens) || 0,
        completion: Number(data?.usage?.completion_tokens) || 0,
        total: Number(data?.usage?.total_tokens) || 0,
        costUSD: Number(data?.usage?.cost) || 0,
        cachedPromptTokens: Number(data?.usage?.prompt_tokens_details?.cached_tokens) || 0,
      },
      durationMs: Date.now() - started,
      finishReason: choice?.finish_reason,
      serviceTier: data?.service_tier,
    };
    if (!text) throw Object.assign(new Error(`Empty response from ${model} (${req.stage}, completion_tokens=${result.usage.completion})`), { billed: result });
    if (isTruncatedFinishReason(choice?.finish_reason)) throw Object.assign(new Error(`Truncated response from ${model} (${req.stage})`), { billed: result });
    return result;
  };
  try {
    return await once(request.model);
  } catch (error) {
    if ((error as any)?.billed) ledger.recordCall(`${request.stage}-failed`, (error as any).billed, request.role);
    const retry = retryRequestFor(request, error);
    console.warn(`  ${request.stage}: ${(error as Error).message} → retry with ${retry.model}`);
    return { ...(await once(retry.model, retry.request)), fallbackFrom: request.model };
  }
};

const ledger = new CostLedger();
const { series, bible } = SEED_SERIES.find((entry) => entry.series.id === seriesId)!;
const season = SEED_SEASONS.find((entry) => entry.seriesId === seriesId)!;
const plan = season.episodes.find((entry) => entry.episode === episodeNumber)!;
const next = season.episodes.find((entry) => entry.episode === episodeNumber + 1);
const canon = SEED_EPISODES.filter((entry) => entry.seriesId === seriesId && entry.episode < episodeNumber)
  .map((entry) => ({ season: entry.season, episode: entry.episode, title: entry.title, summary: entry.summary, facts: entry.canonFactsAdded }));
const brief: EpisodeBrief = {
  series,
  bible,
  canon,
  target: { season: 1, episode: episodeNumber, title: plan.title, logline: plan.logline, fields: plan.plan, clue: plan.clue, idea, next: next ? { title: next.title, logline: next.logline } : null },
};

mkdirSync(out, { recursive: true });
const started = Date.now();
console.log(`Writing ${series.title} S1E${episodeNumber} „${plan.title}“ → ${out}`);
const draft = await generateEpisodeText(brief, withServiceTier(llm, "flex"), ledger, (step) => console.log(`  · ${step} (${Math.round((Date.now() - started) / 1000)} s)`));
let content = draft.content;
let imageCost = 0;
let issues: string[] = [];

if (withImages && runwareKey) {
  console.log("  · pictures");
  const illustrated = await illustrateEpisode(content, {
    style: bible.imageStyleEn,
    characters: bible.characters,
    keyPrefix: `s1e${episodeNumber}`,
    ports: {
      call: createRunwareCaller(runwareKey),
      // Seed pictures live in frontend/public, pictures of this run (guest portraits) in the output folder.
      load: async (url) =>
        url.startsWith("/") ? readFileSync(join(ROOT, "frontend", "public", url)) : /^https?:/.test(url) ? Buffer.from(await (await fetch(url)).arrayBuffer()) : readFileSync(join(out, url)),
      store: async (imageUrl, key) => {
        const file = `${key.split("/").pop()}.webp`;
        writeFileSync(join(out, file), Buffer.from(await (await fetch(imageUrl)).arrayBuffer()));
        return file;
      },
    },
  });
  content = illustrated.content;
  imageCost = illustrated.costUSD;
  issues = illustrated.issues;
}

const totals = ledger.totals();
const words = content.chapters.reduce((sum, chapter) => sum + chapter.text.split(/\s+/).length, 0);
const md = [
  `# ${content.title}`,
  `${series.title} · Staffel 1, Folge ${episodeNumber}${idea ? ` · Idee: ${idea}` : ""}`,
  "",
  `> ${content.summary}`,
  "",
  `**Scorer** (${LIBRARY_MODELS.critic}, ${draft.writes} Fassung(en), ${draft.scores.passed ? "bestanden" : "NICHT bestanden"}): ` +
    SCORE_DIMENSIONS.map((dimension) => `${dimension.label} ${draft.scores.dimensions[dimension.key]}`).join(" · "),
  draft.scores.mustFix.length ? `\nOffen laut Scorer:\n${draft.scores.mustFix.map((note) => `- ${note}`).join("\n")}` : "",
  `\n**Kosten:** Text $${totals.costUSD.toFixed(4)} (${totals.calls} Calls), Bilder $${imageCost.toFixed(4)} · ${words} Wörter · ${Math.round((Date.now() - started) / 1000)} s`,
  issues.length ? `\nBild-Probleme: ${issues.join("; ")}` : "",
  "",
  content.cover.url ? `![Cover](${content.cover.url})` : "",
  ...content.chapters.flatMap((chapter, index) => {
    const paragraphs = chapter.text.split(/\n\n/);
    return [`\n## Kapitel ${index + 1}: ${chapter.title}\n`, ...paragraphs.flatMap((paragraph, p) => [paragraph, ...chapterImages(chapter).filter(picture => picture.afterParagraph === p && picture.url).map((picture) => `\n![Kapitel ${index + 1}](${picture.url})\n`)]).map((line) => `${line}\n`)];
  }),
  `\n---\n**${content.collectible.title}**\n${content.collectible.fields.map((field) => `- ${field.label}: ${field.value}`).join("\n")}`,
  `\n*${content.teaser}*`,
  `\n**Kanon-Fakten:**\n${content.canonFactsAdded.map((fact) => `- ${fact}`).join("\n")}`,
  `\n**Stufen:** ${ledger.all().map((stage) => `${stage.stage} ${stage.modelUsed} $${(stage.usage?.costUSD || 0).toFixed(4)} ${Math.round((stage.durationMs || 0) / 1000)}s`).join(" | ")}`,
].join("\n");
writeFileSync(join(out, "episode.md"), md);
writeFileSync(join(out, "episode.json"), JSON.stringify({ content, scores: draft.scores, blueprint: draft.blueprint, ledger: ledger.all(), imageCost, issues }, null, 2));
console.log(`\nDone: ${draft.writes} write(s), passed=${draft.scores.passed}, text $${totals.costUSD.toFixed(4)}, pictures $${imageCost.toFixed(4)} → ${join(out, "episode.md")}`);
if (!existsSync(join(out, "episode.md"))) process.exit(1);
