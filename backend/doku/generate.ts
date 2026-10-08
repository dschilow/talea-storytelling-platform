import { api, APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { ai } from "~encore/clients";
import { logTopic } from "../log/logger";
import { publishWithTimeout } from "../helpers/pubsubTimeout";
import { resolveImageUrlForClient } from "../helpers/bucket-storage";
import { getAuthData } from "~encore/auth";
import { claimGenerationUsage, refundGenerationUsage } from "../helpers/billing";
import { extractParticipantProfileIds, extractRequestedProfileId } from "../helpers/profile-context";
import {
  assertProfilesBelongToUser,
  ensureDefaultProfileForUser,
  getProfileForUser,
  resolveRequestedProfileId,
} from "../helpers/profiles";
import {
  assertParentalDailyLimit,
  buildGenerationGuidanceFromControls,
  getParentalControlsForUser,
  sanitizeTextWithBlockedTerms,
} from "../helpers/parental-controls";
import {
  ageToAgeGroup,
  buildDokuProfilePrompt,
} from "../helpers/child-profile-personalization";
import { mapWithConcurrency } from "../helpers/asyncPool";
import {
  callOpenRouterChatCompletion,
  extractOpenRouterCostUSD,
  getOpenRouterModelPricing,
  isOpenRouterCreditLimitError,
} from "../story/openrouter-generation";
import { reserveDokuGenerationCapacity } from "./generation-capacity";
import {
  buildDokuPayload,
  DOKU_FALLBACK_REASONING_EFFORT,
  DOKU_FALLBACK_WRITER_MODEL,
  normalizeDokuOutput,
  parseDokuJson,
  resolveSectionsCount,
  toDokuContent,
  type NormalizedDokuOutput,
} from "./doku-prompt";
import { applyFactCheck, buildFactCheckPayload, parseFactCheckIssues, resolveFactCheckModel } from "./doku-factcheck";
import { DOKU_IMAGE_QA_MODEL, parseTextCheck, renderTextFreeImage, TEXT_CHECK_SYSTEM, TEXT_CHECK_USER } from "./doku-images";

const dokuDB = SQLDatabase.named("doku");
const avatarDB = SQLDatabase.named("avatar");
const IMAGE_COST_PER_ITEM = 0.0008;
const DEFAULT_DOKU_SECTION_IMAGE_CONCURRENCY = 2;

const COSMOS_DOMAIN_META: Record<string, { title: string; icon: string }> = {
  space: { title: "Weltraum", icon: "space" },
  nature: { title: "Natur & Tiere", icon: "nature" },
  history: { title: "Geschichte & Kulturen", icon: "history" },
  tech: { title: "Technik & Erfindungen", icon: "tech" },
  body: { title: "Mensch & Koerper", icon: "body" },
  earth: { title: "Erde & Klima", icon: "earth" },
  arts: { title: "Kunst & Musik", icon: "arts" },
  logic: { title: "Logik & Raetsel", icon: "logic" },
};

function normalizeCosmosDomainId(value: string | null | undefined): string {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  const normalized = raw === "art" ? "arts" : raw;
  return normalized
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_")
    .slice(0, 40);
}

function toCosmosDomainLabel(domainId: string): string {
  const known = COSMOS_DOMAIN_META[domainId]?.title;
  if (known) return known;
  return domainId
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
    .slice(0, 64) || "Neue Lernwelt";
}

async function registerGeneratedDomainForProfiles(domainIdRaw: string | undefined, profileIds: string[]): Promise<void> {
  const domainId = normalizeCosmosDomainId(domainIdRaw);
  if (!domainId) return;

  const meta = COSMOS_DOMAIN_META[domainId];
  await avatarDB.exec`
    INSERT INTO domains (domain_id, title, icon, created_at)
    VALUES (
      ${domainId},
      ${meta?.title || toCosmosDomainLabel(domainId)},
      ${meta?.icon || domainId},
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (domain_id) DO NOTHING
  `;

  for (const profileId of profileIds) {
    await avatarDB.exec`
      INSERT INTO tracking_domain_state (child_id, domain_id, evolution_index, planet_level, updated_at)
      VALUES (${profileId}, ${domainId}, 0, 1, CURRENT_TIMESTAMP)
      ON CONFLICT (child_id, domain_id) DO NOTHING
    `;
  }
}

// Domain types for Doku mode (Galileo/Checker Tobi style)
export type DokuDepth = "basic" | "standard" | "deep";
export type DokuAgeGroup = "3-5" | "6-8" | "9-12" | "13+";

/** "Wow card": a surprising fact the section text does not already say. */
export interface DokuKeyFact {
  title: string;
  fact: string;
  /** Everyday comparison that makes the fact tangible (since 2026-10). */
  comparison?: string;
  /** Older dokus: why the fact matters. */
  whyItMatters?: string;
}

export interface DokuQuizQuestion {
  question: string;
  options: string[];
  answerIndex: number;
  explanation?: string;
  skillType?: "REMEMBER" | "UNDERSTAND" | "COMPARE" | "TRANSFER" | "EXPLAIN";
  difficulty?: number;
}

export interface DokuActivityItem {
  title: string;
  description: string;
  materials?: string[];
  steps?: string[];
  /** What happens and why. */
  observe?: string;
  safetyNote?: string;
  durationMinutes?: number;
}

export interface DokuInteractive {
  quiz?: {
    enabled: boolean;
    questions: DokuQuizQuestion[];
  };
  activities?: {
    enabled: boolean;
    items: DokuActivityItem[];
  };
}

export interface DokuExpert {
  /** Real profession, e.g. "Käsermeisterin". */
  role: string;
  name?: string;
}

export interface DokuSection {
  title: string;
  content: string; // markdown/text
  keyFacts: DokuKeyFact[];
  /** "station": Tavi on location; "wissen": calm explanation of the core mechanism. */
  kind?: "station" | "wissen";
  place?: string;
  expert?: DokuExpert;
  /** The question this section answers. */
  miniQuestion?: string;
  imageIdea?: string; // textual idea for possible image
  sectionImagePrompt?: string; // English Runware-optimized prompt (AI-generated)
  imageUrl?: string; // generated section image URL
  interactive?: DokuInteractive;
}

/** The "Rate mal" question at the start, resolved in the finale. */
export interface DokuGuess {
  question: string;
  options: string[];
  answerIndex: number;
  reveal?: string;
}

/**
 * Stored doku content. The reportage frame (hook … closingLine) exists since
 * 2026-10; hook/mainQuestion/finale/wowFacts were already generated before
 * but never delivered. Every field must be declared here — Encore strips
 * undeclared fields from responses.
 */
export interface DokuContent {
  sections: DokuSection[];
  hook?: string;
  /** The Leitfrage. */
  mainQuestion?: string;
  guess?: DokuGuess;
  /** "Das hab ich heute gecheckt" — three short points. */
  recap?: string[];
  closingLine?: string;
  /** Older dokus: closing image and loose wow facts. */
  finale?: string;
  wowFacts?: string[];
}

export type DokuLanguage = "de" | "en" | "fr" | "es" | "it" | "nl" | "ru";

export interface DokuConfig {
  topic: string;
  depth: DokuDepth;
  ageGroup: DokuAgeGroup;
  domainId?: string;
  perspective?: "science" | "history" | "technology" | "nature" | "culture";
  includeInteractive?: boolean;
  quizQuestions?: number; // 0..10
  handsOnActivities?: number; // 0..5
  tone?: "fun" | "neutral" | "curious";
  length?: "short" | "medium" | "long";
  language?: DokuLanguage;
  parentalGuidance?: string;
  personalizationPrompt?: string;
}

export interface Doku {
  id: string;
  userId: string;
  primaryProfileId?: string;
  participantProfileIds?: string[];
  title: string;
  topic: string;
  summary: string;
  content: DokuContent;
  coverImageUrl?: string;
  isPublic: boolean;
  status: "generating" | "complete" | "error";
  metadata?: {
    tokensUsed?: {
      prompt: number;
      completion: number;
      total: number;
    };
    model?: string;
    /** Model that checked the facts and how many fixes it applied. */
    factCheck?: {
      model: string;
      issues: number;
      applied: number;
    };
    processingTime?: number;
    imagesGenerated?: number;
    /**
     * Einstellungen der Erzeugung. Muss hier stehen: Encore liefert in Antworten nur Felder aus, die im Typ
     * deklariert sind. Ohne diesen Eintrag kamen Kategorie/Alter/Tiefe nie im Frontend an (Quiz-Filter leer).
     */
    configSnapshot?: {
      topic?: string;
      domainId?: string | null;
      ageGroup?: DokuAgeGroup;
      depth?: DokuDepth;
      perspective?: "science" | "history" | "technology" | "nature" | "culture";
      tone?: "fun" | "neutral" | "curious";
      length?: "short" | "medium" | "long";
      includeInteractive?: boolean;
      quizQuestions?: number;
      handsOnActivities?: number;
      language?: string;
      parentalGuidanceActive?: boolean;
    };
    totalCost?: {
      text: number;
      images: number;
      total: number;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface GenerateDokuRequest {
  userId: string;
  profileId?: string;
  participantProfileIds?: string[];
  config: DokuConfig;
  /**
   * Client-chosen id (UUID). Generation takes longer than Railway's ~60 s edge
   * timeout; with a known id the wizard can poll GET /doku/:id after a cut-off
   * request instead of losing the finished doku.
   */
  dokuId?: string;
}

function uniqueTrimmed(values: string[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    )
  );
}

async function resolveProfileAvatarIds(params: {
  userId: string;
  profileIds: string[];
  defaultProfileId: string;
}): Promise<Map<string, string[]>> {
  const profiles = await Promise.all(
    params.profileIds.map((profileId) =>
      getProfileForUser({ userId: params.userId, profileId })
    )
  );
  const candidatesByProfile = new Map(
    profiles.map((profile) => [
      profile.id,
      uniqueTrimmed([
        ...(profile.childAvatarId ? [profile.childAvatarId] : []),
        ...profile.preferredAvatarIds,
      ]),
    ])
  );
  const candidateIds = uniqueTrimmed(Array.from(candidatesByProfile.values()).flat());
  const result = new Map(params.profileIds.map((profileId) => [profileId, [] as string[]]));
  if (candidateIds.length === 0) return result;

  const rows = await avatarDB.queryAll<{ id: string; profile_id: string | null }>`
    SELECT id, profile_id
    FROM avatars
    WHERE user_id = ${params.userId}
      AND id = ANY(${candidateIds})
  `;
  const rowsById = new Map(rows.map((row) => [row.id, row]));

  for (const profileId of params.profileIds) {
    const selected = (candidatesByProfile.get(profileId) || []).find((avatarId) => {
      const row = rowsById.get(avatarId);
      if (!row) return false;
      const ownerProfileId = row.profile_id || params.defaultProfileId;
      return ownerProfileId === profileId;
    });
    if (selected) result.set(profileId, [selected]);
  }

  return result;
}

const DOKU_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Keys whose strings are not shown to the reader (image prompts, enums). */
const NON_READER_KEYS = new Set(["sectionImagePrompt", "coverImagePrompt", "imageIdea", "imageUrl", "kind", "skillType"]);

/** Applies the parents' blocked terms to every reader-facing string of the doku. */
function sanitizeReaderText<T>(value: T, blockedTerms: string[], key = ""): T {
  if (typeof value === "string") {
    return (NON_READER_KEYS.has(key) ? value : sanitizeTextWithBlockedTerms(value, blockedTerms).text) as T;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeReaderText(entry, blockedTerms, key)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([entryKey, entry]) => [
        entryKey,
        sanitizeReaderText(entry, blockedTerms, entryKey),
      ])
    ) as T;
  }
  return value;
}

type DokuImageStats = { renders: number; rejectedForWriting: number; qaCostUSD: number };

/** Vision check for writing in a picture; undefined when the check is unavailable. */
async function imageShowsWriting(imageUrl: string, stats: DokuImageStats): Promise<boolean | undefined> {
  try {
    const viewUrl = await resolveImageUrlForClient(imageUrl);
    if (!viewUrl) return undefined;
    const result = await callOpenRouterChatCompletion({
      model: DOKU_IMAGE_QA_MODEL,
      messages: [
        { role: "system", content: TEXT_CHECK_SYSTEM },
        { role: "user", content: TEXT_CHECK_USER },
      ],
      imageInputs: [viewUrl],
      responseFormat: "json_object",
      maxTokens: 2000,
      reasoning: { effort: "low" },
      signal: AbortSignal.timeout(45_000),
    });
    stats.qaCostUSD += extractOpenRouterCostUSD(result.data) ?? 0;
    return parseTextCheck(String(result.data?.choices?.[0]?.message?.content || ""));
  } catch (error) {
    console.warn("[doku] image text check failed", error instanceof Error ? error.message : error);
    return undefined;
  }
}

/** One text-free illustration; a failed image never fails the doku. */
async function generateDokuImage(scene: string, dokuId: string, stats: DokuImageStats): Promise<string | undefined> {
  const result = await renderTextFreeImage(scene, {
    render: async (prompt, attempt) => {
      try {
        stats.renders += 1;
        const image = await ai.generateImage({
          prompt,
          width: 1024,
          height: 1024,
          steps: 4,
          CFGScale: 4,
          outputFormat: "JPEG",
          logContext: { storyId: dokuId, stage: attempt > 0 ? "doku-image-redraw" : "doku-image" },
        });
        return image.imageUrl;
      } catch (error) {
        console.warn("[doku] image generation failed", error instanceof Error ? error.message : error);
        return undefined;
      }
    },
    showsWriting: (url) => imageShowsWriting(url, stats),
  });
  stats.rejectedForWriting += result.rejected;
  return result.url;
}

function cleanJsonContent(data: any): { content: string; finishReason?: string } {
  const choice = data?.choices?.[0];
  return { content: String(choice?.message?.content || ""), finishReason: choice?.finish_reason };
}

type WriterResult = {
  output: NormalizedDokuOutput;
  model: string;
  tokens: { prompt: number; completion: number };
  costUSD: number;
};

/**
 * Writes the doku. A broken answer (cut-off or invalid JSON, almost no sections)
 * is retried once with a model of another family — the old single call simply
 * failed the doku (3 of 7 flash-lite runs in the 2026-10-08 A/B).
 */
async function writeDokuText(config: DokuConfig, timeoutMs: number): Promise<WriterResult> {
  const payload = buildDokuPayload(config);
  const expectedSections = resolveSectionsCount(config.length);
  const attempts = [
    { model: payload.model, effort: payload.reasoningEffort },
    { model: DOKU_FALLBACK_WRITER_MODEL, effort: DOKU_FALLBACK_REASONING_EFFORT },
  ];
  const spent = { prompt: 0, completion: 0, costUSD: 0 };
  let lastError: unknown;

  for (const attempt of attempts) {
    try {
      const result = await callOpenRouterChatCompletion({
        model: attempt.model,
        messages: payload.messages,
        responseFormat: "json_object",
        maxTokens: payload.maxTokens,
        reasoning: { effort: attempt.effort },
        signal: AbortSignal.timeout(timeoutMs),
      });
      const usage = result.data?.usage ?? {};
      spent.prompt += Number(usage.prompt_tokens ?? 0);
      spent.completion += Number(usage.completion_tokens ?? 0);
      const pricing = getOpenRouterModelPricing(attempt.model);
      spent.costUSD +=
        extractOpenRouterCostUSD(result.data) ??
        (Number(usage.prompt_tokens ?? 0) / 1_000_000) * pricing.inputCostPer1M +
          (Number(usage.completion_tokens ?? 0) / 1_000_000) * pricing.outputCostPer1M;

      await publishWithTimeout(logTopic, {
        source: "openrouter-doku-generation",
        timestamp: new Date(),
        request: { model: attempt.model, messages: payload.messages },
        response: result.data,
      });

      const { content, finishReason } = cleanJsonContent(result.data);
      const output = normalizeDokuOutput(parseDokuJson(content, finishReason), config);
      if (output.sections.length < Math.max(2, expectedSections - 2)) {
        throw new Error(`Doku writer returned ${output.sections.length} usable sections (expected ${expectedSections})`);
      }
      return {
        output,
        model: attempt.model,
        tokens: { prompt: spent.prompt, completion: spent.completion },
        costUSD: spent.costUSD,
      };
    } catch (error) {
      lastError = error;
      if (isOpenRouterCreditLimitError(error)) break;
      console.warn(`[doku] writer attempt with ${attempt.model} failed`, error instanceof Error ? error.message : error);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Doku writer failed");
}

/** Never fails the doku: without a usable answer the text stays as written. */
async function factCheckDokuText(
  output: NormalizedDokuOutput,
  config: DokuConfig,
  writerModel: string
): Promise<{ model: string; issues: number; applied: number; costUSD: number } | undefined> {
  const checker = resolveFactCheckModel(writerModel);
  try {
    const payload = buildFactCheckPayload(output, config);
    const result = await callOpenRouterChatCompletion({
      model: checker.model,
      messages: payload.messages,
      responseFormat: "json_object",
      maxTokens: payload.maxTokens,
      reasoning: { effort: checker.effort },
      signal: AbortSignal.timeout(90_000),
    });
    const { content, finishReason } = cleanJsonContent(result.data);
    const issues = parseFactCheckIssues(parseDokuJson(content, finishReason));
    const outcome = applyFactCheck(output, issues);
    if (issues.length > 0) {
      console.info(`[doku] fact check ${checker.model}: ${issues.length} issue(s)`, {
        applied: outcome.applied,
        skipped: outcome.skipped,
      });
    }
    return {
      model: checker.model,
      issues: issues.length,
      applied: outcome.applied.length,
      costUSD: extractOpenRouterCostUSD(result.data) ?? 0,
    };
  } catch (error) {
    console.warn(`[doku] fact check with ${checker.model} failed`, error instanceof Error ? error.message : error);
    return undefined;
  }
}

function resolveDokuGenerationTimeoutMs(length?: DokuConfig["length"]): number {
  if (length === "long") return 240_000;
  if (length === "medium") return 180_000;
  return 120_000;
}

function resolveDokuSectionImageConcurrency(): number {
  const raw = Number.parseInt(process.env.TALEA_DOKU_SECTION_IMAGE_CONCURRENCY || "", 10);
  if (!Number.isFinite(raw)) {
    return DEFAULT_DOKU_SECTION_IMAGE_CONCURRENCY;
  }
  return Math.max(1, Math.min(4, raw));
}

export const generateDoku = api<GenerateDokuRequest, Doku>(
  { expose: true, method: "POST", path: "/doku/generate", auth: true },
  async (req) => {
    const requestedId = typeof req.dokuId === "string" ? req.dokuId.trim() : "";
    if (requestedId && !DOKU_ID_PATTERN.test(requestedId)) {
      throw APIError.invalidArgument("dokuId must be a UUID");
    }
    const id = requestedId || crypto.randomUUID();
    const now = new Date();
    const auth = getAuthData();
    const currentUserId = auth?.userID;

    if (!currentUserId) {
      throw APIError.unauthenticated("Missing authenticated user for doku generation");
    }

    if (requestedId) {
      const existing = await dokuDB.queryRow<{ id: string }>`SELECT id FROM dokus WHERE id = ${requestedId}`;
      if (existing) {
        // A retried request (edge proxy, double tap) — the first one is still running.
        throw APIError.alreadyExists("Doku generation already started for this id");
      }
    }

    if (req.userId && req.userId !== currentUserId) {
      throw APIError.permissionDenied("userId mismatch: request userId does not match authenticated user");
    }

    const clerkToken = auth?.clerkToken;
    if (!clerkToken) {
      throw APIError.unauthenticated("Missing Clerk token for billing");
    }

    const parentalControls = await getParentalControlsForUser(currentUserId);
    const dayStartUtc = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    const usageToday = await dokuDB.queryRow<{ count: number }>`
      SELECT COUNT(*)::int AS count
      FROM dokus
      WHERE user_id = ${currentUserId}
        AND created_at >= ${dayStartUtc}
    `;
    assertParentalDailyLimit({
      controls: parentalControls,
      kind: "doku",
      usedToday: usageToday?.count ?? 0,
    });

    const parentalGuidance = buildGenerationGuidanceFromControls(parentalControls);
    const config: DokuConfig = {
      ...req.config,
      parentalGuidance: parentalGuidance || undefined,
    };
    const normalizedDomainId = normalizeCosmosDomainId(config.domainId);
    if (normalizedDomainId) {
      config.domainId = normalizedDomainId;
    }
    const blockedTerms = parentalControls.enabled ? parentalControls.blockedTerms : [];
    const requestedPrimaryProfileId = req.profileId ?? extractRequestedProfileId(req);
    const primaryProfileId = await resolveRequestedProfileId({
      userId: currentUserId,
      requestedProfileId: requestedPrimaryProfileId,
      fallbackName: auth?.email ?? undefined,
    });
    const primaryProfile = await getProfileForUser({
      userId: currentUserId,
      profileId: primaryProfileId,
    });
    const defaultProfile = await ensureDefaultProfileForUser(
      currentUserId,
      auth?.email ?? undefined,
    );
    const requestedParticipants = extractParticipantProfileIds(req);
    const participantProfileIds = uniqueTrimmed([
      primaryProfileId,
      ...(
        requestedParticipants.length > 0
          ? await assertProfilesBelongToUser(currentUserId, requestedParticipants)
          : []
      ),
    ]);
    const profileAvatarIds = await resolveProfileAvatarIds({
      userId: currentUserId,
      profileIds: participantProfileIds,
      defaultProfileId: defaultProfile.id,
    });
    const inferredAgeGroup = ageToAgeGroup(primaryProfile.age);
    const personalizationPrompt = buildDokuProfilePrompt(primaryProfile);
    config.ageGroup = config.ageGroup || inferredAgeGroup || "6-8";
    config.personalizationPrompt = personalizationPrompt || config.personalizationPrompt;
    await reserveDokuGenerationCapacity({
      userId: currentUserId,
      createReservation: async (tx) => {
        await tx.exec`
          INSERT INTO dokus (id, user_id, primary_profile_id, title, topic, content, cover_image_url, is_public, status, created_at, updated_at)
          VALUES (${id}, ${currentUserId}, ${primaryProfileId}, 'Wird generiert...', ${config.topic}, ${JSON.stringify({ sections: [] })}, NULL, false, 'generating', ${now}, ${now})
        `;
      },
    });

    const startTime = Date.now();
    let imagesGenerated = 0;
    // Reserved up front, refunded in the catch below unless the doku is saved.
    let coinReserved = false;

    try {
      await claimGenerationUsage({
        userId: currentUserId,
        kind: "doku",
        profileId: primaryProfileId,
        contentRef: id,
        clerkToken,
      });
      coinReserved = true;

      for (const participantProfileId of participantProfileIds) {
        await dokuDB.exec`
          INSERT INTO doku_participants (
            id,
            doku_id,
            profile_id,
            avatar_ids,
            created_at
          )
          VALUES (
            ${crypto.randomUUID()},
            ${id},
            ${participantProfileId},
            ${JSON.stringify(profileAvatarIds.get(participantProfileId) || [])}::jsonb,
            ${now}
          )
          ON CONFLICT (doku_id, profile_id) DO UPDATE
          SET avatar_ids = EXCLUDED.avatar_ids
        `;

        await dokuDB.exec`
          INSERT INTO doku_profile_state (
            profile_id,
            doku_id,
            is_favorite,
            progress_pct,
            completion_state,
            created_at,
            updated_at
          )
          VALUES (
            ${participantProfileId},
            ${id},
            FALSE,
            0,
            'not_started',
            ${now},
            ${now}
          )
          ON CONFLICT (profile_id, doku_id) DO NOTHING
        `;
      }

      const writer = await writeDokuText(config, resolveDokuGenerationTimeoutMs(config.length));
      const output = writer.output;

      // Images only need the image prompts, so they render while the fact check reads the text.
      const coverScene =
        output.coverImagePrompt ||
        output.sections.find((section) => section.sectionImagePrompt)?.sectionImagePrompt ||
        config.topic;
      const imageJobs: Array<{ target: "cover" | number; scene: string }> = [
        { target: "cover", scene: coverScene },
        ...output.sections.map((section, index) => ({
          target: index,
          scene: section.sectionImagePrompt || section.imageIdea || "",
        })),
      ];
      const imageStats: DokuImageStats = { renders: 0, rejectedForWriting: 0, qaCostUSD: 0 };
      const [factCheck, imageResults] = await Promise.all([
        factCheckDokuText(output, config, writer.model),
        mapWithConcurrency(imageJobs, resolveDokuSectionImageConcurrency(), async (job) => ({
          target: job.target,
          imageUrl: job.scene ? await generateDokuImage(job.scene, id, imageStats) : undefined,
        })),
      ]);

      let coverImageUrl: string | undefined;
      for (const result of imageResults) {
        if (!result.imageUrl) continue;
        imagesGenerated += 1;
        if (result.target === "cover") coverImageUrl = result.imageUrl;
        else output.sections[result.target].imageUrl = result.imageUrl;
      }
      // A cover that kept showing writing was dropped: the first clean section picture stands in.
      coverImageUrl ??= output.sections.find((section) => section.imageUrl)?.imageUrl;
      if (imageStats.rejectedForWriting > 0) {
        console.info(`[doku] ${imageStats.rejectedForWriting} picture(s) redrawn or dropped for visible writing`, { dokuId: id });
      }

      const finalOutput = blockedTerms.length > 0 ? sanitizeReaderText(output, blockedTerms) : output;

      const processingTime = Date.now() - startTime;
      const textCost = writer.costUSD + (factCheck?.costUSD ?? 0) + imageStats.qaCostUSD;
      const imagesCost = imageStats.renders * IMAGE_COST_PER_ITEM;

      const metadata = {
        tokensUsed: {
          prompt: writer.tokens.prompt,
          completion: writer.tokens.completion,
          total: writer.tokens.prompt + writer.tokens.completion,
        },
        model: writer.model,
        ...(factCheck ? { factCheck: { model: factCheck.model, issues: factCheck.issues, applied: factCheck.applied } } : {}),
        processingTime,
        imagesGenerated,
        configSnapshot: {
          topic: config.topic,
          domainId: config.domainId || null,
          ageGroup: config.ageGroup,
          depth: config.depth,
          perspective: config.perspective ?? "science",
          tone: config.tone ?? "curious",
          length: config.length ?? "medium",
          includeInteractive: config.includeInteractive ?? false,
          quizQuestions: config.quizQuestions ?? 0,
          handsOnActivities: config.handsOnActivities ?? 0,
          language: config.language ?? "de",
          parentalGuidanceActive: Boolean(config.parentalGuidance),
        },
        totalCost: {
          text: textCost,
          images: imagesCost,
          total: textCost + imagesCost,
        },
      };

      await dokuDB.exec`
        UPDATE dokus
        SET title = ${finalOutput.title},
            content = ${JSON.stringify(finalOutput)},
            cover_image_url = ${coverImageUrl ?? null},
            status = 'complete',
            metadata = ${JSON.stringify(metadata)},
            updated_at = ${new Date()}
        WHERE id = ${id}
      `;

      try {
        await registerGeneratedDomainForProfiles(config.domainId, participantProfileIds);
      } catch (domainSyncError) {
        console.warn("Failed to register generated doku domain for cosmos", domainSyncError);
      }

      // Avatar growth is awarded only after this doku is actually completed.
      // The mark-read endpoint resolves one explicit avatar target and never broadcasts.

      const resolvedCoverImageUrl = await resolveImageUrlForClient(coverImageUrl);

      // Resolve section image URLs for client response
      const resolvedSections = await Promise.all(
        finalOutput.sections.map(async (section) => {
          if (section.imageUrl) {
            const resolvedUrl = await resolveImageUrlForClient(section.imageUrl);
            return { ...section, imageUrl: resolvedUrl || section.imageUrl };
          }
          return section;
        })
      );

      return {
        id,
        userId: currentUserId,
        primaryProfileId,
        participantProfileIds,
        title: finalOutput.title,
        topic: config.topic,
        summary: finalOutput.summary,
        content: toDokuContent(finalOutput, resolvedSections),
        coverImageUrl: resolvedCoverImageUrl ?? coverImageUrl,
        isPublic: false,
        status: "complete",
        metadata,
        createdAt: now,
        updatedAt: new Date(),
      };
    } catch (err) {
      const failed = await dokuDB.queryRow<{ id: string }>`
        UPDATE dokus SET status = 'error', updated_at = ${new Date()}
        WHERE id = ${id} AND status <> 'complete'
        RETURNING id
      `;
      // A doku that was already saved keeps its coin even if a later step failed.
      if (coinReserved && failed) {
        await refundGenerationUsage({
          userId: currentUserId,
          kind: "doku",
          contentRef: id,
          reason: err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200),
        });
      }
      throw err;
    }
  }
);
