/**
 * Live test for the chapter book (chapter-book-v1) — no database, no Encore.
 *
 *   bun --env-file=.env.local run scripts/book-live-test.ts [options]
 *
 * Options (wizard-like):
 *   --hero-file Logs/test-heroes-alexander-adrian.json   the family's avatars (StorybookHero JSON)
 *   --heroes "Amir Sternfinder,Mina Mosaik"             or pool characters as stand-in heroes
 *   --genre fairy_tales --setting fantasy --age 6-8 --language de --flavors lachfreude,prickeln
 *   --form mystery|journey|funny|cozy                   experience form (default: derived)
 *   --chapters 12 --images-per-chapter 2
 *   --wish "…"  --learning science --objectives "a|b" --twist --famous --rhymes --moral
 *   --write-mode batch|single|whole  --batch-size 3      how many chapters one writer call writes
 *   --planner openai/gpt-6-luna                         model for pitch + plan (default: the writer)
 *   --plan-effort low|medium|high  --chapter-effort minimal|low|medium  --chapter-writer <model>
 *   --upto 6                                            stop after chapter 6 (cost sampling)
 *   --no-images | --image-chapters 3                    pictures for all chapters or only the first N
 *   --history Logs/test-history-alexander-adrian.json   recent stories of the family
 *   --plan-only                                         pitch + plan + plan review, no chapters
 *   --out Logs/book-v1/<tag>
 *
 * Output: book.html (readable, with pictures), book.md, plan.json, result.json (ledger, costs per stage).
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { normalizeAgeBand } from "../backend/story/storybook/craft";
import { buildBrief } from "../backend/story/storybook/context";
import { CostLedger, resolveStorybookModels, retryRequestFor, type LlmCallResult, type LlmRequest, type StorybookLlm } from "../backend/story/storybook/llm";
import { acceptsTemperature, extractStorybookChoiceContent, isTruncatedFinishReason, resolveStorybookReasoning } from "../backend/story/storybook/llm-guards";
import { selectRewardArtifacts, toArtifactOption, toCastCandidate } from "../backend/story/storybook/cast-selection";
import { castAppearance, describeReferenceLooks, heroAppearance, speciesFromProfile, type VisualEntity } from "../backend/story/storybook/illustration-stage";
import type { ImageProvider } from "../backend/story/storybook/images";
import { runDevelopmentStage } from "../backend/story/storybook/developments";
import { countWords } from "../backend/story/storybook/checks";
import { bookLengthBudget, resolveBookBudget, resolveExperienceForm } from "../backend/story/storybook/book/budget";
import { buildCatalogue } from "../backend/story/storybook/book/catalogue";
import { buildSeriesMemory, planBook, writeBook, type BookContext } from "../backend/story/storybook/book/engine";
import { chapterParagraphs, illustrateBatch, type BookImage } from "../backend/story/storybook/book/illustrations";
import { emptyBookState, type BookBrief, type BookState } from "../backend/story/storybook/book/types";

const PUBLIC_IMAGE_PROXY = "https://backend-2-production-3de1.up.railway.app/story/image?key=";
const args = process.argv.slice(2);
const option = (name: string, fallback?: string) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : fallback;
};
const flag = (name: string) => args.includes(name);

const openRouterKey = process.env.OPENROUTER_API_KEY || process.env.OpenRouterAPIKey || "";
const runwareKey = process.env.RUNWARE_API_KEY || process.env.RunwareApiKey || "";
if (!openRouterKey) throw new Error("OPENROUTER_API_KEY is not set — no provider called.");

function publicImageUrl(stored: string | undefined): string | undefined {
  if (!stored) return undefined;
  const bucket = stored.match(/^bucket:\/\/[^/]+\/(.+)$/);
  if (bucket) return PUBLIC_IMAGE_PROXY + encodeURIComponent(bucket[1]);
  return /^https?:/.test(stored) ? stored : undefined;
}

// --- LLM port (same semantics as backend/story/storybook/llm-openrouter.ts) ---
async function callOnce(request: LlmRequest, model: string): Promise<LlmCallResult> {
  const started = Date.now();
  const userContent: any = request.imageInputs?.length
    ? [{ type: "text", text: request.user }, ...request.imageInputs.map((url) => ({ type: "image_url", image_url: { url } }))]
    : request.user;
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "system", content: request.system }, { role: "user", content: userContent }],
    max_tokens: request.maxTokens,
    usage: { include: true },
    reasoning: resolveStorybookReasoning(model, request.effort, request.role),
    include_reasoning: false,
  };
  if (request.json) body.response_format = { type: "json_object" };
  if (typeof request.temperature === "number" && acceptsTemperature(model)) body.temperature = request.temperature;
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openRouterKey}`, "X-Title": "Talea chapter book live test" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(request.timeoutMs ?? 240_000),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`OpenRouter ${response.status} (${request.stage}, ${model}): ${raw.slice(0, 300)}`);
  const data = JSON.parse(raw);
  const choice = data.choices?.[0];
  const text = extractStorybookChoiceContent(choice);
  const result: LlmCallResult = {
    text,
    modelUsed: data.model || model,
    usage: {
      prompt: data.usage?.prompt_tokens || 0,
      completion: data.usage?.completion_tokens || 0,
      total: data.usage?.total_tokens || 0,
      costUSD: Number(data.usage?.cost || 0),
      cachedPromptTokens: data.usage?.prompt_tokens_details?.cached_tokens || 0,
      reasoningTokens: data.usage?.completion_tokens_details?.reasoning_tokens || 0,
    },
    durationMs: Date.now() - started,
    finishReason: choice?.finish_reason,
  };
  if (!text || isTruncatedFinishReason(choice?.finish_reason)) {
    const error = new Error(`${!text ? "Empty" : "Truncated"} response from ${model} (${request.stage}, finish_reason=${choice?.finish_reason || "unknown"}, completion_tokens=${result.usage.completion}, reasoning_tokens=${result.usage.reasoningTokens}).`);
    (error as any).billed = result;
    throw error;
  }
  return result;
}

const ledger = new CostLedger();
const llm: StorybookLlm = async (request) => {
  try {
    return await callOnce(request, request.model);
  } catch (err) {
    const billed = (err as any)?.billed as LlmCallResult | undefined;
    if (billed) ledger.recordCall(`${request.stage}-failed`, billed, request.role);
    const retry = retryRequestFor(request, err);
    console.warn(`  ! ${request.stage}: ${(err as Error).message} → retry with ${retry.model} (effort ${retry.request.effort || "default"})`);
    const retried = await callOnce(retry.request, retry.model);
    return retry.model === request.model ? retried : { ...retried, fallbackFrom: request.model };
  }
};

const runware: ImageProvider = async (request) => {
  if (!runwareKey) return {};
  const taskUUID = crypto.randomUUID();
  const response = await fetch("https://api.runware.ai/v1", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${runwareKey}` },
    body: JSON.stringify([{
      taskType: "imageInference", taskUUID, model: option("--image-model", "runware:400@2"),
      positivePrompt: request.prompt, negativePrompt: request.negativePrompt,
      width: request.width, height: request.height, steps: Number(option("--steps", "4")), CFGScale: 4,
      seed: request.seed, numberResults: 1, outputType: ["URL"], outputFormat: "JPEG", includeCost: true, checkNSFW: true,
      ...(request.referenceImages.length ? { inputs: { referenceImages: request.referenceImages } } : {}),
    }]),
    signal: AbortSignal.timeout(180_000),
  });
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Runware ${response.status}: ${JSON.stringify(data).slice(0, 300)}`);
  const item = (data.data || []).find((row: any) => row.taskUUID === taskUUID);
  if (item?.NSFWContent === true) return { costUSD: Number(item?.cost) || 0 };
  return { url: item?.imageURL, costUSD: Number(item?.cost) || 0 };
};

// --- Brief ---
const pool: any[] = JSON.parse(await readFile(option("--characters", "Logs/talea-characters-2026-08-10T08-13-38-438Z.json")!, "utf8"));
const artifactRows: any[] = JSON.parse(await readFile(option("--artifacts", "Logs/talea-artifacts-2026-04-27T11-18-00-036Z.json")!, "utf8"));
const heroFile = option("--hero-file", option("--heroes") ? undefined : "Logs/test-heroes-alexander-adrian.json");
const heroNames = (option("--heroes", "") || "").split(",").map((name) => name.trim()).filter(Boolean);
const heroRows = heroFile ? [] : heroNames.map((name) => pool.find((row) => row.name === name && row.imageUrl) || pool.find((row) => row.name === name));
const fileHeroes: any[] = heroFile ? JSON.parse(await readFile(heroFile, "utf8")) : [];
const heroes = heroFile ? fileHeroes : heroRows.map((row: any) => {
  const candidate = toCastCandidate(row)!;
  return {
    id: `hero-${candidate.id}`,
    name: candidate.name.split(" ")[0],
    age: row.age_category === "child" ? 8 : undefined,
    description: candidate.whoTheyAre,
    imageUrl: publicImageUrl(candidate.imageUrl),
    visualProfile: { characterType: candidate.species === "human" ? "human" : candidate.species, consistentDescriptors: [castAppearance(candidate.visualProfile, candidate.physicalDescription)] },
    narrativeProfile: { dominantPersonality: candidate.personality[0], traits: candidate.personality.slice(1, 3), quirk: candidate.quirk, catchphrase: candidate.catchphrase },
  };
});

const flavors = (option("--flavors", "lachfreude,prickeln") || "").split(",").filter(Boolean);
const learningSubjects = (option("--learning", "") || "").split(",").map((s) => s.trim()).filter(Boolean);
const config: any = {
  genre: option("--genre", "fairy_tales"),
  setting: option("--setting", option("--genre", "fairy_tales") === "fairy_tales" ? "fantasy" : "varied"),
  ageGroup: option("--age", "6-8"),
  length: "long",
  language: option("--language", "de"),
  humorLevel: Number(option("--humor", flavors.includes("lachfreude") ? "2" : "1")),
  suspenseLevel: Number(option("--suspense", flavors.includes("prickeln") ? "2" : "1")),
  emotionalFlavors: flavors,
  requireHappyEnd: !flag("--no-happy-end"),
  requireMoral: flag("--moral") || undefined,
  hasTwist: flag("--twist") || undefined,
  allowFamousCharacters: flag("--famous") || undefined,
  avatarIsHero: true,
  allowRhymes: flag("--rhymes"),
  customPrompt: option("--wish"),
  experienceForm: option("--form"),
  learningMode: learningSubjects.length
    ? { enabled: true, subjects: learningSubjects, difficulty: option("--difficulty", "beginner"), learningObjectives: (option("--objectives", "") || "").split("|").map((s) => s.trim()).filter(Boolean), assessmentType: option("--assessment", "interactive") }
    : undefined,
  aiProvider: "openrouter",
  openRouterModel: option("--writer", "openai/gpt-6.1-sol"),
};
const band = normalizeAgeBand(config.ageGroup);
const book = resolveBookBudget(band, { chapters: Number(option("--chapters", "")) || undefined, imagesPerChapter: Number(option("--images-per-chapter", "")) || undefined });
const form = resolveExperienceForm(config);
const seed = option("--seed", `book-${Date.now()}`)!;
const excludeNames = new Set([...heroRows.map((row: any) => String(row.name)), ...fileHeroes.map((hero) => String(hero.name))].map((name) => name.toLocaleLowerCase("de-DE")));
const catalogue = buildCatalogue({ rows: pool, genre: config.genre, setting: config.setting, band, excludeNames, seed });
const broughtId = option("--brought");
const artifacts = broughtId
  ? [{ ...toArtifactOption(artifactRows.find((row) => row.id === broughtId), config.language)!, broughtBy: heroes[0].id }]
  : selectRewardArtifacts({ rows: artifactRows, genre: config.genre, excludeIds: new Set(), seed, language: config.language });
const historyPath = option("--history", "Logs/test-history-alexander-adrian.json");
const history: { stories?: string[]; engines?: string[] } = historyPath ? JSON.parse(await readFile(historyPath, "utf8").catch(() => "{}")) : {};

const base = buildBrief({ config, band, budget: bookLengthBudget(book), heroes, candidates: [], artifacts, seed, recentStories: history.stories, recentEngineIds: history.engines });
const brief: BookBrief = {
  ...base,
  book,
  form,
  catalogue,
  series: null,
  bookExperiment: {
    writeMode: (option("--write-mode", "batch") as any),
    batchSize: Number(option("--batch-size", "3")),
    planEffort: option("--plan-effort") as any,
    chapterEffort: option("--chapter-effort") as any,
    chapterWriterModel: option("--chapter-writer"),
    plannerModel: option("--planner"),
  },
};
// --series-from <result.json>: the next volume of an earlier test book (its series memory and the child's choice).
const seriesFrom = option("--series-from");
if (seriesFrom) {
  const previous = JSON.parse(await readFile(seriesFrom, "utf8"));
  if (!previous.seriesMemory) throw new Error(`${seriesFrom} has no seriesMemory (the book was not finished).`);
  brief.series = previous.seriesMemory;
  brief.continuation = { teaser: option("--teaser") || previous.plan?.sequelTeasers?.[0], wish: option("--continue-wish") };
  brief.recentStories = [];
}
const models = resolveStorybookModels(config, { critic: option("--critic") });
const out = option("--out", join("Logs", "book-v1", new Date().toISOString().replace(/[:.]/g, "-")))!;
await mkdir(out, { recursive: true });

console.log(`▶ chapter book live test → ${out}`);
console.log(`  writer ${models.writer} | planner ${option("--planner") || models.writer} | support ${models.support} | critic ${models.critic}`);
console.log(`  heroes ${heroes.map((hero: any) => hero.name).join(", ")} | form ${form} | ${book.chapters} chapters × ${book.wordsPerChapterMin}-${book.wordsPerChapterMax} words, ${book.imagesPerChapter} pictures | catalogue ${catalogue.length}`);

const started = Date.now();
const ctx: BookContext = {
  llm,
  brief,
  models,
  ledger,
  observe: (stage, payload) => {
    const short = JSON.stringify(payload).slice(0, 260);
    console.log(`  ✓ ${stage} ${short} | $${ledger.totals().costUSD.toFixed(4)} | ${Math.round((Date.now() - started) / 1000)} s`);
  },
};

// --plan-file: reuse a saved plan (plan.json of an earlier run) to compare write modes or planners on the same plan.
const planFile = option("--plan-file");
async function savedPlan(path: string): Promise<Awaited<ReturnType<typeof planBook>>> {
  const saved = JSON.parse(await readFile(path, "utf8"));
  const cast = (saved.casting || []).map((role: any) => catalogue.find((entry) => entry.id === role.id)).filter(Boolean);
  return { pitch: saved.pitch, casting: { cast, roles: saved.casting || [], notes: saved.castNotes || [] }, plan: saved.plan, planReview: saved.review, planIssues: saved.remainingIssues || [], planRevised: Boolean(saved.revised), brief: { ...brief, candidates: cast } };
}
const planned = planFile ? await savedPlan(planFile) : await planBook(ctx);
await writeFile(join(out, "plan.json"), JSON.stringify({ pitch: planned.pitch, casting: planned.casting.roles, castNotes: planned.casting.notes, plan: planned.plan, review: planned.planReview, remainingIssues: planned.planIssues, revised: planned.planRevised }, null, 2), "utf8");
console.log(`  plan „${planned.plan.title}“ — review ${planned.planReview?.scores.overall ?? "–"} | revised ${planned.planRevised} | open ${planned.planIssues.length}`);

let state: BookState = emptyBookState();
const upTo = Math.min(book.chapters, Number(option("--upto", String(book.chapters))) || book.chapters);
const images: BookImage[] = [];
let coverUrl: string | undefined;
let imageCostUSD = 0;
let missingImages = 0;

if (!flag("--plan-only")) {
  state = await writeBook(ctx, planned, state, upTo);
  await writeFile(join(out, "state.json"), JSON.stringify(state, null, 2), "utf8");

  const imageChapters = flag("--no-images") || !runwareKey ? 0 : Math.min(state.chapters.length, Number(option("--image-chapters", String(state.chapters.length))) || state.chapters.length);
  if (!flag("--no-images") && !runwareKey) console.warn("  ! RUNWARE_API_KEY fehlt — Bilder werden übersprungen.");
  if (imageChapters > 0) {
    const entities: VisualEntity[] = [];
    for (const hero of planned.brief.heroes) {
      const { species, isHuman } = speciesFromProfile(hero.visualProfile, "human");
      entities.push({ id: hero.id, name: hero.name, kind: "character", role: "hero", species, isHuman, appearance: heroAppearance(hero.visualProfile), forbidden: [], referenceUrl: hero.imageUrl });
    }
    for (const candidate of planned.brief.candidates) {
      const { species, isHuman } = speciesFromProfile(candidate.visualProfile, candidate.species);
      entities.push({ id: candidate.id, name: candidate.name, kind: "character", role: "cast", species, isHuman, appearance: castAppearance(candidate.visualProfile, candidate.physicalDescription), forbidden: [], referenceUrl: publicImageUrl(candidate.imageUrl) });
    }
    const looks = await describeReferenceLooks(llm, entities, models.support);
    if (looks.call) ledger.recordCall("reference-looks", looks.call, "support");
    let fixedElements = undefined as any;
    let slot = 1;
    for (let from = 1; from <= imageChapters; from += 3) {
      const chapters = state.chapters.filter((chapter) => chapter.order >= from && chapter.order <= Math.min(imageChapters, from + 2));
      const batch = await illustrateBatch({ llm, models, ledger, brief: planned.brief, plan: planned.plan, chapters, entities: looks.entities, provider: runware, seed, withCover: from === 1, fixedElements, startSlot: slot });
      slot += chapters.length * book.imagesPerChapter;
      fixedElements = batch.storyElements;
      if (batch.coverUrl) coverUrl = batch.coverUrl;
      images.push(...batch.images);
      imageCostUSD += batch.imageCostUSD;
      missingImages += batch.missing.length;
      console.log(`  ✓ pictures ${from}-${from + chapters.length - 1}: ${batch.images.length} ok, ${batch.missing.length} missing, ${batch.imageCalls ?? "?"} calls | $${batch.imageCostUSD.toFixed(4)}`);
      for (const redraw of batch.redraws || []) console.log(`    ↻ ${redraw.chapter ? `Kapitel ${redraw.chapter}.${redraw.part}` : "Cover"} × ${redraw.attempts}: ${redraw.reasons.join("; ") || "?"}`);
    }
  }
}

// Download pictures for the offline HTML.
const files = new Map<string, string>();
let fileNo = 0;
for (const url of [coverUrl, ...images.map((image) => image.url)].filter((value): value is string => Boolean(value))) {
  try {
    const name = url === coverUrl ? "cover.jpg" : `img-${++fileNo}.jpg`;
    await writeFile(join(out, name), Buffer.from(await (await fetch(url)).arrayBuffer()));
    files.set(url, name);
  } catch {
    // keep the remote URL
  }
}

let developments: unknown = null;
let seriesMemory: unknown = null;
if (state.chapters.length) {
  const development = await runDevelopmentStage(llm, { heroes: planned.brief.heroes, title: planned.plan.title, pages: state.chapters.map((chapter) => ({ order: chapter.order, title: chapter.title, content: chapter.recap })) }, models.support);
  if (development.call) ledger.recordCall("avatar-development", development.call, "support");
  developments = development.developments;
  if (state.chapters.length === book.chapters) seriesMemory = await buildSeriesMemory(ctx, planned, state, null);
}

// --- Report ---
const totals = ledger.totals();
const groups = new Map<string, { cost: number; calls: number; prompt: number; cached: number; completion: number }>();
for (const stage of ledger.all()) {
  const key = stage.stage.replace(/-\d+(-\d+)*(-rest|-retry)?$/, "").replace(/-\d+$/, "");
  const entry = groups.get(key) || { cost: 0, calls: 0, prompt: 0, cached: 0, completion: 0 };
  entry.cost += stage.usage?.costUSD || 0;
  entry.calls += 1;
  entry.prompt += stage.usage?.prompt || 0;
  entry.cached += stage.usage?.cachedPromptTokens || 0;
  entry.completion += stage.usage?.completion || 0;
  groups.set(key, entry);
}
const words = state.chapters.reduce((sum, chapter) => sum + countWords(chapter.content), 0);
const seconds = Math.round((Date.now() - started) / 1000);
const costLines = [...groups.entries()].map(([stage, entry]) => `| ${stage} | ${entry.calls} | ${entry.prompt} (${entry.cached} cached) | ${entry.completion} | $${entry.cost.toFixed(4)} |`);
const curveLines = state.curve.map((point) => `| ${point.chapter} | ${point.suspense} | ${point.humor} | ${point.rewritten ? "neu" : ""}${point.patched ? " patch" : ""} | ${point.laugh ? point.laugh.slice(0, 80) : "–"} |`);
const summary = [
  `**Form:** ${form} · **Kapitel:** ${state.chapters.length}/${book.chapters} · **Wörter:** ${words} · **Bilder:** ${images.length} (+Cover ${coverUrl ? "ja" : "nein"}, fehlend ${missingImages})`,
  `**Besetzung:** ${planned.casting.roles.map((role) => `${planned.brief.candidates.find((c) => c.id === role.id)?.name || role.id} (${role.role})`).join(", ") || "–"}`,
  `**Plan-Lektorat:** ${planned.planReview ? JSON.stringify(planned.planReview.scores) : "–"} · überarbeitet: ${planned.planRevised} · offene Plan-Befunde: ${planned.planIssues.length}`,
  `**Kosten:** Text $${totals.costUSD.toFixed(4)} (${totals.calls} Calls) + Bilder $${imageCostUSD.toFixed(4)} = **$${(totals.costUSD + imageCostUSD).toFixed(4)}** · **Dauer:** ${seconds} s`,
];
const md = [
  `# ${planned.plan.title}`, "", `_${planned.plan.description}_`, "", ...summary, "",
  "| Stufe | Calls | Prompt-Tokens | Ausgabe | Kosten |", "|---|---|---|---|---|", ...costLines, "",
  "| Kapitel | Spannung | Humor | Fix | Lacher |", "|---|---|---|---|---|", ...curveLines, "",
  ...state.chapters.flatMap((chapter) => [`## Kapitel ${chapter.order}: ${chapter.title}`, "", `> ${chapter.recap}`, "", chapter.content, ""]),
  "---", "## Offene Befunde", ...(state.openIssues.map((issue) => `- K${issue.chapter}: ${issue.issue}`)), "",
  "## Teaser für Band 2", ...planned.plan.sequelTeasers.map((teaser) => `- ${teaser}`), "",
  "## Avatar-Entwicklung", "```json", JSON.stringify(developments, null, 2), "```",
].join("\n");
await writeFile(join(out, "book.md"), md, "utf8");

const esc = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const imgTag = (url: string, alt: string) => `<figure><img src="${esc(files.get(url) || url)}" alt="${esc(alt)}" loading="lazy"></figure>`;
const chapterHtml = state.chapters.map((chapter) => {
  const paragraphs = chapterParagraphs(chapter.content);
  const mine = images.filter((image) => image.chapter === chapter.order);
  const body = paragraphs.map((paragraph, index) => `<p>${esc(paragraph)}</p>${mine.filter((image) => image.afterParagraph === index).map((image) => imgTag(image.url, `Kapitel ${chapter.order}`)).join("")}`).join("\n");
  return `<section id="k${chapter.order}"><h2><span>Kapitel ${chapter.order}</span>${esc(chapter.title)}</h2>${body}</section>`;
}).join("\n");
const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(planned.plan.title)}</title>
<style>
:root{--bg:#fbf7f0;--ink:#2a2420;--muted:#7a6e64;--accent:#b95134}
@media (prefers-color-scheme:dark){:root{--bg:#1d1a17;--ink:#eee6dc;--muted:#a89a8c;--accent:#e08a6a}}
body{background:var(--bg);color:var(--ink);font:19px/1.65 Georgia,serif;margin:0;padding:0 16px}
main{max-width:680px;margin:0 auto;padding:32px 0 80px}
h1{font-size:2.1em;line-height:1.15;margin:.4em 0 .2em}
h2{margin:2.6em 0 .8em;font-size:1.45em}h2 span{display:block;font-size:.6em;letter-spacing:.12em;text-transform:uppercase;color:var(--accent)}
p{margin:0 0 1em}figure{margin:1.4em 0}img{width:100%;border-radius:14px;display:block}
.meta{color:var(--muted);font:14px/1.5 system-ui,sans-serif}nav a{color:var(--accent);text-decoration:none}nav li{margin:.2em 0}
</style></head><body><main>
${coverUrl ? imgTag(coverUrl, "Cover") : ""}
<h1>${esc(planned.plan.title)}</h1><p><em>${esc(planned.plan.description)}</em></p>
<p class="meta">${state.chapters.length} Kapitel · ${words} Wörter · ${images.length} Bilder · $${(totals.costUSD + imageCostUSD).toFixed(3)}</p>
<nav><ol>${state.chapters.map((chapter) => `<li><a href="#k${chapter.order}">${esc(chapter.title)}</a></li>`).join("")}</ol></nav>
${chapterHtml}
</main></body></html>`;
await writeFile(join(out, "book.html"), html, "utf8");
await writeFile(join(out, "result.json"), JSON.stringify({ models, brief: { config, band, book, form, heroes: heroes.map((hero: any) => hero.name) }, plan: planned.plan, planReview: planned.planReview, planIssues: planned.planIssues, casting: planned.casting.roles, state, images, coverUrl, ledger: ledger.all(), totals, imageCostUSD, seconds, developments, seriesMemory }, null, 2), "utf8");
console.log(`\n■ ${planned.plan.title} — ${state.chapters.length} Kapitel, ${words} Wörter, $${(totals.costUSD + imageCostUSD).toFixed(4)} gesamt, ${seconds} s → ${join(out, "book.html")}`);
