/** Opt-in production adapter; the other three engines remain intact. */
import { secret } from "encore.dev/config";
import { APIError } from "encore.dev/api";
import { storyDB } from "./db";
import { avatarDB } from "../avatar/db";
import { publishWithTimeout } from "../helpers/pubsubTimeout";
import { logTopic } from "../log/logger";
import { maybeUploadImageUrlToBucket, resolveImageUrlForClient } from "../helpers/bucket-storage";
import { getOwnedPoolIdsByAvatar, loadCrownArtifactIds, recordBroughtArtifact } from "./artifact-treasury";
import { recordStoryArtifact } from "./artifact-matcher";
import { buildArtifactImageUrlForClient } from "../helpers/image-proxy";
import type { StorybookGeneratedStory, StorybookGenerationInput } from "./storybook/types";
import { normalizeArtifacts, normalizePeople, shortlistPeople } from "./book-workshop/catalog";
import { makeBrief, writerModel } from "./book-workshop/brief";
import { generateBook } from "./book-workshop/engine";
import { describeBookFailure } from "./book-workshop/failure";
import { grounded } from "./book-workshop/contracts";
import { imageAccounting, illustrateBook, runwareProvider } from "./book-workshop/images";
import { openRouterTransport, resolvePrices } from "./book-workshop/openrouter";
import type { Person } from "./book-workshop/types";

