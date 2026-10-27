/**
 * Storybook Mode Story Generation (storybook-v2) — the Bilderbuch-Modus.
 *
 * An independent generation lane; it does not import or modify the dev-mode,
 * standard or book-workshop engines. This file is the Encore adapter: it loads
 * what the story needs from the database, runs the pure engine in
 * ./storybook/engine.ts, illustrates the result and records side effects.
 *
 * The lane, in one line per stage (models in ./storybook/llm.ts):
 *
 *   casting      pool shortlist + artifact per wizard (brought = mandatory)
 *   concept      3 pitches on 3 proven picture-book engines        gpt-6-luna
 *   plan         strongest pitch → page plan                       gpt-6-luna
 *   draft        the story                                         wizard model
 *   review       cold read, 0-10 against real picture books        other family
 *   revision     whole story once more with every note             wizard model
 *   final-ab     draft vs revision, blind                          other family
 *   illustration one action shot per page, ≤3 characters           gpt-6-luna
 *   images       per-page identity sheet + vision check + 1 retry  runware + luna
 *   development  trait growth with a reason from the text          gpt-6-luna
 *
 * Why it was rebuilt (storybook-v1, measured): premises came from a bank whose
 * variation axes swapped objects independently and produced incoherent
 * situations; one model wrote, judged and line-edited; a connective quota made
 * the prose stiff; the page images used one sprite of the whole cast, which is
 * how children grew animal ears.
 */

import { createHash } from "crypto";
import { ai } from "~encore/clients";
import { publishWithTimeout } from "../helpers/pubsubTimeout";
import { logTopic } from "../log/logger";
import { resolveImageUrlForClient } from "../helpers/bucket-storage";
import { buildArtifactImageUrlForClient } from "../helpers/image-proxy";
import { acceptedGeneratedImageUrl } from "../helpers/imageResultGuard";
import { recordStoryArtifact } from "./artifact-matcher";
import { recordBroughtArtifact } from "./artifact-treasury";
import { normalizeAgeBand, resolveLengthBudget } from "./storybook/craft";
import { buildBrief } from "./storybook/context";
import { loadArtifactOptions, loadCastCandidates, recordCastUsage } from "./storybook/casting";
import { loadHeroMemories, loadStorybookHistory } from "./storybook/history";
import { CostLedger, resolveStorybookModels } from "./storybook/llm";
import { createOpenRouterStorybookLlm } from "./storybook/llm-openrouter";
import { runStorybookTextEngine, STORYBOOK_PIPELINE_ID } from "./storybook/engine";
import { runWonderTextEngine, WONDER_PIPELINE_ID } from "./wonder/engine";
import { wonderBudget } from "./wonder/library";
import { EPISODE_PIPELINE_ID, resolveEpisodeServiceTier, runEpisodeTextEngine } from "./episode/engine";
import { episodeBudget, episodeProductionLlm, episodeProductionModels, episodeVisionModel } from "./episode/craft";
import { chapterPictures, coverStandIn, directEpisodePictures, type EpisodeDirection } from "./episode/pictures";
import { prepareGuestPortraits } from "./episode/guest-portraits";
import type { EpisodeResult } from "./episode/types";
import { castAppearance, describeReferenceLooks, heroAppearance, MODERN_CHILDRENS_BOOK_STYLE, runDirectorStage, speciesFromProfile, type VisualEntity } from "./storybook/illustration-stage";
import { generateStorybookImages, publishableImageUrl, type ImageProvider, type StorybookImagesResult } from "./storybook/images";
import { createOpenRouterJevPort } from "./storybook/jev-openrouter";
import { resolveOpenRouterApiKey } from "./openrouter-generation";
import { storybookQuality } from "./storybook/quality";
import { runDevelopmentStage } from "./storybook/developments";
import { learningGoal } from "./storybook/learning";
import { artifactHeadToken, countWords } from "./storybook/checks";
import { LIBRARY_IMAGE_MODEL, LIBRARY_IMAGE_STEPS } from "./library/images";
import type { CastCandidate, StorybookGeneratedStory, StorybookGenerationInput } from "./storybook/types";

export { STORYBOOK_PIPELINE_ID };
export type { StorybookGenerationInput, StorybookGeneratedStory, StorybookHero } from "./storybook/types";

