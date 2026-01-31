import { storyDB } from "../db";
import type { NormalizedRequest, RoleSlot, SceneBeat, StoryBlueprintBase, StoryDNA, TaleDNA } from "./types";
import { MAX_CHAPTERS, MIN_CHAPTERS } from "./constants";
import { createSeededRandom } from "./utils";
import { getTemplateByCategory } from "./story-dna-templates";

const taleCache = new Map<string, { tale: TaleDNA; roles: RoleSlot[]; scenes: SceneBeat[] }>();
const templateCache = new Map<string, StoryDNA>();

export async function loadStoryBlueprintBase(input: {
  normalized: NormalizedRequest;
  variantSeed: number;
}): Promise<StoryBlueprintBase> {
  const { normalized, variantSeed } = input;

  if (normalized.category === "Klassische Märchen") {
    const talePayload = await loadTaleDna(normalized.taleId);
    if (!talePayload) {
      throw new Error("No TaleDNA available for fairy tale generation. Seed at least one TaleDNA entry.");
    }

    const roles = ensureAvatarAndArtifactSlots(talePayload.roles, normalized.avatarCount);
    const scenes = ensureScenesHaveMustInclude(talePayload.scenes, roles);
    return {
      dna: talePayload.tale,
      roles,
      scenes,
    };
  }

  const template = await loadStoryDnaTemplate(normalized.category);
  if (!template) {
    throw new Error(`No StoryDNA template found for category ${normalized.category}`);
  }

  const roles = ensureAvatarAndArtifactSlots(template.roleSlots, normalized.avatarCount);
  const scenes = generateSceneBeatsFromTemplate(template, normalized.chapterCount, variantSeed, roles);

  return {
    dna: template,
    roles,
    scenes,
  };
}

async function loadStoryDnaTemplate(category: string): Promise<StoryDNA | null> {
  if (templateCache.has(category)) {
    return templateCache.get(category) ?? null;
  }
  const inCodeTemplate = getTemplateByCategory(category) ?? null;
  let template = inCodeTemplate;
  try {
    const row = await storyDB.queryRow<{ story_dna: any }>`
      SELECT story_dna FROM story_dna_templates
      WHERE category = ${category}
      ORDER BY template_id
      LIMIT 1
    `;
    if (row?.story_dna) {
      const parsed = parseJsonValue<StoryDNA>(row.story_dna);
      if (!parsed) {
        throw new Error("Failed to parse story_dna template JSON");
      }
      template = parsed;
    }
  } catch (error) {
    console.warn("[pipeline] Failed to load StoryDNA template from DB", error);
  }

  if (template) templateCache.set(category, template);
  return template;
}

async function loadTaleDna(taleId?: string): Promise<{ tale: TaleDNA; roles: RoleSlot[]; scenes: SceneBeat[] } | null> {
  if (taleId && taleCache.has(taleId)) {
    return taleCache.get(taleId) ?? null;
  }
  try {
    if (taleId) {
      const row = await storyDB.queryRow<{ tale_dna: any }>`
        SELECT tale_dna FROM tale_dna
        WHERE tale_id = ${taleId}
      `;
      if (row?.tale_dna) {
        const parsed = parseJsonValue<{ tale: TaleDNA; roles: RoleSlot[]; scenes: SceneBeat[] }>(row.tale_dna);
        if (!parsed) {
          throw new Error("Failed to parse tale_dna JSON");
        }
        taleCache.set(taleId, parsed);
        return parsed;
      }
      // Selected tale has no DNA entry - log this clearly
      console.warn(`[pipeline] TaleDNA not found for selected tale "${taleId}", picking random from available tale_dna entries`);
    }

    // Fallback: pick a RANDOM tale_dna entry (not always the first one)
    const defaultRow = await storyDB.queryRow<{ tale_id: string; tale_dna: any }>`
      SELECT tale_id, tale_dna FROM tale_dna
      ORDER BY RANDOM()
      LIMIT 1
    `;
    if (defaultRow?.tale_dna) {
      const parsed = parseJsonValue<{ tale: TaleDNA; roles: RoleSlot[]; scenes: SceneBeat[] }>(defaultRow.tale_dna);
      if (!parsed) {
        throw new Error("Failed to parse default tale_dna JSON");
      }
      console.log(`[pipeline] Loaded random fallback TaleDNA: "${parsed?.tale?.title || defaultRow.tale_id}"`);
      if (parsed?.tale?.taleId) {
        taleCache.set(parsed.tale.taleId, parsed);
      }
      return parsed;
    }
  } catch (error) {
    console.warn("[pipeline] Failed to load TaleDNA", error);
  }

  return null;
}

function parseJsonValue<T>(value: any): T | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  if (typeof value === "object") {
    return value as T;
  }
  return null;
}

