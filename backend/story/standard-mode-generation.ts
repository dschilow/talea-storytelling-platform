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
import type { DevModeAvatar, DevModeGeneratedStory } from "./dev-mode-generation";
import { callOpenRouterChatCompletion } from "./openrouter-generation";
import type { StoryConfig, StoryLanguage } from "./generate";
import { storyDB } from "./db";
import { avatarDB } from "../avatar/db";
import { buildArtifactImageUrlForClient } from "../helpers/image-proxy";

const STANDARD_MODE_PIPELINE_ID = "standard-quality-v1";
const STANDARD_MODE_SUPPORT_MODEL = "google/gemini-3.1-flash-lite";
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

  // 3) Prose + images via the proven quality engine. Premium mode targets the
  //    highest release bar; gate misses degrade to warnings (no hard throw)
  //    because strictQualityGates stays unset on the user path.
  const devResult = await generateStoryDevMode({
    config,
    userId,
    storyId,
    avatars: engineAvatars,
    poolCharacters,
    primaryProfileAge: input.primaryProfileAge,
    qualityMode: "premium",
  });

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
  const pendingArtifact = await buildPendingArtifact(
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

/**
 * Loads the most recent memory story titles per avatar and renders one short
 * continuity sentence in the story language. Returns an empty map on any
 * failure — memories are flavor, never a blocker.
 */
async function loadAvatarMemoryAnchors(
  avatarIds: string[],
  language: StoryLanguage | undefined
): Promise<Map<string, string>> {
  const anchors = new Map<string, string>();
  const ids = avatarIds.filter(Boolean);
  if (ids.length === 0) return anchors;

  try {
    const rows = await avatarDB.queryAll<{
      avatar_id: string;
      story_title: string | null;
    }>`
      SELECT avatar_id, story_title
      FROM avatar_memories
      WHERE avatar_id = ANY(${ids})
      ORDER BY created_at DESC
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

    const template = MEMORY_ANCHOR_TEMPLATES[language ?? "de"] ?? MEMORY_ANCHOR_TEMPLATES.de;
    for (const [avatarId, titles] of titlesByAvatar) {
      if (titles.length === 0) continue;
      const anchor = template(titles.map((t) => t.slice(0, 48)));
      anchors.set(avatarId, anchor.slice(0, 200));
    }
  } catch (err) {
    console.warn("[standard-mode-generation] Loading avatar memories failed (continuing without):", err);
  }

  return anchors;
}

function mergeDescriptionWithMemoryAnchor(
  description: string | undefined,
  anchor: string | undefined
): string | undefined {
  const base = String(description || "").trim();
  if (!anchor) return base || undefined;
  if (!base) return anchor;
  return `${base}${/[.!?]$/.test(base) ? "" : "."} ${anchor}`;
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

  const systemPrompt = [
    "You are the character-growth analyst of a children's storytelling platform.",
    "You read one finished children's story and decide how each hero avatar grew through the events they actually experienced on the page.",
    "Output STRICT JSON only. No markdown fences, no comments, no extra keys.",
  ].join(" ");

  const userPrompt = [
    `HERO AVATARS (only these may appear in the output):`,
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
    "1. Exactly one entry per hero avatar, name spelled exactly as listed above.",
    "2. 1-3 changedTraits per avatar. Pick only traits clearly supported by that avatar's own actions/decisions in the text.",
    "3. change is an integer: 1-3 for base traits, 1-5 for knowledge.* subcategories. Small story-sized steps; 3+ only for a defining moment.",
    `4. description: ONE short sentence in language "${language}" naming the concrete story moment that caused the growth (the WHY). Never a generic sentence like "developed through reading".`,
    "5. Prefer base traits. Use a knowledge.* subcategory only when the avatar demonstrably learned facts of that subject in the story.",
    "",
    "OUTPUT JSON SHAPE:",
    '{ "avatarDevelopments": [ { "name": "<avatar name>", "changedTraits": [ { "trait": "<trait id>", "change": <int>, "description": "<one sentence>" } ] } ] }',
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
  const avatarByName = new Map(avatars.map((a) => [a.name.trim().toLowerCase(), a.name]));
  const seen = new Set<string>();
  const result: StandardModeAvatarDevelopment[] = [];

  for (const entry of rawList) {
    const requestedName = String(entry?.name || "").trim().toLowerCase();
    const canonicalName = avatarByName.get(requestedName);
    if (!canonicalName || seen.has(canonicalName)) continue;

    const traits: StandardModeAvatarDevelopment["changedTraits"] = [];
    const usedTraits = new Set<string>();
    const rawTraits = Array.isArray(entry?.changedTraits) ? entry.changedTraits : [];
    for (const rawTrait of rawTraits) {
      const traitId = String(rawTrait?.trait || "").trim();
      if (!ALLOWED_TRAIT_IDS.has(traitId) || usedTraits.has(traitId)) continue;
      const isKnowledgeSub = traitId.startsWith("knowledge.");
      const maxChange = isKnowledgeSub ? 5 : 3;
      const rawChange = Number(rawTrait?.change);
      if (!Number.isFinite(rawChange) || rawChange <= 0) continue;
      const change = Math.max(1, Math.min(maxChange, Math.round(rawChange)));
      const description = String(rawTrait?.description || "").trim().slice(0, 220) || undefined;
      traits.push({ trait: traitId, change, description });
      usedTraits.add(traitId);
      if (traits.length >= 3) break;
    }

    if (traits.length === 0) continue;
    seen.add(canonicalName);
    result.push({ name: canonicalName, changedTraits: traits });
  }

  return result;
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
