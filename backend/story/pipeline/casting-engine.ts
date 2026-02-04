import { storyDB } from "../db";
import type { ArtifactRequirement } from "../types";
import { artifactMatcher, recordStoryArtifact } from "../artifact-matcher";
import type { AvatarDetail, CastSet, CharacterSheet, EnhancedPersonality, MatchScore, NormalizedRequest, RoleSlot, StoryVariantPlan } from "./types";
import { createSeededRandom } from "./utils";
import { buildInvariantsFromVisualProfile, formatInvariantsForPrompt } from "../character-invariants";
import { scoreCandidate } from "./matching-score";
import { resolveImageUrlForClient } from "../../helpers/bucket-storage";
import { suggestSpeechStyles } from "./pool-schemas/character-pool.schema";

interface CharacterPoolRow {
  id: string;
  name: string;
  role: string;
  archetype: string;
  emotional_nature: any;
  visual_profile: any;
  image_url?: string | null;
  gender?: string | null;
  age_category?: string | null;
  species_category?: string | null;
  profession_tags?: string[] | null;
  size_category?: string | null;
  social_class?: string | null;
  personality_keywords?: string[] | null;
  physical_description?: string | null;
  backstory?: string | null;
  recent_usage_count?: number | null;
  total_usage_count?: number | null;
  // V2 personality fields for unique, recognizable characters
  dominant_personality?: string | null;
  secondary_traits?: string[] | null;
  catchphrase?: string | null;
  catchphrase_context?: string | null;
  speech_style?: string[] | null;
  emotional_triggers?: string[] | null;
  quirk?: string | null;
}

const ARTIFACT_ABILITY_MAP: Record<string, string> = {
  GUIDES_TRUE: "navigation",
  GETS_HIJACKED: "protection",
  SOLVES_RIDDLE: "wisdom",
  WARNS_DANGER: "protection",
  REVEALS_MAP: "navigation",
  RESTORES_MAGIC: "magic",
  HEALS_WOUND: "healing",
  CALLS_HELP: "communication",
  TIME_BUFFER: "time",
  CONNECTS_PEOPLE: "communication",
};

export async function buildCastSet(input: {
  normalized: NormalizedRequest;
  roles: RoleSlot[];
  variantPlan: StoryVariantPlan;
  avatars: AvatarDetail[];
}): Promise<CastSet> {
  const { normalized, roles, variantPlan, avatars } = input;
  const rng = createSeededRandom(variantPlan.variantSeed);

  const pool = await loadCharacterPool();
  const used = new Set<string>();
  const matchScores: MatchScore[] = [];

  const avatarSheets = await buildAvatarSheets(avatars);
  avatarSheets.forEach(sheet => used.add(sheet.characterId));

  const poolSheets: CharacterSheet[] = [];
  const slotAssignments: Record<string, string> = {};

  for (const avatarSheet of avatarSheets) {
    slotAssignments[avatarSheet.slotKey] = avatarSheet.characterId;
  }

  for (const slot of roles) {
    if (slot.roleType === "AVATAR") continue;
    if (slot.roleType === "ARTIFACT") continue;
    // Limit non-required pool characters to maximum 4
    if (!slot.required && poolSheets.length >= 4) continue;

    const candidate = await selectCandidateForSlot(slot, pool, used, rng, matchScores);
    if (!candidate) {
      if (slot.required) {
        throw new Error(`No suitable character found for required slot ${slot.slotKey}. Update character_pool or slot constraints.`);
      }
      continue;
    }

    poolSheets.push(candidate);
    slotAssignments[slot.slotKey] = candidate.characterId;
    used.add(candidate.characterId);
  }

  const artifactRequirement = buildArtifactRequirement(variantPlan);
  const artifact = await artifactMatcher.match(
    artifactRequirement,
    normalized.category,
    [],
    normalized.language
  );

  await recordStoryArtifact(
    normalized.storyId,
    artifact.id,
    artifactRequirement.discoveryChapter,
    artifactRequirement.usageChapter
  );

  slotAssignments["SLOT_ARTIFACT_1"] = artifact.id;
  const trimmedScores = trimMatchScores(matchScores);

  return {
    avatars: avatarSheets,
    poolCharacters: poolSheets,
    artifact: {
      artifactId: artifact.id,
      name: normalized.language === "en" ? artifact.name.en : artifact.name.de,
      category: artifact.category,
      storyUseRule: artifact.storyRole,
      visualRule: artifact.visualKeywords.join(", ") || "artifact must be visible",
      rarity: artifact.rarity?.toUpperCase() as any,
    },
    slotAssignments,
    matchScores: trimmedScores,
  };
}