function ensureAvatarAndArtifactSlots(roles: RoleSlot[], avatarCount: number): RoleSlot[] {
  const slotKeys = new Set(roles.map(r => r.slotKey));
  const updated = [...roles];

  if (!slotKeys.has("SLOT_AVATAR_1")) {
    updated.push({
      slotKey: "SLOT_AVATAR_1",
      roleType: "AVATAR",
      required: true,
      roleCount: 1,
      archetypePreference: ["hero"],
      constraints: ["avatar"],
      visualHints: ["user avatar"],
    });
  }
  if (avatarCount > 1 && !slotKeys.has("SLOT_AVATAR_2")) {
    updated.push({
      slotKey: "SLOT_AVATAR_2",
      roleType: "AVATAR",
      required: false,
      roleCount: 1,
      archetypePreference: ["companion"],
      constraints: ["avatar"],
      visualHints: ["user avatar"],
    });
  }
  if (!slotKeys.has("SLOT_ARTIFACT_1")) {
    updated.push({
      slotKey: "SLOT_ARTIFACT_1",
      roleType: "ARTIFACT",
      required: true,
      roleCount: 1,
      visualHints: ["story artifact"],
    });
  }

  return updated;
}

function ensureScenesHaveMustInclude(scenes: SceneBeat[], roles: RoleSlot[]): SceneBeat[] {
  const avatarSlots = roles.filter(r => r.roleType === "AVATAR").map(r => r.slotKey);
  const protagonistSlots = roles.filter(r => r.roleType === "PROTAGONIST").map(r => r.slotKey);
  const fallbackSlots = [...avatarSlots, ...protagonistSlots];

  return scenes.map(scene => {
    const mustInclude = Array.isArray(scene.mustIncludeSlots) && scene.mustIncludeSlots.length > 0
      ? scene.mustIncludeSlots
      : (fallbackSlots.length > 0 ? [fallbackSlots[0]] : [roles[0]?.slotKey].filter(Boolean));

    return {
      ...scene,
      mustIncludeSlots: mustInclude as string[],
    };
  });
}

function generateSceneBeatsFromTemplate(
  template: StoryDNA,
  chapterCount: number,
  variantSeed: number,
  roles: RoleSlot[]
): SceneBeat[] {
  const count = Math.max(MIN_CHAPTERS, Math.min(MAX_CHAPTERS, chapterCount));
  const rng = createSeededRandom(variantSeed);

  const basePattern = buildBeatPattern(template, count, rng);

  return basePattern.map((beat, index) => {
    const mustIncludeSlots: string[] = [];
    beat.mustIncludeRoleTypes.forEach(roleType => {
      const slots = roles.filter(slot => slot.roleType === roleType);
      if (slots.length > 0) {
        const chosen = slots[Math.floor(rng.next() * slots.length)];
        mustIncludeSlots.push(chosen.slotKey);
      }
    });

    if (mustIncludeSlots.length === 0) {
      const avatarSlot = roles.find(slot => slot.roleType === "AVATAR");
      if (avatarSlot) mustIncludeSlots.push(avatarSlot.slotKey);
    }

    return {
      sceneId: `scene_${index + 1}`,
      sceneNumber: index + 1,
      beatType: beat.beatType,
      sceneTitle: beat.sceneTitle,
      setting: beat.settingHint,
      mood: beat.mood,
      sceneDescription: `${beat.sceneTitle} - ${template.coreConflict}`,
      mustIncludeSlots,
      optionalSlots: beat.optionalRoleTypes
        ?.flatMap(roleType => roles.filter(slot => slot.roleType === roleType).map(slot => slot.slotKey))
        .slice(0, 6),
      artifactPolicy: beat.requiresArtifact ? {
        requiresArtifact: true,
        artifactSlotKey: "SLOT_ARTIFACT_1",
        artifactMustBeVisible: true,
      } : undefined,
      promptTemplate: undefined,
      promptTokens: template.themeTags,
      imageAvoid: [],
      continuityNotes: template.themeTags,
    };
  });
}

function buildBeatPattern(template: StoryDNA, count: number, rng: ReturnType<typeof createSeededRandom>) {
  const base = template.beatPattern;
  if (count === base.length) return base;

  if (count < base.length) {
    if (count === 3) {
      return [base[0], base[Math.floor(base.length / 2)], base[base.length - 1]];
    }
    if (count === 4) {
      return [base[0], base[1], base[base.length - 2], base[base.length - 1]];
    }
    return base.slice(0, count);
  }

  const extrasNeeded = count - base.length;
  const conflictBeats = base.filter(b => b.beatType === "CONFLICT");
  const extraBeats = Array.from({ length: extrasNeeded }, (_, i) => {
    const baseBeat = conflictBeats[i % conflictBeats.length] ?? base[Math.floor(base.length / 2)];
    return {
      ...baseBeat,
      sceneTitle: `${baseBeat.sceneTitle} ${i + 2}`,
    };
  });

  const result = [...base.slice(0, -1), ...extraBeats, base[base.length - 1]];
  return result.slice(0, count);
}