/**
 * FLUX.2 [klein] 4B (runware:400@4), 4 steps, 1024², acceleration high, CFG 4. Switched from the 9B
 * (runware:400@2) on 2026-10-15 after scripts/image-bench (1,298 pictures, docs/bild-modelle-benchmark-
 * 2026-10-15.de.md): across all runs 90 % usable vs 85 % for the 9B (not significant), ~0.13 ¢ vs ~0.19 ¢
 * per picture. The A/B of 2026-09-29 (14/16 vs 7/16 clean for the 9B) ran on an older prompt and sheet
 * pipeline and is not reproduced by the current one. Override: TALEA_STORYBOOK_IMAGE_MODEL (set it to
 * runware:400@2 to go back).
 */
export const IMAGE_MODEL = process.env.TALEA_STORYBOOK_IMAGE_MODEL || "runware:400@4";


function stableSeed(input: StorybookGenerationInput): string {
  return createHash("sha256")
    .update([input.storyId || "", input.userId || "", input.heroes.map((hero) => hero.name).join("|"), input.config.genre || "", input.config.setting || ""].join("::"))
    .digest("hex")
    .slice(0, 16);
}

async function logStage(storyId: string | undefined, stage: string, payload: Record<string, unknown>, pipeline: string = STORYBOOK_PIPELINE_ID): Promise<void> {
  try {
    await publishWithTimeout(logTopic as any, {
      source: "storybook-generation-stage",
      timestamp: new Date(),
      request: { pipeline, stage, storyId },
      response: payload,
      metadata: { pipeline, stage, storyId },
    });
  } catch {
    // Logging must never take generation down.
  }
}

function pageTitle(language: string | undefined, order: number): string {
  const lang = String(language || "de").toLowerCase();
  if (lang.startsWith("en")) return `Page ${order}`;
  if (lang.startsWith("fr")) return `Page ${order}`;
  if (lang.startsWith("es")) return `Página ${order}`;
  if (lang.startsWith("it")) return `Pagina ${order}`;
  if (lang.startsWith("nl")) return `Pagina ${order}`;
  if (lang.startsWith("ru")) return `Страница ${order}`;
  return `Seite ${order}`;
}

function imageSteps(model: string): number {
  if (model === LIBRARY_IMAGE_MODEL) return LIBRARY_IMAGE_STEPS;
  const configured = Number(process.env.TALEA_STORYBOOK_IMAGE_STEPS);
  return Number.isFinite(configured) && configured >= 4 && configured <= 28 ? Math.round(configured) : 4;
}

/** Runware through the ai service; stored URL for the story, readable URL for the vision check. */
export function encoreImageProvider(storyId: string | undefined, model = IMAGE_MODEL): ImageProvider {
  return async (request) => {
    const image = await ai.generateImage({
      prompt: request.prompt,
      negativePrompt: request.negativePrompt,
      model,
      width: request.width,
      height: request.height,
      steps: imageSteps(model),
      ...(model === LIBRARY_IMAGE_MODEL ? {} : { CFGScale: 4 }),
      seed: request.seed,
      outputFormat: model === LIBRARY_IMAGE_MODEL ? "WEBP" : "JPEG",
      referenceImages: request.referenceImages.length > 0 ? request.referenceImages : undefined,
      logContext: { storyId, stage: request.logStage || (request.page === 0 ? "storybook-image-cover" : "storybook-image-page"), chapter: request.logStage ? undefined : request.page || undefined },
    });
    const url = acceptedGeneratedImageUrl(image) || undefined;
    const response = (image as any)?.debugInfo?.responseReceived;
    const rows = Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : [];
    const costUSD = rows.reduce((sum: number, row: any) => sum + (Number(row?.cost) > 0 ? Number(row.cost) : 0), 0);
    const viewUrl = url ? await resolveImageUrlForClient(url).catch(() => undefined) : undefined;
    const httpStatus = Number((image as any)?.debugInfo?.responseStatus) || undefined;
    // The client already waited and retried; a refusal now means the provider is limiting us.
    const refused = !url && (httpStatus === 429 || httpStatus === 402 || (httpStatus !== undefined && httpStatus >= 500));
    return { url, viewUrl, costUSD, ...(refused ? { refused: true, httpStatus } : {}) };
  };
}