async function buildAvatarSheets(avatars: AvatarDetail[]): Promise<CharacterSheet[]> {
  return Promise.all(avatars.map(async (avatar, index) => {
    const invariants = avatar.visualProfile
      ? buildInvariantsFromVisualProfile(avatar.name, avatar.visualProfile, avatar.description)
      : null;
    const invariantPrompt = invariants ? formatInvariantsForPrompt(invariants) : null;

    const visualSignature = [
      ...(avatar.visualProfile?.consistentDescriptors || []),
      ...(invariantPrompt?.mustIncludeTokens || []),
    ].filter(Boolean).slice(0, 6);

    const outfitLock = [
      avatar.visualProfile?.clothingCanonical?.outfit,
      avatar.visualProfile?.clothingCanonical?.top,
      avatar.visualProfile?.clothingCanonical?.bottom,
    ].filter(Boolean) as string[];

    const faceLock = [
      avatar.visualProfile?.hair?.color ? `${avatar.visualProfile?.hair?.color} hair` : undefined,
      avatar.visualProfile?.eyes?.color ? `${avatar.visualProfile?.eyes?.color} eyes` : undefined,
      avatar.visualProfile?.skin?.tone ? `${avatar.visualProfile?.skin?.tone} skin` : undefined,
    ].filter(Boolean) as string[];

    const forbidden = [
      ...(avatar.visualProfile?.forbiddenFeatures || []),
      ...(invariants?.forbiddenFeatures || []),
    ].filter(Boolean) as string[];

    // Resolve bucket:// URLs to HTTP URLs for reference images
    const resolvedImageUrl = avatar.imageUrl ? await resolveImageUrlForClient(avatar.imageUrl) : undefined;

    return {
      characterId: avatar.id,
      displayName: avatar.name,
      roleType: "AVATAR",
      slotKey: `SLOT_AVATAR_${index + 1}`,
      personalityTags: Object.keys(avatar.personalityTraits || {}).slice(0, 6),
      speechStyleHints: [],
      visualSignature: ensureMinSignature(visualSignature, ["distinct child", "clear facial features"]),
      outfitLock: outfitLock.length > 0 ? outfitLock : ["consistent outfit"],
      faceLock: faceLock.length > 0 ? faceLock : undefined,
      forbidden: forbidden.length > 0 ? forbidden : ["adult proportions"],
      refKey: resolvedImageUrl ? `ref_image_${index + 1}` : undefined,
      referenceImageId: resolvedImageUrl ? avatar.id : undefined,
      imageUrl: resolvedImageUrl,
    };
  }));
}

async function selectCandidateForSlot(
  slot: RoleSlot,
  pool: CharacterPoolRow[],
  used: Set<string>,
  rng: ReturnType<typeof createSeededRandom>,
  matchScores: MatchScore[]
): Promise<CharacterSheet | null> {
  const candidates = pool.filter(candidate => !used.has(candidate.id) && passesHardConstraints(slot, candidate));

  if (candidates.length === 0) return null;

  const scored = candidates.map(candidate => {
    const scoreDetails = scoreCandidate(slot, candidate as any);
    matchScores.push({
      slotKey: slot.slotKey,
      candidateId: candidate.id,
      scores: scoreDetails.scores,
      finalScore: scoreDetails.finalScore,
      notes: scoreDetails.notes,
    });
    return { candidate, score: scoreDetails.finalScore };
  });

  scored.sort((a, b) => b.score - a.score);
  const topScore = scored[0]?.score ?? 0;
  const topTier = scored.filter(item => item.score >= topScore - 0.15);
  const picked = topTier[Math.floor(rng.next() * topTier.length)]?.candidate;

  if (!picked) return null;

  return await buildPoolCharacterSheet(picked, slot.slotKey, slot.roleType);
}

function passesHardConstraints(slot: RoleSlot, candidate: CharacterPoolRow): boolean {
  const constraints = (slot.constraints || []).map(c => c.toLowerCase());
  const genderConstraint = constraints.find(c => c.startsWith("gender="));
  const ageConstraint = constraints.find(c => c.startsWith("age="));
  const speciesConstraint = constraints.find(c => c.startsWith("species="));

  if (genderConstraint) {
    const required = genderConstraint.split("=")[1];
    const actual = (candidate.gender || "any").toLowerCase();
    if (actual !== "any" && actual !== required && actual !== "neutral") {
      return false;
    }
  }

  if (ageConstraint) {
    const required = ageConstraint.split("=")[1];
    const actual = (candidate.age_category || "any").toLowerCase();
    if (actual !== "any" && actual !== required) {
      return false;
    }
  }

  if (speciesConstraint) {
    const required = speciesConstraint.split("=")[1];
    const actual = (candidate.species_category || "any").toLowerCase();
    if (actual !== "any" && actual !== required) {
      return false;
    }
  }

  if (constraints.includes("avoidmodern") || constraints.includes("no modern")) {
    const modernTags = ["pilot", "engineer", "programmer", "police", "doctor", "scientist"];
    const tags = (candidate.profession_tags || []).map(t => t.toLowerCase()).join(" ");
    if (modernTags.some(tag => tags.includes(tag))) {
      return false;
    }
  }

  return true;
}

