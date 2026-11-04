/**
 * Talea-Folge end to end, the production path without database or Encore: Sol one-shot + Haiku editorial read with local
 * repairs, guest portrait + reference plan, Luna direction, FLUX.2 klein 9B KV pictures with the Luna check and Jev.
 * Fictional avatars (two published Originals children under fictional names), pool figures from the pool export.
 *
 *   bun --env-file=.env.local run scripts/episode/pilot.ts --run [--images] --genre fairy_tales --length medium --seed a1 --out <dir>
 *
 * Needs OPENROUTER_API_KEY (and RUNWARE_API_KEY with --images). Writes story.md, result.json and the printed pictures.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { buildBrief } from "../../backend/story/storybook/context";
import { CostLedger, type LlmCallResult, type LlmRequest, type StorybookLlm } from "../../backend/story/storybook/llm";
import { extractStorybookChoiceContent, isTruncatedFinishReason, resolveStorybookReasoning } from "../../backend/story/storybook/llm-guards";
import { shortlistCastCandidates } from "../../backend/story/storybook/cast-selection";
import { castAppearance, speciesFromProfile, type VisualEntity } from "../../backend/story/storybook/illustration-stage";
import { normalizeAgeBand } from "../../backend/story/storybook/craft";
import { isPublishable, type ImageProvider } from "../../backend/story/storybook/images";
import { createOpenRouterJevPort } from "../../backend/story/storybook/jev-openrouter";
import { episodeBudget, episodeProductionLlm, episodeProductionModels } from "../../backend/story/episode/craft";
import { EPISODE_PIPELINE_ID, runEpisodeTextEngine } from "../../backend/story/episode/engine";
import { chapterPictures, directFolgePictures } from "../../backend/story/episode/pictures";
import { guestPortraitCheck, prepareGuestPortraits } from "../../backend/story/episode/guest-portraits";
import { SERIES_IMAGE_MODEL, SERIES_IMAGE_REVIEW_FALLBACK_MODEL, SERIES_IMAGE_REVIEW_MODEL, SERIES_PICTURE_DIRECTION_MODEL } from "../../backend/story/character-series/authoring";
import { generateSeriesImages, SERIES_ART_DIRECTION } from "../../backend/story/character-series/pictures";
import { seriesReferenceAppearance } from "../../backend/story/character-series/identity";
import { prepareSeriesVisualReferences } from "../../backend/story/character-series/visual-references";
import { pictureHasPanels } from "../../backend/story/character-series/panels";
import { createRunwareCaller } from "../../backend/story/library/images";
import { runwareImageModelOptions } from "../../backend/ai/runware-image-model-options";
import { withTaleaImageStyle, type StoryImageStyleId } from "../../backend/ai/image-style";

const args = process.argv.slice(2);
const opt = (name: string, fallback: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
if (!args.includes("--run")) throw new Error("Use --run (paid: ≈ 3–4 ¢ text, ≈ 4 ¢ more with --images).");
const genre = opt("--genre", "fairy_tales");
const setting = opt("--setting", "varied");
const length = opt("--length", "medium") as "short" | "medium" | "long";
const ageGroup = opt("--age", "6-8");
const seed = opt("--seed", "pilot-1");
const imageStyle = (args.includes("--style") ? opt("--style", "") : undefined) as StoryImageStyleId | undefined;
const out = resolve(opt("--out", `Logs/episode/pilot-${seed}`));
await mkdir(out, { recursive: true });
const key = process.env.OPENROUTER_API_KEY;
const runwareKey = process.env.RUNWARE_API_KEY;
if (!key) throw new Error("No OpenRouter key available.");
if (args.includes("--images") && !runwareKey) throw new Error("No Runware key available.");

const inline = async (path: string) => "data:image/webp;base64," + (await readFile(path)).toString("base64");
// Published fictional book children serve as the family's avatars, under fictional names.
const avatars = [
  { id: "fictional-nora", name: "Nora", age: 8, description: "Neugierig, praktisch, manchmal vorschnell. Plant gern.", imageUrl: await inline("frontend/public/library/series/bruno-der-flunkerfisch/characters/ella.webp"), appearance: "human girl, brown hair in short pigtails, large round red glasses, yellow raincoat over green striped shirt, blue jeans, red shoes", context: "8 years old, female, brown hair in short pigtails" },
  { id: "fictional-ben", name: "Ben", age: 7, description: "Beobachtet genau, stellt kurze Fragen, trockener Humor.", imageUrl: await inline("frontend/public/library/series/die-monster-muellabfuhr/characters/jona.webp"), appearance: "human boy, brown skin, short tightly curled dark hair, blue hoodie, orange reflective vest, blue jeans, yellow rubber boots", context: "7 years old, male, short tightly curled dark hair" },
];
const band = normalizeAgeBand(ageGroup);
const rows = JSON.parse(await readFile("exports/character-pool/2026-10-26/talea-characters-2026-10-26-optimiert.json", "utf8"));
const candidates = shortlistCastCandidates({ rows, genre, setting, band, excludeNames: new Set(avatars.map((a) => a.name.toLocaleLowerCase("de-DE"))), seed, limit: 6 });
const config: any = { avatarIds: avatars.map((a) => a.id), storybookMode: true, storybookEngine: EPISODE_PIPELINE_ID, genre, setting, ageGroup, length, language: "de", humorLevel: 2, suspenseLevel: 2, requireHappyEnd: true, ...(imageStyle ? { imageStyle } : {}) };
const brief = buildBrief({ config, band, budget: episodeBudget(length, band), heroes: avatars, candidates, artifacts: [], seed });

const ledger = new CostLedger();
let count = 0;
const once = async (request: LlmRequest, tier: "flex" | undefined): Promise<LlmCallResult> => {
  const prefix = `${String(++count).padStart(2, "0")}-${request.stage}`;
  const { imageInputs, ...metadata } = request;
  await writeFile(join(out, `${prefix}.request.json`), JSON.stringify({ ...metadata, tier, imageInputCount: imageInputs?.length || 0 }, null, 2));
  const started = Date.now();
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(tier === "flex" ? Math.min(900_000, (request.timeoutMs || 180_000) * 2) : request.timeoutMs || 180_000),
    body: JSON.stringify({ model: request.model, max_tokens: request.maxTokens, ...(tier ? { service_tier: tier } : {}), reasoning: resolveStorybookReasoning(request.model, request.effort, request.role), usage: { include: true }, ...(request.json ? { response_format: { type: "json_object" } } : {}),
      messages: [{ role: "system", content: request.json && !/json/i.test(`${request.system}${request.user}`) ? `${request.system}\nAnswer with one JSON object.` : request.system }, { role: "user", content: imageInputs?.length ? [{ type: "text", text: request.user }, ...imageInputs.map((url) => ({ type: "image_url", image_url: { url } }))] : request.user }] }),
  });
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status} ${data?.error?.message || ""}`.slice(0, 300)), { status: response.status });
  const result = { text: extractStorybookChoiceContent(data.choices?.[0]), modelUsed: data.model || request.model, usage: { prompt: data.usage?.prompt_tokens || 0, completion: data.usage?.completion_tokens || 0, total: data.usage?.total_tokens || 0, costUSD: data.usage?.cost || 0 }, durationMs: Date.now() - started, finishReason: data.choices?.[0]?.finish_reason };
  await writeFile(join(out, `${prefix}.response.json`), JSON.stringify(result, null, 2));
  if (!result.text || isTruncatedFinishReason(result.finishReason)) throw Object.assign(new Error(`Incomplete response (${result.finishReason})`), { billed: result });
  console.log(`${request.stage} · ${result.modelUsed} · ${tier || "standard"} · ${(result.usage.costUSD * 100).toFixed(2)} ¢ · ${Math.round(result.durationMs / 1000)} s`);
  return result;
};
// As the production port (storybook/llm-openrouter.ts): a flex call refused or empty is repeated on the standard tier,
// and a truncated answer once more with 1.5 × the tokens on the same model (episodeProductionLlm keeps the model).
const rawLlm: StorybookLlm = async (request) => {
  const tier = request.serviceTier === "flex" ? "flex" : undefined;
  const standard = async (current: LlmRequest): Promise<LlmCallResult> => {
    try {
      return await once(current, undefined);
    } catch (error: any) {
      if (error?.billed) ledger.recordCall(`${current.stage}-failed`, error.billed, current.role);
      if (!/Incomplete response \(length\)/.test(String(error?.message))) throw error;
      console.warn(`${current.stage}: truncated, once more with 1.5 × tokens`);
      return once({ ...current, maxTokens: Math.ceil(current.maxTokens * 1.5) }, undefined);
    }
  };
  if (tier !== "flex") return standard(request);
  try {
    return await once(request, tier);
  } catch (error: any) {
    if (error?.billed) ledger.recordCall(`${request.stage}-failed`, error.billed, request.role);
    // An instant empty flex reply (0 tokens, $0) is a refusal under load: production tries flex once more after 4 s.
    const refused = !error?.billed || (!error.billed.usage?.total && !error.billed.usage?.costUSD);
    if (refused) {
      await new Promise((done) => setTimeout(done, 4000));
      try { return await once(request, tier); } catch (retry: any) { if (retry?.billed) ledger.recordCall(`${request.stage}-failed`, retry.billed, request.role); }
    }
    console.warn(`${request.stage}: flex failed (${String(error?.message).slice(0, 120)}), standard tier`);
    await new Promise((done) => setTimeout(done, 4000));
    return standard(request);
  }
};
const llm = episodeProductionLlm(rawLlm, "flex");
const models = episodeProductionModels();
const started = Date.now();
const text = await runEpisodeTextEngine({ llm, brief, models, ledger, observe: async (stage, payload) => { await writeFile(join(out, `stage-${stage}.json`), JSON.stringify(payload, null, 2)); }, options: { mode: "one-shot", editorialReview: true, serviceTier: "flex" } });
const textCostUSD = ledger.totals().costUSD;
const textMs = Date.now() - started;
const words = text.pages.map((page) => page.content.split(/\s+/).filter(Boolean).length);
await writeFile(join(out, "story.md"), `# ${text.title}\n\n_${text.description}_\n\n${text.pages.map((page) => `## ${page.title}\n\n${page.content}`).join("\n\n")}\n`);
console.log(JSON.stringify({ title: text.title, words, textCents: +(textCostUSD * 100).toFixed(2), textQuality: text.textQuality, revised: text.episode.revised }));

let pictures: unknown;
let imageCostUSD = 0;
if (args.includes("--images")) {
  const call = createRunwareCaller(runwareKey!);
  const provider: ImageProvider = async (request) => {
    const model = SERIES_IMAGE_MODEL;
    const task: Record<string, unknown> = {
      taskType: "imageInference", taskUUID: crypto.randomUUID(), model, numberResults: 1, outputType: ["URL"], includeCost: true,
      ...runwareImageModelOptions({ model, steps: 4, CFGScale: 4, outputFormat: "JPEG", negativePrompt: request.negativePrompt || undefined }),
      width: Math.round(request.width / 64) * 64, height: Math.round(request.height / 64) * 64, seed: request.seed,
      positivePrompt: withTaleaImageStyle(request.prompt, request.imageStyle).replace(/\s+/g, " ").trim(),
      ...(request.referenceImages.length ? { inputs: { referenceImages: request.referenceImages } } : {}),
    };
    const response = await call(task as any);
    return { url: response.imageURL, costUSD: response.cost };
  };
  const proxied = async (url: string | undefined) => {
    if (!url) return undefined;
    const source = url.startsWith("bucket://") ? `https://backend-2-production-3de1.up.railway.app/story/image?key=${encodeURIComponent(url.replace(/^bucket:\/\/[^/]+\//, ""))}` : url;
    try {
      const response = await fetch(source, { signal: AbortSignal.timeout(20_000) });
      if (!response.ok) return undefined;
      return `data:${response.headers.get("content-type") || "image/webp"};base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`;
    } catch {
      return undefined;
    }
  };
  const castInStory = text.plan.cast.map((member) => candidates.find((candidate) => candidate.id === member.id) || text.episode.guests.find((guest) => guest.id === member.id)).filter(Boolean) as typeof candidates;
  const entities: VisualEntity[] = [
    ...avatars.map((a) => ({ id: a.id, name: a.name, kind: "character" as const, role: "hero" as const, species: "human", isHuman: true, appearance: a.appearance, referenceContext: a.context, forbidden: [], referenceUrl: a.imageUrl })),
    ...(await Promise.all(castInStory.map(async (member) => ({ id: member.id, name: member.name, kind: "character" as const, role: "cast" as const, ...speciesFromProfile(member.visualProfile, member.species),
      appearance: seriesReferenceAppearance(castAppearance(member.visualProfile, member.physicalDescription)), forbidden: [], referenceUrl: await proxied((member as any).imageUrl) })))),
  ];
  const readable = async (url: string) => url;
  const portraits = await prepareGuestPortraits({ entities, guestIds: text.episode.guests.map((guest) => guest.id), provider, seed, readableReference: readable, portraitStyle: SERIES_ART_DIRECTION,
    check: guestPortraitCheck(llm, SERIES_IMAGE_REVIEW_MODEL, (response) => ledger.recordCall("guest-portrait-check", response, "support")) });
  const references = await prepareSeriesVisualReferences({ pages: text.pages, entities: portraits.entities, llm, model: SERIES_PICTURE_DIRECTION_MODEL, provider, seed, readableReference: readable, recordCall: (response) => ledger.recordCall("series-visual-reference-plan", response, "support") });
  const prepared = { calls: portraits.calls + references.calls, costUSD: portraits.costUSD + references.costUSD };
  const direction = await directFolgePictures({ llm, model: SERIES_PICTURE_DIRECTION_MODEL, brief, title: text.title, pages: text.pages, plan: text.plan, entities: references.entities,
    observe: async (stage, payload) => { await writeFile(join(out, `stage-${stage}.json`), JSON.stringify(payload, null, 2)); } });
  ledger.recordCall("illustration-direction", direction.director.call!, "support");
  if (direction.director.repairCall) ledger.recordCall("illustration-plan-repair", direction.director.repairCall, "support");
  await writeFile(join(out, "direction.json"), JSON.stringify({ illustrations: direction.illustrations, placed: direction.placed, unplaced: direction.unplaced, portraits: [...portraits.portraits, ...references.portraits] }, null, 2));
  const images = await generateSeriesImages({
    illustrations: direction.illustrations, entities: references.entities, provider, imageModel: SERIES_IMAGE_MODEL, seed, llm, imageStyle,
    visionModel: SERIES_IMAGE_REVIEW_MODEL, visionFallbackModel: SERIES_IMAGE_REVIEW_FALLBACK_MODEL,
    pageTexts: Object.fromEntries(direction.pages.map((page) => [page.order, page.content])),
    chapterByPage: Object.fromEntries(direction.slots.map((slot, index) => [index + 1, slot.chapter])),
    reservedImageCalls: prepared.calls, panelCheck: pictureHasPanels, jev: createOpenRouterJevPort(() => key),
  });
  images.qaCalls.forEach((response, index) => ledger.recordCall(`image-qa-${index + 1}`, response, "support"));
  images.jevCalls?.forEach((response, index) => ledger.recordCall(`image-jev-${index + 1}`, response, "support"));
  imageCostUSD = images.imageCostUSD + prepared.costUSD;
  const outcomes = [images.cover!, ...images.pages.values()];
  for (const outcome of outcomes) {
    if (!outcome?.url || !isPublishable(outcome)) continue;
    const response = await fetch(outcome.url);
    if (response.ok) await writeFile(join(out, `${outcome.page === 0 ? "cover" : `bild-${outcome.page}`}.jpg`), new Uint8Array(await response.arrayBuffer()));
  }
  for (const portrait of [...portraits.portraits, ...references.portraits]) {
    if (!portrait.url) continue;
    const response = await fetch(portrait.url);
    if (response.ok) await writeFile(join(out, `portrait-${portrait.id.replace(/[^a-z0-9-]/gi, "_")}.jpg`), new Uint8Array(await response.arrayBuffer()));
  }
  pictures = {
    imageCalls: images.imageCalls + prepared.calls, printed: outcomes.filter((o) => isPublishable(o)).length, planned: outcomes.length,
    chapterPictures: chapterPictures(direction, images.pages).map(({ chapter, afterParagraph, status }) => ({ chapter, afterParagraph, status })),
    outcomes: outcomes.map((o) => ({ page: o.page, status: o.status, attempts: o.attempts, history: o.history?.map((h) => ({ kind: h.kind, status: h.status, notes: h.notes })) })),
    shots: [direction.illustrations.cover, ...direction.illustrations.pages].map((shot) => ({ page: shot.page, onStage: shot.onStage, scene: shot.scene })),
  };
}
const totals = ledger.totals();
const report = { title: text.title, words, totalWords: words.reduce((a, b) => a + b, 0), models, textQuality: text.textQuality, revised: text.episode.revised, plan: text.plan, pictures,
  costs: { textCents: +(textCostUSD * 100).toFixed(2), llmCents: +(totals.costUSD * 100).toFixed(2), imageCents: +(imageCostUSD * 100).toFixed(2), totalCents: +((totals.costUSD + imageCostUSD) * 100).toFixed(2) },
  seconds: { text: Math.round(textMs / 1000), total: Math.round((Date.now() - started) / 1000) }, stages: ledger.all() };
await writeFile(join(out, "result.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ title: report.title, words: report.totalWords, costs: report.costs, seconds: report.seconds, pictures: pictures ? { printed: (pictures as any).printed, planned: (pictures as any).planned, calls: (pictures as any).imageCalls } : undefined, out }));