const openRouterKey = secret("OpenRouterAPIKey");
const runwareKey = secret("RunwareApiKey");
async function audit(storyId: string | undefined, stage: string, response: unknown): Promise<void> {
  try { await publishWithTimeout(logTopic, { source: "book-workshop-stage", timestamp: new Date(), request: { storyId, stage }, response, metadata: { storyId, stage, pipeline: "book-workshop-v1" } }); } catch { /* best effort observer */ }
}
export async function generateStoryBookWorkshop(input: StorybookGenerationInput & { blockedTerms?: string[] }): Promise<StorybookGeneratedStory> {
  const { config } = input;
  const heroes: Person[] = input.heroes.map((h, i) => ({
    id: h.id || `hero-${i}`, name: h.name, description: h.description || "", motivation: "",
    voice: [h.narrativeProfile?.voice || h.narrativeProfile?.speakingStyle || ""].filter(Boolean),
    quirk: h.narrativeProfile?.quirk || "", settings: [], imageUrl: h.imageUrl,
    appearance: String(h.visualProfile?.imagePrompt || h.visualProfile?.description || h.description || "").slice(0, 500),
  }));
  const ids = heroes.map(h => h.id);
  const [pool, artifactRows, ownedByAvatar, crowns, history, memories] = await Promise.all([
    config.useCharacterPool === false ? Promise.resolve([]) : storyDB.queryAll<any>`SELECT * FROM character_pool WHERE is_active = TRUE`.catch(() => []),
    storyDB.queryAll<any>`SELECT * FROM artifact_pool WHERE is_active = TRUE`.catch(() => []),
    getOwnedPoolIdsByAvatar(ids), loadCrownArtifactIds(),
    input.userId ? storyDB.queryAll<any>`SELECT metadata FROM stories WHERE user_id = ${input.userId} AND id <> ${input.storyId || ""} AND status = 'complete' ORDER BY created_at DESC LIMIT 8`.catch(() => []) : Promise.resolve([]),
    avatarDB.queryAll<any>`SELECT avatar_id, story_title FROM (SELECT avatar_id, story_title, ROW_NUMBER() OVER (PARTITION BY avatar_id ORDER BY created_at DESC) AS n FROM avatar_memories WHERE avatar_id = ANY(${ids})) ranked WHERE n <= 2`.catch(() => []),
  ]);
  for (const hero of heroes) {
    hero.description = hero.description.slice(0, 350);
    const titles = memories.filter(m => m.avatar_id === hero.id).map(m => String(m.story_title || "").slice(0, 80)).filter(Boolean);
    if (titles.length) hero.description += ` Frühere Abenteuer heißen: ${titles.join("; ")}. Daraus keine nicht belegten Ereignisse ableiten.`;
    const original = input.heroes.find(h => h.id === hero.id);
    const strengths = Object.entries(original?.personalityTraits || {}).map(([trait, value]) => ({ trait, value: Number(typeof value === "number" ? value : (value as any)?.value) })).filter(t => t.value > 0).sort((a, b) => b.value - a.value).slice(0, 2);
    if (strengths.length) hero.motivation = `Bisherige Stärken: ${strengths.map(t => t.trait).join(", ")}. Keine vorgeschriebene Entwicklung.`;
  }
  const owned = new Set([...ownedByAvatar.values()].flatMap(s => [...s]));
  let artifacts = normalizeArtifacts(artifactRows, config.language || "de").filter(a => !owned.has(a.id) && !crowns.has(a.id));
  // Rotate candidate access deterministically without mutating artefact DNA.
  const seed = input.storyId || crypto.randomUUID();
  const offset = [...seed].reduce((n, c) => n + c.charCodeAt(0), 0) % Math.max(1, artifacts.length);
  artifacts = [...artifacts.slice(offset), ...artifacts.slice(0, offset)].slice(0, 3);
  if (config.broughtArtifact) {
    const { avatarId, artifactId } = config.broughtArtifact;
    if (!ids.includes(avatarId) || !ownedByAvatar.get(avatarId)?.has(artifactId)) throw APIError.invalidArgument("Das mitgebrachte Artefakt gehört keinem der ausgewählten Avatare.");
    const brought = normalizeArtifacts(artifactRows, config.language || "de").find(a => a.id === artifactId);
    if (!brought) throw APIError.invalidArgument("Das mitgebrachte Artefakt ist nicht verfügbar.");
    artifacts = [{ ...brought, broughtBy: avatarId }];
  }
  const readMetadata = (raw: any) => { try { return typeof raw === "string" ? JSON.parse(raw) : raw || {}; } catch { return {}; } };
  const brief = makeBrief(config, heroes, seed, {
    candidates: shortlistPeople(normalizePeople(pool), heroes, config.setting, seed), artifacts,
    recentPremises: history.map(r => readMetadata(r.metadata)?.bookWorkshop?.premise).filter((p): p is string => typeof p === "string"), blockedTerms: input.blockedTerms || [],
  });
  const writer = writerModel(config);
  const reviewer = writer === "openai/gpt-5.6-luna" ? "google/gemini-3.1-flash-lite" : "openai/gpt-5.6-luna";
  const startedAt = Date.now();
  const result = await generateBook(brief, {
    writer, reviewer, prices: await resolvePrices([writer, reviewer]),
    transport: openRouterTransport(process.env.OPENROUTER_API_KEY || process.env.ENCORE_SECRET_OPENROUTERAPIKEY || openRouterKey()),
    textBudgetUSD: Number(process.env.TALEA_BOOK_TEXT_BUDGET_USD || "0.03"),
    onReceipt: receipt => audit(input.storyId, receipt.stage, receipt),
    onCheckpoint: async checkpoint => {
      if (!input.storyId || !input.userId) return;
      const row = await storyDB.queryRow<{ metadata: any }>`SELECT metadata FROM stories WHERE id = ${input.storyId} AND user_id = ${input.userId}`;
      const metadata = readMetadata(row?.metadata);
      await storyDB.exec`UPDATE stories SET metadata = ${JSON.stringify({
        ...metadata,
        adminGenerationMetrics: { ...metadata.adminGenerationMetrics, bookWorkshopDraft: {
          savedAt: new Date().toISOString(), brief, writer, reviewer, checkpoint,
        } },
      })}, updated_at = ${new Date()} WHERE id = ${input.storyId} AND user_id = ${input.userId}`;
    },
  });
  await audit(input.storyId, "text-result", { ...result, manuscript: process.env.TALEA_BOOK_LOG_TEXT === "true" ? result.manuscript : undefined });
  if (result.status !== "accepted" || !result.manuscript || !result.review || !result.plan) {
    const failure = describeBookFailure(result);
    console.error("[book-workshop] Generation stopped", {
      storyId: input.storyId, ...failure, issues: result.issues,
      stages: result.receipts.map(({ stage, model, status, durationMs }) => ({ stage, model, status, durationMs })),
      textCostUSD: result.textCostUSD, budgetCommittedUSD: result.budgetCommittedUSD,
    });
    throw APIError.failedPrecondition(`${failure.message} Es wurden keine Bilder oder Belohnungen erzeugt.`);
  }

  let imageKey = process.env.RUNWARE_API_KEY || process.env.RunwareApiKey || "";
  if (!imageKey) { try { imageKey = runwareKey(); } catch { /* Text remains available when images are not configured. */ } }
  const images = await illustrateBook(result, brief, runwareProvider(imageKey), async url => resolveImageUrlForClient(url));
  for (const image of images) {
    await audit(input.storyId, "image", { page: image.page, taskId: image.taskId, model: "runware:400@4", status: image.status, costUSD: image.costUSD ?? null, costKnown: image.costUSD !== undefined });
    if (image.url) {
      try { const uploaded = await maybeUploadImageUrlToBucket(image.url, { prefix: "images/book-workshop", filenameHint: image.taskId }); if (uploaded) image.url = uploaded.url; } catch { /* Keep the provider URL; mark persistence in follow-up ops. */ }
    }
  }
  const allowedTraits = new Set(["knowledge", "creativity", "vocabulary", "courage", "curiosity", "teamwork", "empathy", "persistence", "logic"]);
  const developments = heroes.map(hero => ({ avatarId: hero.id, name: hero.name, changedTraits: result.review!.developments
    .filter(d => d.heroId === hero.id && allowedTraits.has(d.trait) && d.evidence.every(e => grounded(e, result.manuscript!)))
    .filter((d, i, rows) => rows.findIndex(r => r.trait === d.trait) === i).slice(0, 2)
    .map(({ trait, change, description }) => ({ trait, change, description })) }));

  let pendingArtifact: StorybookGeneratedStory["pendingArtifact"];
  const artifact = artifacts.find(a => a.id === result.plan!.artifactId);
  const artifactEvidence = result.review.artifactEvidence;
  if (artifact && artifactEvidence && input.storyId) {
    if (artifact.broughtBy) await recordBroughtArtifact({ storyId: input.storyId, artifactId: artifact.id, avatarId: artifact.broughtBy, chapterCount: result.manuscript.pages.length });
    else {
      await recordStoryArtifact(input.storyId, artifact.id, artifactEvidence.discovery.page, artifactEvidence.use.page);
      const row = artifactRows.find(r => r.id === artifact.id);
      pendingArtifact = { id: artifact.id, name: artifact.name, nameEn: row?.name_en, description: config.language === "en" ? row?.description_en : row?.description_de,
        category: row?.category, rarity: row?.rarity, storyRole: artifact.rule, visualKeywords: row?.visual_keywords || [], emoji: row?.emoji,
        imageUrl: await buildArtifactImageUrlForClient(artifact.id, artifact.imageUrl), discoveryChapter: artifactEvidence.discovery.page, usageChapter: artifactEvidence.use.page, locked: true };
    }
  }
  const totalPrompt = result.receipts.reduce((n, r) => n + r.promptTokens, 0), totalCompletion = result.receipts.reduce((n, r) => n + r.completionTokens, 0);
  const imageCosts = imageAccounting(images);
  const imagesAccounted = imageCosts.complete;
  const imageCostUSD = imagesAccounted ? imageCosts.providerCostUSD : undefined;
  return {
    title: result.manuscript.title, description: result.manuscript.description, displayMode: "reading_pages",
    coverImageUrl: images.find(i => i.page === 1)?.url,
    chapters: result.manuscript.pages.map(p => ({ id: `book-${p.order}`, title: `${p.order}`, content: p.text, order: p.order,
      imageUrl: images.find(i => i.page === p.order)?.url, imagePrompt: images.find(i => i.page === p.order)?.prompt, imageModel: "runware:400@4" })),
    avatarDevelopments: developments, pendingArtifact,
    metadata: {
      pipeline: result.pipeline, generationMode: result.pipeline, model: writer, storyModel: writer, supportModel: reviewer,
      releaseReady: true, processingTime: Date.now() - startedAt, displayMode: "reading_pages",
      imagesGenerated: images.filter(i => i.url).length, imageCalls: images.filter(i => i.attempted).length, imageCostUSD,
      tokensUsed: { prompt: totalPrompt, completion: totalCompletion, total: totalPrompt + totalCompletion, totalCostUSD: result.textCostUSD, modelUsed: writer },
      devModeStages: result.receipts.map(r => ({ stage: r.stage, modelUsed: r.model, modelRole: r.stage === "manuscript" || r.stage === "revision" ? "selected-story" : "support", durationMs: r.durationMs,
        usage: { prompt: r.promptTokens, completion: r.completionTokens, total: r.promptTokens + r.completionTokens, costUSD: r.costUSD }, costSource: r.costSource, note: r.costSource })),
      bookWorkshop: { premise: result.plan.premise, plan: result.plan, review: result.review, manuscriptHash: result.manuscriptHash, textAccountingComplete: result.accountingComplete,
        providerTextCostUSD: result.providerTextCostUSD, estimatedTextCostUSD: result.estimatedTextCostUSD,
        imageCosts, imageAccountingComplete: imagesAccounted, imageReviewStatus: "not-visually-reviewed", imagesComplete: images.every(i => i.status === "generated"), imageReceipts: images.map(({ page, taskId, status, attempted, costUSD }) => ({ page, taskId, status, attempted, costUSD: costUSD ?? null })) },
    },
  };
}
