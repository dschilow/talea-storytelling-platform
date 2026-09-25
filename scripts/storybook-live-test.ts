/**
 * Live test for the Bilderbuch-Modus (storybook-v2) — no database, no Encore.
 *
 *   $env:OPENROUTER_API_KEY = "sk-or-…"; $env:RUNWARE_API_KEY = "…"
 *   bun run scripts/storybook-live-test.ts [options]
 *
 * Options:
 *   --heroes "Amir Sternfinder,Mina Mosaik"   pool characters used as stand-in avatars (their images are public)
 *   --genre fairy_tales  --setting fantasy  --age 6-8  --length medium  --language de
 *   --writer openai/gpt-6-luna                any OpenRouter id
 *   --critic google/gemini-3.5-flash-lite     optional override (must be another family)
 *   --wish "…"                                custom wish
 *   --brought <artifactId>                    first hero brings this artifact along
 *   --no-images                               text only
 *   --dry                                     build the brief and write the first prompt; no provider called
 *   --out Logs/storybook-v2-live/<name>
 *
 * Output: story.md (text + critic scores + costs), result.json, and the
 * illustrations as page-N.jpg so they can be inspected directly.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { normalizeAgeBand, resolveLengthBudget } from "../backend/story/storybook/craft";
import { buildBrief } from "../backend/story/storybook/context";
import { CostLedger, fallbackModelFor, resolveStorybookModels, type LlmCallResult, type LlmRequest, type StorybookLlm } from "../backend/story/storybook/llm";
import { acceptsTemperature, extractStorybookChoiceContent, isTruncatedFinishReason, resolveStorybookReasoning } from "../backend/story/storybook/llm-guards";
import { runStorybookTextEngine } from "../backend/story/storybook/engine";
import { selectRewardArtifacts, shortlistCastCandidates, toArtifactOption, toCastCandidate } from "../backend/story/storybook/cast-selection";
import { castAppearance, heroAppearance, runDirectorStage, speciesFromProfile, type VisualEntity } from "../backend/story/storybook/illustration-stage";
import { generateStorybookImages, type ImageProvider } from "../backend/story/storybook/images";
import { runDevelopmentStage } from "../backend/story/storybook/developments";
import { countWords } from "../backend/story/storybook/checks";
import { buildConceptSystemPrompt, buildConceptUserPrompt, selectEnginesForBrief } from "../backend/story/storybook/concept-stage";

const PUBLIC_IMAGE_PROXY = "https://backend-2-production-3de1.up.railway.app/story/image?key=";
const args = process.argv.slice(2);
const option = (name: string, fallback?: string) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : fallback;
};
const flag = (name: string) => args.includes(name);

const openRouterKey = process.env.OPENROUTER_API_KEY || process.env.OpenRouterAPIKey || "";
const runwareKey = process.env.RUNWARE_API_KEY || process.env.RunwareApiKey || "";
if (!openRouterKey && !flag("--dry")) throw new Error("OPENROUTER_API_KEY is not set — no provider called.");

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
    reasoning: resolveStorybookReasoning(model, request.effort),
    include_reasoning: false,
  };
  if (request.json) body.response_format = { type: "json_object" };
  if (typeof request.temperature === "number" && acceptsTemperature(model)) body.temperature = request.temperature;
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openRouterKey}`, "X-Title": "Talea storybook live test" },
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
    },
    durationMs: Date.now() - started,
    finishReason: choice?.finish_reason,
  };
  if (!text || isTruncatedFinishReason(choice?.finish_reason)) {
    const error = new Error(`${!text ? "Empty" : "Truncated"} response from ${model} (${request.stage})`);
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
    const fallback = fallbackModelFor(request.model);
    console.warn(`  ! ${request.stage}: ${(err as Error).message} → retry with ${fallback}`);
    return { ...(await callOnce({ ...request, maxTokens: Math.ceil(request.maxTokens * 1.5) }, fallback)), fallbackFrom: request.model };
  }
};

// --- Runware provider (same request shape as backend/ai/image-generation.ts) ---
const runware: ImageProvider = async (request) => {
  if (!runwareKey) return {};
  const taskUUID = crypto.randomUUID();
  const response = await fetch("https://api.runware.ai/v1", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${runwareKey}` },
    body: JSON.stringify([{
      taskType: "imageInference", taskUUID, model: "runware:400@4",
      positivePrompt: request.prompt, negativePrompt: request.negativePrompt,
      width: request.width, height: request.height, steps: Number(option("--steps", "4")), CFGScale: 4,
      seed: request.seed, numberResults: 1, outputType: ["URL"], outputFormat: "JPEG", includeCost: true,
      ...(request.referenceImages.length ? { inputs: { referenceImages: request.referenceImages } } : {}),
    }]),
    signal: AbortSignal.timeout(180_000),
  });
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Runware ${response.status}: ${JSON.stringify(data).slice(0, 300)}`);
  const item = (data.data || []).find((row: any) => row.taskUUID === taskUUID);
  return { url: item?.imageURL, costUSD: Number(item?.cost) || 0 };
};

// --- Brief from the exported pool ---
const pool: any[] = JSON.parse(await readFile(option("--characters", "Logs/talea-characters-2026-08-10T08-13-38-438Z.json")!, "utf8"));
const artifactRows: any[] = JSON.parse(await readFile(option("--artifacts", "Logs/talea-artifacts-2026-04-27T11-18-00-036Z.json")!, "utf8"));
const heroNames = option("--heroes", "Amir Sternfinder,Mina Mosaik")!.split(",").map((name) => name.trim());
const heroRows = heroNames.map((name) => pool.find((row) => row.name === name && row.imageUrl) || pool.find((row) => row.name === name));
if (heroRows.some((row) => !row)) throw new Error(`Unknown hero in --heroes: ${heroNames.join(", ")}`);
const heroes = heroRows.map((row: any) => {
  const candidate = toCastCandidate(row)!;
  const shortName = candidate.name.split(" ")[0];
  return {
    id: `hero-${candidate.id}`,
    name: shortName,
    age: row.age_category === "child" ? 8 : undefined,
    description: `${candidate.whoTheyAre}. ${candidate.quirk ? `Eigenart: ${candidate.quirk}.` : ""}`,
    imageUrl: publicImageUrl(candidate.imageUrl),
    visualProfile: { characterType: candidate.species === "human" ? "human" : candidate.species, consistentDescriptors: [castAppearance(candidate.visualProfile, candidate.physicalDescription)] },
    narrativeProfile: { dominantPersonality: candidate.personality[0], traits: candidate.personality.slice(1, 3), quirk: candidate.quirk, catchphrase: candidate.catchphrase },
  };
});

const config: any = {
  genre: option("--genre", "fairy_tales"),
  setting: option("--setting", "fantasy"),
  ageGroup: option("--age", "6-8"),
  length: option("--length", "medium"),
  language: option("--language", "de"),
  humorLevel: 2,
  suspenseLevel: 2,
  emotionalFlavors: (option("--flavors", "lachfreude,prickeln") || "").split(",").filter(Boolean),
  requireHappyEnd: true,
  allowRhymes: flag("--rhymes"),
  customPrompt: option("--wish"),
  aiProvider: "openrouter",
  openRouterModel: option("--writer", "openai/gpt-6-luna"),
};
const band = normalizeAgeBand(config.ageGroup);
const budget = resolveLengthBudget(config.length, band);
const seed = option("--seed", `live-${Date.now()}`)!;
const excludeNames = new Set(heroRows.map((row: any) => String(row.name).toLocaleLowerCase("de-DE")));
const candidates = shortlistCastCandidates({ rows: pool, genre: config.genre, setting: config.setting, band, excludeNames, seed });
const broughtId = option("--brought");
const artifacts = broughtId
  ? [{ ...toArtifactOption(artifactRows.find((row) => row.id === broughtId), config.language)!, broughtBy: heroes[0].id }]
  : selectRewardArtifacts({ rows: artifactRows, genre: config.genre, excludeIds: new Set(), seed, language: config.language });

const brief = buildBrief({ config, band, budget, heroes, candidates, artifacts, seed });
const models = resolveStorybookModels(config, { critic: option("--critic") });
const out = option("--out", join("Logs", "storybook-v2-live", new Date().toISOString().replace(/[:.]/g, "-")))!;
await mkdir(out, { recursive: true });

console.log(`▶ storybook-v2 live test → ${out}`);
console.log(`  writer ${models.writer} | support ${models.support} | critic ${models.critic}`);
console.log(`  heroes ${heroes.map((hero) => hero.name).join(", ")} | candidates ${candidates.map((c) => c.name).join(", ")}`);
console.log(`  artifacts ${artifacts.map((a) => `${a.name}${a.broughtBy ? " (mitgebracht)" : ""}`).join(", ") || "—"}`);

if (flag("--dry")) {
  const engines = selectEnginesForBrief(brief);
  await writeFile(join(out, "concept-prompt.md"), `# SYSTEM

${buildConceptSystemPrompt()}

# USER

${buildConceptUserPrompt(brief, engines)}
`, "utf8");
  console.log(`  dry run: prompt written to ${join(out, "concept-prompt.md")}`);
  process.exit(0);
}

const started = Date.now();
const text = await runStorybookTextEngine({
  llm,
  brief,
  models,
  ledger,
  observe: (stage, payload) => {
    const extra = stage === "review" ? ` overall=${(payload.review as any)?.scores?.overall}` : stage === "final-ab" ? ` chosen=${payload.chosen}` : "";
    console.log(`  ✓ ${stage}${extra}`);
  },
});

let imageSummary = "Bilder übersprungen";
let imageCostUSD = 0;
const imageFiles: Record<number, string> = {};
if (!flag("--no-images")) {
  const entities: VisualEntity[] = [];
  for (const hero of brief.heroes) {
    const { species, isHuman } = speciesFromProfile(hero.visualProfile, "human");
    entities.push({ id: hero.id, name: hero.name, kind: "character", species, isHuman, appearance: heroAppearance(hero.visualProfile), forbidden: [], referenceUrl: hero.imageUrl });
  }
  for (const member of text.plan.cast) {
    const candidate = candidates.find((entry) => entry.id === member.id)!;
    const { species, isHuman } = speciesFromProfile(candidate.visualProfile, candidate.species);
    entities.push({ id: candidate.id, name: candidate.name, kind: "character", species, isHuman, appearance: castAppearance(candidate.visualProfile, candidate.physicalDescription), forbidden: [], referenceUrl: publicImageUrl(candidate.imageUrl) });
  }
  const artifact = text.plan.artifact ? artifacts.find((entry) => entry.id === text.plan.artifact!.id) : undefined;
  if (artifact) entities.push({ id: `artifact:${artifact.id}`, name: artifact.name, kind: "artifact", species: "object", isHuman: false, appearance: artifact.visualKeywords.join(", "), forbidden: [], referenceUrl: publicImageUrl(artifact.imageUrl) });

  const director = await runDirectorStage(llm, { brief, title: text.title, pages: text.pages, plan: text.plan, entities }, models.support);
  if (director.call) ledger.recordCall("illustration-direction", director.call, "support");
  const images = await generateStorybookImages({ illustrations: director.illustrations, entities, provider: runware, seed, llm, visionModel: models.support });
  images.qaCalls.forEach((call, index) => ledger.recordCall(`image-qa-${index + 1}`, call, "support"));
  imageCostUSD = images.imageCostUSD;
  for (const outcome of [images.cover, ...images.pages.values()]) {
    if (!outcome?.url) continue;
    const file = outcome.page === 0 ? "cover.jpg" : `page-${outcome.page}.jpg`;
    const bytes = Buffer.from(await (await fetch(outcome.url)).arrayBuffer());
    await writeFile(join(out, file), bytes);
    imageFiles[outcome.page] = file;
  }
  imageSummary = `${images.imagesGenerated} Bilder, ${images.imageCalls} Aufrufe, neu generiert: ${images.regenerated.join(", ") || "keine"}`;
  await writeFile(join(out, "images.json"), JSON.stringify({ illustrations: director.illustrations, outcomes: [images.cover, ...images.pages.values()] }, null, 2));
}

const development = await runDevelopmentStage(llm, { heroes: brief.heroes, title: text.title, pages: text.pages }, models.support);
if (development.call) ledger.recordCall("avatar-development", development.call, "support");

const totals = ledger.totals();
const words = text.pages.reduce((sum, page) => sum + countWords(page.content), 0);
const md = [
  `# ${text.title}`,
  "",
  `_${text.description}_`,
  "",
  `**Note (Kritiker, 0–10 vs. Top-Bilderbücher):** Endfassung ${text.benchmarkScore ?? "–"} · Entwurf ${text.draftScore ?? "–"} · ausgeliefert: ${text.chosen}`,
  `**Bauplan:** ${text.plan.engine} · **Besetzung:** ${text.plan.cast.map((member) => member.name).join(", ") || "–"} · **Artefakt:** ${text.plan.artifact?.name || "–"}`,
  `**Umfang:** ${text.pages.length} Seiten, ${words} Wörter · **Kosten:** Text $${totals.costUSD.toFixed(4)} (${totals.calls} Calls) + Bilder $${imageCostUSD.toFixed(4)} · **Dauer:** ${Math.round((Date.now() - started) / 1000)} s`,
  `**Bilder:** ${imageSummary}`,
  "",
  ...text.pages.flatMap((page) => [`## Seite ${page.order}`, "", imageFiles[page.order] ? `![Seite ${page.order}](${imageFiles[page.order]})\n` : "", page.content, ""]),
  "---",
  "## Lektorat (Entwurf)",
  text.review ? "```json\n" + JSON.stringify(text.review, null, 2) + "\n```" : "–",
  "## A/B",
  text.pairwise ? "```json\n" + JSON.stringify(text.pairwise, null, 2) + "\n```" : "–",
  "## Harte Befunde am Ende",
  text.finalChecks.hard.map((issue) => `- ${issue.message}`).join("\n") || "keine",
  "## Avatar-Entwicklung",
  "```json\n" + JSON.stringify(development.developments, null, 2) + "\n```",
].join("\n");
await writeFile(join(out, "story.md"), md, "utf8");
await writeFile(join(out, "result.json"), JSON.stringify({ models, brief: { ...brief, config }, text, ledger: ledger.all(), totals, imageCostUSD }, null, 2), "utf8");
console.log(`\n■ ${text.title} — Note ${text.benchmarkScore ?? "–"} (Entwurf ${text.draftScore ?? "–"}), $${(totals.costUSD + imageCostUSD).toFixed(4)} gesamt → ${join(out, "story.md")}`);