async function buildPoolCharacterSheet(candidate: CharacterPoolRow, slotKey: string, roleType: RoleSlot["roleType"]): Promise<CharacterSheet> {
  const visualProfile = candidate.visual_profile || {};
  const signature = [visualProfile.description, visualProfile.species].filter(Boolean) as string[];
  const outfit = [candidate.physical_description].filter(Boolean) as string[];
  const forbidden = ["duplicate character", "extra limbs"];

  // Resolve bucket:// URLs to HTTP URLs for reference images
  const resolvedImageUrl = candidate.image_url ? await resolveImageUrlForClient(candidate.image_url) : undefined;

  // Build enhanced personality from DB fields (V2)
  // Priority: V2 columns > emotional_nature JSON > personality_keywords > defaults
  const emotionalNature = candidate.emotional_nature || {};
  const dominant = candidate.dominant_personality
    || emotionalNature.dominant
    || candidate.personality_keywords?.[0]
    || "neugierig";
  const secondary = candidate.secondary_traits
    || emotionalNature.secondary
    || candidate.personality_keywords?.slice(1)
    || [];
  const speechStyle = candidate.speech_style || suggestSpeechStyles(dominant);
  const catchphrase = candidate.catchphrase || undefined;
  const quirk = candidate.quirk || undefined;
  const emotionalTriggers = candidate.emotional_triggers
    || emotionalNature.triggers
    || [];

  const dialogueStyleMap: Record<string, EnhancedPersonality["dialogueStyle"]> = {
    "direkt": "casual", "bestimmt": "casual", "warmherzig": "casual",
    "förmlich": "formal", "bedacht": "wise", "ruhig": "wise",
    "verspielt": "playful", "witzig": "playful", "schnippisch": "playful",
    "knapp": "grumpy", "brummig": "grumpy",
  };
  const dialogueStyle = dialogueStyleMap[speechStyle[0]] || "casual";

  const enhancedPersonality: EnhancedPersonality = {
    dominant,
    secondary,
    catchphrase,
    speechPatterns: speechStyle,
    emotionalTriggers,
    dialogueStyle,
    quirk,
  };

  return {
    characterId: candidate.id,
    displayName: candidate.name,
    roleType,
    slotKey,
    personalityTags: [dominant, ...secondary].slice(0, 6),
    speechStyleHints: speechStyle.slice(0, 3),
    enhancedPersonality,
    catchphrase,
    catchphraseContext: candidate.catchphrase_context || undefined,
    visualSignature: ensureMinSignature(signature.slice(0, 6), ["distinct supporting character", "recognizable outfit"]),
    outfitLock: outfit.length > 0 ? outfit.slice(0, 4) : ["consistent outfit"],
    forbidden,
    refKey: undefined,
    referenceImageId: resolvedImageUrl ? candidate.id : undefined,
    imageUrl: resolvedImageUrl,
  };
}

async function loadCharacterPool(): Promise<CharacterPoolRow[]> {
  try {
    const rows = await storyDB.queryAll<CharacterPoolRow>`
      SELECT * FROM character_pool
      WHERE is_active = TRUE
    `;
    return rows.map(row => ({
      ...row,
      visual_profile: typeof row.visual_profile === "string" ? safeJson(row.visual_profile) : row.visual_profile,
    }));
  } catch (error) {
    console.error("[pipeline] Failed to load character pool", error);
    return [];
  }
}

function safeJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function buildArtifactRequirement(variantPlan: StoryVariantPlan): ArtifactRequirement {
  const functionVariant = variantPlan.variantChoices.artifactFunctionVariant || "GUIDES_TRUE";
  const ability = ARTIFACT_ABILITY_MAP[functionVariant] ?? "navigation";

  return {
    placeholder: "{{ARTIFACT_REWARD}}",
    preferredCategory: "magic" as any,
    requiredAbility: ability,
    contextHint: `Artifact function ${functionVariant}`,
    discoveryChapter: 2,
    usageChapter: 4,
    importance: "high",
  };
}

function trimMatchScores(scores: MatchScore[]): MatchScore[] {
  if (scores.length <= 40) return scores;
  return [...scores]
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, 40);
}

function ensureMinSignature(signature: string[], fallback: string[]): string[] {
  const cleaned = signature.filter(Boolean);
  if (cleaned.length >= 2) return cleaned.slice(0, 6);
  const merged = [...cleaned, ...fallback].filter(Boolean);
  return merged.slice(0, 2);
}
