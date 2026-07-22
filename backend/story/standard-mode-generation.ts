/**
 * Standard Mode Story Generation (standard-quality-v1)
 *
 * User-facing default pipeline. Uses the PROVEN dev-mode quality engine
 * (screenplay-first-v12 in dev-mode-generation.ts) as the prose + image core
 * — the dev pipeline itself is NOT modified — and layers the standard product
 * features around it:
 *
 *   1. Memory continuity: recent avatar memories are condensed into a short
 *      continuity anchor that is appended to each avatar's description before
 *      it enters the engine's character grounding block.
 *   2. Supporting cast: pool characters are auto-cast via the engine's own
 *      scorer (`pickDevModePoolCharacters`) so catchphrases, quirks and speech
 *      styles flow into the Voice Bible exactly like in dev mode.
 *   3. Artifact red thread: the engine self-selects an artifact from
 *      `artifact_pool`, weaves it into the prose and records it in
 *      `story_artifacts`; this module additionally builds the `pendingArtifact`
 *      payload (locked until the story is read — unlock happens in markRead).
 *   4. Avatar development: a dedicated support-model stage reads the FINAL
 *      story text and derives per-avatar trait growth (9 base traits +
 *      knowledge subcategories) with a story-specific description for every
 *      change. The caller (`generate.ts`) applies them through the existing
 *      personality/memory flow.
 *
 * Everything in here is best-effort except the engine call itself: memory
 * loading, development extraction and artifact hydration must NEVER break
 * story generation.
 */

import {
  generateStoryDevMode,
  pickDevModePoolCharacters,
  recordDevModePoolCharacterUsage,
} from "./dev-mode-generation";
import type { DevModeAvatar, DevModeGeneratedStory, DevModeMatchedArtifact } from "./dev-mode-generation";
import { callOpenRouterChatCompletion } from "./openrouter-generation";
import type { StoryConfig, StoryLanguage } from "./generate";
import type { ArtifactCategory, ArtifactRequirement, ArtifactTemplate } from "./types";
import { storyDB } from "./db";
import { avatarDB } from "../avatar/db";
import { buildArtifactImageUrlForClient } from "../helpers/image-proxy";
import { publishWithTimeout } from "../helpers/pubsubTimeout";
import { logTopic } from "../log/logger";
import { assignAvatarDevelopmentIds } from "./avatar-development-assignment";
import { artifactMatcher } from "./artifact-matcher";
import {
  getOwnedPoolIdsUnion,
  loadArtifactTemplateById,
  loadCrownArtifactIds,
  recordBroughtArtifact,
} from "./artifact-treasury";

const STANDARD_MODE_PIPELINE_ID = "standard-quality-v1";
const STANDARD_MODE_SUPPORT_MODEL = "google/gemini-3.5-flash-lite";
const MAX_STORY_CHARS_FOR_DEVELOPMENT = 9_000;
const MAX_MEMORY_ANCHOR_TITLES = 2;

const BASE_TRAIT_IDS = [
  "knowledge",
  "creativity",
  "vocabulary",
  "courage",
  "curiosity",
  "teamwork",
  "empathy",
  "persistence",
  "logic",
] as const;

const KNOWLEDGE_SUBCATEGORY_IDS = [
  "knowledge.biology",
  "knowledge.history",
  "knowledge.physics",
  "knowledge.geography",
  "knowledge.astronomy",
  "knowledge.mathematics",
  "knowledge.chemistry",
] as const;

const ALLOWED_TRAIT_IDS = new Set<string>([...BASE_TRAIT_IDS, ...KNOWLEDGE_SUBCATEGORY_IDS]);

export interface StandardModeAvatarInput {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  visualProfile?: any;
  personalityTraits?: any;
}

export interface StandardModeGenerationInput {
  config: StoryConfig;
  userId: string;
  storyId: string;
  avatars: StandardModeAvatarInput[];
  primaryProfileAge?: number | null;
}

export interface StandardModeAvatarDevelopment {
  avatarId: string;
  name: string;
  changedTraits: Array<{ trait: string; change: number; description?: string }>;
}

export interface StandardModePendingArtifact {
  id: string;
  name: string;
  nameEn?: string;
  description?: string;
  category?: string;
  rarity?: string;
  storyRole?: string;
  visualKeywords?: string[];
  emoji?: string;
  imageUrl?: string;
  discoveryChapter: number;
  usageChapter: number;
  locked: true;
}