export async function readableReference(imageUrl: string | undefined): Promise<string | undefined> {
  if (!imageUrl) return undefined;
  try {
    const resolved = await resolveImageUrlForClient(imageUrl);
    return resolved && /^(https?:|data:image\/)/i.test(resolved) ? resolved : undefined;
  } catch {
    return undefined;
  }
}

export async function generateStoryStorybookMode(input: StorybookGenerationInput): Promise<StorybookGeneratedStory> {
  const startedAt = Date.now();
  const { config } = input;
  const wonderMode = config.storybookEngine === WONDER_PIPELINE_ID;
  // Talea-Folge: the Originals' method for the family's own heroes (chapters with titles, like wonder).
  const episodeMode = config.storybookEngine === EPISODE_PIPELINE_ID;
  const imageModel = episodeMode ? LIBRARY_IMAGE_MODEL : IMAGE_MODEL;
  const chapterMode = wonderMode || episodeMode;
  const pipelineId = episodeMode ? EPISODE_PIPELINE_ID : wonderMode ? WONDER_PIPELINE_ID : STORYBOOK_PIPELINE_ID;
  const ledger = new CostLedger();
  const resolved = resolveStorybookModels(config, { critic: process.env.TALEA_STORYBOOK_CRITIC_MODEL || undefined });
  const models = episodeMode ? episodeProductionModels() : resolved;
  const band = normalizeAgeBand(config.ageGroup);
  const budget = episodeMode ? episodeBudget(config.length, band) : wonderMode ? wonderBudget(config.length, band) : resolveLengthBudget(config.length, band);
  const seed = stableSeed(input);
  const avatarIds = input.heroes.map((hero) => String(hero.id || "")).filter(Boolean);

  // -------------------------------------------------------------------------
  // 0) Everything the story is built from, loaded in parallel.
  // -------------------------------------------------------------------------
  const [history, heroMemories, candidates, artifacts] = await Promise.all([
    loadStorybookHistory({ userId: input.userId, currentStoryId: input.storyId }),
    loadHeroMemories(avatarIds),
    loadCastCandidates({
      enabled: config.useCharacterPool !== false,
      preferLead: episodeMode && config.avatarIsHero === false,
      genre: config.genre,
      setting: config.setting,
      band,
      excludeNames: new Set(input.heroes.map((hero) => hero.name.toLocaleLowerCase("de-DE"))),
      seed,
    }),
    loadArtifactOptions({ avatarIds, brought: config.broughtArtifact, genre: config.genre, language: config.language, seed }),
  ]);

  const brief = buildBrief({
    config,
    band,
    budget,
    heroes: input.heroes,
    candidates,
    artifacts,
    recentStories: history.recentStories,
    recentEngineIds: history.recentEngineIds,
    heroMemories,
    blockedTerms: input.blockedTerms,
    seed,
  });

  await logStage(input.storyId, "premise-and-cast", {
    models,
    band,
    budget,
    candidates: candidates.map((candidate) => ({ id: candidate.id, name: candidate.name, species: candidate.species, hasImage: Boolean(candidate.imageUrl) })),
    artifacts: artifacts.map((artifact) => ({ id: artifact.id, name: artifact.name, brought: Boolean(artifact.broughtBy) })),
    recentStories: history.recentStories.length,
  }, pipelineId);

  const openRouterLlm = createOpenRouterStorybookLlm({
    onFailedAttempt: (request, billed, error) => {
      if (billed) ledger.recordCall(`${request.stage}-failed`, billed, request.role);
      // Why a call had to be repeated (flex refused, empty, truncated): "Der Riese hinterm Teig" paid 5.9 ¢ instead of
      // 2.7 ¢ for its text after a flex call died in 1.9 s, and nothing in the story's log said why.
      void logStage(input.storyId, "llm-attempt-failed", {
        stage: request.stage,
        model: request.model,
        tier: request.serviceTier || "standard",
        billed: Boolean(billed),
        message: String((error as Error)?.message || error).slice(0, 300),
      }, pipelineId);
    },
  });
  // Flex covers every episode LLM call, and retries keep the same model.
  const llm = episodeMode ? episodeProductionLlm(openRouterLlm, resolveEpisodeServiceTier()) : openRouterLlm;

  // -------------------------------------------------------------------------
  // While the text is written, the picture side gets ready.
  // -------------------------------------------------------------------------
  // Story 5e583e1e (Talea-Folge, 223 s): after Sol's 111 s the pictures waited another 9 s for the looks read off the
  // portraits. The writer casts from these candidates, so their looks are read while it writes and the read after the
  // text finds them cached (for 24 h, so mostly only after a deploy). A candidate it leaves out costs ≈ 1,100 input
  // tokens: 0.01 ¢ on Luna, 0.05–0.1 ¢ on Terra.
  const heroEntity = async (hero: (typeof brief.heroes)[number]): Promise<VisualEntity> => {
    const { species, isHuman } = speciesFromProfile(hero.visualProfile, "human");
    return {
      id: hero.id,
      name: hero.name,
      kind: "character",
      role: "hero",
      species,
      isHuman,
      appearance: heroAppearance(hero.visualProfile, ""),
      forbidden: Array.isArray(hero.visualProfile?.forbiddenFeatures) ? hero.visualProfile.forbiddenFeatures.map(String) : [],
      referenceUrl: await readableReference(hero.imageUrl),
      referenceKey: hero.imageUrl,
    };
  };
  const castEntity = async (member: CastCandidate): Promise<VisualEntity> => {
    const { species, isHuman } = speciesFromProfile(member.visualProfile, member.species);
    return {
      id: member.id,
      name: member.name,
      kind: "character",
      role: "cast",
      species,
      isHuman,
      appearance: castAppearance(member.visualProfile, member.physicalDescription),
      forbidden: [],
      referenceUrl: await readableReference(member.imageUrl),
      referenceKey: member.imageUrl,
    };
  };
  const heroEntities = Promise.all(brief.heroes.map(heroEntity));
  const poolEntities = Promise.all(candidates.map(castEntity));
  const looksWarmUp = Promise.all([heroEntities, poolEntities])
    .then(([heroes, pool]) => describeReferenceLooks(llm, [...heroes, ...pool], models.support))
    .then((looks) => { if (looks.call) ledger.recordCall("reference-looks", looks.call, "support"); })
    .catch(() => undefined);

  // -------------------------------------------------------------------------
  // 1) Text: concept → plan → draft → review → revision → final A/B.
  // -------------------------------------------------------------------------
  const text = await (episodeMode ? runEpisodeTextEngine : wonderMode ? runWonderTextEngine : runStorybookTextEngine)({
    llm,
    brief,
    models,
    ledger,
    observe: (stage, payload) => logStage(input.storyId, stage, payload, pipelineId),
    // Planning and editorial review are separate Terra calls; only Sol writes or revises prose.
    ...(episodeMode ? { options: { mode: "two-step" as const, editorialReview: true, serviceTier: resolveEpisodeServiceTier() } } : {}),
  });
  const wonder = "wonder" in text ? (text as import("./wonder/types").WonderResult).wonder : undefined;
  const episode = "episode" in text ? (text as EpisodeResult).episode : undefined;
  const guests = wonder?.guests || episode?.guests || [];
  const { plan, pages } = text;
  const learning = learningGoal(config);

  // -------------------------------------------------------------------------
  // 2) Illustration direction, then images and developments in parallel.
  // -------------------------------------------------------------------------
  const castInStory = plan.cast
    .map((member) => candidates.find((candidate) => candidate.id === member.id) || guests.find(candidate => candidate.id === member.id))
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));
  const artifactOption = plan.artifact ? artifacts.find((artifact) => artifact.id === plan.artifact!.id) : undefined;

  const textDoneAt = Date.now();
  const poolById = new Map((await poolEntities).map((entity) => [entity.id, entity]));
  const entities: VisualEntity[] = [
    ...await heroEntities,
    ...await Promise.all(castInStory.map((member) => poolById.get(member.id) ?? castEntity(member))),
  ];
  if (artifactOption && plan.artifact) {
    entities.push({
      id: `artifact:${artifactOption.id}`,
      name: artifactOption.name,
      kind: "artifact",
      role: "artifact",
      species: "object",
      isHuman: false,
      appearance: artifactOption.visualKeywords.join(", ") || artifactOption.nameEn || artifactOption.name,
      forbidden: [],
      referenceUrl: await readableReference(artifactOption.imageUrl),
    });
  }

  // Everyone with a portrait was read while the text was written: this finds the looks cached (a call only when the
  // warm-up failed or the writer brought a figure it did not know).
  await looksWarmUp;
  const known = await describeReferenceLooks(llm, entities, models.support);
  if (known.call) ledger.recordCall("reference-looks", known.call, "support");

  // A new, story-local figure has no pool image. Its portrait is drawn from the writer's look — the same look the art
  // director reads — next to the direction instead of before it (story 5e583e1e waited 40 s between text and pictures);
  // the pictures then carry it on every relevant identity sheet. The looks are read from the unchanged entities, so the
  // cached ones are found again.
  const identities = episodeMode
    ? prepareGuestPortraits({ entities, guestIds: guests.map((guest) => guest.id), provider: encoreImageProvider(input.storyId, imageModel), seed, readableReference, portraitStyle: MODERN_CHILDRENS_BOOK_STYLE })
        .then(async (portraits) => {
          const looks = await describeReferenceLooks(llm, portraits.entities, models.support);
          if (looks.call) ledger.recordCall("reference-looks", looks.call, "support");
          return { ...portraits, entities: looks.entities };
        })
        .catch((err) => {
          console.warn("[storybook] guest portraits failed, the guests are drawn from their text look:", (err as Error)?.message || err);
          return { entities: known.entities, portraits: [], calls: 0, costUSD: 0 };
        })
    : Promise.resolve({ entities: known.entities, portraits: [], calls: 0, costUSD: 0 });
  // Talea-Folge draws two pictures per chapter, each after the paragraph it shows, and every acting figure at least once
  // (the chapter book's picture machinery, ./episode/pictures.ts). Every other lane: one picture per page.
  const directing: Promise<EpisodeDirection | undefined> = episodeMode
    ? directEpisodePictures({ llm, model: models.support, brief, title: text.title, pages, plan, entities: known.entities }).catch((err) => {
        console.warn("[storybook] chapter pictures could not be directed, one picture per chapter instead:", (err as Error)?.message || err);
        return undefined;
      })
    : Promise.resolve(undefined);
  const [guestPortraits, direction] = await Promise.all([identities, directing]);
  if (episodeMode) await logStage(input.storyId, "guest-portraits", {
    portraits: guestPortraits.portraits, calls: guestPortraits.calls, costUSD: guestPortraits.costUSD,
  }, pipelineId);
  const pictureEntities = guestPortraits.entities;
  const director = direction?.director ?? await runDirectorStage(llm, { brief, title: text.title, pages, plan, entities: pictureEntities }, models.support);
  if (director.call) ledger.recordCall("illustration-direction", director.call, "support");
  if (director.repairCall) ledger.recordCall("illustration-plan-repair", director.repairCall, "support");
  const illustrations = direction?.illustrations ?? director.illustrations;
  // The pages the picture stage sees: the reading segments in Talea-Folge, the story's pages elsewhere.
  const picturePages = direction?.pages ?? pages;
  const directedAt = Date.now();
  await logStage(input.storyId, "illustration-plan", {
    illustrations,
    ...(director.repairReasons?.length ? { repairReasons: director.repairReasons } : {}),
    ...(direction ? { placed: direction.placed, pictures: direction.notes, castPresence: direction.changes, figuresWithoutPicture: direction.unplaced } : {}),
  }, pipelineId);

  const emptyImages: StorybookImagesResult = { pages: new Map(), imagesGenerated: 0, imageCalls: 0, imageCostUSD: 0, qaCalls: [], regenerated: [] };
  const [images, development] = await Promise.all([
    generateStorybookImages({
      illustrations,
      entities: pictureEntities,
      provider: encoreImageProvider(input.storyId, imageModel),
      seed,
      llm,
      ...(episodeMode ? { imageStyle: MODERN_CHILDRENS_BOOK_STYLE, imagePromptProfile: "flux3-modern" as const } : {}),
      // Talea-Folge has seven pictures (cover + two per chapter): with four at a time the last three waited a full
      // round (story 5e583e1e, ≈ 15 s). Runware answers parallel requests; a 429 is retried by the image client.
      concurrency: 8,
      // TALEA_STORYBOOK_PARALLEL_REDRAW=off: redraw and heroes-only attempt one after another again. The spare costs a
      // picture (0.12 ¢, 0.25 ¢ on FLUX 3) and a vision read whenever the redraw passes, so it is drawn only when the
      // crowd is the trouble (crowdTrouble in storybook/images.ts); it saves ≈ 15 s whenever the redraw fails.
      parallelRedraw: process.env.TALEA_STORYBOOK_PARALLEL_REDRAW !== "off",
      visionModel: process.env.TALEA_STORYBOOK_IMAGE_QA === "off" ? undefined : episodeMode ? episodeVisionModel() : models.support,
      fallbackVisionModel: models.critic,
      jev: episodeMode || process.env.TALEA_STORYBOOK_IMAGE_QA === "off" ? undefined : createOpenRouterJevPort(resolveOpenRouterApiKey),
      pageTexts: Object.fromEntries(picturePages.map((page) => [page.order, page.content])),
      historical: !["modern", "scifi"].includes(config.genre || "") && ["fantasy", "medieval", "castle"].includes(config.setting || ""),
    }).catch((err): StorybookImagesResult => {
      console.warn("[storybook] image stage failed:", err);
      return emptyImages;
    }),
    runDevelopmentStage(llm, { heroes: brief.heroes, title: text.title, pages, learning: { goal: learning, core: plan.learningCore } }, models.support),
  ]);
  const imagesDoneAt = Date.now();
  images.qaCalls.forEach((call, index) => ledger.recordCall(`image-qa-${index + 1}`, call, "support"));
  images.jevCalls?.forEach((call, index) => ledger.recordCall(`image-jev-${index + 1}`, call, "support"));
  if (development.call) ledger.recordCall("avatar-development", development.call, "support");

  // -------------------------------------------------------------------------
  // 3) Side effects: pool rotation, artifact economy.
  // -------------------------------------------------------------------------
  await recordCastUsage(input.storyId, castInStory.filter(member => candidates.some(candidate => candidate.id === member.id)).map((member) => member.id));

  let pendingArtifact: StorybookGeneratedStory["pendingArtifact"];
  if (plan.artifact && artifactOption && input.storyId) {
    const head = artifactHeadToken(artifactOption.name);
    const pagesWithArtifact = pages.filter((page) => head.length >= 3 && page.content.toLocaleLowerCase("de-DE").includes(head)).map((page) => page.order);
    try {
      if (artifactOption.broughtBy) {
        // Mitnehmen-Loop: journal entry + level track, never a new artifact.
        await recordBroughtArtifact({ storyId: input.storyId, artifactId: artifactOption.id, avatarId: artifactOption.broughtBy, chapterCount: pages.length });
      } else if (pagesWithArtifact.length > 0) {
        // Awarded only when the prose really contains it; otherwise the
        // reader gets the shard fallback from the treasury economy.
        const discoveryChapter = pagesWithArtifact[0];
        const usageChapter = pagesWithArtifact.find((page) => page >= plan.artifact!.usePage) ?? pagesWithArtifact[pagesWithArtifact.length - 1];
        await recordStoryArtifact(input.storyId, artifactOption.id, discoveryChapter, usageChapter);
        pendingArtifact = {
          id: artifactOption.id,
          name: artifactOption.name,
          nameEn: artifactOption.nameEn,
          description: artifactOption.description,
          category: artifactOption.category,
          rarity: artifactOption.rarity,
          storyRole: artifactOption.rule,
          visualKeywords: artifactOption.visualKeywords,
          emoji: artifactOption.emoji,
          imageUrl: await buildArtifactImageUrlForClient(artifactOption.id, artifactOption.imageUrl),
          discoveryChapter,
          usageChapter,
          locked: true,
        };
      }
    } catch (err) {
      console.warn("[storybook] could not record the story artifact:", err);
    }
  }

  // -------------------------------------------------------------------------
  // 4) Assemble.
  // -------------------------------------------------------------------------
  const totals = ledger.totals();
  const wordCount = pages.reduce((sum, page) => sum + countWords(page.content), 0);
  const durationMs = Date.now() - startedAt;
  // Where the wait goes (story 5e583e1e had to be read off log timestamps): text includes casting and loading.
  const timingsMs = { text: textDoneAt - startedAt, pictureDirection: directedAt - textDoneAt, images: imagesDoneAt - directedAt, finish: Date.now() - imagesDoneAt };
  const quality = storybookQuality(text, images, picturePages.map((page) => page.order));
  const { releaseReady } = quality;
  // Talea-Folge: the delivered pictures of every chapter, each with the paragraph it follows.
  const pictures = direction ? chapterPictures(direction, images.pages) : [];
  const chapters: StorybookGeneratedStory["chapters"] = pages.map((page) => {
    if (direction) {
      const own = pictures.filter((picture) => picture.chapter === page.order);
      return {
        id: `folge-${page.order}`,
        title: page.title,
        content: page.content,
        order: page.order,
        imageUrl: own[0]?.url,
        imagePrompt: own[0]?.prompt,
        imageModel: own[0] ? imageModel : undefined,
        ...(own.length ? { images: own.map((picture) => ({ url: picture.url, afterParagraph: picture.afterParagraph })) } : {}),
      };
    }
    const image = images.pages.get(page.order);
    return {
      id: `${episodeMode ? "folge" : wonderMode ? "wonder" : "storybook"}-${page.order}`,
      title: chapterMode ? page.title : pageTitle(config.language, page.order),
      content: page.content,
      order: page.order,
      imageUrl: publishableImageUrl(image),
      imagePrompt: image?.prompt,
      imageModel: publishableImageUrl(image) ? imageModel : undefined,
    };
  });

  const metadata: Record<string, any> = {
    pipeline: pipelineId,
    generationMode: pipelineId,
    ...(wonder ? { wonder } : {}),
    ...(episode ? { episode: { mode: episode.mode, plan: episode.plan, checks: episode.checks, revised: episode.revised, renamed: episode.renamed } } : {}),
    model: models.writer,
    storyModel: models.writer,
    supportModel: models.support,
    criticModel: models.critic,
    processingTime: durationMs,
    timingsMs,
    displayMode: "reading_pages",
    imageModel,
    imagesGenerated: images.imagesGenerated,
    imageCalls: images.imageCalls + guestPortraits.calls,
    imageCostUSD: Number((images.imageCostUSD + guestPortraits.costUSD).toFixed(6)),
    tokensUsed: { prompt: totals.prompt, completion: totals.completion, total: totals.total, totalCostUSD: totals.costUSD, modelUsed: models.writer },
    devModeStages: ledger.all(),
    releaseReady,
    // The shared field every pipeline writes: the story list and the
    // participants dialog show the cast from here (they were missing for
    // Bilderbuch stories, 2026-09-28).
    characterPoolUsed: castInStory.filter(member => candidates.some(candidate => candidate.id === member.id)).map((member) => ({ characterId: member.id, characterName: member.name })),
    // Learning mode (2026-10-17): what the story set out to teach, what the writer committed to, what the read found.
    ...(learning ? { learning: { ...learning, core: plan.learningCore || null, read: text.review?.ledger?.learning ?? null } } : {}),
    quality: {
      ...quality,
      benchmarkScore: text.benchmarkScore,
      draftScore: text.draftScore,
      scale: episodeMode ? "Deterministic checks only; no numeric quality claim" : wonderMode ? "Evidence-based editorial review; no numeric quality claim" : "0-10 vs. published top picture books",
      releaseReady,
    },
    storybook: {
      engine: plan.engine,
      logline: plan.logline,
      band,
      pages: pages.length,
      wordCount,
      llmCalls: totals.calls,
      chosen: text.chosen,
      planRepaired: text.planRepaired,
      draftRetried: text.draftRetried,
      benchmarkScore: text.benchmarkScore,
      draftScore: text.draftScore,
      review: text.review,
      textQuality: text.textQuality,
      pairwise: text.pairwise,
      castUsed: castInStory.map((member) => ({ id: member.id, name: member.name })),
      ...(episodeMode ? { guestPortraits: guestPortraits.portraits } : {}),
      artifact: plan.artifact ? { ...plan.artifact, awarded: Boolean(pendingArtifact) } : null,
      hardIssues: text.finalChecks.hard.map((issue) => issue.message),
      softIssues: text.finalChecks.soft.map((issue) => issue.message),
      imageRegenerations: images.regenerated,
      imageQa: [...images.pages.values(), ...(images.cover ? [images.cover] : [])].map((outcome) => ({
        page: outcome.page,
        ...(direction && outcome.page > 0 ? { chapter: direction.slots[outcome.page - 1]?.chapter, afterParagraph: direction.placed[outcome.page - 1]?.afterParagraph } : {}),
        attempts: outcome.attempts,
        severity: outcome.severity,
        status: outcome.status,
        vignette: outcome.vignette || undefined,
        referenceLevel: outcome.referenceLevel,
        errors: outcome.errors,
        qa: outcome.qa,
      })),
      pitches: text.pitches.map((pitch) => ({ engine: pitch.engine, title: pitch.title, logline: pitch.logline })),
      plan,
    },
  };

  const imageOutcomes = [...(images.cover ? [images.cover] : []), ...images.pages.values()];
  // Story c2ff7f42 shipped without a cover. A book always has one: when the
  // cover itself failed, the first clean page picture with figures stands in.
  // Talea-Folge: a picture of the first half of the story, never the resolution of the last chapter
  // ("Der Riese hinterm Teig": the cover was chapter 3's picture).
  const standInPicture = direction ? coverStandIn(pictures) : undefined;
  const pageStandIn = pages
    .map((page) => images.pages.get(page.order))
    .find((outcome) => outcome?.status === "passed" && !outcome.vignette && outcome.url);
  const coverImageUrl = publishableImageUrl(images.cover) || (direction ? standInPicture?.url : pageStandIn?.url);
  await logStage(input.storyId, "complete", {
    title: text.title,
    imagesMissing: direction
      ? direction.slots.filter((_, index) => !publishableImageUrl(images.pages.get(index + 1))).map((slot) => `${slot.chapter}.${slot.part + 1}`)
      : pages.filter((page) => !publishableImageUrl(images.pages.get(page.order))).map((page) => page.order),
    coverMissing: !publishableImageUrl(images.cover),
    coverFromPage: !publishableImageUrl(images.cover) ? (direction ? standInPicture?.chapter : pageStandIn?.page) : undefined,
    ...(direction ? { pictures: pictures.length, figuresWithoutPicture: direction.unplaced } : {}),
    imageDeliveryIssues: imageOutcomes.filter((outcome) => outcome.errors?.length).map((outcome) => ({ page: outcome.page, referenceLevel: outcome.referenceLevel, errors: outcome.errors })),
    pages: pages.length,
    wordCount,
    llmCalls: totals.calls,
    textCostUSD: totals.costUSD,
    imageCostUSD: Number((images.imageCostUSD + guestPortraits.costUSD).toFixed(6)),
    totalCostUSD: Number((totals.costUSD + images.imageCostUSD + guestPortraits.costUSD).toFixed(6)),
    benchmarkScore: text.benchmarkScore,
    draftScore: text.draftScore,
    chosen: text.chosen,
    releaseReady,
    quality,
    textQuality: text.textQuality,
    // Every attempt with its reason and picture: story 26fdd23f lost the cover and two pages after ten calls, and the
    // log kept only the last verdict.
    imageQa: imageOutcomes.map(({ page, status, severity, attempts, qa, vignette, history }) => ({ page, status, severity, attempts, ...(vignette ? { vignette } : {}), qa, ...(history?.length ? { history } : {}) })),
    // The checks are booked with the text calls (textCostUSD); this is their share, next to the picture calls.
    imageCalls: images.imageCalls + guestPortraits.calls,
    imageCheckCostUSD: Number(images.qaCalls.reduce((sum, call) => sum + (call.usage?.costUSD || 0), 0).toFixed(6)),
    durationMs,
    timingsMs,
  }, pipelineId);

  return {
    title: text.title,
    description: text.description,
    coverImageUrl,
    displayMode: "reading_pages",
    chapters,
    avatarDevelopments: development.developments,
    pendingArtifact,
    metadata,
  };
}