export interface StandardModeGeneratedStory {
  title: string;
  description: string;
  coverImageUrl?: string;
  chapters: DevModeGeneratedStory["chapters"];
  avatarDevelopments: StandardModeAvatarDevelopment[];
  pendingArtifact?: StandardModePendingArtifact;
  metadata: Record<string, any>;
}

/**
 * Generates a story on the standard (user-facing) path with dev-mode prose
 * quality plus the full feature set: memory continuity in, avatar
 * developments + artifact unlock out.
 */
export async function generateStoryStandardMode(
  input: StandardModeGenerationInput
): Promise<StandardModeGeneratedStory> {
  const { config, userId, storyId } = input;

  // 0) Treasury casting: pre-select the story artifact BEFORE the engine runs.
  //    Either the artifact a participating avatar brings along from their
  //    Schatzkammer (Mitnehmen-Loop) or a fresh pool pick that excludes
  //    everything the participating avatars already own plus all set-crown
  //    rewards. Passing `matchedArtifact` makes the engine skip its own
  //    selection while its exposure/suppression logic stays untouched.
  const artifactCasting = await preselectStoryArtifact({
    config,
    userId,
    storyId,
    avatarIds: input.avatars.map((a) => a.id).filter((id): id is string => Boolean(id)),
  });

  const engineConfig: StoryConfig = artifactCasting.broughtPromptHint
    ? {
        ...config,
        customPrompt: [config.customPrompt, artifactCasting.broughtPromptHint]
          .filter(Boolean)
          .join("\n"),
      }
    : config;

  // 1) Memory continuity anchors (best-effort).
  const memoryAnchors = await loadAvatarMemoryAnchors(
    input.avatars.map((a) => a.id),
    config.language
  );

  const engineAvatars: DevModeAvatar[] = input.avatars.map((a) => ({
    id: a.id,
    name: a.name,
    description: mergeDescriptionWithMemoryAnchor(a.description, memoryAnchors.get(a.id)),
    imageUrl: a.imageUrl,
    visualProfile: a.visualProfile,
    personalityTraits: a.personalityTraits,
  }));

  // 2) Supporting cast from character_pool (same auto-cast as dev mode).
  const poolCharacters = await pickDevModePoolCharacters({
    setting: config.setting,
    genre: config.genre,
    ageGroup: config.ageGroup,
    userId,
    excludeNames: new Set(input.avatars.map((a) => a.name.toLowerCase())),
    heroCount: input.avatars.length,
  });

  console.log("[standard-mode-generation] Auto-cast + memory anchors ready:", {
    storyId,
    poolCount: poolCharacters.length,
    poolNames: poolCharacters.map((c) => c.name),
    avatarsWithMemoryAnchor: engineAvatars.filter((a) => memoryAnchors.has(a.id || "")).length,
  });

  // 3) Prose + images via the proven quality engine. Editorial release review
  //    is always warning-only on the customer path: a renderable story must
  //    still receive its requested illustrations even when the critic wants
  //    further prose work. This also prevents stale/admin strict flags from
  //    silently turning a completed book into a text-only result.
  const devResult = await generateStoryDevMode({
    config: {
      ...engineConfig,
      strictQualityGates: false,
      strictReleaseGateMode: "warn",
    },
    userId,
    storyId,
    avatars: engineAvatars,
    poolCharacters,
    primaryProfileAge: input.primaryProfileAge,
    qualityMode: "premium",
    matchedArtifact: artifactCasting.matchedArtifact,
  });

  // Mitnehmen-Loop: persist who brought the artifact regardless of how deeply
  // the engine wove it in — the journey must count for the travel journal.
  if (artifactCasting.broughtBy && artifactCasting.matchedArtifact) {
    await recordBroughtArtifact({
      storyId,
      artifactId: artifactCasting.matchedArtifact.id,
      avatarId: artifactCasting.broughtBy,
      chapterCount: devResult.chapters.length,
    });
  }

  await recordDevModePoolCharacterUsage({
    storyId,
    poolCharacters,
    selectedSupportingCast: devResult.metadata.selectedSupportingCast,
  }).catch((err) => {
    console.warn("[standard-mode-generation] recordDevModePoolCharacterUsage failed:", err);
  });

  // 4) Avatar development extraction from the FINAL accepted story text.
  const development = await deriveAvatarDevelopments({
    config,
    avatars: input.avatars,
    title: devResult.title,
    chapters: devResult.chapters,
  });

  // 5) Pending artifact payload for the unlock-after-reading flow. The engine
  //    already recorded `story_artifacts`; this hydrates the display payload.
  //    Brought artifacts are NOT a pending reward — the reader already owns
  //    them; their payoff is the journal entry + level track in markRead.
  const pendingArtifact = artifactCasting.broughtBy
    ? undefined
    : await buildPendingArtifact(
        devResult.metadata?.matchedArtifact?.id,
        config.language,
        devResult.chapters.length
      );

  type StageUsageEntry = {
    stage: string;
    usage?: { prompt: number; completion: number; total: number };
    modelUsed?: string;
    modelRole?: "support" | "selected-story";
    durationMs?: number;
    score?: number;
  };
  const stageEntries: StageUsageEntry[] = Array.isArray(devResult.metadata?.devModeStages)
    ? [...devResult.metadata.devModeStages]
    : [];
  if (development.stageEntry) {
    stageEntries.push(development.stageEntry);
  }

  const tokensUsed = {
    ...devResult.metadata.tokensUsed,
    prompt: (devResult.metadata.tokensUsed?.prompt || 0) + development.usage.prompt,
    completion: (devResult.metadata.tokensUsed?.completion || 0) + development.usage.completion,
    total: (devResult.metadata.tokensUsed?.total || 0) + development.usage.total,
  };

  // Feature-level observability: one log entry per run showing what the
  // standard layer added around the engine (the engine publishes its own
  // per-stage logs). Best-effort.
  await publishWithTimeout(logTopic, {
    source: "standard-mode-generation" as any,
    timestamp: new Date(),
    request: {
      storyId,
      pipeline: STANDARD_MODE_PIPELINE_ID,
      avatarNames: input.avatars.map((a) => a.name),
      poolCharacterNames: poolCharacters.map((c) => c.name),
    },
    response: {
      title: devResult.title,
      qualityScore: devResult.metadata.qualityScore,
      releaseReady: devResult.metadata.releaseReady,
      qualityGateFailureReason: devResult.metadata.qualityGateFailureReason,
      avatarDevelopments: development.developments,
      avatarDevelopmentUsage: development.usage,
      matchedArtifact: devResult.metadata.matchedArtifact,
      pendingArtifactName: pendingArtifact?.name,
      selectedSupportingCast: devResult.metadata.selectedSupportingCast,
      imagesGenerated: devResult.metadata.imagesGenerated,
    },
  }).catch((err) => {
    console.warn("[standard-mode-generation] Failed to publish feature log:", err);
  });

  return {
    title: devResult.title,
    description: devResult.description,
    coverImageUrl: devResult.coverImageUrl,
    chapters: devResult.chapters,
    avatarDevelopments: development.developments,
    pendingArtifact,
    metadata: {
      ...devResult.metadata,
      tokensUsed,
      devModeStages: stageEntries,
      developerMode: false,
      generationMode: STANDARD_MODE_PIPELINE_ID,
      // Parity with the previous pipeline's quality block so existing
      // dashboards/consumers keep working without caring about the engine.
      quality: {
        criticScore: devResult.metadata.qualityScore ?? devResult.metadata.rawQualityScore,
        criticSummary: devResult.metadata.qualityGateFailureReason,
        releaseReady: devResult.metadata.releaseReady,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Memory continuity
// ---------------------------------------------------------------------------

const MEMORY_ANCHOR_TEMPLATES: Record<StoryLanguage, (titles: string[]) => string> = {
  de: (t) => `Hat fruehere Abenteuer erlebt und erinnert sich besonders an ${t.map((x) => `"${x}"`).join(" und ")}.`,
  en: (t) => `Has lived through earlier adventures and especially remembers ${t.map((x) => `"${x}"`).join(" and ")}.`,
  fr: (t) => `A vecu des aventures precedentes et se souvient surtout de ${t.map((x) => `"${x}"`).join(" et ")}.`,
  es: (t) => `Ha vivido aventuras anteriores y recuerda especialmente ${t.map((x) => `"${x}"`).join(" y ")}.`,
  it: (t) => `Ha vissuto avventure precedenti e ricorda soprattutto ${t.map((x) => `"${x}"`).join(" e ")}.`,
  nl: (t) => `Heeft eerdere avonturen beleefd en herinnert zich vooral ${t.map((x) => `"${x}"`).join(" en ")}.`,
  ru: (t) => `Уже пережил(а) приключения и особенно помнит ${t.map((x) => `"${x}"`).join(" и ")}.`,
};

// Ultra-short fallback used when the avatar description is long. The engine's
// compact draft builder squeezes descriptions through compactExcerpt(110),
// which keeps only the last ~37 characters of the tail — the anchor must fit
// in that window INCLUDING its continuity marker, or the model just sees a
// cryptic title fragment (verified in run 74c95422 on 2026-06-12).
const MEMORY_ANCHOR_SHORT_TEMPLATES: Record<StoryLanguage, (title: string) => string> = {
  de: (t) => `Held aus "${t}".`,
  en: (t) => `Hero of "${t}".`,
  fr: (t) => `Heros de "${t}".`,
  es: (t) => `Heroe de "${t}".`,
  it: (t) => `Eroe di "${t}".`,
  nl: (t) => `Held uit "${t}".`,
  ru: (t) => `Герой "${t}".`,
};

const MEMORY_ANCHOR_SHORT_TITLE_CHARS = 22;
// compactExcerpt(110) keeps head(63) + " … " + tail(37). A combined
// description at or below this budget passes through completely untruncated.
const MEMORY_ANCHOR_FULL_BUDGET_CHARS = 100;

function clipAnchorTitle(title: string, maxChars: number): string {
  const trimmed = title.trim();
  return trimmed.length <= maxChars ? trimmed : `${trimmed.slice(0, maxChars - 1).trimEnd()}…`;
}

/**
 * Loads the most recent memory titles per avatar (stories preferred over
 * dokus) and renders one continuity sentence in the story language. Returns an
 * empty map on any failure — memories are flavor, never a blocker.
 */
async function loadAvatarMemoryAnchors(
  avatarIds: string[],
  language: StoryLanguage | undefined
): Promise<Map<string, { full: string; short: string }>> {
  const anchors = new Map<string, { full: string; short: string }>();
  const ids = avatarIds.filter(Boolean);
  if (ids.length === 0) return anchors;

  try {
    const rows = await avatarDB.queryAll<{
      avatar_id: string;
      story_title: string | null;
      content_type: string | null;
    }>`
      WITH ranked AS (
        SELECT
          avatar_id,
          story_title,
          content_type,
          ROW_NUMBER() OVER (PARTITION BY avatar_id ORDER BY created_at DESC) AS recent_rank,
          ROW_NUMBER() OVER (
            PARTITION BY avatar_id
            ORDER BY is_pinned DESC, importance DESC,
              CASE memory_tier WHEN 'core' THEN 0 WHEN 'episodic' THEN 1 ELSE 2 END,
              created_at DESC
          ) AS important_rank
        FROM avatar_memories
        WHERE avatar_id = ANY(${ids})
      )
      SELECT avatar_id, story_title, content_type
      FROM ranked
      WHERE recent_rank = 1 OR important_rank = 1
      ORDER BY avatar_id, CASE WHEN recent_rank = 1 THEN 0 ELSE 1 END, important_rank
      LIMIT 60
    `;

    const titlesByAvatar = new Map<string, string[]>();
    for (const row of rows) {
      const title = String(row.story_title || "").trim();
      if (!title || /generier|generating|wird erstellt/i.test(title)) continue;
      const list = titlesByAvatar.get(row.avatar_id) || [];
      if (list.length >= MAX_MEMORY_ANCHOR_TITLES || list.includes(title)) continue;
      list.push(title);
      titlesByAvatar.set(row.avatar_id, list);
    }

    const lang = language ?? "de";
    const fullTemplate = MEMORY_ANCHOR_TEMPLATES[lang] ?? MEMORY_ANCHOR_TEMPLATES.de;
    const shortTemplate = MEMORY_ANCHOR_SHORT_TEMPLATES[lang] ?? MEMORY_ANCHOR_SHORT_TEMPLATES.de;
    for (const [avatarId, titles] of titlesByAvatar) {
      if (titles.length === 0) continue;
      anchors.set(avatarId, {
        full: fullTemplate(titles.map((t) => clipAnchorTitle(t, 48))).slice(0, 200),
        short: shortTemplate(clipAnchorTitle(titles[0], MEMORY_ANCHOR_SHORT_TITLE_CHARS)),
      });
    }
  } catch (err) {
    console.warn("[standard-mode-generation] Loading avatar memories failed (continuing without):", err);
  }

  return anchors;
}

function mergeDescriptionWithMemoryAnchor(
  description: string | undefined,
  anchor: { full: string; short: string } | undefined
): string | undefined {
  const base = String(description || "").trim();
  if (!anchor) return base || undefined;
  if (!base) return anchor.full;
  const joined = `${base}${/[.!?]$/.test(base) ? "" : "."} `;
  // Long descriptions get squeezed through compactExcerpt(110) downstream;
  // only an anchor that fits the ~37-char tail window survives readable.
  const fitsFull = joined.length + anchor.full.length <= MEMORY_ANCHOR_FULL_BUDGET_CHARS;
  return `${joined}${fitsFull ? anchor.full : anchor.short}`;
}

// ---------------------------------------------------------------------------
// Avatar development stage
// ---------------------------------------------------------------------------

interface DevelopmentStageResult {
  developments: StandardModeAvatarDevelopment[];
  usage: { prompt: number; completion: number; total: number };
  stageEntry?: {
    stage: string;
    usage: { prompt: number; completion: number; total: number };
    modelUsed: string;
    modelRole: "support";
    durationMs: number;
  };
}

function summarizeTraitSnapshot(personalityTraits: any): string {
  if (!personalityTraits || typeof personalityTraits !== "object") return "no traits yet";
  const parts: string[] = [];
  for (const baseId of BASE_TRAIT_IDS) {
    const raw = personalityTraits[baseId];
    const value =
      typeof raw === "number"
        ? raw
        : raw && typeof raw === "object" && typeof raw.value === "number"
          ? raw.value
          : 0;
    if (value > 0) parts.push(`${baseId}=${Math.round(value)}`);
    const subs = raw && typeof raw === "object" ? raw.subcategories : undefined;
    if (subs && typeof subs === "object") {
      for (const [sub, subValue] of Object.entries(subs)) {
        const numeric =
          typeof subValue === "number"
            ? subValue
            : subValue && typeof subValue === "object" && typeof (subValue as any).value === "number"
              ? (subValue as any).value
              : 0;
        if (numeric > 0) parts.push(`${baseId}.${sub}=${Math.round(numeric)}`);
      }
    }
  }
  return parts.length > 0 ? parts.slice(0, 10).join(", ") : "all traits at 0";
}

function buildDevelopmentPrompts(input: {
  config: StoryConfig;
  avatars: StandardModeAvatarInput[];
  title: string;
  storyText: string;
}): { systemPrompt: string; userPrompt: string } {
  const language = input.config.language || "de";
  const avatarLines = input.avatars
    .map((a, idx) => `${idx + 1}. ${a.name} — current traits: ${summarizeTraitSnapshot(a.personalityTraits)}`)
    .join("\n");
  const avatarIdentityLines = input.avatars
    .map((avatar) => `avatarId=${avatar.id}; name=${avatar.name}`)
    .join("\n");

  const systemPrompt = [
    "You are the character-growth analyst of a children's storytelling platform.",
    "You read one finished children's story and decide how each hero avatar grew through the events they actually experienced on the page.",
    "Output STRICT JSON only. No markdown fences, no comments, no extra keys.",
  ].join(" ");

  const userPrompt = [
    `HERO AVATARS (only these may appear in the output):`,
    avatarIdentityLines,
    "CURRENT TRAITS:",
    avatarLines,
    "",
    `STORY TITLE: ${input.title}`,
    "STORY TEXT:",
    input.storyText,
    "",
    "ALLOWED TRAIT IDS (use EXACTLY these ids, nothing else):",
    `- Base traits: ${BASE_TRAIT_IDS.join(", ")}`,
    `- Knowledge subcategories (ONLY when the story genuinely teaches that subject): ${KNOWLEDGE_SUBCATEGORY_IDS.join(", ")}`,
    "",
    "RULES:",
    "1. Exactly one entry per hero avatar. Copy avatarId and name exactly as listed above.",
    "2. 1-3 changedTraits per avatar. Pick only traits clearly supported by that avatar's own actions/decisions in the text.",
    "3. change is an integer: 1-3 for base traits, 1-5 for knowledge.* subcategories. Small story-sized steps; 3+ only for a defining moment.",
    `4. description: ONE short sentence in language "${language}" naming the concrete story moment that caused the growth (the WHY). Never a generic sentence like "developed through reading".`,
    "5. Prefer base traits. Use a knowledge.* subcategory only when the avatar demonstrably learned facts of that subject in the story.",
    "",
    "OUTPUT JSON SHAPE:",
    '{ "avatarDevelopments": [ { "avatarId": "<avatar id>", "name": "<avatar name>", "changedTraits": [ { "trait": "<trait id>", "change": <int>, "description": "<one sentence>" } ] } ] }',
  ].join("\n");

  return { systemPrompt, userPrompt };
}

function parseJsonObjectLoose(content: string): any | undefined {
  const trimmed = String(content || "").trim();
  if (!trimmed) return undefined;
  const candidates = [trimmed];
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) candidates.unshift(fenced[1].trim());
  const braceStart = trimmed.indexOf("{");
  const braceEnd = trimmed.lastIndexOf("}");
  if (braceStart >= 0 && braceEnd > braceStart) {
    candidates.push(trimmed.slice(braceStart, braceEnd + 1));
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      // try next candidate
    }
  }
  return undefined;
}

function sanitizeDevelopments(
  parsed: any,
  avatars: StandardModeAvatarInput[]
): StandardModeAvatarDevelopment[] {
  const rawList = Array.isArray(parsed?.avatarDevelopments) ? parsed.avatarDevelopments : [];
  return assignAvatarDevelopmentIds(rawList, avatars)
    .map((development) => ({
      avatarId: development.avatarId,
      name: development.name,
      changedTraits: development.changedTraits
        .filter((change) => ALLOWED_TRAIT_IDS.has(change.trait))
        .map((change) => ({
          ...change,
          change: Math.min(
            change.trait.startsWith("knowledge.") ? 5 : 3,
            change.change,
          ),
          description: change.description.slice(0, 220),
        }))
        .slice(0, 3),
    }))
    .filter((development) => development.changedTraits.length > 0);
}

/**
 * Derives AI-driven avatar trait developments from the final story text using
 * the cheap support model. Never throws: on any failure the caller falls back
 * to the existing genre-based defaults in generate.ts.
 */
async function deriveAvatarDevelopments(input: {
  config: StoryConfig;
  avatars: StandardModeAvatarInput[];
  title: string;
  chapters: DevModeGeneratedStory["chapters"];
}): Promise<DevelopmentStageResult> {
  const empty: DevelopmentStageResult = {
    developments: [],
    usage: { prompt: 0, completion: 0, total: 0 },
  };
  if (input.avatars.length === 0 || input.chapters.length === 0) return empty;

  const storyText = input.chapters
    .map((ch) => `${ch.title}\n${ch.content}`)
    .join("\n\n")
    .slice(0, MAX_STORY_CHARS_FOR_DEVELOPMENT);

  const prompts = buildDevelopmentPrompts({ ...input, storyText });
  const startedAt = Date.now();

  try {
    const controller = new AbortController();
    const handle = setTimeout(() => controller.abort(), 60_000);
    let res: Awaited<ReturnType<typeof callOpenRouterChatCompletion>>;
    try {
      res = await callOpenRouterChatCompletion({
        model: STANDARD_MODE_SUPPORT_MODEL,
        messages: [
          { role: "system", content: prompts.systemPrompt },
          { role: "user", content: prompts.userPrompt },
        ],
        responseFormat: "json_object",
        maxTokens: 1400,
        temperature: 0.2,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(handle);
    }

    const content = res.data?.choices?.[0]?.message?.content;
    const usageRaw = res.data?.usage || {};
    const usage = {
      prompt: Number(usageRaw.prompt_tokens || 0),
      completion: Number(usageRaw.completion_tokens || 0),
      total: Number(usageRaw.total_tokens || 0),
    };

    const developments = sanitizeDevelopments(
      parseJsonObjectLoose(typeof content === "string" ? content : ""),
      input.avatars
    );

    console.log("[standard-mode-generation] Avatar development stage finished:", {
      avatarCount: input.avatars.length,
      developmentCount: developments.length,
      traits: developments.flatMap((d) => d.changedTraits.map((t) => `${d.name}:${t.trait}+${t.change}`)),
      durationMs: Date.now() - startedAt,
    });

    return {
      developments,
      usage,
      stageEntry: {
        stage: "avatar-development",
        usage,
        modelUsed: STANDARD_MODE_SUPPORT_MODEL,
        modelRole: "support",
        durationMs: Date.now() - startedAt,
      },
    };
  } catch (err) {
    console.warn("[standard-mode-generation] Avatar development stage failed (fallback to genre defaults):", err);
    return empty;
  }
}

// ---------------------------------------------------------------------------
// Treasury casting (pre-selection before the engine runs)
// ---------------------------------------------------------------------------

interface StoryArtifactCasting {
  matchedArtifact?: DevModeMatchedArtifact;
  /** Avatar id when the artifact comes from a Schatzkammer (Mitnehmen-Loop). */
  broughtBy?: string;
  /** Extra custom-prompt line so a brought artifact is carried from page 1. */
  broughtPromptHint?: string;
}

function templateToMatchedArtifact(
  template: ArtifactTemplate,
  language: StoryLanguage | undefined
): DevModeMatchedArtifact {
  const useEnglish = String(language || "de").toLowerCase().startsWith("en");
  const localizedName = useEnglish
    ? template.name?.en || template.name?.de
    : template.name?.de || template.name?.en;
  return {
    id: template.id,
    name: String(localizedName || "").trim(),
    nameEn: template.name?.en,
    category: template.category,
    rarity: template.rarity,
    storyRole: template.storyRole,
    visualKeywords: Array.isArray(template.visualKeywords) ? template.visualKeywords : [],
    emoji: template.emoji,
    imageUrl: template.imageUrl,
  };
}

/**
 * Mirrors the engine's genre→category bias (pickDevModeArtifactCategory in the
 * frozen dev-mode engine) so pre-selected artifacts feel identical to
 * engine-selected ones.
 */
function pickStandardModeArtifactCategory(config: StoryConfig): ArtifactCategory | undefined {
  const genre = String(config.genre || "").toLowerCase();
  if (/mystery|detective|krim/.test(genre)) return "tool";
  if (/learning|education|lern/.test(genre)) return "book";
  if (/nature|tier|animal|wald|forest/.test(genre)) return "nature";
  if (/friendship|freund/.test(genre)) return "jewelry";
  if (/fantasy|magic|magie|maerchen|märchen/.test(genre)) return "magic";
  if (/adventure|abenteuer|quest/.test(genre)) return "map";
  return undefined;
}

function buildBroughtArtifactPromptHint(
  artifact: DevModeMatchedArtifact,
  language: StoryLanguage | undefined
): string {
  const rule = String(artifact.storyRole || "").trim();
  if (String(language || "de").toLowerCase().startsWith("de")) {
    return [
      `WICHTIG — MITGEBRACHTES ARTEFAKT: Die Kinder haben "${artifact.name}" von früheren Abenteuern dabei (von Anfang an im Gepäck, es wird NICHT neu entdeckt).`,
      rule ? `So funktioniert es: ${rule}` : "",
      "Es hilft höchstens einmal an einer entscheidenden Stelle und darf nur zeigen oder warnen, nie lösen.",
      "Das Artefakt gehört den Kindern: KEINE andere Figur besitzt, bringt oder überreicht es — die Kinder holen es selbst aus ihrem Gepäck.",
      "Im Finale handeln und entscheiden ausschließlich die Kinder selbst — die letzte Aktion gehört ihnen, nicht dem Artefakt und keinem Helfer.",
    ].filter(Boolean).join(" ");
  }
  return [
    `IMPORTANT — BROUGHT ARTIFACT: The children carry "${artifact.name}" from earlier adventures (with them from page 1, it is NOT newly discovered).`,
    rule ? `How it works: ${rule}` : "",
    "It may help at most once at a decisive moment and may only reveal or warn, never solve.",
    "The artifact belongs to the children: NO other character owns, brings, or hands it over — the children take it out of their own bag themselves.",
    "In the finale the children alone act and decide — the last action belongs to them, not to the artifact or any helper.",
  ].filter(Boolean).join(" ");
}

async function loadRecentStoryIdsForUser(userId: string, storyId: string, limit: number): Promise<string[]> {
  try {
    const rows = await storyDB.queryAll<{ id: string }>`
      SELECT id FROM stories
      WHERE user_id = ${userId} AND id <> ${storyId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return rows.map((row) => row.id).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Selects the story artifact before the engine runs. Never throws — on any
 * failure the engine simply falls back to its own internal selection.
 */
async function preselectStoryArtifact(input: {
  config: StoryConfig;
  userId: string;
  storyId: string;
  avatarIds: string[];
}): Promise<StoryArtifactCasting> {
  const { config, userId, storyId, avatarIds } = input;

  // Mitnehmen-Loop: a participating avatar carries an owned artifact along.
  // Ownership is verified server-side — the client only sends ids.
  const brought = config.broughtArtifact;
  if (brought?.artifactId && brought?.avatarId && avatarIds.includes(brought.avatarId)) {
    try {
      const ownedByBringer = (await getOwnedPoolIdsUnion([brought.avatarId]));
      if (!ownedByBringer.has(brought.artifactId)) {
        console.warn("[standard-mode-generation] Brought artifact is not owned by avatar; ignoring.", {
          storyId,
          artifactId: brought.artifactId,
          avatarId: brought.avatarId,
        });
        throw new Error("brought-artifact-not-owned");
      }
      const template = await loadArtifactTemplateById(brought.artifactId);
      if (template) {
        const matched = templateToMatchedArtifact(template, config.language);
        console.log("[standard-mode-generation] Using brought artifact from Schatzkammer:", {
          storyId,
          artifactId: matched.id,
          artifactName: matched.name,
          broughtBy: brought.avatarId,
        });
        return {
          matchedArtifact: matched,
          broughtBy: brought.avatarId,
          broughtPromptHint: buildBroughtArtifactPromptHint(matched, config.language),
        };
      }
      console.warn("[standard-mode-generation] Brought artifact not found in pool:", brought.artifactId);
    } catch (err) {
      console.warn("[standard-mode-generation] Brought artifact loading failed:", err);
    }
  }

  // Fresh pick with treasury exclusions (owned + set crowns).
  try {
    const [ownedIds, crownIds, recentIds] = await Promise.all([
      getOwnedPoolIdsUnion(avatarIds),
      loadCrownArtifactIds(),
      loadRecentStoryIdsForUser(userId, storyId, 12),
    ]);
    const excludeArtifactIds = new Set<string>([...ownedIds, ...crownIds]);

    const requirement: ArtifactRequirement = {
      placeholder: "{{ARTIFACT_REWARD}}",
      preferredCategory: pickStandardModeArtifactCategory(config),
      requiredAbility: undefined,
      contextHint: "Standard mode: prefer a graspable child-readable prop usable as a red-thread object.",
      discoveryChapter: 2,
      usageChapter: 4,
      importance: "medium",
    };
    const genreKey = String(config.genre || "adventure").toLowerCase();
    const languageCode = String(config.language || "de").toLowerCase().startsWith("en") ? "en" : "de";

    const template = await artifactMatcher.match(requirement, genreKey, recentIds, languageCode, {
      excludeArtifactIds,
    });
    if (!template?.id) return {};

    console.log("[standard-mode-generation] Pre-selected pool artifact:", {
      storyId,
      artifactId: template.id,
      ownedExcluded: ownedIds.size,
      crownsExcluded: crownIds.size,
    });
    return { matchedArtifact: templateToMatchedArtifact(template, config.language) };
  } catch (err) {
    console.warn("[standard-mode-generation] Artifact pre-selection failed (engine will self-select):", err);
    return {};
  }
}

// ---------------------------------------------------------------------------
// Pending artifact hydration
// ---------------------------------------------------------------------------

async function buildPendingArtifact(
  artifactId: string | undefined,
  language: StoryLanguage | undefined,
  chapterCount: number
): Promise<StandardModePendingArtifact | undefined> {
  if (!artifactId) return undefined;
  try {
    const row = await storyDB.queryRow<{
      id: string;
      name_de: string | null;
      name_en: string | null;
      description_de: string | null;
      description_en: string | null;
      category: string | null;
      rarity: string | null;
      story_role: string | null;
      visual_keywords: string[] | null;
      emoji: string | null;
      image_url: string | null;
    }>`
      SELECT id, name_de, name_en, description_de, description_en,
             category, rarity, story_role, visual_keywords, emoji, image_url
      FROM artifact_pool
      WHERE id = ${artifactId}
    `;
    if (!row) return undefined;

    const useEnglish = String(language || "de").toLowerCase().startsWith("en");
    const name = (useEnglish ? row.name_en : row.name_de) || row.name_de || row.name_en || "";
    if (!name) return undefined;

    return {
      id: row.id,
      name,
      nameEn: row.name_en || undefined,
      description: ((useEnglish ? row.description_en : row.description_de) || row.description_de || row.description_en) || undefined,
      category: row.category || undefined,
      rarity: row.rarity || undefined,
      storyRole: row.story_role || undefined,
      visualKeywords: Array.isArray(row.visual_keywords) ? row.visual_keywords : [],
      emoji: row.emoji || undefined,
      imageUrl: (await buildArtifactImageUrlForClient(row.id, row.image_url || undefined)) || row.image_url || undefined,
      discoveryChapter: 2,
      usageChapter: Math.max(3, chapterCount - 1),
      locked: true,
    };
  } catch (err) {
    console.warn("[standard-mode-generation] Pending artifact hydration failed (story keeps working):", err);
    return undefined;
  }
}
